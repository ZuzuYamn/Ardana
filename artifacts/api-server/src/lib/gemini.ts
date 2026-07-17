import {
  GoogleGenerativeAI,
  type GenerativeModel,
  type StartChatParams,
  type GenerateContentResult,
} from "@google/generative-ai";
import { logger } from "./logger";

// ─── Models ───────────────────────────────────────────────────────────────────
// Tried in order when rate-limited. Quotas are per-model on the free tier, so
// falling back to a different model uses a separate daily/minute bucket.

const DEFAULT_MODEL = "gemini-2.0-flash";
const FALLBACK_MODELS = ["gemini-1.5-flash", "gemini-1.5-flash-8b"];

// ─── Key pool ─────────────────────────────────────────────────────────────────
// Loads up to 4 keys from env. GEMINI_API_KEY_1 falls back to GEMINI_API_KEY
// so the original secret continues to work as slot 1.

interface PoolEntry {
  client: GoogleGenerativeAI;
  label: string;
  rateLimitedUntil: number; // epoch ms; 0 = available
}

function buildPool(): PoolEntry[] {
  const candidates = [
    { key: process.env.GEMINI_API_KEY_1 ?? process.env.GEMINI_API_KEY, label: "key-1" },
    { key: process.env.GEMINI_API_KEY_2, label: "key-2" },
    { key: process.env.GEMINI_API_KEY_3, label: "key-3" },
    { key: process.env.GEMINI_API_KEY_4, label: "key-4" },
  ];

  const pool = candidates
    .filter((c): c is { key: string; label: string } => Boolean(c.key))
    .map(({ key, label }) => ({ client: new GoogleGenerativeAI(key), label, rateLimitedUntil: 0 }));

  if (pool.length === 0) {
    logger.warn("No Gemini API keys configured — AI features will not work");
  } else {
    logger.info({ count: pool.length }, `Gemini key pool ready (${pool.length} key${pool.length > 1 ? "s" : ""})`);
  }
  return pool;
}

const pool: PoolEntry[] = buildPool();
// round-robin cursor — advances after each successful pick
let cursor = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function is429(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

/** Parse the server-suggested retry delay from a 429 error message. */
function retryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  // Matches: "retryDelay":"41s" or "Please retry in 8.6s"
  const m = msg.match(/retry(?:Delay)?["\s:]+(\d+(?:\.\d+)?)s/i)
          ?? msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  const seconds = m ? parseFloat(m[1]) : 65;
  return Math.ceil(seconds + 5) * 1000; // +5 s safety buffer
}

// ─── Core rotation logic ──────────────────────────────────────────────────────

/**
 * Run `fn` against a GenerativeModel. On a 429 the key is marked as
 * rate-limited and the next available key is tried automatically.
 * Throws only when all keys are exhausted.
 */
async function tryAllKeysForModel<T>(
  modelName: string,
  fn: (model: GenerativeModel) => Promise<T>,
): Promise<{ result: T } | null> {
  const tried = new Set<number>();

  for (let attempt = 0; attempt < pool.length; attempt++) {
    let chosen = -1;
    for (let i = 0; i < pool.length; i++) {
      const idx = (cursor + i) % pool.length;
      if (!tried.has(idx) && Date.now() >= pool[idx].rateLimitedUntil) {
        chosen = idx;
        break;
      }
    }
    if (chosen === -1) break;

    tried.add(chosen);
    cursor = (chosen + 1) % pool.length;

    const entry = pool[chosen];
    try {
      const model = entry.client.getGenerativeModel({ model: modelName });
      const result = await fn(model);
      return { result };
    } catch (err) {
      if (is429(err)) {
        const delay = retryDelayMs(err);
        entry.rateLimitedUntil = Date.now() + delay;
        logger.warn(
          { key: entry.label, model: modelName, retryInSec: Math.round(delay / 1000) },
          `Gemini ${entry.label} rate-limited on ${modelName} — rotating`,
        );
        continue;
      }
      throw err;
    }
  }
  return null; // all keys exhausted for this model
}

/**
 * Run `fn` with automatic key rotation AND model fallback.
 * Tries every key on the primary model first; if all are rate-limited it
 * moves to the next fallback model (separate quota bucket on the free tier).
 */
async function runWithRotation<T>(
  modelName: string,
  fn: (model: GenerativeModel) => Promise<T>,
): Promise<T> {
  if (pool.length === 0) {
    throw new Error(
      "No Gemini API keys are configured. Add GEMINI_API_KEY_1 (or GEMINI_API_KEY) in environment settings.",
    );
  }

  const modelsToTry = [modelName, ...FALLBACK_MODELS.filter((m) => m !== modelName)];

  for (const model of modelsToTry) {
    const outcome = await tryAllKeysForModel(model, fn);
    if (outcome) return outcome.result;
    logger.warn({ model }, `All keys exhausted for ${model} — trying next fallback model`);
  }

  throw new Error(
    "All Gemini API keys and fallback models are rate-limited. Please wait a few minutes and try again.",
  );
}

// ─── RotatingChatSession ──────────────────────────────────────────────────────
// Wraps startChat so that sendMessage() transparently retries with the next
// key on 429. Each request already sends the full history, so recreating the
// chat session on a different key works perfectly.

class RotatingChatSession {
  constructor(
    private readonly modelName: string,
    private readonly params: StartChatParams,
  ) {}

  async sendMessage(
    parts: Parameters<ReturnType<GenerativeModel["startChat"]>["sendMessage"]>[0],
  ) {
    return runWithRotation(this.modelName, (model) => {
      const chat = model.startChat(this.params);
      return chat.sendMessage(parts);
    });
  }
}

// ─── RotatingGenerativeModel ──────────────────────────────────────────────────
// Drop-in replacement for GenerativeModel. Has the same generateContent /
// startChat surface used by all routes — no route changes required.

class RotatingGenerativeModel {
  constructor(private readonly modelName: string) {}

  generateContent(
    request: Parameters<GenerativeModel["generateContent"]>[0],
  ): Promise<GenerateContentResult> {
    return runWithRotation(this.modelName, (model) => model.generateContent(request));
  }

  startChat(params: StartChatParams = {}): RotatingChatSession {
    return new RotatingChatSession(this.modelName, params);
  }
}

// ─── Public API — same signatures as before, zero route changes needed ────────

/** Agent 1: AI chat assistant */
export function getChatModel(modelName = DEFAULT_MODEL): RotatingGenerativeModel {
  return new RotatingGenerativeModel(modelName);
}

/** Agent 2: Plant identification and disease detection */
export function getVisionModel(modelName = DEFAULT_MODEL): RotatingGenerativeModel {
  return new RotatingGenerativeModel(modelName);
}

/** Agent 3: Contact support assistant */
export function getSupportModel(modelName = DEFAULT_MODEL): RotatingGenerativeModel {
  return new RotatingGenerativeModel(modelName);
}

/** Legacy alias kept for the plants/with-analysis route */
export function getGeminiModel(modelName = DEFAULT_MODEL): RotatingGenerativeModel {
  return new RotatingGenerativeModel(modelName);
}

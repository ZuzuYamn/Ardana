/**
 * Gemini AI client — wraps Google's Generative AI SDK with key rotation.
 *
 * Up to three API keys (GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3)
 * are pooled and rotated automatically on 429 / quota errors.
 */

import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { logger } from "./logger";

// ─── Models ───────────────────────────────────────────────────────────────────

/** Text conversations: farming assistant, support chat */
const CHAT_MODEL = "gemini-3.5-flash";

/** Vision tasks: plant identification, disease detection */
const VISION_MODEL = "gemini-3.5-flash"; // supports text + image input

// ─── Message type (replaces OpenAI.ChatCompletionMessageParam) ────────────────

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  /** Optional image attached to a user message */
  imageBase64?: string;
  mimeType?: string;
};

// ─── Key pool ─────────────────────────────────────────────────────────────────

interface PoolEntry {
  client: GoogleGenerativeAI;
  label: string;
  rateLimitedUntil: number; // epoch ms; 0 = available
}

function buildPool(): PoolEntry[] {
  const candidates = [
    { key: process.env.GEMINI_API_KEY, label: "gemini-agent-1" },
    { key: process.env.GEMINI_API_KEY_2, label: "gemini-agent-2" },
    { key: process.env.GEMINI_API_KEY_3, label: "gemini-agent-3" },
  ];

  const pool = candidates
    .filter((c): c is { key: string; label: string } => Boolean(c.key))
    .map(({ key, label }) => ({
      client: new GoogleGenerativeAI(key),
      label,
      rateLimitedUntil: 0,
    }));

  if (pool.length === 0) {
    logger.warn("No Gemini API keys configured — AI features will not work");
  } else {
    logger.info(
      { count: pool.length },
      `Gemini agent pool ready (${pool.length} agent${pool.length > 1 ? "s" : ""})`,
    );
  }

  return pool;
}

const pool: PoolEntry[] = buildPool();
let cursor = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRateLimited(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

function isTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("503") ||
    msg.includes("Service Unavailable") ||
    msg.includes("high demand") ||
    msg.includes("502") ||
    msg.includes("overloaded")
  );
}

function retryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m =
    msg.match(/retry[_\- ]?after[":\s]+(\d+(?:\.\d+)?)/i) ??
    msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  const seconds = m ? parseFloat(m[1]) : 65;
  return Math.ceil(seconds + 5) * 1000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Core rotation logic ──────────────────────────────────────────────────────

/**
 * Hard ceiling on total time spent inside runWithRotation, across all keys
 * and retries. Keeps failures fast enough to beat frontend/proxy timeouts
 * instead of silently running for a minute or more.
 */
const MAX_TOTAL_MS = 20_000;

/**
 * Max 503-style retries PER KEY. A 503 "high demand" error means the model
 * itself is overloaded — it is not a per-key limit, so rotating to another
 * key rarely helps. We retry the same key briefly, then move on mainly to
 * respect MAX_TOTAL_MS and to cover the (less common) case where the next
 * key routes to different backend capacity.
 */
const MAX_TRANSIENT_RETRIES = 1;
/** Backoff schedule for transient errors: 1.5 s, 3 s */
const TRANSIENT_BACKOFF_MS = [1_500, 3_000];

async function runWithRotation<T>(
  fn: (client: GoogleGenerativeAI) => Promise<T>,
): Promise<T> {
  if (pool.length === 0) {
    throw new Error(
      "No Gemini API keys are configured. Add GEMINI_API_KEY in Replit Secrets.",
    );
  }

  const deadline = Date.now() + MAX_TOTAL_MS;
  const tried = new Set<number>();
  let lastErr: unknown;

  for (let attempt = 0; attempt < pool.length; attempt++) {
    if (Date.now() >= deadline) break;

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

    // Inner retry loop for transient 503/502 errors (model overloaded)
    for (let t = 0; t <= MAX_TRANSIENT_RETRIES; t++) {
      if (Date.now() >= deadline) break;

      try {
        return await fn(entry.client);
      } catch (err) {
        lastErr = err;

        if (isRateLimited(err)) {
          const delay = retryDelayMs(err);
          entry.rateLimitedUntil = Date.now() + delay;
          logger.warn(
            { key: entry.label, retryInSec: Math.round(delay / 1000) },
            `Gemini ${entry.label} rate-limited — rotating to next agent`,
          );
          break; // move on to the next key
        }

        if (isTransient(err)) {
          const remaining = deadline - Date.now();
          if (t < MAX_TRANSIENT_RETRIES) {
            const delay = Math.min(
              TRANSIENT_BACKOFF_MS[t] ?? 3_000,
              Math.max(remaining - 500, 0),
            );
            if (delay <= 0) break; // no time left to retry — move on / exit
            logger.warn(
              { key: entry.label, attempt: t + 1, retryInMs: delay },
              `Gemini 503 (model overloaded) — retrying in ${delay / 1000}s`,
            );
            await sleep(delay);
            continue; // retry same key
          }

          // Exhausted retries on this key — fall through to the next key
          // instead of throwing, so remaining keys still get a chance
          // (mainly useful for non-global transient errors like 502s).
          logger.warn(
            { key: entry.label },
            `Gemini ${entry.label} still overloaded — trying next agent`,
          );
          break;
        }

        // Non-transient, non-rate-limit error — fail fast, don't burn
        // retries or rotate keys on something rotation can't fix.
        throw err;
      }
    }
  }

  const cause =
    lastErr instanceof Error ? lastErr.message : String(lastErr ?? "unknown");
  logger.warn(
    { cause },
    "Gemini request failed after exhausting rotation/deadline",
  );

  throw new Error(
    "The Gemini model is currently overloaded or rate-limited on all configured keys. Please try again shortly.",
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze an image with a text prompt.
 * Used for plant identification and disease detection.
 */
export async function generateFromImage(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  return runWithRotation(async (client) => {
    const model = client.getGenerativeModel({ model: VISION_MODEL });
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      prompt,
    ]);
    return result.response.text().trim();
  });
}

/**
 * Send a chat completion with a full messages array.
 * System messages are extracted and passed as systemInstruction.
 * Used for the farming assistant and support chat.
 */
export async function sendChatCompletion(
  messages: ChatMessage[],
  options: { maxTokens?: number } = {},
): Promise<string> {
  return runWithRotation(async (client) => {
    const systemMsg = messages.find((m) => m.role === "system");
    const conversationMsgs = messages.filter((m) => m.role !== "system");

    const contents: Content[] = conversationMsgs.map((m) => {
      const parts: Content["parts"] = [];
      if (m.role === "user" && m.imageBase64 && m.mimeType) {
        parts.push({
          inlineData: { data: m.imageBase64, mimeType: m.mimeType },
        });
      }
      parts.push({ text: m.content });
      return { role: m.role === "assistant" ? "model" : "user", parts };
    });

    const model = client.getGenerativeModel({
      model: CHAT_MODEL,
      ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
      generationConfig: { maxOutputTokens: options.maxTokens ?? 8192 },
    });

    const result = await model.generateContent({ contents });
    return result.response.text().trim();
  });
}

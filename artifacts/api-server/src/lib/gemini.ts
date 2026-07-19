/**
 * Gemini AI client — unified shared key pool with per-feature concurrency.
 *
 * All AI features (chat, support, disease detection, plant identification,
 * weather alerts) share the same API key pool. This is intentional:
 * Google's rate limits are tied to the project/model, not individual keys,
 * so splitting keys by feature creates idle keys and hot keys without
 * increasing total quota.
 *
 * Instead, we use per-feature concurrency limits so one busy feature cannot
 * starve the others, and we tag every request with a feature label so the
 * logs show exactly who is using quota.
 */

import { GoogleGenerativeAI, type Content } from "@google/generative-ai";
import { logger } from "./logger";

// ─── Models ───────────────────────────────────────────────────────────────────

const CHAT_MODEL = "gemini-3-flash-preview";
const CHAT_FALLBACK_MODEL = "gemini-3.5-flash";

const VISION_MODEL = "gemini-3-flash-preview";
const VISION_FALLBACK_MODEL = "gemini-3.5-flash";

// ─── Message type ────────────────────────────────────────────────────────────

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  imageBase64?: string;
  mimeType?: string;
};

// ─── Feature labels & concurrency ─────────────────────────────────────────────

export type Feature =
  | "ai-assistant"
  | "disease-detection"
  | "plant-identification"
  | "contact-support"
  | "smart-weather-alerts"
  | "care-schedule";

const CONCURRENCY_LIMITS: Record<Feature, number> = {
  "ai-assistant": 3,
  "disease-detection": 2,
  "plant-identification": 2,
  "contact-support": 1,
  "smart-weather-alerts": 1,
  "care-schedule": 2,
};

// ─── Key pool ─────────────────────────────────────────────────────────────────

interface PoolEntry {
  client: GoogleGenerativeAI;
  label: string;
  rateLimitedUntil: number;
}

function buildPool(): PoolEntry[] {
  const candidates = Array.from({ length: 19 }, (_, i) => {
    const num = i + 1;
    const envKey = num === 1 ? "GEMINI_API_KEY" : `GEMINI_API_KEY_${num}`;
    return { key: process.env[envKey], label: `gemini-agent-${num}` };
  });

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

// ─── Concurrency semaphores ───────────────────────────────────────────────────

class Semaphore {
  private waiting: Array<() => void> = [];
  private count: number;

  constructor(private max: number) {
    this.count = max;
  }

  async acquire(): Promise<() => void> {
    if (this.count > 0) {
      this.count--;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.waiting.push(() => {
        this.count--;
        resolve(() => this.release());
      });
    });
  }

  private release() {
    this.count++;
    const next = this.waiting.shift();
    if (next) next();
  }
}

const semaphores = Object.fromEntries(
  Object.entries(CONCURRENCY_LIMITS).map(([feature, limit]) => [
    feature as Feature,
    new Semaphore(limit),
  ]),
) as Record<Feature, Semaphore>;

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
  const anyErr = err as any;

  const details: any[] | undefined =
    anyErr?.errorDetails ?? anyErr?.error?.details ?? anyErr?.details;
  if (Array.isArray(details)) {
    const retryInfo = details.find((d) =>
      typeof d?.["@type"] === "string" && d["@type"].includes("RetryInfo"),
    );
    const raw: string | undefined =
      retryInfo?.retryDelay ?? retryInfo?.retry_delay;
    if (raw) {
      const seconds = parseFloat(String(raw).replace(/s$/i, ""));
      if (!Number.isNaN(seconds)) {
        return Math.ceil(seconds + 2) * 1000;
      }
    }
  }

  const msg = err instanceof Error ? err.message : String(err);
  const m =
    msg.match(/retry[_\- ]?after[":\s]+(\d+(?:\.\d+)?)/i) ??
    msg.match(/retry in (\d+(?:\.\d+)?)s/i) ??
    msg.match(/retryDelay["':\s]+(\d+(?:\.\d+)?)s/i);
  if (m) {
    const seconds = parseFloat(m[1]);
    if (!Number.isNaN(seconds)) {
      return Math.ceil(seconds + 2) * 1000;
    }
  }

  return 12_000; // 12 s default, short enough to avoid cascading lockouts
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Core rotation logic ──────────────────────────────────────────────────────

const MAX_TOTAL_MS = 28_000;
const MAX_TRANSIENT_RETRIES = 0;

async function runWithRotation<T>(
  feature: Feature,
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
  let sawOnlyRateLimit = true;
  let earliestUnlock = Infinity;

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

    if (chosen === -1) {
      for (let i = 0; i < pool.length; i++) {
        if (!tried.has(i)) {
          earliestUnlock = Math.min(earliestUnlock, pool[i].rateLimitedUntil);
        }
      }

      const waitMs = earliestUnlock - Date.now();
      const remaining = deadline - Date.now();
      if (waitMs > 0 && waitMs < remaining) {
        logger.warn(
          { feature, waitMs },
          "All Gemini keys briefly rate-limited — waiting for soonest to free up",
        );
        await sleep(waitMs);
        continue;
      }
      break;
    }

    tried.add(chosen);
    cursor = (chosen + 1) % pool.length;

    const entry = pool[chosen];

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
            { feature, key: entry.label, retryInSec: Math.round(delay / 1000) },
            `Gemini ${entry.label} rate-limited for ${feature} — rotating to next agent`,
          );
          break;
        }

        sawOnlyRateLimit = false;

        if (isTransient(err)) {
          logger.warn(
            { feature, key: entry.label },
            `Gemini ${entry.label} transient for ${feature} — trying next agent`,
          );
          break;
        }

        throw err;
      }
    }
  }

  const cause =
    lastErr instanceof Error ? lastErr.message : String(lastErr ?? "unknown");
  logger.warn(
    { feature, cause, sawOnlyRateLimit },
    "Gemini request failed after exhausting rotation/deadline",
  );

  throw new Error(
    sawOnlyRateLimit
      ? "The Gemini model is currently rate-limited on all configured keys. Please try again shortly."
      : "The Gemini model is currently overloaded or rate-limited on all configured keys. Please try again shortly.",
  );
}

async function withFeature<T>(feature: Feature, fn: () => Promise<T>): Promise<T> {
  const release = await semaphores[feature].acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze an image with a text prompt.
 * Used for plant identification and disease detection.
 */
export async function generateFromImage(
  feature: "disease-detection" | "plant-identification",
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  return withFeature(feature, async () =>
    runWithRotation(feature, async (client) => {
      try {
        const model = client.getGenerativeModel({ model: VISION_MODEL });
        const result = await model.generateContent([
          { inlineData: { data: imageBase64, mimeType } },
          prompt,
        ]);
        return result.response.text().trim();
      } catch (err) {
        if (isTransient(err)) {
          logger.warn(
            { feature },
            "Gemini preview vision model overloaded — falling back to stable model",
          );
          const model = client.getGenerativeModel({ model: VISION_FALLBACK_MODEL });
          const result = await model.generateContent([
            { inlineData: { data: imageBase64, mimeType } },
            prompt,
          ]);
          return result.response.text().trim();
        }
        throw err;
      }
    })
  );
}

/**
 * Send a chat completion with a full messages array.
 * Used for the farming assistant, contact support, and smart weather alerts.
 */
export async function sendChatCompletion(
  feature: Feature,
  messages: ChatMessage[],
  options: { maxTokens?: number } = {},
): Promise<string> {
  return withFeature(feature, async () =>
    runWithRotation(feature, async (client) => {
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

      const buildModel = (modelName: string) =>
        client.getGenerativeModel({
          model: modelName,
          ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
          generationConfig: { maxOutputTokens: options.maxTokens ?? 8192 },
        });

      try {
        const result = await buildModel(CHAT_MODEL).generateContent({ contents });
        return result.response.text().trim();
      } catch (err) {
        if (isTransient(err)) {
          logger.warn(
            { feature },
            "Gemini preview chat model overloaded — falling back to stable model",
          );
          const result = await buildModel(CHAT_FALLBACK_MODEL).generateContent({ contents });
          return result.response.text().trim();
        }
        throw err;
      }
    })
  );
}

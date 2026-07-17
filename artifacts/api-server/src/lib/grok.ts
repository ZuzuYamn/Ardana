/**
 * Grok AI client — wraps xAI's OpenAI-compatible API with two-key rotation.
 *
 * Two API keys (GROK_API_KEY, GROK_API_KEY_2) are pooled and rotated on 429s.
 * Agent 1 (GROK_API_KEY)  — primary key, used for all requests round-robin first.
 * Agent 2 (GROK_API_KEY_2) — secondary key, used when agent 1 is rate-limited.
 */

import OpenAI from "openai";
import { logger } from "./logger";

// ─── Models ────────────────────────────────────────────────────────────────────

/** Text-only conversations: farming assistant, support chat */
const CHAT_MODEL = "grok-2-1212";

/** Image-capable tasks: plant identification, disease detection */
const VISION_MODEL = "grok-2-vision-1212";

// ─── Key pool ─────────────────────────────────────────────────────────────────

interface PoolEntry {
  client: OpenAI;
  label: string;
  rateLimitedUntil: number; // epoch ms; 0 = available
}

function buildPool(): PoolEntry[] {
  const candidates = [
    { key: process.env.GROK_API_KEY,   label: "grok-agent-1" },
    { key: process.env.GROK_API_KEY_2, label: "grok-agent-2" },
  ];

  const pool = candidates
    .filter((c): c is { key: string; label: string } => Boolean(c.key))
    .map(({ key, label }) => ({
      client: new OpenAI({ apiKey: key, baseURL: "https://api.x.ai/v1" }),
      label,
      rateLimitedUntil: 0,
    }));

  if (pool.length === 0) {
    logger.warn("No Grok API keys configured — AI features will not work");
  } else {
    logger.info(
      { count: pool.length },
      `Grok agent pool ready (${pool.length} agent${pool.length > 1 ? "s" : ""})`,
    );
  }
  return pool;
}

const pool: PoolEntry[] = buildPool();
let cursor = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function is429(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("429") ||
    msg.includes("Too Many Requests") ||
    msg.includes("rate_limit") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

function retryDelayMs(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const m =
    msg.match(/retry[_\- ]?after[":\s]+(\d+(?:\.\d+)?)/i) ??
    msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  const seconds = m ? parseFloat(m[1]) : 65;
  return Math.ceil(seconds + 5) * 1000; // +5 s safety buffer
}

// ─── Core rotation logic ──────────────────────────────────────────────────────

async function runWithRotation<T>(fn: (client: OpenAI) => Promise<T>): Promise<T> {
  if (pool.length === 0) {
    throw new Error(
      "No Grok API keys are configured. Add GROK_API_KEY (and optionally GROK_API_KEY_2) in environment settings.",
    );
  }

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
      return await fn(entry.client);
    } catch (err) {
      if (is429(err)) {
        const delay = retryDelayMs(err);
        entry.rateLimitedUntil = Date.now() + delay;
        logger.warn(
          { key: entry.label, retryInSec: Math.round(delay / 1000) },
          `Grok ${entry.label} rate-limited — rotating to next agent`,
        );
        continue;
      }
      throw err;
    }
  }

  throw new Error(
    "All Grok agents are currently rate-limited. Please wait a few minutes and try again.",
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyze an image with a text prompt. Used for plant identification and
 * disease detection. Returns the raw text from the model.
 */
export async function generateFromImage(
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<string> {
  return runWithRotation(async (client) => {
    const completion = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
      max_tokens: 2048,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  });
}

/**
 * Send a chat completion with a full messages array.
 * Used for the farming assistant and support chat.
 */
export async function sendChatCompletion(
  messages: OpenAI.ChatCompletionMessageParam[],
  options: { maxTokens?: number } = {},
): Promise<string> {
  return runWithRotation(async (client) => {
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      max_tokens: options.maxTokens ?? 2048,
    });
    return completion.choices[0]?.message?.content?.trim() ?? "";
  });
}

import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

// ─── Per-agent clients ────────────────────────────────────────────────────────
// Each AI feature group has its own API key so quotas and billing stay separate.
// All fall back to GEMINI_API_KEY if the specific key is not yet configured.

function buildClient(primaryKey: string, label: string): GoogleGenerativeAI | null {
  const key = process.env[primaryKey] ?? process.env["GEMINI_API_KEY"];
  if (!key) {
    logger.warn(
      { key: primaryKey },
      `${primaryKey} (and fallback GEMINI_API_KEY) are not set — ${label} will not work`,
    );
    return null;
  }
  if (!process.env[primaryKey]) {
    logger.info({ key: primaryKey }, `${primaryKey} not set, falling back to GEMINI_API_KEY`);
  }
  return new GoogleGenerativeAI(key);
}

/** Agent 1 – AI Assistant (chat conversations) */
const chatClient = buildClient("CHAT_AI_API_KEY", "AI Assistant");

/** Agent 2 – Vision AI (plant identification + disease detection) */
const visionClient = buildClient("VISION_AI_API_KEY", "Vision AI");

/** Agent 3 – Support AI (Contact Support in Help section) */
const supportClient = buildClient("SUPPORT_AI_API_KEY", "Support AI");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireClient(client: GoogleGenerativeAI | null, keyName: string): GoogleGenerativeAI {
  if (!client) {
    throw new Error(
      `${keyName} is not configured. Please add it in the environment settings.`,
    );
  }
  return client;
}

const DEFAULT_MODEL = "gemini-2.0-flash";

// ─── Public API ───────────────────────────────────────────────────────────────

/** Agent 1: AI chat assistant */
export function getChatModel(modelName = DEFAULT_MODEL) {
  return requireClient(chatClient, "CHAT_AI_API_KEY").getGenerativeModel({ model: modelName });
}

/** Agent 2: Plant identification and disease detection */
export function getVisionModel(modelName = DEFAULT_MODEL) {
  return requireClient(visionClient, "VISION_AI_API_KEY").getGenerativeModel({ model: modelName });
}

/** Agent 3: Contact support assistant */
export function getSupportModel(modelName = DEFAULT_MODEL) {
  return requireClient(supportClient, "SUPPORT_AI_API_KEY").getGenerativeModel({ model: modelName });
}

/** Legacy alias kept for the plants/with-analysis route */
export function getGeminiModel(modelName = DEFAULT_MODEL) {
  // Prefer vision client for the combo identify+detect used during plant save
  const client = visionClient ?? chatClient ?? supportClient;
  return requireClient(client, "VISION_AI_API_KEY").getGenerativeModel({ model: modelName });
}

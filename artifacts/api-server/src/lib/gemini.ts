import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  logger.warn("GEMINI_API_KEY is not set — AI features will not work");
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function getGeminiModel(modelName = "gemini-2.5-flash") {
  if (!genAI) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return genAI.getGenerativeModel({ model: modelName });
}

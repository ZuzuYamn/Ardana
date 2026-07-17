---
name: AI integration history
description: AI provider history — switched from Grok to Gemini; current setup uses Google Gemini
---

The app originally used xAI Grok, then was migrated to Google Gemini.

**Current provider: Google Gemini**
- Entry point: `artifacts/api-server/src/lib/gemini.ts`
- Reads `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` from env; rotates on 429/quota errors
- Uses `@google/generative-ai` SDK (GoogleGenerativeAI class)
- Exports: `generateFromImage` (vision), `sendChatCompletion` (chat), `ChatMessage` type
- Used by: `routes/ai/index.ts`, `routes/plants/index.ts`, `routes/weather/index.ts`

**Current models (as of July 2026):**
- Chat + Vision: `gemini-2.5-flash` (handles both text and image input)

**Why:** "gemini-3.5-flash" does not exist — closest valid model is `gemini-2.5-flash`. Always verify model names at https://docs.x.ai or https://ai.google.dev before using.

**ChatMessage type** supports optional `imageBase64` + `mimeType` fields for vision in chat history. System messages are extracted and passed as `systemInstruction` to Gemini.

**How to add more keys:** Add `GEMINI_API_KEY_2` or `GEMINI_API_KEY_3` as Replit Secrets — the pool auto-discovers them on startup.

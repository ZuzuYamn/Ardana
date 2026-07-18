---
name: AI integration architecture
description: Unified Google Gemini client with shared API key pool and per-feature concurrency limits
---

**Current provider: Google Gemini**
- Entry point: `artifacts/api-server/src/lib/gemini.ts`
- Uses `@google/generative-ai` SDK (GoogleGenerativeAI class)
- Models: `gemini-3-flash-preview` primary, `gemini-3.5-flash` fallback on 503/overload
- Reads `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, `GEMINI_API_KEY_4` from Replit Secrets

**Architecture: shared pool + per-feature concurrency**
- All AI features share the same API key pool. Google's rate limits are tied to the project/model, so splitting keys by feature does not increase total quota and creates idle/hot keys.
- Every request is tagged with a `Feature` label:
  - `ai-assistant` (3 concurrent slots)
  - `disease-detection` (2)
  - `plant-identification` (2)
  - `contact-support` (1)
  - `smart-weather-alerts` (1)
- Per-feature semaphores prevent one busy feature from starving others.
- Key rotation on 429 / quota errors; model fallback on 503/502 overload.

**Exports:** `generateFromImage(feature, imageBase64, mimeType, prompt)`, `sendChatCompletion(feature, messages, options)`, `ChatMessage` type.

**Used by:** `routes/ai/index.ts`, `routes/plants/index.ts`, `routes/weather/index.ts`.

**How to add more keys:** Add `GEMINI_API_KEY_N` as Replit Secrets — the pool auto-discovers them on startup. More keys in the shared pool reduce lockout time on 429s.

**Plant Analysis AI initialization:** No AI/API calls are made until the user uploads an image (`imageBase64 && mimeType`). This is already enforced in the `/api/plants` route and the dedicated `/api/ai/identify-plant` / `/api/ai/detect-disease` endpoints.

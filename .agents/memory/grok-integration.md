---
name: Grok AI integration
description: Replaced Gemini with xAI Grok; covers model names, key config, and API adapter pattern.
---

# Grok AI Integration

Gemini was fully replaced by xAI's Grok (OpenAI-compatible API).

## Configuration
- **Keys:** `GROK_API_KEY` (agent 1) and `GROK_API_KEY_2` (agent 2), stored as Replit Secrets.
- **Client library:** `openai` npm package, pointed at `https://api.x.ai/v1`.
- **`@google/generative-ai` removed** from `package.json`; `lib/gemini.ts` deleted.

## Models
- Text/chat: `grok-2-1212`
- Vision (image input): `grok-2-vision-1212`

## Key files
- `artifacts/api-server/src/lib/grok.ts` — client pool, key rotation, two exported functions:
  - `generateFromImage(imageBase64, mimeType, prompt)` → string (vision tasks)
  - `sendChatCompletion(messages, options?)` → string (chat/text tasks)
- All routes that previously used Gemini now import from `../../lib/grok`.

## Routes updated
- `routes/ai/index.ts` — plant ID, disease detection, chat assistant, support chat
- `routes/plants/index.ts` — inline AI analysis on plant creation
- `routes/weather/index.ts` — smart weather alerts and care recommendations

## API differences from Gemini
- Images: `{ type: "image_url", image_url: { url: "data:mime;base64,..." } }` (not `inlineData`)
- Role names: `"assistant"` not `"model"` for AI turns
- System prompts: proper `{ role: "system", content }` message (not injected as first history turn)
- Response text: `completion.choices[0].message.content` (not `result.response.text()`)

**Why:** Grok keys are per-user xAI accounts; rotating between 2 keys is the quota strategy (same as before with Gemini).

# Ardana — Smart Plant Care & Farm Management

A full-stack plant care and farm management app with AI-powered plant identification, disease detection, weather monitoring, and reminder management.

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, Radix UI, Framer Motion, TanStack Query, Wouter
- **Backend:** Express 5, Node.js, TypeScript, Pino logging, Drizzle ORM
- **Database:** PostgreSQL (Replit managed — `DATABASE_URL` is set automatically)
- **AI:** Google Gemini (plant ID, disease detection, chat assistant, support)
- **Weather:** WeatherAPI.com + OpenWeatherMap

## Monorepo Structure

```
artifacts/
  ardana/          # React + Vite frontend (served at /)
  api-server/      # Express API backend (served at /api)
lib/
  db/              # Drizzle schema & PostgreSQL client
  api-spec/        # OpenAPI specification (source of truth)
  api-zod/         # Zod schemas generated from OpenAPI
  api-client-react/ # React Query hooks
```

## Running the App

Both services start automatically via Replit workflows:

- **Frontend:** `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ardana run dev`
- **API Server:** `PORT=8080 pnpm --filter @workspace/api-server run dev`

To install dependencies: `pnpm install`

## Environment Variables & Secrets

All secrets are stored in Replit Secrets (never committed to git):

| Secret | Purpose |
|--------|---------|
| `SESSION_SECRET` | Express session signing |
| `GEMINI_API_KEY` | Fallback Gemini API key for all AI features |
| `CHAT_AI_API_KEY` | AI chat assistant (Agent 1) |
| `VISION_AI_API_KEY` | Plant ID & disease detection (Agent 2) |
| `SUPPORT_AI_API_KEY` | Support chat (Agent 3) |
| `WEATHERAPI_KEY` | Weather data & geocoding (WeatherAPI.com) |
| `OPENWEATHERMAP_API_KEY` | Weather map tiles (OpenWeatherMap) |

`DATABASE_URL` is managed automatically by Replit — do not set it manually.

## Database Schema

Tables: `users`, `plants`, `reminders`, `user_sessions`

## User Preferences

- Secrets stored in Replit Secrets (not .env files), so they are never pushed to GitHub.

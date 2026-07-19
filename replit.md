# Ardana — Smart Plant Care

A full-stack smart plant care web application with AI-powered plant identification, disease detection, weather-aware care reminders, and an AI farming assistant.

## Stack

- **Frontend**: React + Vite, TypeScript, Tailwind CSS, Radix UI, Framer Motion, TanStack Query, Wouter, Leaflet
- **Backend**: Node.js + Express, TypeScript, esbuild
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: Google Gemini (10-key pool with rotation)
- **Weather**: WeatherAPI + OpenWeatherMap

## Monorepo structure

```
artifacts/
  ardana/         # React frontend (served at /)
  api-server/     # Express API backend (served at /api)
  mockup-sandbox/ # UI prototyping sandbox
lib/
  db/             # Drizzle schema + migrations
  api-spec/       # OpenAPI spec
  api-zod/        # Zod validation schemas
  api-client-react/ # Generated TanStack Query hooks
```

## Running the project

Install dependencies (first time only):
```bash
pnpm install
```

Push database schema:
```bash
pnpm --filter @workspace/db run push
```

Start the API server:
```bash
PORT=8080 pnpm --filter @workspace/api-server run dev
```

Start the frontend (in a separate terminal):
```bash
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ardana run dev
```

The app is available at `http://localhost:5173/`.

## Required secrets (set in Replit Secrets)

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Primary Gemini API key |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_10` | Additional Gemini keys for rotation |
| `WEATHERAPI_KEY` | WeatherAPI.com key |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap key |
| `SESSION_SECRET` | Express session signing secret |

`DATABASE_URL` is provided automatically by Replit.

## Database

Schema is managed by Drizzle ORM. After schema changes, run:
```bash
pnpm --filter @workspace/db run push
```

The `user_sessions` table (for connect-pg-simple) must be created manually — it is not part of the Drizzle schema. It was already created during setup.

## User preferences

- Uses 10 Gemini API keys with automatic rotation and per-feature concurrency limits
- Uses 2 weather providers (WeatherAPI + OpenWeatherMap)

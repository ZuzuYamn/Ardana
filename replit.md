# Ardana — Smart Plant Care

A full-stack smart plant care web application with AI-powered plant identification, disease detection, weather-aware care reminders, and an AI farming assistant.

## Stack

- **Frontend**: React + Vite, TypeScript, Tailwind CSS, Radix UI, Framer Motion, TanStack Query, Wouter, Leaflet
- **Backend**: Node.js + Express, TypeScript, esbuild
- **Database**: PostgreSQL via Drizzle ORM (Replit-managed)
- **AI**: Google Gemini (10-key pool with automatic rotation and per-feature concurrency)
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

## Replit setup (already done)

The following one-time setup steps have been completed on this Replit:

1. **Dependencies installed**: `pnpm install` — all 9 workspace packages resolved.
2. **Database schema pushed**: `pnpm --filter @workspace/db run push` — Drizzle schema applied to the Replit PostgreSQL instance.
3. **Secrets configured** (set via Replit Secrets — see table below).
4. **Workflows running**:
   - `artifacts/api-server: API Server` — builds and starts the Express API on port 8080.
   - `artifacts/ardana: web` — starts the Vite dev server on port 5173.

## Running the project (from scratch)

Install dependencies (first time only):
```bash
pnpm install
```

Push database schema:
```bash
pnpm --filter @workspace/db run push
```

Start the API server workflow (Replit manages this automatically via the configured workflow):
```bash
pnpm --filter @workspace/api-server run dev
```

Start the frontend workflow (Replit manages this automatically):
```bash
pnpm --filter @workspace/ardana run dev
```

## Required secrets (set in Replit Secrets)

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Primary Gemini API key (key 1 of the pool) |
| `GEMINI_API_KEY_2` … `GEMINI_API_KEY_10` | Additional Gemini keys for rotation (keys 2–10) |
| `WEATHERAPI_KEY` | WeatherAPI.com key for forecasts and geocoding |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap key |
| `SESSION_SECRET` | Express session signing secret |

`DATABASE_URL` is provided automatically by Replit and must not be set manually.

## Database

Schema is managed by Drizzle ORM in `lib/db/`. After schema changes, run:
```bash
pnpm --filter @workspace/db run push
```

The `user_sessions` table (for connect-pg-simple) must be created manually — it is not part of the Drizzle schema. Run this once against the database:
```sql
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
```

## User preferences

- Uses 10 Gemini API keys with automatic rotation and per-feature concurrency limits
- Uses 2 weather providers (WeatherAPI + OpenWeatherMap)

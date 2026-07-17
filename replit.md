# Ardana — Smart Plant Care

A full-stack plant care management web app with AI-powered plant identification, disease detection, weather integration, and care reminders.

## Stack

- **Frontend**: React 19, Vite 7, Tailwind CSS 4, Radix UI, Framer Motion, Leaflet maps, Wouter routing, TanStack Query
- **Backend**: Express 5, Drizzle ORM (PostgreSQL), Pino logging, Google Gemini AI (vision + chat)
- **Shared libs**: `lib/db` (schema + Drizzle), `lib/api-spec` (OpenAPI), `lib/api-client-react` (generated hooks), `lib/api-zod` (Zod schemas)

## Running the project

Both services start automatically via Replit workflows:

| Workflow | Command | Port |
|---|---|---|
| API Server | `pnpm --filter @workspace/api-server run dev` | 8080 |
| Web (Ardana) | `pnpm --filter @workspace/ardana run dev` | 5173 |

To install dependencies: `pnpm install` from the root.

## Environment Secrets

All secrets are stored in Replit Secrets (never committed to git):

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | Express session signing |
| `GEMINI_API_KEY` | Google Gemini 2.5 Flash (plant identification, disease detection, chat). Add `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` for rotation |
| `WEATHERAPI_KEY` | WeatherAPI.com weather data |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap fallback weather data |

`DATABASE_URL` and `PG*` vars are managed automatically by Replit.

## Database

Replit's built-in PostgreSQL. Schema managed by Drizzle ORM in `lib/db/src/schema/`:
- `users` — accounts with hashed passwords
- `plants` — plant records per user
- `reminders` — care reminders per plant
- `user_sessions` — Express session store (created manually; never use `createTableIfMissing`)

To push schema changes: `pnpm --filter @workspace/db run push` (dev only — production schema is managed by Replit's Publish flow).

## User preferences

- API keys and secrets stored in Replit Secrets (not in code or git)

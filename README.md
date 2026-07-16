# Ardana — Smart Plant Care & Farm Management

A full-stack AI-powered plant care and farm management application. "Ardana" is derived from the Arabic phrase meaning "Our Land." Users can identify plants, detect diseases, track crops, and get weather-based care recommendations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/ardana run dev` — run the frontend (Vite)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `GEMINI_API_KEY` — Google Gemini API key for AI features

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Framer Motion, Recharts, Wouter routing
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- AI: Google Gemini 2.5 Flash (plant ID, disease detection)
- Weather: Open-Meteo free API (no key required)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/plants.ts` — Plants table
- `lib/db/src/schema/reminders.ts` — Reminders table
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/gemini.ts` — Gemini AI client
- `artifacts/ardana/src/` — React frontend

## Architecture decisions

- OpenAPI-first: all API types generated from `openapi.yaml`, never hand-written
- Gemini `gemini-2.5-flash` used for both plant identification and disease detection (vision)
- Weather proxied through Express to avoid CORS issues and add plant care recommendations
- Plant reminders support 6 types: watering, fertilizing, pruning, spraying, harvesting, other
- Language support (EN/AR/FR/ES/PT) and accessibility (font size, high contrast) stored in localStorage

## Product

- **Dashboard**: farm overview stats, upcoming reminders, weather widget, farm breakdown charts
- **My Farm**: searchable/filterable plant/crop registry with health tracking
- **Plant Detail**: full plant profile with reminders and quick-log actions
- **AI Identify**: upload a photo → Gemini identifies species + care guide
- **AI Disease Detect**: upload a photo → Gemini diagnoses disease + treatment plan
- **Weather**: 7-day forecast, hourly chart, weather-based care advice (Beirut default)
- **Reminders**: full maintenance schedule management
- **Settings**: language (5 languages), accessibility, preferences
- **Help**: user guide, FAQ, step-by-step instructions
- **About**: developer team profiles

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always re-run codegen before writing routes
- Gemini route handlers strip markdown code fences from AI responses before JSON.parse
- Open-Meteo returns hourly data for the entire forecast window; slice from current hour
- The `/plants/dashboard` route must be registered BEFORE `/plants/:id` in Express

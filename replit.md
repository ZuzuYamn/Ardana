# Ardana — Smart Plant Care & Farm Management

AI-powered plant care application with user authentication, plant tracking, disease detection, smart reminders, and weather integration.

## Architecture

**Monorepo (pnpm workspaces):**
- `artifacts/ardana` — React + Vite frontend (preview at `/`)
- `artifacts/api-server` — Express 5 API server (preview at `/api`)
- `lib/db` — Drizzle ORM schema + PostgreSQL client
- `lib/api-zod` — Shared Zod validation schemas
- `lib/api-client-react` — Generated React Query hooks (from OpenAPI spec)

## How to run

Both services start automatically via Replit workflows:
- **Frontend** (`artifacts/ardana: web`): `pnpm --filter @workspace/ardana run dev`
- **API Server** (`artifacts/api-server: API Server`): `pnpm --filter @workspace/api-server run dev`

## Environment Variables / Secrets

| Key | Required | Purpose |
|-----|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SESSION_SECRET` | ✅ | Express session signing secret |
| `GEMINI_API_KEY` | ✅ | Google Gemini for AI plant analysis |

## Database

Schema managed with Drizzle ORM. To push schema changes:
```bash
pnpm --filter @workspace/db run push
```

Tables:
- `users` — registered accounts (email + bcrypt password)
- `plants` — user's plant records with AI analysis results
- `reminders` — watering, fertilizing, pruning schedules
- `user_sessions` — express-session persistent store

## Key Features

1. **Authentication** — Email/password sign-up and sign-in. Session-based (30-day cookies). All routes protected.
2. **Plant Upload** — Camera or gallery photo upload with client-side JPEG compression.
3. **AI Analysis** — Gemini 2.5 Flash identifies species + detects disease simultaneously. Results pre-fill the form.
4. **Smart Reminders** — Auto-generated from watering/fertilizing intervals when saving a plant.
5. **Dashboard** — User-scoped stats, upcoming reminders, weather snapshot.
6. **Weather** — Open-Meteo API (no key required), with plant care recommendations.

## Development notes

- API calls from frontend include `credentials: 'include'` for session cookies (configured in `lib/api-client-react/src/custom-fetch.ts`)
- Images are compressed client-side (≤1024px wide, JPEG 0.82) before upload and stored as base64 data URLs in `plants.photo_url`
- The `POST /api/plants/with-analysis` endpoint runs AI identification + disease detection server-side when `imageBase64` is provided
- All plant and reminder queries are scoped to the authenticated user via `userId` FK

## User Preferences

- Keep the project's existing structure and stack
- Write clean, scalable, production-ready code

# Ardana — Smart Plant Care

A plant management and reminder application with AI-powered insights and weather integration.

## Stack

- **Frontend**: React + Vite + Tailwind CSS + TanStack Query + Radix UI (`artifacts/ardana`)
- **Backend**: Node.js + Express v5 + TypeScript (`artifacts/api-server`)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **AI**: Google Gemini with 10-key rotation pool (`GEMINI_API_KEY` … `GEMINI_API_KEY_10`)
- **Weather**: WeatherAPI + OpenWeatherMap

## How to run

Both services start automatically via Replit workflows:

| Workflow | Command |
|---|---|
| `artifacts/api-server: API Server` | `PORT=8080 pnpm --filter @workspace/api-server run dev` |
| `artifacts/ardana: web` | `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ardana run dev` |

## Database

Schema is managed with Drizzle ORM. To push schema changes:

```bash
pnpm --filter @workspace/db run push
```

## Required secrets

All secrets are stored in Replit Secrets:

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection (Replit-managed) |
| `SESSION_SECRET` | Express session signing |
| `GEMINI_API_KEY` … `GEMINI_API_KEY_10` | Gemini AI key rotation pool |
| `WEATHERAPI_KEY` | WeatherAPI provider |
| `OPENWEATHERMAP_API_KEY` | OpenWeatherMap provider |

## Reminder completion behavior

- Reminders can only be marked as completed if their `scheduledDate` is today.
- Completing a recurring reminder (watering, fertilizing, pruning) automatically schedules the next one based on the plant's care interval.
- Undoing a completed reminder deletes the auto-generated future reminder and recalculates the plant's last-care date.

## User preferences

- Uses 10 Gemini API keys in rotation (keys named `GEMINI_API_KEY` through `GEMINI_API_KEY_10`)

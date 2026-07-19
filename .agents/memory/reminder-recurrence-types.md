---
name: Reminder recurrence care types
description: How backend auto-generates the next recurring reminder when a reminder is marked complete.
---

The backend generates the next recurring reminder in `PATCH /api/reminders/:id` only when the reminder type is listed in `careTypeConfig` (in `artifacts/api-server/src/routes/reminders/index.ts`). For AI-generated reminders it reads the interval from the plant's `*IntervalDays` column; for custom reminders it uses the reminder's own `recurrenceDays`.

**Why:** The original config only covered `watering`, `fertilizing`, and `pruning`. So marking a `spraying` or `harvesting` reminder complete did not create the next occurrence, even when the user had set a recurrence interval.

**How to apply:** When adding a new recurring care type, add both the plant interval column (`*IntervalDays`) and the corresponding entry in `careTypeConfig` (interval field, date field, default interval). Also regenerate the shared lib TypeScript declarations so the frontend and backend see the new fields: `pnpm run typecheck:libs`.

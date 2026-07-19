---
name: Reminder date type mismatch
description: API zod schemas coerce dates to Date objects while the drizzle schema stores them as strings, so DB writes need explicit conversion.
---

The OpenAPI spec uses `format: date` for `scheduledDate`. orval's zod generator (`@workspace/api-zod`) therefore emits `zod.coerce.date()`, which yields a `Date` object at runtime. The drizzle column in `remindersTable` is declared as `date(..., { mode: "string" })`, so insert/update calls expect a `YYYY-MM-DD` string.

**Why:** The mismatch is caused by two different tools interpreting the same OpenAPI spec: orval produces JS Date types, drizzle expects ISO date strings for the column type used here.

**How to apply:** Always convert the parsed Date to an ISO date string before passing it to drizzle, e.g. `scheduledDate.toISOString().split("T")[0]`. The string values are returned from the DB as expected, so response objects are fine.

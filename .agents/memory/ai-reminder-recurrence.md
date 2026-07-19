---
name: AI-generated reminder recurrence
description: AI-generated care reminders keep their interval on the plant, not on the reminder, so UI edits must pre-fill from the plant's care interval.
---

AI-generated care reminders (watering, fertilizing, pruning) have `isCustom = false` and `recurrenceDays = null`. Their repeat cadence is determined by the plant's `wateringIntervalDays`, `fertilizingIntervalDays`, or `pruningIntervalDays`.

When a user edits the recurrence of an AI-generated care reminder, the backend updates the corresponding plant interval. When a user edits the recurrence of a custom reminder (`isCustom = true`), the backend updates the reminder's own `recurrenceDays`.

**Why:** Keeping the interval on the plant ensures all future auto-generated reminders for that care type follow the same cadence, while custom reminders can have their own independent repeat schedule.

**How to apply:** In the UI, when opening the edit dialog for an AI-generated care reminder, look up the plant and pre-fill the recurrence field from the plant's matching interval. After saving, the plant object (and its future reminders) will reflect the new interval.

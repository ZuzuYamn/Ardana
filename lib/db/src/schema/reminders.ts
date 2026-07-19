import { pgTable, text, serial, timestamp, integer, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plantsTable } from "./plants";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("watering"), // watering | fertilizing | pruning | spraying | harvesting | other
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  scheduledTime: text("scheduled_time"), // HH:MM, e.g. "09:00"
  completed: boolean("completed").notNull().default(false),
  generatedFromReminderId: integer("generated_from_reminder_id"),
  isCustom: boolean("is_custom").notNull().default(false),
  recurrenceDays: integer("recurrence_days"), // for custom recurring reminders; null = does not repeat
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;

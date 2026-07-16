import { pgTable, text, serial, timestamp, integer, boolean, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { plantsTable } from "./plants";

export const remindersTable = pgTable("reminders", {
  id: serial("id").primaryKey(),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("watering"), // watering | fertilizing | pruning | spraying | harvesting | other
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  completed: boolean("completed").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertReminderSchema = createInsertSchema(remindersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertReminder = z.infer<typeof insertReminderSchema>;
export type Reminder = typeof remindersTable.$inferSelect;

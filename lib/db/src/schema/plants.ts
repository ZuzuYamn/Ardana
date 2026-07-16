import { pgTable, text, serial, timestamp, integer, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const plantsTable = pgTable("plants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  species: text("species"),
  type: text("type").notNull().default("plant"), // crop | tree | plant | flower | herb | shrub
  location: text("location"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  plantedDate: date("planted_date", { mode: "string" }),
  lastWateredDate: date("last_watered_date", { mode: "string" }),
  lastFertilizedDate: date("last_fertilized_date", { mode: "string" }),
  lastPrunedDate: date("last_pruned_date", { mode: "string" }),
  healthStatus: text("health_status").notNull().default("unknown"), // healthy | moderate | poor | unknown
  wateringIntervalDays: integer("watering_interval_days"),
  fertilizingIntervalDays: integer("fertilizing_interval_days"),
  aiIdentification: text("ai_identification"),   // JSON string of plant identification result
  aiDiseaseDetection: text("ai_disease_detection"), // JSON string of disease detection result
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlantSchema = createInsertSchema(plantsTable).omit({
  id: true,
  userId: true,         // set server-side from session
  aiIdentification: true,
  aiDiseaseDetection: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plantsTable.$inferSelect;

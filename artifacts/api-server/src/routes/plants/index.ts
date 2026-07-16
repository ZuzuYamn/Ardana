import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, plantsTable, remindersTable } from "@workspace/db";
import {
  CreatePlantBody,
  UpdatePlantBody,
  GetPlantParams,
  UpdatePlantParams,
  DeletePlantParams,
  ListPlantsQueryParams,
  ListPlantRemindersParams,
} from "@workspace/api-zod";
import { gte, lte, sql } from "drizzle-orm";

const router: IRouter = Router();

// GET /plants/dashboard — must come before /plants/:id
router.get("/plants/dashboard", async (req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const plants = await db.select().from(plantsTable);
  const allReminders = await db.select().from(remindersTable);

  const byType: Record<string, number> = {};
  const byHealth: Record<string, number> = {};

  for (const p of plants) {
    byType[p.type] = (byType[p.type] ?? 0) + 1;
    byHealth[p.healthStatus] = (byHealth[p.healthStatus] ?? 0) + 1;
  }

  const pendingReminders = allReminders.filter((r) => !r.completed);
  const upcomingRemindersCount = pendingReminders.filter(
    (r) => r.scheduledDate >= today && r.scheduledDate <= sevenDaysLater
  ).length;
  const overdueRemindersCount = pendingReminders.filter(
    (r) => r.scheduledDate < today
  ).length;

  const recentlyWatered = plants.filter(
    (p) => p.lastWateredDate && p.lastWateredDate >= threeDaysAgo
  ).length;

  const needsAttention = plants.filter(
    (p) => p.healthStatus === "poor" || p.healthStatus === "moderate"
  ).length;

  res.json({
    totalPlants: plants.length,
    byType,
    byHealth,
    upcomingRemindersCount,
    overdueRemindersCount,
    recentlyWatered,
    needsAttention,
  });
});

// GET /plants
router.get("/plants", async (req, res): Promise<void> => {
  const params = ListPlantsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { type, healthStatus, search } = params.data;
  let query = db.select().from(plantsTable);

  const conditions = [];
  if (type) conditions.push(eq(plantsTable.type, type));
  if (healthStatus) conditions.push(eq(plantsTable.healthStatus, healthStatus));
  if (search) {
    conditions.push(
      or(
        ilike(plantsTable.name, `%${search}%`),
        ilike(plantsTable.species ?? "", `%${search}%`),
        ilike(plantsTable.location ?? "", `%${search}%`)
      )!
    );
  }

  const plants =
    conditions.length > 0
      ? await db
          .select()
          .from(plantsTable)
          .where(and(...conditions))
      : await db.select().from(plantsTable);

  res.json(plants);
});

// POST /plants
router.post("/plants", async (req, res): Promise<void> => {
  const parsed = CreatePlantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plant] = await db.insert(plantsTable).values(parsed.data).returning();
  res.status(201).json(plant);
});

// GET /plants/:id
router.get("/plants/:id", async (req, res): Promise<void> => {
  const params = GetPlantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(eq(plantsTable.id, params.data.id));

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const plantReminders = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.plantId, params.data.id));

  res.json({
    ...plant,
    reminders: plantReminders.map((r) => ({
      ...r,
      plantName: plant.name,
    })),
  });
});

// PATCH /plants/:id
router.patch("/plants/:id", async (req, res): Promise<void> => {
  const params = UpdatePlantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plant] = await db
    .update(plantsTable)
    .set(parsed.data)
    .where(eq(plantsTable.id, params.data.id))
    .returning();

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  res.json(plant);
});

// DELETE /plants/:id
router.delete("/plants/:id", async (req, res): Promise<void> => {
  const params = DeletePlantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plant] = await db
    .delete(plantsTable)
    .where(eq(plantsTable.id, params.data.id))
    .returning();

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  res.sendStatus(204);
});

// GET /plants/:id/reminders
router.get("/plants/:id/reminders", async (req, res): Promise<void> => {
  const params = ListPlantRemindersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(eq(plantsTable.id, params.data.id));

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const plantReminders = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.plantId, params.data.id));

  res.json(
    plantReminders.map((r) => ({
      ...r,
      plantName: plant.name,
    }))
  );
});

export default router;

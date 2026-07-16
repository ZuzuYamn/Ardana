import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, remindersTable, plantsTable } from "@workspace/db";
import {
  CreateReminderBody,
  UpdateReminderBody,
  UpdateReminderParams,
  DeleteReminderParams,
  ListRemindersQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

// GET /reminders — only returns reminders for the authenticated user's plants
router.get("/reminders", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = ListRemindersQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { completed, type, upcoming } = params.data;
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const rows = await db
    .select({
      id: remindersTable.id,
      plantId: remindersTable.plantId,
      plantName: plantsTable.name,
      type: remindersTable.type,
      scheduledDate: remindersTable.scheduledDate,
      completed: remindersTable.completed,
      notes: remindersTable.notes,
      createdAt: remindersTable.createdAt,
    })
    .from(remindersTable)
    .innerJoin(
      plantsTable,
      and(eq(remindersTable.plantId, plantsTable.id), eq(plantsTable.userId, userId))
    );

  let results = rows.map((r) => ({ ...r, plantName: r.plantName ?? "Unknown" }));

  if (completed !== undefined && completed !== "") {
    const isCompleted = completed === "true";
    results = results.filter((r) => r.completed === isCompleted);
  }
  if (type) {
    results = results.filter((r) => r.type === type);
  }
  if (upcoming === "true") {
    results = results.filter(
      (r) => !r.completed && r.scheduledDate <= sevenDaysLater
    );
  }

  results.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  res.json(results);
});

// POST /reminders
router.post("/reminders", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify the plant belongs to this user
  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(and(eq(plantsTable.id, parsed.data.plantId), eq(plantsTable.userId, userId)));

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const [reminder] = await db
    .insert(remindersTable)
    .values({
      plantId: parsed.data.plantId,
      type: parsed.data.type,
      scheduledDate: parsed.data.scheduledDate,
      notes: parsed.data.notes,
    })
    .returning();

  res.status(201).json({ ...reminder, plantName: plant.name });
});

// PATCH /reminders/:id
router.patch("/reminders/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = UpdateReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Verify ownership through plant
  const [existing] = await db
    .select({ plantId: remindersTable.plantId })
    .from(remindersTable)
    .where(eq(remindersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(and(eq(plantsTable.id, existing.plantId), eq(plantsTable.userId, userId)));

  if (!plant) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const [reminder] = await db
    .update(remindersTable)
    .set(parsed.data)
    .where(eq(remindersTable.id, params.data.id))
    .returning();

  res.json({ ...reminder, plantName: plant.name });
});

// DELETE /reminders/:id
router.delete("/reminders/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select({ plantId: remindersTable.plantId })
    .from(remindersTable)
    .where(eq(remindersTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(and(eq(plantsTable.id, existing.plantId), eq(plantsTable.userId, userId)));

  if (!plant) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  await db.delete(remindersTable).where(eq(remindersTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;

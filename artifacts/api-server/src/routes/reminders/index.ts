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

const router: IRouter = Router();

// GET /reminders
router.get("/reminders", async (req, res): Promise<void> => {
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

  // Join with plants to get plantName
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
    .leftJoin(plantsTable, eq(remindersTable.plantId, plantsTable.id));

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

  // Sort: overdue first, then by date
  results.sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

  res.json(results);
});

// POST /reminders
router.post("/reminders", async (req, res): Promise<void> => {
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(eq(plantsTable.id, parsed.data.plantId));

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

  const [reminder] = await db
    .update(remindersTable)
    .set(parsed.data)
    .where(eq(remindersTable.id, params.data.id))
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(eq(plantsTable.id, reminder.plantId));

  res.json({ ...reminder, plantName: plant?.name ?? "Unknown" });
});

// DELETE /reminders/:id
router.delete("/reminders/:id", async (req, res): Promise<void> => {
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [reminder] = await db
    .delete(remindersTable)
    .where(eq(remindersTable.id, params.data.id))
    .returning();

  if (!reminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;

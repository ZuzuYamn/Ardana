import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
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

  // Fetch the existing reminder before mutating so we can compare its previous state
  // and enforce completion rules (only reminders due today can be completed).
  const [existingReminder] = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.id, params.data.id));

  if (!existingReminder) {
    res.status(404).json({ error: "Reminder not found" });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  // Only allow completing reminders that are scheduled for today.
  if (parsed.data.completed === true && existingReminder.scheduledDate !== today) {
    res.status(400).json({ error: "You can only complete reminders scheduled for today" });
    return;
  }

  const [reminder] = await db
    .update(remindersTable)
    .set(parsed.data)
    .where(eq(remindersTable.id, params.data.id))
    .returning();

  // Map recurring care types to the plant's interval and last-care date fields.
  const careTypeConfig: Record<string, { intervalField: string; dateField: string; defaultInterval: number }> = {
    watering: { intervalField: "wateringIntervalDays", dateField: "lastWateredDate", defaultInterval: 3 },
    fertilizing: { intervalField: "fertilizingIntervalDays", dateField: "lastFertilizedDate", defaultInterval: 20 },
    pruning: { intervalField: "pruningIntervalDays", dateField: "lastPrunedDate", defaultInterval: 180 },
  };
  const careConfig = careTypeConfig[reminder.type];

  // When a care reminder's completion status changes, update the plant's last-* date
  // so the Dashboard "Recently Watered" card and plant lists reflect the change immediately —
  // including when a user undoes a completed watering task.
  if (careConfig && parsed.data.completed === true) {
    await db
      .update(plantsTable)
      .set({ [careConfig.dateField]: today })
      .where(eq(plantsTable.id, existing.plantId));

    // Generate the next recurring reminder based on the plant's care schedule.
    // Only create one if the plant has a positive interval for this care type.
    const interval = (plant[careConfig.intervalField as keyof typeof plant] as number | null | undefined) ?? careConfig.defaultInterval;
    if (interval > 0) {
      const nextDate = new Date(Date.now() + interval * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const existingGenerated = await db
        .select({ id: remindersTable.id })
        .from(remindersTable)
        .where(
          and(
            eq(remindersTable.plantId, existing.plantId),
            eq(remindersTable.type, reminder.type),
            eq(remindersTable.generatedFromReminderId, reminder.id)
          )
        )
        .limit(1);

      if (existingGenerated.length === 0) {
        await db.insert(remindersTable).values({
          plantId: existing.plantId,
          type: reminder.type,
          scheduledDate: nextDate,
          completed: false,
          generatedFromReminderId: reminder.id,
          notes: `Auto-scheduled: next ${reminder.type} in ${interval} day${interval === 1 ? "" : "s"}`,
        });
      }
    }
  } else if (careConfig && parsed.data.completed === false) {
    // Undo: remove the future reminder that was generated from this completion, then
    // recalculate the plant's last care date from any remaining completed reminders.
    await db
      .delete(remindersTable)
      .where(eq(remindersTable.generatedFromReminderId, reminder.id));

    const completedSameType = await db
      .select({ scheduledDate: remindersTable.scheduledDate })
      .from(remindersTable)
      .where(
        and(
          eq(remindersTable.plantId, existing.plantId),
          eq(remindersTable.type, reminder.type),
          eq(remindersTable.completed, true)
        )
      )
      .orderBy(sql`${remindersTable.scheduledDate} DESC`)
      .limit(1);

    const newDate = completedSameType[0]?.scheduledDate ?? null;
    await db
      .update(plantsTable)
      .set({ [careConfig.dateField]: newDate })
      .where(eq(plantsTable.id, existing.plantId));
  }

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

import { Router, type IRouter } from "express";
import { eq, and, ilike, or } from "drizzle-orm";
import { db, plantsTable, remindersTable } from "@workspace/db";
import {
  GetPlantParams,
  UpdatePlantBody,
  UpdatePlantParams,
  DeletePlantParams,
  ListPlantsQueryParams,
  ListPlantRemindersParams,
} from "@workspace/api-zod";
import { gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { generateFromImage } from "../../lib/gemini";

const router: IRouter = Router();

// All plant routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────────────────────
// Validation schema for creating a plant with AI analysis
// ─────────────────────────────────────────────────────────────
const CreatePlantWithAnalysisBody = z.object({
  name: z.string().min(1, "Plant name is required"),
  type: z.string().default("plant"),
  species: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  plantedDate: z.string().optional(),
  healthStatus: z.string().default("unknown"),
  wateringIntervalDays: z.coerce.number().int().positive().optional(),
  fertilizingIntervalDays: z.coerce.number().int().positive().optional(),
  photoDataUrl: z.string().optional(),     // base64 data URL of the plant image
  imageBase64: z.string().optional(),      // raw base64 (used for AI if not already analyzed)
  mimeType: z.string().optional(),
  aiIdentification: z.string().optional(), // pre-analyzed JSON string
  aiDiseaseDetection: z.string().optional(),
});

// Default care intervals applied when the user doesn't specify a schedule
const DEFAULT_WATERING_INTERVAL_DAYS = 3;
const DEFAULT_FERTILIZING_INTERVAL_DAYS = 20;

// Helper: generate reminders after plant creation
// Always creates reminders — uses defaults when intervals are not provided.
async function autoGenerateReminders(plantId: number, wateringIntervalDays?: number, fertilizingIntervalDays?: number) {
  const today = new Date().toISOString().split("T")[0];
  const effectiveWatering = wateringIntervalDays ?? DEFAULT_WATERING_INTERVAL_DAYS;
  const effectiveFertilizing = fertilizingIntervalDays ?? DEFAULT_FERTILIZING_INTERVAL_DAYS;

  const remindersToCreate: Array<{ plantId: number; type: string; scheduledDate: string; notes: string }> = [
    {
      plantId,
      type: "watering",
      scheduledDate: today,
      notes: `Auto-scheduled: water every ${effectiveWatering} day${effectiveWatering === 1 ? "" : "s"}.${wateringIntervalDays ? "" : " (default schedule)"}`,
    },
    {
      plantId,
      type: "fertilizing",
      scheduledDate: new Date(Date.now() + effectiveFertilizing * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: `Auto-scheduled: fertilize every ${effectiveFertilizing} day${effectiveFertilizing === 1 ? "" : "s"}.${fertilizingIntervalDays ? "" : " (default schedule)"}`,
    },
  ];

  await db.insert(remindersTable).values(remindersToCreate);
  return remindersToCreate.length;
}

// ─────────────────────────────────────────────────────────────
// GET /plants/dashboard — must be before /plants/:id
// ─────────────────────────────────────────────────────────────
router.get("/plants/dashboard", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = new Date().toISOString().split("T")[0];
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const plants = await db.select().from(plantsTable).where(eq(plantsTable.userId, userId));
  const allReminders = await db
    .select({ id: remindersTable.id, plantId: remindersTable.plantId, completed: remindersTable.completed, scheduledDate: remindersTable.scheduledDate })
    .from(remindersTable)
    .innerJoin(plantsTable, and(eq(remindersTable.plantId, plantsTable.id), eq(plantsTable.userId, userId)));

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
  const overdueRemindersCount = pendingReminders.filter((r) => r.scheduledDate < today).length;
  const recentlyWatered = plants.filter((p) => p.lastWateredDate && p.lastWateredDate >= threeDaysAgo).length;
  const needsAttention = plants.filter((p) => p.healthStatus === "poor" || p.healthStatus === "moderate").length;

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

// ─────────────────────────────────────────────────────────────
// POST /plants/with-analysis — AI-powered plant creation
// ─────────────────────────────────────────────────────────────
router.post("/plants/with-analysis", async (req, res): Promise<void> => {
  const parsed = CreatePlantWithAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const userId = req.session.userId!;
  const {
    name, type, species, location, notes, plantedDate, healthStatus,
    wateringIntervalDays, fertilizingIntervalDays,
    photoDataUrl, imageBase64, mimeType,
    aiIdentification: preAnalyzedIdentification,
    aiDiseaseDetection: preAnalyzedDisease,
  } = parsed.data;

  let aiIdentification = preAnalyzedIdentification ?? null;
  let aiDiseaseDetection = preAnalyzedDisease ?? null;
  let finalHealthStatus = healthStatus;
  let finalSpecies = species;

  // Run AI analysis if image provided and not already analyzed
  if (imageBase64 && mimeType && (!aiIdentification || !aiDiseaseDetection)) {
    try {
      const IDENTIFY_PROMPT = `You are an expert botanist. Analyze this plant image and identify it.
Return a valid JSON object (no markdown, no code blocks) with these exact fields:
{"species":"scientific name or null","commonName":"common name or null","family":"plant family or null","confidence":"high|medium|low","description":"brief description","wateringRequirements":"watering guidance","growingConditions":"soil/temperature/climate","fertilizers":"recommended fertilizers","careRecommendations":"care tips","sunlight":"sunlight requirements","soilType":"soil type and pH","suggestedWateringIntervalDays":number or null,"suggestedFertilizingIntervalDays":number or null,"estimatedAgeYears":number or null,"error":null}`;

      const DISEASE_PROMPT = `You are an expert plant pathologist. Analyze this plant image for health.
Return a valid JSON object (no markdown, no code blocks) with these exact fields:
{"isHealthy":true or false,"diseaseName":"disease name or null","confidence":"high|medium|low","description":"what you observe","causes":"causes or null","symptoms":"visible symptoms","treatments":"recommended treatments","products":"specific products","preventiveMeasures":"prevention tips","urgency":"immediate|soon|low|none","error":null}`;

      const strip = (s: string) => s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

      const [identifyResult, diseaseResult] = await Promise.allSettled([
        !aiIdentification
          ? generateFromImage("plant-identification", imageBase64, mimeType, IDENTIFY_PROMPT).then(strip)
          : Promise.resolve(aiIdentification),
        !aiDiseaseDetection
          ? generateFromImage("disease-detection", imageBase64, mimeType, DISEASE_PROMPT).then(strip)
          : Promise.resolve(aiDiseaseDetection),
      ]);

      if (identifyResult.status === "fulfilled") {
        aiIdentification = identifyResult.value;
        try {
          const parsed = JSON.parse(identifyResult.value);
          if (!finalSpecies && parsed.species) finalSpecies = parsed.species;
        } catch {}
      }

      if (diseaseResult.status === "fulfilled") {
        aiDiseaseDetection = diseaseResult.value;
        try {
          const parsed = JSON.parse(diseaseResult.value);
          if (parsed.isHealthy === true) finalHealthStatus = "healthy";
          else if (parsed.isHealthy === false && parsed.urgency === "immediate") finalHealthStatus = "poor";
          else if (parsed.isHealthy === false) finalHealthStatus = "moderate";
        } catch {}
      }
    } catch (err) {
      req.log.warn({ err }, "AI analysis failed during plant creation — proceeding without it");
    }
  }

  // Store photo as data URL
  const photoUrl = photoDataUrl ?? null;

  // Apply defaults so the stored intervals always reflect the active schedule
  const effectiveWateringInterval = wateringIntervalDays ?? DEFAULT_WATERING_INTERVAL_DAYS;
  const effectiveFertilizingInterval = fertilizingIntervalDays ?? DEFAULT_FERTILIZING_INTERVAL_DAYS;

  const [plant] = await db
    .insert(plantsTable)
    .values({
      userId,
      name,
      type,
      species: finalSpecies,
      location,
      notes,
      plantedDate,
      healthStatus: finalHealthStatus,
      wateringIntervalDays: effectiveWateringInterval,
      fertilizingIntervalDays: effectiveFertilizingInterval,
      photoUrl,
      aiIdentification,
      aiDiseaseDetection,
    })
    .returning();

  // Auto-generate reminders based on care schedule
  const remindersCreated = await autoGenerateReminders(plant.id, effectiveWateringInterval, effectiveFertilizingInterval);

  res.status(201).json({ ...plant, remindersCreated });
});

// ─────────────────────────────────────────────────────────────
// GET /plants
// ─────────────────────────────────────────────────────────────
router.get("/plants", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = ListPlantsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { type, healthStatus, search } = params.data;
  const conditions = [eq(plantsTable.userId, userId)];

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

  const plants = await db.select().from(plantsTable).where(and(...conditions));
  res.json(plants);
});

// ─────────────────────────────────────────────────────────────
// POST /plants
// ─────────────────────────────────────────────────────────────
router.post("/plants", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const CreateBody = z.object({
    name: z.string().min(1),
    type: z.string().default("plant"),
    species: z.string().optional(),
    location: z.string().optional(),
    notes: z.string().optional(),
    plantedDate: z.string().optional(),
    healthStatus: z.string().default("unknown"),
    wateringIntervalDays: z.coerce.number().int().positive().optional(),
    fertilizingIntervalDays: z.coerce.number().int().positive().optional(),
    photoUrl: z.string().optional(),
  });

  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const effectiveWateringInterval = parsed.data.wateringIntervalDays ?? DEFAULT_WATERING_INTERVAL_DAYS;
  const effectiveFertilizingInterval = parsed.data.fertilizingIntervalDays ?? DEFAULT_FERTILIZING_INTERVAL_DAYS;

  const [plant] = await db.insert(plantsTable).values({
    ...parsed.data,
    userId,
    wateringIntervalDays: effectiveWateringInterval,
    fertilizingIntervalDays: effectiveFertilizingInterval,
  }).returning();

  await autoGenerateReminders(plant.id, effectiveWateringInterval, effectiveFertilizingInterval);

  res.status(201).json(plant);
});

// ─────────────────────────────────────────────────────────────
// GET /plants/:id
// ─────────────────────────────────────────────────────────────
router.get("/plants/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = GetPlantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(and(eq(plantsTable.id, params.data.id), eq(plantsTable.userId, userId)));

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const plantReminders = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.plantId, params.data.id));

  res.json({ ...plant, reminders: plantReminders });
});

// Validation schema for updating a plant (mirrors the create endpoint so the
// edit page can send photoDataUrl and pre-analyzed AI results too).
const UpdatePlantWithAnalysisBody = z.object({
  name: z.string().min(1).optional(),
  type: z.string().optional(),
  species: z.string().nullish(),
  location: z.string().nullish(),
  notes: z.string().nullish(),
  plantedDate: z.string().nullish(),
  healthStatus: z.string().optional(),
  wateringIntervalDays: z.coerce.number().int().positive().nullish(),
  fertilizingIntervalDays: z.coerce.number().int().positive().nullish(),
  photoDataUrl: z.string().nullish(),
  aiIdentification: z.string().nullish(),
  aiDiseaseDetection: z.string().nullish(),
});

// ─────────────────────────────────────────────────────────────
// PATCH /plants/:id
// ─────────────────────────────────────────────────────────────
router.patch("/plants/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = UpdatePlantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePlantWithAnalysisBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const {
    photoDataUrl,
    aiIdentification,
    aiDiseaseDetection,
    ...rest
  } = parsed.data;

  const updateValues: Record<string, unknown> = { ...rest };
  if (photoDataUrl) updateValues.photoUrl = photoDataUrl;
  if (aiIdentification !== undefined) updateValues.aiIdentification = aiIdentification;
  if (aiDiseaseDetection !== undefined) updateValues.aiDiseaseDetection = aiDiseaseDetection;

  const [plant] = await db
    .update(plantsTable)
    .set(updateValues)
    .where(and(eq(plantsTable.id, params.data.id), eq(plantsTable.userId, userId)))
    .returning();

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  res.json(plant);
});

// ─────────────────────────────────────────────────────────────
// DELETE /plants/:id
// ─────────────────────────────────────────────────────────────
router.delete("/plants/:id", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = DeletePlantParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plant] = await db
    .delete(plantsTable)
    .where(and(eq(plantsTable.id, params.data.id), eq(plantsTable.userId, userId)))
    .returning();

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  res.sendStatus(204);
});

// ─────────────────────────────────────────────────────────────
// GET /plants/:id/reminders
// ─────────────────────────────────────────────────────────────
router.get("/plants/:id/reminders", async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const params = ListPlantRemindersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [plant] = await db
    .select()
    .from(plantsTable)
    .where(and(eq(plantsTable.id, params.data.id), eq(plantsTable.userId, userId)));

  if (!plant) {
    res.status(404).json({ error: "Plant not found" });
    return;
  }

  const plantReminders = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.plantId, params.data.id));

  res.json(plantReminders.map((r) => ({ ...r, plantName: plant.name })));
});

export default router;

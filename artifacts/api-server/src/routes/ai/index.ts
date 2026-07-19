import { Router, type IRouter } from "express";
import {
  generateFromImage,
  sendChatCompletion,
  type ChatMessage,
} from "../../lib/gemini";
import { IdentifyPlantBody, DetectDiseaseBody } from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";
import { geocodeLocation, fetchWeatherForecast } from "../../lib/weather";
import { z } from "zod";

const router: IRouter = Router();

router.use(requireAuth);

function deriveGrowthStage(ageYears: number | undefined): string {
  if (ageYears === undefined || ageYears === null) return "unknown";
  if (ageYears < 1) return "seedling/establishment (0-1 year)";
  if (ageYears < 3) return "young/vegetative (1-3 years)";
  if (ageYears < 5) return "maturing (3-5 years)";
  if (ageYears < 20) return "mature (5-20 years)";
  return "very established (20+ years)";
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildIdentifyPrompt(language: string): string {
  return `You are an expert botanist. Analyze this plant image and identify it.

Return a valid JSON object (no markdown, no code blocks) with these exact fields:
{
  "species": "scientific name or null",
  "commonName": "common name or null",
  "family": "plant family or null",
  "confidence": "high | medium | low",
  "description": "brief description of the plant",
  "wateringRequirements": "detailed watering guidance",
  "growingConditions": "soil, temperature, climate requirements",
  "fertilizers": "recommended fertilizers and frequency",
  "careRecommendations": "general care tips and best practices",
  "sunlight": "sunlight requirements (full sun, partial shade, etc.)",
  "soilType": "recommended soil type and pH",
  "suggestedWateringIntervalDays": number or null,
  "suggestedFertilizingIntervalDays": number or null,
  "suggestedPruningIntervalDays": number or null,
  "estimatedAgeYears": number or null,
  "error": null
}

estimatedAgeYears should be your best visual estimate of how many years the plant has been growing. For young seedlings set 0; for mature trees use whole years. If the age cannot be estimated from the image, set it to null.

If you cannot identify the plant or if the image is not of a plant, set species/commonName to null and explain in description. Set error only if there is a technical problem with the image.

Respond in the following language: ${language}.`;
}

function buildDiseasePrompt(language: string): string {
  return `You are an expert plant pathologist. Analyze this plant image and assess its health.

Return a valid JSON object (no markdown, no code blocks) with these exact fields:
{
  "isHealthy": true or false,
  "diseaseName": "disease name or null if healthy",
  "confidence": "high | medium | low",
  "description": "description of what you observe in the plant",
  "causes": "causes of the disease or null if healthy",
  "symptoms": "visible symptoms description",
  "treatments": "recommended treatments and interventions",
  "products": "specific products or chemicals that can help (if applicable)",
  "preventiveMeasures": "how to prevent this disease in future",
  "urgency": "immediate | soon | low | none",
  "error": null
}

Be specific and practical. If the plant appears healthy, set isHealthy to true and diseaseName to null.

Respond in the following language: ${language}.`;
}

const CHAT_SYSTEM_INSTRUCTION = `You are Ardana's AI farming and plant care assistant. You are knowledgeable, friendly, and practical.

Your expertise covers:
- Plant identification from photos and descriptions
- Plant diseases, pest infestations, and treatments
- Watering schedules, irrigation, and moisture management
- Fertilizing, composting, and soil health
- Crop rotation, pruning, and harvest timing
- Weather effects on plants and farming
- Organic and conventional farming practices
- Seed selection and planting schedules

Guidelines:
- Give practical, actionable advice farmers can apply immediately
- When shown an image, describe what you observe in specific detail
- Cite specific quantities, timelines, or product names when relevant
- If you're uncertain, say so clearly rather than guessing
- Keep responses focused and well-structured
- Use markdown formatting (bullet points, bold text, short paragraphs) for clarity
- Be concise — farmers are busy people
- If asked about something outside farming/plants, politely redirect to your specialty`;

const SUPPORT_SYSTEM_INSTRUCTION = `You are Ardana's customer support assistant. You are friendly, clear, and solution-focused.

You help users with:
- How to use Ardana's features (plant tracking, reminders, AI tools, dashboard)
- Troubleshooting issues with the app
- Understanding AI analysis results (plant identification, disease detection)
- Account and data management questions
- Interpreting weather recommendations
- Setting up watering and fertilizing schedules
- Understanding reminder notifications

Guidelines:
- Be concise and direct — give step-by-step instructions when relevant
- If the user reports a bug or technical issue, acknowledge it, explain a workaround if possible, and suggest contacting the team
- Do not make up features that do not exist; be honest about limitations
- Always end with "Is there anything else I can help you with?"
- Stay focused on Ardana and farming topics`;

// ─── Shared schemas ───────────────────────────────────────────────────────────

const ChatHistoryMessage = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().max(8000),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

const ChatBody = z.object({
  history: z.array(ChatHistoryMessage).max(40),
  message: z.string().min(1, "Message cannot be empty").max(4000),
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
});

const SupportBody = z.object({
  history: z.array(ChatHistoryMessage).max(20),
  message: z.string().min(1, "Message cannot be empty").max(2000),
});

// ─── Error translation ────────────────────────────────────────────────────────

function translateAiError(
  err: unknown,
  agentLabel: string,
): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : "Unknown error";
  if (
    msg.includes("Incorrect API key") ||
    msg.includes("invalid_api_key") ||
    msg.includes("API key not valid")
  ) {
    return {
      status: 503,
      message: `${agentLabel} API key is invalid. Please contact the administrator.`,
    };
  }
  if (
    msg.includes("rate_limit") ||
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate-limited")
  ) {
    return {
      status: 429,
      message: "AI request limit reached. Please wait a moment and try again.",
    };
  }
  if (msg.includes("content_filter") || msg.includes("SAFETY")) {
    return {
      status: 400,
      message: "Your input was flagged by safety filters. Please rephrase it.",
    };
  }
  if (msg.includes("is not configured") || msg.includes("No Grok API keys")) {
    return {
      status: 503,
      message: `${agentLabel} is not configured. Please add the API key in environment settings.`,
    };
  }
  if (msg.includes("timeout") || msg.includes("DEADLINE_EXCEEDED")) {
    return {
      status: 504,
      message: "The AI took too long to respond. Please try again.",
    };
  }
  return { status: 500, message: `AI error: ${msg}` };
}

// ─── Helper: strip JSON markdown fences ──────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

// ─── Agent 2 (vision): Plant Identification ───────────────────────────────────

router.post("/ai/identify-plant", async (req, res) => {
  const parsed = IdentifyPlantBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { imageBase64, mimeType, language } = parsed.data;

  try {
    const raw = await generateFromImage("plant-identification", imageBase64, mimeType, buildIdentifyPrompt(language));
    const jsonText = stripFences(raw);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(jsonText);
    } catch {
      req.log.warn({ raw }, "Plant ID: failed to parse JSON from AI");
      res
        .status(502)
        .json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Plant identification failed");
    const { status, message } = translateAiError(err, "Vision AI");
    res.status(status).json({ error: message });
  }
});

// ─── Agent 2 (vision): Disease Detection ─────────────────────────────────────

router.post("/ai/detect-disease", async (req, res) => {
  const parsed = DetectDiseaseBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { imageBase64, mimeType, language } = parsed.data;

  try {
    const raw = await generateFromImage("disease-detection", imageBase64, mimeType, buildDiseasePrompt(language));
    const jsonText = stripFences(raw);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(jsonText);
    } catch {
      req.log.warn({ raw }, "Disease detection: failed to parse JSON from AI");
      res
        .status(502)
        .json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Disease detection failed");
    const { status, message } = translateAiError(err, "Vision AI");
    res.status(status).json({ error: message });
  }
});

// ─── Agent 1: AI Chat Assistant ───────────────────────────────────────────────

router.post("/ai/chat", async (req, res) => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { history, message, imageBase64, mimeType } = parsed.data;

  try {
    // Build messages array: system prompt + conversation history + new message
    const messages: ChatMessage[] = [
      { role: "system", content: CHAT_SYSTEM_INSTRUCTION },

      // Previous conversation turns.
      // NOTE: we intentionally do NOT re-attach imageBase64 from history
      // here. Doing so would resend every past image on every subsequent
      // turn, ballooning request size/token usage and causing rate limits
      // and timeouts on longer conversations. Only the CURRENT turn's
      // image (below) is ever sent.
      ...history.map(
        (msg): ChatMessage => ({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.text,
        }),
      ),

      // Current user message (may include an image)
      {
        role: "user",
        content: message,
        ...(imageBase64 && mimeType ? { imageBase64, mimeType } : {}),
      },
    ];

    const reply = await sendChatCompletion("ai-assistant", messages);

    if (!reply) {
      res
        .status(502)
        .json({
          error: "The AI returned an empty response. Please try again.",
        });
      return;
    }

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "AI chat failed");
    const { status, message: errMsg } = translateAiError(err, "Chat AI");
    res.status(status).json({ error: errMsg });
  }
});

// ─── Agent 1: Contact Support ─────────────────────────────────────────────────

router.post("/ai/support", async (req, res) => {
  const parsed = SupportBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { history, message } = parsed.data;

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: SUPPORT_SYSTEM_INSTRUCTION },

      ...history.map(
        (msg): ChatMessage => ({
          role: msg.role === "model" ? "assistant" : "user",
          content: msg.text,
        }),
      ),

      { role: "user", content: message },
    ];

    const reply = await sendChatCompletion("contact-support", messages, { maxTokens: 1024 });

    if (!reply) {
      res
        .status(502)
        .json({ error: "No response from support AI. Please try again." });
      return;
    }

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Support AI failed");
    const { status, message: errMsg } = translateAiError(err, "Support AI");
    res.status(status).json({ error: errMsg });
  }
});

// ─── Care schedule generator (location + weather + species + age) ───────────

const CareScheduleBody = z.object({
  species: z.string().optional(),
  commonName: z.string().optional(),
  estimatedAgeYears: z.coerce.number().min(0).optional(),
  location: z.string().min(1, "Location is required"),
  plantType: z.string().default("tree"),
  language: z.string().default("en"),
});

const CARE_SCHEDULE_PROMPT = `You are an expert horticulturist and agronomist. Generate a personalized, evidence-based watering and fertilization schedule for a specific plant in its exact location and current weather context.

Your job is to combine the plant's species, estimated age/growth stage, plant type, and local weather forecast into a practical care plan that respects the plant's real horticultural needs.

Return a valid JSON object (no markdown, no code blocks) with exactly these fields:
{
  "wateringIntervalDays": number,
  "fertilizingIntervalDays": number,
  "pruningIntervalDays": number or null,
  "wateringNotes": "short practical notes: watering technique, depth, seasonal adjustment, and weather-driven changes for this specific plant",
  "fertilizingNotes": "short practical notes: fertilizer type/NPK, application timing, and species-specific guidance",
  "pruningNotes": "short practical notes: what to prune, when, and how often for this plant",
  "explanation": "one concise sentence explaining why these intervals fit this plant, age, and current climate"
}

=== SPECIES-SPECIFIC GUIDANCE ===
- Use the exact scientific or common name when known. Apply established horticultural rules for that plant (e.g., citrus prefer consistently moist but well-drained soil; succulents/cacti need infrequent deep watering; roses are heavy feeders; legumes need less nitrogen; acid-loving plants like blueberries need low-pH fertilizer).
- If the species is unknown or uncertain, fall back to the plant type and general climate rules.
- Do not recommend a generic 7-day / 60-day schedule unless the data truly supports it.

=== GROWTH STAGE (from estimated age) ===
Use the growth stage to decide watering depth and frequency, and fertilizing strength and timing:
- 0–1 year (seedling/establishment): keep root zone evenly moist, never waterlogged. Use frequent light watering. Fertilize very lightly (half-strength balanced liquid) every 14–21 days only during active growth.
- 1–3 years (young/vegetative): encourage root establishment. Water deeply 2–4 times per week in warm weather; less in cool weather. Fertilize every 28–42 days with balanced fertilizer during growing season.
- 3–5 years (maturing): roots are deeper. Water deeply but less often. Fertilize every 45–60 days during growing season.
- 5–20 years (mature): drought-tolerant; longer intervals. Fertilize 2–4 times per year (every 60–120 days) based on species needs.
- 20+ years (very established): minimal intervention; focus on soil health, not heavy fertilizing. Water only during prolonged dry spells.

=== WEATHER & CLIMATE ADAPTATION ===
Use the current weather and 7-day forecast to adjust the base schedule:
- Hot/dry/windy (daily highs >30°C, low humidity, UV >6, strong wind): increase watering frequency by 25–50%. Water early morning or late evening. Mention mulch if appropriate.
- Heatwave (daily highs >35°C for 2+ days): reduce interval by up to 50% and recommend deep watering. Skip or halve fertilizer during heat stress.
- Cool/humid/wet (daily highs <18°C, humidity >70%, rain): decrease watering frequency by 25–50%. Do not fertilize in cold, wet soil.
- Rainfall: if total expected rainfall in the next 3 days is >10mm, reduce the watering interval by one step or skip the next watering. If >25mm, pause watering until soil drains.
- Dormant / near-freezing conditions (daily highs <10°C or frost expected): reduce watering sharply and stop fertilizing.
- Indoor/potted plants: treat container drying and leaching; water more frequently than field trees but avoid waterlogged pots. Fertilize more often because nutrients leach with each watering.
- Field/ground trees: prefer deep, infrequent watering to encourage deep roots; fertilize by canopy radius.

=== INTERVAL LIMITS ===
- Watering interval: 1–14 days for seedlings/young plants; 3–21 days for established potted plants; 7–45 days for mature field trees. Use whole numbers only.
- Fertilizing interval: 14–60 days for seedlings/young plants in active growth; 30–90 days for maturing plants; 60–180 days for mature trees. Skip fertilizing during dormancy or heat stress.
- If the plant is clearly in active growth, lean toward the shorter end of the range. If dormant, stressed, or heat-stressed, lean toward the longer end or pause.
- If you cannot make a confident recommendation, return wateringIntervalDays: 7 and fertilizingIntervalDays: 60 and pruningIntervalDays: null and explain the uncertainty in the notes.`;

router.post("/ai/care-schedule", async (req, res): Promise<void> => {
  const parsed = CareScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { species, commonName, estimatedAgeYears, location, plantType, language } = parsed.data;

  const growthStage = deriveGrowthStage(estimatedAgeYears);

  try {
    // Geocode the location and fetch a 7-day forecast for climate context
    const geo = await geocodeLocation(location);
    let weatherContext = "Weather data unavailable; use general climate knowledge for this location.";
    let climateSummary = "";
    if (geo) {
      const forecast = await fetchWeatherForecast(geo.lat, geo.lon, language);
      if (forecast) {
        const avgMaxTemp = Math.round(
          forecast.daily.reduce((sum, d) => sum + d.maxTemp, 0) / forecast.daily.length
        );
        const avgMinTemp = Math.round(
          forecast.daily.reduce((sum, d) => sum + d.minTemp, 0) / forecast.daily.length
        );
        const avgHumidity = Math.round(
          forecast.daily.reduce((sum, d) => sum + d.avgHumidity, 0) / forecast.daily.length
        );
        const totalRain = forecast.daily.reduce((sum, d) => sum + d.precipitation, 0);
        const maxUv = forecast.daily.reduce((max, d) => Math.max(max, d.uvIndex), forecast.current.uvIndex);
        const heatDays = forecast.daily.filter((d) => d.maxTemp > 30).length;
        const heatwaveDays = forecast.daily.filter((d) => d.maxTemp > 35).length;
        const coldDays = forecast.daily.filter((d) => d.maxTemp < 10).length;
        const rainDays = forecast.daily.filter((d) => d.precipitation > 0.5).length;

        climateSummary =
          `Weekly climate summary: avg high ${avgMaxTemp}°C, avg low ${avgMinTemp}°C, avg humidity ${avgHumidity}%, ` +
          `total rain ${totalRain.toFixed(1)}mm over ${rainDays} days, max UV ${maxUv}, ` +
          `heat days (>30°C): ${heatDays}, heatwave days (>35°C): ${heatwaveDays}, cold days (<10°C): ${coldDays}.`;

        const summary = forecast.daily
          .map(
            (d) =>
              `${d.date}: ${d.weatherDescription}, ${d.minTemp}°C–${d.maxTemp}°C, ` +
              `humidity ${d.avgHumidity}%, rain ${d.precipitation}mm, chance ${d.chanceOfRain}%`
          )
          .join("\n");
        weatherContext =
          `Location: ${forecast.locationName} (${forecast.lat}, ${forecast.lon}).\n` +
          `Current: ${forecast.current.weatherDescription}, ${forecast.current.temperature}°C, ` +
          `humidity ${forecast.current.humidity}%, precipitation ${forecast.current.precipitation}mm, UV ${forecast.current.uvIndex}.\n` +
          `${climateSummary}\n` +
          `7-day forecast:\n${summary}`;
      }
    }

    const prompt = `${CARE_SCHEDULE_PROMPT}

Respond in the following language: ${language}.

PLANT PROFILE:
- Species: ${species ?? "unknown"}
- Common name: ${commonName ?? "unknown"}
- Plant type: ${plantType}
- Estimated age: ${estimatedAgeYears ?? "unknown"} years
- Growth stage: ${growthStage}
- Location: ${location}

${weatherContext}`;

    const raw = await sendChatCompletion("care-schedule", [{ role: "user", content: prompt }]);
    const jsonText = stripFences(raw);

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(jsonText);
    } catch {
      req.log.warn({ raw }, "Care schedule: failed to parse JSON from AI");
      res.status(502).json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    // Sanitize interval values to positive integers; pruning is optional.
    const wateringIntervalDays = Math.max(1, Math.round(Number(result.wateringIntervalDays) || 7));
    const fertilizingIntervalDays = Math.max(1, Math.round(Number(result.fertilizingIntervalDays) || 60));
    const rawPruning = Number(result.pruningIntervalDays);
    const pruningIntervalDays = Number.isFinite(rawPruning) && rawPruning > 0 ? Math.max(1, Math.round(rawPruning)) : null;

    res.json({
      wateringIntervalDays,
      fertilizingIntervalDays,
      pruningIntervalDays,
      wateringNotes: String(result.wateringNotes ?? ""),
      fertilizingNotes: String(result.fertilizingNotes ?? ""),
      pruningNotes: String(result.pruningNotes ?? ""),
      explanation: String(result.explanation ?? ""),
    });
  } catch (err) {
    req.log.error({ err }, "Care schedule generation failed");
    const { status, message } = translateAiError(err, "Care Schedule AI");
    res.status(status).json({ error: message });
  }
});

export default router;

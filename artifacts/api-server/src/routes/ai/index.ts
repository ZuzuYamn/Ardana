import { Router, type IRouter } from "express";
import { getGeminiModel } from "../../lib/gemini";
import { IdentifyPlantBody, DetectDiseaseBody } from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

router.use(requireAuth);

// ─── Prompts ──────────────────────────────────────────────────────────────────

const IDENTIFY_PROMPT = `You are an expert botanist. Analyze this plant image and identify it.

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
  "error": null
}

If you cannot identify the plant or if the image is not of a plant, set species/commonName to null and explain in description. Set error only if there is a technical problem with the image.`;

const DISEASE_PROMPT = `You are an expert plant pathologist. Analyze this plant image and assess its health.

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

Be specific and practical. If the plant appears healthy, set isHealthy to true and diseaseName to null.`;

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

// ─── Schemas ──────────────────────────────────────────────────────────────────

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

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post("/ai/identify-plant", async (req, res): Promise<void> => {
  const parsed = IdentifyPlantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent([
      { inlineData: { data: parsed.data.imageBase64, mimeType: parsed.data.mimeType } },
      IDENTIFY_PROMPT,
    ]);

    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const json = JSON.parse(cleaned);
    res.json(json);
  } catch (err: unknown) {
    req.log.error({ err }, "Plant identification failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({
      species: null, commonName: null, family: null, confidence: null,
      description: null, wateringRequirements: null, growingConditions: null,
      fertilizers: null, careRecommendations: null, sunlight: null, soilType: null,
      suggestedWateringIntervalDays: null, suggestedFertilizingIntervalDays: null,
      error: `Analysis failed: ${message}`,
    });
  }
});

router.post("/ai/detect-disease", async (req, res): Promise<void> => {
  const parsed = DetectDiseaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent([
      { inlineData: { data: parsed.data.imageBase64, mimeType: parsed.data.mimeType } },
      DISEASE_PROMPT,
    ]);

    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const json = JSON.parse(cleaned);
    res.json(json);
  } catch (err: unknown) {
    req.log.error({ err }, "Disease detection failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({
      isHealthy: false, diseaseName: null, confidence: null, description: null,
      causes: null, symptoms: null, treatments: null, products: null,
      preventiveMeasures: null, urgency: null,
      error: `Analysis failed: ${message}`,
    });
  }
});

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = ChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { history, message, imageBase64, mimeType } = parsed.data;

  try {
    const model = getGeminiModel("gemini-2.5-flash");

    // Build Gemini conversation history from prior turns
    const geminiHistory = history.map((msg) => ({
      role: msg.role,
      parts: [
        ...(msg.role === "user" && msg.imageBase64 && msg.mimeType
          ? [{ inlineData: { data: msg.imageBase64, mimeType: msg.mimeType } }]
          : []),
        { text: msg.text },
      ],
    }));

    // Embed system context as the first exchange in history (most SDK-compatible approach)
    const systemHistory = [
      {
        role: "user",
        parts: [{ text: "Please act as an expert farming and plant care AI assistant." }],
      },
      {
        role: "model",
        parts: [{ text: CHAT_SYSTEM_INSTRUCTION }],
      },
    ];

    const chat = model.startChat({
      history: [...systemHistory, ...geminiHistory],
    });

    // Current user message parts (text + optional image)
    const messageParts = [
      ...(imageBase64 && mimeType
        ? [{ inlineData: { data: imageBase64, mimeType } }]
        : []),
      { text: message },
    ];

    const result = await chat.sendMessage(messageParts);
    const reply = result.response.text().trim();

    if (!reply) {
      res.status(502).json({ error: "The AI returned an empty response. Please try again." });
      return;
    }

    res.json({ reply });
  } catch (err: unknown) {
    req.log.error({ err }, "AI chat failed");
    const errMessage = err instanceof Error ? err.message : "Unknown error";

    // Translate common Gemini error messages into user-friendly ones
    if (errMessage.includes("API_KEY_INVALID") || errMessage.includes("API key not valid")) {
      res.status(503).json({ error: "The AI service is not configured. Please contact the administrator." });
    } else if (errMessage.includes("RESOURCE_EXHAUSTED") || errMessage.includes("quota")) {
      res.status(429).json({ error: "AI request limit reached. Please wait a moment and try again." });
    } else if (errMessage.includes("SAFETY")) {
      res.status(400).json({ error: "Your message was flagged by safety filters. Please rephrase it." });
    } else if (errMessage.includes("GEMINI_API_KEY is not configured")) {
      res.status(503).json({ error: "AI features require a GEMINI_API_KEY. Please configure it in the environment settings." });
    } else {
      res.status(500).json({ error: `AI assistant error: ${errMessage}` });
    }
  }
});

export default router;

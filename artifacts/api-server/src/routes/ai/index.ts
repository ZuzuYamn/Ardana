import { Router, type IRouter } from "express";
import { getChatModel, getVisionModel, getSupportModel } from "../../lib/gemini";
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

function translateAiError(err: unknown, agentLabel: string): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : "Unknown error";
  if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
    return { status: 503, message: `${agentLabel} API key is invalid. Please contact the administrator.` };
  }
  if (msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
    return { status: 429, message: "AI request limit reached. Please wait a moment and try again." };
  }
  if (msg.includes("SAFETY")) {
    return { status: 400, message: "Your input was flagged by safety filters. Please rephrase it." };
  }
  if (msg.includes("is not configured")) {
    return { status: 503, message: `${agentLabel} is not configured. Please add the API key in environment settings.` };
  }
  if (msg.includes("DEADLINE_EXCEEDED") || msg.includes("timeout")) {
    return { status: 504, message: "The AI took too long to respond. Please try again." };
  }
  return { status: 500, message: `AI error: ${msg}` };
}

// ─── Agent 2: Plant Identification ────────────────────────────────────────────

router.post("/ai/identify-plant", async (req, res) => {
  const parsed = IdentifyPlantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;

  try {
    const model = getVisionModel();
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      { text: IDENTIFY_PROMPT },
    ]);

    const raw = result.response.text().trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      req.log.warn({ raw }, "Plant ID: failed to parse JSON from AI");
      res.status(502).json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    res.json(parsed);
  } catch (err) {
    req.log.error({ err }, "Plant identification failed");
    const { status, message } = translateAiError(err, "Vision AI");
    res.status(status).json({ error: message });
  }
});

// ─── Agent 2: Disease Detection ───────────────────────────────────────────────

router.post("/ai/detect-disease", async (req, res) => {
  const parsed = DetectDiseaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { imageBase64, mimeType } = parsed.data;

  try {
    const model = getVisionModel();
    const result = await model.generateContent([
      { inlineData: { data: imageBase64, mimeType } },
      { text: DISEASE_PROMPT },
    ]);

    const raw = result.response.text().trim();
    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      req.log.warn({ raw }, "Disease detection: failed to parse JSON from AI");
      res.status(502).json({ error: "AI returned an unexpected format. Please try again." });
      return;
    }

    res.json(parsed);
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
    res.status(400).json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { history, message, imageBase64, mimeType } = parsed.data;

  try {
    const model = getChatModel();

    // Rebuild conversation history for Gemini
    const geminiHistory = history.map((msg) => ({
      role: msg.role,
      parts: [
        ...(msg.imageBase64 && msg.mimeType
          ? [{ inlineData: { data: msg.imageBase64, mimeType: msg.mimeType } }]
          : []),
        { text: msg.text },
      ],
    }));

    // Inject system instruction as the first exchange
    const systemHistory = [
      {
        role: "user" as const,
        parts: [{ text: "Please act as an expert farming and plant care AI assistant." }],
      },
      {
        role: "model" as const,
        parts: [{ text: CHAT_SYSTEM_INSTRUCTION }],
      },
    ];

    const chat = model.startChat({
      history: [...systemHistory, ...geminiHistory],
    });

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
  } catch (err) {
    req.log.error({ err }, "AI chat failed");
    const { status, message: errMsg } = translateAiError(err, "Chat AI");
    res.status(status).json({ error: errMsg });
  }
});

// ─── Agent 3: Contact Support ─────────────────────────────────────────────────

router.post("/ai/support", async (req, res) => {
  const parsed = SupportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request: " + parsed.error.issues[0]?.message });
    return;
  }

  const { history, message } = parsed.data;

  try {
    const model = getSupportModel();

    const geminiHistory = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    }));

    const systemHistory = [
      {
        role: "user" as const,
        parts: [{ text: "Please act as Ardana's customer support assistant." }],
      },
      {
        role: "model" as const,
        parts: [{ text: SUPPORT_SYSTEM_INSTRUCTION }],
      },
    ];

    const chat = model.startChat({
      history: [...systemHistory, ...geminiHistory],
    });

    const result = await chat.sendMessage([{ text: message }]);
    const reply = result.response.text().trim();

    if (!reply) {
      res.status(502).json({ error: "No response from support AI. Please try again." });
      return;
    }

    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Support AI failed");
    const { status, message: errMsg } = translateAiError(err, "Support AI");
    res.status(status).json({ error: errMsg });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { getGeminiModel } from "../../lib/gemini";
import { IdentifyPlantBody, DetectDiseaseBody } from "@workspace/api-zod";

const router: IRouter = Router();

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

router.post("/ai/identify-plant", async (req, res): Promise<void> => {
  const parsed = IdentifyPlantBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const model = getGeminiModel("gemini-2.5-flash");
    const result = await model.generateContent([
      {
        inlineData: {
          data: parsed.data.imageBase64,
          mimeType: parsed.data.mimeType,
        },
      },
      IDENTIFY_PROMPT,
    ]);

    const text = result.response.text().trim();
    // Strip markdown code blocks if present
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const json = JSON.parse(cleaned);
    res.json(json);
  } catch (err: unknown) {
    req.log.error({ err }, "Plant identification failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.json({
      species: null,
      commonName: null,
      family: null,
      confidence: null,
      description: null,
      wateringRequirements: null,
      growingConditions: null,
      fertilizers: null,
      careRecommendations: null,
      sunlight: null,
      soilType: null,
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
      {
        inlineData: {
          data: parsed.data.imageBase64,
          mimeType: parsed.data.mimeType,
        },
      },
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
      isHealthy: false,
      diseaseName: null,
      confidence: null,
      description: null,
      causes: null,
      symptoms: null,
      treatments: null,
      products: null,
      preventiveMeasures: null,
      urgency: null,
      error: `Analysis failed: ${message}`,
    });
  }
});

export default router;

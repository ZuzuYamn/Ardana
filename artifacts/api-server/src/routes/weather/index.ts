import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { getChatModel } from "../../lib/gemini";
import { db, plantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
router.use(requireAuth);

const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY ?? "";
const OWM_KEY = process.env.OPENWEATHERMAP_API_KEY ?? "";

// ─── Geocode search (WeatherAPI.com) ──────────────────────────────────────────
router.get("/weather/geocode", async (req, res): Promise<void> => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) { res.json([]); return; }
  if (!WEATHERAPI_KEY) { res.status(503).json({ error: "WEATHERAPI_KEY not configured" }); return; }
  try {
    const r = await fetch(
      `http://api.weatherapi.com/v1/search.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(q)}`
    );
    if (!r.ok) { res.json([]); return; }
    const data = (await r.json()) as Array<{
      name: string; region: string; country: string; lat: number; lon: number;
    }>;
    res.json(
      data.map((loc) => ({
        name: loc.name,
        region: loc.region,
        country: loc.country,
        lat: loc.lat,
        lon: loc.lon,
        label: [loc.name, loc.region, loc.country].filter(Boolean).join(", "),
      }))
    );
  } catch {
    res.json([]);
  }
});

// ─── OWM map tile proxy (keeps the API key server-side) ───────────────────────
const VALID_LAYERS = new Set([
  "precipitation_new", "temp_new", "wind_new", "clouds_new", "pressure_new",
]);

router.get(
  "/weather/tiles/:layer/:z/:x/:y",
  async (req, res): Promise<void> => {
    const { layer, z, x, y } = req.params;
    if (!OWM_KEY) { res.status(503).end(); return; }
    if (!VALID_LAYERS.has(layer)) { res.status(400).end(); return; }
    // Strip .png suffix if present
    const yClean = y.replace(/\.png$/, "");
    const tileUrl = `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${yClean}.png?appid=${OWM_KEY}`;
    try {
      const tileRes = await fetch(tileUrl);
      if (!tileRes.ok) { res.status(tileRes.status).end(); return; }
      const buf = await tileRes.arrayBuffer();
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=600");
      res.send(Buffer.from(buf));
    } catch {
      res.status(502).end();
    }
  }
);

// ─── Main weather data endpoint (WeatherAPI.com) ──────────────────────────────
const GetWeatherQueryParams = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  locationName: z.coerce.string().optional(),
});

router.get("/weather", async (req, res): Promise<void> => {
  const params = GetWeatherQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const { lat, lon, locationName } = params.data;

  if (!WEATHERAPI_KEY) {
    res.status(503).json({ error: "WEATHERAPI_KEY is not configured. Please add it to your environment secrets." });
    return;
  }

  let data: any;
  try {
    const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=7&aqi=yes&alerts=yes`;
    const r = await fetch(url);
    if (!r.ok) {
      const errBody = await r.text();
      req.log.warn({ status: r.status, body: errBody }, "WeatherAPI error");
      res.status(502).json({ error: "Weather service unavailable" });
      return;
    }
    data = await r.json();
  } catch (err) {
    req.log.error({ err }, "Weather fetch failed");
    res.status(502).json({ error: "Weather service unavailable" });
    return;
  }

  const cur = data.current;
  const loc = data.location;

  const current = {
    temperature: Math.round(cur.temp_c),
    feelsLike: Math.round(cur.feelslike_c),
    humidity: cur.humidity,
    windSpeed: Math.round(cur.wind_kph),
    windDir: cur.wind_dir as string,
    windDegree: cur.wind_degree as number,
    windGust: Math.round(cur.gust_kph),
    weatherCode: cur.condition.code as number,
    weatherDescription: cur.condition.text as string,
    weatherIcon: `https:${cur.condition.icon}`,
    isDay: cur.is_day === 1,
    precipitation: cur.precip_mm as number,
    pressure: cur.pressure_mb as number,
    visibility: cur.vis_km as number,
    cloudCover: cur.cloud as number,
    uvIndex: cur.uv as number,
    airQualityIndex: (cur.air_quality?.["us-epa-index"] as number) ?? 0,
  };

  const mapHour = (h: any) => ({
    time: h.time as string,
    temperature: Math.round(h.temp_c),
    feelsLike: Math.round(h.feelslike_c),
    precipitation: h.precip_mm as number,
    chanceOfRain: h.chance_of_rain as number,
    weatherCode: h.condition.code as number,
    weatherDescription: h.condition.text as string,
    humidity: h.humidity as number,
    windSpeed: Math.round(h.wind_kph),
    windDir: h.wind_dir as string,
    uvIndex: h.uv as number,
    cloudCover: h.cloud as number,
  });

  const daily = (data.forecast.forecastday as any[]).map((day) => ({
    date: day.date as string,
    maxTemp: Math.round(day.day.maxtemp_c),
    minTemp: Math.round(day.day.mintemp_c),
    avgHumidity: day.day.avghumidity as number,
    precipitation: day.day.totalprecip_mm as number,
    chanceOfRain: day.day.daily_chance_of_rain as number,
    maxWindSpeed: Math.round(day.day.maxwind_kph),
    weatherCode: day.day.condition.code as number,
    weatherDescription: day.day.condition.text as string,
    weatherIcon: `https:${day.day.condition.icon}`,
    sunrise: day.astro.sunrise as string,
    sunset: day.astro.sunset as string,
    moonPhase: day.astro.moon_phase as string,
    uvIndex: day.day.uv as number,
    hourly: (day.hour as any[]).map(mapHour),
  }));

  // Next 24 hours from now
  const nowStr = new Date().toISOString().slice(0, 13);
  const todayHours = daily[0].hourly.filter((h: any) => h.time.slice(0, 13) >= nowStr);
  const nextDayHours = daily[1]?.hourly ?? [];
  const hourly = [...todayHours, ...nextDayHours].slice(0, 24);

  res.json({
    locationName: locationName ?? [loc.name, loc.country].filter(Boolean).join(", "),
    lat: loc.lat as number,
    lon: loc.lon as number,
    timezone: loc.tz_id as string,
    current,
    hourly,
    daily,
    recommendation: buildRecommendation(current),
    aiAlerts: [],
  });
});

// ─── AI Smart Alerts ───────────────────────────────────────────────────────────
const AiAlertsBody = z.object({
  weatherContext: z.string().max(5000),
  plantIds: z.array(z.number()).max(20).optional(),
});

router.post("/weather/ai-alerts", async (req, res): Promise<void> => {
  const parsed = AiAlertsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  let plants;
  try {
    plants = await db.select().from(plantsTable).where(eq(plantsTable.userId, userId));
  } catch {
    plants = [];
  }

  const targets = parsed.data.plantIds?.length
    ? plants.filter((p) => parsed.data.plantIds!.includes(p.id))
    : plants.slice(0, 8);

  if (!targets.length) { res.json({ alerts: [] }); return; }

  const plantSummary = targets
    .map(
      (p) =>
        `• ${p.name} (${p.species ?? p.type}): health=${p.healthStatus}, ` +
        `last watered=${p.lastWateredDate ?? "unknown"}, ` +
        `watering every ${p.wateringIntervalDays ?? "?"}d, ` +
        `last fertilized=${p.lastFertilizedDate ?? "unknown"}, ` +
        `location=${p.location ?? "field"}`
    )
    .join("\n");

  try {
    const model = getChatModel();
    const prompt = `You are an expert farming AI assistant. Analyze the weather and generate smart care alerts.

WEATHER DATA:
${parsed.data.weatherContext}

USER'S PLANTS:
${plantSummary}

Generate the 5 MOST IMPORTANT alerts as a JSON array. Each object:
{
  "type": "watering" | "fertilizing" | "pruning" | "spraying" | "harvesting" | "protection" | "general",
  "severity": "info" | "warning" | "critical",
  "title": "concise action title (max 8 words)",
  "message": "specific, actionable advice mentioning plant name and timing (1-2 sentences)",
  "plantName": "plant name or null for general advice"
}

Rules:
- Skip watering if rain >5mm expected in 24h
- Heat stress alert if forecast >35°C
- Frost warning if forecast <3°C
- Fungal risk if humidity >80% + temp >22°C for multiple days
- No spraying if wind >20 kph
- Best fertilizing is 1-2 days before light rain
- UV >8: advise avoiding midday field work

Return ONLY the JSON array. No markdown. No extra text.`;

    const result = await model.generateContent(prompt);
    const raw = result.response
      .text()
      .trim()
      .replace(/^```json?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
    let alerts: unknown[] = [];
    try { alerts = JSON.parse(raw); } catch { /* graceful */ }
    res.json({ alerts });
  } catch (err) {
    req.log.error({ err }, "AI weather alerts failed");
    res.json({ alerts: [] });
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildRecommendation(cur: {
  temperature: number; humidity: number; precipitation: number;
  uvIndex: number; windSpeed: number;
}): string {
  const tips: string[] = [];
  if (cur.precipitation > 5) {
    tips.push("Rainfall is sufficient — skip watering today.");
  } else if (cur.temperature > 35) {
    tips.push("Extreme heat — water at dawn or dusk to minimise evaporation.");
  } else if (cur.humidity < 30) {
    tips.push("Low humidity — increase watering and consider misting delicate plants.");
  } else {
    tips.push("Conditions are good for general garden maintenance.");
  }
  if (cur.uvIndex >= 8) tips.push("Very high UV — avoid outdoor work between 10 am–4 pm.");
  if (cur.windSpeed > 30) tips.push("Strong winds — postpone spraying and secure tall plants.");
  if (cur.temperature < 5) tips.push("Near-freezing — protect frost-sensitive plants.");
  return tips.join(" ");
}

export default router;

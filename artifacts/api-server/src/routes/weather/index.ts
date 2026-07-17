import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth";
import { sendChatCompletion } from "../../lib/gemini";
import { db, plantsTable, remindersTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";

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

    const raw = (await sendChatCompletion([{ role: "user", content: prompt }]))
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

// ─── Smart Alerts for Reminders ───────────────────────────────────────────────
// Takes lat/lon, fetches weather internally, then uses the user's plants +
// pending reminders to generate weather-adjusted scheduling recommendations.
const SmartAlertsBody = z.object({
  lat: z.number(),
  lon: z.number(),
  locationName: z.string().optional(),
});

router.post("/weather/smart-alerts", async (req, res): Promise<void> => {
  const parsed = SmartAlertsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = req.session.userId!;
  if (!WEATHERAPI_KEY) { res.status(503).json({ error: "WEATHERAPI_KEY not configured" }); return; }

  // 1. Fetch weather
  let weatherData: any;
  try {
    const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${parsed.data.lat},${parsed.data.lon}&days=7&aqi=no&alerts=no`;
    const r = await fetch(url);
    if (!r.ok) { res.status(502).json({ error: "Weather service unavailable" }); return; }
    weatherData = await r.json();
  } catch {
    res.status(502).json({ error: "Weather fetch failed" }); return;
  }

  // 2. Get user's plants and their upcoming pending reminders
  const today = new Date().toISOString().split("T")[0];
  const tenDaysLater = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const plants = await db.select().from(plantsTable).where(eq(plantsTable.userId, userId));
  if (!plants.length) { res.json({ alerts: [] }); return; }

  const upcomingReminders = await db
    .select({
      id: remindersTable.id,
      plantId: remindersTable.plantId,
      type: remindersTable.type,
      scheduledDate: remindersTable.scheduledDate,
      notes: remindersTable.notes,
    })
    .from(remindersTable)
    .innerJoin(plantsTable, and(eq(remindersTable.plantId, plantsTable.id), eq(plantsTable.userId, userId)))
    .where(and(eq(remindersTable.completed, false), gte(remindersTable.scheduledDate, today)));

  // 3. Build context strings
  const loc = weatherData.location;
  const locationName = parsed.data.locationName ?? `${loc.name}, ${loc.country}`;

  const daily = (weatherData.forecast.forecastday as any[]).map((d: any) => ({
    date: d.date as string,
    maxTemp: Math.round(d.day.maxtemp_c),
    minTemp: Math.round(d.day.mintemp_c),
    precipitation: d.day.totalprecip_mm as number,
    chanceOfRain: d.day.daily_chance_of_rain as number,
    humidity: d.day.avghumidity as number,
    windSpeed: Math.round(d.day.maxwind_kph),
    description: d.day.condition.text as string,
  }));

  const weatherContext = [
    `Location: ${locationName}`,
    `Today (${today}): ${weatherData.current.condition.text}, ${Math.round(weatherData.current.temp_c)}°C, humidity ${weatherData.current.humidity}%, rain ${weatherData.current.precip_mm}mm`,
    "",
    "7-Day forecast:",
    ...daily.map((d) =>
      `  ${d.date}: ${d.description}, max ${d.maxTemp}°C / min ${d.minTemp}°C, rain ${d.precipitation}mm (${d.chanceOfRain}% chance), wind ${d.windSpeed} km/h, humidity ${d.humidity}%`
    ),
  ].join("\n");

  const plantContext = plants
    .slice(0, 10)
    .map((p) => {
      const plantReminders = upcomingReminders
        .filter((r) => r.plantId === p.id)
        .filter((r) => r.scheduledDate <= tenDaysLater)
        .map((r) => `    - ${r.type} on ${r.scheduledDate}`)
        .join("\n");
      return (
        `• ${p.name} (${p.species ?? p.type}): health=${p.healthStatus}, ` +
        `last watered=${p.lastWateredDate ?? "never"}, watering every ${p.wateringIntervalDays ?? 3}d, ` +
        `last fertilized=${p.lastFertilizedDate ?? "never"}, fertilizing every ${p.fertilizingIntervalDays ?? 20}d, ` +
        `location=${p.location ?? "unspecified"}` +
        (plantReminders ? `\n  Upcoming reminders:\n${plantReminders}` : "\n  No upcoming reminders")
      );
    })
    .join("\n\n");

  // 4. Call AI
  try {
    const prompt = `You are a smart plant care assistant. Analyze the weather forecast and the user's plant schedules to generate intelligent, weather-adjusted care recommendations.

WEATHER DATA:
${weatherContext}

USER'S PLANTS AND UPCOMING REMINDERS:
${plantContext}

TODAY: ${today}

Generate up to 6 smart, actionable alerts as a JSON array. Each alert must be specific to a plant and its upcoming reminders. Focus on:
- SKIP or POSTPONE watering if significant rain (>5mm) is expected within 1-2 days of a scheduled watering
- ADVANCE watering if hot/dry weather (temp >32°C, humidity <30%, no rain) means the plant needs water sooner
- FLAG heat stress risk for plants in full sun when temperature >35°C
- SUGGEST optimal fertilizing timing (1-2 days before light rain is ideal)
- WARN about frost (<3°C) for sensitive plants
- WARN about fungal risk if humidity >80% and temperature >20°C for multiple days

Each object must have:
{
  "type": "watering" | "fertilizing" | "pruning" | "protection" | "general",
  "severity": "info" | "warning" | "critical",
  "title": "concise title (max 8 words)",
  "message": "specific recommendation mentioning the plant name, exact dates, and concrete action (2-3 sentences)",
  "plantName": "exact plant name from the list",
  "action": "skip" | "postpone" | "advance" | "urgent" | "info",
  "suggestedDate": "YYYY-MM-DD if you're recommending a specific date, otherwise null"
}

Return ONLY a JSON array. No markdown, no code fences, no extra text.`;

    const raw = (await sendChatCompletion([{ role: "user", content: prompt }]))
      .replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();

    let alerts: unknown[] = [];
    try { alerts = JSON.parse(raw); } catch { /* return empty on parse error */ }

    res.json({ alerts, locationName, weatherSummary: daily.slice(0, 3) });
  } catch (err) {
    req.log.error({ err }, "Smart alerts AI failed");
    res.json({ alerts: [], locationName, weatherSummary: [] });
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

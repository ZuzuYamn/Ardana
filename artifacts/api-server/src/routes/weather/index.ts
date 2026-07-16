import { Router, type IRouter } from "express";
import { GetWeatherQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

function weatherCodeToDescription(code: number): string {
  const codes: Record<number, string> = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog", 51: "Light drizzle", 53: "Moderate drizzle",
    55: "Dense drizzle", 61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    85: "Slight snow showers", 86: "Heavy snow showers", 95: "Thunderstorm",
    96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
  };
  return codes[code] ?? "Unknown";
}

function generateCareRecommendation(temp: number, humidity: number, precipitation: number, weatherCode: number): string {
  const tips: string[] = [];
  if (precipitation > 5) tips.push("Skip watering today — rainfall is sufficient for most plants.");
  else if (temp > 35) tips.push("Water plants early morning or late evening to reduce evaporation.");
  else if (humidity < 30) tips.push("Low humidity — increase watering frequency and consider misting delicate plants.");
  else tips.push("Good conditions for garden maintenance and care activities.");
  if (temp > 30) tips.push("Protect sensitive plants from intense heat with shade cloth.");
  if (weatherCode >= 61 && weatherCode <= 67) tips.push("Rainy conditions — good time to apply liquid fertilizers and check drainage.");
  if (weatherCode >= 95) tips.push("Storm expected — secure tall plants and move potted plants to shelter.");
  if (temp < 5) tips.push("Cold temperatures — protect frost-sensitive plants and reduce watering.");
  return tips.join(" ");
}

router.get("/weather", async (req, res): Promise<void> => {
  const params = GetWeatherQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { lat, lon, locationName } = params.data;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m");
  url.searchParams.set("hourly", "temperature_2m,precipitation,weather_code,relative_humidity_2m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");

  const response = await fetch(url.toString());
  if (!response.ok) {
    res.status(502).json({ error: "Weather service unavailable" });
    return;
  }

  const data = (await response.json()) as any;
  const current = data.current;
  const nowHour = new Date().toISOString().slice(0, 13);
  const hourlyStart = data.hourly.time.findIndex((t: string) => t >= nowHour);
  const hourlySlice = {
    time: data.hourly.time.slice(hourlyStart, hourlyStart + 24),
    temperature_2m: data.hourly.temperature_2m.slice(hourlyStart, hourlyStart + 24),
    precipitation: data.hourly.precipitation.slice(hourlyStart, hourlyStart + 24),
    weather_code: data.hourly.weather_code.slice(hourlyStart, hourlyStart + 24),
    relative_humidity_2m: data.hourly.relative_humidity_2m.slice(hourlyStart, hourlyStart + 24),
  };

  res.json({
    locationName: locationName ?? `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    current: {
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      humidity: current.relative_humidity_2m,
      windSpeed: current.wind_speed_10m,
      weatherCode: current.weather_code,
      weatherDescription: weatherCodeToDescription(current.weather_code),
      isDay: current.is_day === 1,
      precipitation: current.precipitation,
    },
    hourly: hourlySlice.time.map((t: string, i: number) => ({
      time: t,
      temperature: hourlySlice.temperature_2m[i],
      precipitation: hourlySlice.precipitation[i],
      weatherCode: hourlySlice.weather_code[i],
      humidity: hourlySlice.relative_humidity_2m[i],
    })),
    daily: data.daily.time.map((date: string, i: number) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[i],
      minTemp: data.daily.temperature_2m_min[i],
      precipitation: data.daily.precipitation_sum[i],
      weatherCode: data.daily.weather_code[i],
      weatherDescription: weatherCodeToDescription(data.daily.weather_code[i]),
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
    })),
    recommendation: generateCareRecommendation(current.temperature_2m, current.relative_humidity_2m, current.precipitation, current.weather_code),
  });
});

export default router;

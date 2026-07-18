import { logger } from "./logger";

const WEATHERAPI_KEY = process.env.WEATHERAPI_KEY ?? "";

export interface WeatherForecast {
  locationName: string;
  lat: number;
  lon: number;
  current: {
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    windDir: string;
    weatherDescription: string;
    precipitation: number;
    uvIndex: number;
  };
  daily: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    avgHumidity: number;
    precipitation: number;
    chanceOfRain: number;
    weatherDescription: string;
    uvIndex: number;
  }>;
}

export interface GeocodeResult {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  label: string;
}

export async function geocodeLocation(query: string): Promise<GeocodeResult | null> {
  if (!WEATHERAPI_KEY) return null;
  try {
    const r = await fetch(
      `http://api.weatherapi.com/v1/search.json?key=${WEATHERAPI_KEY}&q=${encodeURIComponent(query)}`
    );
    if (!r.ok) return null;
    const data = (await r.json()) as Array<{
      name: string; region: string; country: string; lat: number; lon: number;
    }>;
    if (!data.length) return null;
    const loc = data[0];
    return {
      name: loc.name,
      region: loc.region,
      country: loc.country,
      lat: loc.lat,
      lon: loc.lon,
      label: [loc.name, loc.region, loc.country].filter(Boolean).join(", "),
    };
  } catch (err) {
    logger.warn({ err }, "Geocoding failed");
    return null;
  }
}

export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherForecast | null> {
  if (!WEATHERAPI_KEY) return null;
  try {
    const url = `http://api.weatherapi.com/v1/forecast.json?key=${WEATHERAPI_KEY}&q=${lat},${lon}&days=7&aqi=no&alerts=no`;
    const r = await fetch(url);
    if (!r.ok) {
      logger.warn({ status: r.status }, "WeatherAPI forecast request failed");
      return null;
    }
    const data = await r.json();
    const cur = data.current;
    const loc = data.location;
    const daily = (data.forecast?.forecastday ?? []).map((day: any) => ({
      date: day.date as string,
      maxTemp: Math.round(day.day.maxtemp_c),
      minTemp: Math.round(day.day.mintemp_c),
      avgHumidity: day.day.avghumidity as number,
      precipitation: day.day.totalprecip_mm as number,
      chanceOfRain: day.day.daily_chance_of_rain as number,
      weatherDescription: day.day.condition.text as string,
      uvIndex: day.day.uv as number,
    }));
    return {
      locationName: [loc.name, loc.country].filter(Boolean).join(", "),
      lat: loc.lat,
      lon: loc.lon,
      current: {
        temperature: Math.round(cur.temp_c),
        feelsLike: Math.round(cur.feelslike_c),
        humidity: cur.humidity,
        windSpeed: Math.round(cur.wind_kph),
        windDir: cur.wind_dir,
        weatherDescription: cur.condition.text,
        precipitation: cur.precip_mm,
        uvIndex: cur.uv,
      },
      daily,
    };
  } catch (err) {
    logger.warn({ err }, "Weather forecast fetch failed");
    return null;
  }
}

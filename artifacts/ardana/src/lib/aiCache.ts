/**
 * Production-ready localStorage cache for AI features.
 *
 * Rules of thumb:
 * - All values are JSON, prefixed with a version key so schema changes can invalidate old entries.
 * - Every entry has an explicit TTL and a touchedAt timestamp so inactive sessions expire.
 * - Any write updates touchedAt, keeping active sessions alive.
 * - Reads are synchronous and cheap; the cache is designed to make the UI feel instant.
 */

const CACHE_VERSION = 1;
const PREFIX = "ardana";

export interface CacheEntry<T> {
  v: number;
  data: T;
  touchedAt: number; // epoch ms of last read/write
  ttlMs: number;
}

function storageKey(key: string) {
  return `${PREFIX}_${key}`;
}

export function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (entry.v !== CACHE_VERSION) return null;
    if (Date.now() - entry.touchedAt > entry.ttlMs) {
      localStorage.removeItem(storageKey(key));
      return null;
    }
    // Touch on read so an actively used session stays alive.
    entry.touchedAt = Date.now();
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMs: number) {
  try {
    const entry: CacheEntry<T> = {
      v: CACHE_VERSION,
      data,
      touchedAt: Date.now(),
      ttlMs,
    };
    localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // localStorage is full or unavailable — degrade gracefully.
  }
}

export function removeCache(key: string) {
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

export function isCacheValid(key: string): boolean {
  return getCache<unknown>(key) !== null;
}

// ─── Weather fingerprint ─────────────────────────────────────────────────────

export interface WeatherFingerprintData {
  locationName: string;
  lat: number;
  lon: number;
  current: {
    temperature: number;
    weatherCode: number;
    precipitation: number;
    windSpeed: number;
    humidity: number;
    uvIndex: number;
  };
  daily: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    precipitation: number;
    chanceOfRain: number;
    weatherCode: number;
  }>;
}

/**
 * Build a stable fingerprint of the weather data that matters for smart alerts.
 * We intentionally round values so tiny fluctuations don't thrash the cache,
 * but meaningful changes (temperature swings, rain, wind, conditions) invalidate it.
 */
export function buildWeatherFingerprint(weather: WeatherFingerprintData): string {
  const current = [
    weather.locationName,
    Math.round(weather.current.temperature),
    weather.current.weatherCode,
    Math.round(weather.current.precipitation),
    Math.round(weather.current.windSpeed),
    Math.round(weather.current.humidity / 5) * 5, // 5% buckets
    Math.round(weather.current.uvIndex),
  ].join("|");

  const daily = weather.daily
    .slice(0, 3)
    .map(
      (d) =>
        `${d.date}:${Math.round(d.maxTemp)}/${Math.round(d.minTemp)}:` +
        `${Math.round(d.precipitation)}:${Math.round(d.chanceOfRain / 10) * 10}:` +
        `${d.weatherCode}`,
    )
    .join("|");

  return `${current}|${daily}`;
}

/**
 * Decide whether new weather data is meaningfully different from the cached one.
 * Returns true when the fingerprint changes (significant conditions changed),
 * or when the TTL has expired. The caller also checks explicit manual refresh.
 */
export function weatherChanged(
  weather: WeatherFingerprintData,
  cachedFingerprint: string,
): boolean {
  return buildWeatherFingerprint(weather) !== cachedFingerprint;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const CHAT_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const WEATHER_ALERTS_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
export const CHAT_SESSION_KEY = "ai_chat_session";
export const WEATHER_ALERTS_KEY = "weather_alerts_cache";

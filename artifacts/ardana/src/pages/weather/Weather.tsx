import React, { useState, useEffect, useCallback, useRef } from "react";
import { useGetWeather } from "@workspace/api-client-react";
import type { WeatherData, WeatherAlert, WeatherHourly } from "@workspace/api-client-react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  Cloud, CloudRain, Sun, Wind, Droplets, MapPin, Search, Locate, RefreshCw,
  Thermometer, Eye, Gauge, Leaf, CloudSun, Star, StarOff,
  ChevronDown, ChevronUp, AlertTriangle, Info, Bell,
  Zap, Sprout, Scissors, FlaskConical, Wheat, Shield,
  Sunrise, Sunset, Moon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  getCache,
  setCache,
  removeCache,
  buildWeatherFingerprint,
  weatherChanged,
  WEATHER_ALERTS_KEY,
  WEATHER_ALERTS_TTL_MS,
  type WeatherFingerprintData,
} from "@/lib/aiCache";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area, AreaChart, Bar, BarChart, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";

// ─── Fix Leaflet default icon paths for Vite ────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIconUrl,
  shadowUrl: markerShadow,
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface GeoLocation {
  name: string; region: string; country: string;
  lat: number; lon: number; label: string;
}
type ChartMetric = "temperature" | "precipitation" | "humidity" | "windSpeed" | "uvIndex";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const API_BASE = (import.meta.env.BASE_URL as string).replace(/\/$/, "");

function formatHour(timeStr: string) {
  const d = new Date(timeStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDay(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function uvLabel(uv: number) {
  if (uv <= 2) return { label: "weather.metric_uv_low", color: "text-green-600" };
  if (uv <= 5) return { label: "weather.metric_uv_moderate", color: "text-yellow-600" };
  if (uv <= 7) return { label: "weather.metric_uv_high", color: "text-orange-500" };
  if (uv <= 10) return { label: "weather.metric_uv_very_high", color: "text-red-500" };
  return { label: "weather.metric_uv_extreme", color: "text-purple-600" };
}

function aqiLabel(aqi: number) {
  const labels = ["weather.metric_aqi_none", "weather.metric_aqi_good", "weather.metric_aqi_moderate", "weather.metric_aqi_unhealthy_star", "weather.metric_aqi_unhealthy", "weather.metric_aqi_very_unhealthy", "weather.metric_aqi_hazardous"];
  const colors = ["text-gray-400", "text-green-600", "text-yellow-600", "text-orange-500", "text-red-500", "text-red-700", "text-purple-700"];
  const i = Math.min(Math.max(aqi, 0), 6);
  return { label: labels[i] ?? "—", color: colors[i] ?? "text-gray-400" };
}

function windDirArrow(dir: string) {
  const map: Record<string, string> = {
    N: "↑", NNE: "↗", NE: "↗", ENE: "→", E: "→", ESE: "→",
    SE: "↘", SSE: "↘", S: "↓", SSW: "↙", SW: "↙", WSW: "←",
    W: "←", WNW: "←", NW: "↖", NNW: "↖",
  };
  return map[dir] ?? "→";
}

function buildWeatherContext(weather: WeatherData, t: (key: string) => string): string {
  const c = weather.current;
  const lines = [
    `${t("weather.label_location")}: ${weather.locationName}`,
    `${t("weather.label_current")}: ${c.temperature}°C, ${c.weatherDescription}, ${t("weather.label_humidity")} ${c.humidity}%, ` +
      `${t("weather.label_wind")} ${c.windSpeed} km/h ${c.windDir}, ${t("weather.metric_uv_short")} ${c.uvIndex}, ${t("weather.label_precip_short")} ${c.precipitation}mm`,
    `${t("weather.label_pressure")}: ${c.pressure}mb, ${t("weather.label_visibility")}: ${c.visibility}km`,
    `${t("weather.label_air_quality_index")}: ${c.airQualityIndex} (${t("weather.label_us_epa")})`,
    "",
    `${t("weather.label_7_day_forecast")}:`,
    ...weather.daily.map(
      (d) =>
        `  ${d.date}: ${d.weatherDescription}, ${t("weather.metric_temperature")} ${d.maxTemp}°C / ${d.minTemp}°C, ` +
        `${t("weather.label_precip_short")} ${d.precipitation}mm (${d.chanceOfRain}% ${t("weather.label_chance_of_rain")}), ${t("weather.label_wind")} ${d.maxWindSpeed} km/h, ${t("weather.metric_uv_short")} ${d.uvIndex}`
    ),
  ];
  return lines.join("\n");
}

function alertIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    watering: <Droplets className="w-5 h-5" />,
    fertilizing: <FlaskConical className="w-5 h-5" />,
    pruning: <Scissors className="w-5 h-5" />,
    spraying: <Zap className="w-5 h-5" />,
    harvesting: <Wheat className="w-5 h-5" />,
    protection: <Shield className="w-5 h-5" />,
    general: <Leaf className="w-5 h-5" />,
  };
  return icons[type] ?? <Bell className="w-5 h-5" />;
}

const severityStyles: Record<string, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
};
const severityIconColor: Record<string, string> = {
  info: "text-blue-500 bg-blue-100",
  warning: "text-amber-500 bg-amber-100",
  critical: "text-red-500 bg-red-100",
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ChangeMapView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

function MetricCard({
  icon, label, value, sub, iconBg,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; iconBg?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col items-center justify-center text-center gap-2.5 p-4 h-36">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg ?? "bg-primary/10"}`}>
        {icon}
      </div>
      <div className="w-full flex flex-col items-center gap-0.5 min-w-0 overflow-hidden">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest w-full truncate leading-none">{label}</p>
        <p className="text-sm font-semibold text-foreground leading-snug w-full truncate mt-0.5">{value}</p>
        {sub
          ? <p className="text-[10px] text-muted-foreground w-full truncate leading-none">{sub}</p>
          : <p className="text-[10px] text-transparent select-none leading-none">—</p>
        }
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Weather() {
  const { t, language, isRTL } = useLanguage();
  const { toast } = useToast();

  // Location state
  const [coords, setCoords] = useState({ lat: 33.89, lon: 35.5, name: "Beirut, Lebanon" });
  const [savedLocations, setSavedLocations] = useState<GeoLocation[]>(() => {
    try { return JSON.parse(localStorage.getItem("ardana_saved_locations") ?? "[]"); } catch { return []; }
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeoLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [chartMetric, setChartMetric] = useState<ChartMetric>("temperature");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [aiAlerts, setAiAlerts] = useState<WeatherAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsCachedAt, setAlertsCachedAt] = useState<number | null>(null);

  // Weather data
  const { data: weather, isLoading } = useGetWeather({
    lat: coords.lat,
    lon: coords.lon,
    locationName: coords.name,
    language,
  });

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Geocode search (debounced)
  const handleSearchInput = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (q.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const r = await fetch(`/api/weather/geocode?q=${encodeURIComponent(q)}`);
        const data: GeoLocation[] = await r.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 380);
  }, []);

  // Select a location from dropdown
  const handleSelectLocation = useCallback((loc: GeoLocation) => {
    setCoords({ lat: loc.lat, lon: loc.lon, name: loc.label });
    setSearchQuery("");
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedDay(null);
    setAiAlerts([]);
  }, []);

  // Save / unsave location
  const toggleSaved = useCallback((loc: GeoLocation) => {
    setSavedLocations((prev) => {
      const exists = prev.some((l) => l.lat === loc.lat && l.lon === loc.lon);
      const updated = exists
        ? prev.filter((l) => !(l.lat === loc.lat && l.lon === loc.lon))
        : [...prev, loc].slice(-6);
      localStorage.setItem("ardana_saved_locations", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const currentIsSaved = savedLocations.some(
    (l) => Math.abs(l.lat - coords.lat) < 0.01 && Math.abs(l.lon - coords.lon) < 0.01
  );

  // Use browser geolocation to detect current position and add it as a saved location
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast({
        title: t("weather.location_unavailable"),
        description: t("weather.location_error"),
        variant: "destructive",
      });
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const r = await fetch(`/api/weather/geocode?q=${latitude},${longitude}`);
          if (!r.ok) throw new Error(t("weather.reverse_geocode_failed"));
          const data: GeoLocation[] = await r.json();
          if (data.length === 0) {
            toast({
              title: t("weather.location_unavailable"),
              description: t("weather.location_error"),
              variant: "destructive",
            });
            return;
          }
          const loc = data[0];
          handleSelectLocation(loc);
          toggleSaved(loc);
          toast({
            title: t("weather.location_saved"),
            description: t("weather.location_detected"),
          });
        } catch {
          toast({
            title: t("weather.location_unavailable"),
            description: t("weather.location_error"),
            variant: "destructive",
          });
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        let description = t("weather.location_error");
        if (error.code === error.PERMISSION_DENIED) {
          description = t("weather.location_permission_denied");
        } else if (error.code === error.TIMEOUT) {
          description = t("weather.location_timeout");
        }
        toast({
          title: t("weather.location_unavailable"),
          description,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }, [handleSelectLocation, toggleSaved, t, toast]);

  // Load cached alerts immediately, then fetch only when weather changed or cache expired.
  const loadAiAlerts = useCallback(
    async (forceRefresh = false) => {
      if (!weather) return;

      const fingerprint = buildWeatherFingerprint(weather as WeatherFingerprintData);
      const cached = getCache<{
        fingerprint: string;
        alerts: WeatherAlert[];
        cachedAt: number;
      }>(WEATHER_ALERTS_KEY);

      const isCacheFresh =
        cached &&
        !forceRefresh &&
        Date.now() - cached.cachedAt < WEATHER_ALERTS_TTL_MS &&
        !weatherChanged(weather as WeatherFingerprintData, cached.fingerprint);

      if (isCacheFresh) {
        setAiAlerts(cached.alerts);
        setAlertsCachedAt(cached.cachedAt);
        setAlertsLoading(false);
        return;
      }

      setAlertsLoading(true);
      const weatherContext = buildWeatherContext(weather, t);
      try {
        const r = await fetch(`${API_BASE}/api/weather/ai-alerts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ weatherContext, language }),
        });
        const data = await r.json();
        const alerts = (data.alerts ?? []) as WeatherAlert[];
        setAiAlerts(alerts);
        setAlertsCachedAt(Date.now());
        setCache(
          WEATHER_ALERTS_KEY,
          { fingerprint, alerts, cachedAt: Date.now() },
          WEATHER_ALERTS_TTL_MS,
        );
      } catch {
        setAiAlerts([]);
        setAlertsCachedAt(null);
      } finally {
        setAlertsLoading(false);
      }
    },
    [weather],
  );

  const handleRefreshAlerts = useCallback(() => {
    removeCache(WEATHER_ALERTS_KEY);
    loadAiAlerts(true);
  }, [loadAiAlerts]);

  useEffect(() => {
    loadAiAlerts(false);
  }, [weather?.locationName, weather?.current?.temperature, loadAiAlerts]);

  // Chart data for the 24h hourly
  const chartData = (weather?.hourly ?? []).map((h) => ({
    time: formatHour(h.time),
    temperature: h.temperature,
    precipitation: h.precipitation,
    humidity: h.humidity,
    windSpeed: h.windSpeed,
    uvIndex: h.uvIndex,
    chanceOfRain: h.chanceOfRain,
  }));

  const chartConfig: Record<ChartMetric, { key: string; label: string; unit: string; color: string; type: "area" | "bar" }> = {
    temperature: { key: "temperature", label: "weather.metric_temperature", unit: "°C", color: "hsl(var(--primary))", type: "area" },
    precipitation: { key: "precipitation", label: "weather.metric_precipitation", unit: "mm", color: "#3b82f6", type: "bar" },
    humidity: { key: "humidity", label: "weather.metric_humidity", unit: "%", color: "#06b6d4", type: "area" },
    windSpeed: { key: "windSpeed", label: "weather.metric_wind_speed", unit: "km/h", color: "#8b5cf6", type: "area" },
    uvIndex: { key: "uvIndex", label: "weather.metric_uv_index", unit: "", color: "#f59e0b", type: "bar" },
  };
  const cc = chartConfig[chartMetric];

  const mapCenter: [number, number] = [coords.lat, coords.lon];

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            <CloudSun className="w-8 h-8 text-primary" />
            {t("weather.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("weather.subtitle")}
          </p>
        </div>

        {/* Location search */}
        <div ref={searchRef} className="relative z-[100]">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              )}
              <Input
                placeholder={t("weather.search_placeholder")}
                className="pl-9 pr-8 w-[220px]"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              />
            </div>
            <Button
              variant="outline"
              size="icon"
               title={currentIsSaved ? t("weather.saved_remove") : t("weather.saved_add")}
              onClick={() => {
                const loc: GeoLocation = {
                  name: coords.name.split(",")[0] ?? coords.name,
                  region: "",
                  country: coords.name.split(",").slice(-1)[0]?.trim() ?? "",
                  lat: coords.lat,
                  lon: coords.lon,
                  label: coords.name,
                };
                toggleSaved(loc);
              }}
            >
              {currentIsSaved
                ? <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                : <StarOff className="w-4 h-4" />}
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 w-full justify-start text-muted-foreground hover:text-primary px-0"
            onClick={handleUseCurrentLocation}
            disabled={isDetectingLocation}
          >
            {isDetectingLocation ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin mr-2" />
                {t("weather.use_current_location")}…
              </>
            ) : (
              <>
                <Locate className="w-3.5 h-3.5 mr-2" />
                {t("weather.use_current_location")}
              </>
            )}
          </Button>

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-[200] bg-popover border border-border rounded-xl shadow-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              {searchResults.map((loc, i) => (
                <button
                  key={i}
                  className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-center gap-2 text-sm"
                  onClick={() => handleSelectLocation(loc)}
                >
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{loc.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Saved locations chips ───────────────────────────────────────── */}
      {savedLocations.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedLocations.map((loc, i) => {
            const isActive =
              Math.abs(loc.lat - coords.lat) < 0.01 &&
              Math.abs(loc.lon - coords.lon) < 0.01;
            return (
              <button
                key={i}
                onClick={() => handleSelectLocation(loc)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card border-border hover:border-primary/50 hover:bg-accent"
                }`}
              >
                <MapPin className="w-3 h-3" />
                {loc.name}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Loading skeleton ─────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Skeleton className="lg:col-span-2 h-72 rounded-3xl" />
            <Skeleton className="lg:col-span-3 h-72 rounded-3xl" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : weather ? (
        <div className="space-y-6">

          {/* ── Current + Map ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Current weather hero */}
            <Card className="lg:col-span-2 bg-gradient-to-br from-sidebar to-sidebar-accent text-white border-0 shadow-xl overflow-hidden">
              <CardContent className="p-6 h-full flex flex-col justify-between relative">
                <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
                  <img
                    src={weather.current.weatherIcon}
                    alt=""
                    className="w-40 h-40"
                  />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium text-white/90 truncate">{weather.locationName}</span>
                  </div>
                  <div className="flex items-end gap-3 mb-1">
                    <span className="text-7xl font-serif font-bold tracking-tighter">
                      {weather.current.temperature}°
                    </span>
                    <div className="pb-2">
                      <img src={weather.current.weatherIcon} alt={weather.current.weatherDescription} className="w-12 h-12" />
                    </div>
                  </div>
                  <p className="text-xl font-medium capitalize">{weather.current.weatherDescription}</p>
                  <p className="text-white/70 text-sm">{t('weather.feels_like')} {weather.current.feelsLike}°C</p>
                </div>

                <div className="relative z-10 grid grid-cols-2 gap-3 mt-4 bg-black/20 rounded-2xl p-4 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-accent" />
                    <div>
                       <p className="text-[10px] text-white/60 uppercase tracking-wider">{t("weather.label_humidity")}</p>
                      <p className="font-semibold">{weather.current.humidity}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-accent" />
                    <div>
                       <p className="text-[10px] text-white/60 uppercase tracking-wider">{t("weather.label_wind")}</p>
                      <p className="font-semibold">{weather.current.windSpeed} km/h {windDirArrow(weather.current.windDir)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sunrise className="w-4 h-4 text-accent" />
                    <div>
                       <p className="text-[10px] text-white/60 uppercase tracking-wider">{t("weather.label_sunrise")}</p>
                      <p className="font-semibold">{weather.daily[0]?.sunrise}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sunset className="w-4 h-4 text-accent" />
                    <div>
                       <p className="text-[10px] text-white/60 uppercase tracking-wider">{t("weather.label_sunset")}</p>
                      <p className="font-semibold">{weather.daily[0]?.sunset}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Weather Map */}
            <Card className="lg:col-span-3 overflow-hidden border-border shadow-sm isolate">
              <CardContent className="p-0 h-full min-h-[290px] flex flex-col">
                <div className="flex-1 min-h-[290px]">
                  <MapContainer
                    center={mapCenter}
                    zoom={7}
                    style={{ height: "100%", width: "100%", minHeight: "290px" }}
                    scrollWheelZoom={false}
                    attributionControl={false}
                  >
                    <ChangeMapView center={mapCenter} />
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap"
                    />
                    <Marker position={mapCenter}>
                      <Popup>{weather.locationName}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Detailed metric cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(() => {
              const uv = uvLabel(weather.current.uvIndex);
              const aqi = aqiLabel(weather.current.airQualityIndex);
              return (
                <>
                  <MetricCard
                    icon={<Sun className="w-5 h-5 text-amber-500" />}
                     label={t("weather.metric_uv_index")}
                    value={`${weather.current.uvIndex}`}
                    sub={uv.label}
                    iconBg="bg-amber-50"
                  />
                  <MetricCard
                    icon={<Thermometer className="w-5 h-5 text-red-500" />}
                     label={t("weather.metric_feels_like")}
                    value={`${weather.current.feelsLike}°C`}
                    iconBg="bg-red-50"
                  />
                  <MetricCard
                    icon={<Gauge className="w-5 h-5 text-indigo-500" />}
                     label={t("weather.metric_pressure")}
                    value={`${weather.current.pressure} mb`}
                    iconBg="bg-indigo-50"
                  />
                  <MetricCard
                    icon={<Eye className="w-5 h-5 text-sky-500" />}
                     label={t("weather.metric_visibility")}
                    value={`${weather.current.visibility} km`}
                    iconBg="bg-sky-50"
                  />
                  <MetricCard
                    icon={<Wind className="w-5 h-5 text-purple-500" />}
                     label={t("weather.metric_wind_gust")}
                    value={`${weather.current.windGust} km/h`}
                    sub={`${weather.current.windDir} ${windDirArrow(weather.current.windDir)}`}
                    iconBg="bg-purple-50"
                  />
                  <MetricCard
                    icon={<Cloud className="w-5 h-5 text-slate-500" />}
                     label={t("weather.metric_cloud_cover")}
                    value={`${weather.current.cloudCover}%`}
                    iconBg="bg-slate-50"
                  />
                  <MetricCard
                    icon={<Droplets className="w-5 h-5 text-blue-500" />}
                     label={t("weather.metric_precipitation")}
                    value={`${weather.current.precipitation} mm`}
                    iconBg="bg-blue-50"
                  />
                  <MetricCard
                    icon={<Leaf className="w-5 h-5 text-green-600" />}
                     label={t("weather.metric_air_quality")}
                    value={aqi.label}
                     sub={t("weather.label_us_epa")}
                    iconBg="bg-green-50"
                  />
                </>
              );
            })()}
          </div>

          {/* ── Smart recommendation (rule-based quick tip) ─────────────── */}
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sprout className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base mb-1">{t("weather.quick_advice_title")}</h3>
                <p className="text-foreground/80 leading-relaxed text-sm">{weather.recommendation}</p>
              </div>
            </CardContent>
          </Card>

          {/* ── Hourly chart ───────────────────────────────────────────────── */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
                <h3 className="font-serif font-bold text-lg">{t("weather.forecast_24h_title")}</h3>
                <Tabs
                  value={chartMetric}
                  onValueChange={(v) => setChartMetric(v as ChartMetric)}
                  className="sm:ml-auto"
                >
                  <TabsList className="h-8">
                     <TabsTrigger value="temperature" className="text-xs px-2.5">{t("weather.metric_temperature_short")}</TabsTrigger>
                     <TabsTrigger value="precipitation" className="text-xs px-2.5">{t("weather.metric_rain_short")}</TabsTrigger>
                     <TabsTrigger value="humidity" className="text-xs px-2.5">{t("weather.metric_humidity_short")}</TabsTrigger>
                     <TabsTrigger value="windSpeed" className="text-xs px-2.5">{t("weather.metric_wind_short")}</TabsTrigger>
                     <TabsTrigger value="uvIndex" className="text-xs px-2.5">{t("weather.metric_uv_short")}</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  {cc.type === "bar" ? (
                    <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: number) => [`${v}${cc.unit}`, cc.label]}
                      />
                      <Bar dataKey={cc.key} fill={cc.color} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={cc.color} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={cc.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="time" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: number) => [`${v}${cc.unit}`, cc.label]}
                      />
                      <Area
                        type="monotone"
                        dataKey={cc.key}
                        stroke={cc.color}
                        strokeWidth={2.5}
                        fill="url(#metricGrad)"
                        dot={false}
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* ── 7-Day forecast ─────────────────────────────────────────────── */}
          <div>
            <h3 className="font-serif font-bold text-2xl mb-4">{t("weather.forecast_7d_title")}</h3>
            <div className="space-y-2">
              {weather.daily.map((day, i) => (
                <Card
                  key={i}
                  className={`shadow-sm border-border cursor-pointer transition-all hover:border-primary/40 ${
                    selectedDay === i ? "border-primary/50 bg-primary/5" : ""
                  }`}
                  onClick={() => setSelectedDay(selectedDay === i ? null : i)}
                >
                  <CardContent className="p-4">
                    {/* Day summary row */}
                    <div className="flex items-center gap-3">
                      <div className="w-20 shrink-0">
                        <p className="font-semibold text-sm">
                           {i === 0 ? t("weather.day_today") : i === 1 ? t("weather.day_tomorrow") : formatDay(day.date)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Moon className="w-3 h-3" /> {day.moonPhase}
                        </p>
                      </div>
                      <img src={day.weatherIcon} alt={day.weatherDescription} className="w-9 h-9 shrink-0" />
                      <p className="text-sm text-muted-foreground flex-1 hidden sm:block">{day.weatherDescription}</p>
                      <div className="flex items-center gap-4 ml-auto">
                        <div className="flex items-center gap-1 text-blue-500 text-sm">
                          <Droplets className="w-3.5 h-3.5" />
                          <span>{day.chanceOfRain}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 text-sm">
                          <Sun className="w-3.5 h-3.5" />
                          <span>UV {day.uvIndex}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{day.maxTemp}°</span>
                          <span className="text-muted-foreground">{day.minTemp}°</span>
                        </div>
                        {selectedDay === i
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded hourly detail */}
                    {selectedDay === i && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("weather.label_wind")}: </span>
                            <span className="font-medium">{day.maxWindSpeed} km/h</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("weather.label_humidity")}: </span>
                            <span className="font-medium">{day.avgHumidity}%</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("weather.label_precip_short")}: </span>
                            <span className="font-medium">{day.precipitation} mm</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("weather.label_sunrise")}: </span>
                            <span className="font-medium">{day.sunrise}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("weather.label_sunset")}: </span>
                            <span className="font-medium">{day.sunset}</span>
                          </div>
                          <div className="text-sm">
                            <span className="text-muted-foreground">{t("weather.metric_uv_short")}: </span>
                            <span className={`font-medium ${uvLabel(day.uvIndex).color}`}>
                              {day.uvIndex} — {uvLabel(day.uvIndex).label}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-3">
                           {t("weather.hourly_breakdown")}
                        </p>
                        <div className="overflow-x-auto pb-1">
                          <div className="flex gap-2 min-w-max">
                            {(day.hourly as WeatherHourly[]).map((h, hi) => (
                              <div
                                key={hi}
                                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-muted/50 min-w-[60px] text-center"
                              >
                                <span className="text-xs text-muted-foreground font-medium">
                                  {formatHour(h.time)}
                                </span>
                                <img
                                  src={`https://cdn.weatherapi.com/weather/32x32/${h.time.includes("T") ? "day" : (parseInt(h.time.split(" ")[1]?.split(":")[0] ?? "12") >= 6 && parseInt(h.time.split(" ")[1]?.split(":")[0] ?? "12") < 20 ? "day" : "night")}/113.png`}
                                  alt=""
                                  className="w-6 h-6"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                />
                                <span className="text-sm font-bold">{h.temperature}°</span>
                                <span className="text-xs text-blue-500">{h.chanceOfRain}%</span>
                                <span className="text-xs text-muted-foreground">{h.windSpeed}km</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── AI Smart Alerts ────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
               <h3 className="font-serif font-bold text-2xl">{t("weather.alerts_title")}</h3>
              <Badge variant="secondary" className="gap-1">
                 <Sprout className="w-3 h-3" /> {t("weather.alerts_badge")}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAlerts}
                disabled={alertsLoading}
                className="ml-auto h-8 gap-1.5 text-xs"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${alertsLoading ? "animate-spin" : ""}`}
                />
                {alertsLoading
                  ? t("weather.refreshing_alerts")
                  : t("weather.refresh_alerts")}
              </Button>
            </div>
            {alertsCachedAt && !alertsLoading && (
              <p className="text-xs text-muted-foreground mb-3">
                {t("weather.alerts_cached_at", {
                  time: new Date(alertsCachedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </p>
            )}

            {alertsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-2xl border border-border">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center animate-pulse">
                  {t("weather.alerts_analyzing")}
                </p>
              </div>
            ) : aiAlerts.length > 0 ? (
              <div className="space-y-3">
                {aiAlerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex gap-4 p-4 rounded-2xl border transition-all ${severityStyles[alert.severity] ?? severityStyles.info}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${severityIconColor[alert.severity] ?? severityIconColor.info}`}
                    >
                      {alertIcon(alert.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{alert.title}</h4>
                        {alert.plantName && (
                          <Badge variant="outline" className="text-xs border-current/30">
                            {alert.plantName}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize border-current/30 ${
                            alert.severity === "critical" ? "text-red-700"
                            : alert.severity === "warning" ? "text-amber-700"
                            : "text-blue-700"
                          }`}
                        >
                          {alert.severity === "critical" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed opacity-90">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-muted-foreground/30">
                <CardContent className="p-8 text-center">
                  <Info className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">
                     {weather
                       ? t("weather.alerts_empty_with_weather")
                       : t("weather.alerts_empty_without_weather")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <CloudRain className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
           <p className="text-muted-foreground">{t("weather.error_load_failed")}</p>
        </div>
      )}
    </div>
  );
}

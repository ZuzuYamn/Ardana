import React, { useState } from "react";
import { useGetWeather } from "@workspace/api-client-react";
import {
  Cloud,
  CloudRain,
  Sun,
  Wind,
  Droplets,
  MapPin,
  Search,
  Calendar,
  Sunrise,
  Sunset,
  Leaf,
  CloudSun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useLanguage } from "@/lib/contexts/LanguageContext";

export default function Weather() {
  const { t } = useLanguage();
  const [locationStr, setLocationStr] = useState("Beirut");
  const [coords, setCoords] = useState({
    lat: 33.89,
    lon: 35.5,
    name: "Beirut",
  });

  // In a real app, we'd use a geocoding API to convert string to lat/lon.
  // For the mockup, we just submit the string and let the backend handle it or mock it.
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (locationStr.trim()) {
      // Just update name for now, actual coords would need geocoding
      setCoords({ ...coords, name: locationStr.trim() });
    }
  };

  const { data: weather, isLoading } = useGetWeather({
    lat: coords.lat,
    lon: coords.lon,
    locationName: coords.name,
  });

  const getWeatherIcon = (code: number, className: string) => {
    // Simple mapping based on WMO Weather interpretation codes
    if (code === 0) return <Sun className={className} />; // Clear
    if (code > 0 && code < 4) return <Cloud className={className} />; // Cloudy
    if (code >= 51 && code <= 67) return <CloudRain className={className} />; // Rain
    if (code >= 71 && code <= 77) return <CloudRain className={className} />; // Snow
    return <Sun className={className} />; // Default
  };

  return (
    <div className="space-y-8 pb-12 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight flex items-center gap-3">
            <CloudSun className="w-8 h-8 text-primary" />
            {t("weather.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("weather.subtitle")}</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("weather.search_placeholder")}
              className="pl-9 w-[200px]"
              value={locationStr}
              onChange={(e) => setLocationStr(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            {t("weather.search_btn")}
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="w-full h-[300px] rounded-3xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
        </div>
      ) : weather ? (
        <div className="space-y-8">
          {/* Hero Current Weather */}
          <div className="bg-gradient-to-br from-sidebar to-sidebar-accent text-white rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-12 opacity-20 pointer-events-none">
              {getWeatherIcon(weather.current.weatherCode, "w-64 h-64")}
            </div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-accent" />
                  <span className="text-lg font-medium tracking-wide">
                    {weather.locationName}
                  </span>
                </div>
                <div className="flex items-baseline gap-4">
                  <h2 className="text-7xl md:text-8xl font-serif font-bold tracking-tighter">
                    {weather.current.temperature}°
                  </h2>
                  <div className="pb-2">
                    <p className="text-2xl font-medium capitalize">
                      {weather.current.weatherDescription}
                    </p>
                    <p className="text-white/70">
                      {t("weather.feels_like")} {weather.current.feelsLike}°
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-4 bg-black/20 p-6 rounded-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <Droplets className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider">
                      {t("weather.humidity")}
                    </p>
                    <p className="font-semibold text-lg">
                      {weather.current.humidity}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Wind className="w-5 h-5 text-accent" />
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider">
                      {t("weather.wind")}
                    </p>
                    <p className="font-semibold text-lg">
                      {weather.current.windSpeed} km/h
                    </p>
                  </div>
                </div>
                {weather.daily[0] && (
                  <>
                    <div className="flex items-center gap-3">
                      <Sunrise className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-xs text-white/60 uppercase tracking-wider">
                          {t("weather.sunrise")}
                        </p>
                        <p className="font-semibold text-lg">
                          {weather.daily[0].sunrise}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Sunset className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-xs text-white/60 uppercase tracking-wider">
                          {t("weather.sunset")}
                        </p>
                        <p className="font-semibold text-lg">
                          {weather.daily[0].sunset}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Smart Recommendation */}
          <Card className="border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-6 flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Leaf className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg mb-1 text-foreground">
                  {t("weather.ai_advice")}
                </h3>
                <p className="text-foreground/80 leading-relaxed">
                  {weather.recommendation}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Hourly Chart */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-6">
              <h3 className="font-serif font-bold text-lg mb-6 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                {t("weather.hourly_forecast")}
              </h3>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={weather.hourly.slice(0, 24)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorTemp"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 12,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "var(--shadow-md)",
                      }}
                      labelStyle={{
                        fontWeight: "bold",
                        color: "hsl(var(--foreground))",
                        marginBottom: "4px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorTemp)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* 7-Day Forecast */}
          <div>
            <h3 className="font-serif font-bold text-2xl mb-6">
              {t("weather.forecast_title")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              {weather.daily.map((day, i) => (
                <Card
                  key={i}
                  className="text-center shadow-sm border-border hover-elevate transition-all"
                >
                  <CardContent className="p-4 flex flex-col items-center">
                    <p className="font-medium text-foreground mb-3">
                      {i === 0 ? t("weather.today") : day.date}
                    </p>
                    {getWeatherIcon(
                      day.weatherCode,
                      "w-8 h-8 text-primary mb-3",
                    )}
                    <div className="flex gap-3 text-sm">
                      <span className="font-bold text-foreground">
                        {day.maxTemp}°
                      </span>
                      <span className="text-muted-foreground">
                        {day.minTemp}°
                      </span>
                    </div>
                    {day.precipitation > 0 && (
                      <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> {day.precipitation}mm
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">{t("weather.load_error")}</p>
        </div>
      )}
    </div>
  );
}

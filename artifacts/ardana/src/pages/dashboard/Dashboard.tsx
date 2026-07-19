import React from "react";
import { useLanguage } from "@/lib/contexts/LanguageContext";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  useGetPlantDashboard,
  useGetWeather,
  useListReminders,
} from "@workspace/api-client-react";
import {
  Leaf,
  Sprout,
  AlertCircle,
  Droplets,
  ArrowRight,
  CloudSun,
  CalendarClock,
  Activity,
  ScanSearch,
  Stethoscope,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format, isToday, isTomorrow } from "date-fns";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  const { data: stats, isLoading: statsLoading } = useGetPlantDashboard();
  const { data: weather, isLoading: weatherLoading } = useGetWeather({
    lat: 33.89,
    lon: 35.5,
    language,
  });
  const { data: reminders, isLoading: remindersLoading } = useListReminders({
    upcoming: "true",
  });

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const upcomingTodayOrTomorrow = reminders?.filter(
    (r) => r.scheduledDate === today || r.scheduledDate === tomorrow,
  );

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  const typeLabels: Record<string, string> = {
    watering: t("reminders.type_watering"),
    fertilizing: t("reminders.type_fertilizing"),
    pruning: t("reminders.type_pruning"),
    spraying: t("reminders.type_spraying"),
    harvesting: t("reminders.type_harvesting"),
    other: t("reminders.type_other"),
  };

  const firstName = user?.name?.split(" ")[0] ?? t("dashboard.default_name");

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">
          {t("dashboard.welcome", { name: firstName })}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t("dashboard.subtitle")}
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        <motion.div variants={item} className="h-full">
          <Link href="/plants" className="block h-full">
            <Card className="h-full bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all cursor-pointer">
              <CardContent className="p-6 h-full flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("dashboard.total_plants")}
                    </p>
                    <p className="text-3xl font-serif font-bold text-primary">
                      {statsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        stats?.totalPlants || 0
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Leaf className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div variants={item} className="h-full">
          <Link href="/plants?attention=true" className="block h-full">
            <Card className="h-full bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all hover:border-destructive/40 hover:shadow-md cursor-pointer group">
              <CardContent className="p-6 h-full flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("dashboard.needs_attention")}
                    </p>
                    <p className="text-3xl font-serif font-bold text-destructive">
                      {statsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        stats?.needsAttention || 0
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div variants={item} className="h-full">
          <Link href="/reminders?tab=upcoming" className="block h-full">
            <Card className="h-full bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all cursor-pointer">
              <CardContent className="p-6 h-full flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("dashboard.upcoming_tasks")}
                    </p>
                    <p className="text-3xl font-serif font-bold text-amber-600">
                      {statsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        (stats?.upcomingRemindersCount || 0) +
                        (stats?.overdueRemindersCount || 0)
                      )}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <CalendarClock className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>

        <motion.div variants={item} className="h-full">
          <Link href="/reminders?tab=completed" className="block h-full">
            <Card className="h-full bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all cursor-pointer">
              <CardContent className="p-6 h-full flex flex-col justify-center">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t("dashboard.recently_watered")}
                    </p>
                    <p className="text-3xl font-serif font-bold text-blue-600">
                      {statsLoading ? (
                        <Skeleton className="h-8 w-16" />
                      ) : (
                        stats?.recentlyWatered || 0
                      )}
                    </p>
                    {!statsLoading && stats && (stats.wateredToday || stats.wateredYesterday) ? (
                      <p className="text-xs text-blue-600/80 font-medium">
                        {stats.wateredToday || 0} {t("dashboard.watered_today")} · {stats.wateredYesterday || 0} {t("dashboard.watered_yesterday")}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Droplets className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      </motion.div>

      {/* Quick add + Reminders + Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Reminders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="shadow-md border-border rounded-2xl h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-serif">
                  {t("dashboard.upcoming_reminders")}
                </CardTitle>
                <CardDescription>
                  {t("dashboard.reminders_subtitle")}
                </CardDescription>
              </div>
              <Link href="/reminders">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  {t("dashboard.view_all")} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : upcomingTodayOrTomorrow && upcomingTodayOrTomorrow.length > 0 ? (
                <div className="space-y-2">
                  {upcomingTodayOrTomorrow.slice(0, 5).map((reminder) => {
                    const scheduled = new Date(reminder.scheduledDate + "T12:00:00");
                    const isTodayDate = isToday(scheduled);
                    const isTomorrowDate = isTomorrow(scheduled);
                    const typeColors: Record<string, string> = {
                      watering: "bg-blue-100 text-blue-700",
                      fertilizing: "bg-green-100 text-green-700",
                      pruning: "bg-orange-100 text-orange-700",
                      default: "bg-gray-100 text-gray-700",
                    };
                    const colorClass =
                      typeColors[reminder.type] ?? typeColors.default;
                    return (
                      <div
                        key={reminder.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                          "border-border bg-background",
                        )}
                      >
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded-md font-semibold capitalize",
                            colorClass,
                          )}
                        >
                          {typeLabels[reminder.type] ?? reminder.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {reminder.plantName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isTodayDate
                              ? t("reminders.today")
                              : isTomorrowDate
                                ? t("dashboard.tomorrow")
                                : format(scheduled, "MMM d, yyyy")}
                            <span className="mx-1.5">·</span>
                            {format(scheduled, "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <CalendarClock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {t("dashboard.no_tasks_today_or_tomorrow")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("dashboard.no_tasks_today_or_tomorrow_desc")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Right column: Weather + Tools */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4"
        >
          {/* Quick add */}
          <Link href="/plants/new">
            <Card className="shadow-sm border-primary/30 rounded-2xl bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer group">
              <CardContent className="p-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {t("plant_new.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.quick_add_desc")}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Weather */}
          <Card className="shadow-md border-border rounded-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-slate-700 to-slate-900 text-white p-5">
              <CardTitle className="text-white font-serif text-base mb-3 flex items-center gap-2">
                <CloudSun className="w-5 h-5" />{" "}
                {t("dashboard.current_weather")}
              </CardTitle>
              {weatherLoading ? (
                <Skeleton className="h-16 bg-white/10" />
              ) : weather ? (
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {Math.round(weather.current.temperature)}°C
                    </span>
                    <span className="text-white/70 text-sm">
                      {weather.current.weatherDescription}
                    </span>
                  </div>
                  <p className="text-white/60 text-xs">
                    {weather.recommendation}
                  </p>
                  <div className="mt-3 text-center">
                    <Link
                      href="/weather"
                      className="text-xs font-medium text-white/70 hover:text-white hover:underline"
                    >
                      {t("dashboard.view_forecast")}
                    </Link>
                  </div>
                </div>
              ) : (
                <p className="text-white/70 text-sm">
                  {t("dashboard.weather_unavailable")}
                </p>
              )}
            </div>
          </Card>

          {/* AI Tools */}
          <Card className="shadow-md border-border rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif text-base">
                {t("dashboard.ai_tools")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <Link
                href="/ai/identify"
                className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <ScanSearch className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">
                    {t("dashboard.identify_plant")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.identify_desc")}
                  </p>
                </div>
              </Link>
              <Link
                href="/ai/disease"
                className="flex items-center gap-3 p-3 rounded-xl border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm group-hover:text-accent-foreground transition-colors">
                    {t("dashboard.detect_disease")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("dashboard.detect_desc")}
                  </p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useGetPlantDashboard, useGetWeather, useListReminders } from '@workspace/api-client-react';
import { Leaf, Sprout, AlertCircle, Droplets, ArrowRight, CloudSun, CalendarClock, Activity, ScanSearch, Stethoscope } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const { t, isRTL } = useLanguage();
  
  const { data: stats, isLoading: statsLoading } = useGetPlantDashboard();
  const { data: weather, isLoading: weatherLoading } = useGetWeather({ lat: 33.89, lon: 35.50 });
  const { data: reminders, isLoading: remindersLoading } = useListReminders({ upcoming: 'true' });

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">
          {t('dashboard.welcome')}
        </h1>
        <p className="text-muted-foreground text-lg">{t('dashboard.subtitle')}</p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
      >
        <motion.div variants={item}>
          <Card className="bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Total Plants</p>
                  <p className="text-3xl font-serif font-bold text-primary">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalPlants || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Needs Attention</p>
                  <p className="text-3xl font-serif font-bold text-destructive">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.needsAttention || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Upcoming Reminders</p>
                  <p className="text-3xl font-serif font-bold text-accent-foreground">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.upcomingRemindersCount || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                  <CalendarClock className="w-6 h-6 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-card shadow-sm border-border overflow-hidden hover-elevate transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Recently Watered</p>
                  <p className="text-3xl font-serif font-bold text-secondary">
                    {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.recentlyWatered || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center">
                  <Droplets className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <Card className="shadow-md border-border overflow-hidden rounded-2xl">
            <CardHeader className="bg-muted/30 pb-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Sprout className="w-5 h-5 text-primary" />
                  <CardTitle className="font-serif">Farm Overview</CardTitle>
                </div>
                <Link href="/plants" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                  View All {isRTL ? <ArrowRight className="w-4 h-4 rotate-180" /> : <ArrowRight className="w-4 h-4" />}
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {statsLoading ? (
                <div className="p-6 space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : stats && stats.totalPlants > 0 ? (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">By Type</h4>
                    <div className="space-y-3">
                      {Object.entries(stats.byType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="capitalize text-foreground font-medium">{type}</span>
                          <span className="bg-primary/10 text-primary px-2.5 py-0.5 rounded-full text-sm font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Health Status</h4>
                    <div className="space-y-3">
                      {Object.entries(stats.byHealth).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="capitalize text-foreground font-medium">{status}</span>
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-sm font-bold",
                            status === 'healthy' ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                            status === 'poor' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                            "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          )}>
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Leaf className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-serif font-semibold mb-2">No plants yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">Your farmbook is empty. Add your first crop, plant, or tree to start managing your land.</p>
                  <Link href="/plants/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                    Add Your First Plant
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-border rounded-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Activity className="w-5 h-5 text-accent-foreground" />
                  <CardTitle className="font-serif">Upcoming Tasks</CardTitle>
                </div>
                <Link href="/reminders" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
                  View Schedule {isRTL ? <ArrowRight className="w-4 h-4 rotate-180" /> : <ArrowRight className="w-4 h-4" />}
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {remindersLoading ? (
                 <div className="space-y-4">
                 <Skeleton className="h-16 w-full" />
                 <Skeleton className="h-16 w-full" />
               </div>
              ) : reminders && reminders.length > 0 ? (
                <div className="space-y-3">
                  {reminders.slice(0, 4).map(reminder => (
                    <div key={reminder.id} className="flex items-center gap-4 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        reminder.type === 'watering' ? 'bg-blue-100 text-blue-600' :
                        reminder.type === 'fertilizing' ? 'bg-amber-100 text-amber-600' :
                        reminder.type === 'pruning' ? 'bg-green-100 text-green-600' :
                        'bg-slate-100 text-slate-600'
                      )}>
                        {reminder.type === 'watering' ? <Droplets className="w-5 h-5" /> : <Sprout className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{reminder.plantName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{reminder.type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{format(new Date(reminder.scheduledDate), 'MMM d')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p>No upcoming tasks. Enjoy your day!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-1 space-y-6">
          <Card className="bg-gradient-to-br from-secondary to-sidebar text-secondary-foreground shadow-lg overflow-hidden border-none rounded-2xl relative">
            {/* Decorative background circle */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
            
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-serif text-white">
                <CloudSun className="w-5 h-5" />
                Local Weather
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weatherLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-1/2 bg-white/20" />
                  <Skeleton className="h-4 w-full bg-white/20" />
                  <Skeleton className="h-20 w-full bg-white/20 mt-4" />
                </div>
              ) : weather ? (
                <div>
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <p className="text-5xl font-bold font-serif text-white">{weather.current.temperature}°</p>
                      <p className="text-secondary-foreground/80 font-medium capitalize mt-1">
                        {weather.current.weatherDescription}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-secondary-foreground/80">{weather.locationName}</p>
                      <p className="text-xs text-secondary-foreground/60 mt-1">H: {weather.current.humidity}% W: {weather.current.windSpeed}km/h</p>
                    </div>
                  </div>
                  
                  <div className="bg-black/20 rounded-xl p-4 mt-6 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <Leaf className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed text-white/90">
                        {weather.recommendation}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <Link href="/weather" className="text-xs font-medium text-white/70 hover:text-white hover:underline transition-colors">
                      View full forecast
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-white/70">
                  <p>Weather data unavailable.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-md border-border rounded-2xl">
            <CardHeader>
              <CardTitle className="font-serif">Ardana Tools</CardTitle>
              <CardDescription>Smart AI assistance for your farm</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/ai/identify" className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  <ScanSearch className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">Identify Plant</h4>
                  <p className="text-xs text-muted-foreground">Take a photo to know the species</p>
                </div>
              </Link>
              
              <Link href="/ai/disease" className="flex items-center gap-3 p-3 rounded-xl border border-accent/30 bg-accent/5 hover:bg-accent/10 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground group-hover:text-accent-foreground transition-colors">Detect Disease</h4>
                  <p className="text-xs text-muted-foreground">Scan leaves for health issues</p>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

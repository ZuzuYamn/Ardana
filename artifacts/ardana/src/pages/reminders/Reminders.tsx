import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useListReminders, useUpdateReminder, getListRemindersQueryKey, useListPlants, useCreateReminder, getGetPlantDashboardQueryKey, getListPlantsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell, CheckCircle2, Circle, Sprout, Droplets, Leaf, Calendar, Plus, Clock,
  CloudRain, Thermometer, Zap, Shield, Loader2, MapPin, Search, X,
  ChevronDown, ChevronUp, AlertTriangle, Info, FlaskConical, Wheat,
  Crosshair,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SmartAlert {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  plantName: string | null;
  action: 'skip' | 'postpone' | 'advance' | 'urgent' | 'info';
  suggestedDate: string | null;
}

interface WeatherDay {
  date: string;
  maxTemp: number;
  minTemp: number;
  precipitation: number;
  chanceOfRain: number;
  description: string;
}

interface SmartAlertsResponse {
  alerts: SmartAlert[];
  locationName: string;
  weatherSummary: WeatherDay[];
}

interface SavedLocation {
  lat: number;
  lon: number;
  label: string;
}

// ─── Smart Alerts Panel ───────────────────────────────────────────────────────

const LOCATION_KEY = 'ardana_smart_alert_location';

const severityStyles: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50/80 dark:bg-blue-950/30 dark:border-blue-900',
  warning: 'border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900',
  critical: 'border-red-200 bg-red-50/80 dark:bg-red-950/30 dark:border-red-900',
};

const severityIconBg: Record<string, string> = {
  info: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40',
  critical: 'bg-red-100 text-red-600 dark:bg-red-900/40',
};

const actionBadge: Record<string, { label: string; className: string }> = {
  skip:     { label: 'Skip',     className: 'bg-slate-100 text-slate-700 border-slate-200' },
  postpone: { label: 'Postpone', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  advance:  { label: 'Move up',  className: 'bg-blue-100 text-blue-700 border-blue-200' },
  urgent:   { label: 'Urgent',   className: 'bg-red-100 text-red-700 border-red-200' },
  info:     { label: 'Info',     className: 'bg-gray-100 text-gray-700 border-gray-200' },
};

function alertIcon(type: string) {
  const icons: Record<string, React.ReactNode> = {
    watering:    <Droplets className="w-4 h-4" />,
    fertilizing: <FlaskConical className="w-4 h-4" />,
    pruning:     <Leaf className="w-4 h-4" />,
    spraying:    <Zap className="w-4 h-4" />,
    harvesting:  <Wheat className="w-4 h-4" />,
    protection:  <Shield className="w-4 h-4" />,
    general:     <Leaf className="w-4 h-4" />,
  };
  return icons[type] ?? <Bell className="w-4 h-4" />;
}

function SmartAlertsPanel() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [location, setLocation] = useState<SavedLocation | null>(() => {
    try { return JSON.parse(localStorage.getItem(LOCATION_KEY) ?? 'null'); } catch { return null; }
  });
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SavedLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const [data, setData] = useState<SmartAlertsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch when location is known
  const fetchAlerts = useCallback(async (loc: SavedLocation) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/weather/smart-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lat: loc.lat, lon: loc.lon, locationName: loc.label }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
    } catch {
      setError('Could not load smart alerts. Check your weather API key.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location) fetchAlerts(location);
  }, [location, fetchAlerts]);

  // Geocode search
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/weather/geocode?q=${encodeURIComponent(query)}`, { credentials: 'include' });
        if (res.ok) setSuggestions(await res.json());
      } finally { setIsSearching(false); }
    }, 350);
  }, [query]);

  // Close search on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSuggestions([]);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectLocation(loc: SavedLocation) {
    localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    setLocation(loc);
    setShowSearch(false);
    setSuggestions([]);
    setQuery('');
    toast({ title: t('reminders.location_set_to', { label: loc.label }) });
  }

  const handleUseCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast({
        title: t('reminders.location_unavailable'),
        variant: 'destructive',
      });
      return;
    }

    setIsDetectingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 60_000,
        });
      });

      const { latitude, longitude } = position.coords;
      const res = await fetch(`/api/weather/reverse-geocode?lat=${latitude}&lon=${longitude}`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? 'Could not resolve location');
      }
      const loc: SavedLocation = await res.json();
      selectLocation(loc);
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          toast({ title: t('reminders.location_permission_denied'), variant: 'destructive' });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast({ title: t('reminders.location_unavailable'), variant: 'destructive' });
        } else {
          toast({ title: t('reminders.location_error', { message: err.message }), variant: 'destructive' });
        }
      } else if (err instanceof Error) {
        toast({ title: t('reminders.location_error', { message: err.message }), variant: 'destructive' });
      } else {
        toast({ title: t('reminders.location_unavailable'), variant: 'destructive' });
      }
    } finally {
      setIsDetectingLocation(false);
    }
  }, [t, toast]);

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <CloudRain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-sm text-foreground">Smart Weather Alerts</h2>
            {location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" /> {location.label}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setShowSearch((v) => !v)}
          >
            <MapPin className="w-3.5 h-3.5" />
            {location ? 'Change' : 'Set location'}
          </Button>
          {location && data && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => fetchAlerts(location)}>
              <Loader2 className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsExpanded((v) => !v)}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Location search */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b"
          >
            <div className="p-4 space-y-3" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('weather.search_placeholder')}
                  className="pl-9 pr-8"
                />
                {query && (
                  <button onClick={() => { setQuery(''); setSuggestions([]); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full justify-center gap-2"
                disabled={isDetectingLocation}
                onClick={handleUseCurrentLocation}
              >
                {isDetectingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Crosshair className="w-4 h-4" />
                )}
                {isDetectingLocation ? t('reminders.detecting_location') : t('reminders.use_current_location')}
              </Button>

              {(suggestions.length > 0 || isSearching) && (
                <div className="rounded-xl border bg-popover shadow-md overflow-hidden">
                  {isSearching && <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…</div>}
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => selectLocation(s)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent flex items-center gap-2.5 transition-colors border-b last:border-0">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Body */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {!location ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Set your location to get weather-aware watering and care recommendations for your plants.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2 mt-1 w-full sm:w-auto">
                  <Button size="sm" variant="outline" onClick={() => setShowSearch(true)} className="gap-2 w-full sm:w-auto">
                    <Search className="w-3.5 h-3.5" /> Set location
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="gap-2 w-full sm:w-auto"
                    disabled={isDetectingLocation}
                    onClick={handleUseCurrentLocation}
                  >
                    {isDetectingLocation ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Crosshair className="w-3.5 h-3.5" />
                    )}
                    {isDetectingLocation ? t('reminders.detecting_location') : t('reminders.use_current_location')}
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : error ? (
              <div className="flex items-center gap-3 m-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            ) : data && data.alerts.length === 0 ? (
              <div className="flex items-center gap-3 m-4 p-4 rounded-xl border bg-muted/40 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-green-500" />
                All your plant schedules look good for the coming week based on the forecast.
              </div>
            ) : data ? (
              <div className="p-4 space-y-3">
                {/* Mini weather strip */}
                {data.weatherSummary.length > 0 && (
                  <div className="flex gap-2 mb-1">
                    {data.weatherSummary.map((d) => (
                      <div key={d.date} className="flex-1 rounded-xl border bg-muted/40 p-2.5 text-center text-xs">
                        <p className="font-medium text-foreground">{new Date(d.date).toLocaleDateString([], { weekday: 'short' })}</p>
                        <p className="text-muted-foreground mt-0.5">{d.maxTemp}° / {d.minTemp}°</p>
                        {d.chanceOfRain > 20 && (
                          <p className="text-blue-500 flex items-center justify-center gap-0.5 mt-0.5">
                            <Droplets className="w-2.5 h-2.5" />{d.chanceOfRain}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Alert cards */}
                {data.alerts.map((alert, i) => {
                  const badge = actionBadge[alert.action] ?? actionBadge.info;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn('rounded-xl border p-4 flex gap-3', severityStyles[alert.severity])}
                    >
                      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', severityIconBg[alert.severity])}>
                        {alertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{alert.title}</p>
                          <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', badge.className)}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-sm opacity-90 leading-relaxed">{alert.message}</p>
                        {alert.suggestedDate && (
                          <p className="text-xs mt-1.5 font-medium opacity-75 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Suggested: {format(new Date(alert.suggestedDate), 'EEE, MMM d')}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Reminder form schema ─────────────────────────────────────────────────────

const buildFormSchema = (t: (key: string) => string) => z.object({
  plantId: z.coerce.number().min(1, t('reminders.plant_required')),
  type: z.string().min(1, t('reminders.type_required')),
  scheduledDate: z.string().min(1, t('reminders.date_required')),
  notes: z.string().optional(),
});

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Reminders() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('upcoming');
  const [isAddOpen, setIsAddOpen] = useState(false);

  const { data: reminders, isLoading } = useListReminders({ 
    completed: tab === 'completed' ? 'true' : 'false' 
  });

  const { data: plants } = useListPlants();

  const updateReminder = useUpdateReminder();
  const createReminder = useCreateReminder();

  const form = useForm<FormValues>({
    resolver: zodResolver(buildFormSchema(t)),
    defaultValues: {
      type: 'watering',
      scheduledDate: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const handleToggleComplete = (id: number, currentStatus: boolean) => {
    updateReminder.mutate({ id, data: { completed: !currentStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey({ completed: 'false' }) });
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey({ completed: 'true' }) });
        queryClient.invalidateQueries({ queryKey: getGetPlantDashboardQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListPlantsQueryKey() });
        if (!currentStatus) {
          toast({ title: t('reminders.task_completed'), description: t('reminders.good_job') });
        }
      }
    });
  };

  const onSubmit = (data: FormValues) => {
    createReminder.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRemindersQueryKey({ completed: 'false' }) });
        toast({ title: t('reminders.added'), description: t('reminders.scheduled') });
        setIsAddOpen(false);
        form.reset();
      }
    });
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'watering': return <Droplets className="w-5 h-5 text-blue-500" />;
      case 'fertilizing': return <Sprout className="w-5 h-5 text-amber-500" />;
      case 'pruning': return <Leaf className="w-5 h-5 text-green-500" />;
      default: return <Clock className="w-5 h-5 text-slate-500" />;
    }
  };

  const getColorClass = (type: string) => {
    switch (type) {
      case 'watering': return "bg-blue-50/50 border-blue-100 dark:bg-blue-950/20 dark:border-blue-900";
      case 'fertilizing': return "bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900";
      case 'pruning': return "bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900";
      default: return "bg-slate-50/50 border-slate-100 dark:bg-slate-900/20 dark:border-slate-800";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            {t('reminders.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('reminders.subtitle')}</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground">
              <Plus className="w-4 h-4" /> {t('reminders.add')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">{t('reminders.new_task_title')}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="plantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('reminders.plant_label')}</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('reminders.select_plant')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {plants?.map(p => (
                            <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('reminders.type_label')}</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="watering">{t('reminders.type_watering')}</SelectItem>
                            <SelectItem value="fertilizing">{t('reminders.type_fertilizing')}</SelectItem>
                            <SelectItem value="pruning">{t('reminders.type_pruning')}</SelectItem>
                            <SelectItem value="spraying">{t('reminders.type_spraying')}</SelectItem>
                            <SelectItem value="harvesting">{t('reminders.type_harvesting')}</SelectItem>
                            <SelectItem value="other">{t('reminders.type_other')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="scheduledDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('reminders.date_field_label')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('reminders.notes_label')}</FormLabel>
                      <FormControl>
                        <Textarea placeholder={t('reminders.notes_placeholder')} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={createReminder.isPending}>
                  {t('reminders.schedule_btn')}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Smart Weather Alerts ─────────────────────────────────────────── */}
      <SmartAlertsPanel />

      {/* ── Reminder list ────────────────────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="upcoming" className="rounded-lg">{t('reminders.pending_tab')}</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg">{t('reminders.completed_tab')}</TabsTrigger>
        </TabsList>

        <div className="mt-8">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
            </div>
          ) : reminders && reminders.length > 0 ? (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {reminders.map(reminder => {
                  const date = new Date(reminder.scheduledDate);
                  const isOverdue = !reminder.completed && isPast(date) && !isToday(date);

                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      key={reminder.id}
                    >
                      <Card className={cn(
                        "overflow-hidden border transition-all hover:shadow-md",
                        getColorClass(reminder.type),
                        isOverdue && "border-destructive/50 bg-destructive/5"
                      )}>
                        <CardContent className="p-4 sm:p-6 flex items-center gap-4">
                          <button 
                            onClick={() => handleToggleComplete(reminder.id, reminder.completed)}
                            className="group shrink-0"
                          >
                            {reminder.completed ? (
                              <CheckCircle2 className="w-8 h-8 text-primary" />
                            ) : (
                              <Circle className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-4 mb-1">
                              <h3 className="font-bold text-lg text-foreground truncate">{reminder.plantName}</h3>
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <Calendar className="w-4 h-4 text-muted-foreground" />
                                <span className={cn(isOverdue && "text-destructive font-bold")}>
                                  {isToday(date) ? t('reminders.today') : format(date, 'MMM d, yyyy')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                              {getIconForType(reminder.type)}
                              <span className="capitalize">{t(`reminders.type_${reminder.type}`)}</span>
                            </div>

                            {reminder.notes && (
                              <p className="text-sm text-foreground/70 bg-background/50 p-2 rounded-lg border border-border/50">
                                {reminder.notes}
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          ) : (
             <div className="text-center py-20 px-4 rounded-3xl border-2 border-dashed bg-card/50">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="font-serif text-2xl font-bold mb-2">{t('reminders.all_caught_up')}</h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {tab === 'upcoming' 
                    ? t('reminders.no_upcoming')
                    : t('reminders.no_completed')}
                </p>
             </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

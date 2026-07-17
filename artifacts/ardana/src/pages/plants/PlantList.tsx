import React, { useState } from 'react';
import { useListPlants } from '@workspace/api-client-react';
import { Link, useSearch } from 'wouter';
import { Leaf, Plus, Search, Filter, Sprout, AlertCircle, Droplets, MapPin, Activity, X, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/contexts/LanguageContext';

export default function PlantList() {
  const { t } = useLanguage();
  const searchStr = useSearch();

  // Pre-select "attention" filter when coming from the dashboard card
  const isAttentionParam = new URLSearchParams(searchStr).get('attention') === 'true';

  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('all');
  const [healthStatus, setHealthStatus] = useState<string>(isAttentionParam ? 'attention' : 'all');

  // "attention" = poor OR moderate — fetch all and filter client-side since the
  // API only accepts a single health status value at a time.
  const apiHealthStatus = healthStatus === 'attention' || healthStatus === 'all'
    ? undefined
    : healthStatus;

  const { data: allPlants, isLoading } = useListPlants({
    search: search || undefined,
    type: type !== 'all' ? type : undefined,
    healthStatus: apiHealthStatus,
  });

  const plants = healthStatus === 'attention'
    ? allPlants?.filter((p) => p.healthStatus === 'poor' || p.healthStatus === 'moderate')
    : allPlants;

  const isFiltered = search || type !== 'all' || healthStatus !== 'all';

  const clearFilters = () => {
    setSearch('');
    setType('all');
    setHealthStatus('all');
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3">
            <Leaf className="w-8 h-8 text-primary" />
            {t('plants.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('plants.subtitle')}</p>
        </div>
        <Link href="/plants/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-4 py-2 gap-2">
          <Plus className="w-4 h-4" />
          {t('plants.add')}
        </Link>
      </div>

      {/* Needs Attention banner */}
      {healthStatus === 'attention' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm font-medium flex-1">
            Showing plants with <strong>poor</strong> or <strong>moderate</strong> health that need your attention.
          </p>
          <button
            onClick={clearFilters}
            className="text-destructive/60 hover:text-destructive transition-colors"
            aria-label="Clear attention filter"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Filters */}
      <div className="bg-card border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('plants.search_placeholder')}
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 sm:gap-4">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-[140px] md:w-[180px]">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder={t('plants.filter_type')} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('plants.all_types')}</SelectItem>
              <SelectItem value="crop">{t('plants.type_crop')}</SelectItem>
              <SelectItem value="tree">{t('plants.type_tree')}</SelectItem>
              <SelectItem value="plant">{t('plants.type_plant')}</SelectItem>
              <SelectItem value="flower">{t('plants.type_flower')}</SelectItem>
              <SelectItem value="herb">{t('plants.type_herb')}</SelectItem>
              <SelectItem value="shrub">{t('plants.type_shrub')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={healthStatus} onValueChange={setHealthStatus}>
            <SelectTrigger className={cn(
              "w-[140px] md:w-[180px]",
              healthStatus === 'attention' && "border-destructive/50 text-destructive",
            )}>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder={t('plants.filter_health')} />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('plants.all_health')}</SelectItem>
              <SelectItem value="attention">
                <span className="flex items-center gap-2 text-destructive font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Needs Attention
                </span>
              </SelectItem>
              <SelectItem value="healthy">{t('plants.health_healthy')}</SelectItem>
              <SelectItem value="moderate">{t('plants.health_moderate')}</SelectItem>
              <SelectItem value="poor">{t('plants.health_poor')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Plant grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-2xl border bg-card p-4 space-y-4">
              <Skeleton className="h-40 w-full rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : plants && plants.length > 0 ? (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {plants.map((plant) => (
            <motion.div variants={item} key={plant.id}>
              <div className={cn(
                "h-full rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group",
                healthStatus === 'attention' && (plant.healthStatus === 'poor' || plant.healthStatus === 'moderate') && "ring-1 ring-destructive/30",
              )}>
                <Link href={`/plants/${plant.id}`} className="block outline-none">
                  <div className="h-48 bg-muted relative overflow-hidden">
                    {plant.photoUrl ? (
                      <img src={plant.photoUrl} alt={plant.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary/10">
                        <Sprout className="w-16 h-16 text-secondary/40" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3 flex gap-2">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md",
                        plant.healthStatus === 'healthy' ? "bg-green-500/90 text-white" :
                        plant.healthStatus === 'poor' ? "bg-red-500/90 text-white" :
                        "bg-amber-500/90 text-white"
                      )}>
                        {plant.healthStatus === 'healthy' ? t('plants.health_healthy')
                          : plant.healthStatus === 'poor' ? t('plants.health_poor')
                          : plant.healthStatus === 'moderate' ? t('plants.health_moderate')
                          : t('plants.health_unknown')}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-black/50 text-white backdrop-blur-md capitalize shadow-sm">
                        {plant.type}
                      </span>
                    </div>
                  </div>

                  <div className="p-5 pb-3">
                    <h3 className="font-serif text-xl font-bold text-foreground mb-1 group-hover:text-primary transition-colors">{plant.name}</h3>
                    <p className="text-sm text-muted-foreground italic mb-4">{plant.species || t('plants.unknown_species')}</p>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-foreground/80">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{plant.location || t('plants.no_location')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground/80">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <span className="truncate">
                          {plant.lastWateredDate
                            ? formatDistanceToNow(new Date(plant.lastWateredDate), { addSuffix: true })
                            : t('plants.never_watered')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>

                {/* Edit button — separate from the card Link to avoid nested interactive elements */}
                <div className="px-5 pb-4 pt-2 border-t border-border/50">
                  <Link
                    href={`/plants/${plant.id}/edit`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit plant
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-20 px-4 rounded-2xl border-2 border-dashed bg-card/50">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
            {healthStatus === 'attention'
              ? <AlertCircle className="w-10 h-10 text-green-500" />
              : <Sprout className="w-10 h-10 text-muted-foreground" />}
          </div>
          <h2 className="font-serif text-2xl font-bold mb-2">
            {healthStatus === 'attention' ? 'All plants are healthy!' : t('plants.none_found')}
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            {healthStatus === 'attention'
              ? 'No plants with poor or moderate health were found. Your farm is in great shape.'
              : isFiltered
              ? t('plants.none_filter')
              : t('plants.none_empty')}
          </p>
          {isFiltered ? (
            <Button variant="outline" onClick={clearFilters}>
              {t('plants.clear_filters')}
            </Button>
          ) : (
            <Link href="/plants/new" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-10 px-6 py-2 gap-2">
              <Plus className="w-4 h-4" />
              {t('plants.add_first')}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useCallback } from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft, Camera, ImagePlus, Leaf, Loader2, CheckCircle2,
  Droplets, Sparkles, AlertTriangle, X, Sun, Trees,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocationPicker } from '@/components/LocationPicker';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useGetPlant, useUpdatePlant, getGetPlantQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlantIdentification {
  commonName: string | null;
  species: string | null;
  family: string | null;
  confidence: string | null;
  description: string | null;
  wateringRequirements: string | null;
  growingConditions: string | null;
  fertilizers: string | null;
  careRecommendations: string | null;
  sunlight: string | null;
  soilType: string | null;
  suggestedWateringIntervalDays: number | null;
  suggestedFertilizingIntervalDays: number | null;
  suggestedPruningIntervalDays: number | null;
  error: string | null;
}

interface DiseaseDetection {
  isHealthy: boolean;
  diseaseName: string | null;
  confidence: string | null;
  description: string | null;
  treatments: string | null;
  urgency: string | null;
  error: string | null;
}

interface AIResults {
  identification: PlantIdentification;
  disease: DiseaseDetection;
}

// ─── Image Compression ────────────────────────────────────────────────────────

async function compressImage(file: File, maxWidth = 1024): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ dataUrl, base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = e.target!.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Form Schema ──────────────────────────────────────────────────────────────

const buildFormSchema = (t: (key: string) => string) => z.object({
  name: z.string().min(1, t('plant_new.name_required')),
  type: z.string().min(1, t('plant_new.type_required')),
  species: z.string().optional(),
  location: z.string().optional(),
  plantedDate: z.string().optional(),
  healthStatus: z.string().default('unknown'),
  wateringIntervalDays: z.coerce.number().int().positive().optional().or(z.literal('')),
  fertilizingIntervalDays: z.coerce.number().int().positive().optional().or(z.literal('')),
  pruningIntervalDays: z.coerce.number().int().positive().optional().or(z.literal('')),
  notes: z.string().optional(),
});

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlantEdit() {
  const [, params] = useRoute('/plants/:id/edit');
  const id = params?.id ? parseInt(params.id, 10) : 0;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language, isRTL } = useLanguage();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: plant, isLoading, error } = useGetPlant(id, {
    query: { enabled: id > 0, queryKey: getGetPlantQueryKey(id) },
  });

  const updatePlant = useUpdatePlant();

  const [newImageData, setNewImageData] = useState<{ dataUrl: string; base64: string; mimeType: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<AIResults | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formReady, setFormReady] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(buildFormSchema(t)),
    defaultValues: {
      name: '',
      type: 'plant',
      species: '',
      location: '',
      plantedDate: '',
      healthStatus: 'unknown',
      wateringIntervalDays: 3,
      fertilizingIntervalDays: 20,
      pruningIntervalDays: '',
      notes: '',
    },
  });

  // Populate form once plant data loads
  React.useEffect(() => {
    if (plant && !formReady) {
      form.reset({
        name: plant.name ?? '',
        type: plant.type ?? 'plant',
        species: plant.species ?? '',
        location: plant.location ?? '',
        plantedDate: plant.plantedDate ?? '',
        healthStatus: plant.healthStatus ?? 'unknown',
        wateringIntervalDays: plant.wateringIntervalDays ?? ('' as any),
        fertilizingIntervalDays: plant.fertilizingIntervalDays ?? ('' as any),
        pruningIntervalDays: plant.pruningIntervalDays ?? ('' as any),
        notes: plant.notes ?? '',
      });
      setFormReady(true);
    }
  }, [plant, formReady, form]);

  // ── Image Selection & AI Analysis ─────────────────────────────────────────

  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setNewImageData(compressed);
      setAiResults(null);

      setIsAnalyzing(true);
      try {
        const [identifyRes, diseaseRes] = await Promise.all([
          fetch('/api/ai/identify-plant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ imageBase64: compressed.base64, mimeType: compressed.mimeType, language }),
          }),
          fetch('/api/ai/detect-disease', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ imageBase64: compressed.base64, mimeType: compressed.mimeType, language }),
          }),
        ]);

        const identification: PlantIdentification = await identifyRes.json();
        const disease: DiseaseDetection = await diseaseRes.json();
        const results: AIResults = { identification, disease };
        setAiResults(results);

        if (identification.commonName) form.setValue('name', identification.commonName);
        if (identification.species) form.setValue('species', identification.species);
        if (identification.suggestedWateringIntervalDays) {
          form.setValue('wateringIntervalDays', identification.suggestedWateringIntervalDays as any);
        }
        if (identification.suggestedFertilizingIntervalDays) {
          form.setValue('fertilizingIntervalDays', identification.suggestedFertilizingIntervalDays as any);
        }
        if (identification.suggestedPruningIntervalDays) {
          form.setValue('pruningIntervalDays', identification.suggestedPruningIntervalDays as any);
        }
        if (!disease.isHealthy && disease.urgency === 'immediate') {
          form.setValue('healthStatus', 'poor');
        } else if (!disease.isHealthy) {
          form.setValue('healthStatus', 'moderate');
        } else if (disease.isHealthy) {
          form.setValue('healthStatus', 'healthy');
        }
      } catch {
        toast({ title: t('plant_new.ai_error'), description: t('plant_new.toast_ai_failed_desc'), variant: 'destructive' });
      } finally {
        setIsAnalyzing(false);
      }
    } catch {
      toast({ title: t('plant_new.toast_image_failed_title'), description: t('plant_new.toast_image_failed_desc'), variant: 'destructive' });
    }
  }, [form, toast, t]);

  const clearNewImage = () => {
    setNewImageData(null);
    setAiResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        type: data.type,
        healthStatus: data.healthStatus,
      };

      // Only include optional fields when they have a real value.
      // The backend treats explicit null as a value to overwrite with, so omitting preserves existing data.
      if (data.species?.trim()) payload.species = data.species.trim();
      if (data.location?.trim()) payload.location = data.location.trim();
      if (data.plantedDate) payload.plantedDate = data.plantedDate;
      if (data.notes?.trim()) payload.notes = data.notes.trim();
      if (data.wateringIntervalDays !== '' && data.wateringIntervalDays != null) {
        payload.wateringIntervalDays = Number(data.wateringIntervalDays);
      }
      if (data.fertilizingIntervalDays !== '' && data.fertilizingIntervalDays != null) {
        payload.fertilizingIntervalDays = Number(data.fertilizingIntervalDays);
      }
      if (data.pruningIntervalDays !== '' && data.pruningIntervalDays != null) {
        payload.pruningIntervalDays = Number(data.pruningIntervalDays);
      }

      // Include new photo if one was uploaded
      if (newImageData) {
        payload.photoDataUrl = newImageData.dataUrl;
      }

      // Include AI results if a new photo was analyzed
      if (aiResults) {
        payload.aiIdentification = JSON.stringify(aiResults.identification);
        payload.aiDiseaseDetection = JSON.stringify(aiResults.disease);
      }

      await updatePlant.mutateAsync({ id, data: payload as any });

      // Invalidate so PlantDetail and any lists reflect the changes
      queryClient.invalidateQueries({ queryKey: getGetPlantQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: ['listPlants'] });

      toast({ title: t('plant_edit.save_success_title'), description: t('plant_edit.save_success_desc', { name: data.name }) });
      navigate(`/plants/${id}`);
    } catch (err) {
      toast({
        title: t('plant_edit.save_error_title'),
        description: err instanceof Error ? err.message : t('plant_edit.save_error_desc'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confidenceColor = (c?: string | null) =>
    c === 'high' ? 'bg-green-100 text-green-800' : c === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700';

  // ── Error / Loading states ─────────────────────────────────────────────────

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-serif font-bold">{t('plant.not_found')}</h2>
        <p className="text-muted-foreground mt-2 mb-6">{t('plant.no_access')}</p>
        <Button onClick={() => navigate('/plants')}>{t('plant.back_to_farm')}</Button>
      </div>
    );
  }

  if (isLoading || !plant || !formReady) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-48 h-8" />
        </div>
        <Skeleton className="w-full h-64 rounded-2xl" />
        <Skeleton className="w-full h-[400px] rounded-2xl" />
      </div>
    );
  }

  // The photo to show: prefer newly uploaded, fall back to existing
  const displayPhotoUrl = newImageData?.dataUrl ?? plant.photoUrl ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link
          href={`/plants/${id}`}
          className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold">{t('plant_edit.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('plant_edit.update_details_for', { name: plant.name })}</p>
        </div>
      </div>

      {/* ── Photo ─────────────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {t('plant_edit.photo_title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {plant.photoUrl ? t('plant_edit.photo_existing') : t('plant_edit.photo_upload_cta')}
          </p>
        </div>

        <div className="p-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />

          {displayPhotoUrl ? (
            <div className="relative">
              <img
                src={displayPhotoUrl}
                alt={plant.name}
                className="w-full h-64 object-cover rounded-xl"
              />
              {newImageData && (
                <button
                  type="button"
                  onClick={clearNewImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors flex items-center gap-1.5"
              >
                <Camera className="w-3.5 h-3.5" />
                {newImageData ? t('plant_edit.change_photo') : t('plant_edit.replace_photo')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-52 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3 group"
            >
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImagePlus className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t('plant_new.upload_cta')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('plant_new.upload_hint')}</p>
              </div>
            </button>
          )}

          {/* AI Analysis state (only shown when a new photo is uploaded) */}
          <AnimatePresence>
            {isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-3"
              >
                <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">{t('plant_new.analyzing_title')}</p>
                  <p className="text-xs text-muted-foreground">{t('plant_new.analyzing_sub')}</p>
                </div>
              </motion.div>
            )}

            {aiResults && !isAnalyzing && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 space-y-3"
              >
                {!aiResults.identification.error && (
                  <div className="rounded-xl border bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" />
                        {t('plant_new.result_identified')}
                      </h3>
                      {aiResults.identification.confidence && (
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', confidenceColor(aiResults.identification.confidence))}>
                          {aiResults.identification.confidence} {t('plant_new.confidence_suffix')}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {aiResults.identification.commonName && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('plant_new.common_name')}</p>
                          <p className="font-medium">{aiResults.identification.commonName}</p>
                        </div>
                      )}
                      {aiResults.identification.species && (
                        <div>
                          <p className="text-xs text-muted-foreground">{t('plant_new.species_result')}</p>
                          <p className="font-medium italic">{aiResults.identification.species}</p>
                        </div>
                      )}
                      {aiResults.identification.sunlight && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Sun className="w-3 h-3" /> {t('plant_id.sunlight')}
                          </p>
                          <p className="font-medium">{aiResults.identification.sunlight}</p>
                        </div>
                      )}
                      {aiResults.identification.suggestedWateringIntervalDays && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Droplets className="w-3 h-3" /> {t('plant_new.water_every')}
                          </p>
                          <p className="font-medium">{aiResults.identification.suggestedWateringIntervalDays} {t('plant_new.days_suffix')}</p>
                        </div>
                      )}
                      {aiResults.identification.suggestedPruningIntervalDays && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Trees className="w-3 h-3" /> {t('plant_new.prune_every')}
                          </p>
                          <p className="font-medium">{aiResults.identification.suggestedPruningIntervalDays} {t('plant_new.days_suffix')}</p>
                        </div>
                      )}
                    </div>
                    {aiResults.identification.careRecommendations && (
                      <p className="text-xs text-muted-foreground border-t pt-2">{aiResults.identification.careRecommendations}</p>
                    )}
                  </div>
                )}

                <div className={cn(
                  'rounded-xl border p-4 flex items-start gap-3',
                  aiResults.disease.isHealthy ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200',
                )}>
                  {aiResults.disease.isHealthy ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn('font-semibold text-sm', aiResults.disease.isHealthy ? 'text-green-800' : 'text-yellow-800')}>
                      {aiResults.disease.isHealthy ? t('plant_new.healthy_result') : (aiResults.disease.diseaseName ?? t('plant_new.health_concern'))}
                    </p>
                    {aiResults.disease.description && (
                      <p className="text-xs mt-1 text-muted-foreground line-clamp-2">{aiResults.disease.description}</p>
                    )}
                    {!aiResults.disease.isHealthy && aiResults.disease.treatments && (
                      <p className="text-xs mt-1 font-medium text-yellow-700">{t('plant_new.treatment_label')} {aiResults.disease.treatments}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Details Form ───────────────────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
            <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
              <Leaf className="w-5 h-5 text-primary" />
              {t('plant_edit.details_title')}
            </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('plant_edit.details_desc')}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>{t('plant_new.name_field_label')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('plant_new.name_field_placeholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="species"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('plant_new.species_field_label')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('plant_new.species_field_placeholder')} className="italic" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('plant_new.type_field_label')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('plant_new.select_type_placeholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="plant">{t('plants.type_plant')}</SelectItem>
                        <SelectItem value="crop">{t('plants.type_crop')}</SelectItem>
                        <SelectItem value="tree">{t('plants.type_tree')}</SelectItem>
                        <SelectItem value="flower">{t('plants.type_flower')}</SelectItem>
                        <SelectItem value="herb">{t('plants.type_herb')}</SelectItem>
                        <SelectItem value="shrub">{t('plants.type_shrub')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="healthStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('plant_new.health_label')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="healthy">{t('plants.health_healthy')}</SelectItem>
                        <SelectItem value="moderate">{t('plants.health_moderate')}</SelectItem>
                        <SelectItem value="poor">{t('plants.health_poor')}</SelectItem>
                        <SelectItem value="unknown">{t('plants.health_unknown')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('plant_new.location_field_label')}</FormLabel>
                    <FormControl>
                      <LocationPicker
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        placeholder={t('plant_new.location_field_placeholder')}
                        disabled={isSaving}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="plantedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('plant_new.planting_date_label')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Care Schedule */}
            <div className="border rounded-xl p-4 space-y-4 bg-muted/30">
              <div>
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  {t('plant_new.care_schedule_title')}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('plant_edit.schedule_hint')}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="wateringIntervalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t('plant_new.water_interval')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="3" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fertilizingIntervalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t('plant_new.fertilize_interval')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pruningIntervalDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t('plant_new.prune_interval')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} placeholder="180" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('plant_new.notes_label')}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('plant_new.notes_placeholder')}
                      className="min-h-[80px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(`/plants/${id}`)}>
                {t('plant_edit.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving || isAnalyzing} className="min-w-[130px]">
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('plant_edit.saving')}</>
                ) : (
                  <><Leaf className="w-4 h-4 me-2" /> {t('plant_edit.save_changes')}</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

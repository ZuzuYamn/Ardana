import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  ArrowLeft, Camera, ImagePlus, Upload, Leaf, Loader2, CheckCircle2,
  Droplets, Sparkles, FlaskConical, AlertTriangle, X, Sun, Trees,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocationPicker } from '@/components/LocationPicker';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/contexts/LanguageContext';

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
  estimatedAgeYears: number | null;
  error: string | null;
}

// Estimate a realistic planting date from an AI-estimated age in years.
// Adjusts the result to the most likely planting season for the location's hemisphere
// (spring in temperate zones; current month shifted by age for tropical zones).
// Falls back to (today - age years) if the location is unknown or geocoding fails.
async function calculatePlantingDateFromAge({
  ageYears,
  currentDate,
  location,
  t,
}: {
  ageYears: number;
  currentDate: Date;
  location?: string;
  t: (key: string) => string;
}): Promise<string> {
  const age = Math.max(0, ageYears);
  const targetYear = currentDate.getFullYear() - age;

  // Seedlings or missing location: use the simple year subtraction.
  if (!location?.trim() || age === 0) {
    const date = new Date(targetYear, currentDate.getMonth(), currentDate.getDate());
    return date.toISOString().split('T')[0];
  }

  // Try to use the location to pick a hemisphere-appropriate planting season.
  try {
    const res = await fetch(`/api/weather/geocode?q=${encodeURIComponent(location)}`);
    if (!res.ok) throw new Error(t('plant_new.geocode_failed'));
    const data = (await res.json()) as Array<{ lat: number }>;
    if (!data.length) throw new Error(t('plant_new.no_results'));
    const lat = data[0].lat;
    const isTropical = Math.abs(lat) <= 23.5;
    const isNorthern = lat >= 0;

    if (isTropical) {
      // Tropical planting can happen year-round; keep the original month shifted by years.
      const date = new Date(targetYear, currentDate.getMonth(), currentDate.getDate());
      return date.toISOString().split('T')[0];
    }

    // Temperate zones: spring planting is the most common default.
    const plantingMonth = isNorthern ? 3 : 9; // April in Northern Hemisphere, October in Southern.
    const date = new Date(targetYear, plantingMonth, 15);
    return date.toISOString().split('T')[0];
  } catch {
    const date = new Date(targetYear, currentDate.getMonth(), currentDate.getDate());
    return date.toISOString().split('T')[0];
  }
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

interface CareScheduleResult {
  wateringIntervalDays: number;
  fertilizingIntervalDays: number;
  pruningIntervalDays: number | null;
  wateringNotes: string;
  fertilizingNotes: string;
  pruningNotes: string;
  explanation: string;
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

export default function PlantNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t, language, isRTL } = useLanguage();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imageData, setImageData] = useState<{ dataUrl: string; base64: string; mimeType: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<AIResults | null>(null);
  const [aiEstimatedPlantedDate, setAiEstimatedPlantedDate] = useState<string | null>(null);
  const [careSchedule, setCareSchedule] = useState<CareScheduleResult | null>(null);
  const [isLoadingCareSchedule, setIsLoadingCareSchedule] = useState(false);
  const [lastRecommendedSchedule, setLastRecommendedSchedule] = useState<{ watering: number; fertilizing: number; pruning: number | null } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const hasUserEditedPlantedDate = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(buildFormSchema(t)),
    defaultValues: {
      name: '',
      type: 'plant',
      species: '',
      location: '',
      plantedDate: new Date().toISOString().split('T')[0],
      healthStatus: 'unknown',
      // Default schedules — user can edit before saving.
      // AI identification will override these if it detects a specific species.
      wateringIntervalDays: 3,
      fertilizingIntervalDays: 20,
      pruningIntervalDays: '',
      notes: '',
    },
  });

  const selectedType = useWatch({ control: form.control, name: 'type' });

  // ── Image Selection & AI Analysis ─────────────────────────────────────────

  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setImageData(compressed);
      setAiResults(null);

      // Auto-analyze immediately
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

        // Pre-fill form from AI results
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
        setLastRecommendedSchedule({
          watering: identification.suggestedWateringIntervalDays ?? 3,
          fertilizing: identification.suggestedFertilizingIntervalDays ?? 20,
          pruning: identification.suggestedPruningIntervalDays ?? null,
        });
        if (identification.estimatedAgeYears != null) {
          const currentLocation = form.getValues('location');
          const estimatedDate = await calculatePlantingDateFromAge({
            ageYears: identification.estimatedAgeYears,
            currentDate: new Date(),
            location: currentLocation,
            t,
          });
          setAiEstimatedPlantedDate(estimatedDate);
          if (!hasUserEditedPlantedDate.current) {
            form.setValue('plantedDate', estimatedDate);
          }
        }
        if (!disease.isHealthy && disease.urgency === 'immediate') {
          form.setValue('healthStatus', 'poor');
        } else if (!disease.isHealthy) {
          form.setValue('healthStatus', 'moderate');
        } else if (disease.isHealthy) {
          form.setValue('healthStatus', 'healthy');
        }
      } catch (err) {
        toast({ title: t('plant_new.ai_error'), description: t('plant_new.toast_ai_failed_desc'), variant: 'destructive' });
      } finally {
        setIsAnalyzing(false);
      }
    } catch {
      toast({ title: t('plant_new.toast_image_failed_title'), description: t('plant_new.toast_image_failed_desc'), variant: 'destructive' });
    }
  }, [form, toast, t, language]);

  const clearImage = () => {
    setImageData(null);
    setAiResults(null);
    setAiEstimatedPlantedDate(null);
    setCareSchedule(null);
    setLastRecommendedSchedule(null);
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Fetch a location-aware and weather-aware care schedule whenever the relevant inputs change.
  const selectedLocation = useWatch({ control: form.control, name: 'location' });
  const selectedSpecies = useWatch({ control: form.control, name: 'species' });

  // Recalculate the AI-estimated planting date when the user changes location,
  // provided they have not manually edited the date themselves.
  useEffect(() => {
    if (aiResults?.identification.estimatedAgeYears == null || hasUserEditedPlantedDate.current) return;
    let cancelled = false;
    const currentLocation = form.getValues('location');
    calculatePlantingDateFromAge({
      ageYears: aiResults.identification.estimatedAgeYears,
      currentDate: new Date(),
      location: currentLocation,
      t,
    }).then((estimatedDate) => {
      if (cancelled) return;
      setAiEstimatedPlantedDate(estimatedDate);
      form.setValue('plantedDate', estimatedDate);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedLocation, aiResults, form]);

  const fetchCareSchedule = useCallback(async () => {
    const location = form.getValues('location');
    if (!location?.trim() || !aiResults?.identification) return;
    const { species, commonName, estimatedAgeYears } = aiResults.identification;
    if (!species && !commonName) return;

    setIsLoadingCareSchedule(true);
    try {
      const res = await fetch('/api/ai/care-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          species,
          commonName,
          estimatedAgeYears,
          location,
          plantType: selectedType,
          language,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? t('plant_new.schedule_failed'));
      }
      const schedule: CareScheduleResult = await res.json();
      setCareSchedule(schedule);

      // Only overwrite the form values if the user has not manually edited them.
      const currentWatering = form.getValues('wateringIntervalDays');
      const currentFertilizing = form.getValues('fertilizingIntervalDays');
      const currentPruning = form.getValues('pruningIntervalDays');
      const isUnchanged =
        lastRecommendedSchedule === null
          ? (currentWatering === 3 && currentFertilizing === 20 && currentPruning === '')
          : (currentWatering === lastRecommendedSchedule.watering && currentFertilizing === lastRecommendedSchedule.fertilizing && currentPruning === (lastRecommendedSchedule.pruning ?? ''));

      if (isUnchanged) {
        form.setValue('wateringIntervalDays', schedule.wateringIntervalDays as any);
        form.setValue('fertilizingIntervalDays', schedule.fertilizingIntervalDays as any);
        if (schedule.pruningIntervalDays != null) {
          form.setValue('pruningIntervalDays', schedule.pruningIntervalDays as any);
        }
        setLastRecommendedSchedule({
          watering: schedule.wateringIntervalDays,
          fertilizing: schedule.fertilizingIntervalDays,
          pruning: schedule.pruningIntervalDays,
        });
      }
    } catch (err) {
      // Silent failure: schedule is a value-add, not required for the form.
      console.error('Care schedule generation failed:', err);
    } finally {
      setIsLoadingCareSchedule(false);
    }
  }, [aiResults, form, lastRecommendedSchedule, selectedType, language]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchCareSchedule();
    }, 800);
    return () => clearTimeout(timeout);
  }, [selectedLocation, selectedSpecies, selectedType, aiResults, fetchCareSchedule]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setIsSaving(true);
    try {
      const payload = {
        name: data.name,
        type: data.type,
        species: data.species || undefined,
        location: data.location || undefined,
        plantedDate: data.plantedDate || undefined,
        healthStatus: data.healthStatus,
        wateringIntervalDays: data.wateringIntervalDays === '' ? undefined : Number(data.wateringIntervalDays) || undefined,
        fertilizingIntervalDays: data.fertilizingIntervalDays === '' ? undefined : Number(data.fertilizingIntervalDays) || undefined,
        pruningIntervalDays: data.pruningIntervalDays === '' ? undefined : Number(data.pruningIntervalDays) || undefined,
        notes: data.notes || undefined,
        photoDataUrl: imageData?.dataUrl,
        imageBase64: undefined as string | undefined,
        mimeType: undefined as string | undefined,
        aiIdentification: aiResults ? JSON.stringify(aiResults.identification) : undefined,
        aiDiseaseDetection: aiResults ? JSON.stringify(aiResults.disease) : undefined,
      };

      const res = await fetch('/api/plants/with-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t('plant_new.save_failed'));
      }

      const plant = await res.json();
      const reminderSuffix = plant.remindersCreated > 0
        ? t(plant.remindersCreated === 1 ? 'plant_new.toast_saved_reminder_one' : 'plant_new.toast_saved_reminder_other', { count: String(plant.remindersCreated) })
        : '';
      toast({
        title: t('plant_new.toast_saved_title'),
        description: `${t('plant_new.toast_saved_desc', { name: plant.name })}${reminderSuffix}.`,
      });
      navigate(`/plants/${plant.id}`);
    } catch (err) {
      toast({
        title: t('plant_new.toast_save_failed_title'),
        description: err instanceof Error ? err.message : t('plant_new.toast_try_again'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const confidenceColor = (c?: string | null) =>
    c === 'high' ? 'bg-green-100 text-green-800' : c === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Link href="/plants" className="w-10 h-10 rounded-full border bg-card flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-bold">{t('plant_new.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('plant_new.subtitle')}</p>
        </div>
      </div>

      {/* ── Step 1: Image Upload ───────────────────────────────────────── */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            {t('plant_new.photo_title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('plant_new.photo_desc')}</p>
        </div>

        <div className="p-6">
          {/* Hidden file inputs */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />

          {!imageData ? (
            /* Upload area */
            <div className="w-full h-52 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-3 p-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <ImagePlus className="w-7 h-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground">{t('plant_new.upload_cta')}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('plant_new.upload_hint')}</p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  variant="outline"
                  className="gap-2"
                  disabled={isAnalyzing}
                >
                  <Upload className="w-4 h-4" /> {t('plant_id.upload_gallery')}
                </Button>
                <Button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="gap-2"
                  disabled={isAnalyzing}
                >
                  <Camera className="w-4 h-4" /> {t('plant_id.take_photo')}
                </Button>
              </div>
            </div>
          ) : (
            /* Image preview */
            <div className="relative bg-muted/50 rounded-xl border border-border overflow-hidden flex items-center justify-center">
              <img
                src={imageData.dataUrl}
                alt={t('plant_new.preview_alt')}
                className="w-full h-full max-h-[320px] sm:max-h-[360px] object-contain rounded-xl"
              />
              <button
                type="button"
                onClick={clearImage}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {t('plant_id.upload_gallery')}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors flex items-center gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" />
                  {t('plant_id.take_photo')}
                </button>
              </div>
            </div>
          )}

          {/* AI Analysis state */}
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
                {/* Identification card */}
                {!aiResults.identification.error && (
                  <div className="rounded-xl border bg-background p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-primary" />
                        {t('plant_new.result_identified')}
                      </h3>
                      {aiResults.identification.confidence && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", confidenceColor(aiResults.identification.confidence))}>
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
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Sun className="w-3 h-3" /> {t('plant_id.sunlight')}</p>
                          <p className="font-medium">{aiResults.identification.sunlight}</p>
                        </div>
                      )}
                      {aiResults.identification.suggestedWateringIntervalDays && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Droplets className="w-3 h-3" /> {t('plant_new.water_every')}</p>
                          <p className="font-medium">{aiResults.identification.suggestedWateringIntervalDays} {t('plant_new.days_suffix')}</p>
                        </div>
                      )}
                      {aiResults.identification.suggestedPruningIntervalDays && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Trees className="w-3 h-3" /> {t('plant_new.prune_every')}</p>
                          <p className="font-medium">{aiResults.identification.suggestedPruningIntervalDays} {t('plant_new.days_suffix')}</p>
                        </div>
                      )}
                      {aiResults.identification.estimatedAgeYears != null && (
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Trees className="w-3 h-3" /> {t('plant_new.estimated_age')}</p>
                          <p className="font-medium">{aiResults.identification.estimatedAgeYears} {t('plant_new.years_old')}</p>
                        </div>
                      )}
                    </div>
                    {aiResults.identification.careRecommendations && (
                      <p className="text-xs text-muted-foreground border-t pt-2">{aiResults.identification.careRecommendations}</p>
                    )}
                  </div>
                )}

                {/* Health card */}
                <div className={cn(
                  "rounded-xl border p-4 flex items-start gap-3",
                  aiResults.disease.isHealthy ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                )}>
                  {aiResults.disease.isHealthy ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn("font-semibold text-sm", aiResults.disease.isHealthy ? "text-green-800" : "text-yellow-800")}>
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

      {/* ── Step 2: Plant Details Form ─────────────────────────────────── */}
      <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="font-serif text-lg font-semibold flex items-center gap-2">
            <Leaf className="w-5 h-5 text-primary" />
            {t('plant_new.details_title')}
            {aiResults && <Badge variant="secondary" className="ms-2 text-xs">{t('plant_new.prefilled_badge')}</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t('plant_new.details_desc')}</p>
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
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => {
                          hasUserEditedPlantedDate.current = true;
                          field.onChange(e);
                        }}
                      />
                    </FormControl>
                    {aiResults?.identification.estimatedAgeYears != null && (
                      <p className="text-xs text-muted-foreground">
                        {t('plant_new.estimated_planting_date', { age: String(aiResults.identification.estimatedAgeYears) })}
                      </p>
                    )}
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
                  <span className="text-xs text-muted-foreground font-normal">{t('plant_new.auto_reminders_hint')}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('plant_new.schedule_desc')}
                </p>
              </div>
              {isLoadingCareSchedule && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {t('plant_new.schedule_loading')}
                </div>
              )}
              {careSchedule?.explanation && !isLoadingCareSchedule && (
                <p className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2">
                  {careSchedule.explanation}
                </p>
              )}
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
                      {careSchedule?.wateringNotes && (
                        <p className="text-xs text-muted-foreground">{careSchedule.wateringNotes}</p>
                      )}
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
                      {careSchedule?.fertilizingNotes && (
                        <p className="text-xs text-muted-foreground">{careSchedule.fertilizingNotes}</p>
                      )}
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
                      {careSchedule?.pruningNotes && (
                        <p className="text-xs text-muted-foreground">{careSchedule.pruningNotes}</p>
                      )}
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
              <Button type="button" variant="outline" onClick={() => navigate('/plants')}>
                {t('plant_new.cancel')}
              </Button>
              <Button type="submit" disabled={isSaving || isAnalyzing} className="min-w-[130px]">
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 me-2 animate-spin" /> {t('plant_new.saving')}</>
                ) : (
                  <><Leaf className="w-4 h-4 me-2" /> {t('plant_new.save')}</>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
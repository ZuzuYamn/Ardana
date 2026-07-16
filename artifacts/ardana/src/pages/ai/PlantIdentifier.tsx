import React, { useState, useRef, useCallback } from 'react';
import { useIdentifyPlant } from '@workspace/api-client-react';
import { Camera, Upload, ImagePlus, AlertCircle, Info, Leaf, Droplet, Sun, Sprout, Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/contexts/LanguageContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function compressImage(file: File, maxPx = 1024): Promise<{ base64: string; mimeType: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const { width, height } = img;
      const scale = Math.min(1, maxPx / Math.max(width, height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl: dataUrl });
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')); };
    img.src = objectUrl;
  });
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ confidence, t }: { confidence: string; t: (key: string) => string }) {
  const map: Record<string, { labelKey: string; className: string }> = {
    high: { labelKey: 'plant_id.confidence_high', className: 'bg-green-100 text-green-700 border-green-200' },
    medium: { labelKey: 'plant_id.confidence_medium', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    low: { labelKey: 'plant_id.confidence_low', className: 'bg-red-100 text-red-700 border-red-200' },
  };
  const val = map[confidence?.toLowerCase()] ?? map.medium;
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${val.className}`}>
      {t(val.labelKey)}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlantIdentifier() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const identifyMutation = useIdentifyPlant();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setSelectedImage(null);
    identifyMutation.reset();
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: t('plant_id.invalid_file_title'), description: t('plant_id.invalid_file_desc'), variant: 'destructive' });
      return;
    }
    try {
      const { base64, mimeType, previewUrl } = await compressImage(file);
      setSelectedImage(previewUrl);
      identifyMutation.mutate({ data: { imageBase64: base64, mimeType } });
    } catch {
      toast({ title: t('plant_id.image_error_title'), description: t('plant_id.image_error_desc'), variant: 'destructive' });
    }
  }, [identifyMutation, toast, t]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const result = identifyMutation.data;
  const isAnalyzing = identifyMutation.isPending;
  const error = identifyMutation.error as Error | null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">{t('plant_id.title')}</h1>
        <p className="text-muted-foreground text-lg">
          {t('plant_id.subtitle')}
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-3xl overflow-hidden transition-all duration-300 ${
          isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-card'
        } ${selectedImage ? 'h-auto' : 'min-h-[280px] flex items-center justify-center'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {/* Hidden inputs */}
        <input
          type="file"
          ref={galleryInputRef}
          className="hidden"
          accept="image/*"
          onChange={(e) => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }}
        />
        <input
          type="file"
          ref={cameraInputRef}
          className="hidden"
          accept="image/*"
          capture="environment"
          onChange={(e) => { if (e.target.files?.[0]) { handleFile(e.target.files[0]); e.target.value = ''; } }}
        />

        {selectedImage ? (
          <div className="relative">
            <img src={selectedImage} alt={t('plant_id.selected_alt')} className="w-full max-h-[480px] object-cover" />
            {!isAnalyzing && (
              <Button
                variant="secondary"
                className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70 backdrop-blur-md gap-2"
                onClick={(e) => { e.stopPropagation(); reset(); }}
              >
                <RefreshCw className="w-4 h-4" /> {t('plant_id.scan_another')}
              </Button>
            )}
          </div>
        ) : (
          <div className="p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Leaf className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('plant_id.drop_text')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('plant_id.drop_sub')}</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                onClick={() => galleryInputRef.current?.click()}
                variant="outline"
                className="gap-2"
                disabled={isAnalyzing}
              >
                <Upload className="w-4 h-4" /> {t('plant_id.upload_gallery')}
              </Button>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="gap-2"
                disabled={isAnalyzing}
              >
                <Camera className="w-4 h-4" /> {t('plant_id.take_photo')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons when image is selected but not analyzing */}
      {selectedImage && !isAnalyzing && !result && !error && (
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => galleryInputRef.current?.click()} className="gap-2">
            <ImagePlus className="w-4 h-4" /> {t('plant_id.choose_different')}
          </Button>
          <Button onClick={() => cameraInputRef.current?.click()} className="gap-2">
            <Camera className="w-4 h-4" /> {t('plant_id.take_new_photo')}
          </Button>
        </div>
      )}

      {/* Loading state */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3 py-8"
          >
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">{t('plant_id.analyzing')}</p>
            <p className="text-xs text-muted-foreground/60">{t('plant_id.analyzing_sub')}</p>
          </motion.div>
        )}

        {/* Error state */}
        {error && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-destructive">{t('plant_id.failed')}</p>
              <p className="text-sm text-destructive/80">{error.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { if (selectedImage) identifyMutation.retry?.(); }}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('plant_id.try_again')}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {result && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="space-y-6"
          >
            {/* Identity header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 bg-card rounded-2xl border shadow-sm">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground">
                  {result.commonName ?? result.species ?? t('plant_id.unknown_plant')}
                </h2>
                {result.species && result.commonName && (
                  <p className="text-muted-foreground text-sm italic mt-0.5">{result.species}</p>
                )}
                {result.family && (
                  <p className="text-xs text-muted-foreground mt-1">{t('plant_id.family_label')} <span className="font-medium">{result.family}</span></p>
                )}
              </div>
              <ConfidenceBadge confidence={result.confidence ?? 'medium'} t={t} />
            </div>

            {/* Care cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="shadow-sm border-border">
                <CardContent className="p-5">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                    <Droplet className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-serif font-bold text-base mb-1.5">{t('plant_id.watering')}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{result.wateringRequirements}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border">
                <CardContent className="p-5">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                    <Sun className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="font-serif font-bold text-base mb-1.5">{t('plant_id.sunlight')}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{result.sunlight}</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border">
                <CardContent className="p-5">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-3">
                    <Sprout className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-serif font-bold text-base mb-1.5">{t('plant_id.soil_fertilizer')}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-1.5">
                    <strong>{t('plant_id.soil')}</strong> {result.soilType}
                  </p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    <strong>{t('plant_id.feed')}</strong> {result.fertilizers}
                  </p>
                </CardContent>
              </Card>
            </div>

            {result.description && (
              <Card className="shadow-sm border-border">
                <CardContent className="p-5">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-serif font-bold text-base mb-1.5">{t('plant_id.about')}</h3>
                      <p className="text-foreground/80 leading-relaxed text-sm">{result.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {result.careRecommendations && (
              <Card className="shadow-sm border-border bg-muted/20">
                <CardContent className="p-5">
                  <h3 className="font-serif font-bold text-base mb-2">{t('plant_id.care_advice')}</h3>
                  <p className="text-foreground/80 leading-relaxed text-sm">{result.careRecommendations}</p>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={reset} className="gap-2">
                <RefreshCw className="w-4 h-4" /> {t('plant_id.identify_another')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import React, { useState, useRef, useCallback } from 'react';
import { useDetectDisease } from '@workspace/api-client-react';
import { Stethoscope, Camera, Upload, AlertTriangle, CheckCircle2, ShieldCheck, Thermometer, Loader2, Pill, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

// ─── Urgency badge ─────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency, t }: { urgency: string; t: (key: string) => string }) {
  const map: Record<string, { labelKey: string; className: string; icon: React.ReactNode }> = {
    immediate: {
      labelKey: 'disease.urgency_immediate',
      className: 'bg-red-100 text-red-700 border-red-200',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    soon: {
      labelKey: 'disease.urgency_soon',
      className: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: <Thermometer className="w-3.5 h-3.5" />,
    },
    low: {
      labelKey: 'disease.urgency_low',
      className: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    none: {
      labelKey: 'disease.urgency_none',
      className: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
  };
  const val = map[urgency?.toLowerCase()] ?? map.low;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${val.className}`}>
      {val.icon} {t(val.labelKey)}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DiseaseDetector() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const detectMutation = useDetectDisease();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setSelectedImage(null);
    detectMutation.reset();
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: t('disease.invalid_file_title'), description: t('disease.invalid_file_desc'), variant: 'destructive' });
      return;
    }
    try {
      const { base64, mimeType, previewUrl } = await compressImage(file);
      setSelectedImage(previewUrl);
      detectMutation.mutate({ data: { imageBase64: base64, mimeType } });
    } catch {
      toast({ title: t('disease.image_error_title'), description: t('disease.image_error_desc'), variant: 'destructive' });
    }
  }, [detectMutation, toast, t]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const result = detectMutation.data;
  const isAnalyzing = detectMutation.isPending;
  const error = detectMutation.error as Error | null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto">
          <Stethoscope className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">{t('disease.title')}</h1>
        <p className="text-muted-foreground text-lg">
          {t('disease.subtitle')}
        </p>
      </div>

      {/* Upload area */}
      <div
        className={`relative border-2 border-dashed rounded-3xl overflow-hidden transition-all duration-300 ${
          isDragging ? 'border-destructive bg-destructive/5 scale-[1.01]' : 'border-border bg-card'
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
          <div className="p-6 sm:p-8 flex flex-col items-center">
            <div className="relative w-full max-w-md mx-auto rounded-xl overflow-hidden bg-muted border border-border shadow-sm">
              <img
                src={selectedImage}
                alt={t('disease.selected_alt')}
                className="w-full h-full max-h-[320px] sm:max-h-[360px] object-contain"
              />
            </div>
          </div>
        ) : (
          <div className="p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Stethoscope className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('disease.drop_text')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('disease.drop_sub')}</p>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button
                onClick={() => galleryInputRef.current?.click()}
                variant="outline"
                className="gap-2"
                disabled={isAnalyzing}
              >
                <Upload className="w-4 h-4" /> {t('disease.upload_gallery')}
              </Button>
              <Button
                onClick={() => cameraInputRef.current?.click()}
                className="gap-2 bg-destructive hover:bg-destructive/90"
                disabled={isAnalyzing}
              >
                <Camera className="w-4 h-4" /> {t('disease.take_photo')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons when image is selected but not analyzing */}
      {selectedImage && !isAnalyzing && !result && !error && (
        <div className="flex flex-wrap gap-3 justify-center">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="w-4 h-4" /> {t('disease.scan_another')}
          </Button>
          <Button variant="outline" onClick={() => galleryInputRef.current?.click()} className="gap-2">
            <Upload className="w-4 h-4" /> {t('disease.upload_gallery')}
          </Button>
          <Button onClick={() => cameraInputRef.current?.click()} className="gap-2 bg-destructive hover:bg-destructive/90">
            <Camera className="w-4 h-4" /> {t('disease.take_photo')}
          </Button>
        </div>
      )}

      {/* Loading */}
      <AnimatePresence>
        {isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-3 py-8"
          >
            <Loader2 className="w-10 h-10 text-destructive animate-spin" />
            <p className="text-muted-foreground font-medium">{t('disease.analyzing')}</p>
            <p className="text-xs text-muted-foreground/60">{t('disease.analyzing_sub')}</p>
          </motion.div>
        )}

        {/* Error */}
        {error && !isAnalyzing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20"
          >
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-destructive">{t('disease.failed')}</p>
              <p className="text-sm text-destructive/80">{error.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={reset}
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('disease.try_again')}
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
            {/* Status header */}
            <div
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5 rounded-2xl border shadow-sm ${
                result.isHealthy
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                {result.isHealthy ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-8 h-8 text-red-600 shrink-0" />
                )}
                <div>
                  <h2 className={`text-xl font-serif font-bold ${result.isHealthy ? 'text-green-800' : 'text-red-800'}`}>
                    {result.isHealthy ? t('disease.healthy_title') : (result.diseaseName ?? t('disease.disease_detected'))}
                  </h2>
                  {result.description && (
                    <p className={`text-sm mt-0.5 ${result.isHealthy ? 'text-green-700' : 'text-red-700'}`}>
                      {result.description}
                    </p>
                  )}
                </div>
              </div>
              {result.urgency && <UrgencyBadge urgency={result.urgency} t={t} />}
            </div>

            {/* Details */}
            {!result.isHealthy && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Symptoms & Causes */}
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="font-serif flex items-center gap-2 text-base">
                      <Thermometer className="w-4 h-4 text-amber-500" /> {t('disease.symptoms_causes')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    {result.symptoms && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-1">{t('disease.look_for')}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.symptoms}</p>
                      </div>
                    )}
                    {result.causes && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-1">{t('disease.common_causes')}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.causes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Treatment */}
                <Card className="shadow-sm border-border">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="font-serif flex items-center gap-2 text-base">
                      <Pill className="w-4 h-4 text-blue-500" /> {t('disease.treatment')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-3">
                    {result.treatments && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-1">{t('disease.treatment_actions')}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.treatments}</p>
                      </div>
                    )}
                    {result.products && (
                      <div>
                        <h4 className="font-semibold text-sm text-foreground mb-1">{t('disease.recommended_products')}</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.products}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Prevention */}
                <Card className="col-span-1 md:col-span-2 shadow-sm border-border">
                  <CardHeader className="pb-3 border-b bg-muted/20">
                    <CardTitle className="font-serif flex items-center gap-2 text-base">
                      <ShieldCheck className="w-4 h-4 text-green-500" /> {t('disease.prevention')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <p className="text-foreground/80 leading-relaxed text-sm">{result.preventiveMeasures}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {result.isHealthy && result.description && (
              <Card className="shadow-sm border-green-200 bg-green-50/50">
                <CardContent className="p-5">
                  <div className="flex gap-3">
                    <ShieldCheck className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-serif font-bold text-base mb-1.5 text-green-800">{t('disease.preventive_care')}</h3>
                      <p className="text-green-700 text-sm leading-relaxed">{result.preventiveMeasures}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={reset} className="gap-2">
                <RefreshCw className="w-4 h-4" /> {t('disease.check_another')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
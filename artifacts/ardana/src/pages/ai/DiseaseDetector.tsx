import React, { useState, useRef } from 'react';
import { useDetectDisease } from '@workspace/api-client-react';
import { Stethoscope, Upload, AlertTriangle, CheckCircle2, ShieldCheck, Thermometer, Loader2, Pill } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function DiseaseDetector() {
  const { toast } = useToast();
  const detectMutation = useDetectDisease();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedImage(objectUrl);

    try {
      const base64 = await toBase64(file);
      detectMutation.mutate({ 
        data: { imageBase64: base64, mimeType: file.type } 
      });
    } catch (err) {
      toast({ title: "Error reading file", description: "Could not process the image.", variant: "destructive" });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const result = detectMutation.data;
  const isAnalyzing = detectMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <Stethoscope className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">Disease Detector</h1>
        <p className="text-muted-foreground text-lg">
          Upload a clear photo of the affected leaf or stem. We'll identify the disease and recommend treatments.
        </p>
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-3xl overflow-hidden transition-all duration-300 ${
          isDragging ? 'border-destructive bg-destructive/5 scale-[1.02]' : 'border-border bg-card'
        } ${selectedImage ? 'h-auto' : 'h-[300px] flex items-center justify-center'}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !selectedImage && !isAnalyzing && fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        
        {selectedImage ? (
          <div className="relative">
            <img src={selectedImage} alt="Selected leaf" className="w-full max-h-[500px] object-cover" />
            {!isAnalyzing && (
              <Button 
                variant="secondary" 
                className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
                onClick={(e) => { e.stopPropagation(); setSelectedImage(null); detectMutation.reset(); }}
              >
                Scan Another
              </Button>
            )}
            
            <AnimatePresence>
              {isAnalyzing && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white"
                >
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-destructive" />
                  <h3 className="text-xl font-serif font-bold">Scanning for pathogens...</h3>
                  <p className="text-white/70 mt-2">Analyzing spots, discoloration, and patterns</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center p-8 cursor-pointer">
            <Upload className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Upload leaf photo</h3>
            <p className="text-muted-foreground text-sm">Close-ups work best. JPG, PNG or WEBP (Max 5MB)</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {result && !isAnalyzing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {result.error ? (
              <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-2xl flex gap-4 text-destructive">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-1">Analysis Failed</h3>
                  <p>{result.error}</p>
                </div>
              </div>
            ) : result.isHealthy ? (
              <div className="p-8 bg-green-500/10 border border-green-500/20 rounded-3xl flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-3xl font-serif font-bold text-green-700 dark:text-green-400 mb-2">Plant Looks Healthy!</h2>
                <p className="text-green-800/80 dark:text-green-300 max-w-lg">
                  We didn't detect any common diseases or pest infestations in this image. Keep up the good work!
                </p>
                <div className="mt-6 px-4 py-2 bg-green-500/20 rounded-full text-green-800 dark:text-green-300 font-medium text-sm">
                  Confidence: {result.confidence}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <Card className="border-destructive/30 bg-destructive/5 shadow-none overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-2 h-full bg-destructive"></div>
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-3 py-1 bg-destructive/20 text-destructive rounded-full text-sm font-bold uppercase tracking-wider">
                            Disease Detected
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">{result.confidence} Match</span>
                        </div>
                        <h2 className="text-3xl font-serif font-bold text-foreground mb-2">{result.diseaseName}</h2>
                        <div className="flex items-center gap-2 text-destructive font-medium">
                          <AlertTriangle className="w-4 h-4" />
                          Urgency: {result.urgency}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-foreground/80 leading-relaxed text-lg">{result.description}</p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="shadow-sm border-border">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                      <CardTitle className="font-serif flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-amber-500" /> Symptoms & Causes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">What to look for:</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.symptoms}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">Common Causes:</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.causes}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-sm border-border">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                      <CardTitle className="font-serif flex items-center gap-2">
                        <Pill className="w-5 h-5 text-blue-500" /> Treatment Plan
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div>
                        <h4 className="font-semibold text-foreground mb-1">Actions to take:</h4>
                        <p className="text-muted-foreground text-sm leading-relaxed">{result.treatments}</p>
                      </div>
                      {result.products && (
                        <div>
                          <h4 className="font-semibold text-foreground mb-1">Recommended Products:</h4>
                          <p className="text-muted-foreground text-sm leading-relaxed">{result.products}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="col-span-1 md:col-span-2 shadow-sm border-border">
                    <CardHeader className="pb-3 border-b bg-muted/20">
                      <CardTitle className="font-serif flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-green-500" /> Prevention
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                      <p className="text-foreground/80 leading-relaxed">{result.preventiveMeasures}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

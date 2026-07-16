import React, { useState, useRef } from 'react';
import { useIdentifyPlant } from '@workspace/api-client-react';
import { Camera, Upload, AlertCircle, Info, Leaf, Droplet, Sun, Sprout, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function PlantIdentifier() {
  const { toast } = useToast();
  const identifyMutation = useIdentifyPlant();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }

    // Preview
    const objectUrl = URL.createObjectURL(file);
    setSelectedImage(objectUrl);

    try {
      const base64 = await toBase64(file);
      identifyMutation.mutate({ 
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

  const result = identifyMutation.data;
  const isAnalyzing = identifyMutation.isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
          <Camera className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground tracking-tight">Plant Identifier</h1>
        <p className="text-muted-foreground text-lg">
          Upload a photo of any plant, leaf, or flower. Our AI will identify the species and provide care instructions.
        </p>
      </div>

      <div 
        className={`relative border-2 border-dashed rounded-3xl overflow-hidden transition-all duration-300 ${
          isDragging ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-border bg-card'
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
            <img src={selectedImage} alt="Selected" className="w-full max-h-[500px] object-cover" />
            {!isAnalyzing && (
              <Button 
                variant="secondary" 
                className="absolute top-4 right-4 bg-black/50 text-white hover:bg-black/70 backdrop-blur-md"
                onClick={(e) => { e.stopPropagation(); setSelectedImage(null); identifyMutation.reset(); }}
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
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                  <h3 className="text-xl font-serif font-bold">Analyzing Plant...</h3>
                  <p className="text-white/70 mt-2">Checking encyclopedias and referencing species</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center p-8 cursor-pointer">
            <Upload className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">Click to upload or drag and drop</h3>
            <p className="text-muted-foreground text-sm">JPG, PNG or WEBP (Max 5MB)</p>
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
                <AlertCircle className="w-6 h-6 shrink-0" />
                <div>
                  <h3 className="font-bold text-lg mb-1">Identification Failed</h3>
                  <p>{result.error}</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-1 md:col-span-3 border-none bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground shadow-lg overflow-hidden relative">
                  <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
                    <Leaf className="w-64 h-64 -mt-10 -mr-10" />
                  </div>
                  <CardContent className="p-8 relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                      <div>
                        <div className="inline-flex px-3 py-1 bg-white/10 rounded-full text-sm font-medium mb-4 backdrop-blur-md">
                          {result.confidence} Match
                        </div>
                        <h2 className="text-4xl font-serif font-bold mb-2 text-white">{result.commonName || 'Unknown Plant'}</h2>
                        <p className="text-xl text-white/80 italic">{result.species} • {result.family}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                      <Droplet className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">Watering</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{result.wateringRequirements}</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <Sun className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">Sunlight</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{result.sunlight}</p>
                  </CardContent>
                </Card>

                <Card className="shadow-sm border-border">
                  <CardContent className="p-6">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mb-4">
                      <Sprout className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-serif font-bold text-lg mb-2">Soil & Fertilizer</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-2"><strong>Soil:</strong> {result.soilType}</p>
                    <p className="text-muted-foreground text-sm leading-relaxed"><strong>Feed:</strong> {result.fertilizers}</p>
                  </CardContent>
                </Card>

                {result.description && (
                  <Card className="col-span-1 md:col-span-3 shadow-sm border-border">
                    <CardContent className="p-6">
                      <div className="flex gap-4">
                        <Info className="w-6 h-6 text-primary shrink-0" />
                        <div>
                          <h3 className="font-serif font-bold text-lg mb-2">About</h3>
                          <p className="text-foreground/80 leading-relaxed">{result.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {result.careRecommendations && (
                  <Card className="col-span-1 md:col-span-3 shadow-sm border-border bg-muted/30">
                    <CardContent className="p-6">
                      <h3 className="font-serif font-bold text-lg mb-3">General Care Advice</h3>
                      <p className="text-foreground/80 leading-relaxed">{result.careRecommendations}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React from 'react';
import { Info, Leaf, Globe, Code, Heart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-12">
      <div className="text-center py-12 px-4 rounded-3xl bg-gradient-to-b from-sidebar to-sidebar-accent text-sidebar-foreground relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 pointer-events-none">
          <Leaf className="w-96 h-96 -mt-20 -mr-20" />
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4 text-white tracking-tight">Our Land. Our Heritage.</h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto leading-relaxed">
            "Ardana" means "Our Land" in Arabic. This app was built to bridge the gap between traditional farming wisdom and modern technology.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-serif font-bold mb-4 text-foreground flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" /> The Mission
          </h2>
          <p className="text-foreground/80 leading-relaxed mb-4 text-lg">
            Farming in the Middle East and Mediterranean faces unique challenges: changing climates, water scarcity, and the loss of generational knowledge. 
          </p>
          <p className="text-foreground/80 leading-relaxed text-lg">
            Ardana provides an accessible, culturally-aware tool to help farmers and home growers manage their crops more efficiently, identify diseases early, and adapt to local weather patterns.
          </p>
        </div>
        
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-8">
            <h3 className="font-serif font-bold text-xl mb-6 border-b pb-4">Technology Stack</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <Code className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Frontend</span>
                  <span className="text-sm text-muted-foreground">React, Tailwind CSS, Framer Motion, Radix UI</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Globe className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Localization</span>
                  <span className="text-sm text-muted-foreground">Full RTL support, multi-language context architecture</span>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Leaf className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">AI Integration</span>
                  <span className="text-sm text-muted-foreground">Vision models for plant species and disease identification</span>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="border-t pt-12 text-center">
        <p className="text-muted-foreground mb-2">Built with care for the Replit AI Agent.</p>
        <p className="text-sm font-medium text-foreground">v1.0.0 • Open Source Initiative</p>
      </div>
    </div>
  );
}

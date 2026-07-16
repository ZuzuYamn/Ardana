import React from 'react';
import { useLanguage } from '@/lib/contexts/LanguageContext';
import { useAccessibility } from '@/lib/contexts/AccessibilityContext';
import { Settings as SettingsIcon, Globe, Type, Eye, Bell, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Settings() {
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { fontSize, setFontSize, highContrast, setHighContrast } = useAccessibility();

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          {t('nav.settings')}
        </h1>
        <p className="text-muted-foreground mt-1">Manage your preferences and app experience.</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Globe className="w-5 h-5 text-primary" /> Language & Region
            </CardTitle>
            <CardDescription>Choose your preferred language for the interface.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { id: 'en', label: 'English', native: 'English' },
                { id: 'ar', label: 'Arabic', native: 'العربية' },
                { id: 'fr', label: 'French', native: 'Français' },
                { id: 'es', label: 'Spanish', native: 'Español' },
                { id: 'pt', label: 'Portuguese', native: 'Português' },
              ].map((lang) => (
                <div 
                  key={lang.id}
                  onClick={() => setLanguage(lang.id as any)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    language === lang.id 
                      ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                      : 'hover:border-primary/50 hover:bg-muted'
                  }`}
                >
                  <p className="font-semibold text-foreground">{lang.native}</p>
                  <p className="text-sm text-muted-foreground">{lang.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Eye className="w-5 h-5 text-primary" /> Accessibility
            </CardTitle>
            <CardDescription>Customize the display for better readability.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base flex items-center gap-2">
                <Type className="w-4 h-4" /> Text Size
              </Label>
              <RadioGroup 
                defaultValue={fontSize} 
                onValueChange={(val) => setFontSize(val as any)}
                className="flex flex-col space-y-2"
              >
                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                  <RadioGroupItem value="normal" id="fs-normal" />
                  <Label htmlFor="fs-normal" className="flex-1 cursor-pointer">Normal (Default)</Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                  <RadioGroupItem value="large" id="fs-large" />
                  <Label htmlFor="fs-large" className="flex-1 cursor-pointer text-lg">Large</Label>
                </div>
                <div className="flex items-center space-x-3 p-3 rounded-lg border bg-card">
                  <RadioGroupItem value="xl" id="fs-xl" />
                  <Label htmlFor="fs-xl" className="flex-1 cursor-pointer text-xl">Extra Large</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">High Contrast Mode</Label>
                <p className="text-sm text-muted-foreground">Increase contrast between text and background</p>
              </div>
              <Switch 
                checked={highContrast} 
                onCheckedChange={setHighContrast} 
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Bell className="w-5 h-5 text-primary" /> Notifications
            </CardTitle>
            <CardDescription>Manage how Ardana alerts you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">Weather Alerts</Label>
                <p className="text-sm text-muted-foreground">Get notified about frost, extreme heat, or heavy rain</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">Task Reminders</Label>
                <p className="text-sm text-muted-foreground">Daily summary of upcoming watering and care tasks</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

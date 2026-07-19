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
    <div className="max-w-3xl mx-auto space-y-8 pb-12" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-primary" />
          {t('nav.settings')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Globe className="w-5 h-5 text-primary" /> {t('settings.language_title')}
            </CardTitle>
            <CardDescription>{t('settings.language_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { id: 'en', label: t('settings.lang_en'), native: 'English' },
                { id: 'ar', label: t('settings.lang_ar'), native: 'العربية' },
                { id: 'fr', label: t('settings.lang_fr'), native: 'Français' },
                { id: 'es', label: t('settings.lang_es'), native: 'Español' },
                { id: 'pt', label: t('settings.lang_pt'), native: 'Português' },
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
              <Eye className="w-5 h-5 text-primary" /> {t('settings.accessibility_title')}
            </CardTitle>
            <CardDescription>{t('settings.accessibility_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base flex items-center gap-2">
                <Type className="w-4 h-4" /> {t('settings.text_size')}
              </Label>
              <RadioGroup
                defaultValue={fontSize}
                onValueChange={(val) => setFontSize(val as any)}
                className="flex flex-col space-y-2"
                dir={isRTL ? 'rtl' : 'ltr'}
              >
                <div className="flex items-center justify-start gap-3 p-3 rounded-lg border bg-card" dir={isRTL ? 'rtl' : 'ltr'}>
                  <RadioGroupItem value="normal" id="fs-normal" />
                  <Label htmlFor="fs-normal" className="flex-1 cursor-pointer text-start">{t('settings.normal')}</Label>
                </div>
                <div className="flex items-center justify-start gap-3 p-3 rounded-lg border bg-card" dir={isRTL ? 'rtl' : 'ltr'}>
                  <RadioGroupItem value="large" id="fs-large" />
                  <Label htmlFor="fs-large" className="flex-1 cursor-pointer text-lg text-start">{t('settings.large')}</Label>
                </div>
                <div className="flex items-center justify-start gap-3 p-3 rounded-lg border bg-card" dir={isRTL ? 'rtl' : 'ltr'}>
                  <RadioGroupItem value="xl" id="fs-xl" />
                  <Label htmlFor="fs-xl" className="flex-1 cursor-pointer text-xl text-start">{t('settings.xl')}</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border bg-card gap-4">
              <div className="space-y-0.5">
                <Label className="text-base text-start">{t('settings.high_contrast')}</Label>
                <p className="text-sm text-muted-foreground text-start">{t('settings.high_contrast_desc')}</p>
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
              <Bell className="w-5 h-5 text-primary" /> {t('settings.notifications_title')}
            </CardTitle>
            <CardDescription>{t('settings.notifications_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card gap-4">
              <div className="space-y-0.5">
                <Label className="text-base text-start">{t('settings.weather_alerts')}</Label>
                <p className="text-sm text-muted-foreground text-start">{t('settings.weather_alerts_desc')}</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl border bg-card gap-4">
              <div className="space-y-0.5">
                <Label className="text-base text-start">{t('settings.task_reminders')}</Label>
                <p className="text-sm text-muted-foreground text-start">{t('settings.task_reminders_desc')}</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
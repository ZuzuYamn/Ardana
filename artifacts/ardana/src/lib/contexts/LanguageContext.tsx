import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'ar' | 'fr' | 'es' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.my_farm': 'My Farm',
    'nav.reminders': 'Reminders',
    'nav.weather': 'Weather',
    'nav.ai_identify': 'Identify Plant',
    'nav.ai_disease': 'Detect Disease',
    'nav.settings': 'Settings',
    'nav.help': 'Help',
    'nav.about': 'About',
    'dashboard.welcome': 'Welcome back to Ardana',
    'dashboard.subtitle': 'Your land is thriving.',
  },
  ar: {
    'nav.dashboard': 'لوحة القيادة',
    'nav.my_farm': 'مزرعتي',
    'nav.reminders': 'التذكيرات',
    'nav.weather': 'الطقس',
    'nav.ai_identify': 'التعرف على النبات',
    'nav.ai_disease': 'اكتشاف الأمراض',
    'nav.settings': 'الإعدادات',
    'nav.help': 'مساعدة',
    'nav.about': 'حول',
    'dashboard.welcome': 'مرحباً بعودتك إلى أرضنا',
    'dashboard.subtitle': 'أرضك تزدهر.',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.my_farm': 'Ma Ferme',
    'nav.reminders': 'Rappels',
    'nav.weather': 'Météo',
    'nav.ai_identify': 'Identifier Plante',
    'nav.ai_disease': 'Détecter Maladie',
    'nav.settings': 'Paramètres',
    'nav.help': 'Aide',
    'nav.about': 'À propos',
    'dashboard.welcome': 'Bon retour sur Ardana',
    'dashboard.subtitle': 'Votre terre prospère.',
  },
  es: {
    'nav.dashboard': 'Panel',
    'nav.my_farm': 'Mi Granja',
    'nav.reminders': 'Recordatorios',
    'nav.weather': 'Clima',
    'nav.ai_identify': 'Identificar Planta',
    'nav.ai_disease': 'Detectar Enfermedad',
    'nav.settings': 'Ajustes',
    'nav.help': 'Ayuda',
    'nav.about': 'Acerca de',
    'dashboard.welcome': 'Bienvenido a Ardana',
    'dashboard.subtitle': 'Tu tierra está prosperando.',
  },
  pt: {
    'nav.dashboard': 'Painel',
    'nav.my_farm': 'Minha Fazenda',
    'nav.reminders': 'Lembretes',
    'nav.weather': 'Clima',
    'nav.ai_identify': 'Identificar Planta',
    'nav.ai_disease': 'Detectar Doença',
    'nav.settings': 'Configurações',
    'nav.help': 'Ajuda',
    'nav.about': 'Sobre',
    'dashboard.welcome': 'Bem-vindo ao Ardana',
    'dashboard.subtitle': 'Sua terra está prosperando.',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ardana-language');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('ardana-language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL: language === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

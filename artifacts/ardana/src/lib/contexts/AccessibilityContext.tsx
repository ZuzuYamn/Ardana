import React, { createContext, useContext, useEffect, useState } from 'react';

type FontSize = 'normal' | 'large' | 'xl';

interface AccessibilityContextType {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (localStorage.getItem('ardana-font-size') as FontSize) || 'normal';
  });
  
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    return localStorage.getItem('ardana-high-contrast') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('ardana-font-size', fontSize);
    
    // Remove old classes
    document.documentElement.classList.remove('a11y-text-normal', 'a11y-text-large', 'a11y-text-xl');
    document.documentElement.classList.add(`a11y-text-${fontSize}`);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('ardana-high-contrast', String(highContrast));
    
    if (highContrast) {
      document.documentElement.classList.add('a11y-high-contrast');
    } else {
      document.documentElement.classList.remove('a11y-high-contrast');
    }
  }, [highContrast]);

  return (
    <AccessibilityContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within a AccessibilityProvider');
  }
  return context;
};

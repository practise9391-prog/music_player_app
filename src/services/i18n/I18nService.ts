import React, { createContext, useContext, useState, useEffect } from 'react';
import { SupportedLanguage, TRANSLATIONS } from './translations';
import { useSettings } from '../../settings/SettingsContext';

export class I18nService {
  private static instance: I18nService | null = null;
  private currentLanguage: SupportedLanguage = 'en';
  private listeners = new Set<() => void>();

  public static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  public setLanguage(lang: SupportedLanguage): void {
    if (this.currentLanguage !== lang) {
      this.currentLanguage = lang;
      this.notify();
    }
  }

  public getLanguage(): SupportedLanguage {
    return this.currentLanguage;
  }

  public translate(key: string, params?: Record<string, string | number>): string {
    const langDict = TRANSLATIONS[this.currentLanguage] || TRANSLATIONS.en;
    let text = langDict[key] || TRANSLATIONS.en[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }

    return text;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('I18nService listener error:', err);
      }
    });
  }
}

export const i18nService = I18nService.getInstance();

export interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useSettings();
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(settings.language || 'en');

  useEffect(() => {
    if (settings.language && settings.language !== currentLang) {
      setCurrentLang(settings.language);
      i18nService.setLanguage(settings.language);
    }
  }, [settings.language]);

  const handleSetLanguage = (lang: SupportedLanguage) => {
    setCurrentLang(lang);
    i18nService.setLanguage(lang);
    updateSettings({ language: lang });
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    return i18nService.translate(key, params);
  };

  return React.createElement(
    I18nContext.Provider,
    { value: { language: currentLang, setLanguage: handleSetLanguage, t } },
    children
  );
};

export const useTranslation = (): I18nContextType => useContext(I18nContext);


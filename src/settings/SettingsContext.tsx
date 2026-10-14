import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { SettingsRepository } from '../database/repository';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  resetSettings: () => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const stored = await SettingsRepository.getSettings();
        setSettings(stored);
        NetworkAccessManager.setLock(stored.networkLocked);
        NetworkAccessManager.setAskBeforeAccess(stored.askBeforeOnlineAccess);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);

    if (partial.networkLocked !== undefined) {
      NetworkAccessManager.setLock(partial.networkLocked);
    }
    if (partial.askBeforeOnlineAccess !== undefined) {
      NetworkAccessManager.setAskBeforeAccess(partial.askBeforeOnlineAccess);
    }

    await SettingsRepository.saveSettings(updated);
  };

  const resetSettings = async () => {
    setSettings(DEFAULT_SETTINGS);
    NetworkAccessManager.setLock(DEFAULT_SETTINGS.networkLocked);
    await SettingsRepository.saveSettings(DEFAULT_SETTINGS);
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        isLoading,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

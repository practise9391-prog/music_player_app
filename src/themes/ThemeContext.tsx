import React, { createContext, useContext, useEffect, useState } from 'react';
import { BuiltinPreset, ButtonCustomization, ThemeConfig, ThemeMode } from '../types';
import { themeEngine } from './ThemeEngine';

interface ThemeContextType {
  theme: ThemeConfig;
  setPreset: (preset: BuiltinPreset) => void;
  setMode: (mode: ThemeMode) => void;
  setAccentColor: (hex: string) => void;
  updateColors: (colors: Partial<ThemeConfig['colors']>) => void;
  updateButton: (button: Partial<ButtonCustomization>) => void;
  setGlassEffect: (enabled: boolean) => void;
  setBorderRadius: (radius: string) => void;
  setDensity: (density: 'compact' | 'comfortable' | 'spacious') => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeConfig>(themeEngine.getTheme());

  useEffect(() => {
    themeEngine.applyTheme(theme);
  }, [theme]);

  const setPreset = (preset: BuiltinPreset) => {
    themeEngine.setPreset(preset);
    setTheme({ ...themeEngine.getTheme() });
  };

  const setMode = (mode: ThemeMode) => {
    themeEngine.setMode(mode);
    setTheme({ ...themeEngine.getTheme() });
  };

  const setAccentColor = (hex: string) => {
    themeEngine.setAccentColor(hex);
    setTheme({ ...themeEngine.getTheme() });
  };

  const updateColors = (colors: Partial<ThemeConfig['colors']>) => {
    themeEngine.updateColors(colors);
    setTheme({ ...themeEngine.getTheme() });
  };

  const updateButton = (button: Partial<ButtonCustomization>) => {
    themeEngine.updateButtonCustomization(button);
    setTheme({ ...themeEngine.getTheme() });
  };

  const setGlassEffect = (enabled: boolean) => {
    themeEngine.setGlassEffect(enabled);
    setTheme({ ...themeEngine.getTheme() });
  };

  const setBorderRadius = (radius: string) => {
    themeEngine.setBorderRadius(radius);
    setTheme({ ...themeEngine.getTheme() });
  };

  const setDensity = (density: 'compact' | 'comfortable' | 'spacious') => {
    themeEngine.setDensity(density);
    setTheme({ ...themeEngine.getTheme() });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setPreset,
        setMode,
        setAccentColor,
        updateColors,
        updateButton,
        setGlassEffect,
        setBorderRadius,
        setDensity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

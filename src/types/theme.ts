export type ThemeMode = 'dark' | 'light' | 'system';

export type BuiltinPreset =
  | 'Midnight'
  | 'Ocean'
  | 'Neon'
  | 'Purple'
  | 'Forest'
  | 'Sunset'
  | 'Minimal'
  | 'Cyber'
  | 'AMOLED'
  | 'Classic';

export type UiDensity = 'compact' | 'comfortable' | 'spacious';

export interface ButtonCustomization {
  backgroundColor: string;
  hoverColor: string;
  pressedColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: string; // e.g. '1px'
  glowColor: string; // e.g. 'rgba(0, 240, 255, 0.4)'
  glowSpread: string; // e.g. '8px'
  borderRadius: string; // e.g. '8px' or '9999px'
  sizeScale: number; // 0.85 to 1.25
  opacity: number; // 0.7 to 1.0
}

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceCard: string;
  sidebarBg: string;
  border: string;
  borderSubtle: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentGlow: string;
  progressBarBg: string;
  progressBarFill: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ThemeConfig {
  id: string;
  name: string;
  mode: ThemeMode;
  preset: BuiltinPreset | 'Custom';
  colors: ThemeColors;
  button: ButtonCustomization;
  borderRadius: string; // e.g. '12px'
  glassBlur: string; // e.g. '16px'
  shadowIntensity: number; // 0.0 to 1.0
  density: UiDensity;
  customGradient?: string;
}

import { BuiltinPreset, ButtonCustomization, ThemeConfig, ThemeMode } from '../types';
import { THEME_PRESETS, LIGHT_THEME } from './presets';

export class ThemeEngine {
  private currentConfig: ThemeConfig;

  constructor() {
    this.currentConfig = this.loadInitialTheme();
    this.applyTheme(this.currentConfig);
    this.initSystemThemeListener();
  }

  private initSystemThemeListener(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = (e: MediaQueryListEvent | MediaQueryList) => {
        if (this.currentConfig.mode === 'system') {
          if (e.matches) {
            this.currentConfig = { ...THEME_PRESETS.Midnight, mode: 'system' };
          } else {
            this.currentConfig = { ...LIGHT_THEME, mode: 'system' };
          }
          this.applyTheme(this.currentConfig);
        }
      };
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', handleSystemChange);
      } else if (typeof mql.addListener === 'function') {
        mql.addListener(handleSystemChange);
      }
    } catch {
      // ignore
    }
  }

  private loadInitialTheme(): ThemeConfig {
    if (typeof window === 'undefined') return THEME_PRESETS.Midnight;

    try {
      const saved = localStorage.getItem('nova_theme_config');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return THEME_PRESETS.Midnight;
  }

  public getTheme(): ThemeConfig {
    return this.currentConfig;
  }

  public setPreset(presetName: BuiltinPreset): void {
    const preset = THEME_PRESETS[presetName] || THEME_PRESETS.Midnight;
    this.currentConfig = { ...preset };
    this.saveAndApply();
  }

  public setMode(mode: ThemeMode): void {
    this.currentConfig.mode = mode;
    if (mode === 'light') {
      this.currentConfig = { ...LIGHT_THEME, mode: 'light' };
    } else if (mode === 'dark') {
      const basePreset = this.currentConfig.preset !== 'Custom' ? this.currentConfig.preset : 'Midnight';
      this.currentConfig = { ...THEME_PRESETS[basePreset as BuiltinPreset], mode: 'dark' };
    } else if (mode === 'system') {
      const isDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        this.currentConfig = { ...THEME_PRESETS.Midnight, mode: 'system' };
      } else {
        this.currentConfig = { ...LIGHT_THEME, mode: 'system' };
      }
    }
    this.saveAndApply();
  }

  public updateColors(partialColors: Partial<ThemeConfig['colors']>): void {
    this.currentConfig = {
      ...this.currentConfig,
      preset: 'Custom',
      colors: {
        ...this.currentConfig.colors,
        ...partialColors,
      },
    };
    this.saveAndApply();
  }

  public updateButtonCustomization(partialButton: Partial<ButtonCustomization>): void {
    this.currentConfig = {
      ...this.currentConfig,
      preset: 'Custom',
      button: {
        ...this.currentConfig.button,
        ...partialButton,
      },
    };
    this.saveAndApply();
  }

  public setAccentColor(accentHex: string): void {
    this.updateColors({
      accent: accentHex,
      accentHover: accentHex,
      accentGlow: `${accentHex}66`,
      progressBarFill: accentHex,
    });
    this.updateButtonCustomization({
      backgroundColor: accentHex,
      hoverColor: accentHex,
    });
  }

  public setGlassEffect(enabled: boolean): void {
    this.currentConfig.glassBlur = enabled ? '14px' : '0px';
    this.saveAndApply();
  }

  public setBorderRadius(radius: string): void {
    this.currentConfig.borderRadius = radius;
    this.saveAndApply();
  }

  public setDensity(density: 'compact' | 'comfortable' | 'spacious'): void {
    this.currentConfig.density = density;
    this.saveAndApply();
  }

  private saveAndApply(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nova_theme_config', JSON.stringify(this.currentConfig));
      } catch {
        // ignore
      }
    }
    this.applyTheme(this.currentConfig);
  }

  public applyTheme(config: ThemeConfig): void {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const { colors, button } = config;

    // Set Design Tokens on :root
    root.style.setProperty('--background', colors.background);
    root.style.setProperty('--surface', colors.surface);
    root.style.setProperty('--surface-secondary', colors.surfaceSecondary);
    root.style.setProperty('--surface-card', colors.surfaceCard);
    root.style.setProperty('--sidebar-bg', colors.sidebarBg);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--border-subtle', colors.borderSubtle);
    root.style.setProperty('--text-primary', colors.textPrimary);
    root.style.setProperty('--text-secondary', colors.textSecondary);
    root.style.setProperty('--text-muted', colors.textMuted);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-hover', colors.accentHover);
    root.style.setProperty('--accent-glow', colors.accentGlow);
    root.style.setProperty('--progress-bg', colors.progressBarBg);
    root.style.setProperty('--progress-fill', colors.progressBarFill);
    root.style.setProperty('--success', colors.success);
    root.style.setProperty('--warning', colors.warning);
    root.style.setProperty('--danger', colors.danger);

    // Button Design Tokens
    root.style.setProperty('--btn-bg', button.backgroundColor);
    root.style.setProperty('--btn-hover', button.hoverColor);
    root.style.setProperty('--btn-pressed', button.pressedColor);
    root.style.setProperty('--btn-text', button.textColor);
    root.style.setProperty('--btn-border', button.borderColor);
    root.style.setProperty('--btn-border-width', button.borderWidth);
    root.style.setProperty('--btn-glow-color', button.glowColor);
    root.style.setProperty('--btn-glow-spread', button.glowSpread);
    root.style.setProperty('--btn-radius', button.borderRadius);
    root.style.setProperty('--btn-scale', String(button.sizeScale));
    root.style.setProperty('--btn-opacity', String(button.opacity));

    // Global styles
    root.setAttribute('data-density', config.density || 'comfortable');
    root.style.setProperty('--radius', config.borderRadius);
    root.style.setProperty('--glass-blur', config.glassBlur);
    root.style.setProperty('--shadow-intensity', String(config.shadowIntensity));

    // HTML dark class
    if (config.mode === 'dark' || (config.mode === 'system' && config.colors.background.toLowerCase() !== '#ffffff')) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }
}

export const themeEngine = new ThemeEngine();

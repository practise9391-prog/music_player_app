import { describe, it, expect, beforeEach } from 'vitest';
import { THEME_PRESETS } from '../themes/presets';
import { evaluateContrast, getContrastRatio } from '../themes/contrast';
import { ThemeEngine } from '../themes/ThemeEngine';

describe('Theme Engine & Contrast System', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('contains all 10 built-in presets with valid design tokens', () => {
    const presetKeys = Object.keys(THEME_PRESETS);
    expect(presetKeys).toContain('Midnight');
    expect(presetKeys).toContain('Ocean');
    expect(presetKeys).toContain('Neon');
    expect(presetKeys).toContain('Purple');
    expect(presetKeys).toContain('Forest');
    expect(presetKeys).toContain('Sunset');
    expect(presetKeys).toContain('Minimal');
    expect(presetKeys).toContain('Cyber');
    expect(presetKeys).toContain('AMOLED');
    expect(presetKeys).toContain('Classic');
    expect(presetKeys.length).toBe(10);
  });

  it('calculates WCAG contrast ratio accurately', () => {
    // Black text on white background = 21:1
    const blackOnWhite = getContrastRatio('#000000', '#ffffff');
    expect(blackOnWhite).toBeGreaterThan(20);

    const evalResult = evaluateContrast('#ffffff', '#000000');
    expect(evalResult.isAccessibleAA).toBe(true);
    expect(evalResult.status).toBe('excellent');
  });

  it('applies and switches presets dynamically', () => {
    const engine = new ThemeEngine();
    engine.setPreset('Ocean');
    expect(engine.getTheme().preset).toBe('Ocean');
    expect(engine.getTheme().colors.accent).toBe('#38bdf8');

    engine.setAccentColor('#ff0055');
    expect(engine.getTheme().colors.accent).toBe('#ff0055');
    expect(engine.getTheme().button.backgroundColor).toBe('#ff0055');
  });
});

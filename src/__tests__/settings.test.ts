import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS } from '../types/settings';
import { SettingsRepository } from '../database/repository';
import 'fake-indexeddb/auto';

describe('Settings Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default settings when storage is empty', async () => {
    const settings = await SettingsRepository.getSettings();
    expect(settings).toBeDefined();
    expect(settings.themePreset).toBe(DEFAULT_SETTINGS.themePreset);
    expect(settings.networkLocked).toBe(true);
    expect(settings.volume).toBe(0.8);
    expect(settings.volumeBoost).toBe(1.0);
  });

  it('persists and restores updated settings across application restarts', async () => {
    const updated = {
      ...DEFAULT_SETTINGS,
      themePreset: 'Ocean' as const,
      accentColor: '#38bdf8',
      volumeBoost: 1.5,
      networkLocked: true,
      audioProfile: 'Bass Boost' as const,
    };

    await SettingsRepository.saveSettings(updated);

    const reloaded = await SettingsRepository.getSettings();
    expect(reloaded.themePreset).toBe('Ocean');
    expect(reloaded.accentColor).toBe('#38bdf8');
    expect(reloaded.volumeBoost).toBe(1.5);
    expect(reloaded.audioProfile).toBe('Bass Boost');
  });
});

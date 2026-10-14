import {
  AudioProfileConfig,
  AudioProfileScope,
  AudioProfilesExportBundle,
  AudioPresetRecord,
  OutputDeviceType,
  AudioProfileName,
  AudioProfile,
} from '../../types';
import { AUDIO_PROFILE_PRESETS, getProfileByName } from '../../audio/AudioProfiles';
import { AudioPresetRepository } from '../../database/repository';

export const DEFAULT_GLOBAL_AUDIO_CONFIG: AudioProfileConfig = {
  presetName: 'Flat',
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoostPercent: 0,
  trebleDb: 0,
  balance: 0,
  isMono: false,
  preampDb: 0,
  preventClipping: true,
  volumeNormalization: 'off',
  replayGainMode: 'off',
  playbackRate: 1.0,
  virtualSurround: 0,
  dolbyMode: 'off',
  nightMode: false,
  voiceMode: false,
  crossfadeDuration: 0,
  gapless: true,
  fadeInDuration: 0,
  fadeOutDuration: 0,
  skipSilence: 'off',
  volumeBoost: 1.0,
};

const STORAGE_KEY = 'nova_audio_profiles_store';

export class AudioProfileService {
  private static instance: AudioProfileService | null = null;

  private globalProfile: AudioProfileConfig = { ...DEFAULT_GLOBAL_AUDIO_CONFIG };
  private songProfiles: Map<string, AudioProfileConfig> = new Map();
  private albumProfiles: Map<string, AudioProfileConfig> = new Map();
  private artistProfiles: Map<string, AudioProfileConfig> = new Map();
  private deviceProfiles: Map<string, AudioProfileConfig> = new Map();
  private customPresets: Map<string, AudioPresetRecord> = new Map();
  private customProfilesEnabled = true;
  private isLoaded = false;

  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): AudioProfileService {
    if (!this.instance) {
      this.instance = new AudioProfileService();
    }
    return this.instance;
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('AudioProfileService listener error:', err);
      }
    });
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.globalProfile) {
          this.globalProfile = { ...DEFAULT_GLOBAL_AUDIO_CONFIG, ...parsed.globalProfile };
        }
        if (parsed.songProfiles) {
          this.songProfiles = new Map(Object.entries(parsed.songProfiles));
        }
        if (parsed.albumProfiles) {
          this.albumProfiles = new Map(Object.entries(parsed.albumProfiles));
        }
        if (parsed.artistProfiles) {
          this.artistProfiles = new Map(Object.entries(parsed.artistProfiles));
        }
        if (parsed.deviceProfiles) {
          this.deviceProfiles = new Map(Object.entries(parsed.deviceProfiles));
        }
        if (typeof parsed.customProfilesEnabled === 'boolean') {
          this.customProfilesEnabled = parsed.customProfilesEnabled;
        }
      }
    } catch (e) {
      console.warn('Failed to parse audio profiles from localStorage:', e);
    }

    // Load custom presets from Dexie repository
    this.refreshCustomPresets().catch(() => {});
    this.isLoaded = true;
  }

  public async refreshCustomPresets(): Promise<AudioPresetRecord[]> {
    try {
      const dbPresets = await AudioPresetRepository.getAll();
      this.customPresets.clear();
      dbPresets.forEach((p) => {
        this.customPresets.set(p.id, p);
      });
      this.notify();
      return dbPresets;
    } catch {
      return [];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const payload = {
        globalProfile: this.globalProfile,
        songProfiles: Object.fromEntries(this.songProfiles),
        albumProfiles: Object.fromEntries(this.albumProfiles),
        artistProfiles: Object.fromEntries(this.artistProfiles),
        deviceProfiles: Object.fromEntries(this.deviceProfiles),
        customProfilesEnabled: this.customProfilesEnabled,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save audio profiles to localStorage:', e);
    }
    this.notify();
  }

  // --- Priority Hierarchy Evaluation (Requirements 5, 6, 7, 8, 9) ---
  // Highest: Song -> Second: Album -> Third: Artist -> Fourth: Device -> Lowest: Global
  // If custom profiles are disabled: Use Global settings for everything.
  public resolveProfile(
    track: { id?: string; title?: string; album?: string; artist?: string } | null,
    deviceId?: string,
    deviceType?: OutputDeviceType
  ): {
    config: AudioProfileConfig;
    source: AudioProfileScope;
    matchedName?: string;
  } {
    if (!this.customProfilesEnabled) {
      return { config: { ...this.globalProfile }, source: 'global' };
    }

    // 1. Song Profile (Highest)
    if (track?.id && this.songProfiles.has(track.id)) {
      const cfg = this.songProfiles.get(track.id)!;
      return {
        config: { ...this.globalProfile, ...cfg },
        source: 'song',
        matchedName: track.title || 'Track Custom Profile',
      };
    }

    // 2. Album Profile (Second)
    if (track?.album) {
      const key = track.album.trim().toLowerCase();
      if (this.albumProfiles.has(key)) {
        const cfg = this.albumProfiles.get(key)!;
        return {
          config: { ...this.globalProfile, ...cfg },
          source: 'album',
          matchedName: track.album,
        };
      }
    }

    // 3. Artist Profile (Third)
    if (track?.artist) {
      const key = track.artist.trim().toLowerCase();
      if (this.artistProfiles.has(key)) {
        const cfg = this.artistProfiles.get(key)!;
        return {
          config: { ...this.globalProfile, ...cfg },
          source: 'artist',
          matchedName: track.artist,
        };
      }
    }

    // 4. Device Profile (Fourth)
    if (deviceId && this.deviceProfiles.has(deviceId)) {
      const cfg = this.deviceProfiles.get(deviceId)!;
      return {
        config: { ...this.globalProfile, ...cfg },
        source: 'device',
        matchedName: deviceId,
      };
    }
    if (deviceType && this.deviceProfiles.has(deviceType)) {
      const cfg = this.deviceProfiles.get(deviceType)!;
      return {
        config: { ...this.globalProfile, ...cfg },
        source: 'device',
        matchedName: deviceType,
      };
    }

    // 5. Global Profile (Lowest)
    return {
      config: { ...this.globalProfile },
      source: 'global',
    };
  }

  // --- Per-Song Profiles ---
  public setSongProfile(trackId: string, config: Partial<AudioProfileConfig>): void {
    const existing = this.songProfiles.get(trackId) || { ...this.globalProfile };
    this.songProfiles.set(trackId, { ...existing, ...config });
    this.saveToStorage();
  }

  public getSongProfile(trackId: string): AudioProfileConfig | undefined {
    return this.songProfiles.get(trackId);
  }

  public hasSongProfile(trackId: string): boolean {
    return this.songProfiles.has(trackId);
  }

  public removeSongProfile(trackId: string): void {
    if (this.songProfiles.delete(trackId)) {
      this.saveToStorage();
    }
  }

  // --- Per-Album Profiles ---
  public setAlbumProfile(albumName: string, config: Partial<AudioProfileConfig>): void {
    const key = albumName.trim().toLowerCase();
    const existing = this.albumProfiles.get(key) || { ...this.globalProfile };
    this.albumProfiles.set(key, { ...existing, ...config });
    this.saveToStorage();
  }

  public getAlbumProfile(albumName: string): AudioProfileConfig | undefined {
    return this.albumProfiles.get(albumName.trim().toLowerCase());
  }

  public removeAlbumProfile(albumName: string): void {
    if (this.albumProfiles.delete(albumName.trim().toLowerCase())) {
      this.saveToStorage();
    }
  }

  // --- Per-Artist Profiles ---
  public setArtistProfile(artistName: string, config: Partial<AudioProfileConfig>): void {
    const key = artistName.trim().toLowerCase();
    const existing = this.artistProfiles.get(key) || { ...this.globalProfile };
    this.artistProfiles.set(key, { ...existing, ...config });
    this.saveToStorage();
  }

  public getArtistProfile(artistName: string): AudioProfileConfig | undefined {
    return this.artistProfiles.get(artistName.trim().toLowerCase());
  }

  public removeArtistProfile(artistName: string): void {
    if (this.artistProfiles.delete(artistName.trim().toLowerCase())) {
      this.saveToStorage();
    }
  }

  // --- Output Device & Bluetooth Profiles ---
  public setDeviceProfile(deviceIdOrType: string, config: Partial<AudioProfileConfig>): void {
    const existing = this.deviceProfiles.get(deviceIdOrType) || { ...this.globalProfile };
    this.deviceProfiles.set(deviceIdOrType, { ...existing, ...config });
    this.saveToStorage();
  }

  public getDeviceProfile(deviceIdOrType: string): AudioProfileConfig | undefined {
    return this.deviceProfiles.get(deviceIdOrType);
  }

  public removeDeviceProfile(deviceIdOrType: string): void {
    if (this.deviceProfiles.delete(deviceIdOrType)) {
      this.saveToStorage();
    }
  }

  // --- Global Profile ---
  public setGlobalProfile(config: Partial<AudioProfileConfig>): void {
    this.globalProfile = { ...this.globalProfile, ...config };
    this.saveToStorage();
  }

  public getGlobalProfile(): AudioProfileConfig {
    return { ...this.globalProfile };
  }

  public setCustomProfilesEnabled(enabled: boolean): void {
    this.customProfilesEnabled = enabled;
    this.saveToStorage();
  }

  public isCustomProfilesEnabled(): boolean {
    return this.customProfilesEnabled;
  }

  // --- Reset Operations (Requirement 40) ---
  public resetGlobalSettings(): void {
    this.globalProfile = { ...DEFAULT_GLOBAL_AUDIO_CONFIG };
    this.saveToStorage();
  }

  public resetSongSettings(): void {
    this.songProfiles.clear();
    this.saveToStorage();
  }

  public resetAlbumSettings(): void {
    this.albumProfiles.clear();
    this.saveToStorage();
  }

  public resetArtistSettings(): void {
    this.artistProfiles.clear();
    this.saveToStorage();
  }

  public resetAllAudioProfiles(): void {
    this.globalProfile = { ...DEFAULT_GLOBAL_AUDIO_CONFIG };
    this.songProfiles.clear();
    this.albumProfiles.clear();
    this.artistProfiles.clear();
    this.deviceProfiles.clear();
    this.saveToStorage();
  }

  // --- Custom EQ Presets (Requirements 3 & 4) ---
  public getAllBuiltinPresets(): AudioProfile[] {
    return Object.values(AUDIO_PROFILE_PRESETS).filter((p) => p.isPreset);
  }

  public getCustomPresets(): AudioPresetRecord[] {
    return Array.from(this.customPresets.values());
  }

  public async saveCustomPreset(
    name: string,
    config: Partial<AudioProfileConfig>
  ): Promise<AudioPresetRecord> {
    const now = Date.now();
    const id = `preset_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const record: AudioPresetRecord = {
      id,
      name: name.trim() || 'Custom Preset',
      type: 'custom',
      settings_json: JSON.stringify(config),
      createdAt: now,
      updatedAt: now,
    };
    await AudioPresetRepository.save(record);
    this.customPresets.set(id, record);
    this.notify();
    return record;
  }

  public async renameCustomPreset(id: string, newName: string): Promise<boolean> {
    const existing = this.customPresets.get(id);
    if (!existing || existing.type !== 'custom') return false;

    const updated: AudioPresetRecord = {
      ...existing,
      name: newName.trim() || existing.name,
      updatedAt: Date.now(),
    };
    await AudioPresetRepository.save(updated);
    this.customPresets.set(id, updated);
    this.notify();
    return true;
  }

  public async duplicateCustomPreset(id: string, duplicateName: string): Promise<AudioPresetRecord | null> {
    const existing = this.customPresets.get(id);
    let settingsJson = '{}';

    if (existing) {
      settingsJson = existing.settings_json;
    } else {
      // Check if it's a builtin preset
      const builtin = getProfileByName(id as AudioProfileName);
      if (builtin) {
        settingsJson = JSON.stringify({
          eqBands: builtin.bands.map((b) => b.gain),
          preampDb: builtin.preampDb || 0,
          bassBoostPercent: Math.round(((builtin.bassGain || 0) / 10) * 100),
          trebleDb: builtin.trebleGain || 0,
        });
      } else {
        return null;
      }
    }

    const now = Date.now();
    const newId = `preset_${now}_${Math.random().toString(36).substring(2, 7)}`;
    const record: AudioPresetRecord = {
      id: newId,
      name: duplicateName.trim() || `${existing?.name || 'Preset'} (Copy)`,
      type: 'custom',
      settings_json: settingsJson,
      createdAt: now,
      updatedAt: now,
    };
    await AudioPresetRepository.save(record);
    this.customPresets.set(newId, record);
    this.notify();
    return record;
  }

  public async deleteCustomPreset(id: string): Promise<boolean> {
    const existing = this.customPresets.get(id);
    if (!existing || existing.type !== 'custom') {
      // Cannot delete built-in presets
      return false;
    }
    await AudioPresetRepository.delete(id);
    this.customPresets.delete(id);
    this.notify();
    return true;
  }

  // --- Import / Export (Requirements 41 & 42) ---
  public exportProfilesBundle(): AudioProfilesExportBundle {
    return {
      format: 'nova_audio_profiles',
      version: 1,
      exportedAt: Date.now(),
      appName: 'NovaMusic',
      customPresets: Array.from(this.customPresets.values()),
      songProfiles: Object.fromEntries(this.songProfiles),
      albumProfiles: Object.fromEntries(this.albumProfiles),
      artistProfiles: Object.fromEntries(this.artistProfiles),
      deviceProfiles: Object.fromEntries(this.deviceProfiles),
      globalProfile: { ...this.globalProfile },
      customProfilesEnabled: this.customProfilesEnabled,
    };
  }

  public async importProfilesBundle(
    bundle: AudioProfilesExportBundle,
    mode: 'merge' | 'overwrite' = 'merge'
  ): Promise<{ success: boolean; importedCount: number }> {
    if (!bundle || bundle.version !== 1) {
      throw new Error('Invalid audio profiles bundle format.');
    }

    if (mode === 'overwrite') {
      this.songProfiles.clear();
      this.albumProfiles.clear();
      this.artistProfiles.clear();
      this.deviceProfiles.clear();
      this.customPresets.clear();
    }

    if (bundle.globalProfile) {
      this.globalProfile = { ...DEFAULT_GLOBAL_AUDIO_CONFIG, ...bundle.globalProfile };
    }
    if (bundle.songProfiles) {
      Object.entries(bundle.songProfiles).forEach(([k, v]) => this.songProfiles.set(k, v));
    }
    if (bundle.albumProfiles) {
      Object.entries(bundle.albumProfiles).forEach(([k, v]) => this.albumProfiles.set(k, v));
    }
    if (bundle.artistProfiles) {
      Object.entries(bundle.artistProfiles).forEach(([k, v]) => this.artistProfiles.set(k, v));
    }
    if (bundle.deviceProfiles) {
      Object.entries(bundle.deviceProfiles).forEach(([k, v]) => this.deviceProfiles.set(k, v));
    }
    if (typeof bundle.customProfilesEnabled === 'boolean') {
      this.customProfilesEnabled = bundle.customProfilesEnabled;
    }

    let presetCount = 0;
    if (Array.isArray(bundle.customPresets)) {
      for (const p of bundle.customPresets) {
        if (p.type === 'custom') {
          await AudioPresetRepository.save(p);
          this.customPresets.set(p.id, p);
          presetCount++;
        }
      }
    }

    this.saveToStorage();
    const totalCount =
      this.songProfiles.size +
      this.albumProfiles.size +
      this.artistProfiles.size +
      this.deviceProfiles.size +
      presetCount;

    return { success: true, importedCount: totalCount };
  }
}

export const audioProfileServiceInstance = AudioProfileService.getInstance();

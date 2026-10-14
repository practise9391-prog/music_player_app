export type VocalEnhancementMode = 'off' | 'low' | 'medium' | 'high';
export type LoudnessMode = 'off' | 'low' | 'medium' | 'high';

export const EQ_FREQUENCIES = [60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export type EqFrequency = (typeof EQ_FREQUENCIES)[number];

export interface EqualizerBand {
  frequency: number;
  gain: number; // -12dB to +12dB
}

export interface CompressorConfig {
  enabled: boolean;
  threshold: number; // -24dB to 0dB, default -12
  ratio: number; // 1:1 to 20:1, default 4
  attack: number; // 0.001 to 0.1s (1ms - 100ms), default 0.01s (10ms)
  release: number; // 0.01 to 0.5s (10ms - 500ms), default 0.25s (250ms)
  makeupGain: number; // 0dB to 12dB, default 0
}

export interface LimiterConfig {
  enabled: boolean;
  ceilingDb: number; // -1.0dB, -0.5dB, 0.0dB, default -1.0dB
}

export interface DspProcessingState {
  preampDb: number; // -12dB to +12dB, default 0
  eqBands: number[]; // 9 values, each -12 to +12 dB
  bassBoostDb: number; // 0 to +10 dB
  bassBoostPercent?: number; // 0 to 100%
  trebleDb: number; // -12 to +12 dB
  vocalMode: VocalEnhancementMode;
  loudnessMode: LoudnessMode;
  compressor: CompressorConfig;
  limiter: LimiterConfig;
  stereoWidth: number; // 0.0 to 1.5 (0% to 150%), default 1.0
  balance: number; // -1.0 (left) to +1.0 (right), default 0.0
  isMono: boolean;
  volumeBoost: number; // 1.0 (100%) to 3.0 (300%), default 1.0
  autoHeadroom: boolean;
  preventClipping?: boolean; // Part 13: clipping prevention toggle
  dspBypass: boolean;
  abState: 'A' | 'B';
  activeProfile: string;
  maxOutputLevel: number; // 0.5 to 1.0 (50% to 100% safety ceiling)
  calculatedHeadroomDb: number; // current headroom reduction applied
  replayGainDb?: number; // active replay gain applied in dB
  replayGainMode?: 'off' | 'track' | 'album';
  volumeNormalizationMode?: 'off' | 'track' | 'album';
  nightMode?: boolean;
  voiceMode?: boolean;
  virtualSurround?: number; // 0 to 100%
}

export interface AudioLevelData {
  leftPeak: number; // 0 to 1
  rightPeak: number; // 0 to 1
  leftRms: number; // 0 to 1
  rightRms: number; // 0 to 1
  isClipping: boolean;
  gainReductionDb: number;
  peakDb: number;
}

export interface AudioPresetRecord {
  id: string;
  name: string;
  type: 'builtin' | 'custom';
  settings_json: string;
  createdAt: number;
  updatedAt: number;
}

export interface AudioQualityDetails {
  format: string;
  codec: string;
  bitDepth?: number;
  sampleRate: number;
  channels: number;
  bitrate?: number;
  duration: number;
  isLossless: boolean;
  dspActive: boolean;
  processingLabel: string;
}

export const DEFAULT_DSP_STATE: DspProcessingState = {
  preampDb: 0,
  eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  bassBoostDb: 0,
  trebleDb: 0,
  vocalMode: 'off',
  loudnessMode: 'off',
  compressor: {
    enabled: false,
    threshold: -12,
    ratio: 4,
    attack: 0.01,
    release: 0.25,
    makeupGain: 0,
  },
  limiter: {
    enabled: true,
    ceilingDb: -1.0,
  },
  stereoWidth: 1.0,
  balance: 0.0,
  isMono: false,
  volumeBoost: 1.0,
  autoHeadroom: true,
  preventClipping: true,
  dspBypass: false,
  abState: 'A',
  activeProfile: 'Flat',
  maxOutputLevel: 1.0,
  calculatedHeadroomDb: 0,
  replayGainDb: 0,
  replayGainMode: 'off',
  volumeNormalizationMode: 'off',
  nightMode: false,
  voiceMode: false,
  virtualSurround: 0,
};

export type AudioProfileScope = 'song' | 'album' | 'artist' | 'device' | 'global';

export interface AudioProfileConfig {
  id?: string;
  name?: string;
  presetName: string;
  eqBands: number[]; // 9 values, -12dB to +12dB
  bassBoostPercent: number; // 0 to 100%
  trebleDb: number; // -12 to +12 dB
  balance: number; // -1.0 (left) to +1.0 (right)
  isMono: boolean;
  preampDb: number; // -12 to +12 dB
  preventClipping: boolean;
  volumeNormalization: 'off' | 'track' | 'album';
  replayGainMode: 'off' | 'track' | 'album';
  playbackRate: number; // 0.5 to 2.5
  virtualSurround: number; // 0 to 100%
  dolbyMode?: string;
  spatialMode?: string;
  nightMode: boolean;
  voiceMode: boolean;
  crossfadeDuration: number; // 0 to 12s
  gapless: boolean;
  fadeInDuration?: number; // 0 to 5s
  fadeOutDuration?: number; // 0 to 5s
  skipSilence?: 'off' | 'low' | 'medium' | 'high';
  volumeBoost?: number; // 1.0 to 2.0
}

export interface AudioEntityProfileRecord {
  id: string; // e.g. "song_tr_123", "album_Abbey Road", "artist_Pink Floyd", "device_bt_buds", "global"
  scope: AudioProfileScope;
  targetId: string;
  targetName?: string;
  config: AudioProfileConfig;
  enabled: boolean;
  updatedAt: number;
}

export type OutputDeviceType = 'speaker' | 'headphones' | 'bluetooth' | 'usb' | 'other';

export interface OutputDeviceInfo {
  deviceId: string;
  label: string;
  type: OutputDeviceType;
  groupId?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export type DolbyStatus = 'supported' | 'unavailable' | 'system_controlled';

export type DolbyMode =
  | 'off'
  | 'music'
  | 'movie'
  | 'voice'
  | 'game'
  | 'dynamic'
  | 'surround'
  | 'custom';

export interface AudioProfilesExportBundle {
  format?: string;
  version: 1;
  exportedAt: number;
  appName: 'NovaMusic';
  customPresets: AudioPresetRecord[];
  songProfiles: Record<string, AudioProfileConfig>;
  albumProfiles: Record<string, AudioProfileConfig>;
  artistProfiles: Record<string, AudioProfileConfig>;
  deviceProfiles: Record<string, AudioProfileConfig>;
  globalProfile: AudioProfileConfig;
  customProfilesEnabled: boolean;
}

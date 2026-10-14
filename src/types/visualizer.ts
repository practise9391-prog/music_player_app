export type VisualizerMode =
  | 'off'
  | 'spectrum'
  | 'smooth_spectrum'
  | 'bars'
  | 'waveform'
  | 'oscilloscope'
  | 'circle'
  | 'radial_spectrum'
  | 'spectrogram'
  | 'peak_meter'
  | 'rms_meter'
  | 'stereo_field'
  | 'phase_meter'
  | 'album_art'
  | 'particles'
  | 'minimal';

export type VisualizerFps = 'low' | 'medium' | 'high' | 'ultra' | 30 | 60 | 120 | 'auto';

export type VisualizerQuality = 'low' | 'medium' | 'high' | 'ultra';

export type VisualizerFftSize = 512 | 1024 | 2048 | 4096 | 8192;

export type FftWindowFunction = 'hann' | 'hamming' | 'blackman' | 'rectangular';

export type FrequencyScale = 'logarithmic' | 'linear' | 'musical';

export type AnalysisTapSource =
  | 'source'
  | 'pre_dsp'
  | 'post_dsp'
  
  | 'post_spatial'
  | 'post_limiter';

export type PauseBehavior = 'freeze' | 'fade' | 'stop';

export type VisualizerColorMode =
  | 'theme'
  | 'album_art'
  | 'custom'
  | 'gradient'
  | 'neon'
  | 'monochrome'
  | 'rainbow';

export interface VisualizerSettings {
  enabled: boolean;
  mode: VisualizerMode;
  fps: VisualizerFps;
  quality: VisualizerQuality;
  fftSize: VisualizerFftSize;
  windowFunction: FftWindowFunction;
  frequencyScale: FrequencyScale;
  analysisTap: AnalysisTapSource;
  sensitivity: number; // 0 to 100
  smoothing: number; // 0 to 100
  dbRange: number; // e.g. 72 dB (-72dB to 0dB)
  peakHold: boolean;
  peakDecaySpeed: number; // 1 to 10
  mirror: boolean;
  stereoMode: boolean;
  colorMode: VisualizerColorMode;
  customColor: string;
  customSecondaryColor: string;
  backgroundOpacity: number; // 0 to 100
  particleCount: number; // 50 to 400
  spectrogramHistory: number; // slices/history width
  pauseBehavior: PauseBehavior;
  reducedMotion: boolean;
  fullscreen: boolean;
  showArtwork: boolean;
  showTrackInfo: boolean;
  showLyricsOverlay: boolean;
  showTechnicalDiagnostics: boolean;
}

export interface SpectrumData {
  bands: number[]; // 9 values corresponding to 60, 120, 250, 500, 1k, 2k, 4k, 8k, 16k Hz (0 to 1 normalized)
  rawFft: Uint8Array;
  frequencies?: Float32Array;
  peaks?: number[];
}

export interface WaveformData {
  timeDomain: Uint8Array;
  floatTimeDomain?: Float32Array;
  leftTimeDomain?: Float32Array;
  rightTimeDomain?: Float32Array;
}

export interface StereoData {
  leftLevel: number; // 0.0 to 1.0
  rightLevel: number; // 0.0 to 1.0
  leftDb: number; // -72 to 0 dB
  rightDb: number; // -72 to 0 dB
  balance: number; // -1.0 (Left) to +1.0 (Right)
  width: number; // 0.0 (Mono) to 1.0 (Wide Stereo)
  correlation: number; // -1.0 to +1.0
}

export interface BeatData {
  isBeat: boolean;
  energy: number; // 0.0 to 1.0
  decay: number; // 0.0 to 1.0
  confidence: number;
}

export interface OscilloscopeConfig {
  triggerLevel: number; // -1.0 to 1.0
  triggerMode: 'auto' | 'rising' | 'falling' | 'off';
  timeScale: number; // 0.1 to 5.0
  amplitudeScale: number; // 0.1 to 5.0
}

export interface VisualizerPreset {
  id: string;
  name: string;
  isBuiltin?: boolean;
  settings: Partial<VisualizerSettings>;
  createdAt?: number;
  updatedAt?: number;
}

export interface VisualizerDiagnostics {
  fps: number;
  frameTimeMs: number;
  droppedFrames: number;
  activeMode: VisualizerMode;
  fftResolution: number;
  particleCount: number;
  tapSource: AnalysisTapSource;
  isSilent: boolean;
  leftPeakDb: number;
  rightPeakDb: number;
}

export const DEFAULT_VISUALIZER_SETTINGS: VisualizerSettings = {
  enabled: true,
  mode: 'spectrum',
  fps: 'medium',
  quality: 'high',
  fftSize: 2048,
  windowFunction: 'hann',
  frequencyScale: 'logarithmic',
  analysisTap: 'post_spatial',
  sensitivity: 50,
  smoothing: 75,
  dbRange: 72,
  peakHold: true,
  peakDecaySpeed: 3,
  mirror: false,
  stereoMode: true,
  colorMode: 'theme',
  customColor: '#00e5ff',
  customSecondaryColor: '#8000ff',
  backgroundOpacity: 95,
  particleCount: 150,
  spectrogramHistory: 200,
  pauseBehavior: 'freeze',
  reducedMotion: false,
  fullscreen: false,
  showArtwork: true,
  showTrackInfo: true,
  showLyricsOverlay: true,
  showTechnicalDiagnostics: false,
};

export const BUILTIN_VISUALIZER_PRESETS: VisualizerPreset[] = [
  {
    id: 'preset_classic_spectrum',
    name: 'Classic Studio Spectrum',
    isBuiltin: true,
    settings: {
      mode: 'spectrum',
      fftSize: 2048,
      windowFunction: 'hann',
      frequencyScale: 'logarithmic',
      smoothing: 75,
      sensitivity: 55,
      peakHold: true,
      colorMode: 'theme',
    },
  },
  {
    id: 'preset_smooth_neon',
    name: 'Neon Curve Flow',
    isBuiltin: true,
    settings: {
      mode: 'smooth_spectrum',
      fftSize: 2048,
      windowFunction: 'hamming',
      frequencyScale: 'logarithmic',
      smoothing: 85,
      sensitivity: 60,
      colorMode: 'neon',
    },
  },
  {
    id: 'preset_oscilloscope_pro',
    name: 'Lab Oscilloscope',
    isBuiltin: true,
    settings: {
      mode: 'oscilloscope',
      fftSize: 1024,
      smoothing: 60,
      sensitivity: 50,
      colorMode: 'monochrome',
      customColor: '#00ff66',
    },
  },
  {
    id: 'preset_circular_energy',
    name: 'Circular Pulse',
    isBuiltin: true,
    settings: {
      mode: 'circle',
      fftSize: 2048,
      smoothing: 70,
      sensitivity: 65,
      peakHold: true,
      colorMode: 'gradient',
    },
  },
  {
    id: 'preset_spectrogram_waterfall',
    name: 'Spectrogram Waterfall',
    isBuiltin: true,
    settings: {
      mode: 'spectrogram',
      fftSize: 2048,
      frequencyScale: 'logarithmic',
      smoothing: 60,
      spectrogramHistory: 300,
      colorMode: 'rainbow',
    },
  },
  {
    id: 'preset_stereo_mastering',
    name: 'Stereo Field & Phase Lab',
    isBuiltin: true,
    settings: {
      mode: 'stereo_field',
      fftSize: 1024,
      stereoMode: true,
      smoothing: 65,
      sensitivity: 50,
      colorMode: 'theme',
    },
  },
  {
    id: 'preset_audio_particles',
    name: 'Cosmic Audio Particles',
    isBuiltin: true,
    settings: {
      mode: 'particles',
      fftSize: 2048,
      particleCount: 220,
      smoothing: 70,
      sensitivity: 60,
      colorMode: 'theme',
    },
  },
  {
    id: 'preset_album_art_reactive',
    name: 'Album Art Reactive Aura',
    isBuiltin: true,
    settings: {
      mode: 'album_art',
      fftSize: 2048,
      smoothing: 80,
      sensitivity: 60,
      colorMode: 'album_art',
    },
  },
  {
    id: 'preset_minimalist_zen',
    name: 'Minimal Zen Dots',
    isBuiltin: true,
    settings: {
      mode: 'minimal',
      smoothing: 80,
      sensitivity: 45,
      colorMode: 'theme',
    },
  },
];

export type SpatialMode =
  | 'off'
  | 'stereo_wide'
  | 'virtual_surround'
  | 'headphone_spatial'
  | '3d_audio'
  | 'room'
  | 'cinema'
  | 'live';

export type SpatialPresetName =
  | 'Natural'
  | 'Wide'
  | 'Headphones'
  | 'Virtual Surround'
  | 'Cinema'
  | 'Live'
  | 'Concert Hall'
  | 'Gaming'
  | 'Voice'
  | 'Custom';

export type RoomSizeType = 'small' | 'studio' | 'concert_hall' | 'large_hall' | 'cinema' | 'cathedral';

export type CrossfeedMode = 'off' | 'low' | 'medium' | 'high';

export type ProcessingQuality = 'low' | 'medium' | 'high';

export interface SpatialPosition {
  azimuth: number; // -180 to +180 degrees
  elevation: number; // -90 to +90 degrees
  distance: number; // 0.0 to 1.0 (near to far)
  depth: number; // 0.0 to 1.0
}

export interface SpatialCapabilities {
  nativeSpatialAvailable: boolean;
  hardwareSpatialAvailable: boolean;
  maxChannels: number;
  sampleRate: number;
  statusText: string;
}

export interface SpatialState {
  enabled: boolean;
  mode: SpatialMode;
  intensity: number; // 0.0 to 1.5 (0% to 150%)
  position: SpatialPosition;
  depth: number; // 0.0 to 1.0
  distance: number; // 0.0 to 1.0
  width: number; // 0.0 to 1.5 (0% to 150%)
  stereoWidth?: number; // Alias for width
  centerLevel: number; // -1.0 to +1.0 (-100% to +100%)
  surroundBalance: number; // -1.0 to +1.0
  roomSize: RoomSizeType;
  roomMix: number; // 0.0 to 1.0
  reverbDecay: number; // 0.1 to 10.0 seconds
  reverbPreDelay: number; // 0 to 100 ms
  crossfeed: CrossfeedMode;
  bypass: boolean;
  abState: 'A' | 'B';
  abComparison?: boolean;
  activePreset: SpatialPresetName | string;
  quality: ProcessingQuality;
  correlation: number; // -1.0 to +1.0 (stereo correlation index)
  monoWarning: boolean;
}

export interface SpatialPreset {
  id: string;
  name: SpatialPresetName | string;
  description: string;
  state: Partial<SpatialState>;
  isBuiltin: boolean;
}

export const DEFAULT_SPATIAL_STATE: SpatialState = {
  enabled: false,
  mode: 'off',
  intensity: 0.0,
  position: {
    azimuth: 0,
    elevation: 0,
    distance: 0.3,
    depth: 0.5,
  },
  depth: 0.5,
  distance: 0.3,
  width: 1.0,
  stereoWidth: 1.0,
  centerLevel: 0.0,
  surroundBalance: 0.0,
  roomSize: 'studio',
  roomMix: 0.0,
  reverbDecay: 1.2,
  reverbPreDelay: 20,
  crossfeed: 'off',
  bypass: false,
  abState: 'A',
  abComparison: false,
  activePreset: 'Natural',
  quality: 'high',
  correlation: 0.85,
  monoWarning: false,
};

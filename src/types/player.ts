import { Track } from './track';
import { EqualizerBand } from './dsp';
import { SpatialMode } from './spatial';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error';

export type RepeatMode = 'off' | 'all' | 'one';

export type ShuffleMode = 'off' | 'normal' | 'smart' | 'album';

export type AudioProfileName =
  | 'Flat'
  | 'Classical'
  | 'Dance'
  | 'Electronic'
  | 'Hip-Hop'
  | 'Jazz'
  | 'Pop'
  | 'Rock'
  | 'Vocal'
  | 'Acoustic'
  | 'Bass Boost'
  | 'Treble Boost'
  | 'Spoken Word'
  | 'Movie'
  | 'Deep Bass'
  | 'Gaming'
  | 'Night'
  | 'Podcast'
  | 'Pure'
  | 'Bass Lover'
  | 'Custom';

export { type SpatialMode };


export interface AudioProfile {
  id: string;
  name: AudioProfileName;
  description: string;
  bands: EqualizerBand[];
  preampDb?: number;
  bassGain: number; // dB
  trebleGain: number; // dB
  vocalMode?: 'off' | 'low' | 'medium' | 'high';
  loudnessMode?: 'off' | 'low' | 'medium' | 'high';
  stereoWidth?: number;
  isPreset: boolean;
}

export type AudioEngineEventType =
  | 'TRACK_LOADED'
  | 'PLAY_STARTED'
  | 'PLAY_PAUSED'
  | 'PLAY_STOPPED'
  | 'TRACK_FINISHED'
  | 'TRACK_CHANGED'
  | 'POSITION_CHANGED'
  | 'DURATION_CHANGED'
  | 'VOLUME_CHANGED'
  | 'MUTE_CHANGED'
  | 'QUEUE_CHANGED'
  | 'SHUFFLE_CHANGED'
  | 'REPEAT_CHANGED'
  | 'PLAYBACK_ERROR'
  | 'OUTPUT_DEVICE_CHANGED'
  | 'BUFFERING_PROGRESS'
  | 'AUDIO_FOCUS_CHANGED'
  | 'AUDIO_ROUTE_CHANGED';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  groupId?: string;
}

export interface AudioEngineState {
  status: PlaybackStatus;
  currentTime: number;
  duration: number;
  bufferedPercent?: number; // 0 to 100
  bufferedSeconds?: number;
  volume: number; // 0 to 1
  boostLevel: number; // 1.0 (100%) to 3.0 (300%)
  isMuted: boolean;
  previousVolume: number; // for restoring on unmute
  playbackRate: number; // 0.5 to 2.0
  repeatMode: RepeatMode;
  isShuffle: boolean;
  activeProfile: AudioProfileName;
  spatialMode: SpatialMode;
  isClippingLimiterActive: boolean;
  error: string | null;
  outputDeviceId?: string;
}

export interface PlaybackStatePersistence {
  trackId: string | null;
  position: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  repeatMode: RepeatMode;
  isShuffle: boolean;
  queue: Track[];
  queueIndex: number;
  updatedAt: number;
}

export interface PlaybackSession {
  trackId: string;
  startedAt: number;
  durationListened: number;
  completed: boolean;
  lastPosition: number;
}

export type AudioFocusState =
  | 'GAIN'
  | 'LOSS'
  | 'LOSS_TRANSIENT'
  | 'LOSS_TRANSIENT_CAN_DUCK';

export type AudioInterruptionType =
  | 'call'
  | 'navigation'
  | 'assistant'
  | 'transient'
  | 'permanent'
  | 'alarm'
  | 'notification';

export interface AudioFocusEvent {
  state: AudioFocusState;
  interruptionType?: AudioInterruptionType;
  timestamp: number;
}

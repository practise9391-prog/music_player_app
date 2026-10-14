import { Track } from './track';
import { AudioProfileName, RepeatMode } from './player';

/**
 * Sleep Timer configuration and state
 */
export interface SleepTimerConfig {
  mode: 'duration' | 'end_of_track' | 'end_of_queue';
  durationMinutes: number;
  targetTimestamp: number | null; // Milliseconds timestamp for background accuracy
  tracksRemaining: number | null;
  fadeOutSeconds: number;
  isActive: boolean;
}

/**
 * Playback Bookmark for long audio, audiobooks, lectures, podcasts
 */
export interface BookmarkRecord {
  id?: number;
  trackId: string;
  position: number; // Playback position in seconds
  title: string;
  notes?: string;
  createdAt: number;
}

/**
 * Per-track resume positions
 */
export interface TrackResumePosition {
  trackId: string;
  position: number; // Playback position in seconds
  duration: number;
  updatedAt: number;
}

/**
 * Listening Sessions / Playback Environments
 */
export interface ListeningSessionConfig {
  id: string;
  name: string;
  type: 'focus' | 'workout' | 'relax' | 'commute' | 'sleep' | 'custom';
  playlistId?: string;
  audioProfile?: AudioProfileName;
  sleepTimerMinutes?: number;
  fadeOutSeconds?: number;
  shuffle?: boolean;
  repeatMode?: RepeatMode;
  createdAt: number;
}

/**
 * Part 24: Intelligent Duplicate Detection
 */
export type DuplicateMatchReason =
  | 'exact_checksum'
  | 'exact_metadata'
  | 'fuzzy_metadata'
  | 'duration_and_filename';

export interface DuplicateGroup {
  groupId: string;
  matchReason: DuplicateMatchReason;
  tracks: Track[];
  suggestedKeepTrackId: string; // Recommended track based on bitrate/quality/metadata completeness
}

/**
 * Part 24: Explainable Metadata Suggestions
 */
export interface MetadataCorrectionSuggestion {
  trackId: string;
  field: 'title' | 'artist' | 'album' | 'genre' | 'trackNumber' | 'year';
  originalValue: string | number | undefined;
  suggestedValue: string | number;
  reason: string;
  confidence: number; // 0.0 to 1.0
}

/**
 * Part 23: Audio Quality Diagnostics Report
 */
export interface AudioDiagnosticsReport {
  timestamp: number;
  trackId?: string;
  title?: string;
  format: string;
  sampleRate: number;
  channels: number;
  bitrateKbps: number;
  bufferHealthPercent: number;
  dspActive: boolean;
  spatialActive: boolean;
  volumePercent: number;
  estimatedDynamicRangeDb: number;
  peakOutputLevelDb: number;
  rmsOutputLevelDb: number;
  isLossless: boolean;
}


export interface YouTubeVideoMetadata {
  id: string; // YouTube 11-char Video ID
  title: string;
  artist: string; // uploader / channel
  channel: string;
  duration: number; // in seconds
  thumbnailUrl?: string;
  videoUrl: string; // Canonical YouTube URL
  codec: string; // e.g. opus, aac
  bitrate?: number; // kbps
  sampleRate?: number; // Hz, e.g. 48000
  container?: string; // webm, m4a
  isAvailable: boolean;
  requiresAuth?: boolean;
  isLive?: boolean;
}

export interface YouTubeAudioStream {
  streamUrl: string;
  formatId: string;
  codec: string;
  container: string;
  bitrate: number;
  sampleRate: number;
  filesize?: number;
  expiresAt?: number;
}

export interface ResolvedYouTubeAudio {
  metadata: YouTubeVideoMetadata;
  stream: YouTubeAudioStream;
}

export type YouTubePlaybackStatus =
  | 'idle'
  | 'validating'
  | 'requesting_network'
  | 'resolving'
  | 'buffering'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'reconnecting'
  | 'stopped'
  | 'error';

export interface YouTubePlaybackState {
  status: YouTubePlaybackStatus;
  currentUrl: string | null;
  videoId: string | null;
  metadata: YouTubeVideoMetadata | null;
  stream: YouTubeAudioStream | null;
  bufferedPercent: number; // 0 to 100
  bufferedSeconds: number;
  duration: number;
  currentTime: number;
  errorMessage: string | null;
  isSeekingAvailable: boolean;
}

export const DEFAULT_YOUTUBE_PLAYBACK_STATE: YouTubePlaybackState = {
  status: 'idle',
  currentUrl: null,
  videoId: null,
  metadata: null,
  stream: null,
  bufferedPercent: 0,
  bufferedSeconds: 0,
  duration: 0,
  currentTime: 0,
  errorMessage: null,
  isSeekingAvailable: true,
};

// --- Part 7: YouTube History, Smart Caching & Offline Replay Types ---

export type YouTubeCacheStatus =
  | 'NOT_CACHED'
  | 'CACHING'
  | 'CACHED'
  | 'CORRUPTED'
  | 'MISSING'
  | 'EVICTED';

export interface YouTubeHistoryRecord {
  id: string; // generated or `yt_${youtube_video_id}`
  youtube_video_id: string; // 11-char canonical video ID
  youtube_url: string; // canonical URL e.g. https://www.youtube.com/watch?v=...
  title: string;
  artist: string; // uploader / artist name
  channel?: string; // channel name
  duration: number; // in seconds
  thumbnail_url?: string;
  thumbnail_local_path?: string;
  codec?: string; // opus, aac, etc.
  bitrate?: number; // kbps
  sample_rate?: number; // Hz, e.g. 48000
  channels?: number; // 2
  first_played_at: number; // epoch ms
  last_played_at: number; // epoch ms
  play_count: number;
  last_position: number; // seconds
  is_favorite: boolean;
  cache_status: YouTubeCacheStatus;
  cache_path?: string; // local audio file path
  cache_size?: number; // size in bytes
  cache_created_at?: number; // epoch ms
  cache_last_used_at?: number; // epoch ms
  source_status?: 'active' | 'unavailable' | 'removed';
}

export interface CacheDownloadProgress {
  videoId: string;
  status: 'idle' | 'downloading' | 'verifying' | 'completed' | 'error';
  receivedBytes: number;
  totalBytes?: number;
  percentage: number;
  errorMessage?: string;
}

export interface CacheStatistics {
  cachedTracksCount: number;
  totalCacheSizeBytes: number;
  maxCacheSizeBytes: number;
  freeCapacityBytes: number;
  averageCacheSizeBytes: number;
  oldestCacheTimestamp?: number;
  newestCacheTimestamp?: number;
  largestTrack?: {
    videoId: string;
    title: string;
    sizeBytes: number;
  };
}

export interface CacheValidationResult {
  isValid: boolean;
  videoId: string;
  status: YouTubeCacheStatus;
  sizeBytes: number;
  reason?: string;
}

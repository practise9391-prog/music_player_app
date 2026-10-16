export type AudioFormat = 'mp3' | 'flac' | 'wav' | 'ogg' | 'm4a' | 'aac' | 'opus' | 'webm' | 'wma' | 'mp4' | 'mkv';

export type TrackSource = 'local' | 'online';

export interface Track {
  id: string;
  folderId?: string;
  folderPath?: string;
  path: string; // file path or URL
  filename?: string;
  mediaType?: 'audio' | 'video';
  title: string;
  artist: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  totalTracks?: number;
  discNumber?: number;
  composer?: string;
  contributingArtists?: string;
  copyright?: string;
  comment?: string;
  duration: number; // in seconds
  format: AudioFormat | string;
  codec?: string;
  bitrate?: number; // kbps
  sampleRate?: number; // Hz, e.g. 44100
  bitDepth?: number; // 16 or 24-bit
  channels?: number; // 2 for stereo
  trackGain?: number; // ReplayGain track gain in dB
  albumGain?: number; // ReplayGain album gain in dB
  trackPeak?: number; // ReplayGain peak
  coverArtUrl?: string;
  coverArtId?: string;
  fileSize?: number; // bytesnext part
  modifiedAt?: number;
  dateAdded: number; // timestamp
  lastPlayedAt?: number; // timestamp
  playCount: number;
  isFavorite: boolean;
  source: TrackSource;
  sourceType?: 'local' | 'youtube';
  sourceId?: string; // YouTube video ID or unique remote identifier
  sourceChannel?: string; // YouTube channel name / uploader
  originalUrl?: string; // Canonical YouTube URL
  playbackUrl?: string; // in-memory session blob URL or temporary stream URL
  mediaEndpoint?: string; // Authorized media CDN endpoint
  cached?: boolean;
  cachePath?: string;
  isAvailable?: boolean; // false if file was deleted locally
  rating?: number; // 0 to 5 star rating (Part 9)
  fileHash?: string; // identity hash for duplicate detection
  contentHash?: string; // content hash for exact duplicate detection
  lyrics?: string; // Embedded lyrics from ID3 / Vorbis metadata
  isDownloaded?: boolean; // Part 17: Downloaded via app download manager
  downloadId?: string; // Part 17: Reference to DownloadRecord
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  trackCount: number;
  duration: number;
  coverArtUrl?: string;
  tracks: Track[];
}

export interface Artist {
  id: string;
  name: string;
  trackCount: number;
  albumCount: number;
  duration: number;
  albums: string[];
  tracks: Track[];
}

export interface Genre {
  name: string;
  trackCount: number;
  duration: number;
  tracks: Track[];
}

export interface FolderNode {
  path: string;
  name: string;
  trackCount: number;
  subfolders: FolderNode[];
  tracks: Track[];
}

export interface ScanProgress {
  isScanning: boolean;
  currentFolder: string;
  currentFile: string;
  processedFiles: number;
  totalFiles: number;
  percentage: number;
  newTracks: number;
  updatedTracks: number;
  removedTracks: number;
  skippedFiles: number;
  duplicateCandidates?: number;
  errors: { path: string; reason: string }[];
}

export interface ScanResult {
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
  skipped: number;
  duplicateCandidates?: number;
  errors: { path: string; reason: string }[];
  durationMs: number;
}

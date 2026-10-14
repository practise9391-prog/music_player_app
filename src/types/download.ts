import { Track } from './track';

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DownloadPriority = 'high' | 'normal' | 'low';

export type DownloadSourceType =
  | 'direct_url'
  | 'archive_cc'
  | 'authorized_stream'
  | 'external_import';

export type DuplicateAction = 'rename' | 'skip' | 'overwrite';

export interface DownloadRecord {
  id: string; // unique UUID string
  source_id: string; // origin URL or unique source ID
  source_type: DownloadSourceType;
  source_reference: string; // display origin or service name
  display_title: string;
  artist: string;
  album: string;
  cover_art_url?: string;
  destination_uri: string; // relative or absolute storage path
  temporary_file_reference?: string; // key for temporary storage or chunks
  status: DownloadStatus;
  downloaded_bytes: number;
  expected_bytes: number;
  mime_type?: string;
  detected_format?: string;
  speed_bytes_sec?: number;
  estimated_remaining_seconds?: number;
  priority: DownloadPriority;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  last_error_code?: string;
  last_error_message?: string;
  retry_count: number;
  is_resumable: boolean;
  target_track_id?: string; // ID in db.tracks when registered
  etag?: string;
  last_modified?: string;
}

export interface DownloadMediaInfo {
  title: string;
  artist?: string;
  album?: string;
  expectedBytes: number;
  mimeType?: string;
  detectedFormat?: string;
  isResumable: boolean;
  isAuthorized: boolean;
  authorizationReason?: string;
  coverArtUrl?: string;
  etag?: string;
  lastModified?: string;
}

export interface DownloadProgressUpdate {
  jobId: string;
  downloadedBytes: number;
  expectedBytes: number;
  speedBytesSec: number;
  estimatedRemainingSeconds: number;
}

export interface StorageSummary {
  totalStorageBytes: number;
  availableStorageBytes: number;
  downloadedFilesBytes: number;
  completedCount: number;
  pendingCount: number;
  queuedExpectedBytes: number;
  isLowStorage: boolean;
}

export interface DownloadProviderCapabilities {
  supportsDirectDownload: boolean;
  supportsResumption: boolean;
  providesExpectedSize: boolean;
  providesContentType: boolean;
  requiresAuthorization: boolean;
  supportsMetadata: boolean;
}

export interface IDownloadProvider {
  id: string;
  name: string;
  description: string;
  capabilities: DownloadProviderCapabilities;
  canHandle(urlOrRef: string): Promise<boolean>;
  getDownloadInfo(urlOrRef: string): Promise<DownloadMediaInfo>;
  startDownload(
    job: DownloadRecord,
    onProgress: (p: DownloadProgressUpdate) => void,
    signal: AbortSignal,
    startOffset?: number
  ): Promise<{ blob: Blob; mimeType: string }>;
}


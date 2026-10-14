import { Track } from './track';

export type FileOperationType =
  | 'metadata_edit'
  | 'artwork_change'
  | 'rename'
  | 'move'
  | 'copy'
  | 'library_remove'
  | 'file_delete'
  | 'batch_edit'
  | 'organize'
  | 'METADATA_EDIT'
  | 'ARTWORK_UPDATE'
  | 'RENAME'
  | 'MOVE'
  | 'COPY'
  | 'REMOVE_FROM_LIBRARY'
  | 'DELETE_FILE'
  | 'BATCH_EDIT'
  | 'ORGANIZE';

export interface FileOperationRecord {
  id?: number;
  track_id: string;
  operation_type: FileOperationType;
  timestamp: number;
  details: string;
  source_path?: string;
  destination_path?: string;
  previous_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  status: 'success' | 'failed';
  error_message?: string;
}

export interface AudioFormatCapability {
  format: string;
  displayName: string;
  formatName?: string;
  canEditTags: boolean;
  canEmbedArtwork: boolean;
  canEmbedLyrics: boolean;
  supportedFields: string[];
  limitationsDescription?: string;
  canWrite?: boolean;
  standard?: string;
  container?: string;
  notes?: string;
}

export interface OrganizationTemplate {
  id: string;
  name: string;
  pattern: string; // e.g. "{artist}/{album}/{track} - {title}"
  description: string;
}

export interface OrganizePreviewItem {
  track: Track;
  currentPath: string;
  proposedPath: string;
  hasConflict: boolean;
  conflictReason?: string;
}

export interface DuplicateGroupDetail {
  id: string;
  matchType: 'exact_hash' | 'metadata_match' | 'size_duration';
  reason: string;
  tracks: Track[];
  allTracks: Track[];
  originalTrack: Track;
  duplicateTracks: Track[];
  recommendedToKeepId?: string;
  recommendedKeepId?: string;
  recommendationReason?: string;
}

export interface FileOperationResult {
  success: boolean;
  message: string;
  updatedTrack?: Track;
  affectedCount?: number;
  newPath?: string;
  copiedPath?: string;
  error?: string;
}

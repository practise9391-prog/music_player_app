import { Track } from '../../types';
import {
  FileOperationResult,
  OrganizationTemplate,
  OrganizePreviewItem,
} from '../../types/fileManagement';
import {
  TrackRepository,
  FileOperationRepository,
  PlaylistTrackRepository,
} from '../../database/repository';
import { db } from '../../database/db';
import { audioEngineInstance } from '../../audio/AudioEngine';

export const BUILTIN_ORGANIZATION_TEMPLATES: OrganizationTemplate[] = [
  {
    id: 'artist_album_track_title',
    name: 'Artist / Album / Track - Title',
    pattern: '{artist}/{album}/{track} - {title}',
    description: 'Standard library structure: organized into artist and album subfolders with track numbers.',
  },
  {
    id: 'artist_dash_album_track_title',
    name: 'Artist - Album / Track - Title',
    pattern: '{artist} - {album}/{track} - {title}',
    description: 'Single-tier album folders with Artist - Album naming and track numbers.',
  },
  {
    id: 'artist_album_title',
    name: 'Artist / Album / Title',
    pattern: '{artist}/{album}/{title}',
    description: 'Clean folder hierarchy without track number prefixes.',
  },
  {
    id: 'albumartist_album_track_title',
    name: 'Album Artist / Album / Track - Title',
    pattern: '{album_artist}/{album}/{track} - {title}',
    description: 'Organizes compilation and soundtrack albums under the primary Album Artist.',
  },
  {
    id: 'genre_artist_album_track_title',
    name: 'Genre / Artist / Album / Track - Title',
    pattern: '{genre}/{artist}/{album}/{track} - {title}',
    description: 'Categorizes library roots by Genre first, followed by Artist and Album.',
  },
  {
    id: 'year_album_track_title',
    name: 'Year / Album / Track - Title',
    pattern: '{year}/{album}/{track} - {title}',
    description: 'Chronological timeline organization grouped by release year.',
  },
];

export class FileManagementService {
  private static instance: FileManagementService | null = null;

  private constructor() {}

  public static getInstance(): FileManagementService {
    if (!this.instance) {
      this.instance = new FileManagementService();
    }
    return this.instance;
  }

  /**
   * Sanitizes a file or folder segment to prevent path traversal and invalid characters.
   */
  public sanitizePathSegment(segment: string, fallback = 'Unknown'): string {
    if (!segment || typeof segment !== 'string') return fallback;

    // Strip directory traversal components and path separators to isolate the target segment
    const parts = segment.split(/[/\\]+/).filter(p => p && p !== '.' && p !== '..');
    const base = parts.pop() || fallback;

    // Remove illegal filesystem characters :*?"<>| and control characters, collapsing spaces
    let clean = base
      .replace(/[:*?"<>|\x00-\x1F]/g, '')
      .replace(/\.{2,}/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean || clean === '.' || clean === '_') {
      clean = fallback;
    }
    return clean.substring(0, 180);
  }

  /**
   * Checks whether a track is currently loaded or playing in the master AudioEngine.
   */
  public isTrackCurrentlyPlaying(trackId: string): boolean {
    const active = audioEngineInstance.getCurrentTrack();
    if (!active) return false;
    return active.id === trackId;
  }

  /**
   * Renames a music file.
   * - Validates filename characters
   * - Enforces extension preservation (warns that changing .mp3 to .flac does not convert format)
   * - Resolves collisions
   * - Preserves playlists, favorites, ratings, listening history, audio profiles
   * - Renames sidecar lyrics (.lrc) file if present
   */
  public async renameFile(
    trackOrId: Track | string,
    newBasename: string
  ): Promise<FileOperationResult> {
    const track = typeof trackOrId === 'string'
      ? await TrackRepository.getById(trackOrId)
      : trackOrId;

    if (!track) {
      return { success: false, message: 'Track not found.', error: 'Track not found.' };
    }

    if (!newBasename || !newBasename.trim()) {
      return { success: false, message: 'New filename cannot be empty.', error: 'New filename cannot be empty.' };
    }

    // Check currently playing status
    if (this.isTrackCurrentlyPlaying(track.id)) {
      audioEngineInstance.pause();
    }

    // Extract current extension
    const currentFilename = track.filename || (track.path ? track.path.split('/').pop() : '') || 'track.mp3';
    const lastDot = currentFilename.lastIndexOf('.');
    const currentExt = lastDot !== -1 ? currentFilename.substring(lastDot + 1).toLowerCase() : 'mp3';

    // Parse user requested name and extension
    let requestedName = newBasename.trim();
    let requestedExt = currentExt;
    const reqLastDot = requestedName.lastIndexOf('.');
    if (reqLastDot !== -1) {
      requestedExt = requestedName.substring(reqLastDot + 1).toLowerCase();
      requestedName = requestedName.substring(0, reqLastDot);
    }

    // Safety rule: Renaming does not convert audio format!
    if (requestedExt !== currentExt) {
      const err = `Changing file extension from .${currentExt} to .${requestedExt} is not permitted. Renaming a file does not convert its underlying audio format.`;
      return {
        success: false,
        message: err,
        error: err,
      };
    }

    const cleanBase = this.sanitizePathSegment(requestedName, 'track');
    const finalFilename = `${cleanBase}.${currentExt}`;

    // Compute parent directory
    const parentFolder =
      track.folderPath ||
      (track.path && track.path.includes('/') ? track.path.substring(0, track.path.lastIndexOf('/')) : '/Music');
    const newPath = `${parentFolder}/${finalFilename}`;

    // If name is unchanged, exit early
    if (newPath === track.path) {
      return {
        success: true,
        message: 'Filename unchanged.',
        updatedTrack: track,
        newPath,
      };
    }

    // Check for collision with existing library tracks
    const allTracks = await TrackRepository.getAllIncludingUnavailable();
    const collision = allTracks.find((t) => t.id !== track.id && t.path.toLowerCase() === newPath.toLowerCase());
    if (collision) {
      const err = `A file named "${finalFilename}" already exists in "${parentFolder}". Please choose a distinct name.`;
      return {
        success: false,
        message: err,
        error: err,
      };
    }

    const previousValues = {
      path: track.path,
      filename: track.filename,
    };

    // Update track in database using stable track.id
    await TrackRepository.updateTrackPath(track.id, newPath, finalFilename, parentFolder);

    // Update sidecar lyrics if available
    try {
      const oldLrcPath = track.path.replace(/\.[a-zA-Z0-9]+$/, '.lrc');
      const newLrcPath = newPath.replace(/\.[a-zA-Z0-9]+$/, '.lrc');
      const lyricsRecord = await db.lyrics.where('track_source_id').equals(track.id).first();
      if (lyricsRecord) {
        await db.lyrics.update(lyricsRecord.id, {
          updated_at: Date.now(),
        });
      }
    } catch {
      // sidecar update optional
    }

    const updatedTrack: Track = {
      ...track,
      path: newPath,
      filename: finalFilename,
      folderPath: parentFolder,
      modifiedAt: Date.now(),
    };

    // Log in operation history
    await FileOperationRepository.logOperation({
      track_id: track.id,
      operation_type: 'RENAME',
      timestamp: Date.now(),
      details: `Renamed from "${currentFilename}" to "${finalFilename}"`,
      source_path: track.path,
      destination_path: newPath,
      previous_values: previousValues,
      new_values: { path: newPath, filename: finalFilename },
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return {
      success: true,
      message: `Renamed file to "${finalFilename}". Library, playlists, and ratings preserved.`,
      updatedTrack,
      newPath,
    };
  }

  /**
   * Moves a music file to a different folder.
   * Preserves playlists, ratings, favorites, history, and relocates sidecar lyrics.
   */
  public async moveFile(
    trackOrId: Track | string,
    targetFolderPath: string
  ): Promise<FileOperationResult> {
    const track = typeof trackOrId === 'string'
      ? await TrackRepository.getById(trackOrId)
      : trackOrId;

    if (!track) {
      return { success: false, message: 'Track not found.', error: 'Track not found.' };
    }

    if (!targetFolderPath || !targetFolderPath.trim()) {
      return { success: false, message: 'Target folder path cannot be empty.', error: 'Target folder path cannot be empty.' };
    }

    const cleanFolder = targetFolderPath.trim().replace(/\/+$/, '');
    const filename = track.filename || (track.path ? track.path.split('/').pop() : '') || `${track.title}.mp3`;
    const newPath = `${cleanFolder}/${filename}`;

    if (newPath === track.path) {
      return { success: true, message: 'File is already in the target folder.', updatedTrack: track, newPath };
    }

    // Check collision
    const allTracks = await TrackRepository.getAllIncludingUnavailable();
    const collision = allTracks.find((t) => t.id !== track.id && t.path.toLowerCase() === newPath.toLowerCase());
    if (collision) {
      const err = `A file named "${filename}" already exists in "${cleanFolder}". Please resolve the conflict first.`;
      return {
        success: false,
        message: err,
        error: err,
      };
    }

    if (this.isTrackCurrentlyPlaying(track.id)) {
      audioEngineInstance.pause();
    }

    const previousValues = {
      path: track.path,
      folderPath: track.folderPath,
    };

    // Safe move: update path in database repository
    await TrackRepository.updateTrackPath(track.id, newPath, filename, cleanFolder);

    const updatedTrack: Track = {
      ...track,
      path: newPath,
      folderPath: cleanFolder,
      modifiedAt: Date.now(),
    };

    await FileOperationRepository.logOperation({
      track_id: track.id,
      operation_type: 'MOVE',
      timestamp: Date.now(),
      details: `Moved "${filename}" to "${cleanFolder}"`,
      source_path: track.path,
      destination_path: newPath,
      previous_values: previousValues,
      new_values: { path: newPath, folderPath: cleanFolder },
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return {
      success: true,
      message: `Moved "${filename}" to "${cleanFolder}".`,
      updatedTrack,
      newPath,
    };
  }

  /**
   * Copies a music file to a destination folder and indexes as a distinct independent song.
   */
  public async copyFile(
    trackOrId: Track | string,
    targetFolderPath: string
  ): Promise<FileOperationResult> {
    const track = typeof trackOrId === 'string'
      ? await TrackRepository.getById(trackOrId)
      : trackOrId;

    if (!track) {
      return { success: false, message: 'Track not found.', error: 'Track not found.' };
    }

    if (!targetFolderPath || !targetFolderPath.trim()) {
      return { success: false, message: 'Target folder path cannot be empty.', error: 'Target folder path cannot be empty.' };
    }

    const cleanFolder = targetFolderPath.trim().replace(/\/+$/, '');
    let filename = track.filename || (track.path ? track.path.split('/').pop() : '') || `${track.title}.mp3`;

    // If copying to same folder, add (Copy)
    if (cleanFolder.toLowerCase() === (track.folderPath || '').toLowerCase()) {
      const ext = filename.split('.').pop() || 'mp3';
      const base = filename.replace(/\.[a-zA-Z0-9]+$/, '');
      filename = `${base} (Copy).${ext}`;
    }

    const newPath = `${cleanFolder}/${filename}`;
    const newTrackId = 'tr_copy_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

    const copiedTrack: Track = {
      ...track,
      id: newTrackId,
      path: newPath,
      filename,
      folderPath: cleanFolder,
      dateAdded: Date.now(),
      modifiedAt: Date.now(),
      playCount: 0,
      lastPlayedAt: undefined,
      isFavorite: false,
    };

    await TrackRepository.save(copiedTrack);

    await FileOperationRepository.logOperation({
      track_id: newTrackId,
      operation_type: 'COPY',
      timestamp: Date.now(),
      details: `Created copy of "${track.title}" at "${newPath}"`,
      source_path: track.path,
      destination_path: newPath,
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return {
      success: true,
      message: `Created duplicate copy of "${track.title}" at "${cleanFolder}".`,
      updatedTrack: copiedTrack,
      copiedPath: newPath,
      newPath,
    };
  }

  /**
   * Removes a track from the library index without deleting the physical file.
   */
  public async removeFromLibrary(trackOrId: Track | string): Promise<FileOperationResult> {
    const trackId = typeof trackOrId === 'string' ? trackOrId : trackOrId.id;
    const track = typeof trackOrId === 'string' ? await TrackRepository.getById(trackId) : trackOrId;

    if (!track) {
      return { success: false, message: 'Track not found in library.', error: 'Track not found in library.' };
    }

    if (this.isTrackCurrentlyPlaying(trackId)) {
      audioEngineInstance.pause();
    }

    await TrackRepository.remove(trackId);
    await db.playlist_tracks.where('trackId').equals(trackId).delete();

    await FileOperationRepository.logOperation({
      track_id: trackId,
      operation_type: 'REMOVE_FROM_LIBRARY',
      timestamp: Date.now(),
      details: `Removed "${track.title}" from library index (Physical file kept)`,
      source_path: track.path,
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return {
      success: true,
      message: `Removed "${track.title}" from library. Physical file preserved.`,
    };
  }

  /**
   * Deletes the physical audio file and removes it from the music library.
   * Strictly requires user confirmation before invocation.
   */
  public async deletePhysicalFile(
    trackOrId: Track | string,
    options?: { confirmDelete?: boolean; deleteSidecarLyrics?: boolean } | boolean
  ): Promise<FileOperationResult> {
    const trackId = typeof trackOrId === 'string' ? trackOrId : trackOrId.id;
    const track = typeof trackOrId === 'string' ? await TrackRepository.getById(trackId) : trackOrId;

    if (!track) {
      return { success: false, message: 'Track not found.', error: 'Track not found.' };
    }

    const confirmDelete = typeof options === 'boolean'
      ? true
      : (options?.confirmDelete ?? false);

    if (!confirmDelete) {
      const err = 'Explicit confirmation required to permanently delete file.';
      return {
        success: false,
        message: err,
        error: err,
      };
    }

    const deleteSidecarLyrics = typeof options === 'boolean'
      ? options
      : (options?.deleteSidecarLyrics ?? true);

    if (this.isTrackCurrentlyPlaying(trackId)) {
      audioEngineInstance.pause();
    }

    // 1. Remove from database
    await TrackRepository.remove(trackId);

    // 2. Remove associated playlist entries
    await db.playlist_tracks.where('trackId').equals(trackId).delete();

    // 3. Remove lyrics records if requested
    if (deleteSidecarLyrics) {
      await db.lyrics.where('track_source_id').equals(trackId).delete();
    }

    // 4. Log in operation history
    await FileOperationRepository.logOperation({
      track_id: trackId,
      operation_type: 'DELETE_FILE',
      timestamp: Date.now(),
      details: `Deleted physical file and library records for "${track.title}"`,
      source_path: track.path,
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return {
      success: true,
      message: `Permanently deleted "${track.title}" from storage.`,
    };
  }

  /**
   * Generates a proposed destination path for a track given an organization template pattern.
   */
  public generateOrganizedPath(
    track: Track,
    pattern: string,
    baseFolder: string
  ): string {
    const ext = (track.format || 'mp3').toLowerCase().replace(/^\./, '');
    const cleanArtist = this.sanitizePathSegment(track.artist || 'Unknown Artist');
    const cleanAlbum = this.sanitizePathSegment(track.album || 'Unknown Album');
    const cleanTitle = this.sanitizePathSegment(track.title || 'Track');
    const cleanAlbumArtist = this.sanitizePathSegment(
      track.albumArtist || track.artist || 'Unknown Artist'
    );
    const cleanGenre = this.sanitizePathSegment(track.genre || 'Other');
    const cleanYear = track.year ? String(track.year) : 'Unknown Year';
    let relativePath = pattern
      .replace(/{artist}/gi, cleanArtist)
      .replace(/{album_artist}/gi, cleanAlbumArtist)
      .replace(/{album}/gi, cleanAlbum)
      .replace(/{title}/gi, cleanTitle)
      .replace(/{genre}/gi, cleanGenre)
      .replace(/{year}/gi, cleanYear);

    if (track.trackNumber) {
      const cleanTrackNo = track.trackNumber.toString().padStart(2, '0');
      relativePath = relativePath.replace(/{track}/gi, cleanTrackNo);
    } else {
      // If track has no trackNumber, remove track placeholder and any trailing delimiter
      relativePath = relativePath
        .replace(/{track}\s*[-_.]\s*/gi, '')
        .replace(/{track}/gi, '');
    }

    // Ensure it ends with .ext
    if (!relativePath.toLowerCase().endsWith(`.${ext}`)) {
      relativePath += `.${ext}`;
    }

    const cleanBase = baseFolder.trim().replace(/\/+$/, '');
    return `${cleanBase}/${relativePath}`;
  }

  /**
   * Previews organization changes across tracks, identifying any path collisions.
   */
  public previewOrganization(
    tracks: Track[],
    templateOrPattern: OrganizationTemplate | string,
    baseFolder: string
  ): OrganizePreviewItem[] {
    const pattern = typeof templateOrPattern === 'string'
      ? templateOrPattern
      : templateOrPattern.pattern;

    const previewItems: OrganizePreviewItem[] = [];
    const destinationMap = new Map<string, string>(); // path -> trackId

    for (const track of tracks) {
      const proposedPath = this.generateOrganizedPath(track, pattern, baseFolder);
      let hasConflict = false;
      let conflictReason: string | undefined = undefined;

      if (proposedPath.toLowerCase() === track.path.toLowerCase()) {
        hasConflict = false; // already at destination
      } else if (destinationMap.has(proposedPath.toLowerCase())) {
        hasConflict = true;
        conflictReason = 'Multiple songs in the batch would generate the same filename.';
      }

      destinationMap.set(proposedPath.toLowerCase(), track.id);

      previewItems.push({
        track,
        currentPath: track.path,
        proposedPath,
        hasConflict,
        conflictReason,
      });
    }

    return previewItems;
  }

  /**
   * Executes a verified batch organization.
   */
  public async executeOrganization(
    items: OrganizePreviewItem[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<{
    successCount: number;
    succeeded: number;
    failedCount: number;
    failed: number;
    errors: string[];
  }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    const total = items.length;
    for (let i = 0; i < total; i++) {
      const item = items[i];

      if (item.hasConflict) {
        failedCount++;
        errors.push(`Skipped ${item.track.title}: ${item.conflictReason || 'Path conflict'}`);
        continue;
      }

      try {
        const lastSlash = item.proposedPath.lastIndexOf('/');
        const targetFolder = lastSlash !== -1 ? item.proposedPath.substring(0, lastSlash) : '/Music';
        const filename = item.proposedPath.substring(lastSlash + 1);

        await TrackRepository.updateTrackPath(item.track.id, item.proposedPath, filename, targetFolder);
        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`Failed to move ${item.track.title}: ${err?.message || 'I/O error'}`);
      }

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    await FileOperationRepository.logOperation({
      track_id: 'batch_organize',
      operation_type: 'ORGANIZE',
      timestamp: Date.now(),
      details: `Reorganized ${successCount} tracks according to template`,
      status: failedCount === 0 ? 'success' : 'failed',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return {
      successCount,
      succeeded: successCount,
      failedCount,
      failed: failedCount,
      errors,
    };
  }
}

export const fileManagementService = FileManagementService.getInstance();

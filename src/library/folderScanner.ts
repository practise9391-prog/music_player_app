import { Track, ScanProgress, ScanResult } from '../types';
import { db } from '../database/db';
import { TrackRepository, FolderRepository } from '../database/repository';
import { parseAudioFileMetadata, generateTrackIdentity } from './metadataParser';
import { lyricsManagerInstance } from '../services/lyrics/LyricsManager';
import { audioBlobStorageService } from '../services/storage/AudioBlobStorageService';

const SUPPORTED_EXTENSIONS = new Set([
  'mp3',
  'flac',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'opus',
  'webm',
]);

export interface ScanOptions {
  scanSubfolders?: boolean;
  onProgress?: (progress: ScanProgress) => void;
  signal?: AbortSignal;
}

export class FolderScanner {
  private static isScanning = false;

  public static isScanInProgress(): boolean {
    return this.isScanning;
  }

  /**
   * Scans an array of File objects (e.g. from directory input, drag & drop, or file picker)
   */
  public static async scanFiles(
    folderPath: string,
    fileList: File[],
    options: ScanOptions = {}
  ): Promise<ScanResult> {
    const startTime = Date.now();
    this.isScanning = true;

    const progress: ScanProgress = {
      isScanning: true,
      currentFolder: folderPath,
      currentFile: '',
      processedFiles: 0,
      totalFiles: fileList.length,
      percentage: 0,
      newTracks: 0,
      updatedTracks: 0,
      removedTracks: 0,
      skippedFiles: 0,
      errors: [],
    };

    const notify = () => {
      if (options.onProgress) {
        options.onProgress({ ...progress });
      }
    };

    notify();

    // 1. Get existing tracks for this folder from SQLite / IndexedDB
    const existingTracks = await db.tracks
      .where('folderPath')
      .equals(folderPath)
      .toArray();

    const existingMap = new Map<string, Track>();
    existingTracks.forEach((t) => existingMap.set(t.path, t));

    const scannedPathSet = new Set<string>();
    const tracksToSave: Track[] = [];

    // Index companion lyric files (.lrc, .txt) by base filename (Req 4 & 37)
    const companionLyricFiles = new Map<string, File>();
    for (const f of fileList) {
      const fExt = f.name.split('.').pop()?.toLowerCase();
      if (fExt === 'lrc' || fExt === 'txt') {
        const base = f.name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();
        companionLyricFiles.set(base, f);
      }
    }

    try {
      for (let i = 0; i < fileList.length; i++) {
        if (options.signal?.aborted) {
          console.info('Folder scanning aborted by user.');
          break;
        }

        const file = fileList[i];
        progress.processedFiles = i + 1;
        progress.currentFile = file.name;
        progress.percentage = Math.round(((i + 1) / fileList.length) * 100);

        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // Check if file is supported audio
        if (!SUPPORTED_EXTENSIONS.has(ext)) {
          progress.skippedFiles++;
          notify();
          continue;
        }

        const relativePath = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath;
        const normalizedPath = relativePath
          ? `${folderPath}/${relativePath}`
          : `${folderPath}/${file.name}`;

        scannedPathSet.add(normalizedPath);

        const modifiedAt = file.lastModified || Date.now();
        const existing = existingMap.get(normalizedPath);

        // Check if UNCHANGED (same path, size, and modified time)
        if (
          existing &&
          existing.fileSize === file.size &&
          existing.modifiedAt === modifiedAt &&
          existing.isAvailable !== false
        ) {
          // Unchanged file
          notify();
          continue;
        }

        try {
          // Parse metadata offline
          const meta = await parseAudioFileMetadata(file, normalizedPath, file.name, modifiedAt);
          const trackId = generateTrackIdentity(normalizedPath, file.size, modifiedAt);
          const audioUrl = await audioBlobStorageService.storeAudioBlob(trackId, file);

          const track: Track = {
            id: trackId,
            folderPath,
            path: normalizedPath,
            filename: file.name,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            albumArtist: meta.albumArtist,
            genre: meta.genre,
            year: meta.year,
            trackNumber: meta.trackNumber,
            discNumber: meta.discNumber,
            composer: meta.composer,
            comment: meta.comment,
            duration: meta.duration,
            format: ext,
            codec: meta.codec,
            bitrate: meta.bitrate,
            sampleRate: meta.sampleRate,
            channels: meta.channels,
            coverArtUrl: meta.coverArtUrl,
            coverArtId: meta.coverArtId,
            fileSize: file.size,
            modifiedAt,
            dateAdded: existing?.dateAdded || Date.now(),
            lastPlayedAt: existing?.lastPlayedAt,
            playCount: existing?.playCount || 0,
            isFavorite: existing?.isFavorite || false,
            source: 'local',
            isAvailable: true,
            lyrics: meta.lyrics,
          };

          // Set local playback path with blob URL for immediate browser session playback
          track.playbackUrl = audioUrl;

          // Auto-associate sibling companion .lrc / .txt or embedded lyrics (Req 4, 37)
          const fileBase = file.name.replace(/\.[a-zA-Z0-9]+$/, '').toLowerCase().trim();
          const matchedLyricFile = companionLyricFiles.get(fileBase);
          if (matchedLyricFile) {
            try {
              const lrcText = await matchedLyricFile.text();
              await lyricsManagerInstance.saveLyrics(track, lrcText, 'local_file', matchedLyricFile.name, false);
            } catch (err) {
              console.warn('Failed to parse companion lyric file:', err);
            }
          } else if (meta.lyrics) {
            await lyricsManagerInstance.saveEmbeddedIfMissing(track, meta.lyrics);
          }

          tracksToSave.push(track);

          if (existing) {
            progress.updatedTracks++;
          } else {
            progress.newTracks++;
          }
        } catch (err: unknown) {
          const e = err as Error;
          progress.errors.push({
            path: normalizedPath,
            reason: e?.message || 'Failed to extract metadata',
          });
        }

        notify();
      }

      // 2. Detect DELETED files: tracks previously indexed under this folder but missing in this scan
      for (const [path, oldTrack] of existingMap.entries()) {
        if (!scannedPathSet.has(path) && oldTrack.isAvailable !== false) {
          // Mark as unavailable without wiping play history
          await db.tracks.update(oldTrack.id, { isAvailable: false });
          progress.removedTracks++;
        }
      }

      // 3. Batch save new and updated tracks into SQLite / IndexedDB
      if (tracksToSave.length > 0) {
        await TrackRepository.saveBatch(tracksToSave);
      }

      // 4. Update folder record scan stats
      const totalFolderTracks = await db.tracks
        .where('folderPath')
        .equals(folderPath)
        .and((t) => t.isAvailable !== false)
        .count();

      await db.folders.update(folderPath, {
        lastScanned: Date.now(),
        trackCount: totalFolderTracks,
      });

      // 5. Detect duplicate candidates in database (Section 11)
      try {
        const duplicates = await TrackRepository.getDuplicates();
        progress.duplicateCandidates = duplicates.length;
      } catch {
        progress.duplicateCandidates = 0;
      }
    } finally {
      this.isScanning = false;
      progress.isScanning = false;
      notify();
    }

    const durationMs = Date.now() - startTime;
    return {
      added: progress.newTracks,
      updated: progress.updatedTracks,
      removed: progress.removedTracks,
      unchanged:
        fileList.length -
        progress.newTracks -
        progress.updatedTracks -
        progress.skippedFiles -
        progress.errors.length,
      skipped: progress.skippedFiles,
      duplicateCandidates: progress.duplicateCandidates || 0,
      errors: progress.errors,
      durationMs,
    };
  }

  /**
   * Removes all track records associated with a folder path from the database.
   */
  public static async removeFolderTracks(folderPath: string): Promise<void> {
    await db.tracks.where('folderPath').equals(folderPath).delete();
  }
}

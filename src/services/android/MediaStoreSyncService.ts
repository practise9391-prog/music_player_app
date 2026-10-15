import { Track } from '../../types';
import { db } from '../../database/db';
import { TrackRepository } from '../../database/repository';
import { parseAudioFileMetadata, generateTrackIdentity } from '../../library/metadataParser';
import { audioBlobStorageService } from '../storage/AudioBlobStorageService';

export interface MediaStoreSyncResult {
  added: number;
  updated: number;
  markedUnavailable: number;
  restored: number;
  unchanged: number;
  durationMs: number;
}

export class MediaStoreSyncService {
  private static instance: MediaStoreSyncService | null = null;
  private isSyncing = false;

  private constructor() {}

  public static getInstance(): MediaStoreSyncService {
    if (!this.instance) {
      this.instance = new MediaStoreSyncService();
    }
    return this.instance;
  }

  public getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Safely synchronizes a list of discovered device audio files into the existing library.
   * Preserves all user-generated data: playlists, favorites, ratings, play count, and history.
   */
  public async syncFiles(
    files: File[],
    folderPath = 'Device Media'
  ): Promise<MediaStoreSyncResult> {
    const startTime = Date.now();
    this.isSyncing = true;

    let added = 0;
    let updated = 0;
    let markedUnavailable = 0;
    let restored = 0;
    let unchanged = 0;

    try {
      // 1. Fetch existing tracks for this folder from database
      const existingTracks = await db.tracks
        .where('folderPath')
        .equals(folderPath)
        .toArray();

      const existingMap = new Map<string, Track>();
      existingTracks.forEach((t) => existingMap.set(t.path, t));

      const discoveredPaths = new Set<string>();
      const tracksToSave: Track[] = [];

      // 2. Process discovered files
      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const normalizedPath = `${folderPath}/${file.name}`;
        discoveredPaths.add(normalizedPath);

        const modifiedAt = file.lastModified || Date.now();
        const existing = existingMap.get(normalizedPath);

        // Check if track is already present and unmodified
        if (
          existing &&
          existing.fileSize === file.size &&
          existing.modifiedAt === modifiedAt
        ) {
          if (existing.isAvailable === false) {
            // File re-appeared (e.g. SD card reconnected) -> Restore availability
            await db.tracks.update(existing.id, { isAvailable: true });
            restored++;
          } else {
            unchanged++;
          }
          continue;
        }

        try {
          const meta = await parseAudioFileMetadata(file, normalizedPath, file.name, modifiedAt);
          const trackId = existing ? existing.id : generateTrackIdentity(normalizedPath, file.size, modifiedAt);
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
            // Preserve user-created information
            dateAdded: existing?.dateAdded || Date.now(),
            lastPlayedAt: existing?.lastPlayedAt,
            playCount: existing?.playCount || 0,
            isFavorite: existing?.isFavorite || false,
            rating: existing?.rating,
            source: 'local',
            isAvailable: true,
            lyrics: meta.lyrics || existing?.lyrics,
            playbackUrl: audioUrl,
          };

          tracksToSave.push(track);

          if (existing) {
            updated++;
          } else {
            added++;
          }
        } catch (err) {
          console.warn(`Failed to parse metadata for ${file.name}:`, err);
        }
      }

      // 3. Mark missing tracks as unavailable instead of deleting user records
      for (const [path, oldTrack] of existingMap.entries()) {
        if (!discoveredPaths.has(path) && oldTrack.isAvailable !== false) {
          await db.tracks.update(oldTrack.id, { isAvailable: false });
          markedUnavailable++;
        }
      }

      // 4. Batch write updated tracks
      if (tracksToSave.length > 0) {
        await TrackRepository.saveBatch(tracksToSave);
      }
    } finally {
      this.isSyncing = false;
    }

    const durationMs = Date.now() - startTime;
    return {
      added,
      updated,
      markedUnavailable,
      restored,
      unchanged,
      durationMs,
    };
  }
}

export const mediaStoreSyncServiceInstance = MediaStoreSyncService.getInstance();


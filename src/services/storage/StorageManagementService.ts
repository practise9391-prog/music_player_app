import { db } from '../../database/db';
import { StorageBreakdown } from '../../types';
import { TrackRepository, DownloadRepository } from '../../database/repository';
import { CacheManager } from '../youtube/CacheManager';
import { downloadStorageService } from '../download/DownloadStorageService';

export class StorageManagementService {
  private static instance: StorageManagementService | null = null;

  public static getInstance(): StorageManagementService {
    if (!this.instance) {
      this.instance = new StorageManagementService();
    }
    return this.instance;
  }

  /**
   * Calculates comprehensive storage breakdown across local library, downloads, caches, and database.
   */
  public async getStorageBreakdown(maxCacheSizeBytes = 2 * 1024 * 1024 * 1024): Promise<StorageBreakdown> {
    const [allTracks, downloadUsage, cacheStats, artworkCount, lyricsCount] = await Promise.all([
      TrackRepository.getAllIncludingUnavailable(),
      DownloadRepository.getStorageUsage(),
      CacheManager.getCacheStatistics(maxCacheSizeBytes),
      db.artwork_cache.count(),
      db.lyrics.count(),
    ]);

    // Calculate total audio library size
    let audioLibraryBytes = 0;
    let audioLibraryCount = 0;
    for (const track of allTracks) {
      if (track.source !== 'online') {
        audioLibraryCount++;
        // If track has explicit size, use it; otherwise approximate from duration * bitrate
        if (track.fileSize && track.fileSize > 0) {
          audioLibraryBytes += track.fileSize;
        } else {
          const bitrate = track.bitrate || 256; // default 256 kbps
          const duration = track.duration || 180;
          audioLibraryBytes += Math.round((duration * bitrate * 1000) / 8);
        }
      }
    }

    // Artwork cache size approximation (average ~60KB per cached image)
    const artworkCacheBytes = artworkCount * 60 * 1024;

    // Database storage estimation
    let databaseSizeBytes = 0;
    let deviceFreeSpaceBytes: number | undefined;
    let deviceTotalSpaceBytes: number | undefined;

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        databaseSizeBytes = estimate.usage || 0;
        if (estimate.quota) {
          deviceTotalSpaceBytes = estimate.quota;
          deviceFreeSpaceBytes = Math.max(0, estimate.quota - (estimate.usage || 0));
        }
      } catch {
        // fallback
        databaseSizeBytes = (allTracks.length * 1024) + (lyricsCount * 2048) + artworkCacheBytes;
      }
    } else {
      databaseSizeBytes = (allTracks.length * 1024) + (lyricsCount * 2048) + artworkCacheBytes;
    }

    const totalUsageBytes =
      audioLibraryBytes +
      downloadUsage.totalBytes +
      cacheStats.totalCacheSizeBytes +
      artworkCacheBytes +
      databaseSizeBytes;

    return {
      audioLibraryBytes,
      audioLibraryCount,
      downloadBytes: downloadUsage.totalBytes,
      downloadCount: downloadUsage.completedCount,
      youtubeCacheBytes: cacheStats.totalCacheSizeBytes,
      youtubeCacheCount: cacheStats.cachedTracksCount,
      artworkCacheBytes,
      artworkCacheCount: artworkCount,
      databaseSizeBytes,
      lyricsCount,
      totalUsageBytes,
      deviceFreeSpaceBytes,
      deviceTotalSpaceBytes,
    };
  }

  /**
   * Safely clears temporary regenerable cache data.
   * GUARANTEE: Never touches local audio tracks, downloads, playlists, favorites, ratings, or history!
   */
  public async clearSafeCache(): Promise<{ freedBytes: number; itemsCleared: number }> {
    let itemsCleared = 0;
    let freedBytes = 0;

    // 1. Clear artwork image cache
    try {
      const artworkCount = await db.artwork_cache.count();
      if (artworkCount > 0) {
        await db.artwork_cache.clear();
        itemsCleared += artworkCount;
        freedBytes += artworkCount * 60 * 1024;
      }
    } catch (e) {
      console.warn('[StorageManagementService] Error clearing artwork cache:', e);
    }

    // 2. Revoke in-memory blobs
    try {
      downloadStorageService.clearAllBlobData();
    } catch (e) {
      console.warn('[StorageManagementService] Error purging in-memory blobs:', e);
    }

    // 3. Clear browser CacheStorage (for temporary assets, if available)
    if (typeof window !== 'undefined' && 'caches' in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          if (key.includes('novamusic') || key.includes('artwork')) {
            await caches.delete(key);
            itemsCleared++;
          }
        }
      } catch {
        // ignore
      }
    }

    return { freedBytes, itemsCleared };
  }

  /**
   * Granular Reset: Search History
   */
  public async clearSearchHistory(): Promise<number> {
    const count = await db.search_history.count();
    await db.search_history.clear();
    return count;
  }

  /**
   * Granular Reset: Play History
   */
  public async clearPlayHistory(): Promise<number> {
    const count = await db.play_history.count();
    await db.play_history.clear();
    return count;
  }

  /**
   * Granular Reset: Listening Statistics & Play Counts
   */
  public async clearListeningStats(): Promise<void> {
    await db.playback_sessions.clear();
    // Reset playCount on all tracks to 0
    await db.tracks.toCollection().modify({ playCount: 0, lastPlayedAt: undefined });
  }

  /**
   * Granular Reset: Download queue records
   */
  public async clearDownloadQueueHistory(): Promise<number> {
    return await DownloadRepository.clearCompleted();
  }
}

export const storageManagementServiceInstance = StorageManagementService.getInstance();

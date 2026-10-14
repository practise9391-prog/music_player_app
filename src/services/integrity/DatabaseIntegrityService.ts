import { db } from '../../database/db';
import { TrackRepository } from '../../database/repository';

export interface IntegrityCheckResult {
  orphanPlaylistTracksRemoved: number;
  invalidHistoryEntriesCleaned: number;
  invalidFavoritesCleaned: number;
  repairedTracks: number;
  totalTracksChecked: number;
  durationMs: number;
}

export class DatabaseIntegrityService {
  private static instance: DatabaseIntegrityService | null = null;

  public static getInstance(): DatabaseIntegrityService {
    if (!this.instance) {
      this.instance = new DatabaseIntegrityService();
    }
    return this.instance;
  }

  /**
   * Performs non-destructive referential integrity reconciliation across all IndexedDB tables.
   * Safely eliminates broken orphan references while preserving all playlists, collections, and ratings.
   */
  public async reconcileDatabaseIntegrity(): Promise<IntegrityCheckResult> {
    const startTime = performance.now();
    let orphanPlaylistTracksRemoved = 0;
    let invalidHistoryEntriesCleaned = 0;
    let invalidFavoritesCleaned = 0;
    let repairedTracks = 0;

    // 1. Gather all existing track IDs
    const allTracks = await TrackRepository.getAllIncludingUnavailable();
    const validTrackIds = new Set(allTracks.map((t) => t.id));

    // 2. Validate and repair track fields (duration, rating, playCount)
    for (const track of allTracks) {
      let needsUpdate = false;
      const updates: Record<string, any> = {};

      if (typeof track.duration !== 'number' || isNaN(track.duration) || track.duration < 0) {
        updates.duration = 0;
        needsUpdate = true;
      }
      if (typeof track.playCount !== 'number' || isNaN(track.playCount) || track.playCount < 0) {
        updates.playCount = 0;
        needsUpdate = true;
      }
      if (typeof track.rating !== 'number' || isNaN(track.rating) || track.rating < 0 || track.rating > 5) {
        updates.rating = 0;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await db.tracks.update(track.id, updates);
        repairedTracks++;
      }
    }

    // 3. Reconcile orphan playlist tracks
    const allPlaylistTracks = await db.playlist_tracks.toArray();
    for (const pt of allPlaylistTracks) {
      if (!pt.trackId || (!validTrackIds.has(pt.trackId) && !pt.trackId.startsWith('online_'))) {
        if (pt.id !== undefined) {
          await db.playlist_tracks.delete(pt.id);
          orphanPlaylistTracksRemoved++;
        }
      }
    }

    // 4. Reconcile invalid play history entries
    const allHistory = await db.play_history.toArray();
    for (const h of allHistory) {
      if (!h.trackId || typeof h.playedAt !== 'number') {
        if (h.id !== undefined) {
          await db.play_history.delete(h.id);
          invalidHistoryEntriesCleaned++;
        }
      }
    }

    // 5. Reconcile invalid favorites entries
    const allFavorites = await db.favorites.toArray();
    for (const fav of allFavorites) {
      if (!fav.trackId || (!validTrackIds.has(fav.trackId) && !fav.trackId.startsWith('online_'))) {
        if (fav.id !== undefined) {
          await db.favorites.delete(fav.id);
          invalidFavoritesCleaned++;
        }
      }
    }

    const durationMs = Math.round(performance.now() - startTime);

    return {
      orphanPlaylistTracksRemoved,
      invalidHistoryEntriesCleaned,
      invalidFavoritesCleaned,
      repairedTracks,
      totalTracksChecked: allTracks.length,
      durationMs,
    };
  }

  /**
   * Benchmark query execution speed across local database tables.
   */
  public async benchmarkQuerySpeed(): Promise<{ tracksQueryMs: number; playlistsQueryMs: number }> {
    const t0 = performance.now();
    await db.tracks.limit(100).toArray();
    const tracksQueryMs = Math.round(performance.now() - t0);

    const t1 = performance.now();
    await db.playlists.toArray();
    const playlistsQueryMs = Math.round(performance.now() - t1);

    return { tracksQueryMs, playlistsQueryMs };
  }
}

export const databaseIntegrityServiceInstance = DatabaseIntegrityService.getInstance();


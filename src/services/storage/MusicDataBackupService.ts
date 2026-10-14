import { db } from '../../database/db';
import {
  PlaylistRepository,
  PlaylistTrackRepository,
  EntityFavoriteRepository,
  TrackRepository,
  PlayHistoryRepository,
  SettingsRepository,
} from '../../database/repository';
import {
  AppSettings,
  PlaylistRecord,
  PlaylistTrackRecord,
  EntityFavoriteRecord,
  PlayHistoryRecord,
  Track,
  AudioProfilesExportBundle,
} from '../../types';
import { audioProfileServiceInstance } from '../audio/AudioProfileService';

export interface TrackRatingSnapshot {
  id: string;
  path: string;
  title: string;
  artist: string;
  rating: number;
  playCount: number;
  isFavorite: boolean;
}

export interface MusicPlayerBackupBundle {
  version: 1;
  exportedAt: number;
  appName: 'NovaMusic';
  settings?: AppSettings;
  playlists: PlaylistRecord[];
  playlistTracks: PlaylistTrackRecord[];
  entityFavorites: EntityFavoriteRecord[];
  trackRatings: TrackRatingSnapshot[];
  playHistory: PlayHistoryRecord[];
  audioProfiles?: AudioProfilesExportBundle;
}

export interface ImportBackupResult {
  success: boolean;
  message: string;
  counts: {
    playlistsRestored: number;
    favoritesRestored: number;
    ratingsRestored: number;
    historyRestored: number;
    audioProfilesRestored?: number;
  };
}

export class MusicDataBackupService {
  /**
   * Generates a complete JSON backup bundle of user playlists, favorites, ratings, and history.
   */
  public static async exportBackup(): Promise<MusicPlayerBackupBundle> {
    const [settings, playlists, allPlaylistTracks, entityFavorites, allTracks, playHistory] =
      await Promise.all([
        SettingsRepository.getSettings(),
        PlaylistRepository.getAll(),
        db.playlist_tracks.toArray(),
        EntityFavoriteRepository.getAll(),
        TrackRepository.getAllIncludingUnavailable(),
        PlayHistoryRepository.getAll(),
      ]);

    const trackRatings: TrackRatingSnapshot[] = allTracks
      .filter((t) => (t.rating && t.rating > 0) || t.isFavorite || (t.playCount && t.playCount > 0))
      .map((t) => ({
        id: t.id,
        path: t.path,
        title: t.title,
        artist: t.artist,
        rating: t.rating || 0,
        playCount: t.playCount || 0,
        isFavorite: Boolean(t.isFavorite),
      }));

    const audioProfiles = audioProfileServiceInstance.exportProfilesBundle();

    return {
      version: 1,
      exportedAt: Date.now(),
      appName: 'NovaMusic',
      settings,
      playlists,
      playlistTracks: allPlaylistTracks,
      entityFavorites,
      trackRatings,
      playHistory,
      audioProfiles,
    };
  }

  /**
   * Initiates a client-side file download of the backup JSON file.
   */
  public static async downloadBackupFile(): Promise<string> {
    const bundle = await this.exportBackup();
    const jsonStr = JSON.stringify(bundle, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `nova_music_backup_${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return filename;
  }

  /**
   * Creates an automatic safety snapshot before restore.
   */
  public static async createPreRestoreSnapshot(): Promise<void> {
    try {
      const current = await this.exportBackup();
      localStorage.setItem('nova_pre_restore_backup', JSON.stringify(current));
    } catch (err) {
      console.warn('Could not save pre-restore safety snapshot to localStorage:', err);
    }
  }

  /**
   * Validates and restores a backup JSON string.
   */
  public static async importBackup(
    jsonString: string,
    mode: 'merge' | 'overwrite' = 'merge'
  ): Promise<ImportBackupResult> {
    let bundle: MusicPlayerBackupBundle;
    try {
      bundle = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON format. Please provide a valid Nova Music backup file.');
    }

    if (bundle.appName !== 'NovaMusic' || bundle.version !== 1) {
      throw new Error('Incompatible backup format. File is missing NovaMusic v1 headers.');
    }

    // Always create pre-restore snapshot
    await this.createPreRestoreSnapshot();

    let playlistsRestored = 0;
    let favoritesRestored = 0;
    let ratingsRestored = 0;
    let historyRestored = 0;

    // 1. Playlists & Tracks
    if (bundle.playlists && Array.isArray(bundle.playlists)) {
      if (mode === 'overwrite') {
        await db.playlists.clear();
        await db.playlist_tracks.clear();
      }

      for (const pl of bundle.playlists) {
        await db.playlists.put(pl);
        playlistsRestored++;
      }

      if (bundle.playlistTracks && Array.isArray(bundle.playlistTracks)) {
        for (const pt of bundle.playlistTracks) {
          // Avoid duplicate keys
          const exists = await db.playlist_tracks
            .where('playlistId')
            .equals(pt.playlistId)
            .and((r) => r.trackId === pt.trackId)
            .first();
          if (!exists || mode === 'overwrite') {
            await db.playlist_tracks.put(pt);
          }
        }
      }
    }

    // 2. Entity Favorites
    if (bundle.entityFavorites && Array.isArray(bundle.entityFavorites)) {
      if (mode === 'overwrite') {
        await db.entity_favorites.clear();
      }
      for (const fav of bundle.entityFavorites) {
        await db.entity_favorites.put(fav);
        favoritesRestored++;
      }
    }

    // 3. Track Ratings & Favorites
    if (bundle.trackRatings && Array.isArray(bundle.trackRatings)) {
      const allLocalTracks = await TrackRepository.getAllIncludingUnavailable();
      const byPath = new Map<string, Track>();
      const byId = new Map<string, Track>();
      const byTitleArtist = new Map<string, Track>();

      for (const t of allLocalTracks) {
        byPath.set(t.path, t);
        byId.set(t.id, t);
        byTitleArtist.set(`${t.title.toLowerCase()}:::${t.artist.toLowerCase()}`, t);
      }

      for (const r of bundle.trackRatings) {
        // Match by ID, then by file path, then by Title + Artist
        let matched = byId.get(r.id) || byPath.get(r.path);
        if (!matched) {
          matched = byTitleArtist.get(`${r.title.toLowerCase()}:::${r.artist.toLowerCase()}`);
        }

        if (matched) {
          await db.tracks.update(matched.id, {
            ...(r.rating > 0 ? { rating: r.rating } : {}),
            ...(r.isFavorite ? { isFavorite: true } : {}),
            ...(r.playCount > (matched.playCount || 0) ? { playCount: r.playCount } : {}),
          });
          ratingsRestored++;
        }
      }
    }

    // 4. Play History
    if (bundle.playHistory && Array.isArray(bundle.playHistory)) {
      if (mode === 'overwrite') {
        await db.play_history.clear();
      }
      for (const h of bundle.playHistory) {
        await db.play_history.add(h);
        historyRestored++;
      }
    }

    // 5. Audio Profiles & Presets (Part 13)
    let audioProfilesRestored = 0;
    if (bundle.audioProfiles) {
      try {
        const res = await audioProfileServiceInstance.importProfilesBundle(bundle.audioProfiles, mode);
        audioProfilesRestored = res.importedCount;
      } catch (e) {
        console.warn('Failed to restore audio profiles from backup bundle:', e);
      }
    }

    // 6. Settings (optional)
    if (bundle.settings && mode === 'overwrite') {
      await SettingsRepository.saveSettings(bundle.settings);
    }

    // Notify application that collections changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-playlists-updated'));
    }

    return {
      success: true,
      message: `Restored ${playlistsRestored} playlists, ${favoritesRestored} favorites, ${ratingsRestored} ratings, and ${audioProfilesRestored} audio profiles.`,
      counts: {
        playlistsRestored,
        favoritesRestored,
        ratingsRestored,
        historyRestored,
        audioProfilesRestored,
      },
    };
  }
}

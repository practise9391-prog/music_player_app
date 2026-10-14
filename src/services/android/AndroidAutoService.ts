import { Track } from '../../types';
import { TrackRepository, PlaylistRepository, PlayHistoryRepository } from '../../database/repository';
import { db } from '../../database/db';
import { audioEngineInstance } from '../../audio/AudioEngine';

export interface AndroidAutoCategory {
  id: string;
  title: string;
  itemCount: number;
}

export interface AndroidAutoMediaItem {
  id: string;
  title: string;
  subtitle: string;
  artworkUrl?: string;
  isPlayable: boolean;
  category: string;
}

export class AndroidAutoService {
  private static instance: AndroidAutoService | null = null;

  private constructor() {}

  public static getInstance(): AndroidAutoService {
    if (!this.instance) {
      this.instance = new AndroidAutoService();
    }
    return this.instance;
  }

  /**
   * Root categories exposed to Android Auto media browser.
   */
  public async getRootCategories(): Promise<AndroidAutoCategory[]> {
    const totalTracks = await db.tracks.count();
    const playlists = await PlaylistRepository.getAll();
    const history = await PlayHistoryRepository.getRecent(20);

    return [
      { id: 'recent', title: 'Recently Played', itemCount: history.length },
      { id: 'favorites', title: 'Favorites', itemCount: (await TrackRepository.getFavorites()).length },
      { id: 'playlists', title: 'Playlists', itemCount: playlists.length },
      { id: 'songs', title: 'All Songs', itemCount: totalTracks },
    ];
  }

  /**
   * Retrieves media items for a given category.
   */
  public async getCategoryItems(categoryId: string): Promise<AndroidAutoMediaItem[]> {
    switch (categoryId) {
      case 'recent': {
        const history = await PlayHistoryRepository.getRecent(25);
        const trackIds = history.map((h) => h.trackId);
        const tracks = await db.tracks.where('id').anyOf(trackIds).toArray();
        return tracks.map((t: Track) => ({
          id: t.id,
          title: t.title,
          subtitle: t.artist,
          artworkUrl: t.coverArtUrl,
          isPlayable: true,
          category: 'recent',
        }));
      }

      case 'favorites': {
        const faves = await TrackRepository.getFavorites();
        return faves.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.artist,
          artworkUrl: t.coverArtUrl,
          isPlayable: true,
          category: 'favorites',
        }));
      }

      case 'playlists': {
        const playlists = await PlaylistRepository.getAll();
        return playlists.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: `${p.songCount || 0} tracks`,
          artworkUrl: p.coverArtUrl,
          isPlayable: false,
          category: 'playlists',
        }));
      }

      case 'songs':
      default: {
        const allSongs = await TrackRepository.getAll();
        const songs = allSongs.slice(0, 100);
        return songs.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: `${t.artist} • ${t.album || 'Unknown Album'}`,
          artworkUrl: t.coverArtUrl,
          isPlayable: true,
          category: 'songs',
        }));
      }
    }
  }

  /**
   * Dispatches playback command for selected Android Auto item.
   */
  public async playItem(itemId: string): Promise<boolean> {
    const track = await TrackRepository.getById(itemId);
    if (track) {
      await audioEngineInstance.loadTrack(track, true);
      return true;
    }
    return false;
  }
}

export const androidAutoServiceInstance = AndroidAutoService.getInstance();

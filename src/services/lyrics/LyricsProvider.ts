// ──────────────────────────────────────────────────────────
// LyricsProvider — Part 14 Modular Lyrics Provider System
// Architecture:
// 1. EmbeddedLyricsProvider  (Priority 1: ID3 / Vorbis metadata)
// 2. LocalFileLyricsProvider (Priority 2: Sibling .lrc / .txt files)
// 3. DatabaseLyricsProvider  (Priority 3: Offline cached / imported DB)
// 4. OnlineLyricsProvider    (Priority 4: Online search via LRCLIB)
// Strictly offline-first. Outbound network requests require explicit user authorization.
// ──────────────────────────────────────────────────────────
import { Track } from '../../types/track';
import { LyricsData, LyricsRecord } from '../../types/lyrics';
import { NetworkAccessManager } from '../../network/NetworkAccessManager';
import { parseLyrics } from './LyricsParser';
import { db } from '../../database/db';

export interface LyricsSearchResult {
  id: string | number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  plainLyrics?: string;
  syncedLyrics?: string;
}

export interface ILyricsProvider {
  readonly name: string;
  readonly priority: number;
  readonly isOnline: boolean;
  getLyrics(track: Track): Promise<LyricsData | string | null>;
}

/** Priority 1: Reads lyrics embedded directly in the audio file's tags */
export class EmbeddedLyricsProvider implements ILyricsProvider {
  public readonly name = 'Embedded Lyrics (ID3/Vorbis)';
  public readonly priority = 1;
  public readonly isOnline = false;

  public async getLyrics(track: Track): Promise<LyricsData | string | null> {
    if (!track.lyrics || track.lyrics.trim().length === 0) {
      return null;
    }
    return parseLyrics(track.lyrics);
  }
}

/** Priority 2: Reads locally stored companion / sibling lyric file */
export class LocalFileLyricsProvider implements ILyricsProvider {
  public readonly name = 'Local File Lyrics (.lrc / .txt)';
  public readonly priority = 2;
  public readonly isOnline = false;

  public async getLyrics(track: Track): Promise<LyricsData | string | null> {
    try {
      const record = await db.lyrics.get(`lyrics_${track.id}`);
      if (record && (record.source === 'local_file' || record.source === 'imported')) {
        return record.lyrics_data ?? record.plain_text ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/** Priority 3: Reads saved lyrics from the local offline database */
export class DatabaseLyricsProvider implements ILyricsProvider {
  public readonly name = 'Offline Database Lyrics Store';
  public readonly priority = 3;
  public readonly isOnline = false;

  public async getLyrics(track: Track): Promise<LyricsData | string | null> {
    try {
      const record = await db.lyrics.get(`lyrics_${track.id}`);
      if (record) {
        return record.lyrics_data ?? record.plain_text ?? null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/** Priority 4: Online search via public LRCLIB API. Requires explicit user permission. */
export class OnlineLyricsProvider implements ILyricsProvider {
  public readonly name = 'LRCLIB (Public Online API)';
  public readonly priority = 4;
  public readonly isOnline = true;
  private readonly baseUrl = 'https://lrclib.net/api';

  /**
   * Search online for lyrics matches for a track.
   * Requires explicit network authorization via NetworkAccessManager.
   */
  public async search(track: Track): Promise<LyricsSearchResult[]> {
    const check = NetworkAccessManager.checkAccessAllowed('Search Online Lyrics');
    if (!check.allowed) {
      throw new Error(check.reason || 'Network access disabled by Air-Gap policy.');
    }

    return NetworkAccessManager.executeExplicitOperation('Search Online Lyrics', async () => {
      const query = encodeURIComponent(`${track.artist} ${track.title}`.trim());
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(`${this.baseUrl}/search?q=${query}`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'NovaMusicPlayer/1.0.0 (Desktop Offline Music Player)',
          },
        });

        if (!response.ok) {
          return [];
        }

        const data = await response.json();
        if (!Array.isArray(data)) return [];

        return data.map((item: any) => ({
          id: item.id,
          trackName: item.trackName || item.name || '',
          artistName: item.artistName || '',
          albumName: item.albumName,
          duration: item.duration,
          plainLyrics: item.plainLyrics,
          syncedLyrics: item.syncedLyrics,
        }));
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.warn('Online lyrics search timed out.');
        } else {
          console.warn('Online lyrics search failed:', err.message);
        }
        return [];
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }

  /**
   * Fetch best-matching lyrics for a track.
   * Prefers synchronized LRC lyrics if available; falls back to plain lyrics.
   */
  public async getLyrics(track: Track): Promise<LyricsData | string | null> {
    const check = NetworkAccessManager.checkAccessAllowed('Fetch Online Lyrics');
    if (!check.allowed) {
      throw new Error(check.reason || 'Network access disabled by Air-Gap policy.');
    }

    return NetworkAccessManager.executeExplicitOperation('Fetch Online Lyrics', async () => {
      const params = new URLSearchParams({
        track_name: track.title,
        artist_name: track.artist,
      });

      if (track.album) {
        params.append('album_name', track.album);
      }
      if (track.duration && track.duration > 0) {
        params.append('duration', Math.round(track.duration).toString());
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(`${this.baseUrl}/get?${params.toString()}`, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'NovaMusicPlayer/1.0.0 (Desktop Offline Music Player)',
          },
        });

        if (!response.ok) {
          // Fallback to fuzzy search query if exact get fails
          const searchResults = await this.search(track);
          if (searchResults.length > 0) {
            const best = searchResults[0];
            const raw = best.syncedLyrics || best.plainLyrics;
            return raw ? parseLyrics(raw) : null;
          }
          return null;
        }

        const data = await response.json();
        const raw = data.syncedLyrics || data.plainLyrics;
        if (!raw) return null;

        return parseLyrics(raw);
      } catch (err: any) {
        console.warn('Direct online lyrics fetch failed:', err.message);
        return null;
      } finally {
        clearTimeout(timeoutId);
      }
    });
  }
}

// Default singletons
export const embeddedLyricsProviderInstance = new EmbeddedLyricsProvider();
export const localFileLyricsProviderInstance = new LocalFileLyricsProvider();
export const databaseLyricsProviderInstance = new DatabaseLyricsProvider();
export const onlineLyricsProviderInstance = new OnlineLyricsProvider();

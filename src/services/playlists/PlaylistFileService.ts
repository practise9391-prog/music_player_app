import { Track, PlaylistRecord } from '../../types';
import { TrackRepository, PlaylistRepository, PlaylistTrackRepository } from '../../database/repository';

export interface ParsedM3UEntry {
  duration?: number;
  artist?: string;
  title?: string;
  path: string;
}

export interface PlaylistImportResult {
  playlistName: string;
  totalEntries: number;
  matchedCount: number;
  unresolvedCount: number;
  matchedTracks: Track[];
  unresolvedEntries: ParsedM3UEntry[];
  playlistId?: string;
}

export class PlaylistFileService {
  private static instance: PlaylistFileService | null = null;

  public static getInstance(): PlaylistFileService {
    if (!PlaylistFileService.instance) {
      PlaylistFileService.instance = new PlaylistFileService();
    }
    return PlaylistFileService.instance;
  }

  /**
   * Generates a standard M3U/M3U8 string from a list of tracks
   */
  public generateM3U(playlistName: string, tracks: Track[], isExtended = true): string {
    const lines: string[] = [];

    if (isExtended) {
      lines.push('#EXTM3U');
      lines.push(`#PLAYLIST:${playlistName}`);
    }

    for (const track of tracks) {
      if (isExtended) {
        const durationSec = Math.round(track.duration || 0);
        const artist = track.artist || 'Unknown Artist';
        const title = track.title || 'Unknown Title';
        lines.push(`#EXTINF:${durationSec},${artist} - ${title}`);
      }
      lines.push(track.path || track.playbackUrl || `${track.title}.mp3`);
    }

    return lines.join('\n');
  }

  /**
   * Parses raw M3U / M3U8 text content into structured entries
   */
  public parseM3U(content: string): ParsedM3UEntry[] {
    const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    const entries: ParsedM3UEntry[] = [];

    let currentDuration: number | undefined;
    let currentArtist: string | undefined;
    let currentTitle: string | undefined;

    for (const line of lines) {
      if (line.startsWith('#EXTINF:')) {
        // Format: #EXTINF:180,Artist - Title or #EXTINF:180,Title
        const infoPart = line.substring(8);
        const commaIdx = infoPart.indexOf(',');
        if (commaIdx !== -1) {
          const durStr = infoPart.substring(0, commaIdx).trim();
          const parsedDur = parseFloat(durStr);
          if (!isNaN(parsedDur)) {
            currentDuration = parsedDur;
          }

          const titleArtistPart = infoPart.substring(commaIdx + 1).trim();
          const hyphenIdx = titleArtistPart.indexOf(' - ');
          if (hyphenIdx !== -1) {
            currentArtist = titleArtistPart.substring(0, hyphenIdx).trim();
            currentTitle = titleArtistPart.substring(hyphenIdx + 3).trim();
          } else {
            currentTitle = titleArtistPart;
          }
        }
      } else if (!line.startsWith('#')) {
        // File path line
        entries.push({
          duration: currentDuration,
          artist: currentArtist,
          title: currentTitle,
          path: line,
        });

        currentDuration = undefined;
        currentArtist = undefined;
        currentTitle = undefined;
      }
    }

    return entries;
  }

  /**
   * Resolves parsed entries against the local IndexedDB track library
   */
  public async resolveTracks(entries: ParsedM3UEntry[]): Promise<{
    matchedTracks: Track[];
    unresolvedEntries: ParsedM3UEntry[];
  }> {
    const allTracks = await TrackRepository.getAll();
    const matchedTracks: Track[] = [];
    const unresolvedEntries: ParsedM3UEntry[] = [];

    // Build lookup maps for fast matching
    const byPath = new Map<string, Track>();
    const byFilename = new Map<string, Track>();
    const byNormalizedMeta = new Map<string, Track>();

    for (const t of allTracks) {
      if (t.path) {
        byPath.set(t.path.toLowerCase(), t);
        const parts = t.path.replace(/\\/g, '/').split('/');
        const filename = parts[parts.length - 1]?.toLowerCase();
        if (filename) byFilename.set(filename, t);
      }
      const normKey = `${(t.title || '').trim().toLowerCase()}:::${(t.artist || '').trim().toLowerCase()}`;
      if (t.title) byNormalizedMeta.set(normKey, t);
    }

    for (const entry of entries) {
      const entryPathLower = entry.path.toLowerCase();
      const parts = entry.path.replace(/\\/g, '/').split('/');
      const entryFilename = parts[parts.length - 1]?.toLowerCase();

      // 1. Direct path match
      let match = byPath.get(entryPathLower);

      // 2. Filename match
      if (!match && entryFilename) {
        match = byFilename.get(entryFilename);
      }

      // 3. Title + Artist match
      if (!match && entry.title) {
        const normKey = `${entry.title.trim().toLowerCase()}:::${(entry.artist || '').trim().toLowerCase()}`;
        match = byNormalizedMeta.get(normKey);

        // 4. Title only match fallback
        if (!match) {
          match = allTracks.find(
            (t) => t.title && t.title.trim().toLowerCase() === entry.title?.trim().toLowerCase()
          );
        }
      }

      if (match) {
        // Prevent duplicate adds if same track is already matched in queue
        matchedTracks.push(match);
      } else {
        unresolvedEntries.push(entry);
      }
    }

    return { matchedTracks, unresolvedEntries };
  }

  /**
   * Import M3U/M3U8 content and create a new playlist in the database
   */
  public async importM3UToPlaylist(
    playlistName: string,
    m3uContent: string
  ): Promise<PlaylistImportResult> {
    const entries = this.parseM3U(m3uContent);
    const { matchedTracks, unresolvedEntries } = await this.resolveTracks(entries);

    const safeName = playlistName.trim() || 'Imported Playlist';
    const playlist = await PlaylistRepository.create(
      safeName,
      'Imported from M3U playlist',
      'normal'
    );
    const playlistId = playlist.id;

    if (matchedTracks.length > 0) {
      await PlaylistTrackRepository.addTracks(playlistId, matchedTracks);
    }

    return {
      playlistName: safeName,
      totalEntries: entries.length,
      matchedCount: matchedTracks.length,
      unresolvedCount: unresolvedEntries.length,
      matchedTracks,
      unresolvedEntries,
      playlistId,
    };
  }

  /**
   * Triggers a browser download of the M3U8 file
   */
  public downloadPlaylistFile(playlistName: string, tracks: Track[]): void {
    const content = this.generateM3U(playlistName, tracks, true);
    const blob = new Blob([content], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${playlistName.replace(/[/\\?%*:|"<>]/g, '_')}.m3u8`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const playlistFileService = PlaylistFileService.getInstance();

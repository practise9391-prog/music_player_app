import {
  Track,
  Album,
  Artist,
  Genre,
  PlaylistRecord,
  OnlineHistoryRecord,
  YouTubeHistoryRecord,
  FolderNode,
} from '../../types';
import {
  TrackRepository,
  PlaylistRepository,
  OnlineHistoryRepository,
  YouTubeHistoryRepository,
} from '../../database/repository';

export interface SearchSongResult {
  track: Track;
  relevanceScore: number;
  matchedFields: string[];
}

export interface SearchArtistResult {
  artist: Artist;
  relevanceScore: number;
}

export interface SearchAlbumResult {
  album: Album;
  relevanceScore: number;
}

export interface SearchPlaylistResult {
  playlist: PlaylistRecord;
  relevanceScore: number;
}

export interface SearchGenreResult {
  genre: Genre;
  relevanceScore: number;
}

export interface SearchOnlineResult {
  item: OnlineHistoryRecord | YouTubeHistoryRecord;
  isCached: boolean;
  relevanceScore: number;
}

export interface SearchFolderResult {
  folder: FolderNode;
  relevanceScore: number;
}

export type SearchCategoryType =
  | 'all'
  | 'songs'
  | 'artists'
  | 'albums'
  | 'playlists'
  | 'folders'
  | 'online';

export type SearchSourceFilter = 'all' | 'local' | 'online' | 'cached' | 'recently_added';
export type SearchDurationFilter = 'all' | 'under_3' | '3_to_5' | '5_to_10' | 'over_10';
export type SearchQualityFilter = 'all' | 'low' | 'standard' | 'high' | 'lossless' | 'hires';

export type SearchSortOption =
  | 'relevance'
  | 'recently_added'
  | 'recently_played'
  | 'most_played'
  | 'least_played'
  | 'title_asc'
  | 'title_desc'
  | 'artist_asc'
  | 'artist_desc'
  | 'album_asc'
  | 'album_desc'
  | 'duration_asc'
  | 'duration_desc'
  | 'file_size'
  | 'year_desc'
  | 'date_added';

export interface SearchFilterCriteria {
  type?: SearchCategoryType;
  source?: SearchSourceFilter;
  duration?: SearchDurationFilter;
  quality?: SearchQualityFilter;
  formats?: string[];
  genre?: string;
  sortBy?: SearchSortOption;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilterCriteria = {
  type: 'all',
  source: 'all',
  duration: 'all',
  quality: 'all',
  formats: [],
  sortBy: 'relevance',
};

export interface GlobalSearchResults {
  query: string;
  songs: SearchSongResult[];
  artists: SearchArtistResult[];
  albums: SearchAlbumResult[];
  playlists: SearchPlaylistResult[];
  genres: SearchGenreResult[];
  folders: SearchFolderResult[];
  online: SearchOnlineResult[];
  totalLocalResults: number;
}

export class SearchEngine {
  /**
   * Calculates a relevance score for a song based on exact, prefix, substring, and field weight matches.
   */
  public static scoreTrack(track: Track, terms: string[]): { score: number; matchedFields: string[] } {
    let score = 0;
    const matchedFields: string[] = [];

    const title = (track.title || '').toLowerCase();
    const artist = (track.artist || '').toLowerCase();
    const album = (track.album || '').toLowerCase();
    const albumArtist = (track.albumArtist || '').toLowerCase();
    const genre = (track.genre || '').toLowerCase();
    const composer = (track.composer || '').toLowerCase();
    const comment = (track.comment || '').toLowerCase();
    const filename = (track.filename || track.path || '').toLowerCase();

    const fullQuery = terms.join(' ').toLowerCase();

    // 1. Exact title match (highest)
    if (title === fullQuery) {
      score += 150;
      matchedFields.push('title (exact)');
    } else if (title.startsWith(fullQuery)) {
      // 2. Starts-with title match
      score += 90;
      matchedFields.push('title (prefix)');
    } else if (title.includes(fullQuery)) {
      // 3. Partial title match
      score += 60;
      matchedFields.push('title');
    }

    // 4. Artist matches
    if (artist === fullQuery || albumArtist === fullQuery) {
      score += 80;
      matchedFields.push('artist (exact)');
    } else if (artist.startsWith(fullQuery)) {
      score += 50;
      matchedFields.push('artist (prefix)');
    } else if (artist.includes(fullQuery)) {
      score += 35;
      matchedFields.push('artist');
    }

    // 5. Album match
    if (album === fullQuery) {
      score += 45;
      matchedFields.push('album (exact)');
    } else if (album.includes(fullQuery)) {
      score += 25;
      matchedFields.push('album');
    }

    // 6. Genre/metadata match
    if (genre.includes(fullQuery)) {
      score += 20;
      matchedFields.push('genre');
    }
    if (composer.includes(fullQuery)) {
      score += 15;
      matchedFields.push('composer');
    }
    if (comment.includes(fullQuery)) {
      score += 10;
      matchedFields.push('comment');
    }

    // 7. Filename match
    if (filename.includes(fullQuery)) {
      score += 10;
      matchedFields.push('filename');
    }

    // Multi-term support: check individual tokens
    if (terms.length > 1) {
      let allTermsMatched = true;
      for (const term of terms) {
        const matchesTerm =
          title.includes(term) ||
          artist.includes(term) ||
          album.includes(term) ||
          genre.includes(term) ||
          filename.includes(term);

        if (matchesTerm) {
          score += 15;
        } else {
          allTermsMatched = false;
        }
      }
      if (allTermsMatched) {
        score += 40; // Bonus for containing all terms
      }
    }

    // Secondary popularity / preference bonuses
    if (score > 0) {
      if (track.isFavorite) score += 5;
      if (track.rating && track.rating > 0) score += track.rating * 2;
      if (track.playCount && track.playCount > 0) {
        score += Math.min(15, Math.floor(track.playCount / 2));
      }
    }

    return { score, matchedFields };
  }

  /**
   * Evaluates if a track passes the multi-criteria search filters.
   */
  public static matchesSongFilters(track: Track, criteria: SearchFilterCriteria): boolean {
    // 1. Source filter
    if (criteria.source && criteria.source !== 'all') {
      if (criteria.source === 'local' && track.source !== 'local') return false;
      if (criteria.source === 'online' && track.source !== 'online') return false;
      if (criteria.source === 'cached' && !track.cached && !track.cachePath) return false;
      if (criteria.source === 'recently_added') {
        const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
        if (!track.dateAdded || Date.now() - track.dateAdded > twoWeeksMs) return false;
      }
    }

    // 2. Duration filter
    if (criteria.duration && criteria.duration !== 'all') {
      const dur = track.duration || 0;
      if (criteria.duration === 'under_3' && dur >= 180) return false;
      if (criteria.duration === '3_to_5' && (dur < 180 || dur > 300)) return false;
      if (criteria.duration === '5_to_10' && (dur < 300 || dur > 600)) return false;
      if (criteria.duration === 'over_10' && dur <= 600) return false;
    }

    // 3. Audio Quality filter
    if (criteria.quality && criteria.quality !== 'all') {
      const bitrate = track.bitrate || 0;
      const fmt = (track.format || '').toLowerCase();
      const isLosslessFmt = ['flac', 'wav', 'alac', 'aiff'].includes(fmt);
      const isHiRes = Boolean(track.sampleRate && track.sampleRate >= 48000);

      if (criteria.quality === 'low' && bitrate >= 128 && !isLosslessFmt) return false;
      if (criteria.quality === 'standard' && (bitrate < 128 || bitrate > 256 || isLosslessFmt)) return false;
      if (criteria.quality === 'high' && (bitrate <= 256 || isLosslessFmt)) return false;
      if (criteria.quality === 'lossless' && !isLosslessFmt) return false;
      if (criteria.quality === 'hires' && !isHiRes) return false;
    }

    // 4. Format filter
    if (criteria.formats && criteria.formats.length > 0) {
      const trackFmt = (track.format || '').toLowerCase();
      const allowedFmts = criteria.formats.map((f) => f.toLowerCase());
      if (!allowedFmts.includes(trackFmt)) return false;
    }

    // 5. Genre filter
    if (criteria.genre && criteria.genre.trim()) {
      const g = (track.genre || '').toLowerCase();
      if (!g.includes(criteria.genre.toLowerCase().trim())) return false;
    }

    return true;
  }

  /**
   * Sorts search song results according to the selected sort option.
   */
  public static sortSongResults(
    results: SearchSongResult[],
    sortBy: SearchSortOption = 'relevance'
  ): SearchSongResult[] {
    const list = [...results];
    switch (sortBy) {
      case 'relevance':
        return list.sort((a, b) => b.relevanceScore - a.relevanceScore);
      case 'recently_added':
      case 'date_added':
        return list.sort((a, b) => (b.track.dateAdded || 0) - (a.track.dateAdded || 0));
      case 'recently_played':
        return list.sort((a, b) => (b.track.lastPlayedAt || 0) - (a.track.lastPlayedAt || 0));
      case 'most_played':
        return list.sort((a, b) => (b.track.playCount || 0) - (a.track.playCount || 0));
      case 'least_played':
        return list.sort((a, b) => (a.track.playCount || 0) - (b.track.playCount || 0));
      case 'title_asc':
        return list.sort((a, b) => a.track.title.localeCompare(b.track.title));
      case 'title_desc':
        return list.sort((a, b) => b.track.title.localeCompare(a.track.title));
      case 'artist_asc':
        return list.sort((a, b) => a.track.artist.localeCompare(b.track.artist));
      case 'artist_desc':
        return list.sort((a, b) => b.track.artist.localeCompare(a.track.artist));
      case 'album_asc':
        return list.sort((a, b) => (a.track.album || '').localeCompare(b.track.album || ''));
      case 'album_desc':
        return list.sort((a, b) => (b.track.album || '').localeCompare(a.track.album || ''));
      case 'duration_asc':
        return list.sort((a, b) => (a.track.duration || 0) - (b.track.duration || 0));
      case 'duration_desc':
        return list.sort((a, b) => (b.track.duration || 0) - (a.track.duration || 0));
      case 'file_size':
        return list.sort((a, b) => (b.track.fileSize || 0) - (a.track.fileSize || 0));
      case 'year_desc':
        return list.sort((a, b) => (b.track.year || 0) - (a.track.year || 0));
      default:
        return list.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  /**
   * Executes a multi-category global search across all local entities and separated online history,
   * supporting multi-criteria filtering and smart sorting.
   */
  public static async executeGlobalSearch(
    query: string,
    filters: SearchFilterCriteria = DEFAULT_SEARCH_FILTERS
  ): Promise<GlobalSearchResults> {
    const clean = query.trim().toLowerCase();
    const terms = clean ? clean.split(/\s+/).filter(Boolean) : [];

    // Fetch library datasets in parallel
    const [
      allTracks,
      allAlbums,
      allArtists,
      allGenres,
      allPlaylists,
      allFolders,
      ytHistory,
      onlineHistory,
    ] = await Promise.all([
      TrackRepository.getAll(),
      TrackRepository.getAlbums(),
      TrackRepository.getArtists(),
      TrackRepository.getGenres(),
      PlaylistRepository.getAll(),
      TrackRepository.getFolderHierarchy(),
      YouTubeHistoryRepository.getAll(),
      OnlineHistoryRepository.getAll(),
    ]);

    const activeType = filters.type || 'all';

    // 1. Song results with relevance ranking and filtering
    let songResults: SearchSongResult[] = [];
    if (activeType === 'all' || activeType === 'songs') {
      for (const track of allTracks) {
        if (!this.matchesSongFilters(track, filters)) continue;

        if (!clean) {
          // If query is blank but filters are applied, include with neutral score
          songResults.push({
            track,
            relevanceScore: 1,
            matchedFields: ['filter'],
          });
          continue;
        }

        const { score, matchedFields } = this.scoreTrack(track, terms);
        if (score > 0) {
          songResults.push({
            track,
            relevanceScore: score,
            matchedFields,
          });
        }
      }
      songResults = this.sortSongResults(songResults, filters.sortBy || 'relevance');
    }

    // 2. Artist results
    let artistResults: SearchArtistResult[] = [];
    if ((activeType === 'all' || activeType === 'artists') && clean) {
      for (const artist of allArtists) {
        const name = artist.name.toLowerCase();
        let score = 0;
        if (name === clean) score = 100;
        else if (name.startsWith(clean)) score = 70;
        else if (name.includes(clean)) score = 40;
        else if (terms.every((t) => name.includes(t))) score = 30;

        if (score > 0) {
          artistResults.push({ artist, relevanceScore: score });
        }
      }
      artistResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 3. Album results
    let albumResults: SearchAlbumResult[] = [];
    if ((activeType === 'all' || activeType === 'albums') && clean) {
      for (const album of allAlbums) {
        const title = album.title.toLowerCase();
        const artist = album.artist.toLowerCase();
        let score = 0;
        if (title === clean) score = 100;
        else if (title.startsWith(clean)) score = 70;
        else if (title.includes(clean)) score = 40;
        else if (artist.includes(clean)) score = 25;
        else if (terms.every((t) => title.includes(t) || artist.includes(t))) score = 20;

        if (score > 0) {
          albumResults.push({ album, relevanceScore: score });
        }
      }
      albumResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 4. Playlist results
    let playlistResults: SearchPlaylistResult[] = [];
    if ((activeType === 'all' || activeType === 'playlists') && clean) {
      for (const pl of allPlaylists) {
        const name = pl.name.toLowerCase();
        const desc = (pl.description || '').toLowerCase();
        let score = 0;
        if (name === clean) score = 100;
        else if (name.startsWith(clean)) score = 70;
        else if (name.includes(clean)) score = 40;
        else if (desc.includes(clean)) score = 20;

        if (score > 0) {
          playlistResults.push({ playlist: pl, relevanceScore: score });
        }
      }
      playlistResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 5. Genre results
    let genreResults: SearchGenreResult[] = [];
    if (activeType === 'all' && clean) {
      for (const g of allGenres) {
        const name = g.name.toLowerCase();
        let score = 0;
        if (name === clean) score = 100;
        else if (name.startsWith(clean)) score = 70;
        else if (name.includes(clean)) score = 40;

        if (score > 0) {
          genreResults.push({ genre: g, relevanceScore: score });
        }
      }
      genreResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 6. Folder results
    let folderResults: SearchFolderResult[] = [];
    if ((activeType === 'all' || activeType === 'folders') && clean) {
      for (const folder of allFolders) {
        const name = folder.name.toLowerCase();
        const path = folder.path.toLowerCase();
        let score = 0;
        if (name === clean) score = 100;
        else if (name.includes(clean)) score = 50;
        else if (path.includes(clean)) score = 20;

        if (score > 0) {
          folderResults.push({ folder, relevanceScore: score });
        }
      }
      folderResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    // 7. Online History Results (STRICTLY SEPARATED)
    const onlineResults: SearchOnlineResult[] = [];
    if ((activeType === 'all' || activeType === 'online') && clean) {
      for (const yh of ytHistory) {
        const title = (yh.title || '').toLowerCase();
        const artist = (yh.artist || '').toLowerCase();
        let score = 0;
        if (title.includes(clean)) score += 50;
        if (artist.includes(clean)) score += 30;
        if (score > 0) {
          onlineResults.push({
            item: yh,
            isCached: yh.cache_status === 'CACHED',
            relevanceScore: score,
          });
        }
      }
      for (const oh of onlineHistory) {
        if (ytHistory.some((yh) => yh.id === oh.id)) continue;
        const title = (oh.title || '').toLowerCase();
        const artist = (oh.artist || '').toLowerCase();
        let score = 0;
        if (title.includes(clean)) score += 40;
        if (artist.includes(clean)) score += 20;
        if (score > 0) {
          onlineResults.push({
            item: oh,
            isCached: Boolean(oh.cached),
            relevanceScore: score,
          });
        }
      }
      onlineResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    const totalLocal =
      songResults.length +
      artistResults.length +
      albumResults.length +
      playlistResults.length +
      genreResults.length +
      folderResults.length;

    return {
      query: clean,
      songs: songResults,
      artists: artistResults,
      albums: albumResults,
      playlists: playlistResults,
      genres: genreResults,
      folders: folderResults,
      online: onlineResults,
      totalLocalResults: totalLocal,
    };
  }

  /**
   * Generates auto-suggestions from library data as the user types, completely offline.
   */
  public static async generateSuggestions(prefix: string, maxSuggestions = 6): Promise<string[]> {
    const clean = prefix.trim().toLowerCase();
    if (!clean || clean.length < 1) return [];

    const [tracks, albums, artists, genres] = await Promise.all([
      TrackRepository.getAll(),
      TrackRepository.getAlbums(),
      TrackRepository.getArtists(),
      TrackRepository.getGenres(),
    ]);

    const suggestions = new Set<string>();

    // 1. Artists starting with prefix
    for (const a of artists) {
      if (a.name.toLowerCase().startsWith(clean)) {
        suggestions.add(a.name);
        if (suggestions.size >= maxSuggestions) break;
      }
    }

    // 2. Albums starting with prefix
    if (suggestions.size < maxSuggestions) {
      for (const alb of albums) {
        if (alb.title.toLowerCase().startsWith(clean)) {
          suggestions.add(alb.title);
          if (suggestions.size >= maxSuggestions) break;
        }
      }
    }

    // 3. Genres starting with prefix
    if (suggestions.size < maxSuggestions) {
      for (const g of genres) {
        if (g.name.toLowerCase().startsWith(clean)) {
          suggestions.add(g.name);
          if (suggestions.size >= maxSuggestions) break;
        }
      }
    }

    // 4. Song titles starting with prefix
    if (suggestions.size < maxSuggestions) {
      for (const t of tracks) {
        if (t.title.toLowerCase().startsWith(clean)) {
          suggestions.add(t.title);
          if (suggestions.size >= maxSuggestions) break;
        }
      }
    }

    // 5. Fallback: contains match if suggestions are still low
    if (suggestions.size < maxSuggestions) {
      for (const a of artists) {
        if (a.name.toLowerCase().includes(clean) && !suggestions.has(a.name)) {
          suggestions.add(a.name);
          if (suggestions.size >= maxSuggestions) break;
        }
      }
    }

    return Array.from(suggestions).slice(0, maxSuggestions);
  }
}

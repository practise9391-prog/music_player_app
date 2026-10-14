import { Track } from '../../types';

export type FilterSource = 'all' | 'local' | 'online' | 'cached';
export type FilterFavorite = 'all' | 'favorites' | 'non_favorites';
export type FilterDuration = 'all' | 'under_3' | '3_to_5' | '5_to_10' | 'over_10' | 'custom';
export type FilterQuality = 'all' | 'under_128' | '128_to_256' | '256_to_320' | 'lossless';
export type QuickFilterType =
  | 'all'
  | 'favorites'
  | 'recently_added'
  | 'most_played'
  | 'lossless'
  | 'high_rating'
  | 'local'
  | 'online'
  | 'cached'
  | 'downloaded';

export interface LibraryFilterCriteria {
  source: FilterSource;
  favorite: FilterFavorite;
  duration: FilterDuration;
  customDurationMin?: number; // in seconds
  customDurationMax?: number; // in seconds
  formats: string[]; // e.g. ['mp3', 'flac']
  quality: FilterQuality;
  genres: string[];
  artists: string[];
  albums: string[];
  yearMin?: number;
  yearMax?: number;
  minRating?: number; // 0 to 5
  logicMode: 'all' | 'any'; // AND vs OR
}

export const DEFAULT_FILTER_CRITERIA: LibraryFilterCriteria = {
  source: 'all',
  favorite: 'all',
  duration: 'all',
  formats: [],
  quality: 'all',
  genres: [],
  artists: [],
  albums: [],
  logicMode: 'all',
};

export type SortField =
  | 'title'
  | 'artist'
  | 'album'
  | 'albumArtist'
  | 'genre'
  | 'year'
  | 'duration'
  | 'dateAdded'
  | 'lastPlayedAt'
  | 'playCount'
  | 'rating'
  | 'bitrate'
  | 'fileSize';

export type SortDirection = 'asc' | 'desc';

export interface SortOptions {
  field: SortField;
  direction: SortDirection;
}

export class FilterEngine {
  /**
   * Evaluates if a track matches individual filter criteria.
   */
  public static matchesCondition(track: Track, conditionName: string, criteria: LibraryFilterCriteria): boolean {
    switch (conditionName) {
      case 'source': {
        if (criteria.source === 'all') return true;
        if (criteria.source === 'local') return track.source === 'local';
        if (criteria.source === 'online') return track.source === 'online';
        if (criteria.source === 'cached') return Boolean(track.cached || track.cachePath);
        return true;
      }

      case 'favorite': {
        if (criteria.favorite === 'all') return true;
        if (criteria.favorite === 'favorites') return Boolean(track.isFavorite);
        if (criteria.favorite === 'non_favorites') return !track.isFavorite;
        return true;
      }

      case 'duration': {
        if (criteria.duration === 'all') return true;
        const dur = track.duration || 0;
        if (criteria.duration === 'under_3') return dur < 180;
        if (criteria.duration === '3_to_5') return dur >= 180 && dur <= 300;
        if (criteria.duration === '5_to_10') return dur >= 300 && dur <= 600;
        if (criteria.duration === 'over_10') return dur > 600;
        if (criteria.duration === 'custom') {
          const min = criteria.customDurationMin ?? 0;
          const max = criteria.customDurationMax ?? Infinity;
          return dur >= min && dur <= max;
        }
        return true;
      }

      case 'formats': {
        if (!criteria.formats || criteria.formats.length === 0) return true;
        const fmt = (track.format || '').toLowerCase();
        return criteria.formats.map((f) => f.toLowerCase()).includes(fmt);
      }

      case 'quality': {
        if (criteria.quality === 'all') return true;
        const br = track.bitrate || 0;
        const fmt = (track.format || '').toLowerCase();
        const isLossless = fmt === 'flac' || fmt === 'wav' || fmt === 'alac' || br >= 500;

        if (criteria.quality === 'lossless') return isLossless;
        if (criteria.quality === '256_to_320') return br >= 256 && br < 500;
        if (criteria.quality === '128_to_256') return br >= 128 && br < 256;
        if (criteria.quality === 'under_128') return br < 128 && !isLossless;
        return true;
      }

      case 'genres': {
        if (!criteria.genres || criteria.genres.length === 0) return true;
        const g = (track.genre || '').toLowerCase();
        return criteria.genres.some((genre) => g.includes(genre.toLowerCase()));
      }

      case 'artists': {
        if (!criteria.artists || criteria.artists.length === 0) return true;
        const art = (track.artist || '').toLowerCase();
        return criteria.artists.some((artist) => art === artist.toLowerCase());
      }

      case 'albums': {
        if (!criteria.albums || criteria.albums.length === 0) return true;
        const alb = (track.album || '').toLowerCase();
        return criteria.albums.some((album) => alb === album.toLowerCase());
      }

      case 'year': {
        if (criteria.yearMin === undefined && criteria.yearMax === undefined) return true;
        const y = track.year;
        if (!y) return false;
        if (criteria.yearMin !== undefined && y < criteria.yearMin) return false;
        if (criteria.yearMax !== undefined && y > criteria.yearMax) return false;
        return true;
      }

      case 'rating': {
        if (criteria.minRating === undefined || criteria.minRating === 0) return true;
        return (track.rating || 0) >= criteria.minRating;
      }

      default:
        return true;
    }
  }

  /**
   * Applies the full filter criteria with AND / OR logic to a track collection.
   */
  public static filterTracks(tracks: Track[], criteria: LibraryFilterCriteria): Track[] {
    const activeConditionKeys: string[] = [];

    if (criteria.source !== 'all') activeConditionKeys.push('source');
    if (criteria.favorite !== 'all') activeConditionKeys.push('favorite');
    if (criteria.duration !== 'all') activeConditionKeys.push('duration');
    if (criteria.formats && criteria.formats.length > 0) activeConditionKeys.push('formats');
    if (criteria.quality !== 'all') activeConditionKeys.push('quality');
    if (criteria.genres && criteria.genres.length > 0) activeConditionKeys.push('genres');
    if (criteria.artists && criteria.artists.length > 0) activeConditionKeys.push('artists');
    if (criteria.albums && criteria.albums.length > 0) activeConditionKeys.push('albums');
    if (criteria.yearMin !== undefined || criteria.yearMax !== undefined) activeConditionKeys.push('year');
    if (criteria.minRating && criteria.minRating > 0) activeConditionKeys.push('rating');

    if (activeConditionKeys.length === 0) {
      return [...tracks];
    }

    if (criteria.logicMode === 'all') {
      // AND logic: track must satisfy every active condition
      return tracks.filter((track) =>
        activeConditionKeys.every((key) => this.matchesCondition(track, key, criteria))
      );
    } else {
      // OR logic: track matches if any active condition is satisfied
      return tracks.filter((track) =>
        activeConditionKeys.some((key) => this.matchesCondition(track, key, criteria))
      );
    }
  }

  /**
   * Applies quick filter chip shortcut to tracks.
   */
  public static applyQuickFilter(tracks: Track[], quickFilter: QuickFilterType): Track[] {
    switch (quickFilter) {
      case 'favorites':
        return tracks.filter((t) => t.isFavorite);
      case 'recently_added': {
        const sorted = [...tracks].sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
        return sorted.slice(0, 50);
      }
      case 'most_played': {
        const sorted = [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
        return sorted.filter((t) => (t.playCount || 0) > 0);
      }
      case 'lossless':
        return tracks.filter((t) => {
          const fmt = (t.format || '').toLowerCase();
          return fmt === 'flac' || fmt === 'wav' || fmt === 'alac' || (t.bitrate || 0) >= 500;
        });
      case 'high_rating':
        return tracks.filter((t) => (t.rating || 0) >= 4);
      case 'local':
        return tracks.filter((t) => t.source === 'local');
      case 'online':
        return tracks.filter((t) => t.source === 'online');
      case 'cached':
        return tracks.filter((t) => Boolean(t.cached || t.cachePath));
      case 'downloaded':
        return tracks.filter((t) => Boolean(t.isDownloaded));
      case 'all':
      default:
        return tracks;
    }
  }

  /**
   * Sorts tracks by any supported field and direction.
   */
  public static sortTracks(tracks: Track[], sort: SortOptions): Track[] {
    const { field, direction } = sort;
    const isAsc = direction === 'asc';

    return [...tracks].sort((a, b) => {
      let valA: any = a[field as keyof Track];
      let valB: any = b[field as keyof Track];

      if (valA === undefined || valA === null) valA = typeof valB === 'string' ? '' : 0;
      if (valB === undefined || valB === null) valB = typeof valA === 'string' ? '' : 0;

      if (typeof valA === 'string') {
        const res = valA.localeCompare(String(valB), undefined, { sensitivity: 'base' });
        return isAsc ? res : -res;
      }

      if (typeof valA === 'number') {
        return isAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      }

      if (typeof valA === 'boolean') {
        return isAsc ? (valA ? 1 : 0) - (valB ? 1 : 0) : (valB ? 1 : 0) - (valA ? 1 : 0);
      }

      return 0;
    });
  }

  /**
   * Unified pipeline combining Search + Filter + Sort together into one high-performance operation.
   */
  public static processPipeline(
    tracks: Track[],
    searchQuery: string,
    filterCriteria: LibraryFilterCriteria,
    quickFilter: QuickFilterType,
    sortOptions: SortOptions
  ): Track[] {
    let result = tracks;

    // 1. Quick filter chip
    if (quickFilter !== 'all') {
      result = this.applyQuickFilter(result, quickFilter);
    }

    // 2. Search query matching
    if (searchQuery && searchQuery.trim()) {
      const clean = searchQuery.trim().toLowerCase();
      const terms = clean.split(/\s+/).filter(Boolean);
      result = result.filter((t) => {
        const title = (t.title || '').toLowerCase();
        const artist = (t.artist || '').toLowerCase();
        const album = (t.album || '').toLowerCase();
        const genre = (t.genre || '').toLowerCase();
        const filename = (t.filename || '').toLowerCase();

        return terms.every(
          (term) =>
            title.includes(term) ||
            artist.includes(term) ||
            album.includes(term) ||
            genre.includes(term) ||
            filename.includes(term)
        );
      });
    }

    // 3. Multi-criteria filter
    result = this.filterTracks(result, filterCriteria);

    // 4. Sorting
    result = this.sortTracks(result, sortOptions);

    return result;
  }
}

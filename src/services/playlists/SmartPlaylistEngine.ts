import { Track, SmartPlaylistRule, SmartPlaylistDefinition, SmartPlaylistField } from '../../types';

export class SmartPlaylistEngine {
  /**
   * Resolves track property for a given smart field, normalizing case and naming.
   */
  public static getTrackFieldValue(track: Track, field: SmartPlaylistField): any {
    switch (field) {
      case 'title':
        return track.title || '';
      case 'artist':
        return track.artist || '';
      case 'album':
        return track.album || '';
      case 'genre':
        return track.genre || '';
      case 'year':
        return Number(track.year || 0);
      case 'duration':
        return Number(track.duration || 0);
      case 'play_count':
        return Number(track.playCount || 0);
      case 'is_favorite':
        return Boolean(track.isFavorite);
      case 'rating':
        return Number(track.rating || 0);
      case 'source':
        return (track.source || 'local').toLowerCase();
      case 'format':
        return String(track.format || '').toLowerCase();
      case 'bitrate':
        return Number(track.bitrate || 0);
      case 'sample_rate':
        return Number(track.sampleRate || 0);
      case 'file_size':
        return Number(track.fileSize || 0);
      case 'tags':
        return String(track.comment || '').toLowerCase();
      case 'date_added':
        return Number(track.dateAdded || 0);
      case 'last_played_at':
        return Number(track.lastPlayedAt || 0);
      default:
        return (track as any)[field] ?? '';
    }
  }

  /**
   * Evaluates a single rule against a track.
   */
  public static evaluateRule(track: Track, rule: SmartPlaylistRule): boolean {
    const { field, operator, value, valueSecondary } = rule;
    const trackVal = this.getTrackFieldValue(track, field);

    const strTarget = String(value).toLowerCase().trim();
    const numTarget = Number(value);

    switch (operator) {
      case 'equals':
        if (typeof trackVal === 'boolean') {
          return trackVal === (strTarget === 'true' || value === true);
        }
        if (typeof trackVal === 'number') {
          return trackVal === numTarget;
        }
        return String(trackVal).toLowerCase() === strTarget;

      case 'not_equals':
        if (typeof trackVal === 'boolean') {
          return trackVal !== (strTarget === 'true' || value === true);
        }
        if (typeof trackVal === 'number') {
          return trackVal !== numTarget;
        }
        return String(trackVal).toLowerCase() !== strTarget;

      case 'contains':
        return String(trackVal).toLowerCase().includes(strTarget);

      case 'not_contains':
        return !String(trackVal).toLowerCase().includes(strTarget);

      case 'starts_with':
        return String(trackVal).toLowerCase().startsWith(strTarget);

      case 'ends_with':
        return String(trackVal).toLowerCase().endsWith(strTarget);

      case 'greater_than':
        return Number(trackVal) > numTarget;

      case 'less_than':
        return Number(trackVal) < numTarget;

      case 'greater_than_or_equal':
        return Number(trackVal) >= numTarget;

      case 'less_than_or_equal':
        return Number(trackVal) <= numTarget;

      case 'between': {
        const min = Math.min(numTarget, Number(valueSecondary || 0));
        const max = Math.max(numTarget, Number(valueSecondary || 0));
        const valNum = Number(trackVal);
        return valNum >= min && valNum <= max;
      }

      case 'after': // For timestamps
        return Number(trackVal) > numTarget;

      case 'before': // For timestamps
        return Number(trackVal) < numTarget;

      default:
        return true;
    }
  }

  /**
   * Filters and sorts an array of tracks according to a smart playlist definition.
   */
  public static filterTracks(tracks: Track[], definition: SmartPlaylistDefinition): Track[] {
    if (!definition || !definition.rules || definition.rules.length === 0) {
      return [...tracks];
    }

    const isMatchAll = definition.matchMode === 'all';

    let matched = tracks.filter((track) => {
      if (isMatchAll) {
        return definition.rules.every((rule: SmartPlaylistRule) => this.evaluateRule(track, rule));
      } else {
        return definition.rules.some((rule: SmartPlaylistRule) => this.evaluateRule(track, rule));
      }
    });

    // Sorting
    if (definition.sortBy) {
      const field = definition.sortBy;
      const isAsc = definition.sortOrder !== 'desc';

      matched.sort((a, b) => {
        let valA: any = this.getTrackFieldValue(a, field);
        let valB: any = this.getTrackFieldValue(b, field);

        if (valA === undefined) valA = 0;
        if (valB === undefined) valB = 0;

        if (typeof valA === 'string') {
          return isAsc ? valA.localeCompare(String(valB)) : String(valB).localeCompare(valA);
        }
        return isAsc ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
      });
    }

    // Limit
    if (definition.limit && definition.limit > 0) {
      matched = matched.slice(0, definition.limit);
    }

    return matched;
  }

  public static getFavorites(tracks: Track[]): Track[] {
    return tracks.filter((t) => Boolean(t.isFavorite) && t.isAvailable !== false);
  }

  public static getMostPlayed(tracks: Track[], limit = 50): Track[] {
    return [...tracks]
      .filter((t) => t.isAvailable !== false && (t.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
  }

  public static getRecentlyAdded(tracks: Track[], limit = 50): Track[] {
    return [...tracks]
      .filter((t) => t.isAvailable !== false)
      .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      .slice(0, limit);
  }

  public static getTopRated(tracks: Track[], minRating = 4, limit = 50): Track[] {
    return tracks
      .filter((t) => (t.rating || 0) >= minRating && t.isAvailable !== false)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
  }
}

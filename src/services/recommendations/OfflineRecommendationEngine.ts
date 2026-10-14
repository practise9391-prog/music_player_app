import { Track } from '../../types';
import { TrackRepository, PlayHistoryRepository } from '../../database/repository';

export interface BecauseYouLikeRecommendation {
  reason: string;
  type: 'artist' | 'genre';
  name: string;
  tracks: Track[];
}

export interface OfflineRecommendationsBundle {
  becauseYouLike: BecauseYouLikeRecommendation | null;
  frequentlyPlayed: Track[];
  rediscover: Track[];
  recentlyAdded: Track[];
  hiddenGems: Track[];
}

export class OfflineRecommendationEngine {
  /**
   * Generates "Because You Like [Artist/Genre]" recommendations.
   * Finds the user's most listened or favorited artist/genre,
   * then returns other tracks by that artist or in that genre that the user has played least.
   */
  public static async getBecauseYouLike(limit = 12): Promise<BecauseYouLikeRecommendation | null> {
    const allTracks = await TrackRepository.getAll();
    const available = allTracks.filter((t) => t.isAvailable !== false);
    if (available.length === 0) return null;

    // 1. Calculate play scores per artist and genre
    const artistScores = new Map<string, number>();
    const genreScores = new Map<string, number>();

    for (const t of available) {
      const art = t.artist?.trim();
      const gen = t.genre?.trim();
      const weight = (t.playCount || 0) + (t.isFavorite ? 5 : 0) + (t.rating || 0);

      if (art && art.toLowerCase() !== 'unknown artist') {
        artistScores.set(art, (artistScores.get(art) || 0) + weight);
      }
      if (gen && gen.toLowerCase() !== 'unknown genre') {
        genreScores.set(gen, (genreScores.get(gen) || 0) + weight);
      }
    }

    // Sort top artist and top genre
    const sortedArtists = Array.from(artistScores.entries()).sort((a, b) => b[1] - a[1]);
    const sortedGenres = Array.from(genreScores.entries()).sort((a, b) => b[1] - a[1]);

    if (sortedArtists.length > 0 && sortedArtists[0][1] > 2) {
      const topArtist = sortedArtists[0][0];
      const artistTracks = available.filter(
        (t) => t.artist?.toLowerCase().trim() === topArtist.toLowerCase()
      );
      if (artistTracks.length >= 2) {
        // Sort by least played or unplayed first to encourage discovery within favorite artist
        const recommended = [...artistTracks]
          .sort((a, b) => (a.playCount || 0) - (b.playCount || 0))
          .slice(0, limit);
        return {
          reason: `Because you frequently listen to ${topArtist}`,
          type: 'artist',
          name: topArtist,
          tracks: recommended,
        };
      }
    }

    if (sortedGenres.length > 0 && sortedGenres[0][1] > 1) {
      const topGenre = sortedGenres[0][0];
      const genreTracks = available.filter(
        (t) => t.genre?.toLowerCase().trim() === topGenre.toLowerCase()
      );
      if (genreTracks.length >= 2) {
        const recommended = [...genreTracks]
          .sort((a, b) => (a.playCount || 0) - (b.playCount || 0))
          .slice(0, limit);
        return {
          reason: `Because you love ${topGenre}`,
          type: 'genre',
          name: topGenre,
          tracks: recommended,
        };
      }
    }

    return null;
  }

  /**
   * Tracks with high play counts (Frequently Played).
   */
  public static async getFrequentlyPlayed(limit = 12): Promise<Track[]> {
    const allTracks = await TrackRepository.getAll();
    return allTracks
      .filter((t) => t.isAvailable !== false && (t.playCount || 0) > 0)
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
  }

  /**
   * "Rediscover": Songs played in the past, but last played more than 14 days ago.
   */
  public static async getRediscover(limit = 12): Promise<Track[]> {
    const allTracks = await TrackRepository.getAll();
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    return allTracks
      .filter(
        (t) =>
          t.isAvailable !== false &&
          t.lastPlayedAt &&
          t.lastPlayedAt < fourteenDaysAgo &&
          (t.playCount || 0) > 0
      )
      .sort((a, b) => (a.lastPlayedAt || 0) - (b.lastPlayedAt || 0))
      .slice(0, limit);
  }

  /**
   * "Recently Added": Newest tracks added to local library.
   */
  public static async getRecentlyAdded(limit = 12): Promise<Track[]> {
    const allTracks = await TrackRepository.getAll();
    return allTracks
      .filter((t) => t.isAvailable !== false)
      .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      .slice(0, limit);
  }

  /**
   * "Hidden Gems": High rated tracks (>= 4 stars) or unplayed tracks in library.
   */
  public static async getHiddenGems(limit = 12): Promise<Track[]> {
    const allTracks = await TrackRepository.getAll();
    return allTracks
      .filter(
        (t) =>
          t.isAvailable !== false &&
          ((t.rating && t.rating >= 4 && (t.playCount || 0) < 5) ||
            (!t.playCount || t.playCount === 0))
      )
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, limit);
  }

  /**
   * Aggregates all recommendation channels into a single offline bundle.
   */
  public static async getAllRecommendations(): Promise<OfflineRecommendationsBundle> {
    const [becauseYouLike, frequentlyPlayed, rediscover, recentlyAdded, hiddenGems] =
      await Promise.all([
        this.getBecauseYouLike(10),
        this.getFrequentlyPlayed(10),
        this.getRediscover(10),
        this.getRecentlyAdded(10),
        this.getHiddenGems(10),
      ]);

    return {
      becauseYouLike,
      frequentlyPlayed,
      rediscover,
      recentlyAdded,
      hiddenGems,
    };
  }
}

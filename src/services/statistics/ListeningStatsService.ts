import { PlayHistoryRepository, PlaybackSessionRepository, TrackRepository } from '../../database/repository';
import { Track } from '../../types';

export type StatsTimeframe = 'today' | 'week' | 'month' | 'all';

export interface TrackStatItem {
  trackId: string;
  title: string;
  artist: string;
  playCount: number;
  durationListenedSec: number;
  coverArtUrl?: string;
}

export interface ArtistStatItem {
  artist: string;
  playCount: number;
  durationListenedSec: number;
}

export interface GenreStatItem {
  genre: string;
  playCount: number;
}

export interface ListeningProfileStats {
  timeframe: StatsTimeframe;
  totalListeningTimeSec: number;
  totalPlays: number;
  completedPlays: number;
  skippedPlays: number;
  completionRatePercent: number;
  topTracks: TrackStatItem[];
  topArtists: ArtistStatItem[];
  topGenres: GenreStatItem[];
  topRatedCount: number;
  favoriteTracksCount: number;
  totalLibraryTracks: number;
}

export class ListeningStatsService {
  public static async getStats(timeframe: StatsTimeframe = 'all'): Promise<ListeningProfileStats> {
    const allTracks = await TrackRepository.getAll();
    const historyRecords = await PlayHistoryRepository.getAll();
    const now = Date.now();

    // Determine timestamp cutoff
    let cutoff = 0;
    if (timeframe === 'today') {
      cutoff = now - 24 * 60 * 60 * 1000;
    } else if (timeframe === 'week') {
      cutoff = now - 7 * 24 * 60 * 60 * 1000;
    } else if (timeframe === 'month') {
      cutoff = now - 30 * 24 * 60 * 60 * 1000;
    }

    const filteredHistory = cutoff > 0
      ? historyRecords.filter((h) => h.playedAt >= cutoff)
      : historyRecords;

    const tracksMap = new Map<string, Track>();
    allTracks.forEach((t) => tracksMap.set(t.id, t));

    let totalDurationSec = 0;
    let completed = 0;
    let skipped = 0;

    const trackCounts = new Map<string, { title: string; artist: string; count: number; duration: number }>();
    const artistCounts = new Map<string, { count: number; duration: number }>();
    const genreCounts = new Map<string, number>();

    for (const h of filteredHistory) {
      const dur = h.playDuration || 0;
      totalDurationSec += dur;
      if (h.completed) {
        completed++;
      } else {
        skipped++;
      }

      // Track stats
      const existingT = trackCounts.get(h.trackId) || {
        title: h.title,
        artist: h.artist,
        count: 0,
        duration: 0,
      };
      existingT.count++;
      existingT.duration += dur;
      trackCounts.set(h.trackId, existingT);

      // Artist stats
      const art = h.artist?.trim() || 'Unknown Artist';
      if (art) {
        const existingA = artistCounts.get(art) || { count: 0, duration: 0 };
        existingA.count++;
        existingA.duration += dur;
        artistCounts.set(art, existingA);
      }

      // Genre stats
      const trackObj = tracksMap.get(h.trackId);
      const genre = trackObj?.genre?.trim() || 'Uncategorized';
      if (genre) {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      }
    }

    // Top tracks
    const topTracks: TrackStatItem[] = Array.from(trackCounts.entries())
      .map(([trackId, data]) => ({
        trackId,
        title: data.title,
        artist: data.artist,
        playCount: data.count,
        durationListenedSec: data.duration,
        coverArtUrl: tracksMap.get(trackId)?.coverArtUrl,
      }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    // Top artists
    const topArtists: ArtistStatItem[] = Array.from(artistCounts.entries())
      .map(([artist, data]) => ({
        artist,
        playCount: data.count,
        durationListenedSec: data.duration,
      }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    // Top genres
    const topGenres: GenreStatItem[] = Array.from(genreCounts.entries())
      .map(([genre, playCount]) => ({ genre, playCount }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, 10);

    const totalPlays = filteredHistory.length;
    const completionRatePercent =
      totalPlays > 0 ? Math.round((completed / totalPlays) * 100) : 100;

    const topRatedCount = allTracks.filter((t) => (t.rating || 0) >= 4).length;
    const favoriteTracksCount = allTracks.filter((t) => t.isFavorite).length;

    return {
      timeframe,
      totalListeningTimeSec: totalDurationSec,
      totalPlays,
      completedPlays: completed,
      skippedPlays: skipped,
      completionRatePercent,
      topTracks,
      topArtists,
      topGenres,
      topRatedCount,
      favoriteTracksCount,
      totalLibraryTracks: allTracks.length,
    };
  }
}

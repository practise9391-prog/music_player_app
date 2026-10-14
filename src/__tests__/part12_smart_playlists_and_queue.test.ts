import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../database/db';
import {
  TrackRepository,
  PlaylistRepository,
  PlaylistTrackRepository,
  EntityFavoriteRepository,
  PlayHistoryRepository,
} from '../database/repository';
import { SmartPlaylistEngine } from '../services/playlists/SmartPlaylistEngine';
import { OfflineRecommendationEngine } from '../services/recommendations/OfflineRecommendationEngine';
import { ListeningStatsService } from '../services/statistics/ListeningStatsService';
import { MusicDataBackupService } from '../services/storage/MusicDataBackupService';
import { Track, SmartPlaylistDefinition } from '../types';

describe('Part 12 — Smart Playlists, Queue Management, Favorites, Ratings & Offline Recommendations', () => {
  const sampleTracks: Track[] = [
    {
      id: 'track_1',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      duration: 354,
      format: 'flac',
      path: '/music/queen/bohemian.flac',
      source: 'local',
      genre: 'Rock',
      year: 1975,
      dateAdded: 1000000,
      playCount: 42,
      isFavorite: true,
      rating: 5,
      fileSize: 45000000,
      comment: 'classic, rock, favorite',
      lastPlayedAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      isAvailable: true,
    },
    {
      id: 'track_2',
      title: 'Under Pressure',
      artist: 'Queen',
      album: 'Hot Space',
      duration: 244,
      format: 'mp3',
      path: '/music/queen/under_pressure.mp3',
      source: 'local',
      genre: 'Rock',
      year: 1981,
      dateAdded: 2000000,
      playCount: 12,
      isFavorite: false,
      rating: 4,
      fileSize: 8000000,
      comment: 'duet, rock',
      lastPlayedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago (recent)
      isAvailable: true,
    },
    {
      id: 'track_3',
      title: 'Someone Like You',
      artist: 'Adele',
      album: '21',
      duration: 285,
      format: 'flac',
      path: '/music/adele/someone_like_you.flac',
      source: 'local',
      genre: 'Pop',
      year: 2011,
      dateAdded: 3000000,
      playCount: 0, // unplayed
      isFavorite: true,
      rating: 4,
      fileSize: 32000000,
      comment: 'ballad, pop',
      isAvailable: true,
    },
    {
      id: 'track_4',
      title: 'Rolling in the Deep',
      artist: 'Adele',
      album: '21',
      duration: 228,
      format: 'm4a',
      path: '/music/adele/rolling_in_the_deep.m4a',
      source: 'local',
      genre: 'Pop',
      year: 2011,
      dateAdded: 4000000,
      playCount: 20,
      isFavorite: false,
      rating: 3,
      fileSize: 6500000,
      comment: 'pop, energetic',
      lastPlayedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      isAvailable: true,
    },
    {
      id: 'track_5',
      title: 'Unavailable Song',
      artist: 'Ghost Artist',
      duration: 200,
      format: 'mp3',
      path: '/music/ghost.mp3',
      source: 'local',
      dateAdded: 5000000,
      playCount: 50,
      isFavorite: true,
      rating: 5,
      isAvailable: false, // DELETED / UNAVAILABLE
    },
  ];

  beforeEach(async () => {
    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlist_tracks.clear();
    await db.entity_favorites.clear();
    await db.play_history.clear();
    await db.tracks.bulkPut(sampleTracks);
  });

  describe('1. Smart Playlist Engine & Condition Evaluators', () => {
    it('evaluates rating operators greater_than_or_equal and less_than_or_equal', () => {
      const min4Stars: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'rating',
            operator: 'greater_than_or_equal',
            value: 4,
          },
        ],
      };

      const matched = SmartPlaylistEngine.filterTracks(sampleTracks, min4Stars);
      // track_1 (5), track_2 (4), track_3 (4), track_5 (5)
      expect(matched.length).toBe(4);
      expect(matched.every((t) => (t.rating || 0) >= 4)).toBe(true);

      const max3Stars: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r2',
            field: 'rating',
            operator: 'less_than_or_equal',
            value: 3,
          },
        ],
      };
      const matchedLow = SmartPlaylistEngine.filterTracks(sampleTracks, max3Stars);
      expect(matchedLow.length).toBe(1);
      expect(matchedLow[0].id).toBe('track_4');
    });

    it('evaluates string operators: ends_with, starts_with, contains, and equals', () => {
      const endsWithRhapsody: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'title',
            operator: 'ends_with',
            value: 'rhapsody',
          },
        ],
      };
      const rhapsody = SmartPlaylistEngine.filterTracks(sampleTracks, endsWithRhapsody);
      expect(rhapsody.length).toBe(1);
      expect(rhapsody[0].title).toBe('Bohemian Rhapsody');

      const startsWithUnder: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r2',
            field: 'title',
            operator: 'starts_with',
            value: 'under',
          },
        ],
      };
      const under = SmartPlaylistEngine.filterTracks(sampleTracks, startsWithUnder);
      expect(under.length).toBe(1);
      expect(under[0].title).toBe('Under Pressure');
    });

    it('evaluates between operator for duration and numeric ranges', () => {
      const midDuration: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'duration',
            operator: 'between',
            value: 230,
            valueSecondary: 300,
          },
        ],
      };
      const res = SmartPlaylistEngine.filterTracks(sampleTracks, midDuration);
      // Under Pressure: 244, Someone Like You: 285
      expect(res.map((r) => r.id).sort()).toEqual(['track_2', 'track_3']);
    });

    it('evaluates multiple rules with matchMode "all" (AND)', () => {
      const queenHighRating: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'artist',
            operator: 'equals',
            value: 'Queen',
          },
          {
            id: 'r2',
            field: 'rating',
            operator: 'greater_than',
            value: 4,
          },
        ],
      };
      const res = SmartPlaylistEngine.filterTracks(sampleTracks, queenHighRating);
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('track_1');
    });

    it('evaluates multiple rules with matchMode "any" (OR)', () => {
      const rockOrPop: SmartPlaylistDefinition = {
        matchMode: 'any',
        rules: [
          {
            id: 'r1',
            field: 'genre',
            operator: 'equals',
            value: 'Rock',
          },
          {
            id: 'r2',
            field: 'artist',
            operator: 'equals',
            value: 'Adele',
          },
        ],
      };
      const res = SmartPlaylistEngine.filterTracks(sampleTracks, rockOrPop);
      // track_1, track_2 (Queen/Rock), track_3, track_4 (Adele/Pop)
      expect(res.length).toBe(4);
    });

    it('sorts matched tracks and applies limits', () => {
      const sortedByRating: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'duration',
            operator: 'greater_than',
            value: 100,
          },
        ],
        sortBy: 'rating',
        sortOrder: 'desc',
        limit: 2,
      };

      const res = SmartPlaylistEngine.filterTracks(sampleTracks, sortedByRating);
      expect(res.length).toBe(2);
      expect(res[0].rating).toBe(5);
      expect(res[1].rating).toBe(5);
    });

    it('generates standard smart collections accurately', () => {
      const favorites = SmartPlaylistEngine.getFavorites(sampleTracks);
      expect(favorites.length).toBe(2); // excludes unavailable track_5
      expect(favorites.every((t) => t.isFavorite && t.isAvailable !== false)).toBe(true);

      const topRated = SmartPlaylistEngine.getTopRated(sampleTracks, 4);
      expect(topRated.length).toBe(3); // track_1, track_2, track_3
      expect(topRated.every((t) => (t.rating || 0) >= 4 && t.isAvailable !== false)).toBe(true);

      const mostPlayed = SmartPlaylistEngine.getMostPlayed(sampleTracks, 2);
      expect(mostPlayed.length).toBe(2);
      expect(mostPlayed[0].id).toBe('track_1'); // 42 plays
      expect(mostPlayed[1].id).toBe('track_4'); // 20 plays
    });
  });

  describe('2. Ratings & Repository Operations', () => {
    it('sets track rating between 0 and 5 stars', async () => {
      await TrackRepository.setRating('track_4', 5);
      const updated = await TrackRepository.getById('track_4');
      expect(updated?.rating).toBe(5);

      // Clamps to 5 if given > 5
      await TrackRepository.setRating('track_4', 10);
      const clamped = await TrackRepository.getById('track_4');
      expect(clamped?.rating).toBe(5);
    });

    it('records and updates play stats', async () => {
      await TrackRepository.updatePlayStats('track_3');
      const updated = await TrackRepository.getById('track_3');
      expect(updated?.playCount).toBe(1);
      expect(updated?.lastPlayedAt).toBeDefined();
    });
  });

  describe('3. Offline Recommendations Engine ("For You")', () => {
    it('generates "Because You Like [Artist]" based on listening habits', async () => {
      const rec = await OfflineRecommendationEngine.getBecauseYouLike();
      expect(rec).not.toBeNull();
      expect(rec?.type).toBe('artist');
      expect(rec?.name).toBe('Queen');
      // Recommends least played first: track_2 (12 plays) before track_1 (42 plays)
      expect(rec?.tracks[0].id).toBe('track_2');
    });

    it('generates "Frequently Played" filtering unavailable tracks', async () => {
      const freq = await OfflineRecommendationEngine.getFrequentlyPlayed();
      expect(freq.length).toBeGreaterThan(0);
      expect(freq.every((t) => t.isAvailable !== false)).toBe(true);
      expect(freq[0].id).toBe('track_1'); // Queen Bohemian Rhapsody (42)
    });

    it('generates "Rediscover" for songs not played in 14+ days', async () => {
      const redis = await OfflineRecommendationEngine.getRediscover();
      expect(redis.length).toBe(1);
      expect(redis[0].id).toBe('track_1'); // 30 days ago
    });

    it('generates "Hidden Gems" for high rated or unplayed songs', async () => {
      const gems = await OfflineRecommendationEngine.getHiddenGems();
      // track_3 is unplayed (playCount = 0) and rated 4 stars
      const foundTrack3 = gems.some((t) => t.id === 'track_3');
      expect(foundTrack3).toBe(true);
      expect(gems.every((t) => t.isAvailable !== false)).toBe(true);
    });
  });

  describe('4. Listening Statistics & Profile Analytics', () => {
    beforeEach(async () => {
      const now = Date.now();
      // Seed play history
      await PlayHistoryRepository.addRecord({
        trackId: 'track_1',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        playedAt: now - 1 * 60 * 60 * 1000,
        playDuration: 354,
        completed: true,
        source: 'local',
      });
      await PlayHistoryRepository.addRecord({
        trackId: 'track_2',
        title: 'Under Pressure',
        artist: 'Queen',
        playedAt: now - 3 * 60 * 60 * 1000,
        playDuration: 100,
        completed: false, // skipped
        source: 'local',
      });
      await PlayHistoryRepository.addRecord({
        trackId: 'track_4',
        title: 'Rolling in the Deep',
        artist: 'Adele',
        playedAt: now - 5 * 24 * 60 * 60 * 1000,
        playDuration: 228,
        completed: true,
        source: 'local',
      });
    });

    it('calculates listening statistics across timeframes', async () => {
      const todayStats = await ListeningStatsService.getStats('today');
      expect(todayStats.totalPlays).toBe(2);
      expect(todayStats.completedPlays).toBe(1);
      expect(todayStats.skippedPlays).toBe(1);
      expect(todayStats.completionRatePercent).toBe(50);
      expect(todayStats.totalListeningTimeSec).toBe(454);
      expect(todayStats.topArtists[0].artist).toBe('Queen');

      const allStats = await ListeningStatsService.getStats('all');
      expect(allStats.totalPlays).toBe(3);
      expect(allStats.completedPlays).toBe(2);
      expect(allStats.topTracks.length).toBe(3);
    });
  });

  describe('5. Data Backup & Restore (JSON Export / Import)', () => {
    it('exports a valid JSON backup bundle', async () => {
      // Create a playlist first
      const pl = await PlaylistRepository.create('My Rock Playlist', 'Best rock tunes');
      await PlaylistTrackRepository.addTracks(pl.id, [sampleTracks[0], sampleTracks[1]]);
      await EntityFavoriteRepository.toggleFavorite('queen_artist', 'artist', 'Queen');

      const bundle = await MusicDataBackupService.exportBackup();
      expect(bundle.appName).toBe('NovaMusic');
      expect(bundle.version).toBe(1);
      expect(bundle.playlists.length).toBeGreaterThanOrEqual(1);
      expect(bundle.entityFavorites.length).toBeGreaterThanOrEqual(1);
      expect(bundle.trackRatings.length).toBeGreaterThan(0);
      expect(bundle.trackRatings.some((r) => r.id === 'track_1' && r.rating === 5)).toBe(true);
    });

    it('imports backup bundle safely and restores playlists, favorites, and ratings', async () => {
      const mockBackup = {
        version: 1,
        exportedAt: Date.now(),
        appName: 'NovaMusic',
        playlists: [
          {
            id: 'backup_pl_1',
            name: 'Restored Hits',
            description: 'Imported from backup',
            type: 'normal' as const,
            isFavorite: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        playlistTracks: [
          {
            playlistId: 'backup_pl_1',
            trackId: 'track_1',
            position: 0,
            addedAt: Date.now(),
          },
        ],
        entityFavorites: [
          {
            id: 'artist_Queen',
            itemId: 'Queen',
            itemType: 'artist' as const,
            title: 'Queen',
            addedAt: Date.now(),
          },
        ],
        trackRatings: [
          {
            id: 'track_4',
            path: '/music/adele/rolling_in_the_deep.m4a',
            title: 'Rolling in the Deep',
            artist: 'Adele',
            rating: 5,
            playCount: 99,
            isFavorite: true,
          },
        ],
        playHistory: [],
      };

      const result = await MusicDataBackupService.importBackup(JSON.stringify(mockBackup), 'merge');
      expect(result.success).toBe(true);
      expect(result.counts.playlistsRestored).toBe(1);
      expect(result.counts.ratingsRestored).toBe(1);

      // Verify playlist was restored in DB
      const pl = await PlaylistRepository.getById('backup_pl_1');
      expect(pl?.name).toBe('Restored Hits');

      // Verify track rating and play count were merged
      const track4 = await TrackRepository.getById('track_4');
      expect(track4?.rating).toBe(5);
      expect(track4?.playCount).toBe(99);
      expect(track4?.isFavorite).toBe(true);
    });

    it('rejects invalid or corrupted JSON files gracefully', async () => {
      await expect(MusicDataBackupService.importBackup('not a json string')).rejects.toThrow(
        'Invalid JSON format'
      );

      await expect(
        MusicDataBackupService.importBackup(JSON.stringify({ appName: 'OtherApp' }))
      ).rejects.toThrow('Incompatible backup format');
    });
  });
});

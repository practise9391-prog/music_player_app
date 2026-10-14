import { describe, it, expect, beforeEach } from 'vitest';
import {
  SearchEngine,
  SearchFilterCriteria,
  DEFAULT_SEARCH_FILTERS,
} from '../services/search/SearchEngine';
import { FilterEngine } from '../services/filter/FilterEngine';
import { Track, PlaylistRecord } from '../types';
import { db } from '../database/db';
import {
  TrackRepository,
  SearchHistoryRepository,
  PlaylistRepository,
} from '../database/repository';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Part 11 — Advanced Search, Smart Filters, Sorting & Music Discovery', () => {
  const sampleTracks: Track[] = [
    {
      id: 't_arijit_1',
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      album: 'Aashiqui 2',
      genre: 'Romantic',
      duration: 262, // 4m 22s (3_to_5)
      format: 'flac',
      bitrate: 1024,
      sampleRate: 48000, // Hi-Res / Lossless
      year: 2013,
      dateAdded: 1620000000000,
      playCount: 42,
      lastPlayedAt: 1690000000000,
      rating: 5,
      isFavorite: true,
      source: 'local',
      path: '/music/arijit/tum_hi_ho.flac',
      filename: 'tum_hi_ho.flac',
      fileSize: 35000000,
      isAvailable: true,
    },
    {
      id: 't_arijit_2',
      title: 'Channa Mereya',
      artist: 'Arijit Singh',
      album: 'Ae Dil Hai Mushkil',
      genre: 'Sad',
      duration: 289, // 4m 49s (3_to_5)
      format: 'mp3',
      bitrate: 320,
      sampleRate: 44100, // High quality
      year: 2016,
      dateAdded: 1630000000000,
      playCount: 20,
      lastPlayedAt: 1680000000000,
      rating: 4,
      isFavorite: false,
      source: 'local',
      path: '/music/arijit/channa_mereya.mp3',
      filename: 'channa_mereya.mp3',
      fileSize: 11000000,
      isAvailable: true,
    },
    {
      id: 't_short',
      title: 'Short Jingle',
      artist: 'Radio Producer',
      album: 'Sound Bites',
      genre: '', // Missing genre metadata
      duration: 45, // < 3 mins (under_3)
      format: 'wav',
      bitrate: 1411,
      sampleRate: 44100,
      year: 2023,
      dateAdded: Date.now() - 3600000, // Recently added
      playCount: 5,
      lastPlayedAt: 1670000000000,
      rating: 2,
      isFavorite: false,
      source: 'local',
      path: '/music/jingles/short.wav',
      filename: 'short.wav',
      fileSize: 8000000,
      isAvailable: true,
    },
    {
      id: 't_long',
      title: 'Symphony No. 9',
      artist: 'Beethoven',
      album: 'Classical Masterpieces',
      genre: 'Classical',
      duration: 920, // > 10 mins (over_10)
      format: 'flac',
      bitrate: 900,
      sampleRate: 96000, // Hi-Res
      year: 1824,
      dateAdded: 1600000000000,
      playCount: 3,
      lastPlayedAt: 1650000000000,
      rating: 5,
      isFavorite: true,
      source: 'local',
      path: '/music/classical/symphony9.flac',
      filename: 'symphony9.flac',
      fileSize: 120000000,
      isAvailable: true,
    },
  ];

  beforeEach(async () => {
    await db.tracks.clear();
    await db.playlists.clear();
    await db.search_history.clear();
    await db.tracks.bulkPut(sampleTracks);
  });

  describe('1. Global Search Matching & Case-Insensitivity', () => {
    it('searches song with lowercase, uppercase, and partial title', async () => {
      const resLower = await SearchEngine.executeGlobalSearch('tum hi ho');
      expect(resLower.songs.length).toBeGreaterThan(0);
      expect(resLower.songs[0].track.title).toBe('Tum Hi Ho');

      const resUpper = await SearchEngine.executeGlobalSearch('TUM HI');
      expect(resUpper.songs.length).toBeGreaterThan(0);
      expect(resUpper.songs[0].track.title).toBe('Tum Hi Ho');
    });

    it('searches artist case-insensitively and returns both songs and artist entity', async () => {
      const res = await SearchEngine.executeGlobalSearch('arijit');
      expect(res.songs.length).toBe(2);
      expect(res.artists.length).toBe(1);
      expect(res.artists[0].artist.name).toBe('Arijit Singh');
    });

    it('searches album title and returns matching album and tracks', async () => {
      const res = await SearchEngine.executeGlobalSearch('Aashiqui');
      expect(res.albums.length).toBe(1);
      expect(res.albums[0].album.title).toBe('Aashiqui 2');
      expect(res.songs.length).toBe(1);
    });

    it('searches playlist by name', async () => {
      await PlaylistRepository.create('Workout Energy');

      const res = await SearchEngine.executeGlobalSearch('workout');
      expect(res.playlists.length).toBe(1);
      expect(res.playlists[0].playlist.name).toBe('Workout Energy');
    });
  });

  describe('2. Multi-Criteria Search Filters', () => {
    it('filters by duration (<3m, 3-5m, >10m)', async () => {
      const under3 = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        duration: 'under_3',
      });
      expect(under3.songs.every((s) => s.track.duration < 180)).toBe(true);
      expect(under3.songs.some((s) => s.track.title === 'Short Jingle')).toBe(true);

      const over10 = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        duration: 'over_10',
      });
      expect(over10.songs.every((s) => s.track.duration > 600)).toBe(true);
      expect(over10.songs[0].track.title).toBe('Symphony No. 9');
    });

    it('filters by audio format (FLAC vs MP3)', async () => {
      const flacOnly = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        formats: ['flac'],
      });
      expect(flacOnly.songs.every((s) => s.track.format === 'flac')).toBe(true);
      expect(flacOnly.songs.length).toBe(2);

      const mp3Only = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        formats: ['mp3'],
      });
      expect(mp3Only.songs.every((s) => s.track.format === 'mp3')).toBe(true);
      expect(mp3Only.songs.length).toBe(1);
    });

    it('combines Artist + Format + Duration filters simultaneously', async () => {
      // Query: Arijit + Format = FLAC + Duration 3-5 min
      const res = await SearchEngine.executeGlobalSearch('Arijit', {
        ...DEFAULT_SEARCH_FILTERS,
        formats: ['flac'],
        duration: '3_to_5',
      });

      expect(res.songs.length).toBe(1);
      expect(res.songs[0].track.title).toBe('Tum Hi Ho');
      expect(res.songs[0].track.format).toBe('flac');
      expect(res.songs[0].track.duration).toBeGreaterThanOrEqual(180);
      expect(res.songs[0].track.duration).toBeLessThanOrEqual(300);
    });

    it('filters by Audio Quality (Lossless & Hi-Res)', async () => {
      const lossless = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        quality: 'lossless',
      });
      expect(lossless.songs.every((s) => ['flac', 'wav'].includes(s.track.format))).toBe(true);

      const hires = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        quality: 'hires',
      });
      expect(hires.songs.every((s) => (s.track.sampleRate || 0) >= 48000)).toBe(true);
    });
  });

  describe('3. Smart Sorting', () => {
    it('sorts songs by Most Played vs Least Played', async () => {
      const mostPlayed = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'most_played',
      });
      expect(mostPlayed.songs[0].track.playCount).toBe(42);

      const leastPlayed = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'least_played',
      });
      expect(leastPlayed.songs[0].track.playCount).toBe(3);
    });

    it('sorts songs alphabetically A-Z and Z-A', async () => {
      const az = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'title_asc',
      });
      expect(az.songs[0].track.title).toBe('Channa Mereya');

      const za = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'title_desc',
      });
      expect(za.songs[0].track.title).toBe('Tum Hi Ho');
    });

    it('sorts songs by Duration asc and desc', async () => {
      const shortest = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'duration_asc',
      });
      expect(shortest.songs[0].track.duration).toBe(45);

      const longest = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'duration_desc',
      });
      expect(longest.songs[0].track.duration).toBe(920);
    });

    it('sorts songs by File Size', async () => {
      const largest = await SearchEngine.executeGlobalSearch('', {
        ...DEFAULT_SEARCH_FILTERS,
        sortBy: 'file_size',
      });
      expect(largest.songs[0].track.fileSize).toBe(120000000); // Symphony No. 9
    });
  });

  describe('4. Genre Explorer & Unknown Genre Handling (Section 7)', () => {
    it('places tracks with missing genre metadata under "Unknown Genre"', async () => {
      const genres = await TrackRepository.getGenres();
      const unknownGenre = genres.find((g) => g.name === 'Unknown Genre');

      expect(unknownGenre).toBeDefined();
      expect(unknownGenre?.tracks.some((t) => t.id === 't_short')).toBe(true);
    });
  });

  describe('5. Search History Management (Section 13)', () => {
    it('adds, reuses, and clears recent searches', async () => {
      await SearchHistoryRepository.addSearch('Arijit Singh');
      await SearchHistoryRepository.addSearch('Classical');

      let history = await SearchHistoryRepository.getRecent(10);
      expect(history.length).toBe(2);
      expect(history[0].query).toBe('Classical'); // Most recent first

      // Remove single search
      await SearchHistoryRepository.remove(history[0].id!);
      history = await SearchHistoryRepository.getRecent(10);
      expect(history.length).toBe(1);
      expect(history[0].query).toBe('Arijit Singh');

      // Clear all
      await SearchHistoryRepository.clear();
      history = await SearchHistoryRepository.getRecent(10);
      expect(history.length).toBe(0);
    });
  });

  describe('6. Offline-First Verification (Section 16)', () => {
    it('executes global search while Air-Gap lock is strictly active without errors or network', async () => {
      NetworkAccessManager.setLock(true);
      expect(NetworkAccessManager.isNetworkAllowed()).toBe(false);

      const results = await SearchEngine.executeGlobalSearch('Arijit');
      expect(results.songs.length).toBe(2);
      expect(results.totalLocalResults).toBeGreaterThan(0);
    });
  });
});

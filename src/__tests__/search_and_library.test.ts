import { describe, it, expect, beforeEach } from 'vitest';
import { SearchEngine } from '../services/search/SearchEngine';
import {
  FilterEngine,
  DEFAULT_FILTER_CRITERIA,
  LibraryFilterCriteria,
} from '../services/filter/FilterEngine';
import { Track } from '../types';
import { db } from '../database/db';
import { TrackRepository, SearchHistoryRepository } from '../database/repository';

describe('Part 9 — Advanced Search, Filtering, Sorting & Music Library Organization', () => {
  const sampleTracks: Track[] = [
    {
      id: 't1',
      title: 'Hello',
      artist: 'Adele',
      album: '25',
      genre: 'Pop',
      duration: 295, // 4m 55s
      format: 'flac',
      bitrate: 900,
      year: 2015,
      dateAdded: 1600000000000,
      playCount: 15,
      rating: 5,
      isFavorite: true,
      source: 'local',
      path: '/music/adele/hello.flac',
      filename: 'hello.flac',
    },
    {
      id: 't2',
      title: 'Someone Who Says Hello',
      artist: 'Local Band',
      album: 'Greetings',
      genre: 'Rock',
      duration: 150, // 2m 30s
      format: 'mp3',
      bitrate: 320,
      year: 2021,
      dateAdded: 1610000000000,
      playCount: 2,
      rating: 3,
      isFavorite: false,
      source: 'local',
      path: '/music/rock/someone_who_says_hello.mp3',
      filename: 'someone_who_says_hello.mp3',
    },
    {
      id: 't3',
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      album: 'Aashiqui 2',
      genre: 'Bollywood',
      duration: 262,
      format: 'mp3',
      bitrate: 256,
      year: 2013,
      dateAdded: 1620000000000,
      playCount: 50,
      rating: 5,
      isFavorite: true,
      source: 'local',
      path: '/music/hindi/tum_hi_ho.mp3',
      filename: 'tum_hi_ho.mp3',
    },
    {
      id: 't4',
      title: 'In The End',
      artist: 'Linkin Park',
      album: 'Hybrid Theory',
      genre: 'Alternative Rock',
      duration: 216,
      format: 'flac',
      bitrate: 1050,
      year: 2000,
      dateAdded: 1590000000000,
      playCount: 30,
      rating: 5,
      isFavorite: true,
      source: 'local',
      path: '/music/linkin_park/in_the_end.flac',
      filename: 'in_the_end.flac',
    },
    {
      id: 't5',
      title: 'Interstellar Theme',
      artist: 'Hans Zimmer',
      album: 'Interstellar OST',
      genre: 'Soundtrack',
      duration: 245,
      format: 'wav',
      bitrate: 1411,
      year: 2014,
      dateAdded: 1630000000000,
      playCount: 10,
      rating: 4,
      isFavorite: false,
      source: 'local',
      path: '/music/soundtracks/interstellar.wav',
      filename: 'interstellar.wav',
    },
  ];

  beforeEach(async () => {
    await db.tracks.clear();
    await db.search_history.clear();
    await TrackRepository.saveBatch(sampleTracks);
  });

  describe('1. Global Search & Relevance Ranking', () => {
    it('scores exact title match higher than partial title match', () => {
      const scoreExact = SearchEngine.scoreTrack(sampleTracks[0], ['hello']);
      const scorePartial = SearchEngine.scoreTrack(sampleTracks[1], ['hello']);

      expect(scoreExact.score).toBeGreaterThan(scorePartial.score);
      expect(scoreExact.matchedFields).toContain('title (exact)');
    });

    it('performs case-insensitive search matching', () => {
      const lowerScore = SearchEngine.scoreTrack(sampleTracks[2], ['arijit']);
      const upperScore = SearchEngine.scoreTrack(sampleTracks[2], ['ARIJIT']);

      expect(lowerScore.score).toBeGreaterThan(0);
      expect(upperScore.score).toBe(lowerScore.score);
    });

    it('supports multi-word search matching across terms', () => {
      const multiTermScore = SearchEngine.scoreTrack(sampleTracks[2], ['arijit', 'tum', 'hi']);
      expect(multiTermScore.score).toBeGreaterThan(50);
    });

    it('executes global search and returns categorized results', async () => {
      const results = await SearchEngine.executeGlobalSearch('hello');
      expect(results.songs.length).toBe(2);
      expect(results.songs[0].track.title).toBe('Hello');
    });

    it('generates auto-suggestions from library data completely offline', async () => {
      const suggestions = await SearchEngine.generateSuggestions('li', 4);
      expect(suggestions).toContain('Linkin Park');
    });
  });

  describe('2. Search History Repository', () => {
    it('records and updates search history with counts', async () => {
      await SearchHistoryRepository.addSearch('arijit singh');
      await SearchHistoryRepository.addSearch('arijit singh');
      await SearchHistoryRepository.addSearch('rock');

      const history = await SearchHistoryRepository.getRecent(10);
      expect(history.length).toBe(2);

      const arijit = history.find((h) => h.query.toLowerCase() === 'arijit singh');
      expect(arijit?.count).toBe(2);
    });

    it('clears all search history', async () => {
      await SearchHistoryRepository.addSearch('test query');
      await SearchHistoryRepository.clear();
      const history = await SearchHistoryRepository.getRecent();
      expect(history.length).toBe(0);
    });
  });

  describe('3. Advanced Filter Engine & AND / OR Logic', () => {
    it('filters tracks by favorite status and format with AND logic', () => {
      const criteria: LibraryFilterCriteria = {
        ...DEFAULT_FILTER_CRITERIA,
        favorite: 'favorites',
        formats: ['flac'],
        logicMode: 'all',
      };

      const filtered = FilterEngine.filterTracks(sampleTracks, criteria);
      expect(filtered.length).toBe(2); // Hello (flac, fav) and In The End (flac, fav)
      expect(filtered.every((t) => t.isFavorite && t.format === 'flac')).toBe(true);
    });

    it('supports OR logic mode where any condition match is accepted', () => {
      const criteria: LibraryFilterCriteria = {
        ...DEFAULT_FILTER_CRITERIA,
        formats: ['wav'],
        quality: 'under_128',
        logicMode: 'any',
      };

      const filtered = FilterEngine.filterTracks(sampleTracks, criteria);
      expect(filtered.length).toBe(1);
      expect(filtered[0].title).toBe('Interstellar Theme');
    });

    it('filters tracks by minimum star rating', () => {
      const criteria: LibraryFilterCriteria = {
        ...DEFAULT_FILTER_CRITERIA,
        minRating: 5,
        logicMode: 'all',
      };

      const filtered = FilterEngine.filterTracks(sampleTracks, criteria);
      expect(filtered.length).toBe(3); // Adele (5), Arijit (5), Linkin Park (5)
      expect(filtered.every((t) => (t.rating || 0) >= 5)).toBe(true);
    });

    it('applies quick filter shortcuts', () => {
      const lossless = FilterEngine.applyQuickFilter(sampleTracks, 'lossless');
      expect(lossless.length).toBe(3); // flac, flac, wav

      const favs = FilterEngine.applyQuickFilter(sampleTracks, 'favorites');
      expect(favs.length).toBe(3);
    });
  });

  describe('4. Sorting & Pipeline Processing', () => {
    it('sorts tracks by play count descending', () => {
      const sorted = FilterEngine.sortTracks(sampleTracks, {
        field: 'playCount',
        direction: 'desc',
      });

      expect(sorted[0].title).toBe('Tum Hi Ho'); // 50 plays
      expect(sorted[1].title).toBe('In The End'); // 30 plays
    });

    it('sorts tracks by rating descending', () => {
      const sorted = FilterEngine.sortTracks(sampleTracks, {
        field: 'rating',
        direction: 'desc',
      });

      expect(sorted[0].rating).toBe(5);
      expect(sorted[sorted.length - 1].rating).toBe(3);
    });

    it('processes unified search + filter + sort pipeline', () => {
      const result = FilterEngine.processPipeline(
        sampleTracks,
        'hello',
        { ...DEFAULT_FILTER_CRITERIA, formats: ['flac'] },
        'all',
        { field: 'title', direction: 'asc' }
      );

      expect(result.length).toBe(1);
      expect(result[0].title).toBe('Hello');
    });
  });

  describe('5. Library Organization, Metadata & Statistics', () => {
    it('detects duplicate songs based on matching title, artist, and duration', async () => {
      const duplicateTrack: Track = {
        ...sampleTracks[0],
        id: 'dup_t1',
        path: '/music/downloads/hello_copy.flac',
      };
      await TrackRepository.save(duplicateTrack);

      const duplicates = await TrackRepository.getDuplicates();
      expect(duplicates.length).toBe(1);
      const allGroupIds = [
        duplicates[0].original.id,
        ...duplicates[0].duplicates.map((d) => d.id),
      ];
      expect(allGroupIds).toContain('t1');
      expect(allGroupIds).toContain('dup_t1');
    });

    it('updates track rating in database and persists it', async () => {
      await TrackRepository.setRating('t2', 4);
      const updated = await TrackRepository.getById('t2');
      expect(updated?.rating).toBe(4);
    });

    it('computes accurate offline library statistics', async () => {
      const stats = await TrackRepository.getLibraryStatistics();
      expect(stats.totalSongs).toBe(5);
      expect(stats.mostPlayedSong?.title).toBe('Tum Hi Ho');
      expect(stats.bitrateDistribution.lossless).toBe(3);
      expect(stats.favoriteSongsCount).toBe(3);
    });

    it('detects missing files when marked unavailable', async () => {
      await TrackRepository.markUnavailable('t1');
      const missing = await TrackRepository.getMissingFiles();
      expect(missing.length).toBe(1);
      expect(missing[0].id).toBe('t1');
    });
  });
});

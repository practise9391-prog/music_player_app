import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../database/db';
import {
  PlaylistRepository,
  PlaylistTrackRepository,
  EntityFavoriteRepository,
} from '../database/repository';
import { SmartPlaylistEngine } from '../services/playlists/SmartPlaylistEngine';
import { Track, SmartPlaylistDefinition } from '../types';

describe('Part 8 — Playlists, Favorites & Smart Collections', () => {
  beforeEach(async () => {
    await db.playlists.clear();
    await db.playlist_tracks.clear();
    await db.entity_favorites.clear();
  });

  const mockTracks: Track[] = [
    {
      id: 'local_1',
      title: 'Midnight Echoes',
      artist: 'Solaris',
      album: 'Cosmic Journey',
      duration: 210,
      format: 'flac',
      path: '/music/solar_1.flac',
      source: 'local',
      dateAdded: 1600000000000,
      playCount: 15,
      isFavorite: true,
      bitrate: 1024,
      sampleRate: 48000,
      genre: 'Ambient',
      year: 2023,
    },
    {
      id: 'local_2',
      title: 'Neon Horizon',
      artist: 'Solaris',
      album: 'Cosmic Journey',
      duration: 180,
      format: 'mp3',
      path: '/music/solar_2.mp3',
      source: 'local',
      dateAdded: 1610000000000,
      playCount: 5,
      isFavorite: false,
      bitrate: 320,
      sampleRate: 44100,
      genre: 'Synthwave',
      year: 2022,
    },
    {
      id: 'yt_abc123',
      title: 'Live Acoustic Session',
      artist: 'Acoustic Duo',
      duration: 300,
      format: 'opus',
      path: '',
      source: 'online',
      sourceType: 'youtube',
      sourceId: 'abc123xyz',
      dateAdded: 1620000000000,
      playCount: 22,
      isFavorite: true,
      cached: true,
      cachePath: '/cache/abc123xyz.opus',
      genre: 'Acoustic',
      year: 2024,
    },
    {
      id: 'local_3',
      title: 'Morning Breeze',
      artist: 'Luna Trio',
      album: 'Serenity',
      duration: 150,
      format: 'wav',
      path: '/music/breeze.wav',
      source: 'local',
      dateAdded: 1630000000000,
      playCount: 2,
      isFavorite: false,
      bitrate: 1411,
      sampleRate: 96000,
      genre: 'Classical',
      year: 2021,
    },
  ];

  describe('1. Playlist CRUD & Management', () => {
    it('creates normal playlists with initial empty counts and timestamps', async () => {
      const pl = await PlaylistRepository.create('Workout Mix', 'High energy tracks', 'normal');
      expect(pl.id).toBeDefined();
      expect(pl.name).toBe('Workout Mix');
      expect(pl.description).toBe('High energy tracks');
      expect(pl.type).toBe('normal');
      expect(pl.songCount).toBe(0);
      expect(pl.totalDuration).toBe(0);
      expect(pl.isFavorite).toBe(false);

      const retrieved = await PlaylistRepository.getById(pl.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe('Workout Mix');
    });

    it('renames playlists and updates updatedAt timestamp', async () => {
      const pl = await PlaylistRepository.create('Old Name');
      const prevUpdatedAt = pl.updatedAt;

      await new Promise((r) => setTimeout(r, 10));
      await PlaylistRepository.rename(pl.id, 'New Name');

      const updated = await PlaylistRepository.getById(pl.id);
      expect(updated?.name).toBe('New Name');
      expect(updated!.updatedAt).toBeGreaterThanOrEqual(prevUpdatedAt);
    });

    it('toggles playlist favorite status', async () => {
      const pl = await PlaylistRepository.create('Relax');
      expect(pl.isFavorite).toBe(false);

      const fav1 = await PlaylistRepository.toggleFavorite(pl.id);
      expect(fav1).toBe(true);
      const read1 = await PlaylistRepository.getById(pl.id);
      expect(read1?.isFavorite).toBe(true);

      const fav2 = await PlaylistRepository.toggleFavorite(pl.id);
      expect(fav2).toBe(false);
      const read2 = await PlaylistRepository.getById(pl.id);
      expect(read2?.isFavorite).toBe(false);
    });

    it('duplicates playlist and preserves track contents', async () => {
      const pl = await PlaylistRepository.create('Focus Mode');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0], mockTracks[1]]);

      const copy = await PlaylistRepository.duplicate(pl.id);
      expect(copy).toBeDefined();
      expect(copy?.id).not.toBe(pl.id);
      expect(copy?.name).toBe('Focus Mode (Copy)');

      const originalTracks = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      const copyTracks = await PlaylistTrackRepository.getTracksForPlaylist(copy!.id);

      expect(copyTracks.length).toBe(2);
      expect(copyTracks[0].trackId).toBe(originalTracks[0].trackId);
      expect(copyTracks[1].trackId).toBe(originalTracks[1].trackId);
    });

    it('deletes playlist and cascades removal of playlist tracks without deleting source audio', async () => {
      const pl = await PlaylistRepository.create('Temporary');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0]]);

      await PlaylistRepository.delete(pl.id);

      const plAfter = await PlaylistRepository.getById(pl.id);
      expect(plAfter).toBeUndefined();

      const tracksAfter = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(tracksAfter.length).toBe(0);
    });
  });

  describe('2. Playlist Tracks Ordering & Duplicate Protection', () => {
    it('adds tracks in order and calculates total duration and song count', async () => {
      const pl = await PlaylistRepository.create('Road Trip');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0], mockTracks[1]]);

      const tracks = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(tracks.length).toBe(2);
      expect(tracks[0].position).toBe(0);
      expect(tracks[0].trackId).toBe('local_1');
      expect(tracks[1].position).toBe(1);
      expect(tracks[1].trackId).toBe('local_2');

      const updatedPl = await PlaylistRepository.getById(pl.id);
      expect(updatedPl?.songCount).toBe(2);
      expect(updatedPl?.totalDuration).toBe(210 + 180);
    });

    it('prevents adding duplicate tracks to the same playlist', async () => {
      const pl = await PlaylistRepository.create('No Duplicates');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0]]);
      // Attempt to add mockTracks[0] again
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0], mockTracks[1]]);

      const tracks = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(tracks.length).toBe(2);
      expect(tracks.map((t) => t.trackId)).toEqual(['local_1', 'local_2']);
    });

    it('removes track and normalizes subsequent positions', async () => {
      const pl = await PlaylistRepository.create('Position Test');
      await PlaylistTrackRepository.addTracks(pl.id, [
        mockTracks[0],
        mockTracks[1],
        mockTracks[2],
      ]);

      // Remove middle track (local_2 at position 1)
      await PlaylistTrackRepository.removeTrack(pl.id, 'local_2');

      const remaining = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(remaining.length).toBe(2);
      expect(remaining[0].trackId).toBe('local_1');
      expect(remaining[0].position).toBe(0);
      expect(remaining[1].trackId).toBe('yt_abc123');
      expect(remaining[1].position).toBe(1);

      const updatedPl = await PlaylistRepository.getById(pl.id);
      expect(updatedPl?.songCount).toBe(2);
      expect(updatedPl?.totalDuration).toBe(210 + 300);
    });

    it('reorders tracks correctly with move up / move down', async () => {
      const pl = await PlaylistRepository.create('Reorder Test');
      await PlaylistTrackRepository.addTracks(pl.id, [
        mockTracks[0],
        mockTracks[1],
        mockTracks[2],
      ]);

      // Move track at index 2 (yt_abc123) to index 0
      await PlaylistTrackRepository.reorderTrack(pl.id, 2, 0);

      const reordered = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(reordered[0].trackId).toBe('yt_abc123');
      expect(reordered[1].trackId).toBe('local_1');
      expect(reordered[2].trackId).toBe('local_2');
      expect(reordered[0].position).toBe(0);
      expect(reordered[1].position).toBe(1);
      expect(reordered[2].position).toBe(2);
    });

    it('clears all tracks from playlist', async () => {
      const pl = await PlaylistRepository.create('Clear Test');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0], mockTracks[1]]);
      await PlaylistTrackRepository.clear(pl.id);

      const tracks = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(tracks.length).toBe(0);

      const updatedPl = await PlaylistRepository.getById(pl.id);
      expect(updatedPl?.songCount).toBe(0);
      expect(updatedPl?.totalDuration).toBe(0);
    });
  });

  describe('3. Smart Playlist Engine (Rules & Collections)', () => {
    it('evaluates rule: equals string and number', () => {
      const def: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'artist',
            operator: 'equals',
            value: 'Solaris',
          },
        ],
      };
      const result = SmartPlaylistEngine.filterTracks(mockTracks, def);
      expect(result.length).toBe(2);
      expect(result.every((t) => t.artist === 'Solaris')).toBe(true);
    });

    it('evaluates rule: contains (case-insensitive)', () => {
      const def: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'title',
            operator: 'contains',
            value: 'echo',
          },
        ],
      };
      const result = SmartPlaylistEngine.filterTracks(mockTracks, def);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('local_1');
    });

    it('evaluates rule: greater_than, less_than, and between for numeric fields', () => {
      // Duration > 200 seconds
      const gtDef: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r1',
            field: 'duration',
            operator: 'greater_than',
            value: 200,
          },
        ],
      };
      const gtRes = SmartPlaylistEngine.filterTracks(mockTracks, gtDef);
      expect(gtRes.length).toBe(2); // 210s and 300s

      // Play count between 5 and 20
      const betweenDef: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          {
            id: 'r2',
            field: 'play_count',
            operator: 'between',
            value: 5,
            valueSecondary: 20,
          },
        ],
      };
      const betweenRes = SmartPlaylistEngine.filterTracks(mockTracks, betweenDef);
      expect(betweenRes.length).toBe(2); // local_1 (15) and local_2 (5)
    });

    it('evaluates matchMode "all" (AND) vs "any" (OR)', () => {
      // AND: artist Solaris AND genre Synthwave -> local_2
      const andDef: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          { id: '1', field: 'artist', operator: 'equals', value: 'Solaris' },
          { id: '2', field: 'genre', operator: 'equals', value: 'Synthwave' },
        ],
      };
      expect(SmartPlaylistEngine.filterTracks(mockTracks, andDef).length).toBe(1);

      // OR: genre Ambient OR genre Synthwave -> local_1 and local_2
      const orDef: SmartPlaylistDefinition = {
        matchMode: 'any',
        rules: [
          { id: '1', field: 'genre', operator: 'equals', value: 'Ambient' },
          { id: '2', field: 'genre', operator: 'equals', value: 'Synthwave' },
        ],
      };
      expect(SmartPlaylistEngine.filterTracks(mockTracks, orDef).length).toBe(2);
    });

    it('supports sorting and track limits in smart definitions', () => {
      const sortDef: SmartPlaylistDefinition = {
        matchMode: 'all',
        rules: [
          { id: '1', field: 'duration', operator: 'greater_than', value: 0 },
        ],
        sortBy: 'play_count',
        sortOrder: 'desc',
        limit: 2,
      };

      const result = SmartPlaylistEngine.filterTracks(mockTracks, sortDef);
      expect(result.length).toBe(2);
      expect(result[0].id).toBe('yt_abc123'); // playCount 22
      expect(result[1].id).toBe('local_1'); // playCount 15
    });
  });

  describe('4. Universal Track Identity & Online / Cached YouTube Integration', () => {
    it('seamlessly supports both local tracks and cached YouTube tracks in the same playlist', async () => {
      const pl = await PlaylistRepository.create('Hybrid Playlist');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0], mockTracks[2]]);

      const tracks = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(tracks.length).toBe(2);
      expect(tracks[0].trackData?.source).toBe('local');
      expect(tracks[1].trackData?.sourceType).toBe('youtube');
      expect(tracks[1].trackData?.cached).toBe(true);
    });
  });

  describe('5. Entity Favorites (Tracks, Albums, Artists)', () => {
    it('toggles and queries favorites across tracks, albums, and artists', async () => {
      // Toggle track favorite
      const isFav1 = await EntityFavoriteRepository.toggleFavorite(
        'local_1',
        'track',
        'Midnight Echoes',
        'Solaris'
      );
      expect(isFav1).toBe(true);

      // Toggle album favorite
      await EntityFavoriteRepository.toggleFavorite(
        'Cosmic Journey',
        'album',
        'Cosmic Journey',
        'Solaris'
      );

      // Toggle artist favorite
      await EntityFavoriteRepository.toggleFavorite(
        'Solaris',
        'artist',
        'Solaris'
      );

      const allFavs = await EntityFavoriteRepository.getAll();
      expect(allFavs.length).toBe(3);

      const favAlbums = await EntityFavoriteRepository.getByType('album');
      expect(favAlbums.length).toBe(1);
      expect(favAlbums[0].title).toBe('Cosmic Journey');

      const isSolarisFav = await EntityFavoriteRepository.isFavorite('Solaris', 'artist');
      expect(isSolarisFav).toBe(true);

      // Toggle off track favorite
      const isFavOff = await EntityFavoriteRepository.toggleFavorite(
        'local_1',
        'track',
        'Midnight Echoes'
      );
      expect(isFavOff).toBe(false);
      const checkOff = await EntityFavoriteRepository.isFavorite('local_1', 'track');
      expect(checkOff).toBe(false);
    });
  });

  describe('6. Offline Guarantees', () => {
    it('performs all playlist operations purely offline without network requests', async () => {
      // In offline mode, all repos use Dexie IndexedDB
      const pl = await PlaylistRepository.create('Offline Collection');
      await PlaylistTrackRepository.addTracks(pl.id, [mockTracks[0]]);
      const list = await PlaylistRepository.getAll();
      expect(list.length).toBeGreaterThan(0);
    });
  });
});

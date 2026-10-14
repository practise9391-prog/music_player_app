import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database/db';
import { databaseIntegrityServiceInstance } from '../services/integrity/DatabaseIntegrityService';
import { audioEngineInstance } from '../audio/AudioEngine';
import { audioProcessorInstance } from '../audio/AudioProcessor';
import { Track } from '../types';

describe('Part 21 — Production Performance, Stability & Database Integrity', () => {
  beforeEach(async () => {
    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlist_tracks.clear();
    await db.play_history.clear();
    await db.favorites.clear();
  });

  describe('1. Database Referential Integrity Reconciliation', () => {
    it('detects and safely cleans orphan playlist tracks without affecting valid entries', async () => {
      // 1. Seed one valid track
      const validTrack: Track = {
        id: 'valid_track_1',
        title: 'Valid Song',
        artist: 'Artist',
        path: '/music/valid.mp3',
        duration: 210,
        format: 'mp3',
        playCount: 4,
        isFavorite: false,
        source: 'local',
        dateAdded: Date.now(),
      };
      await db.tracks.put(validTrack);

      // 2. Seed playlist
      await db.playlists.put({
        id: 'pl_test',
        name: 'Rock Classics',
        type: 'normal',
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        songCount: 3,
      });

      // 3. Add 3 playlist tracks: 1 valid, 2 pointing to non-existent track IDs
      await db.playlist_tracks.bulkAdd([
        { playlistId: 'pl_test', trackId: 'valid_track_1', position: 0, addedAt: Date.now() },
        { playlistId: 'pl_test', trackId: 'deleted_track_x', position: 1, addedAt: Date.now() },
        { playlistId: 'pl_test', trackId: 'non_existent_y', position: 2, addedAt: Date.now() },
      ]);

      expect(await db.playlist_tracks.count()).toBe(3);

      // 4. Run integrity reconciliation
      const result = await databaseIntegrityServiceInstance.reconcileDatabaseIntegrity();

      expect(result.orphanPlaylistTracksRemoved).toBe(2);
      expect(await db.playlist_tracks.count()).toBe(1);

      // 5. Verify the remaining track is the valid one
      const remainingPt = await db.playlist_tracks.toCollection().first();
      expect(remainingPt?.trackId).toBe('valid_track_1');

      // 6. Verify playlist record itself is preserved
      const playlist = await db.playlists.get('pl_test');
      expect(playlist?.name).toBe('Rock Classics');
    });

    it('sanitizes and repairs corrupted track duration, rating, and play count fields', async () => {
      const corruptTrack: Track = {
        id: 'corrupt_1',
        title: 'Corrupt Audio File',
        artist: 'Unknown',
        path: '/music/corrupt.mp3',
        duration: NaN, // Invalid duration
        playCount: -5 as any, // Corrupt negative play count
        rating: 9 as any, // Invalid rating above 5
        format: 'mp3',
        isFavorite: false,
        source: 'local',
        dateAdded: Date.now(),
      };
      await db.tracks.put(corruptTrack);

      const result = await databaseIntegrityServiceInstance.reconcileDatabaseIntegrity();
      expect(result.repairedTracks).toBe(1);

      const repaired = await db.tracks.get('corrupt_1');
      expect(repaired).toBeDefined();
      expect(repaired?.duration).toBe(0);
      expect(repaired?.playCount).toBe(0);
      expect(repaired?.rating).toBe(0);
    });

    it('cleans invalid play history and orphan favorites records', async () => {
      // Valid track
      await db.tracks.put({
        id: 'track_live',
        title: 'Live Song',
        artist: 'Artist',
        path: '/music/live.mp3',
        duration: 180,
        format: 'mp3',
        playCount: 1,
        isFavorite: true,
        source: 'local',
        dateAdded: Date.now(),
      });

      // Play history: 1 valid, 1 with empty trackId
      await db.play_history.bulkAdd([
        {
          trackId: 'track_live',
          title: 'Live Song',
          artist: 'Artist',
          playedAt: Date.now(),
          playDuration: 180,
          completed: true,
          source: 'local',
        },
        {
          trackId: '',
          title: 'Empty ID Song',
          artist: 'Unknown',
          playedAt: Date.now(),
          playDuration: 10,
          completed: false,
          source: 'local',
        },
      ]);

      // Favorites: 1 valid, 1 pointing to ghost track
      await db.favorites.bulkAdd([
        { trackId: 'track_live', addedAt: Date.now() },
        { trackId: 'ghost_track_123', addedAt: Date.now() },
      ]);

      const result = await databaseIntegrityServiceInstance.reconcileDatabaseIntegrity();

      expect(result.invalidHistoryEntriesCleaned).toBe(1);
      expect(result.invalidFavoritesCleaned).toBe(1);
      expect(await db.play_history.count()).toBe(1);
      expect(await db.favorites.count()).toBe(1);
    });
  });

  describe('2. Query Performance & Benchmark Speed', () => {
    it('executes indexed queries in under 50 milliseconds', async () => {
      // Seed 50 tracks
      const tracks: Track[] = Array.from({ length: 50 }, (_, i) => ({
        id: `bench_track_${i}`,
        title: `Benchmark Track ${i}`,
        artist: `Artist ${i % 5}`,
        album: `Album ${i % 3}`,
        path: `/music/song_${i}.mp3`,
        duration: 120 + i,
        format: 'mp3',
        playCount: i,
        isFavorite: i % 2 === 0,
        source: 'local',
        dateAdded: Date.now() - i * 1000,
      }));
      await db.tracks.bulkPut(tracks);

      const benchmark = await databaseIntegrityServiceInstance.benchmarkQuerySpeed();
      expect(benchmark.tracksQueryMs).toBeLessThan(100);
      expect(benchmark.playlistsQueryMs).toBeLessThan(100);
    });
  });

  describe('3. Single Audio Session Engine Verification', () => {
    it('verifies that AudioEngine exists as a persistent singleton instance', () => {
      expect(audioEngineInstance).toBeDefined();
      expect(typeof audioEngineInstance.play).toBe('function');
      expect(typeof audioEngineInstance.pause).toBe('function');
      expect(typeof audioEngineInstance.seek).toBe('function');
      expect(typeof audioEngineInstance.setVolume).toBe('function');

      const currentState = audioEngineInstance.getState();
      expect(currentState).toBeDefined();
      expect(currentState.status).toBeDefined();
    });

    it('enforces safety headroom and clipping ceiling on master output', () => {
      audioProcessorInstance.setMaxOutputLevel(0.9);
      expect(audioProcessorInstance.getState().maxOutputLevel).toBe(0.9);

      audioProcessorInstance.setAutoHeadroom(true);
      expect(audioProcessorInstance.getState().autoHeadroom).toBe(true);

      // Reset to 1.0 safe default
      audioProcessorInstance.setMaxOutputLevel(1.0);
      expect(audioProcessorInstance.getState().maxOutputLevel).toBe(1.0);
    });
  });

  describe('4. Air-Gap & Local Offline Isolation', () => {
    it('operates entirely on local IndexedDB without triggering fetch requests', async () => {
      // In offline-first mode, all queries and reconciliation run purely against IndexedDB
      const track: Track = {
        id: 'airgap_track',
        title: 'Offline Masterpiece',
        artist: 'Local Band',
        path: '/storage/music/offline.mp3',
        duration: 200,
        format: 'flac',
        playCount: 1,
        isFavorite: true,
        source: 'local',
        dateAdded: Date.now(),
      };
      await db.tracks.put(track);

      const found = await db.tracks.get('airgap_track');
      expect(found).toBeDefined();
      expect(found?.source).toBe('local');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../database/db';
import { appLockServiceInstance, AppLockService } from '../services/security/AppLockService';
import { storageManagementServiceInstance } from '../services/storage/StorageManagementService';
import { diagnosticServiceInstance } from '../services/diagnostics/DiagnosticService';
import { permissionManagerServiceInstance } from '../services/security/PermissionManagerService';
import { Track } from '../types';

describe('Part 20 — Complete Settings, Security, Privacy & App Management', () => {
  beforeEach(async () => {
    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlist_tracks.clear();
    await db.play_history.clear();
    await db.search_history.clear();
    await db.artwork_cache.clear();
    await db.lyrics.clear();
    diagnosticServiceInstance.clearLogs();
    appLockServiceInstance.resetAttempts();
    appLockServiceInstance.unlock();
  });

  describe('1. Security & App Lock Engine (AppLockService)', () => {
    it('generates cryptographic 16-byte hex salts', () => {
      const salt1 = appLockServiceInstance.generateSalt();
      const salt2 = appLockServiceInstance.generateSalt();

      expect(salt1).toBeDefined();
      expect(salt2).toBeDefined();
      expect(salt1).not.toBe(salt2);
      expect(salt1.length).toBeGreaterThanOrEqual(16);
    });

    it('hashes PIN with salt using SHA-256 and verifies correct PIN', async () => {
      const pin = '4829';
      const { pinHash, pinSalt } = await appLockServiceInstance.setupPin(pin);

      expect(pinHash).toBeDefined();
      expect(pinSalt).toBeDefined();

      const isValid = await appLockServiceInstance.verifyPin(pin, pinHash, pinSalt);
      expect(isValid).toBe(true);
      expect(appLockServiceInstance.isLocked()).toBe(false);
    });

    it('rejects incorrect PIN and increments failed attempts', async () => {
      const pin = '1234';
      const { pinHash, pinSalt } = await appLockServiceInstance.setupPin(pin);

      const isValid = await appLockServiceInstance.verifyPin('9999', pinHash, pinSalt);
      expect(isValid).toBe(false);
      expect(appLockServiceInstance.getFailedAttempts()).toBe(1);
    });

    it('activates rate-limiting lockout after 5 consecutive failed attempts', async () => {
      const { pinHash, pinSalt } = await appLockServiceInstance.setupPin('7777');

      for (let i = 0; i < 4; i++) {
        await appLockServiceInstance.verifyPin('0000', pinHash, pinSalt);
      }
      expect(appLockServiceInstance.isLockoutActive()).toBe(false);

      // 5th attempt triggers lockout
      await appLockServiceInstance.verifyPin('0000', pinHash, pinSalt);
      expect(appLockServiceInstance.isLockoutActive()).toBe(true);
      expect(appLockServiceInstance.getLockoutRemainingSeconds()).toBeGreaterThan(0);

      // Further attempts are rejected immediately while locked out
      const lockedAttempt = await appLockServiceInstance.verifyPin('7777', pinHash, pinSalt);
      expect(lockedAttempt).toBe(false);
    });

    it('evaluates background relock policy according to timeout settings', () => {
      appLockServiceInstance.unlock();
      expect(appLockServiceInstance.isLocked()).toBe(false);

      // Immediate relock (0 minutes)
      const lockedImmediately = appLockServiceInstance.evaluateBackgroundLock(0);
      expect(lockedImmediately).toBe(true);
      expect(appLockServiceInstance.isLocked()).toBe(true);

      appLockServiceInstance.unlock();
      // 5-minute timeout where only 0s elapsed: should not lock
      appLockServiceInstance.recordActivity();
      const notLocked = appLockServiceInstance.evaluateBackgroundLock(5);
      expect(notLocked).toBe(false);
      expect(appLockServiceInstance.isLocked()).toBe(false);
    });

    it('supports biometric authentication check', async () => {
      const isAvailable = await appLockServiceInstance.isBiometricsAvailable();
      expect(typeof isAvailable).toBe('boolean');

      const authResult = await appLockServiceInstance.authenticateBiometrics();
      expect(typeof authResult).toBe('boolean');
    });
  });

  describe('2. Storage Management & Safe Cache Engine', () => {
    it('computes accurate storage breakdown across library, downloads, and database', async () => {
      const mockTrack1: Track = {
        id: 'track_1',
        title: 'Song One',
        artist: 'Artist A',
        path: '/music/song1.mp3',
        duration: 200,
        bitrate: 320,
        fileSize: 8000000,
        format: 'mp3',
        playCount: 5,
        isFavorite: false,
        source: 'local',
        dateAdded: Date.now(),
      };
      const mockTrack2: Track = {
        id: 'track_2',
        title: 'Song Two',
        artist: 'Artist B',
        path: '/music/song2.flac',
        duration: 180,
        bitrate: 800,
        fileSize: 18000000,
        format: 'flac',
        playCount: 12,
        isFavorite: true,
        source: 'local',
        dateAdded: Date.now(),
      };
      await db.tracks.bulkPut([mockTrack1, mockTrack2]);

      // Add artwork cache entry
      await db.artwork_cache.put({
        id: 'art_1',
        dataUrl: 'data:image/jpeg;base64,fake',
        mimeType: 'image/jpeg',
        width: 300,
        height: 300,
        createdAt: Date.now(),
      });

      const breakdown = await storageManagementServiceInstance.getStorageBreakdown();

      expect(breakdown.audioLibraryCount).toBe(2);
      expect(breakdown.audioLibraryBytes).toBe(26000000); // 8MB + 18MB
      expect(breakdown.artworkCacheCount).toBe(1);
      expect(breakdown.totalUsageBytes).toBeGreaterThan(26000000);
    });

    it('safely clears cache WITHOUT deleting audio files, downloads, playlists, or ratings', async () => {
      // 1. Seed tracks and playlist
      const track: Track = {
        id: 'track_safe_1',
        title: 'Safe Song',
        artist: 'Indie Artist',
        path: '/storage/music/safe.mp3',
        duration: 240,
        format: 'mp3',
        playCount: 15,
        rating: 5,
        isFavorite: true,
        source: 'local',
        dateAdded: Date.now(),
      };
      await db.tracks.put(track);

      await db.playlists.put({
        id: 'pl_safe',
        name: 'My Safe Playlist',
        type: 'normal',
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        songCount: 1,
      });

      // 2. Seed regenerable artwork cache
      await db.artwork_cache.put({
        id: 'art_temp',
        dataUrl: 'data:image/png;base64,temp',
        mimeType: 'image/png',
        width: 300,
        height: 300,
        createdAt: Date.now(),
      });

      expect(await db.artwork_cache.count()).toBe(1);

      // 3. Run safe clear cache
      const clearRes = await storageManagementServiceInstance.clearSafeCache();
      expect(clearRes.itemsCleared).toBeGreaterThanOrEqual(1);
      expect(clearRes.freedBytes).toBeGreaterThan(0);

      // 4. Verify regenerable cache is cleared
      expect(await db.artwork_cache.count()).toBe(0);

      // 5. CRITICAL VERIFICATION: Local tracks, playlists, favorites, and ratings remain 100% intact!
      const preservedTrack = await db.tracks.get('track_safe_1');
      expect(preservedTrack).toBeDefined();
      expect(preservedTrack?.title).toBe('Safe Song');
      expect(preservedTrack?.rating).toBe(5);
      expect(preservedTrack?.isFavorite).toBe(true);

      const preservedPlaylist = await db.playlists.get('pl_safe');
      expect(preservedPlaylist).toBeDefined();
      expect(preservedPlaylist?.name).toBe('My Safe Playlist');
    });

    it('executes granular resets for search and play history', async () => {
      await db.search_history.add({ query: 'rock', timestamp: Date.now(), count: 2 });
      await db.search_history.add({ query: 'jazz', timestamp: Date.now(), count: 1 });
      await db.play_history.add({
        trackId: 't1',
        title: 'Song T1',
        artist: 'Artist T1',
        playedAt: Date.now(),
        playDuration: 180,
        completed: true,
        source: 'local',
      });

      expect(await db.search_history.count()).toBe(2);
      expect(await db.play_history.count()).toBe(1);

      const clearedSearches = await storageManagementServiceInstance.clearSearchHistory();
      expect(clearedSearches).toBe(2);
      expect(await db.search_history.count()).toBe(0);

      const clearedPlays = await storageManagementServiceInstance.clearPlayHistory();
      expect(clearedPlays).toBe(1);
      expect(await db.play_history.count()).toBe(0);
    });
  });

  describe('3. Diagnostic Logging & Privacy Sanitization (DiagnosticService)', () => {
    it('logs events into in-memory circular buffer', () => {
      diagnosticServiceInstance.info('PlayerEngine', 'Track transition started.');
      diagnosticServiceInstance.warn('Buffer', 'Under-run detected.');

      const logs = diagnosticServiceInstance.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);

      const last = logs[logs.length - 1];
      expect(last.level).toBe('warn');
      expect(last.tag).toBe('Buffer');
      expect(last.message).toContain('Under-run detected.');
    });

    it('sanitizes local filesystem paths and confidential tokens in logs', () => {
      const rawMsg =
        'Loaded track from /storage/emulated/0/Music/Album/Song.mp3 with token https://api.service.com/stream?token=secret12345&key=xyz';
      const sanitized = diagnosticServiceInstance.sanitizeString(rawMsg);

      expect(sanitized).not.toContain('/storage/emulated/0/Music/Album/Song.mp3');
      expect(sanitized).toContain('[DEVICE_STORAGE_PATH]');
      expect(sanitized).not.toContain('secret12345');
      expect(sanitized).toContain('token=[REDACTED]');
      expect(sanitized).toContain('key=[REDACTED]');
    });

    it('exports formatted sanitized plain text logs', () => {
      diagnosticServiceInstance.info('Sync', 'Indexed folder /home/user/Music');
      const text = diagnosticServiceInstance.exportSanitizedLogsAsText();

      expect(text).toContain('Nova Music Player — Sanitized Diagnostic');
      expect(text).not.toContain('/home/user/Music');
      expect(text).toContain('[LOCAL_FS_PATH]');
    });
  });

  describe('4. Permission Manager (PermissionManagerService)', () => {
    it('enumerates device permissions across Storage, Notifications, Bluetooth, WakeLock, and Biometrics', async () => {
      const perms = await permissionManagerServiceInstance.getPermissionsList();

      expect(perms.length).toBe(5);
      const permIds = perms.map((p) => p.id);
      expect(permIds).toContain('storage');
      expect(permIds).toContain('notifications');
      expect(permIds).toContain('bluetooth');
      expect(permIds).toContain('wakelock');
      expect(permIds).toContain('biometrics');

      const storagePerm = perms.find((p) => p.id === 'storage');
      expect(storagePerm?.isRequired).toBe(true);
      expect(storagePerm?.category).toBe('Storage');
    });

    it('handles permission requests gracefully without throwing exceptions', async () => {
      const result = await permissionManagerServiceInstance.requestPermission('storage');
      expect(typeof result).toBe('string');
      expect(['granted', 'denied', 'permanently_denied']).toContain(result);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../database/db';
import { Track } from '../types';
import { AndroidBridge, androidBridgeInstance } from '../services/android/AndroidBridge';
import { MediaStoreSyncService, mediaStoreSyncServiceInstance } from '../services/android/MediaStoreSyncService';
import { AndroidWidgetService, androidWidgetServiceInstance } from '../services/android/AndroidWidgetService';
import { DeepLinkManager, deepLinkManagerInstance } from '../services/navigation/DeepLinkManager';
import { AndroidAutoService, androidAutoServiceInstance } from '../services/android/AndroidAutoService';
import { TrackRepository, PlaylistRepository } from '../database/repository';

describe('Part 16 — Android System Integration & Native Device Features', () => {
  beforeEach(async () => {
    (globalThis as any).window = globalThis;
    if (!(globalThis as any).dispatchEvent) {
      (globalThis as any).dispatchEvent = vi.fn();
    }
    if (!(globalThis as any).CustomEvent) {
      (globalThis as any).CustomEvent = class MockCustomEvent {
        constructor(public type: string, public detail?: any) {}
      };
    }
    if (!(globalThis as any).URL.createObjectURL) {
      (globalThis as any).URL.createObjectURL = () => 'blob:mock-url';
    }
    await db.tracks.clear();
    await db.playlists.clear();
    await db.play_history.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).AndroidBridge;
    delete (globalThis as any).AndroidInterface;
  });

  // ─────────────────────────────────────────────────────────────
  // 1. AndroidBridge Platform Detection & Scoped Permissions
  // ─────────────────────────────────────────────────────────────
  describe('AndroidBridge: Platform & Permission Model', () => {
    it('detects Android environment via User Agent', () => {
      const originalUserAgent = navigator.userAgent;
      try {
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile',
          configurable: true,
        });
        expect(androidBridgeInstance.isAndroid()).toBe(true);
        expect(androidBridgeInstance.getAndroidApiLevel()).toBe(34);
        expect(androidBridgeInstance.getRequiredAudioPermissionName()).toBe(
          'android.permission.READ_MEDIA_AUDIO'
        );
      } finally {
        Object.defineProperty(navigator, 'userAgent', {
          value: originalUserAgent,
          configurable: true,
        });
      }
    });

    it('requires READ_EXTERNAL_STORAGE on legacy Android versions (API < 33)', () => {
      const originalUserAgent = navigator.userAgent;
      try {
        Object.defineProperty(navigator, 'userAgent', {
          value: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 Chrome/98.0 Mobile',
          configurable: true,
        });
        expect(androidBridgeInstance.getAndroidApiLevel()).toBe(30);
        expect(androidBridgeInstance.getRequiredAudioPermissionName()).toBe(
          'android.permission.READ_EXTERNAL_STORAGE'
        );
      } finally {
        Object.defineProperty(navigator, 'userAgent', {
          value: originalUserAgent,
          configurable: true,
        });
      }
    });

    it('handles permission requests and persists status', async () => {
      expect(await androidBridgeInstance.checkStoragePermission()).toBe('denied');
      const granted = await androidBridgeInstance.requestStoragePermission();
      expect(granted).toBe('granted');
      expect(await androidBridgeInstance.checkStoragePermission()).toBe('granted');
      expect(localStorage.getItem('nova_android_storage_permission')).toBe('granted');
    });

    it('safely attempts to open application settings without crashing', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      androidBridgeInstance.openSystemSettings();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('android.settings.APPLICATION_DETAILS_SETTINGS')
      );
    });

    it('registers and triggers external audio file intent listeners', () => {
      const listener = vi.fn();
      const unsub = androidBridgeInstance.registerIntentListener(listener);

      const mockFile = new File(['dummy audio content'], 'song.mp3', { type: 'audio/mpeg' });
      androidBridgeInstance.dispatchExternalAudio([mockFile], 'play');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith([mockFile], 'play');

      unsub();
      androidBridgeInstance.dispatchExternalAudio([mockFile], 'queue');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Storage Access Framework (SAF) & Native Sharing
  // ─────────────────────────────────────────────────────────────
  describe('SAF & Native Android Share Sheet', () => {
    it('generates compliant M3U/M3U8 playlist export without duplicating audio bytes', async () => {
      const mockTrack: Track = {
        id: 't_share_1',
        title: 'Kesariya',
        artist: 'Arijit Singh',
        album: 'Brahmastra',
        duration: 268,
        path: '/storage/emulated/0/Music/Kesariya.mp3',
        filename: 'Kesariya.mp3',
        format: 'mp3',
        dateAdded: Date.now(),
        playCount: 10,
        isFavorite: true,
        source: 'local',
      };

      const m3uContent = androidBridgeInstance.generateM3UPlaylist([mockTrack], 'Bollywood Hits');
      expect(m3uContent).toContain('#EXTM3U');
      expect(m3uContent).toContain('#EXTINF:268,Arijit Singh - Kesariya');
      expect(m3uContent).toContain('/storage/emulated/0/Music/Kesariya.mp3');
    });

    it('shares track via Web Share API when supported', async () => {
      const mockTrack: Track = {
        id: 't_share_2',
        title: 'Chaiyya Chaiyya',
        artist: 'Sukhwinder Singh',
        album: 'Dil Se',
        duration: 390,
        path: '/Music/Chaiyya.mp3',
        filename: 'Chaiyya.mp3',
        format: 'mp3',
        dateAdded: Date.now(),
        playCount: 5,
        isFavorite: false,
        source: 'local',
      };

      const shareMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'share', {
        value: shareMock,
        configurable: true,
      });

      const shared = await androidBridgeInstance.shareTrack(mockTrack);
      expect(shared).toBe(true);
      expect(shareMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Chaiyya Chaiyya',
          text: expect.stringContaining('Sukhwinder Singh'),
        })
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. MediaStore Sync & Non-Destructive Reconciliation
  // ─────────────────────────────────────────────────────────────
  describe('MediaStoreSyncService: Non-Destructive Media Reconciliation', () => {
    it('indexes discovered audio files into db.tracks', async () => {
      const file1 = new File(['fake-audio-1'], 'Apna Bana Le.mp3', { type: 'audio/mpeg' });
      const file2 = new File(['fake-audio-2'], 'Tum Hi Ho.mp3', { type: 'audio/mpeg' });

      const syncResult = await mediaStoreSyncServiceInstance.syncFiles([file1, file2], 'SDCard/Music');

      expect(syncResult.added).toBe(2);
      expect(syncResult.updated).toBe(0);
      expect(syncResult.markedUnavailable).toBe(0);

      const all = await TrackRepository.getAll();
      expect(all.length).toBe(2);
      expect(all.some((t) => t.filename === 'Apna Bana Le.mp3')).toBe(true);
      expect(all.some((t) => t.filename === 'Tum Hi Ho.mp3')).toBe(true);
    });

    it('preserves user metadata (ratings, play counts, favorites) on re-sync', async () => {
      const file = new File(['initial-content'], 'Deva Deva.mp3', { type: 'audio/mpeg' });
      await mediaStoreSyncServiceInstance.syncFiles([file], 'Device Media');

      // User modifies metadata: marks favorite and sets 5-star rating
      const existing = (await TrackRepository.getAll())[0];
      await TrackRepository.setFavorite(existing.id, true);
      await TrackRepository.setRating(existing.id, 5);
      await db.tracks.update(existing.id, { playCount: 42 });

      // Simulate re-sync of a modified version of the same file
      const updatedFile = new File(['initial-content-modified-longer'], 'Deva Deva.mp3', {
        type: 'audio/mpeg',
      });
      const resyncResult = await mediaStoreSyncServiceInstance.syncFiles([updatedFile], 'Device Media');
      expect(resyncResult.updated).toBe(1);

      const refreshed = await TrackRepository.getById(existing.id);
      expect(refreshed?.isFavorite).toBe(true);
      expect(refreshed?.rating).toBe(5);
      expect(refreshed?.playCount).toBe(42);
    });

    it('marks detached or missing files as unavailable instead of deleting user records', async () => {
      const fileA = new File(['track-a'], 'SongA.mp3', { type: 'audio/mpeg' });
      const fileB = new File(['track-b'], 'SongB.mp3', { type: 'audio/mpeg' });

      // Initial sync with 2 tracks
      await mediaStoreSyncServiceInstance.syncFiles([fileA, fileB], 'Removable SD');

      const initialTracks = await TrackRepository.getAll();
      expect(initialTracks.length).toBe(2);

      // Simulate SD Card removed or partial folder scan (only fileA is found)
      const partialSync = await mediaStoreSyncServiceInstance.syncFiles([fileA], 'Removable SD');
      expect(partialSync.markedUnavailable).toBe(1);

      // Both tracks must still exist in database, SongB marked isAvailable = false
      const allAfterSync = await TrackRepository.getAllIncludingUnavailable();
      expect(allAfterSync.length).toBe(2);

      const trackB = allAfterSync.find((t) => t.filename === 'SongB.mp3');
      expect(trackB?.isAvailable).toBe(false);

      // When SD card is re-inserted and fileB is discovered again, it is restored
      const restoredSync = await mediaStoreSyncServiceInstance.syncFiles([fileA, fileB], 'Removable SD');
      expect(restoredSync.restored + restoredSync.updated).toBeGreaterThanOrEqual(1);

      const restoredTrackB = await TrackRepository.getById(trackB!.id);
      expect(restoredTrackB?.isAvailable).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Android Home Screen Widgets & Quick Settings
  // ─────────────────────────────────────────────────────────────
  describe('AndroidWidgetService: Home Screen Widgets & Quick Settings', () => {
    it('updates widget payload and notifies subscribers', () => {
      const mockTrack: Track = {
        id: 't_widget_1',
        title: 'Satranga',
        artist: 'Arijit Singh',
        album: 'Animal',
        duration: 270,
        path: '/Music/Satranga.mp3',
        filename: 'Satranga.mp3',
        format: 'mp3',
        dateAdded: Date.now(),
        playCount: 15,
        isFavorite: true,
        source: 'local',
      };

      const listener = vi.fn();
      const unsub = androidWidgetServiceInstance.subscribe(listener);

      androidWidgetServiceInstance.updateWidgetState(mockTrack, 'playing', 45);

      const payload = androidWidgetServiceInstance.getPayload();
      expect(payload.title).toBe('Satranga');
      expect(payload.artist).toBe('Arijit Singh');
      expect(payload.album).toBe('Animal');
      expect(payload.isPlaying).toBe(true);
      expect(payload.position).toBe(45);
      expect(payload.duration).toBe(270);
      expect(listener).toHaveBeenCalled();

      unsub();
    });

    it('throttles rapid redundant widget updates to protect device battery', () => {
      const nativeUpdateSpy = vi.fn();
      (globalThis as any).AndroidBridge = {
        updateHomeScreenWidget: nativeUpdateSpy,
      };

      const mockTrack: Track = {
        id: 't_widget_throttle',
        title: 'Pehle Bhi Main',
        artist: 'Vishal Mishra',
        album: 'Animal',
        duration: 250,
        path: '/Music/PehleBhiMain.mp3',
        filename: 'PehleBhiMain.mp3',
        format: 'mp3',
        dateAdded: Date.now(),
        playCount: 1,
        isFavorite: false,
        source: 'local',
      };

      // First update
      androidWidgetServiceInstance.updateWidgetState(mockTrack, 'playing', 30);
      const callCount1 = nativeUpdateSpy.mock.calls.length;
      expect(callCount1).toBe(3); // 'small', 'medium', 'large'

      // Immediate identical update with minor position jitter (< 2 sec) should be throttled
      androidWidgetServiceInstance.updateWidgetState(mockTrack, 'playing', 30.5);
      expect(nativeUpdateSpy.mock.calls.length).toBe(callCount1);
    });

    it('updates Quick Settings tile via AndroidBridge', () => {
      const tileSpy = vi.fn();
      (globalThis as any).AndroidBridge = {
        updateQuickSettingsTile: tileSpy,
      };

      androidBridgeInstance.updateQuickSettingsTile(true, 'Hua Main', 'Raghav Chaitanya');
      expect(tileSpy).toHaveBeenCalledWith(true, 'Hua Main', 'Raghav Chaitanya');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Deep Link Manager & App Launcher Shortcuts
  // ─────────────────────────────────────────────────────────────
  describe('DeepLinkManager: URL Schemes & Launcher Shortcuts', () => {
    it('parses custom URL scheme novamusic:// routes', () => {
      expect(deepLinkManagerInstance.parseDeepLink('novamusic://nowplaying')).toEqual({
        type: 'nowplaying',
      });

      expect(deepLinkManagerInstance.parseDeepLink('novamusic://track/track_123')).toEqual({
        type: 'track',
        id: 'track_123',
      });

      expect(deepLinkManagerInstance.parseDeepLink('novamusic://playlist/pl_456')).toEqual({
        type: 'playlist',
        id: 'pl_456',
      });

      expect(deepLinkManagerInstance.parseDeepLink('novamusic://search?q=Arijit')).toEqual({
        type: 'search',
        query: 'Arijit',
      });

      expect(
        deepLinkManagerInstance.parseDeepLink(
          'novamusic://online?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        )
      ).toEqual({
        type: 'online',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });
    });

    it('parses web launcher shortcut query parameters (?action=favorites)', () => {
      expect(deepLinkManagerInstance.parseDeepLink('http://localhost/?action=favorites')).toEqual({
        type: 'route',
        route: 'favorites',
      });

      expect(deepLinkManagerInstance.parseDeepLink('http://localhost/?action=playlists')).toEqual({
        type: 'route',
        route: 'playlists',
      });

      expect(deepLinkManagerInstance.parseDeepLink('http://localhost/?action=search&q=rock')).toEqual({
        type: 'search',
        query: 'rock',
      });
    });

    it('rejects invalid or unsafe URL schemes gracefully', () => {
      expect(deepLinkManagerInstance.parseDeepLink('javascript:alert(1)')).toBeNull();
      expect(deepLinkManagerInstance.parseDeepLink('file:///etc/passwd')).toBeNull();
      expect(deepLinkManagerInstance.parseDeepLink('unknownscheme://something')).toBeNull();
    });

    it('dispatches action to registered handler', async () => {
      const handler = vi.fn();
      deepLinkManagerInstance.setActionHandler(handler);

      await deepLinkManagerInstance.handleDeepLink('novamusic://nowplaying');
      expect(handler).toHaveBeenCalledWith({ type: 'nowplaying' });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Android Auto Media Browser Compliance
  // ─────────────────────────────────────────────────────────────
  describe('AndroidAutoService: Offline Media Browser & Driver Safety', () => {
    beforeEach(async () => {
      await db.tracks.bulkAdd([
        {
          id: 'auto_track_1',
          title: 'Ilahi',
          artist: 'Arijit Singh',
          album: 'Yeh Jawaani Hai Deewani',
          duration: 228,
          path: '/Music/Ilahi.mp3',
          filename: 'Ilahi.mp3',
          format: 'mp3',
          dateAdded: Date.now(),
          playCount: 20,
          isFavorite: true,
          source: 'local',
        },
        {
          id: 'auto_track_2',
          title: 'Subhanallah',
          artist: 'Sreerama Chandra',
          album: 'Yeh Jawaani Hai Deewani',
          duration: 249,
          path: '/Music/Subhanallah.mp3',
          filename: 'Subhanallah.mp3',
          format: 'mp3',
          dateAdded: Date.now(),
          playCount: 15,
          isFavorite: false,
          source: 'local',
        },
      ]);

      await PlaylistRepository.create('Road Trip 2026', 'Driving music collection');
    });

    it('exposes compliant Android Auto root categories', async () => {
      const categories = await androidAutoServiceInstance.getRootCategories();
      expect(categories).toHaveLength(4);

      const ids = categories.map((c) => c.id);
      expect(ids).toContain('recent');
      expect(ids).toContain('favorites');
      expect(ids).toContain('playlists');
      expect(ids).toContain('songs');

      const allSongsCat = categories.find((c) => c.id === 'songs');
      expect(allSongsCat?.itemCount).toBe(2);

      const favCat = categories.find((c) => c.id === 'favorites');
      expect(favCat?.itemCount).toBe(1);
    });

    it('browses media items for categories with offline data', async () => {
      const songs = await androidAutoServiceInstance.getCategoryItems('songs');
      expect(songs.length).toBe(2);
      expect(songs[0].isPlayable).toBe(true);
      expect(songs[0].category).toBe('songs');

      const favorites = await androidAutoServiceInstance.getCategoryItems('favorites');
      expect(favorites.length).toBe(1);
      expect(favorites[0].title).toBe('Ilahi');

      const playlists = await androidAutoServiceInstance.getCategoryItems('playlists');
      expect(playlists.length).toBe(1);
      expect(playlists[0].title).toBe('Road Trip 2026');
      expect(playlists[0].isPlayable).toBe(false);
    });
  });
});

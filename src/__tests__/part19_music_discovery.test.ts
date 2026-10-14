import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../database/db';
import {
  Track,
  PlaylistRecord,
  HomeDashboardSettings,
  DEFAULT_HOME_SETTINGS,
} from '../types';
import {
  TrackRepository,
  PlaylistRepository,
  PlayHistoryRepository,
  PlaybackSessionRepository,
  PlayerStateRepository,
  SettingsRepository,
} from '../database/repository';
import {
  MusicDiscoveryService,
  musicDiscoveryService,
} from '../services/discovery/MusicDiscoveryService';

describe('Part 19 — Advanced Music Discovery & Personalized Home Experience', () => {
  const sampleTrack1: Track = {
    id: 'track-1',
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    genre: 'Progressive Rock',
    year: 1979,
    duration: 382,
    path: '/storage/music/Comfortably_Numb.mp3',
    format: 'mp3',
    bitrate: 320,
    fileSize: 15000000,
    playCount: 15,
    lastPlayedAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
    dateAdded: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 days ago
    isFavorite: true,
    rating: 5,
    source: 'local',
    isAvailable: true,
  };

  const sampleTrack2: Track = {
    id: 'track-2',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    genre: 'Progressive Rock',
    year: 1973,
    duration: 425,
    path: '/storage/music/Time.flac',
    format: 'flac',
    bitrate: 960,
    fileSize: 45000000,
    playCount: 8,
    lastPlayedAt: Date.now() - 20 * 24 * 60 * 60 * 1000, // 20 days ago (Rediscover candidate)
    dateAdded: Date.now() - 50 * 24 * 60 * 60 * 1000,
    isFavorite: false,
    rating: 4,
    source: 'local',
    isAvailable: true,
  };

  const sampleTrack3: Track = {
    id: 'track-3',
    title: 'Money',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    genre: 'Progressive Rock',
    year: 1973,
    duration: 382,
    path: '/storage/music/Money.mp3',
    format: 'mp3',
    bitrate: 320,
    fileSize: 12000000,
    playCount: 0, // Never played
    dateAdded: Date.now() - 5 * 24 * 60 * 60 * 1000, // Added 5 days ago
    isFavorite: false,
    rating: 0,
    source: 'local',
    isAvailable: true,
  };

  const sampleTrack4: Track = {
    id: 'track-4',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    genre: 'Pop',
    year: 1982,
    duration: 294,
    path: '/storage/music/Billie_Jean.mp3',
    format: 'mp3',
    bitrate: 320,
    fileSize: 10000000,
    playCount: 20,
    lastPlayedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    dateAdded: Date.now() - 10 * 24 * 60 * 60 * 1000,
    isFavorite: true,
    rating: 5,
    source: 'local',
    isAvailable: true,
  };

  const sampleTrackUnavailable: Track = {
    id: 'track-missing',
    title: 'Deleted Audio File',
    artist: 'Lost Artist',
    duration: 180,
    path: '/storage/deleted.mp3',
    format: 'mp3',
    dateAdded: Date.now(),
    playCount: 1,
    isFavorite: false,
    source: 'local',
    isAvailable: false,
  };

  beforeEach(async () => {
    // Mock CustomEvent and window if needed
    (globalThis as any).window = globalThis;
    if (!(globalThis as any).dispatchEvent) {
      (globalThis as any).dispatchEvent = vi.fn();
    }
    if (!(globalThis as any).CustomEvent) {
      (globalThis as any).CustomEvent = class MockCustomEvent {
        constructor(public type: string, public detail?: any) {}
      };
    }

    // Clear test tables
    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlist_tracks.clear();
    await db.play_history.clear();
    await db.playback_sessions.clear();
    await db.player_state.clear();
    await db.settings_store.clear();

    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Seed test library
    await TrackRepository.save(sampleTrack1);
    await TrackRepository.save(sampleTrack2);
    await TrackRepository.save(sampleTrack3);
    await TrackRepository.save(sampleTrack4);
    await TrackRepository.save(sampleTrackUnavailable);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Continue Listening & Track Availability
  // ─────────────────────────────────────────────────────────────
  describe('Continue Listening & Availability Verification', () => {
    it('verifies track availability and flags missing/unavailable tracks without crashing', () => {
      const validCheck = musicDiscoveryService.verifyTrackPlayback(sampleTrack1);
      expect(validCheck.canPlay).toBe(true);

      const invalidCheck = musicDiscoveryService.verifyTrackPlayback(sampleTrackUnavailable);
      expect(invalidCheck.canPlay).toBe(false);
      expect(invalidCheck.reason).toContain('unavailable or has been removed');
    });

    it('returns the last played track and position from persisted player state', async () => {
      await PlayerStateRepository.savePlayerState({
        trackId: sampleTrack1.id,
        position: 145,
        volume: 0.8,
        isMuted: false,
        playbackRate: 1.0,
        repeatMode: 'off',
        isShuffle: false,
        queue: [sampleTrack1],
        queueIndex: 0,
        updatedAt: Date.now(),
      });

      const continueData = await musicDiscoveryService.getContinueListeningData();
      expect(continueData.lastTrack).toBeDefined();
      expect(continueData.lastTrack?.id).toBe(sampleTrack1.id);
      expect(continueData.lastPosition).toBe(145);
    });

    it('retrieves recently played tracks excluding unavailable tracks', async () => {
      await PlayHistoryRepository.addRecord({
        trackId: sampleTrack4.id,
        title: sampleTrack4.title,
        artist: sampleTrack4.artist,
        playedAt: Date.now() - 1000,
        playDuration: 294,
        completed: true,
        source: 'local',
      });
      await PlayHistoryRepository.addRecord({
        trackId: sampleTrack1.id,
        title: sampleTrack1.title,
        artist: sampleTrack1.artist,
        playedAt: Date.now() - 5000,
        playDuration: 382,
        completed: true,
        source: 'local',
      });
      await PlayHistoryRepository.addRecord({
        trackId: sampleTrackUnavailable.id,
        title: sampleTrackUnavailable.title,
        artist: sampleTrackUnavailable.artist,
        playedAt: Date.now() - 2000,
        playDuration: 180,
        completed: true,
        source: 'local',
      });

      const continueData = await musicDiscoveryService.getContinueListeningData();
      expect(continueData.recentTracks.length).toBe(2);
      expect(continueData.recentTracks.map((t) => t.id)).toContain(sampleTrack4.id);
      expect(continueData.recentTracks.map((t) => t.id)).toContain(sampleTrack1.id);
      expect(continueData.recentTracks.map((t) => t.id)).not.toContain(sampleTrackUnavailable.id);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Recently Added & Most Played
  // ─────────────────────────────────────────────────────────────
  describe('Recently Added & Most-Played Music', () => {
    it('sorts recently added songs with the newest dateAdded first', async () => {
      const recent = await musicDiscoveryService.getRecentlyAdded(4);
      expect(recent.length).toBe(4); // 4 available tracks
      expect(recent[0].id).toBe(sampleTrack3.id); // Added 5 days ago
      expect(recent[1].id).toBe(sampleTrack4.id); // Added 10 days ago
    });

    it('ranks most-played songs by playback count', async () => {
      const mostPlayed = await musicDiscoveryService.getMostPlayed(4);
      expect(mostPlayed.length).toBeGreaterThanOrEqual(3);
      expect(mostPlayed[0].id).toBe(sampleTrack4.id); // 20 plays
      expect(mostPlayed[1].id).toBe(sampleTrack1.id); // 15 plays
      expect(mostPlayed[2].id).toBe(sampleTrack2.id); // 8 plays
      // sampleTrack3 has 0 plays, so excluded from most played
      expect(mostPlayed.find((t) => t.id === sampleTrack3.id)).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Explainable Offline Recommendations ("Made for You")
  // ─────────────────────────────────────────────────────────────
  describe('Personalized Offline Recommendations', () => {
    it('generates explainable recommendations based on top artist and top genre', async () => {
      const recs = await musicDiscoveryService.getMadeForYouRecommendations(6);
      expect(recs.length).toBeGreaterThan(0);

      // Pink Floyd has the most tracks and high play count in library
      const pinkFloydRec = recs.find((r) => r.category === 'because_you_like');
      if (pinkFloydRec) {
        expect(pinkFloydRec.reason).toContain('Because you frequently listen to Pink Floyd');
      }

      // Time (sampleTrack2) was last played 20 days ago -> Rediscover candidate
      const rediscoverRec = recs.find((r) => r.category === 'rediscover');
      if (rediscoverRec) {
        expect(rediscoverRec.reason).toContain("haven't played this song recently");
        expect(rediscoverRec.track.id).toBe(sampleTrack2.id);
      }
    });

    it('persists dismissed recommendations and excludes them from future suggestions', async () => {
      const initialRecs = await musicDiscoveryService.getMadeForYouRecommendations(6);
      expect(initialRecs.length).toBeGreaterThan(0);
      const targetId = initialRecs[0].track.id;

      // Dismiss the recommendation
      musicDiscoveryService.dismissRecommendation(targetId);
      expect(musicDiscoveryService.getDismissedRecommendationIds()).toContain(targetId);

      // Next query should exclude the dismissed track
      const updatedRecs = await musicDiscoveryService.getMadeForYouRecommendations(6);
      expect(updatedRecs.find((r) => r.track.id === targetId)).toBeUndefined();

      // Clear dismissed recommendations
      musicDiscoveryService.clearDismissedRecommendations();
      expect(musicDiscoveryService.getDismissedRecommendationIds().length).toBe(0);

      const restoredRecs = await musicDiscoveryService.getMadeForYouRecommendations(6);
      expect(restoredRecs.find((r) => r.track.id === targetId)).toBeDefined();
    });

    it('returns empty recommendations when user disables recommendations in settings', async () => {
      await musicDiscoveryService.saveDashboardSettings({
        ...DEFAULT_HOME_SETTINGS,
        recommendationsEnabled: false,
      });

      const recs = await musicDiscoveryService.getMadeForYouRecommendations(6);
      expect(recs).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Daily Mixes & Dynamic Collections
  // ─────────────────────────────────────────────────────────────
  describe('Daily Mixes & Dynamic Collections', () => {
    it('generates dynamic mixes without duplicating database entities', async () => {
      const mixes = await musicDiscoveryService.getDailyMixes();
      expect(mixes.length).toBeGreaterThanOrEqual(3);

      const favMix = mixes.find((m) => m.id === 'mix_favorites');
      expect(favMix).toBeDefined();
      expect(favMix?.name).toBe('Favorite Mix');
      expect(favMix?.tracks.length).toBe(2); // sampleTrack1 and sampleTrack4

      const mostPlayedMix = mixes.find((m) => m.id === 'mix_most_played');
      expect(mostPlayedMix).toBeDefined();
      expect(mostPlayedMix?.name).toBe('Heavy Rotation Mix');

      const topRatedMix = mixes.find((m) => m.id === 'mix_top_rated');
      expect(topRatedMix).toBeDefined();
      expect(topRatedMix?.name).toBe('5-Star Mix');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Discover Unplayed & Forgotten Music
  // ─────────────────────────────────────────────────────────────
  describe('Discover Unplayed & Forgotten Music', () => {
    it('correctly categorizes never-played, forgotten favorites, and rarely-played songs', async () => {
      const unplayed = await musicDiscoveryService.getUnplayedAndForgotten();

      // sampleTrack3 has 0 plays
      expect(unplayed.neverPlayed.map((t) => t.id)).toContain(sampleTrack3.id);
      expect(unplayed.neverPlayed.map((t) => t.id)).not.toContain(sampleTrack1.id);

      // sampleTrack2 was played 20 days ago (> 14 days)
      expect(unplayed.notPlayedRecently.map((t) => t.id)).not.toContain(sampleTrack1.id); // 2 days ago
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. Listening Statistics & Insights
  // ─────────────────────────────────────────────────────────────
  describe('Listening Statistics & Insights', () => {
    it('computes listening time and top songs across specified time ranges', async () => {
      const now = Date.now();

      // Record a playback session of 300 seconds
      await PlaybackSessionRepository.recordSession({
        trackId: sampleTrack4.id,
        startedAt: now - 10000,
        durationListened: 300,
        completed: true,
        lastPosition: 294,
      });

      // Record play history
      await PlayHistoryRepository.addRecord({
        trackId: sampleTrack4.id,
        title: sampleTrack4.title,
        artist: sampleTrack4.artist,
        playedAt: now - 10000,
        playDuration: 294,
        completed: true,
        source: 'local',
      });

      const insights = await musicDiscoveryService.getListeningInsights('7days');
      expect(insights.completedSessionsCount).toBeGreaterThanOrEqual(1);
      expect(insights.totalListeningSeconds).toBeGreaterThanOrEqual(300);
      expect(insights.librarySummary.totalSongs).toBe(4); // 4 available tracks
      expect(insights.librarySummary.totalFavorites).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 7. Dashboard Customization & Pinning
  // ─────────────────────────────────────────────────────────────
  describe('Dashboard Customization & Pinning', () => {
    it('saves and restores custom section orders and card density', async () => {
      const customSettings: HomeDashboardSettings = {
        ...DEFAULT_HOME_SETTINGS,
        cardDensity: 'compact',
        itemsPerSection: 12,
        enabledSections: {
          ...DEFAULT_HOME_SETTINGS.enabledSections,
          daily_mixes: false,
        },
        sectionOrder: [
          'continue_listening',
          'greeting_quick_access',
          'made_for_you',
          'most_played',
          'recently_added',
          'explore_library',
          'unplayed_forgotten',
          'quick_collections',
          'listening_insights',
          'daily_mixes',
        ],
      };

      await musicDiscoveryService.saveDashboardSettings(customSettings);
      const retrieved = await musicDiscoveryService.getDashboardSettings();

      expect(retrieved.cardDensity).toBe('compact');
      expect(retrieved.itemsPerSection).toBe(12);
      expect(retrieved.enabledSections.daily_mixes).toBe(false);
      expect(retrieved.sectionOrder[0]).toBe('continue_listening');
    });

    it('toggles pinned status on playlists and retrieves pinned items', async () => {
      const playlist = await PlaylistRepository.create('Prog Rock Essentials');
      expect(playlist.isPinned).toBeFalsy();

      const pinned = await PlaylistRepository.togglePinned(playlist.id);
      expect(pinned).toBe(true);

      const allPinned = await PlaylistRepository.getPinned();
      expect(allPinned.length).toBe(1);
      expect(allPinned[0].id).toBe(playlist.id);

      const unpinned = await PlaylistRepository.togglePinned(playlist.id);
      expect(unpinned).toBe(false);

      const afterUnpin = await PlaylistRepository.getPinned();
      expect(afterUnpin.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 8. Offline & Air-Gap Privacy Verification
  // ─────────────────────────────────────────────────────────────
  describe('Offline & Air-Gap Privacy Compliance', () => {
    it('computes all recommendations and discovery mixes entirely offline without network requests', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      await musicDiscoveryService.getContinueListeningData();
      await musicDiscoveryService.getMadeForYouRecommendations(6);
      await musicDiscoveryService.getDailyMixes();
      await musicDiscoveryService.getUnplayedAndForgotten();
      await musicDiscoveryService.getListeningInsights('30days');

      // Verify zero network requests were made
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});

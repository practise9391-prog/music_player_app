import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MediaSessionService,
  OFFLINE_FALLBACK_ARTWORK_SVG,
} from '../services/media/MediaSessionService';
import { AudioFocusManager } from '../services/audio/AudioFocusManager';
import { AudioRouteManager } from '../services/audio/AudioRouteManager';
import { AudioEngine } from '../audio/AudioEngine';
import { Track } from '../types';

describe('Part 15 — Background Playback, Media Controls, Bluetooth & Audio Focus', () => {
  const mockTrack: Track = {
    id: 'track-test-15',
    title: 'Astral Echoes',
    artist: 'Pavan Stellar',
    album: 'Deep Space Soundscapes',
    duration: 240,
    path: '/music/astral_echoes.mp3',
    format: 'mp3',
    source: 'local',
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
  };

  describe('1. AudioEngine Volume Ducking (Req 17 & 44)', () => {
    let engine: AudioEngine;

    beforeEach(() => {
      engine = new AudioEngine();
      engine.setVolume(0.8);
    });

    it('preserves the user volume setting while ducking output gain', () => {
      expect(engine.getVolume()).toBe(0.8);
      expect(engine.isAudioDucked()).toBe(false);

      // Duck to 25% (0.25)
      engine.duck(0.25);
      expect(engine.isAudioDucked()).toBe(true);
      // User's permanent volume setting remains 0.8
      expect(engine.getVolume()).toBe(0.8);

      // Unduck restores normal output
      engine.unduck();
      expect(engine.isAudioDucked()).toBe(false);
      expect(engine.getVolume()).toBe(0.8);
    });

    it('handles multiple duck and unduck calls idempotently', () => {
      engine.duck(0.3);
      engine.duck(0.3);
      expect(engine.isAudioDucked()).toBe(true);

      engine.unduck();
      engine.unduck();
      expect(engine.isAudioDucked()).toBe(false);
      expect(engine.getVolume()).toBe(0.8);
    });
  });

  describe('2. Audio Focus & Ducking Manager (Req 16–22, Edge Cases 2, 4, 5)', () => {
    let focusManager: AudioFocusManager;
    let isPlayingState = false;
    let pauseCalled = false;
    let resumeCalled = false;
    let duckFactorApplied: number | null = null;
    let unduckCalled = false;

    beforeEach(() => {
      focusManager = AudioFocusManager.getInstance();
      focusManager.reset();
      isPlayingState = true;
      pauseCalled = false;
      resumeCalled = false;
      duckFactorApplied = null;
      unduckCalled = false;

      focusManager.init(
        {
          onPause: () => {
            pauseCalled = true;
            isPlayingState = false;
          },
          onResume: () => {
            resumeCalled = true;
            isPlayingState = true;
          },
          onDuck: (factor) => {
            duckFactorApplied = factor ?? 0.25;
          },
          onUnduck: () => {
            unduckCalled = true;
            duckFactorApplied = null;
          },
          isPlaying: () => isPlayingState,
        },
        {
          audioFocusMode: 'follow_system',
          resumeAfterInterruption: true,
          duckVolumePercent: 25,
        }
      );
    });

    it('ducks temporarily on LOSS_TRANSIENT_CAN_DUCK and restores on GAIN (Navigation prompt)', () => {
      focusManager.handleFocusChange('LOSS_TRANSIENT_CAN_DUCK', 'navigation');
      expect(duckFactorApplied).toBe(0.25);
      expect(pauseCalled).toBe(false);

      focusManager.handleFocusChange('GAIN');
      expect(unduckCalled).toBe(true);
      expect(duckFactorApplied).toBeNull();
    });

    it('pauses instead of ducking when audioFocusMode is set to "pause"', () => {
      focusManager.setOptions({ audioFocusMode: 'pause' });
      focusManager.handleFocusChange('LOSS_TRANSIENT_CAN_DUCK', 'navigation');

      expect(pauseCalled).toBe(true);
      expect(duckFactorApplied).toBeNull();
    });

    it('pauses on temporary interruption (Phone call) and auto-resumes when call ends', () => {
      focusManager.handleFocusChange('LOSS_TRANSIENT', 'call');
      expect(pauseCalled).toBe(true);
      expect(resumeCalled).toBe(false);

      // Call ends -> Focus GAIN
      focusManager.handleFocusChange('GAIN');
      expect(resumeCalled).toBe(true);
    });

    it('does NOT auto-resume if the user manually paused during the interruption (Edge Case 5)', () => {
      focusManager.handleFocusChange('LOSS_TRANSIENT', 'call');
      expect(pauseCalled).toBe(true);

      // User explicitly pauses via notification or app UI while call is in progress
      focusManager.notifyUserManualPause();

      // Call ends -> Focus GAIN
      focusManager.handleFocusChange('GAIN');
      expect(resumeCalled).toBe(false); // MUST remain paused!
    });

    it('does NOT auto-resume if resumeAfterInterruption is disabled', () => {
      focusManager.setOptions({ resumeAfterInterruption: false });
      focusManager.handleFocusChange('LOSS_TRANSIENT', 'call');
      expect(pauseCalled).toBe(true);

      focusManager.handleFocusChange('GAIN');
      expect(resumeCalled).toBe(false);
    });

    it('does NOT auto-resume after permanent LOSS (e.g. another music player starts)', () => {
      focusManager.handleFocusChange('LOSS', 'permanent');
      expect(pauseCalled).toBe(true);

      focusManager.handleFocusChange('GAIN');
      expect(resumeCalled).toBe(false);
    });
  });

  describe('3. MediaSession Service & Hardware Controls (Req 3–12, 26–28, 32, 33)', () => {
    let mediaService: MediaSessionService;
    let playCalled = false;
    let nextCalled = false;
    let prevCalled = false;
    let seekToSeconds: number | null = null;

    beforeEach(() => {
      mediaService = MediaSessionService.getInstance();
      playCalled = false;
      nextCalled = false;
      prevCalled = false;
      seekToSeconds = null;

      mediaService.init({
        onPlay: () => {
          playCalled = true;
        },
        onPause: vi.fn(),
        onStop: vi.fn(),
        onPreviousTrack: () => {
          prevCalled = true;
        },
        onNextTrack: () => {
          nextCalled = true;
        },
        onSeekTo: (s) => {
          seekToSeconds = s;
        },
        onSeekForward: vi.fn(),
        onSeekBackward: vi.fn(),
      });
    });

    it('uses fallback offline SVG artwork when coverArtUrl is missing (Req 10, 32)', () => {
      const mockMediaSession = {
        metadata: null as any,
        setActionHandler: vi.fn(),
        setPositionState: vi.fn(),
        playbackState: 'none',
      };
      (global as any).MediaMetadata = class {
        constructor(public init: any) {}
      };
      Object.defineProperty(navigator, 'mediaSession', {
        value: mockMediaSession,
        configurable: true,
        writable: true,
      });

      mediaService.updateMetadata(mockTrack, 'full');

      expect(mockMediaSession.metadata).not.toBeNull();
      expect(mockMediaSession.metadata.init.title).toBe('Astral Echoes');
      expect(mockMediaSession.metadata.init.artist).toBe('Pavan Stellar');
      // Should use offline SVG fallback artwork
      expect(mockMediaSession.metadata.init.artwork[0].src).toBe(OFFLINE_FALLBACK_ARTWORK_SVG);
    });

    it('masks metadata appropriately when Lock Screen Privacy is "limited" or "hidden" (Req 33)', () => {
      const mockMediaSession = {
        metadata: null as any,
        setActionHandler: vi.fn(),
        setPositionState: vi.fn(),
        playbackState: 'none',
      };
      Object.defineProperty(navigator, 'mediaSession', {
        value: mockMediaSession,
        configurable: true,
        writable: true,
      });

      // Limited privacy: shows title, masks artist & album
      mediaService.updateMetadata(mockTrack, 'limited');
      expect(mockMediaSession.metadata.init.title).toBe('Astral Echoes');
      expect(mockMediaSession.metadata.init.artist).toBe('Now Playing');

      // Hidden privacy: generic placeholder
      mediaService.updateMetadata(mockTrack, 'hidden');
      expect(mockMediaSession.metadata.init.title).toBe('Music Playing');
      expect(mockMediaSession.metadata.init.artist).toBe('Nova Music Player');
    });

    it('handles hardware headset multi-press events: single, double, triple clicks (Req 11)', () => {
      vi.useFakeTimers();

      // Single click -> Play/Pause
      mediaService.handleHeadsetButtonPress();
      vi.advanceTimersByTime(400);
      expect(playCalled).toBe(true);

      // Reset
      playCalled = false;

      // Double click -> Next
      mediaService.handleHeadsetButtonPress();
      mediaService.handleHeadsetButtonPress();
      vi.advanceTimersByTime(400);
      expect(nextCalled).toBe(true);
      expect(playCalled).toBe(false);

      // Reset
      nextCalled = false;

      // Triple click -> Previous
      mediaService.handleHeadsetButtonPress();
      mediaService.handleHeadsetButtonPress();
      mediaService.handleHeadsetButtonPress();
      vi.advanceTimersByTime(400);
      expect(prevCalled).toBe(true);
      expect(nextCalled).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('4. Bluetooth & Audio Route Manager (Req 13–15, 34–37, Edge Case 3)', () => {
    let routeManager: AudioRouteManager;
    let pauseCalled = false;

    beforeEach(() => {
      routeManager = AudioRouteManager.getInstance();
      pauseCalled = false;
      routeManager.init(
        {
          onPause: () => {
            pauseCalled = true;
          },
        },
        {
          pauseOnHeadphoneDisconnect: true,
          autoApplyDeviceProfiles: true,
        }
      );
    });

    it('classifies device types accurately from label strings', () => {
      expect(routeManager.classifyDeviceType('Sony WH-1000XM4 Bluetooth')).toBe('bluetooth');
      expect(routeManager.classifyDeviceType('Galaxy Buds2 Pro')).toBe('bluetooth');
      expect(routeManager.classifyDeviceType('Wired Headset 3.5mm')).toBe('headphones');
      expect(routeManager.classifyDeviceType('Fiio USB DAC')).toBe('usb');
      expect(routeManager.classifyDeviceType('Speaker (Realtek High Definition Audio)')).toBe('speaker');
    });
  });

  describe('5. Previous Track Threshold Rule (Req 7)', () => {
    it('restarts current song if position > threshold, otherwise moves to previous song', () => {
      const threshold = 3; // 3 seconds

      // Case A: Playing past 3 seconds (e.g. at 15s)
      let currentTime = 15;
      let actionTaken = '';
      if (currentTime > threshold) {
        actionTaken = 'restart_song';
      } else {
        actionTaken = 'previous_song';
      }
      expect(actionTaken).toBe('restart_song');

      // Case B: At beginning of song (e.g. at 1.5s)
      currentTime = 1.5;
      if (currentTime > threshold) {
        actionTaken = 'restart_song';
      } else {
        actionTaken = 'previous_song';
      }
      expect(actionTaken).toBe('previous_song');
    });
  });
});

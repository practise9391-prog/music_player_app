import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../database/db';
import { sleepTimerService } from '../services/playback/SleepTimerService';
import { trackResumeService } from '../services/playback/TrackResumeService';
import { bookmarkService } from '../services/playback/BookmarkService';
import { listeningSessionService } from '../services/playback/ListeningSessionService';
import { audioEngineInstance } from '../audio/AudioEngine';

describe('Part 25 — Advanced Playback Automation, Sleep Timer & Bookmarks', () => {
  beforeEach(async () => {
    await db.bookmarks.clear();
    await db.track_resume_positions.clear();
    await db.listening_sessions.clear();
    sleepTimerService.cancel();
  });

  describe('SleepTimerService', () => {
    it('initializes and manages duration-based sleep timers', () => {
      sleepTimerService.startDurationTimer(30, 15);
      const state = sleepTimerService.getState();

      expect(state.isActive).toBe(true);
      expect(state.mode).toBe('duration');
      expect(state.durationMinutes).toBe(30);
      expect(state.fadeOutSeconds).toBe(15);
      expect(state.targetTimestamp).toBeGreaterThan(Date.now());
    });

    it('cancels active sleep timers cleanly', () => {
      sleepTimerService.startDurationTimer(45);
      expect(sleepTimerService.getState().isActive).toBe(true);

      sleepTimerService.cancel();
      expect(sleepTimerService.getState().isActive).toBe(false);
    });

    it('supports end-of-track and end-of-queue modes', () => {
      sleepTimerService.startEndOfTrackTimer();
      expect(sleepTimerService.getState().mode).toBe('end_of_track');

      sleepTimerService.startEndOfQueueTimer();
      expect(sleepTimerService.getState().mode).toBe('end_of_queue');
    });
  });

  describe('TrackResumeService', () => {
    it('saves and retrieves per-track resume positions', async () => {
      const trackId = 'podcast_ep_101';
      trackResumeService.onTrackLoaded(trackId, 3600);

      // Simulate seeking to minute 15 (900 seconds)
      vi.spyOn(audioEngineInstance, 'getPosition').mockReturnValue(900);
      vi.spyOn(audioEngineInstance, 'getDuration').mockReturnValue(3600);

      await trackResumeService.saveCurrentPosition();

      const savedPos = await trackResumeService.getResumePosition(trackId);
      expect(savedPos).toBe(900);
    });

    it('clears position when track finishes completely', async () => {
      const trackId = 'podcast_ep_102';
      await db.track_resume_positions.put({
        trackId,
        position: 1200,
        duration: 1800,
        updatedAt: Date.now(),
      });

      await trackResumeService.clearPosition(trackId);
      const pos = await trackResumeService.getResumePosition(trackId);
      expect(pos).toBeNull();
    });
  });

  describe('BookmarkService', () => {
    it('creates timestamped bookmarks for audio files and seeks accurately', async () => {
      const trackId = 'lecture_audio_1';
      const bm = await bookmarkService.addBookmark(trackId, 125.4, 'Key Definition');

      expect(bm.id).toBeDefined();
      expect(bm.trackId).toBe(trackId);
      expect(bm.position).toBe(125.4);
      expect(bm.title).toBe('Key Definition');

      const trackBookmarks = await bookmarkService.getBookmarksForTrack(trackId);
      expect(trackBookmarks.length).toBe(1);
      expect(trackBookmarks[0].title).toBe('Key Definition');

      const seekSpy = vi.spyOn(audioEngineInstance, 'seek');
      bookmarkService.seekToBookmark(bm);
      expect(seekSpy).toHaveBeenCalledWith(125.4);
    });
  });

  describe('ListeningSessionService', () => {
    it('provides built-in environment presets and applies parameters', () => {
      const presets = listeningSessionService.getBuiltinPresets();
      expect(presets.length).toBeGreaterThanOrEqual(4);

      const focusPreset = presets.find((p) => p.type === 'focus');
      expect(focusPreset).toBeDefined();

      const mockHandlers = {
        setAudioProfile: vi.fn(),
        setShuffleMode: vi.fn(),
        setRepeatMode: vi.fn(),
      };

      if (focusPreset) {
        listeningSessionService.applySession(focusPreset, mockHandlers);
        expect(mockHandlers.setAudioProfile).toHaveBeenCalledWith(focusPreset.audioProfile);
        expect(mockHandlers.setRepeatMode).toHaveBeenCalledWith(focusPreset.repeatMode);
      }
    });
  });
});


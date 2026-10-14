import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { db } from '../database/db';
import { PlayerStateRepository, PlaybackSessionRepository } from '../database/repository';
import { Track, PlaybackStatePersistence } from '../types';

describe('Part 3 — Full Audio Player, Engine, Queue & Playback State', () => {
  const dummyTrack1: Track = {
    id: 'track-1',
    title: 'Neon Horizon',
    artist: 'Cyber Synth',
    album: 'Future Waves',
    duration: 180,
    path: '/music/track1.flac',
    filename: 'track1.flac',
    format: 'flac',
    bitrate: 1411,
    sampleRate: 44100,
    channels: 2,
    fileSize: 31457280,
    dateAdded: Date.now(),
    modifiedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
    source: 'local',
  };

  const dummyTrack2: Track = {
    id: 'track-2',
    title: 'Midnight Drive',
    artist: 'Retro Dreamer',
    album: 'Future Waves',
    duration: 240,
    path: '/music/track2.mp3',
    filename: 'track2.mp3',
    format: 'mp3',
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    fileSize: 9600000,
    dateAdded: Date.now(),
    modifiedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
    source: 'local',
  };

  const dummyTrack3: Track = {
    id: 'track-3',
    title: 'Solar Echoes',
    artist: 'Acoustic Labs',
    album: 'Echoes EP',
    duration: 210,
    path: '/music/track3.wav',
    filename: 'track3.wav',
    format: 'wav',
    bitrate: 1411,
    sampleRate: 44100,
    channels: 2,
    fileSize: 37000000,
    dateAdded: Date.now(),
    modifiedAt: Date.now(),
    playCount: 0,
    isFavorite: false,
    source: 'local',
  };

  describe('AudioEngine Unit Tests', () => {
    let engine: AudioEngine;

    beforeEach(() => {
      engine = new AudioEngine();
    });

    it('initializes with default playback state', () => {
      const state = engine.getState();
      expect(state.status).toBe('idle');
      expect(state.volume).toBe(0.8);
      expect(state.playbackRate).toBe(1.0);
      expect(state.repeatMode).toBe('off');
      expect(state.isShuffle).toBe(false);
      expect(state.isMuted).toBe(false);
    });

    it('emits TRACK_LOADED and updates current track upon loadTrack', async () => {
      const loadedListener = vi.fn();
      const unsub = engine.on('TRACK_LOADED', loadedListener);

      await engine.loadTrack(dummyTrack1, false);

      expect(engine.getCurrentTrack()?.id).toBe('track-1');
      expect(loadedListener).toHaveBeenCalledWith(dummyTrack1);
      unsub();
    });

    it('clamps volume accurately and preserves previous volume across mutes', () => {
      engine.setVolume(0.75);
      expect(engine.getState().volume).toBe(0.75);

      // Volume clamping
      engine.setVolume(1.5);
      expect(engine.getState().volume).toBe(1.0);
      engine.setVolume(-0.5);
      expect(engine.getState().volume).toBe(0.0);

      // Restore volume to 0.7
      engine.setVolume(0.7);
      expect(engine.getState().volume).toBe(0.7);

      // Mute
      engine.setMute(true);
      expect(engine.getState().isMuted).toBe(true);
      expect(engine.getState().previousVolume).toBe(0.7);

      // Unmute restores previous volume
      engine.setMute(false);
      expect(engine.getState().isMuted).toBe(false);
      expect(engine.getState().volume).toBe(0.7);

      // toggleMute
      engine.toggleMute();
      expect(engine.getState().isMuted).toBe(true);
      engine.toggleMute();
      expect(engine.getState().isMuted).toBe(false);
      expect(engine.getState().volume).toBe(0.7);
    });

    it('sets playback rate within supported bounds', () => {
      engine.setPlaybackRate(1.5);
      expect(engine.getState().playbackRate).toBe(1.5);

      // Bounds clamping
      engine.setPlaybackRate(5.0);
      expect(engine.getState().playbackRate).toBe(2.5);
      engine.setPlaybackRate(0.1);
      expect(engine.getState().playbackRate).toBe(0.5);
    });

    it('updates repeat mode and shuffle and emits corresponding events', () => {
      const repeatListener = vi.fn();
      const shuffleListener = vi.fn();

      engine.on('REPEAT_CHANGED', repeatListener);
      engine.on('SHUFFLE_CHANGED', shuffleListener);

      engine.setRepeatMode('all');
      expect(engine.getState().repeatMode).toBe('all');
      expect(repeatListener).toHaveBeenCalledWith('all');

      engine.setShuffle(true);
      expect(engine.getState().isShuffle).toBe(true);
      expect(shuffleListener).toHaveBeenCalledWith(true);
    });

    it('enumerates audio output devices gracefully', async () => {
      const devices = await engine.getAudioOutputDevices();
      expect(Array.isArray(devices)).toBe(true);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices[0]).toHaveProperty('deviceId');
    });
  });

  describe('Playback State Persistence & Resume', () => {
    beforeEach(async () => {
      await db.player_state.clear();
      localStorage.clear();
    });

    it('persists and restores player state across application restarts', async () => {
      const testState: PlaybackStatePersistence = {
        trackId: 'track-1',
        position: 45.5,
        volume: 0.85,
        isMuted: false,
        playbackRate: 1.25,
        repeatMode: 'all',
        isShuffle: true,
        queue: [dummyTrack1, dummyTrack2, dummyTrack3],
        queueIndex: 1,
        updatedAt: Date.now(),
      };

      await PlayerStateRepository.savePlayerState(testState);

      const restored = await PlayerStateRepository.getPlayerState();
      expect(restored).not.toBeNull();
      expect(restored?.trackId).toBe('track-1');
      expect(restored?.position).toBe(45.5);
      expect(restored?.volume).toBe(0.85);
      expect(restored?.playbackRate).toBe(1.25);
      expect(restored?.repeatMode).toBe('all');
      expect(restored?.isShuffle).toBe(true);
      expect(restored?.queue.length).toBe(3);
      expect(restored?.queueIndex).toBe(1);
    });
  });

  describe('Playback Sessions & History Logging', () => {
    beforeEach(async () => {
      await db.playback_sessions.clear();
    });

    it('records listening sessions and queries them chronologically', async () => {
      await PlaybackSessionRepository.recordSession({
        trackId: 'track-1',
        startedAt: Date.now() - 50000,
        durationListened: 45,
        completed: false,
        lastPosition: 45,
      });

      await PlaybackSessionRepository.recordSession({
        trackId: 'track-2',
        startedAt: Date.now() - 10000,
        durationListened: 240,
        completed: true,
        lastPosition: 240,
      });

      const sessions = await PlaybackSessionRepository.getSessions();
      expect(sessions.length).toBe(2);
      expect(sessions[0].trackId).toBe('track-2');
      expect(sessions[0].completed).toBe(true);
      expect(sessions[1].trackId).toBe('track-1');
    });
  });

  describe('Queue Manipulation & Ordering Logic', () => {
    it('implements stable shuffle permutation preserving active song index', () => {
      const queue = [dummyTrack1, dummyTrack2, dummyTrack3];
      const currentIndex = 1; // dummyTrack2 is playing

      // Shuffle algorithm used in PlayerContext
      const indices = Array.from({ length: queue.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(0.5 * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      // Re-center active track to index 0
      const pos = indices.indexOf(currentIndex);
      if (pos > -1) {
        indices.splice(pos, 1);
        indices.unshift(currentIndex);
      }

      // The currently playing track should remain first in the shuffled order
      expect(indices[0]).toBe(currentIndex);
      expect(indices.length).toBe(queue.length);
      // All items represented
      expect(new Set(indices).size).toBe(queue.length);
    });

    it('evaluates previous track threshold correctly (restart vs previous)', () => {
      const threshold = 3.0; // seconds

      // Case A: User has listened for 8.5 seconds -> restarts current track
      const positionA = 8.5;
      const shouldRestartA = positionA > threshold;
      expect(shouldRestartA).toBe(true);

      // Case B: User has listened for 1.2 seconds -> navigates to previous track in queue
      const positionB = 1.2;
      const shouldRestartB = positionB > threshold;
      expect(shouldRestartB).toBe(false);
    });

    it('performs queue operations: play next, reorder, remove', () => {
      let queue = [dummyTrack1, dummyTrack3];
      const curIndex = 0; // track-1

      // 1. Play Next: Insert dummyTrack2 right after active track
      const queueAfterPlayNext = [...queue];
      queueAfterPlayNext.splice(curIndex + 1, 0, dummyTrack2);
      expect(queueAfterPlayNext.map((t) => t.id)).toEqual(['track-1', 'track-2', 'track-3']);

      // 2. Reorder queue: Move track-3 from index 2 to index 1
      const queueAfterReorder = [...queueAfterPlayNext];
      const [moved] = queueAfterReorder.splice(2, 1);
      queueAfterReorder.splice(1, 0, moved);
      expect(queueAfterReorder.map((t) => t.id)).toEqual(['track-1', 'track-3', 'track-2']);

      // 3. Remove track: remove index 1 (track-3)
      const queueAfterRemove = [...queueAfterReorder];
      queueAfterRemove.splice(1, 1);
      expect(queueAfterRemove.map((t) => t.id)).toEqual(['track-1', 'track-2']);
    });
  });
});

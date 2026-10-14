import { Track, PlaybackStatus } from '../../types';

export interface MediaSessionCallbacks {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onSeekTo: (seconds: number) => void;
  onSeekForward: (offsetSeconds: number) => void;
  onSeekBackward: (offsetSeconds: number) => void;
}

// Built-in offline SVG placeholder artwork for notifications and lock screen when track art is missing
export const OFFLINE_FALLBACK_ARTWORK_SVG =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="%230a0b10"/><circle cx="256" cy="256" r="180" fill="%23131722"/><circle cx="256" cy="256" r="60" fill="%2300e5ff"/><path d="M240 180v110a30 30 0 1 1-20-28.2V195h50v55a30 30 0 1 1-20-28.2V180h-10z" fill="%23ffffff"/></svg>';

export class MediaSessionService {
  private static instance: MediaSessionService | null = null;
  private callbacks: MediaSessionCallbacks | null = null;
  private isInitialized = false;

  // Headset hardware multi-press controller
  private headsetPressCount = 0;
  private headsetPressTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly MULTI_PRESS_THRESHOLD_MS = 350;

  // Artwork local memory cache to prevent repeated decoding
  private artworkCache: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): MediaSessionService {
    if (!this.instance) {
      this.instance = new MediaSessionService();
    }
    return this.instance;
  }

  /**
   * Initializes action handlers on navigator.mediaSession.
   */
  public init(callbacks: MediaSessionCallbacks): void {
    this.callbacks = callbacks;
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.callbacks?.onPlay();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        this.callbacks?.onPause();
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        this.callbacks?.onStop();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.callbacks?.onPreviousTrack();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.callbacks?.onNextTrack();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && details.seekTime !== null) {
          this.callbacks?.onSeekTo(details.seekTime);
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        this.callbacks?.onSeekForward(offset);
      });

      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.callbacks?.onSeekBackward(offset);
      });
    } catch (err) {
      console.warn('MediaSession action handler registration notice:', err);
    }
  }

  /**
   * Updates OS media session metadata (title, artist, album, artwork)
   * respecting lock screen privacy settings and offline caching.
   */
  public updateMetadata(
    track: Track | null,
    privacy: 'full' | 'limited' | 'hidden' = 'full'
  ): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    if (!track) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        // ignore
      }
      return;
    }

    try {
      let title = track.title || 'Unknown Title';
      let artist = track.artist || 'Unknown Artist';
      let album = track.album || 'Unknown Album';
      let artworkSrc = OFFLINE_FALLBACK_ARTWORK_SVG;

      if (privacy === 'hidden') {
        title = 'Music Playing';
        artist = 'Nova Music Player';
        album = 'Nova';
      } else if (privacy === 'limited') {
        artist = 'Now Playing';
        album = 'Nova Music Player';
      }

      if (privacy !== 'hidden' && track.coverArtUrl) {
        artworkSrc = track.coverArtUrl;
        this.artworkCache.set(track.id, artworkSrc);
      } else if (privacy !== 'hidden' && this.artworkCache.has(track.id)) {
        artworkSrc = this.artworkCache.get(track.id)!;
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: artworkSrc, sizes: '96x96', type: 'image/png' },
          { src: artworkSrc, sizes: '128x128', type: 'image/png' },
          { src: artworkSrc, sizes: '192x192', type: 'image/png' },
          { src: artworkSrc, sizes: '256x256', type: 'image/png' },
          { src: artworkSrc, sizes: '384x384', type: 'image/png' },
          { src: artworkSrc, sizes: '512x512', type: 'image/png' },
        ],
      });
    } catch (err) {
      console.warn('Failed to update MediaSession metadata:', err);
    }
  }

  /**
   * Updates playback state ('playing', 'paused', 'none')
   */
  public updatePlaybackState(status: PlaybackStatus): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      if (status === 'playing') {
        navigator.mediaSession.playbackState = 'playing';
      } else if (status === 'paused') {
        navigator.mediaSession.playbackState = 'paused';
      } else {
        navigator.mediaSession.playbackState = 'none';
      }
    } catch {
      // ignore
    }
  }

  /**
   * Updates playback position and rate for OS progress bar and seeking support.
   */
  public updatePositionState(params: {
    duration: number;
    playbackRate: number;
    position: number;
  }): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    if (!('setPositionState' in navigator.mediaSession)) return;

    const { duration, playbackRate, position } = params;
    if (
      !isFinite(duration) ||
      !isFinite(position) ||
      !isFinite(playbackRate) ||
      duration <= 0 ||
      position < 0 ||
      position > duration
    ) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(0, duration),
        playbackRate: Math.max(0.1, playbackRate),
        position: Math.max(0, Math.min(position, duration)),
      });
    } catch {
      // ignore position state unsupported
    }
  }

  /**
   * Hardware headset single / double / triple press detector.
   * Single Press -> Play/Pause
   * Double Press -> Next
   * Triple Press -> Previous
   */
  public handleHeadsetButtonPress(): void {
    this.headsetPressCount++;

    if (this.headsetPressTimer) {
      clearTimeout(this.headsetPressTimer);
    }

    this.headsetPressTimer = setTimeout(() => {
      const count = this.headsetPressCount;
      this.headsetPressCount = 0;
      this.headsetPressTimer = null;

      if (count === 1) {
        // Toggle play/pause
        this.callbacks?.onPlay();
      } else if (count === 2) {
        // Next track
        this.callbacks?.onNextTrack();
      } else if (count >= 3) {
        // Previous track
        this.callbacks?.onPreviousTrack();
      }
    }, this.MULTI_PRESS_THRESHOLD_MS);
  }

  /**
   * Releases handlers and resources.
   */
  public dispose(): void {
    if (this.headsetPressTimer) {
      clearTimeout(this.headsetPressTimer);
      this.headsetPressTimer = null;
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      } catch {
        // ignore
      }
    }
    this.callbacks = null;
    this.isInitialized = false;
  }
}

export const mediaSessionServiceInstance = MediaSessionService.getInstance();


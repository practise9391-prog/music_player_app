import { Track, PlaybackStatus } from '../../types';
import { OFFLINE_FALLBACK_ARTWORK_SVG } from '../media/MediaSessionService';

export type WidgetSize = 'small' | 'medium' | 'large';

export interface WidgetPayload {
  trackId: string | null;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  isPlaying: boolean;
  isFavorite: boolean;
  status: PlaybackStatus;
  duration: number;
  position: number;
  lastUpdated: number;
}

export class AndroidWidgetService {
  private static instance: AndroidWidgetService | null = null;
  private currentPayload: WidgetPayload = {
    trackId: null,
    title: 'No song playing',
    artist: 'Nova Music Player',
    album: '',
    artworkUrl: OFFLINE_FALLBACK_ARTWORK_SVG,
    isPlaying: false,
    isFavorite: false,
    status: 'idle',
    duration: 0,
    position: 0,
    lastUpdated: Date.now(),
  };

  private listeners: Set<(payload: WidgetPayload) => void> = new Set();

  private constructor() {}

  public static getInstance(): AndroidWidgetService {
    if (!this.instance) {
      this.instance = new AndroidWidgetService();
    }
    return this.instance;
  }

  public subscribe(listener: (payload: WidgetPayload) => void): () => void {
    this.listeners.add(listener);
    listener(this.currentPayload);
    return () => this.listeners.delete(listener);
  }

  public getPayload(): WidgetPayload {
    return { ...this.currentPayload };
  }

  /**
   * Updates widget state across all widget sizes and notifies native Android AppWidgetProvider.
   * Efficient: updates only when status or track genuinely change to avoid battery drain.
   */
  public updateWidgetState(
    track: Track | null,
    status: PlaybackStatus,
    position = 0
  ): void {
    const isPlaying = status === 'playing';
    const isSameTrack = this.currentPayload.trackId === (track?.id || null);
    const isSameStatus = this.currentPayload.status === status;

    // Skip redundant updates if nothing substantial changed
    if (isSameTrack && isSameStatus && Math.abs(this.currentPayload.position - position) < 2) {
      return;
    }

    this.currentPayload = {
      trackId: track?.id || null,
      title: track?.title || 'No song playing',
      artist: track?.artist || 'Nova Music Player',
      album: track?.album || '',
      artworkUrl: track?.coverArtUrl || OFFLINE_FALLBACK_ARTWORK_SVG,
      isPlaying,
      isFavorite: Boolean(track?.isFavorite),
      status,
      duration: track?.duration || 0,
      position,
      lastUpdated: Date.now(),
    };

    // Notify in-app subscribers
    this.listeners.forEach((fn) => {
      try {
        fn(this.currentPayload);
      } catch (err) {
        console.error('Widget listener error:', err);
      }
    });

    // Notify native Android bridge if running on device
    if (typeof window !== 'undefined') {
      const bridge = window.AndroidBridge || window.AndroidInterface;
      if (bridge?.updateHomeScreenWidget) {
        try {
          const json = JSON.stringify(this.currentPayload);
          bridge.updateHomeScreenWidget('small', json);
          bridge.updateHomeScreenWidget('medium', json);
          bridge.updateHomeScreenWidget('large', json);
        } catch {
          // ignore
        }
      }
    }
  }
}

export const androidWidgetServiceInstance = AndroidWidgetService.getInstance();


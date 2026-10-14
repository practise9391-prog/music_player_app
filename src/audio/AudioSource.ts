import { Track } from '../types';
import { ResolvedYouTubeAudio } from '../types/youtube';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

export interface AudioSourceProgress {
  bufferedPercent: number; // 0 to 100
  bufferedSeconds: number;
  duration: number;
}

export type AudioSourceProgressListener = (progress: AudioSourceProgress) => void;

/**
 * Universal AudioSource abstraction for local files and online YouTube streams.
 */
export interface AudioSource {
  readonly type: 'local' | 'online';
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly duration: number;

  getPlaybackUrl(): Promise<string>;
  getTrackMetadata(): Track;
  isSeekingSupported(): boolean;
  onProgress(listener: AudioSourceProgressListener): () => void;
  updateBuffered(bufferedSeconds: number, duration: number): void;
  dispose(): void;
}

/**
 * LocalAudioSource
 * Handles offline local filesystem files or in-memory blob URLs.
 */
export class LocalAudioSource implements AudioSource {
  public readonly type = 'local' as const;
  public readonly id: string;
  public readonly title: string;
  public readonly artist: string;
  public readonly duration: number;

  private track: Track;
  private playbackUrl: string;
  private progressListeners: Set<AudioSourceProgressListener> = new Set();

  constructor(track: Track) {
    this.track = track;
    this.id = track.id;
    this.title = track.title;
    this.artist = track.artist;
    this.duration = track.duration;
    this.playbackUrl = track.playbackUrl || track.path;
  }

  public async getPlaybackUrl(): Promise<string> {
    return this.playbackUrl;
  }

  public getTrackMetadata(): Track {
    return { ...this.track };
  }

  public isSeekingSupported(): boolean {
    return true; // Local files always support full random seek
  }

  public onProgress(listener: AudioSourceProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  public updateBuffered(bufferedSeconds: number, duration: number): void {
    const percent = duration > 0 ? Math.min(100, (bufferedSeconds / duration) * 100) : 100;
    this.progressListeners.forEach((l) => l({ bufferedPercent: percent, bufferedSeconds, duration }));
  }

  public dispose(): void {
    this.progressListeners.clear();
  }
}

/**
 * OnlineAudioSource
 * Handles on-demand YouTube audio streams with temporary media endpoints,
 * stream expiry tracking, and buffering diagnostics.
 */
export class OnlineAudioSource implements AudioSource {
  public readonly type = 'online' as const;
  public readonly id: string;
  public readonly title: string;
  public readonly artist: string;
  public readonly duration: number;

  private metadata: ResolvedYouTubeAudio['metadata'];
  private streamUrl: string;
  private canonicalUrl: string;
  private videoId: string;
  private progressListeners: Set<AudioSourceProgressListener> = new Set();
  private isDisposed = false;

  constructor(resolved: ResolvedYouTubeAudio) {
    this.metadata = resolved.metadata;
    this.id = `yt_${resolved.metadata.id}`;
    this.title = resolved.metadata.title;
    this.artist = resolved.metadata.artist;
    this.duration = resolved.metadata.duration;
    this.streamUrl = resolved.stream.streamUrl;
    this.canonicalUrl = resolved.metadata.videoUrl;
    this.videoId = resolved.metadata.id;
  }

  public async getPlaybackUrl(): Promise<string> {
    if (this.isDisposed) {
      throw new Error('OnlineAudioSource has been disposed.');
    }
    return this.streamUrl;
  }

  public getTrackMetadata(): Track {
    return {
      id: this.id,
      title: this.title,
      artist: this.artist,
      duration: this.duration,
      format: this.metadata.codec || 'opus',
      codec: this.metadata.codec,
      bitrate: this.metadata.bitrate,
      sampleRate: this.metadata.sampleRate,
      channels: 2,
      coverArtUrl: this.metadata.thumbnailUrl,
      source: 'online',
      sourceType: 'youtube',
      sourceId: this.videoId,
      sourceChannel: this.metadata.channel,
      originalUrl: this.canonicalUrl,
      playbackUrl: this.streamUrl,
      mediaEndpoint: this.streamUrl,
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      isAvailable: true,
      path: this.canonicalUrl,
    };
  }

  public isSeekingSupported(): boolean {
    return true; // Compatible media streams support standard range seeking
  }

  public onProgress(listener: AudioSourceProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  public updateBuffered(bufferedSeconds: number, duration: number): void {
    const percent = duration > 0 ? Math.min(100, Math.round((bufferedSeconds / duration) * 100)) : 0;
    this.progressListeners.forEach((l) => l({ bufferedPercent: percent, bufferedSeconds, duration }));
  }

  public dispose(): void {
    this.isDisposed = true;
    this.progressListeners.clear();
    // Revoke temporary media endpoint from NetworkAccessManager
    NetworkAccessManager.revokeMediaEndpoint();
  }
}

import { NetworkAccessManager } from '../network/NetworkAccessManager';
import { validateOnlineUrl } from '../utils/security';
import { OnlineHistoryRepository } from '../database/repository';
import { Track } from '../types';

export interface OnlineResolvedMetadata {
  url: string;
  title: string;
  artist: string;
  thumbnail?: string;
  duration: number;
  source: 'youtube' | 'direct_stream' | 'unknown';
}

export interface StreamResolutionResult {
  streamUrl: string;
  format: string;
  bitrate?: number;
}

export class OnlineStreamService {
  private currentActiveUrl: string | null = null;

  /**
   * Validates and loads an online stream URL.
   * Checks Network Air-gap state before attempting any operation.
   */
  public async loadUrl(rawUrl: string): Promise<OnlineResolvedMetadata> {
    const validation = validateOnlineUrl(rawUrl);
    if (!validation.isValid || !validation.sanitizedUrl) {
      throw new Error(validation.errorMessage || 'Invalid or insecure URL provided.');
    }

    const cleanUrl = validation.sanitizedUrl;

    // Check Network Air-gap policy
    const check = NetworkAccessManager.checkAccessAllowed('Resolve Online Media');
    if (!check.allowed) {
      throw new Error(
        check.reason || 'Network access is disabled. Please unlock network access to load online audio.'
      );
    }

    return await NetworkAccessManager.executeExplicitOperation('Resolve Metadata', async () => {
      this.currentActiveUrl = cleanUrl;
      const metadata = await this.resolveMetadata(cleanUrl);

      // Save to local online history
      await OnlineHistoryRepository.recordPlay(cleanUrl, metadata.title, metadata.artist);

      return metadata;
    });
  }

  /**
   * Resolves online metadata safely without telemetry.
   * (Part 1 prepares structure; YouTube extraction pipeline executes in Part 2).
   */
  public async resolveMetadata(url: string): Promise<OnlineResolvedMetadata> {
    const validation = validateOnlineUrl(url);

    if (validation.sourceType === 'youtube') {
      return {
        url,
        title: 'Online Stream (Pending Part 2 Resolver)',
        artist: 'Online Source',
        thumbnail: undefined,
        duration: 0,
        source: 'youtube',
      };
    }

    // Direct HTTP audio URL
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop() || 'Online Audio Stream';

    return {
      url,
      title: decodeURIComponent(filename),
      artist: 'Direct Stream',
      duration: 0,
      source: 'direct_stream',
    };
  }

  /**
   * Prepares the stream URL for playback.
   */
  public async resolveStream(url: string): Promise<StreamResolutionResult> {
    const validation = validateOnlineUrl(url);
    if (!validation.isValid) {
      throw new Error(validation.errorMessage || 'Invalid URL.');
    }

    const check = NetworkAccessManager.checkAccessAllowed('Stream Audio');
    if (!check.allowed) {
      throw new Error(check.reason || 'Network access is blocked.');
    }

    return {
      streamUrl: url,
      format: 'stream',
    };
  }

  public createTrackFromMetadata(meta: OnlineResolvedMetadata): Track {
    return {
      id: 'online_' + btoa(meta.url).substring(0, 16),
      title: meta.title,
      artist: meta.artist,
      duration: meta.duration,
      path: meta.url,
      format: 'stream',
      dateAdded: Date.now(),
      playCount: 1,
      isFavorite: false,
      source: 'online',
      originalUrl: meta.url,
      coverArtUrl: meta.thumbnail,
    };
  }

  public stopStream(): void {
    this.currentActiveUrl = null;
  }

  public getCurrentActiveUrl(): string | null {
    return this.currentActiveUrl;
  }
}

export const onlineStreamService = new OnlineStreamService();

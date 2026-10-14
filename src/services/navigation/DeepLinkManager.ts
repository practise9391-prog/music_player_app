import { TrackRepository, PlaylistRepository } from '../../database/repository';
import { YouTubeUrlValidator } from '../youtube/YouTubeUrlValidator';

export interface DeepLinkAction {
  type: 'track' | 'album' | 'artist' | 'playlist' | 'search' | 'nowplaying' | 'online' | 'route';
  id?: string;
  name?: string;
  query?: string;
  url?: string;
  route?: string;
}

export class DeepLinkManager {
  private static instance: DeepLinkManager | null = null;
  private actionHandler: ((action: DeepLinkAction) => void) | null = null;

  private constructor() {
    this.setupUrlListener();
  }

  public static getInstance(): DeepLinkManager {
    if (!this.instance) {
      this.instance = new DeepLinkManager();
    }
    return this.instance;
  }

  public setActionHandler(handler: (action: DeepLinkAction) => void): void {
    this.actionHandler = handler;
  }

  /**
   * Parses and validates a raw deep link string (e.g. novamusic://track/123 or ?action=search).
   */
  public parseDeepLink(rawUrl: string): DeepLinkAction | null {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    try {
      // 1. Check custom URI schemes: novamusic:// or nova:// or web+novamusic://
      if (
        rawUrl.startsWith('novamusic://') ||
        rawUrl.startsWith('nova://') ||
        rawUrl.startsWith('web+novamusic://')
      ) {
        const cleaned = rawUrl
          .replace('web+novamusic://', 'http://novamusic/')
          .replace('novamusic://', 'http://novamusic/')
          .replace('nova://', 'http://novamusic/');

        const parsed = new URL(cleaned);
        const host = parsed.hostname.toLowerCase();
        const pathParts = parsed.pathname.split('/').filter(Boolean);

        if (host === 'nowplaying' || pathParts[0] === 'nowplaying') {
          return { type: 'nowplaying' };
        }

        if (host === 'search' || pathParts[0] === 'search') {
          const q = parsed.searchParams.get('q') || '';
          return { type: 'search', query: q };
        }

        if (host === 'track' || pathParts[0] === 'track') {
          const trackId = pathParts[host === 'track' ? 0 : 1] || parsed.searchParams.get('id');
          if (trackId) return { type: 'track', id: decodeURIComponent(trackId) };
        }

        if (host === 'playlist' || pathParts[0] === 'playlist') {
          const playlistId = pathParts[host === 'playlist' ? 0 : 1] || parsed.searchParams.get('id');
          if (playlistId) return { type: 'playlist', id: decodeURIComponent(playlistId) };
        }

        if (host === 'album' || pathParts[0] === 'album') {
          const album = pathParts[host === 'album' ? 0 : 1] || parsed.searchParams.get('name');
          if (album) return { type: 'album', name: decodeURIComponent(album) };
        }

        if (host === 'artist' || pathParts[0] === 'artist') {
          const artist = pathParts[host === 'artist' ? 0 : 1] || parsed.searchParams.get('name');
          if (artist) return { type: 'artist', name: decodeURIComponent(artist) };
        }

        if (host === 'online' || pathParts[0] === 'online') {
          const onlineUrl = parsed.searchParams.get('url');
          if (onlineUrl && YouTubeUrlValidator.validate(onlineUrl).isValid) {
            return { type: 'online', url: onlineUrl };
          }
        }
      }

      // 2. Check HTTP/Web query parameter shortcuts (e.g. ?action=favorites or ?play=id)
      if (rawUrl.includes('?') || rawUrl.startsWith('/')) {
        const urlObj = new URL(rawUrl, 'http://localhost');
        const action = urlObj.searchParams.get('action');

        if (action === 'nowplaying') return { type: 'nowplaying' };
        if (action === 'search') {
          return { type: 'search', query: urlObj.searchParams.get('q') || '' };
        }
        if (action === 'favorites') return { type: 'route', route: 'favorites' };
        if (action === 'playlists') return { type: 'route', route: 'playlists' };
        if (action === 'history') return { type: 'route', route: 'history' };

        const playId = urlObj.searchParams.get('play') || urlObj.searchParams.get('trackId');
        if (playId) return { type: 'track', id: playId };

        const playlistId = urlObj.searchParams.get('playlistId');
        if (playlistId) return { type: 'playlist', id: playlistId };

        const onlineUrl = urlObj.searchParams.get('onlineUrl');
        if (onlineUrl && YouTubeUrlValidator.validate(onlineUrl).isValid) {
          return { type: 'online', url: onlineUrl };
        }
      }
    } catch (err) {
      console.warn('Failed to parse deep link:', err);
    }

    return null;
  }

  /**
   * Dispatches deep link action if valid.
   */
  public async handleDeepLink(rawUrl: string): Promise<boolean> {
    const action = this.parseDeepLink(rawUrl);
    if (!action) return false;

    // Validate existence where applicable
    if (action.type === 'track' && action.id) {
      const track = await TrackRepository.getById(action.id);
      if (!track) {
        console.warn(`Deep link target track ${action.id} not found in library.`);
        return false;
      }
    }

    if (action.type === 'playlist' && action.id) {
      const playlist = await PlaylistRepository.getById(action.id);
      if (!playlist) {
        console.warn(`Deep link target playlist ${action.id} not found.`);
        return false;
      }
    }

    if (this.actionHandler) {
      this.actionHandler(action);
      return true;
    }

    return false;
  }

  private setupUrlListener(): void {
    if (typeof window === 'undefined') return;

    // Check initial launch URL
    if (window.location.search || window.location.hash) {
      this.handleDeepLink(window.location.href);
    }

    window.addEventListener('popstate', () => {
      this.handleDeepLink(window.location.href);
    });
  }
}

export const deepLinkManagerInstance = DeepLinkManager.getInstance();

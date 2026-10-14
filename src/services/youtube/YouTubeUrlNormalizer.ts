import { YouTubeUrlValidator } from './YouTubeUrlValidator';

export interface NormalizedYouTubeUrl {
  isValid: boolean;
  videoId: string | null;
  canonicalUrl: string | null;
  shortUrl: string | null;
  embedUrl: string | null;
}

export class YouTubeUrlNormalizer {
  /**
   * Normalizes any valid YouTube URL format (watch, shorts, youtu.be, embed, v)
   * into a single canonical identity and canonical URL: https://www.youtube.com/watch?v={videoId}.
   * Strips tracking parameters, playlist IDs, and timestamps to ensure duplicate prevention.
   */
  public static normalize(inputUrl: string): NormalizedYouTubeUrl {
    const validation = YouTubeUrlValidator.validate(inputUrl);
    if (!validation.isValid || !validation.videoId) {
      return {
        isValid: false,
        videoId: null,
        canonicalUrl: null,
        shortUrl: null,
        embedUrl: null,
      };
    }

    const videoId = validation.videoId;
    return {
      isValid: true,
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      shortUrl: `https://youtu.be/${videoId}`,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
    };
  }

  /**
   * Fast identity getter returning the 11-char video ID or null.
   */
  public static getVideoId(url: string): string | null {
    const res = this.normalize(url);
    return res.videoId;
  }

  /**
   * Fast canonical URL getter returning https://www.youtube.com/watch?v={id} or null.
   */
  public static getCanonicalUrl(url: string): string | null {
    const res = this.normalize(url);
    return res.canonicalUrl;
  }
}

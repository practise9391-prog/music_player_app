export interface ValidationResult {
  isValid: boolean;
  videoId?: string;
  cleanUrl?: string;
  errorMessage?: string;
  isPlaylistIgnored?: boolean;
}

const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export class YouTubeUrlValidator {
  /**
   * Validates a raw user string against strict YouTube URL patterns.
   * Runs purely locally and offline with zero network requests.
   * Protects against shell injection, arbitrary remote URLs, and non-HTTP protocols.
   */
  public static validate(rawInput: string): ValidationResult {
    if (!rawInput || typeof rawInput !== 'string') {
      return {
        isValid: false,
        errorMessage: 'Please enter a valid YouTube URL.',
      };
    }

    const trimmed = rawInput.trim();

    // Reject dangerous protocol prefixes immediately
    const lower = trimmed.toLowerCase();
    if (
      lower.startsWith('javascript:') ||
      lower.startsWith('data:') ||
      lower.startsWith('file:') ||
      lower.startsWith('ftp:') ||
      lower.startsWith('blob:') ||
      lower.startsWith('vbscript:')
    ) {
      return {
        isValid: false,
        errorMessage: 'Unsupported protocol. Only valid YouTube HTTPS/HTTP URLs are allowed.',
      };
    }

    let parsed: URL;
    try {
      // If user typed 'youtube.com/watch?v=...', prepend https://
      const toParse = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      parsed = new URL(toParse);
    } catch {
      return {
        isValid: false,
        errorMessage: 'Malformed URL. Please check the URL and try again.',
      };
    }

    // Protocol check
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return {
        isValid: false,
        errorMessage: 'Invalid protocol. Only HTTPS and HTTP are supported.',
      };
    }

    // Hostname check
    const hostname = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(hostname)) {
      return {
        isValid: false,
        errorMessage: `Unsupported domain "${hostname}". Only official YouTube domains are accepted.`,
      };
    }

    let videoId: string | null = null;
    let isPlaylistIgnored = false;

    // Check for playlist parameter to ensure single-video behavior
    if (parsed.searchParams.has('list')) {
      isPlaylistIgnored = true;
    }

    // Case 1: youtu.be shortlinks: https://youtu.be/<ID>
    if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
      const pathname = parsed.pathname.replace(/^\/+/, '');
      const segments = pathname.split('/');
      const potentialId = segments[0];

      if (potentialId && VIDEO_ID_REGEX.test(potentialId)) {
        videoId = potentialId;
      }
    }
    // Case 2: youtube.com / music.youtube.com / m.youtube.com
    else {
      const pathname = parsed.pathname;

      // /watch?v=<ID>
      if (pathname === '/watch' || pathname === '/watch/') {
        const v = parsed.searchParams.get('v');
        if (v && VIDEO_ID_REGEX.test(v)) {
          videoId = v;
        }
      }
      // /shorts/<ID>
      else if (pathname.startsWith('/shorts/')) {
        const potentialId = pathname.replace(/^\/shorts\//, '').split('/')[0];
        if (potentialId && VIDEO_ID_REGEX.test(potentialId)) {
          videoId = potentialId;
        }
      }
      // /embed/<ID>
      else if (pathname.startsWith('/embed/')) {
        const potentialId = pathname.replace(/^\/embed\//, '').split('/')[0];
        if (potentialId && VIDEO_ID_REGEX.test(potentialId)) {
          videoId = potentialId;
        }
      }
      // /v/<ID>
      else if (pathname.startsWith('/v/')) {
        const potentialId = pathname.replace(/^\/v\//, '').split('/')[0];
        if (potentialId && VIDEO_ID_REGEX.test(potentialId)) {
          videoId = potentialId;
        }
      }
    }

    if (!videoId) {
      // Informative errors for common non-video pages
      if (parsed.pathname.startsWith('/channel/') || parsed.pathname.startsWith('/c/')) {
        return {
          isValid: false,
          errorMessage: 'Channel URLs are not supported. Please paste a specific YouTube video URL.',
        };
      }
      if (parsed.pathname === '/playlist' && !parsed.searchParams.get('v')) {
        return {
          isValid: false,
          errorMessage: 'Playlist URLs without a specific video are not supported. Single videos only.',
        };
      }
      if (parsed.pathname === '/results') {
        return {
          isValid: false,
          errorMessage: 'YouTube search URLs are not supported. Please paste a direct video URL.',
        };
      }

      return {
        isValid: false,
        errorMessage: 'Could not detect a valid 11-character YouTube video ID in the URL.',
      };
    }

    // Canonical, stripped single-video URL without playlist params
    const cleanUrl = `https://www.youtube.com/watch?v=${videoId}`;

    return {
      isValid: true,
      videoId,
      cleanUrl,
      isPlaylistIgnored,
    };
  }
}

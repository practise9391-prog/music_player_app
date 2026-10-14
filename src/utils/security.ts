/**
 * Security validation and sanitization for user inputs, URLs, and file paths.
 */

export interface UrlValidationResult {
  isValid: boolean;
  sanitizedUrl?: string;
  sourceType: 'youtube' | 'direct_stream' | 'unknown';
  errorMessage?: string;
}

const YOUTUBE_REGEX =
  /^(https:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})([&?].*)?$/;

const SAFE_AUDIO_STREAM_REGEX =
  /^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+(\.(mp3|m4a|aac|ogg|opus|wav|flac|webm)|audio|stream)(\?.*)?$/i;

export function validateOnlineUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      sourceType: 'unknown',
      errorMessage: 'Please enter a valid URL.',
    };
  }

  const trimmed = rawUrl.trim();

  // Enforce HTTPS only (never plaintext HTTP or javascript: or data:)
  if (!trimmed.startsWith('https://')) {
    return {
      isValid: false,
      sourceType: 'unknown',
      errorMessage: 'Security restriction: Only secure "https://" URLs are allowed.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      sourceType: 'unknown',
      errorMessage: 'Malformed URL syntax.',
    };
  }

  if (parsed.protocol !== 'https:') {
    return {
      isValid: false,
      sourceType: 'unknown',
      errorMessage: 'Only HTTPS protocol is permitted.',
    };
  }

  // Check if it matches YouTube format
  if (YOUTUBE_REGEX.test(trimmed)) {
    return {
      isValid: true,
      sanitizedUrl: parsed.toString(),
      sourceType: 'youtube',
    };
  }

  // Or general direct audio stream
  if (SAFE_AUDIO_STREAM_REGEX.test(trimmed) || parsed.pathname.match(/\.(mp3|wav|ogg|m4a|aac|opus|webm)$/i)) {
    return {
      isValid: true,
      sanitizedUrl: parsed.toString(),
      sourceType: 'direct_stream',
    };
  }

  // Other HTTPS URLs are accepted with caution as direct streams
  return {
    isValid: true,
    sanitizedUrl: parsed.toString(),
    sourceType: 'direct_stream',
  };
}

/**
 * Sanitizes strings for display to prevent XSS injection.
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

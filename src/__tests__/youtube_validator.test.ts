import { describe, it, expect } from 'vitest';
import { YouTubeUrlValidator } from '../services/youtube/YouTubeUrlValidator';

describe('Part 6 — YouTube URL Security Validator', () => {
  describe('Valid YouTube Video URLs', () => {
    it('validates standard watch URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ', () => {
      const res = YouTubeUrlValidator.validate('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
      expect(res.cleanUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('validates shortlink URL: https://youtu.be/dQw4w9WgXcQ', () => {
      const res = YouTubeUrlValidator.validate('https://youtu.be/dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
      expect(res.cleanUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('validates YouTube Shorts URL: https://www.youtube.com/shorts/dQw4w9WgXcQ', () => {
      const res = YouTubeUrlValidator.validate('https://www.youtube.com/shorts/dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
      expect(res.cleanUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });

    it('validates YouTube embed URL: https://www.youtube.com/embed/dQw4w9WgXcQ', () => {
      const res = YouTubeUrlValidator.validate('https://www.youtube.com/embed/dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
    });

    it('validates YouTube Music URL: https://music.youtube.com/watch?v=dQw4w9WgXcQ', () => {
      const res = YouTubeUrlValidator.validate('https://music.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
    });

    it('validates mobile URL: https://m.youtube.com/watch?v=dQw4w9WgXcQ', () => {
      const res = YouTubeUrlValidator.validate('https://m.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
    });

    it('handles URLs without protocol scheme by auto-prepending https', () => {
      const res = YouTubeUrlValidator.validate('youtu.be/dQw4w9WgXcQ');
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
    });
  });

  describe('Playlist Protection (Single-Video Enforcement)', () => {
    it('strips playlist query parameters and extracts only the single video ID', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890&index=3';
      const res = YouTubeUrlValidator.validate(url);
      expect(res.isValid).toBe(true);
      expect(res.videoId).toBe('dQw4w9WgXcQ');
      expect(res.cleanUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.isPlaylistIgnored).toBe(true);
    });
  });

  describe('Security Rejections and Malformed Inputs', () => {
    it('rejects dangerous javascript: pseudo-protocol', () => {
      const res = YouTubeUrlValidator.validate('javascript:alert(1)');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('Unsupported protocol');
    });

    it('rejects local file: protocol', () => {
      const res = YouTubeUrlValidator.validate('file:///etc/passwd');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('Unsupported protocol');
    });

    it('rejects data: protocol', () => {
      const res = YouTubeUrlValidator.validate('data:text/html,<script>alert(1)</script>');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('Unsupported protocol');
    });

    it('rejects ftp: protocol', () => {
      const res = YouTubeUrlValidator.validate('ftp://youtube.com/watch?v=dQw4w9WgXcQ');
      expect(res.isValid).toBe(false);
      expect(res.errorMessage).toContain('Unsupported protocol');
    });

    it('rejects unauthorized external domains (e.g. vimeo, soundcloud, arbitrary hosts)', () => {
      const res1 = YouTubeUrlValidator.validate('https://vimeo.com/12345678');
      expect(res1.isValid).toBe(false);
      expect(res1.errorMessage).toContain('Unsupported domain');

      const res2 = YouTubeUrlValidator.validate('https://example.com/audio.mp3');
      expect(res2.isValid).toBe(false);
      expect(res2.errorMessage).toContain('Unsupported domain');
    });

    it('rejects non-video channel and playlist URLs', () => {
      const channelRes = YouTubeUrlValidator.validate('https://www.youtube.com/channel/UC123456');
      expect(channelRes.isValid).toBe(false);
      expect(channelRes.errorMessage).toContain('Channel URLs are not supported');

      const playlistRes = YouTubeUrlValidator.validate('https://www.youtube.com/playlist?list=PL12345');
      expect(playlistRes.isValid).toBe(false);
      expect(playlistRes.errorMessage).toContain('Playlist URLs without a specific video are not supported');
    });

    it('rejects empty, null, or garbage strings', () => {
      expect(YouTubeUrlValidator.validate('').isValid).toBe(false);
      expect(YouTubeUrlValidator.validate('   ').isValid).toBe(false);
      expect(YouTubeUrlValidator.validate('not a url at all').isValid).toBe(false);
    });
  });
});

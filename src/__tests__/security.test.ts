import { describe, it, expect } from 'vitest';
import { validateOnlineUrl, sanitizeString } from '../utils/security';

describe('Security Validation & Sanitization', () => {
  it('rejects unencrypted HTTP URLs', () => {
    const res = validateOnlineUrl('http://example.com/audio.mp3');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('https://');
  });

  it('rejects malformed URLs and javascript: scheme attempts', () => {
    const res1 = validateOnlineUrl('javascript:alert(1)');
    expect(res1.isValid).toBe(false);

    const res2 = validateOnlineUrl('not-a-url');
    expect(res2.isValid).toBe(false);
  });

  it('accepts valid YouTube URLs', () => {
    const res = validateOnlineUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.sourceType).toBe('youtube');
  });

  it('accepts valid HTTPS audio stream URLs', () => {
    const res = validateOnlineUrl('https://cdn.example.com/audio/track.flac');
    expect(res.isValid).toBe(true);
    expect(res.sourceType).toBe('direct_stream');
  });

  it('sanitizes strings against XSS injection', () => {
    const raw = '<script>alert("hacked")</script>';
    const safe = sanitizeString(raw);
    expect(safe).not.toContain('<script>');
    expect(safe).toContain('&lt;script&gt;');
  });
});

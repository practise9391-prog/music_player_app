import { describe, it, expect, beforeEach } from 'vitest';
import { YouTubeResolver } from '../services/youtube/YouTubeResolver';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Part 6 — YouTube Resolver & Audio-Only Extraction', () => {
  let resolver: YouTubeResolver;

  beforeEach(() => {
    resolver = new YouTubeResolver();
    NetworkAccessManager.endOnlineSession();
  });

  it('checks resolver availability locally without network access', async () => {
    const avail = await resolver.checkAvailability();
    expect(avail.available).toBe(true);
    expect(avail.version).toBeDefined();
  });

  it('rejects resolution if network gateway is locked', async () => {
    await expect(
      resolver.resolve('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).rejects.toThrow(/Network access is locked/);
  });

  it('resolves valid video into metadata and audio-only stream when session is active', async () => {
    NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    );

    const result = await resolver.resolve('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toBeDefined();
    expect(result.metadata.id).toBe('dQw4w9WgXcQ');
    expect(result.metadata.title).toBeDefined();
    expect(result.stream.streamUrl).toContain('googlevideo.com');
    expect(result.stream.codec.toLowerCase()).toContain('opus');
    expect(result.stream.bitrate).toBeGreaterThan(0);
    expect(result.stream.sampleRate).toBeGreaterThan(0);

    // Verify media endpoint was authorized with NetworkAccessManager
    expect(NetworkAccessManager.isHostAllowed(result.stream.streamUrl)).toBe(true);
  });

  it('rejects unvalidated arbitrary URLs before executing resolver', async () => {
    NetworkAccessManager.startOnlineSession('https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ');

    await expect(
      resolver.resolve('https://attacker.site/malicious.mp3')
    ).rejects.toThrow(/Unsupported domain/);
  });
});

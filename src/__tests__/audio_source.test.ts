import { describe, it, expect } from 'vitest';
import { LocalAudioSource, OnlineAudioSource } from '../audio/AudioSource';
import { Track } from '../types';
import { ResolvedYouTubeAudio } from '../types/youtube';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Part 6 — AudioSource Abstraction', () => {
  it('creates LocalAudioSource for local file', async () => {
    const mockTrack: Track = {
      id: 'local_1',
      title: 'Local Symphony',
      artist: 'Local Artist',
      duration: 180,
      format: 'flac',
      source: 'local',
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      path: '/music/symphony.flac',
    };

    const source = new LocalAudioSource(mockTrack);
    expect(source.type).toBe('local');
    expect(await source.getPlaybackUrl()).toBe('/music/symphony.flac');
    expect(source.isSeekingSupported()).toBe(true);

    const meta = source.getTrackMetadata();
    expect(meta.id).toBe('local_1');
    expect(meta.source).toBe('local');
  });

  it('creates OnlineAudioSource for resolved YouTube audio', async () => {
    NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    );
    const mockResolved: ResolvedYouTubeAudio = {
      metadata: {
        id: 'dQw4w9WgXcQ',
        title: 'Never Gonna Give You Up',
        artist: 'Rick Astley',
        channel: 'RickAstleyVEVO',
        duration: 213,
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        codec: 'opus',
        bitrate: 160,
        sampleRate: 48000,
        container: 'webm',
        isAvailable: true,
      },
      stream: {
        streamUrl: 'https://rr1.googlevideo.com/videoplayback?id=rick',
        formatId: '251',
        codec: 'opus',
        container: 'webm',
        bitrate: 160,
        sampleRate: 48000,
      },
    };

    NetworkAccessManager.allowMediaEndpoint(mockResolved.stream.streamUrl);

    const source = new OnlineAudioSource(mockResolved);
    expect(source.type).toBe('online');
    expect(source.id).toBe('yt_dQw4w9WgXcQ');
    expect(await source.getPlaybackUrl()).toBe('https://rr1.googlevideo.com/videoplayback?id=rick');

    const meta = source.getTrackMetadata();
    expect(meta.source).toBe('online');
    expect(meta.sourceType).toBe('youtube');
    expect(meta.sourceId).toBe('dQw4w9WgXcQ');
    expect(meta.originalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Test buffering calculation
    let progressCaptured = 0;
    source.onProgress((p) => {
      progressCaptured = p.bufferedPercent;
    });
    source.updateBuffered(106.5, 213);
    expect(progressCaptured).toBe(50);

    // Disposing revokes endpoint
    source.dispose();
    expect(NetworkAccessManager.isHostAllowed('https://rr1.googlevideo.com')).toBe(false);
  });
});

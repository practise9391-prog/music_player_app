import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database/db';
import { YouTubeHistoryRepository } from '../database/repository';
import { YouTubeUrlNormalizer } from '../services/youtube/YouTubeUrlNormalizer';

describe('Part 7 — YouTube History & URL Normalization', () => {
  beforeEach(async () => {
    await YouTubeHistoryRepository.clear();
  });

  it('normalizes different YouTube URL formats into one canonical video ID and URL', () => {
    const watchUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RD12345&t=42';
    const shortUrl = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef';
    const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    const shortsUrl = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';

    const normWatch = YouTubeUrlNormalizer.normalize(watchUrl);
    const normShort = YouTubeUrlNormalizer.normalize(shortUrl);
    const normEmbed = YouTubeUrlNormalizer.normalize(embedUrl);
    const normShorts = YouTubeUrlNormalizer.normalize(shortsUrl);

    expect(normWatch.videoId).toBe('dQw4w9WgXcQ');
    expect(normShort.videoId).toBe('dQw4w9WgXcQ');
    expect(normEmbed.videoId).toBe('dQw4w9WgXcQ');
    expect(normShorts.videoId).toBe('dQw4w9WgXcQ');

    expect(normWatch.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(normShort.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('prevents duplicate history entries for the same video ID and increments play count', async () => {
    const vId = 'dQw4w9WgXcQ';
    const url1 = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const url2 = 'https://youtu.be/dQw4w9WgXcQ';

    // First playback
    await YouTubeHistoryRepository.recordPlay({
      videoId: vId,
      canonicalUrl: url1,
      title: 'Never Gonna Give You Up',
      artist: 'Rick Astley',
      duration: 212,
    });

    let records = await YouTubeHistoryRepository.getAll();
    expect(records.length).toBe(1);
    expect(records[0].play_count).toBe(1);
    expect(records[0].youtube_video_id).toBe(vId);

    // Second playback from different URL format
    await YouTubeHistoryRepository.recordPlay({
      videoId: vId,
      canonicalUrl: url2,
      title: 'Never Gonna Give You Up (Official)',
      artist: 'Rick Astley',
      duration: 212,
    });

    records = await YouTubeHistoryRepository.getAll();
    expect(records.length).toBe(1); // Merged into 1 record
    expect(records[0].play_count).toBe(2);
    expect(records[0].title).toBe('Never Gonna Give You Up (Official)');
  });

  it('searches history records offline by title, artist, or video ID', async () => {
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'video_abc_1',
      canonicalUrl: 'https://www.youtube.com/watch?v=video_abc_1',
      title: 'Lofi Study Chill Beats',
      artist: 'Lofi Girl',
      duration: 300,
    });

    await YouTubeHistoryRepository.recordPlay({
      videoId: 'video_xyz_2',
      canonicalUrl: 'https://www.youtube.com/watch?v=video_xyz_2',
      title: 'Classical Piano Sonata',
      artist: 'Chopin',
      duration: 400,
    });

    const search1 = await YouTubeHistoryRepository.search('lofi');
    expect(search1.length).toBe(1);
    expect(search1[0].artist).toBe('Lofi Girl');

    const search2 = await YouTubeHistoryRepository.search('video_xyz_2');
    expect(search2.length).toBe(1);
    expect(search2[0].title).toBe('Classical Piano Sonata');

    const searchNone = await YouTubeHistoryRepository.search('nonexistent');
    expect(searchNone.length).toBe(0);
  });

  it('manages favorite toggle locally without internet', async () => {
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'fav_video_1',
      canonicalUrl: 'https://www.youtube.com/watch?v=fav_video_1',
      title: 'Favorite Track',
      duration: 180,
    });

    let isFav = await YouTubeHistoryRepository.toggleFavorite('fav_video_1');
    expect(isFav).toBe(true);

    let rec = await YouTubeHistoryRepository.getByVideoId('fav_video_1');
    expect(rec?.is_favorite).toBe(true);

    isFav = await YouTubeHistoryRepository.toggleFavorite('fav_video_1');
    expect(isFav).toBe(false);
  });
});

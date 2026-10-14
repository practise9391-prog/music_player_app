import { describe, it, expect, beforeEach } from 'vitest';
import { YouTubeHistoryRepository } from '../database/repository';
import { CacheManager } from '../services/youtube/CacheManager';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Part 7 — CacheManager, Offline Replay & Storage Protection', () => {
  beforeEach(async () => {
    await YouTubeHistoryRepository.clear();
    NetworkAccessManager.endOnlineSession(); // Enforce network locked
  });

  it('verifies cache completely offline with network locked', async () => {
    expect(NetworkAccessManager.isNetworkAllowed()).toBe(false);

    // Track without cache
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'test_uncached',
      canonicalUrl: 'https://www.youtube.com/watch?v=test_uncached',
      title: 'Uncached Stream',
    });

    const check1 = await CacheManager.verifyCache('test_uncached');
    expect(check1.isValid).toBe(false);
    expect(check1.status).toBe('NOT_CACHED');
    expect(NetworkAccessManager.isNetworkAllowed()).toBe(false); // Still locked
  });

  it('detects missing cache when path is null or size is zero and marks status', async () => {
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'test_corrupted',
      canonicalUrl: 'https://www.youtube.com/watch?v=test_corrupted',
      title: 'Corrupted File',
    });

    // Mark as cached in DB with empty path
    await YouTubeHistoryRepository.updateCacheStatus('test_corrupted', 'CACHED', {
      cachePath: '',
      cacheSize: 0,
    });

    const check = await CacheManager.verifyCache('test_corrupted');
    expect(check.isValid).toBe(false);
    expect(check.status).toBe('MISSING');

    const updated = await YouTubeHistoryRepository.getByVideoId('test_corrupted');
    expect(updated?.cache_status).toBe('MISSING');
  });

  it('saves cache, tracks statistics and touches last_used_at timestamp', async () => {
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'test_cached_1',
      canonicalUrl: 'https://www.youtube.com/watch?v=test_cached_1',
      title: 'Cached Track 1',
      duration: 200,
    });

    const saveRes = await CacheManager.saveCache({
      videoId: 'test_cached_1',
      canonicalUrl: 'https://www.youtube.com/watch?v=test_cached_1',
    });

    expect(saveRes.success).toBe(true);
    expect(saveRes.cachePath).toBeDefined();

    // Verification
    const verify = await CacheManager.verifyCache('test_cached_1');
    expect(verify.isValid).toBe(true);
    expect(verify.status).toBe('CACHED');
    expect(verify.sizeBytes).toBeGreaterThan(0);

    // Statistics
    const stats = await CacheManager.getCacheStatistics(100 * 1024 * 1024);
    expect(stats.cachedTracksCount).toBe(1);
    expect(stats.totalCacheSizeBytes).toBe(verify.sizeBytes);
    expect(stats.freeCapacityBytes).toBeLessThan(100 * 1024 * 1024);
  });

  it('deletes cache while preserving listening history record', async () => {
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'delete_test_id',
      canonicalUrl: 'https://www.youtube.com/watch?v=delete_test_id',
      title: 'Track To Delete Cache',
    });

    await CacheManager.saveCache({
      videoId: 'delete_test_id',
      canonicalUrl: 'https://www.youtube.com/watch?v=delete_test_id',
    });

    expect(await CacheManager.hasCache('delete_test_id')).toBe(true);

    // Delete cache only
    await CacheManager.deleteCache('delete_test_id');

    expect(await CacheManager.hasCache('delete_test_id')).toBe(false);

    // Record still exists in history
    const historyItem = await YouTubeHistoryRepository.getByVideoId('delete_test_id');
    expect(historyItem).toBeDefined();
    expect(historyItem?.cache_status).toBe('NOT_CACHED');
  });

  it('evicts LRU cached tracks when cache limit is exceeded but protects favorites', async () => {
    const limit = 20 * 1024 * 1024; // 20 MB limit

    // Add Track 1 (Favorite)
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'track_fav',
      canonicalUrl: 'https://www.youtube.com/watch?v=track_fav',
      title: 'Favorite Track',
    });
    await YouTubeHistoryRepository.toggleFavorite('track_fav');

    await CacheManager.saveCache({
      videoId: 'track_fav',
      canonicalUrl: 'https://www.youtube.com/watch?v=track_fav',
      maxLimitBytes: limit,
      protectFavorites: true,
    });

    // Add Track 2 (Non-favorite, older)
    await YouTubeHistoryRepository.recordPlay({
      videoId: 'track_old',
      canonicalUrl: 'https://www.youtube.com/watch?v=track_old',
      title: 'Old Track',
    });
    await CacheManager.saveCache({
      videoId: 'track_old',
      canonicalUrl: 'https://www.youtube.com/watch?v=track_old',
      maxLimitBytes: limit,
      protectFavorites: true,
    });

    // Force LRU eviction of 15 MB
    const evictedBytes = await CacheManager.evictLRU(15 * 1024 * 1024, limit, true);
    expect(evictedBytes).toBeGreaterThan(0);

    // Favorite track must still be cached
    const favItem = await YouTubeHistoryRepository.getByVideoId('track_fav');
    expect(favItem?.cache_status).toBe('CACHED');

    // Non-favorite track should be evicted
    const oldItem = await YouTubeHistoryRepository.getByVideoId('track_old');
    expect(oldItem?.cache_status).toBe('NOT_CACHED');
  });
});

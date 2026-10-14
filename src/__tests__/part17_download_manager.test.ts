import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../database/db';
import { DownloadRepository, TrackRepository } from '../database/repository';
import { DownloadRecord, DownloadPriority } from '../types/download';
import { downloadStorageService } from '../services/download/DownloadStorageService';
import { downloadQueueService } from '../services/download/DownloadQueueService';
import { downloadProviderRegistry } from '../services/download/providers/DownloadProviderRegistry';
import { DirectHttpDownloadProvider } from '../services/download/providers/DirectHttpDownloadProvider';
import { CreativeCommonsArchiveProvider } from '../services/download/providers/CreativeCommonsArchiveProvider';
import { StreamingFallbackProvider } from '../services/download/providers/StreamingFallbackProvider';

describe('Part 17 — Download Manager & Offline Music Management', () => {
  beforeEach(async () => {
    (globalThis as any).window = globalThis;
    if (!(globalThis as any).dispatchEvent) {
      (globalThis as any).dispatchEvent = vi.fn();
    }
    if (!(globalThis as any).CustomEvent) {
      (globalThis as any).CustomEvent = class MockCustomEvent {
        constructor(public type: string, public detail?: any) {}
      };
    }
    if (!(globalThis as any).URL.createObjectURL) {
      (globalThis as any).URL.createObjectURL = (blob: any) => 'blob:mock-download-url';
    }
    if (!(globalThis as any).URL.revokeObjectURL) {
      (globalThis as any).URL.revokeObjectURL = vi.fn();
    }

    await db.downloads.clear();
    await db.tracks.clear();
    downloadStorageService.clearAllBlobData();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Download Providers & Registry
  // ─────────────────────────────────────────────────────────────
  describe('Download Provider Architecture & Registry', () => {
    it('resolves direct audio URLs to DirectHttpDownloadProvider', async () => {
      const provider = await downloadProviderRegistry.getProviderForUrl('https://example.com/audio/song.mp3');
      expect(provider).toBeInstanceOf(DirectHttpDownloadProvider);
      expect(provider?.capabilities.supportsDirectDownload).toBe(true);
      expect(provider?.capabilities.supportsResumption).toBe(true);
    });

    it('resolves open-access repository URLs to CreativeCommonsArchiveProvider', async () => {
      const provider = await downloadProviderRegistry.getProviderForUrl('https://archive.org/details/test-symp-open-access');
      expect(provider).toBeInstanceOf(CreativeCommonsArchiveProvider);
      expect(provider?.capabilities.requiresAuthorization).toBe(false);
    });

    it('resolves commercial streaming platforms to StreamingFallbackProvider', async () => {
      const ytProvider = await downloadProviderRegistry.getProviderForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(ytProvider).toBeInstanceOf(StreamingFallbackProvider);
      expect(ytProvider?.capabilities.supportsDirectDownload).toBe(false);

      const spotifyProvider = await downloadProviderRegistry.getProviderForUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
      expect(spotifyProvider).toBeInstanceOf(StreamingFallbackProvider);
      expect(spotifyProvider?.capabilities.supportsDirectDownload).toBe(false);
    });

    it('StreamingFallbackProvider yields compliance error on direct download attempts', async () => {
      const provider = new StreamingFallbackProvider();
      const mockRecord: DownloadRecord = {
        id: 'mock-dl-1',
        source_id: 'https://www.youtube.com/watch?v=123',
        source_type: 'direct_url',
        source_reference: 'Streaming Fallback',
        display_title: 'Mock Video',
        artist: 'Artist',
        album: 'Album',
        destination_uri: '/Music/Downloads/Mock.mp3',
        status: 'queued',
        downloaded_bytes: 0,
        expected_bytes: 0,
        priority: 'normal',
        created_at: Date.now(),
        retry_count: 0,
        is_resumable: false,
      };

      await expect(
        provider.startDownload(mockRecord, () => {}, new AbortController().signal)
      ).rejects.toThrow(/unauthorized under provider terms/i);
    });

    it('StreamingFallbackProvider returns valid metadata explaining terms of service', async () => {
      const provider = new StreamingFallbackProvider();
      const info = await provider.getDownloadInfo('https://www.youtube.com/watch?v=test1234');
      expect(info.isAuthorized).toBe(false);
      expect(info.authorizationReason).toMatch(/Terms of Service/i);
      expect(info.expectedBytes).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Storage Service: Sanitization, Naming & File Integrity
  // ─────────────────────────────────────────────────────────────
  describe('DownloadStorageService: Filename Safety & File Validation', () => {
    it('sanitizes illegal path and file characters safely', () => {
      const dirty = 'My/Song: Title* with? "illegal" <chars> | and \x00 null';
      const clean = downloadStorageService.sanitizeFilename(dirty);
      expect(clean).not.toMatch(/[\\/:*?"<>|\x00-\x1F]/);
      expect(clean).toBe('My_Song_ Title_ with_ _illegal_ _chars_ _ and _ null');
    });

    it('generates target filename according to duplicate policies', () => {
      const existing = ['Queen - Bohemian Rhapsody.mp3', 'Queen - Bohemian Rhapsody (1).mp3'];

      // Rename policy adds sequential number
      const renamed = downloadStorageService.generateTargetFilename(
        'Queen',
        'Bohemian Rhapsody',
        'mp3',
        'rename',
        existing
      );
      expect(renamed).toBe('Queen - Bohemian Rhapsody (2).mp3');

      // Overwrite policy returns identical target
      const overwritten = downloadStorageService.generateTargetFilename(
        'Queen',
        'Bohemian Rhapsody',
        'mp3',
        'overwrite',
        existing
      );
      expect(overwritten).toBe('Queen - Bohemian Rhapsody.mp3');

      // Unique file returns clean base name
      const fresh = downloadStorageService.generateTargetFilename(
        'Queen',
        'Radio Ga Ga',
        'mp3',
        'rename',
        existing
      );
      expect(fresh).toBe('Queen - Radio Ga Ga.mp3');
    });

    it('validates file integrity: detects MP3 magic bytes', async () => {
      // ID3 header magic bytes: 0x49, 0x44, 0x33
      const id3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const blob = new Blob([id3Header, new Uint8Array(200)], { type: 'audio/mpeg' });

      const result = await downloadStorageService.validateAudioFile(blob, 'mp3');
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('mp3');
    });

    it('validates file integrity: detects FLAC magic bytes', async () => {
      // 'fLaC' = 0x66, 0x4C, 0x61, 0x43
      const flacHeader = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00, 0x00, 0x00, 0x22]);
      const blob = new Blob([flacHeader, new Uint8Array(300)], { type: 'audio/flac' });

      const result = await downloadStorageService.validateAudioFile(blob, 'flac');
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('flac');
    });

    it('validates file integrity: detects Ogg magic bytes', async () => {
      // 'OggS' = 0x4F, 0x67, 0x67, 0x53
      const oggHeader = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]);
      const blob = new Blob([oggHeader, new Uint8Array(250)], { type: 'audio/ogg' });

      const result = await downloadStorageService.validateAudioFile(blob, 'ogg');
      expect(result.isValid).toBe(true);
      expect(result.detectedFormat).toBe('ogg');
    });

    it('rejects HTML error pages spoofing audio streams', async () => {
      const htmlText = '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body>Error</body></html>';
      const blob = new Blob([htmlText], { type: 'text/html' });

      const result = await downloadStorageService.validateAudioFile(blob, 'mp3');
      expect(result.isValid).toBe(false);
      expect(result.detectedFormat).toBe('html');
      expect(result.error).toMatch(/HTML\/JSON error webpage/i);
    });

    it('rejects 0-byte completely empty files', async () => {
      const emptyBlob = new Blob([], { type: 'audio/mpeg' });
      const result = await downloadStorageService.validateAudioFile(emptyBlob, 'mp3');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/empty/i);
    });

    it('stores and purges in-memory Blob registries cleanly', () => {
      const blob = new Blob(['sample-audio-data'], { type: 'audio/mpeg' });
      const url = downloadStorageService.storeBlob('job-1', blob);
      expect(url).toBeDefined();
      expect(downloadStorageService.getStoredBlob('job-1')).toBe(blob);

      downloadStorageService.removeStoredBlob('job-1');
      expect(downloadStorageService.getStoredBlob('job-1')).toBeUndefined();

      downloadStorageService.storeBlob('job-2', blob);
      downloadStorageService.clearAllBlobData();
      expect(downloadStorageService.getStoredBlob('job-2')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Database Schema v10 & DownloadRepository
  // ─────────────────────────────────────────────────────────────
  describe('DownloadRepository & Schema v10 Persistence', () => {
    it('saves, retrieves, and updates download records', async () => {
      const record: DownloadRecord = {
        id: 'dl-test-1',
        source_id: 'https://archive.org/download/track.mp3',
        source_type: 'direct_url',
        source_reference: 'Direct URL',
        display_title: 'Test Symphony',
        artist: 'Beethoven',
        album: 'Symphonies',
        destination_uri: '/Music/Downloads/Beethoven - Test Symphony.mp3',
        status: 'queued',
        priority: 'high',
        expected_bytes: 10485760,
        downloaded_bytes: 0,
        created_at: Date.now(),
        retry_count: 0,
        is_resumable: true,
      };

      await DownloadRepository.save(record);
      const fetched = await DownloadRepository.getById('dl-test-1');
      expect(fetched).toBeDefined();
      expect(fetched?.display_title).toBe('Test Symphony');
      expect(fetched?.priority).toBe('high');

      await DownloadRepository.update('dl-test-1', { status: 'downloading' });
      const updated = await DownloadRepository.getById('dl-test-1');
      expect(updated?.status).toBe('downloading');
    });

    it('orders queued jobs with priority weighting (high > normal > low)', async () => {
      const now = Date.now();
      const baseRecord = {
        source_type: 'direct_url' as const,
        source_reference: 'Direct',
        display_title: 'Song',
        artist: 'Artist',
        album: 'Album',
        destination_uri: '/Music/Downloads/Song.mp3',
        status: 'queued' as const,
        expected_bytes: 1000,
        downloaded_bytes: 0,
        retry_count: 0,
        is_resumable: true,
      };

      await DownloadRepository.save({
        ...baseRecord,
        id: 'low-1',
        source_id: 'https://test.org/low.mp3',
        priority: 'low',
        created_at: now,
      });

      await DownloadRepository.save({
        ...baseRecord,
        id: 'high-1',
        source_id: 'https://test.org/high.mp3',
        priority: 'high',
        created_at: now + 10,
      });

      await DownloadRepository.save({
        ...baseRecord,
        id: 'normal-1',
        source_id: 'https://test.org/normal.mp3',
        priority: 'normal',
        created_at: now + 5,
      });

      const queued = await DownloadRepository.getQueuedJobs();
      expect(queued.length).toBe(3);
      expect(queued[0].id).toBe('high-1');
      expect(queued[1].id).toBe('normal-1');
      expect(queued[2].id).toBe('low-1');
    });

    it('computes storage usage and aggregate status counts', async () => {
      const now = Date.now();
      await DownloadRepository.save({
        id: 'c1',
        source_id: 'https://test.org/1.mp3',
        source_type: 'direct_url',
        source_reference: 'Direct',
        display_title: 'Track 1',
        artist: 'Artist',
        album: 'Album',
        destination_uri: '/Music/Downloads/Track 1.mp3',
        status: 'completed',
        priority: 'normal',
        expected_bytes: 5000000,
        downloaded_bytes: 5000000,
        created_at: now,
        retry_count: 0,
        is_resumable: true,
      });

      await DownloadRepository.save({
        id: 'f1',
        source_id: 'https://test.org/2.mp3',
        source_type: 'direct_url',
        source_reference: 'Direct',
        display_title: 'Track 2',
        artist: 'Artist',
        album: 'Album',
        destination_uri: '/Music/Downloads/Track 2.mp3',
        status: 'failed',
        priority: 'normal',
        expected_bytes: 3000000,
        downloaded_bytes: 1000000,
        created_at: now,
        retry_count: 1,
        is_resumable: true,
      });

      const usage = await DownloadRepository.getStorageUsage();
      expect(usage.completedCount).toBe(1);
      expect(usage.totalBytes).toBe(5000000);

      const counts = await DownloadRepository.getCountsByStatus();
      expect(counts.completed).toBe(1);
      expect(counts.failed).toBe(1);
      expect(counts.downloading).toBe(0);

      // Clean failed jobs
      const clearedFailed = await DownloadRepository.clearFailed();
      expect(clearedFailed).toBe(1);
      expect(await DownloadRepository.getById('f1')).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. Download Queue Execution Service
  // ─────────────────────────────────────────────────────────────
  describe('DownloadQueueService: Lifecycle & Scheduling', () => {
    it('queues a download job and prevents accidental duplicates', async () => {
      // Mock HEAD request for validation
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': '5000',
          'content-type': 'audio/mpeg',
          'accept-ranges': 'bytes',
        }),
      });

      const job1 = await downloadQueueService.addDownload({
        sourceUrl: 'https://archive.org/download/open-symphony/audio.mp3',
        title: 'Open Symphony',
        artist: 'Orchestra',
        priority: 'normal',
      });

      expect(job1).toBeDefined();
      expect(job1.status).toBe('queued');

      // Attempting to enqueue duplicate active URL
      await expect(
        downloadQueueService.addDownload({
          sourceUrl: 'https://archive.org/download/open-symphony/audio.mp3',
          title: 'Open Symphony Duplicate',
          artist: 'Orchestra',
        })
      ).rejects.toThrow(/already in the download queue/i);
    });

    it('pauses, resumes, and cancels active or queued jobs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-length': '5000',
          'content-type': 'audio/mpeg',
          'accept-ranges': 'bytes',
        }),
      });

      const job = await downloadQueueService.addDownload({
        sourceUrl: 'https://archive.org/download/track-pause-test/audio.mp3',
        title: 'Pause Test',
        artist: 'Soloist',
        priority: 'high',
      });

      // Pause
      await downloadQueueService.pauseDownload(job.id);
      let updated = await DownloadRepository.getById(job.id);
      expect(updated?.status).toBe('paused');

      // Resume
      await downloadQueueService.resumeDownload(job.id);
      updated = await DownloadRepository.getById(job.id);
      expect(updated?.status).toBe('queued');

      // Cancel
      await downloadQueueService.cancelDownload(job.id);
      updated = await DownloadRepository.getById(job.id);
      expect(updated?.status).toBe('cancelled');
    });

    it('recovers interrupted downloads on startup into paused state', async () => {
      const now = Date.now();
      await DownloadRepository.save({
        id: 'interrupted-job-1',
        source_id: 'https://archive.org/download/crash/song.mp3',
        source_type: 'direct_url',
        source_reference: 'Direct URL',
        display_title: 'Unfinished Track',
        artist: 'Band',
        album: 'Album',
        destination_uri: '/Music/Downloads/Band - Unfinished Track.mp3',
        status: 'downloading',
        priority: 'normal',
        expected_bytes: 8000000,
        downloaded_bytes: 4000000,
        created_at: now,
        retry_count: 0,
        is_resumable: true,
      });

      // Run recovery
      await downloadQueueService.recoverInterruptedJobs();

      const recovered = await DownloadRepository.getById('interrupted-job-1');
      expect(recovered?.status).toBe('paused');
      expect(recovered?.last_error_message).toMatch(/restart/i);
    });

    it('registers completed download into offline local music library', async () => {
      // Mock fetch response with valid MP3 ID3 header
      const id3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      const fullBytes = new Uint8Array(1024);
      fullBytes.set(id3Header, 0);

      global.fetch = vi.fn().mockImplementation((url: string, opts?: any) => {
        if (opts?.method === 'HEAD') {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({
              'content-length': '1024',
              'content-type': 'audio/mpeg',
              'accept-ranges': 'bytes',
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({
            'content-length': '1024',
            'content-type': 'audio/mpeg',
            'accept-ranges': 'bytes',
          }),
          body: {
            getReader() {
              let delivered = false;
              return {
                read() {
                  if (!delivered) {
                    delivered = true;
                    return Promise.resolve({ done: false, value: fullBytes });
                  }
                  return Promise.resolve({ done: true, value: undefined });
                },
              };
            },
          },
        });
      });

      const job = await downloadQueueService.addDownload({
        sourceUrl: 'https://archive.org/download/completed-song/track.mp3',
        title: 'Completed Melody',
        artist: 'Master Composer',
        album: 'Grand Album',
        priority: 'high',
      });

      // Execute directly
      await downloadQueueService.runJob(job);

      const completedJob = await DownloadRepository.getById(job.id);
      expect(completedJob?.status).toBe('completed');
      expect(completedJob?.target_track_id).toBeDefined();

      // Verify track is in db.tracks with offline flags
      const track = await TrackRepository.getById(completedJob!.target_track_id!);
      expect(track).toBeDefined();
      expect(track?.title).toContain('Completed Melody');
      expect(track?.artist).toBe('Master Composer');
      expect(track?.isDownloaded).toBe(true);
      expect(track?.downloadId).toBe(job.id);
    });

    it('differentiates record removal from physical file deletion', async () => {
      const trackId = 'offline-track-del-test';
      await TrackRepository.save({
        id: trackId,
        title: 'Deletion Test',
        artist: 'Tester',
        duration: 180,
        path: '/Music/Downloads/Tester - Deletion Test.mp3',
        folderPath: '/Music/Downloads',
        filename: 'Tester - Deletion Test.mp3',
        isDownloaded: true,
        source: 'local',
        sourceType: 'local',
        format: 'mp3',
        fileSize: 1000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
      });

      const dlId = 'dl-del-test';
      await DownloadRepository.save({
        id: dlId,
        source_id: 'https://archive.org/test.mp3',
        source_type: 'direct_url',
        source_reference: 'Direct URL',
        display_title: 'Deletion Test',
        artist: 'Tester',
        album: 'Album',
        destination_uri: '/Music/Downloads/Tester - Deletion Test.mp3',
        status: 'completed',
        priority: 'normal',
        expected_bytes: 1000,
        downloaded_bytes: 1000,
        target_track_id: trackId,
        created_at: Date.now(),
        retry_count: 0,
        is_resumable: true,
      });

      // 1. Delete record only (deletePhysicalFile = false)
      await downloadQueueService.deleteDownload(dlId, false);
      expect(await DownloadRepository.getById(dlId)).toBeUndefined();
      // Physical track in library is preserved!
      const preservedTrack = await TrackRepository.getById(trackId);
      expect(preservedTrack).toBeDefined();

      // 2. Delete record AND physical track
      await DownloadRepository.save({
        id: 'dl-del-test-2',
        source_id: 'https://archive.org/test2.mp3',
        source_type: 'direct_url',
        source_reference: 'Direct URL',
        display_title: 'Deletion Test 2',
        artist: 'Tester',
        album: 'Album',
        destination_uri: '/Music/Downloads/Tester - Deletion Test 2.mp3',
        status: 'completed',
        priority: 'normal',
        expected_bytes: 1000,
        downloaded_bytes: 1000,
        target_track_id: trackId,
        created_at: Date.now(),
        retry_count: 0,
        is_resumable: true,
      });

      await downloadQueueService.deleteDownload('dl-del-test-2', true);
      expect(await DownloadRepository.getById('dl-del-test-2')).toBeUndefined();
      expect(await TrackRepository.getById(trackId)).toBeUndefined();
    });
  });
});

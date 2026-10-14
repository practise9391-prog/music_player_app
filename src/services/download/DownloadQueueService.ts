import {
  DownloadRecord,
  DownloadStatus,
  DownloadPriority,
  DownloadProgressUpdate,
  DownloadMediaInfo,
} from '../../types/download';
import { Track } from '../../types/track';
import { DownloadRepository, TrackRepository } from '../../database/repository';
import { downloadProviderRegistry } from './providers/DownloadProviderRegistry';
import { downloadStorageService } from './DownloadStorageService';
import { parseAudioFileMetadata, generateTrackIdentity } from '../../library/metadataParser';
import { notificationService } from '../errorService';
import { DEFAULT_SETTINGS, AppSettings } from '../../types/settings';
import { db } from '../../database/db';

export type DownloadQueueListener = (downloads: DownloadRecord[]) => void;

export class DownloadQueueService {
  private static instance: DownloadQueueService | null = null;

  private activeControllers: Map<string, AbortController> = new Map();
  private listeners: Set<DownloadQueueListener> = new Set();
  private isProcessing = false;
  private settings: AppSettings = { ...DEFAULT_SETTINGS };

  private constructor() {
    this.initSettings();
    this.setupNetworkListeners();
    this.recoverInterruptedJobs();
  }

  public static getInstance(): DownloadQueueService {
    if (!this.instance) {
      this.instance = new DownloadQueueService();
    }
    return this.instance;
  }

  private async initSettings(): Promise<void> {
    try {
      const stored = await db.settings_store.get('app_settings');
      if (stored && stored.value) {
        this.settings = { ...DEFAULT_SETTINGS, ...(stored.value as AppSettings) };
      }
    } catch {
      // ignore
    }
  }

  public updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    // Trigger queue check in case concurrency limit changed
    this.processQueue();
  }

  public subscribe(listener: DownloadQueueListener): () => void {
    this.listeners.add(listener);
    this.notifyListeners();
    return () => this.listeners.delete(listener);
  }

  private async notifyListeners(): Promise<void> {
    const list = await DownloadRepository.getAll();
    this.listeners.forEach((fn) => {
      try {
        fn(list);
      } catch (err) {
        console.error('Download queue listener error:', err);
      }
    });
  }

  /**
   * Recovers jobs that were active when the application closed/restarted.
   */
  public async recoverInterruptedJobs(): Promise<void> {
    try {
      const downloading = await DownloadRepository.getByStatus('downloading');
      for (const job of downloading) {
        await DownloadRepository.update(job.id, {
          status: 'paused',
          last_error_message: 'Download was paused due to application restart.',
        });
      }
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  /**
   * Sets up online/offline event listeners.
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('offline', async () => {
      if (this.settings.downloadAutoPauseOffline) {
        console.info('[DownloadManager] Device is offline. Pausing active downloads.');
        await this.pauseAll('Paused automatically: No network connection.');
      }
    });

    window.addEventListener('online', async () => {
      if (this.settings.downloadAutoResumeOnline) {
        console.info('[DownloadManager] Connectivity restored. Resuming eligible downloads.');
        await this.resumeAll();
      }
    });
  }

  /**
   * Validates and prepares a download for a given URL without starting it.
   */
  public async prepareDownload(sourceUrl: string): Promise<{
    providerId: string;
    mediaInfo: DownloadMediaInfo;
  }> {
    const provider = await downloadProviderRegistry.getProviderForUrl(sourceUrl);
    if (!provider) {
      throw new Error(
        'No supported download provider found for this source. Please provide a direct audio URL or open-archive link.'
      );
    }

    const mediaInfo = await provider.getDownloadInfo(sourceUrl);
    if (!mediaInfo.isAuthorized) {
      throw new Error(
        mediaInfo.authorizationReason ||
          'Downloading from this source is unauthorized under its Terms of Service.'
      );
    }

    return {
      providerId: provider.id,
      mediaInfo,
    };
  }

  /**
   * Adds an authorized job to the download queue.
   */
  public async addDownload(params: {
    sourceUrl: string;
    title?: string;
    artist?: string;
    album?: string;
    priority?: DownloadPriority;
    coverArtUrl?: string;
  }): Promise<DownloadRecord> {
    // 1. Check for duplicate active job
    const existing = await DownloadRepository.getBySourceId(params.sourceUrl);
    if (existing && (existing.status === 'downloading' || existing.status === 'queued')) {
      throw new Error(`This file is already in the download queue (${existing.status}).`);
    }

    // 2. Resolve provider and media info
    const { providerId, mediaInfo } = await this.prepareDownload(params.sourceUrl);

    // 3. Check storage headroom
    const storageSummary = await downloadStorageService.getStorageSummary();
    if (storageSummary.isLowStorage) {
      notificationService.warning(
        'Low Storage Warning',
        'Device storage is low (less than 500 MB remaining).'
      );
    }

    // 4. Generate unique destination path
    const allTracks = await TrackRepository.getAllIncludingUnavailable();
    const existingFilenames = allTracks.map((t) => t.filename || '').filter(Boolean);

    const title = params.title || mediaInfo.title;
    const artist = params.artist || mediaInfo.artist || 'Unknown Artist';
    const album = params.album || mediaInfo.album || 'Downloads';
    const ext = mediaInfo.detectedFormat || 'mp3';

    const filename = downloadStorageService.generateTargetFilename(
      artist,
      title,
      ext,
      this.settings.downloadDuplicateAction,
      existingFilenames
    );

    const destinationUri = `${this.settings.defaultDownloadLocation}/${filename}`;
    const id = 'dl_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();

    const record: DownloadRecord = {
      id,
      source_id: params.sourceUrl,
      source_type: providerId as any,
      source_reference: providerId,
      display_title: title,
      artist,
      album,
      cover_art_url: params.coverArtUrl || mediaInfo.coverArtUrl,
      destination_uri: destinationUri,
      status: 'queued',
      downloaded_bytes: 0,
      expected_bytes: mediaInfo.expectedBytes,
      mime_type: mediaInfo.mimeType,
      detected_format: ext,
      priority: params.priority || 'normal',
      created_at: Date.now(),
      retry_count: 0,
      is_resumable: mediaInfo.isResumable,
      etag: mediaInfo.etag,
      last_modified: mediaInfo.lastModified,
    };

    await DownloadRepository.save(record);
    this.notifyListeners();
    this.processQueue();

    if (this.settings.downloadShowNotifications) {
      notificationService.info('Download Queued', `Added "${title}" to the download queue.`);
    }

    return record;
  }

  /**
   * Main queue execution loop.
   */
  public async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const maxConcurrent = Math.max(1, this.settings.maxConcurrentDownloads || 1);

      while (this.activeControllers.size < maxConcurrent) {
        const queuedJobs = await DownloadRepository.getQueuedJobs();
        if (queuedJobs.length === 0) break;

        const nextJob = queuedJobs[0];
        // Start job asynchronously so loop can launch up to maxConcurrent
        this.runJob(nextJob).catch((err) => {
          console.error(`[DownloadQueue] Error executing job ${nextJob.id}:`, err);
        });

        // Small delay to let controller register in activeControllers
        await new Promise((r) => setTimeout(r, 50));
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Executes a single download job.
   */
  public async runJob(job: DownloadRecord): Promise<void> {
    // Check if network conditions permit downloading
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await DownloadRepository.update(job.id, {
        status: 'paused',
        last_error_message: 'Waiting for network connection.',
      });
      this.notifyListeners();
      return;
    }

    const provider = await downloadProviderRegistry.getProviderForUrl(job.source_id);
    if (!provider) {
      await DownloadRepository.update(job.id, {
        status: 'failed',
        last_error_code: 'UNSUPPORTED_PROVIDER',
        last_error_message: 'No supported download provider available for this source.',
      });
      this.notifyListeners();
      return;
    }

    const controller = new AbortController();
    this.activeControllers.set(job.id, controller);

    await DownloadRepository.update(job.id, {
      status: 'downloading',
      started_at: job.started_at || Date.now(),
      last_error_code: undefined,
      last_error_message: undefined,
    });
    this.notifyListeners();

    try {
      const startOffset = job.downloaded_bytes || 0;

      const { blob, mimeType } = await provider.startDownload(
        job,
        (progress: DownloadProgressUpdate) => {
          // Throttled update to in-memory state and UI
          DownloadRepository.update(job.id, {
            downloaded_bytes: progress.downloadedBytes,
            expected_bytes: progress.expectedBytes || job.expected_bytes,
            speed_bytes_sec: progress.speedBytesSec,
            estimated_remaining_seconds: progress.estimatedRemainingSeconds,
          }).then(() => this.notifyListeners());
        },
        controller.signal,
        startOffset
      );

      // Validate integrity of downloaded file
      const validation = await downloadStorageService.validateAudioFile(
        blob,
        job.detected_format
      );
      if (!validation.isValid) {
        throw new Error(validation.error || 'Downloaded file failed integrity validation.');
      }

      // Store blob and get playable URL
      const playbackUrl = downloadStorageService.storeBlob(job.id, blob);

      // Register with local music library
      const track = await this.registerDownloadedTrack(job, blob, playbackUrl);

      // Mark job completed
      await DownloadRepository.update(job.id, {
        status: 'completed',
        completed_at: Date.now(),
        downloaded_bytes: blob.size,
        expected_bytes: blob.size,
        mime_type: mimeType,
        target_track_id: track.id,
      });

      if (this.settings.downloadShowNotifications) {
        notificationService.success(
          'Download Complete',
          `"${job.display_title}" is ready for offline playback.`
        );
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        // Paused or cancelled by user, state already handled
        return;
      }

      console.error(`Download failed for job ${job.id}:`, err);
      const isTransient =
        err.message?.includes('network') ||
        err.message?.includes('timeout') ||
        err.message?.includes('fetch');

      await DownloadRepository.update(job.id, {
        status: 'failed',
        last_error_code: isTransient ? 'TRANSIENT_NETWORK' : 'PERMANENT_ERROR',
        last_error_message: err.message || 'Download failed unexpectedly.',
      });

      if (this.settings.downloadShowNotifications) {
        notificationService.error('Download Failed', err.message || 'Download failed.');
      }
    } finally {
      this.activeControllers.delete(job.id);
      this.notifyListeners();
      // Process next queued job
      this.processQueue();
    }
  }

  /**
   * Registers a successfully downloaded audio file into db.tracks.
   */
  private async registerDownloadedTrack(
    job: DownloadRecord,
    blob: Blob,
    playbackUrl: string
  ): Promise<Track> {
    const filename = job.destination_uri.split('/').pop() || `${job.display_title}.mp3`;
    const fakeFile = new File([blob], filename, { type: blob.type });

    let parsedMeta: {
      title: string;
      artist: string;
      album: string;
      duration: number;
      coverArtUrl?: string;
      genre?: string;
      year?: number;
      lyrics?: string;
    } = {
      title: job.display_title,
      artist: job.artist,
      album: job.album,
      duration: 0,
      coverArtUrl: job.cover_art_url,
    };

    try {
      const extracted = await parseAudioFileMetadata(
        fakeFile,
        job.destination_uri,
        filename,
        Date.now()
      );
      const resolvedTitle =
        extracted.title && extracted.title !== filename
          ? extracted.title
          : job.display_title || extracted.title;
      const resolvedArtist =
        extracted.artist && extracted.artist !== 'Unknown Artist'
          ? extracted.artist
          : job.artist || extracted.artist || 'Unknown Artist';
      const resolvedAlbum =
        extracted.album && extracted.album !== 'Unknown Album'
          ? extracted.album
          : job.album || extracted.album || 'Downloads';

      parsedMeta = {
        title: resolvedTitle,
        artist: resolvedArtist,
        album: resolvedAlbum,
        duration: extracted.duration || 0,
        coverArtUrl: extracted.coverArtUrl || job.cover_art_url,
        genre: extracted.genre,
        year: extracted.year,
        lyrics: extracted.lyrics,
      };
    } catch {
      // Fall back to job metadata
    }

    const trackId = generateTrackIdentity(job.destination_uri, blob.size, Date.now());

    const track: Track = {
      id: trackId,
      folderPath: this.settings.defaultDownloadLocation,
      path: job.destination_uri,
      filename,
      title: parsedMeta.title,
      artist: parsedMeta.artist,
      album: parsedMeta.album,
      duration: parsedMeta.duration,
      format: job.detected_format || 'mp3',
      genre: parsedMeta.genre,
      year: parsedMeta.year,
      coverArtUrl: parsedMeta.coverArtUrl,
      fileSize: blob.size,
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      source: 'local',
      sourceType: 'local',
      isAvailable: true,
      playbackUrl,
      lyrics: parsedMeta.lyrics,
      isDownloaded: true,
      downloadId: job.id,
    };

    await TrackRepository.save(track);

    // Notify UI that library has updated
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return track;
  }

  /**
   * Pauses an active or queued download.
   */
  public async pauseDownload(jobId: string, reason = 'Paused by user.'): Promise<void> {
    const controller = this.activeControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(jobId);
    }

    await DownloadRepository.update(jobId, {
      status: 'paused',
      speed_bytes_sec: 0,
      last_error_message: reason,
    });

    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Resumes a paused or failed download.
   */
  public async resumeDownload(jobId: string): Promise<void> {
    const job = await DownloadRepository.getById(jobId);
    if (!job) return;

    await DownloadRepository.update(jobId, {
      status: 'queued',
      last_error_code: undefined,
      last_error_message: undefined,
    });

    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Cancels a download and cleans up.
   */
  public async cancelDownload(jobId: string): Promise<void> {
    const controller = this.activeControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(jobId);
    }

    downloadStorageService.removeStoredBlob(jobId);

    await DownloadRepository.update(jobId, {
      status: 'cancelled',
      speed_bytes_sec: 0,
    });

    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Retries a failed download.
   */
  public async retryDownload(jobId: string): Promise<void> {
    const job = await DownloadRepository.getById(jobId);
    if (!job) return;

    await DownloadRepository.update(jobId, {
      status: 'queued',
      retry_count: (job.retry_count || 0) + 1,
      last_error_code: undefined,
      last_error_message: undefined,
      downloaded_bytes: 0, // restart cleanly on failure retry
    });

    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Pauses all downloading and queued jobs.
   */
  public async pauseAll(reason = 'All downloads paused.'): Promise<void> {
    for (const [id, controller] of this.activeControllers.entries()) {
      controller.abort();
      await DownloadRepository.update(id, {
        status: 'paused',
        speed_bytes_sec: 0,
        last_error_message: reason,
      });
    }
    this.activeControllers.clear();

    const queued = await DownloadRepository.getByStatus('queued');
    for (const q of queued) {
      await DownloadRepository.update(q.id, {
        status: 'paused',
        last_error_message: reason,
      });
    }

    this.notifyListeners();
  }

  /**
   * Resumes all paused downloads.
   */
  public async resumeAll(): Promise<void> {
    const paused = await DownloadRepository.getByStatus('paused');
    for (const p of paused) {
      await DownloadRepository.update(p.id, {
        status: 'queued',
        last_error_code: undefined,
        last_error_message: undefined,
      });
    }
    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Cancels all active and queued downloads.
   */
  public async cancelAll(): Promise<void> {
    for (const [id, controller] of this.activeControllers.entries()) {
      controller.abort();
      downloadStorageService.removeStoredBlob(id);
      await DownloadRepository.update(id, {
        status: 'cancelled',
        speed_bytes_sec: 0,
      });
    }
    this.activeControllers.clear();

    const queued = await DownloadRepository.getByStatus('queued');
    for (const q of queued) {
      await DownloadRepository.update(q.id, {
        status: 'cancelled',
      });
    }

    this.notifyListeners();
  }

  /**
   * Updates priority of a queued job.
   */
  public async setJobPriority(jobId: string, priority: DownloadPriority): Promise<void> {
    await DownloadRepository.update(jobId, { priority });
    this.notifyListeners();
    this.processQueue();
  }

  /**
   * Deletes a download record from the database.
   * If deletePhysicalFile is true, also removes track from library.
   */
  public async deleteDownload(
    jobId: string,
    deletePhysicalFile = false
  ): Promise<void> {
    const job = await DownloadRepository.getById(jobId);
    if (!job) return;

    if (this.activeControllers.has(jobId)) {
      this.activeControllers.get(jobId)?.abort();
      this.activeControllers.delete(jobId);
    }

    downloadStorageService.removeStoredBlob(jobId);

    if (deletePhysicalFile && job.target_track_id) {
      await TrackRepository.remove(job.target_track_id);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nova-library-updated'));
      }
    }

    await DownloadRepository.remove(jobId);
    this.notifyListeners();
    this.processQueue();
  }
}

export const downloadQueueService = DownloadQueueService.getInstance();


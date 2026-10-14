import { DuplicateAction, StorageSummary } from '../../types/download';
import { db } from '../../database/db';
import { TrackRepository, DownloadRepository } from '../../database/repository';

export class DownloadStorageService {
  private static instance: DownloadStorageService | null = null;
  // In-memory or session-persisted Blob registry for downloaded files
  private downloadedBlobs: Map<string, Blob> = new Map();

  private constructor() {}

  public static getInstance(): DownloadStorageService {
    if (!this.instance) {
      this.instance = new DownloadStorageService();
    }
    return this.instance;
  }

  /**
   * Generates a safe, sanitized filename.
   */
  public sanitizeFilename(name: string): string {
    if (!name) return 'audio_track';
    return name
      .replace(/[\\/:*?"<>|\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 180);
  }

  /**
   * Generates a safe full file title in "Artist - Title.ext" format.
   */
  public generateTargetFilename(
    artist: string,
    title: string,
    ext = 'mp3',
    duplicatePolicy: DuplicateAction = 'rename',
    existingFilenames: string[] = []
  ): string {
    const cleanArtist = this.sanitizeFilename(artist || 'Unknown Artist');
    const cleanTitle = this.sanitizeFilename(title || 'Track');
    const cleanExt = (ext.replace(/^\./, '') || 'mp3').toLowerCase();

    let base = `${cleanArtist} - ${cleanTitle}.${cleanExt}`;
    if (!cleanArtist || cleanArtist === 'Unknown Artist') {
      base = `${cleanTitle}.${cleanExt}`;
    }

    if (!existingFilenames.includes(base)) {
      return base;
    }

    if (duplicatePolicy === 'overwrite') {
      return base;
    }

    if (duplicatePolicy === 'skip') {
      return base; // handled by caller checking existence
    }

    // Rename policy: add index (1), (2), etc.
    let counter = 1;
    const nameWithoutExt = base.replace(new RegExp(`\\.${cleanExt}$`, 'i'), '');
    while (existingFilenames.includes(`${nameWithoutExt} (${counter}).${cleanExt}`)) {
      counter++;
    }
    return `${nameWithoutExt} (${counter}).${cleanExt}`;
  }

  /**
   * Validates file integrity: magic bytes, non-empty, and rejects HTML error pages.
   */
  public async validateAudioFile(
    blob: Blob,
    expectedFormat?: string
  ): Promise<{ isValid: boolean; detectedFormat: string; error?: string }> {
    if (!blob || blob.size === 0) {
      return { isValid: false, detectedFormat: '', error: 'Downloaded file is completely empty (0 bytes).' };
    }

    // Read first 64 bytes for magic bytes inspection
    const slice = blob.slice(0, 64);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Detect and reject HTML error pages
    const headerStr = new TextDecoder('utf-8').decode(bytes.slice(0, 32)).toLowerCase();
    if (
      headerStr.includes('<!doctype') ||
      headerStr.includes('<html') ||
      headerStr.includes('<?xml') ||
      headerStr.includes('{"error"')
    ) {
      return {
        isValid: false,
        detectedFormat: 'html',
        error: 'Invalid response: Received an HTML/JSON error webpage instead of an audio stream.',
      };
    }

    // 2. Identify audio magic numbers
    // MP3 with ID3v2 tag: "ID3" (0x49, 0x44, 0x33)
    if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      return { isValid: true, detectedFormat: 'mp3' };
    }

    // MP3 without ID3 (MPEG Audio Sync word: 0xFF followed by 0xE0-0xFF)
    if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
      return { isValid: true, detectedFormat: 'mp3' };
    }

    // FLAC: "fLaC" (0x66, 0x4C, 0x61, 0x43)
    if (bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return { isValid: true, detectedFormat: 'flac' };
    }

    // Ogg: "OggS" (0x4F, 0x67, 0x67, 0x53)
    if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return { isValid: true, detectedFormat: 'ogg' };
    }

    // WAV: "RIFF" (0x52, 0x49, 0x46, 0x46)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
      return { isValid: true, detectedFormat: 'wav' };
    }

    // M4A / AAC (MP4 container with "ftyp"): bytes 4..7 === "ftyp"
    if (
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    ) {
      return { isValid: true, detectedFormat: 'm4a' };
    }

    // WebM / Opus container: EBML ID 0x1A 0x45 0xDF 0xA3
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
      return { isValid: true, detectedFormat: 'opus' };
    }

    // AAC ADTS sync: 0xFFF
    if (bytes[0] === 0xff && (bytes[1] & 0xf0) === 0xf0) {
      return { isValid: true, detectedFormat: 'aac' };
    }

    // If MIME type / expected format is explicitly audio and file has sufficient length
    if (expectedFormat && blob.type.startsWith('audio/')) {
      return { isValid: true, detectedFormat: expectedFormat };
    }

    // If unknown format, allow if larger than 8 KB and not text/html
    if (blob.size >= 8192) {
      return { isValid: true, detectedFormat: expectedFormat || 'mp3' };
    }

    return {
      isValid: false,
      detectedFormat: 'unknown',
      error: 'Unrecognized file format or corrupted audio stream.',
    };
  }

  /**
   * Stores a downloaded Blob in memory/cache and returns a stable object URL.
   */
  public storeBlob(jobId: string, blob: Blob): string {
    this.downloadedBlobs.set(jobId, blob);
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      return URL.createObjectURL(blob);
    }
    return `blob:nova-download-${jobId}`;
  }

  /**
   * Retrieves a stored Blob.
   */
  public getStoredBlob(jobId: string): Blob | undefined {
    return this.downloadedBlobs.get(jobId);
  }

  /**
   * Removes a stored Blob.
   */
  public removeStoredBlob(jobId: string): void {
    this.downloadedBlobs.delete(jobId);
  }

  /**
   * Clears all stored in-memory Blobs.
   */
  public clearAllBlobData(): void {
    this.downloadedBlobs.clear();
  }

  /**
   * Computes device and application download storage summary.
   */
  public async getStorageSummary(): Promise<StorageSummary> {
    let totalStorageBytes = 64 * 1024 * 1024 * 1024; // 64 GB fallback
    let availableStorageBytes = 20 * 1024 * 1024 * 1024; // 20 GB fallback

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) {
          totalStorageBytes = estimate.quota;
          const used = estimate.usage || 0;
          availableStorageBytes = Math.max(0, totalStorageBytes - used);
        }
      } catch {
        // ignore
      }
    }

    const { totalBytes, completedCount } = await DownloadRepository.getStorageUsage();
    const queuedJobs = await DownloadRepository.getByStatus('queued');
    let queuedExpectedBytes = 0;
    for (const j of queuedJobs) {
      queuedExpectedBytes += j.expected_bytes || 0;
    }

    const isLowStorage = availableStorageBytes < 500 * 1024 * 1024; // Less than 500 MB

    return {
      totalStorageBytes,
      availableStorageBytes,
      downloadedFilesBytes: totalBytes,
      completedCount,
      pendingCount: queuedJobs.length,
      queuedExpectedBytes,
      isLowStorage,
    };
  }
}

export const downloadStorageService = DownloadStorageService.getInstance();

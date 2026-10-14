import { Track } from '../../types';
import { db } from '../../database/db';
import { TrackRepository, FileOperationRepository } from '../../database/repository';
import { artworkCache } from '../../library/artworkCache';
import { audioMetadataService } from './AudioMetadataService';

export interface ImageValidationResult {
  isValid: boolean;
  mimeType: string;
  width?: number;
  height?: number;
  fileSizeBytes: number;
  error?: string;
  processedBlob?: Blob;
}

export class ArtworkManagerService {
  private static instance: ArtworkManagerService | null = null;

  private constructor() {}

  public static getInstance(): ArtworkManagerService {
    if (!this.instance) {
      this.instance = new ArtworkManagerService();
    }
    return this.instance;
  }

  /**
   * Validates an uploaded or selected image file before embedding or caching.
   * Checks file size, MIME type, and dimensions.
   */
  public async validateImageFile(
    fileOrBlob: File | Blob,
    maxDimension = 1000
  ): Promise<ImageValidationResult> {
    const size = fileOrBlob.size;

    // 1. Sanity check on file size: Reject > 20 MB images
    if (size === 0) {
      return { isValid: false, mimeType: '', fileSizeBytes: 0, error: 'Selected image file is empty (0 bytes).' };
    }
    if (size > 20 * 1024 * 1024) {
      return {
        isValid: false,
        mimeType: fileOrBlob.type,
        fileSizeBytes: size,
        error: 'Image is too large (exceeds maximum allowed size of 20 MB). Please choose a compressed artwork file.',
      };
    }

    // 2. Validate MIME type
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    let mimeType = fileOrBlob.type.toLowerCase();
    if (!mimeType || !validMimes.includes(mimeType)) {
      // Check magic bytes
      const slice = fileOrBlob.slice(0, 8);
      const buffer = await slice.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        mimeType = 'image/jpeg';
      } else if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      ) {
        mimeType = 'image/png';
      } else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
        mimeType = 'image/gif';
      } else if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46
      ) {
        mimeType = 'image/webp';
      } else {
        return {
          isValid: false,
          mimeType: fileOrBlob.type || 'unknown',
          fileSizeBytes: size,
          error: 'Unsupported image format. Supported types are JPEG, PNG, GIF, and WebP.',
        };
      }
    }

    // 3. Inspect and resize if image exceeds maxDimension
    if (typeof window !== 'undefined' && typeof Image !== 'undefined') {
      try {
        const { width, height, resizedBlob } = await this.inspectAndResizeImage(
          fileOrBlob,
          maxDimension,
          mimeType
        );
        return {
          isValid: true,
          mimeType,
          width,
          height,
          fileSizeBytes: resizedBlob.size,
          processedBlob: resizedBlob,
        };
      } catch (err: any) {
        return {
          isValid: false,
          mimeType,
          fileSizeBytes: size,
          error: err?.message || 'Failed to decode or parse image dimensions.',
        };
      }
    }

    // Fallback for non-browser / headless test environments
    return {
      isValid: true,
      mimeType,
      fileSizeBytes: size,
      processedBlob: fileOrBlob,
    };
  }

  /**
   * Alias for validateImageFile.
   */
  public async validateImage(
    fileOrBlob: File | Blob,
    maxDimension = 1000
  ): Promise<ImageValidationResult & { valid: boolean }> {
    const res = await this.validateImageFile(fileOrBlob, maxDimension);
    return {
      ...res,
      valid: res.isValid,
    };
  }

  /**
   * Resizes large images maintaining aspect ratio so embedded audio files remain compact.
   */
  private inspectAndResizeImage(
    blob: Blob,
    maxDimension: number,
    mimeType: string
  ): Promise<{ width: number; height: number; resizedBlob: Blob }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.width;
        let height = img.height;

        if (width <= 0 || height <= 0) {
          reject(new Error('Image has invalid dimensions (0x0).'));
          return;
        }

        // If within dimensions and under 2MB, keep original
        if (width <= maxDimension && height <= maxDimension && blob.size <= 2 * 1024 * 1024) {
          resolve({ width, height, resizedBlob: blob });
          return;
        }

        // Compute scaled dimensions
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ width: img.width, height: img.height, resizedBlob: blob });
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (resized) => {
            if (resized) {
              resolve({ width, height, resizedBlob: resized });
            } else {
              resolve({ width: img.width, height: img.height, resizedBlob: blob });
            }
          },
          'image/jpeg',
          0.88
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Corrupt or unreadable image file.'));
      };

      img.src = url;
    });
  }

  private resolveImageBlob(image: Blob | string): Blob {
    if (image instanceof Blob) return image;
    if (typeof image === 'string' && image.startsWith('data:')) {
      const parts = image.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      return new Blob([u8arr], { type: mime });
    }
    return new Blob([new TextEncoder().encode(image)], { type: 'image/jpeg' });
  }

  /**
   * Replaces artwork for a specific track, storing in artworkCache and optionally embedding in audio file.
   */
  public async replaceTrackArtwork(
    trackOrId: Track | string,
    imageBlobOrDataUrl: Blob | string,
    optionsOrEmbed?: { embedInFile?: boolean } | boolean,
    audioBlob?: Blob
  ): Promise<{ success: boolean; updatedTrack: Track; coverArtUrl: string; embedded: boolean }> {
    const track = typeof trackOrId === 'string'
      ? await TrackRepository.getById(trackOrId)
      : trackOrId;

    if (!track) {
      throw new Error(`Track with ID "${trackOrId}" not found.`);
    }

    const imageBlob = this.resolveImageBlob(imageBlobOrDataUrl);
    const validation = await this.validateImageFile(imageBlob);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    const embedInFile = typeof optionsOrEmbed === 'boolean'
      ? optionsOrEmbed
      : (optionsOrEmbed?.embedInFile ?? false);

    const finalBlob = validation.processedBlob || imageBlob;
    const arrayBuffer = await finalBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Generate stable hash for artwork
    const artHash = 'art_' + Math.abs(
      bytes.slice(0, 100).reduce((acc, b) => (acc << 5) - acc + b, 0)
    ).toString(36) + '_' + bytes.length;

    // Cache image
    const coverArtUrl = await artworkCache.storeArtwork(
      artHash,
      bytes,
      validation.mimeType,
      512
    );

    let embedded = false;
    if (embedInFile && audioBlob && track.format === 'mp3') {
      try {
        await audioMetadataService.updateTrackMetadata(
          track,
          { coverArtUrl, coverArtId: artHash },
          audioBlob,
          finalBlob
        );
        embedded = true;
      } catch (err) {
        console.warn('Embedding artwork into audio file failed, saved to cache:', err);
      }
    }

    // Update database
    await TrackRepository.updateMetadata(track.id, {
      coverArtUrl,
      coverArtId: artHash,
    });

    const updatedTrack: Track = {
      ...track,
      coverArtUrl,
      coverArtId: artHash,
    };

    // Log operation
    await FileOperationRepository.logOperation({
      track_id: track.id,
      operation_type: 'ARTWORK_UPDATE',
      timestamp: Date.now(),
      details: `Replaced artwork for "${track.title}" (${embedded ? 'Embedded in MP3' : 'Application Cache'})`,
      source_path: track.path,
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return { success: true, updatedTrack, coverArtUrl, embedded };
  }

  /**
   * Removes artwork reference for a track.
   */
  public async removeTrackArtwork(
    trackOrId: Track | string
  ): Promise<{ success: boolean; updatedTrack: Track }> {
    const track = typeof trackOrId === 'string'
      ? await TrackRepository.getById(trackOrId)
      : trackOrId;

    if (!track) {
      throw new Error(`Track with ID "${trackOrId}" not found.`);
    }

    await TrackRepository.updateMetadata(track.id, {
      coverArtUrl: undefined,
      coverArtId: undefined,
    });

    const updatedTrack: Track = {
      ...track,
      coverArtUrl: undefined,
      coverArtId: undefined,
    };

    await FileOperationRepository.logOperation({
      track_id: track.id,
      operation_type: 'ARTWORK_UPDATE',
      timestamp: Date.now(),
      details: `Removed artwork from "${track.title}"`,
      source_path: track.path,
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return { success: true, updatedTrack };
  }

  /**
   * Applies the same artwork to all tracks in an album.
   */
  public async applyArtworkToAlbum(
    albumTitle: string,
    imageOrArtist: Blob | string,
    imageOrOptions?: Blob | string | { embedInFile?: boolean },
    maybeOptions?: { embedInFile?: boolean }
  ): Promise<{ success: boolean; updatedCount: number; updatedTracksCount: number; coverArtUrl: string }> {
    let artistName = '';
    let imageSource: Blob | string;

    if (
      typeof imageOrArtist === 'string' &&
      !imageOrArtist.startsWith('data:') &&
      !imageOrArtist.startsWith('blob:') &&
      imageOrOptions &&
      (typeof imageOrOptions === 'string' || imageOrOptions instanceof Blob)
    ) {
      artistName = imageOrArtist;
      imageSource = imageOrOptions as (Blob | string);
    } else {
      imageSource = imageOrArtist;
    }

    const imageBlob = this.resolveImageBlob(imageSource);
    const validation = await this.validateImageFile(imageBlob);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    const finalBlob = validation.processedBlob || imageBlob;
    const arrayBuffer = await finalBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const artHash = 'art_alb_' + Math.abs(
      bytes.slice(0, 100).reduce((acc, b) => (acc << 5) - acc + b, 0)
    ).toString(36);

    const coverArtUrl = await artworkCache.storeArtwork(
      artHash,
      bytes,
      validation.mimeType,
      512
    );

    const allTracks = await TrackRepository.getAllIncludingUnavailable();
    const matching = allTracks.filter(
      (t) =>
        t.album?.trim().toLowerCase() === albumTitle.trim().toLowerCase() &&
        (!artistName || t.artist?.trim().toLowerCase() === artistName.trim().toLowerCase())
    );

    if (matching.length > 0) {
      const ids = matching.map((t) => t.id);
      await TrackRepository.bulkUpdateMetadata(ids, {
        coverArtUrl,
        coverArtId: artHash,
      });

      await FileOperationRepository.logOperation({
        track_id: ids.join(','),
        operation_type: 'ARTWORK_UPDATE',
        timestamp: Date.now(),
        details: `Applied album artwork to ${matching.length} tracks in "${albumTitle}"`,
        status: 'success',
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nova-library-updated'));
      }
    }

    return {
      success: true,
      updatedCount: matching.length,
      updatedTracksCount: matching.length,
      coverArtUrl,
    };
  }

  /**
   * Applies artwork to a list of track IDs.
   */
  public async applyArtworkToTracks(
    trackIds: string[],
    imageBlob: Blob
  ): Promise<{ updatedCount: number; coverArtUrl: string }> {
    const validation = await this.validateImageFile(imageBlob);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid image file.');
    }

    const finalBlob = validation.processedBlob || imageBlob;
    const arrayBuffer = await finalBlob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const artHash = 'art_bulk_' + Math.abs(
      bytes.slice(0, 100).reduce((acc, b) => (acc << 5) - acc + b, 0)
    ).toString(36);

    const coverArtUrl = await artworkCache.storeArtwork(
      artHash,
      bytes,
      validation.mimeType,
      512
    );

    await TrackRepository.bulkUpdateMetadata(trackIds, {
      coverArtUrl,
      coverArtId: artHash,
    });

    await FileOperationRepository.logOperation({
      track_id: trackIds.join(','),
      operation_type: 'artwork_change',
      timestamp: Date.now(),
      details: `Bulk applied artwork to ${trackIds.length} tracks`,
      status: 'success',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    return { updatedCount: trackIds.length, coverArtUrl };
  }
}

export const artworkManagerService = ArtworkManagerService.getInstance();

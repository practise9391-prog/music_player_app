import { db } from '../database/db';
import { ArtworkCacheRecord } from '../types';

class ArtworkCacheService {
  private memCache = new Map<string, string>(); // id -> objectUrl / dataUrl

  /**
   * Retrieves artwork dataUrl from memory cache or IndexedDB
   */
  public async getArtwork(id: string): Promise<string | null> {
    if (this.memCache.has(id)) {
      return this.memCache.get(id)!;
    }

    try {
      const record = await db.artwork_cache.get(id);
      if (record && record.dataUrl) {
        this.memCache.set(id, record.dataUrl);
        return record.dataUrl;
      }
    } catch {
      // offline indexeddb fallback
    }

    return null;
  }

  /**
   * Resizes an image Blob into an optimized local thumbnail dataURL and stores in cache
   */
  public async storeArtwork(
    id: string,
    imageBytes: Uint8Array,
    mimeType: string,
    maxDimension = 256
  ): Promise<string> {
    if (this.memCache.has(id)) {
      return this.memCache.get(id)!;
    }

    try {
      const blob = new Blob([imageBytes as BlobPart], { type: mimeType });
      const optimizedDataUrl = await this.createOptimizedThumbnail(blob, maxDimension);

      const record: ArtworkCacheRecord = {
        id,
        dataUrl: optimizedDataUrl,
        mimeType: 'image/jpeg',
        width: maxDimension,
        height: maxDimension,
        createdAt: Date.now(),
      };

      await db.artwork_cache.put(record);
      this.memCache.set(id, optimizedDataUrl);
      return optimizedDataUrl;
    } catch {
      // If canvas / image decoding fails in test or headless env, store base64 direct
      let binary = '';
      for (let i = 0; i < imageBytes.byteLength; i++) {
        binary += String.fromCharCode(imageBytes[i]);
      }
      const dataUrl = `data:${mimeType};base64,${btoa(binary)}`;
      this.memCache.set(id, dataUrl);
      return dataUrl;
    }
  }

  private createOptimizedThumbnail(blob: Blob, maxDimension: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
        return;
      }

      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

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

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(objectUrl);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch {
          resolve(objectUrl);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Fallback to base64
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      };

      img.src = objectUrl;
    });
  }

  public clearMemoryCache(): void {
    this.memCache.clear();
  }
}

export const artworkCache = new ArtworkCacheService();

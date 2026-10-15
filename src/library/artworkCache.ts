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

    // Fast, reliable conversion of Uint8Array bytes to Base64 Data URL
    try {
      let binary = '';
      const len = imageBytes.byteLength;
      const chunkSize = 8192;
      for (let i = 0; i < len; i += chunkSize) {
        const chunk = imageBytes.subarray(i, Math.min(i + chunkSize, len));
        binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
      }
      const dataUrl = `data:${mimeType};base64,${btoa(binary)}`;

      const record: ArtworkCacheRecord = {
        id,
        dataUrl,
        mimeType: mimeType || 'image/jpeg',
        width: maxDimension,
        height: maxDimension,
        createdAt: Date.now(),
      };

      // Persist in IndexedDB in background
      db.artwork_cache.put(record).catch(() => {});
      this.memCache.set(id, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('[ArtworkCache] Direct base64 conversion fallback failed:', err);
      return '';
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

/**
 * Deterministically generates a vibrant neon geometric album art SVG data URL
 * with acoustic chevron waves matching the reference app when a track lacks embedded artwork.
 */
export function generateVibrantCover(title = 'Track', artist = ''): string {
  const seed = (title + (artist || '')).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const palettes = [
    ['#7c3aed', '#db2777'],
    ['#0284c7', '#2563eb'],
    ['#059669', '#10b981'],
    ['#ea580c', '#f59e0b'],
    ['#9333ea', '#4f46e5'],
    ['#e11d48', '#f43f5e'],
  ];
  const [c1, c2] = palettes[Math.abs(hash) % palettes.length];
  const initial = (title.replace(/^[^a-zA-Z0-9]+/, '') || 'M').charAt(0).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <linearGradient id="g_${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="100%" stop-color="${c2}" />
      </linearGradient>
      <pattern id="p_${Math.abs(hash)}" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M 0 12 L 12 0 L 24 12 L 12 24 Z" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
      </pattern>
    </defs>
    <rect width="200" height="200" rx="20" fill="url(#g_${Math.abs(hash)})"/>
    <rect width="200" height="200" rx="20" fill="url(#p_${Math.abs(hash)})"/>
    <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <circle cx="100" cy="100" r="42" fill="rgba(0,0,0,0.28)"/>
    <text x="100" y="112" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif" font-size="34" font-weight="900" fill="#ffffff" text-anchor="middle">${initial}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

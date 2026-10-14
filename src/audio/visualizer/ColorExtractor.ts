export interface ExtractedPalette {
  primary: string;
  secondary: string;
  accent: string;
  isExtracted: boolean;
}

export class ColorExtractor {
  private static cache: Map<string, ExtractedPalette> = new Map();

  /**
   * Samples dominant colors from an image element or URL offline.
   */
  public static async extractFromImage(
    imageUrl?: string,
    fallbackPrimary = '#00e5ff',
    fallbackSecondary = '#8000ff'
  ): Promise<ExtractedPalette> {
    if (!imageUrl || typeof document === 'undefined') {
      return {
        primary: fallbackPrimary,
        secondary: fallbackSecondary,
        accent: '#ffffff',
        isExtracted: false,
      };
    }

    if (this.cache.has(imageUrl)) {
      return this.cache.get(imageUrl)!;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve({
              primary: fallbackPrimary,
              secondary: fallbackSecondary,
              accent: '#ffffff',
              isExtracted: false,
            });
            return;
          }

          // Sample down to 32x32 for high performance
          canvas.width = 32;
          canvas.height = 32;
          ctx.drawImage(img, 0, 0, 32, 32);

          const imageData = ctx.getImageData(0, 0, 32, 32).data;
          let rSum = 0;
          let gSum = 0;
          let bSum = 0;
          let count = 0;

          // Bucket high-vibrancy pixels
          let bestVibrancy = -1;
          let vibrantR = 0;
          let vibrantG = 0;
          let vibrantB = 0;

          for (let i = 0; i < imageData.length; i += 16) {
            const r = imageData[i];
            const g = imageData[i + 1];
            const b = imageData[i + 2];
            const a = imageData[i + 3];

            if (a < 128) continue; // skip transparent

            rSum += r;
            gSum += g;
            bSum += b;
            count++;

            // Vibrancy = max - min color difference
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const delta = max - min;
            if (delta > bestVibrancy) {
              bestVibrancy = delta;
              vibrantR = r;
              vibrantG = g;
              vibrantB = b;
            }
          }

          if (count === 0) {
            resolve({
              primary: fallbackPrimary,
              secondary: fallbackSecondary,
              accent: '#ffffff',
              isExtracted: false,
            });
            return;
          }

          const avgR = Math.floor(rSum / count);
          const avgG = Math.floor(gSum / count);
          const avgB = Math.floor(bSum / count);

          const primary = `rgb(${avgR}, ${avgG}, ${avgB})`;
          const secondary =
            bestVibrancy > 30
              ? `rgb(${vibrantR}, ${vibrantG}, ${vibrantB})`
              : fallbackSecondary;
          const accent = `rgb(${Math.min(255, vibrantR + 50)}, ${Math.min(255, vibrantG + 50)}, ${Math.min(255, vibrantB + 50)})`;

          const result: ExtractedPalette = {
            primary,
            secondary,
            accent,
            isExtracted: true,
          };

          this.cache.set(imageUrl, result);
          resolve(result);
        } catch {
          resolve({
            primary: fallbackPrimary,
            secondary: fallbackSecondary,
            accent: '#ffffff',
            isExtracted: false,
          });
        }
      };

      img.onerror = () => {
        resolve({
          primary: fallbackPrimary,
          secondary: fallbackSecondary,
          accent: '#ffffff',
          isExtracted: false,
        });
      };

      img.src = imageUrl;
    });
  }
}

export class SpectrogramAnalyzer {
  private historySize = 250;
  private frequencyBins = 128;
  // Bounded ring buffer: each entry is a Float32Array of frequency amplitudes [0, 1]
  private history: Float32Array[] = [];
  private colorPalette: 'rainbow' | 'neon' | 'fire' | 'grayscale' | 'ocean' = 'rainbow';

  constructor(historySize = 250, frequencyBins = 128) {
    this.historySize = historySize;
    this.frequencyBins = frequencyBins;
  }

  public setHistorySize(size: number): void {
    this.historySize = Math.max(50, Math.min(500, size));
    while (this.history.length > this.historySize) {
      this.history.shift();
    }
  }

  public setPalette(palette: 'rainbow' | 'neon' | 'fire' | 'grayscale' | 'ocean'): void {
    this.colorPalette = palette;
  }

  /**
   * Pushes a new FFT frame into the rolling history buffer.
   */
  public pushFrame(rawFft: Uint8Array): void {
    if (!rawFft || rawFft.length === 0) return;

    const slice = new Float32Array(this.frequencyBins);
    const step = rawFft.length / this.frequencyBins;

    for (let i = 0; i < this.frequencyBins; i++) {
      const idx = Math.min(rawFft.length - 1, Math.floor(i * step));
      slice[i] = rawFft[idx] / 255.0;
    }

    this.history.push(slice);
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
  }

  /**
   * Renders the rolling 2D spectrogram directly onto the target 2D canvas context.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): void {
    if (this.history.length === 0) return;

    const sliceCount = this.history.length;
    const sliceWidth = width / this.historySize;
    const binHeight = height / this.frequencyBins;

    // Draw from left to right (oldest to newest)
    for (let s = 0; s < sliceCount; s++) {
      const x = s * sliceWidth;
      const slice = this.history[s];

      for (let b = 0; b < this.frequencyBins; b++) {
        // High frequencies at top, low frequencies at bottom
        const y = height - (b + 1) * binHeight;
        const val = slice[b];

        if (val > 0.02) {
          ctx.fillStyle = this.getColor(val);
          ctx.fillRect(x, y, sliceWidth + 0.5, binHeight + 0.5);
        }
      }
    }
  }

  private getColor(val: number): string {
    const v = Math.max(0, Math.min(1.0, val));

    switch (this.colorPalette) {
      case 'neon': {
        const r = Math.floor(v * 255);
        const g = Math.floor(Math.sin(v * Math.PI) * 230);
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
      }
      case 'fire': {
        const r = Math.min(255, Math.floor(v * 300));
        const g = Math.min(255, Math.floor(v * v * 255));
        const b = Math.floor(v * v * v * 80);
        return `rgb(${r}, ${g}, ${b})`;
      }
      case 'ocean': {
        const r = Math.floor(v * 40);
        const g = Math.floor(v * 180);
        const b = Math.floor(v * 255);
        return `rgb(${r}, ${g}, ${b})`;
      }
      case 'grayscale': {
        const c = Math.floor(v * 255);
        return `rgb(${c}, ${c}, ${c})`;
      }
      case 'rainbow':
      default: {
        const hue = Math.floor((1.0 - v) * 260); // 260 (purple/blue) down to 0 (red)
        const lightness = 20 + v * 60;
        return `hsl(${hue}, 100%, ${lightness}%)`;
      }
    }
  }

  public clear(): void {
    this.history = [];
  }

  public getHistory(): Float32Array[] {
    return [...this.history];
  }
}

import {
  FftWindowFunction,
  FrequencyScale,
  SpectrumData,
  VisualizerFftSize,
} from '../../types';

export class SpectrumAnalyzer {
  private fftSize: VisualizerFftSize = 2048;
  private windowFunction: FftWindowFunction = 'hann';
  private frequencyScale: FrequencyScale = 'logarithmic';
  private dbRange = 72; // -72 dB to 0 dB
  private sensitivity = 50;

  // Window weights lookup table
  private windowWeights: Float32Array = new Float32Array(0);

  // Peak hold arrays
  private peakHoldValues: number[] = new Array(64).fill(0);
  private peakHoldCounters: number[] = new Array(64).fill(0);
  private peakDecaySpeed = 3;

  constructor() {
    this.updateWindowTable();
  }

  public setFftSize(size: VisualizerFftSize): void {
    if (this.fftSize !== size) {
      this.fftSize = size;
      this.updateWindowTable();
    }
  }

  public setWindowFunction(fn: FftWindowFunction): void {
    if (this.windowFunction !== fn) {
      this.windowFunction = fn;
      this.updateWindowTable();
    }
  }

  public setFrequencyScale(scale: FrequencyScale): void {
    this.frequencyScale = scale;
  }

  public setDbRange(range: number): void {
    this.dbRange = Math.max(24, Math.min(120, range));
  }

  public setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(100, sensitivity));
  }

  public setPeakDecay(decay: number): void {
    this.peakDecaySpeed = Math.max(1, Math.min(10, decay));
  }

  private updateWindowTable(): void {
    const N = this.fftSize;
    this.windowWeights = new Float32Array(N);

    for (let i = 0; i < N; i++) {
      switch (this.windowFunction) {
        case 'hann':
          this.windowWeights[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
          break;
        case 'hamming':
          this.windowWeights[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
          break;
        case 'blackman':
          this.windowWeights[i] =
            0.42 -
            0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) +
            0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
          break;
        case 'rectangular':
        default:
          this.windowWeights[i] = 1.0;
          break;
      }
    }
  }

  /**
   * Applies the window function weights to raw time-domain PCM samples.
   */
  public applyWindow(samples: Float32Array): Float32Array {
    const out = new Float32Array(samples.length);
    const len = Math.min(samples.length, this.windowWeights.length);
    for (let i = 0; i < len; i++) {
      out[i] = samples[i] * this.windowWeights[i];
    }
    return out;
  }

  /**
   * Processes raw AnalyserNode frequency data into scaled display bands.
   */
  public processFrequencies(
    rawFft: Uint8Array,
    numBands: number,
    peakHold = true
  ): { bands: number[]; peaks: number[] } {
    if (!rawFft || rawFft.length === 0) {
      return {
        bands: new Array(numBands).fill(0),
        peaks: new Array(numBands).fill(0),
      };
    }

    const sensMultiplier = this.sensitivity / 50;
    const binCount = rawFft.length;
    const bands: number[] = new Array(numBands).fill(0);

    // Resize peak tracking arrays if needed
    if (this.peakHoldValues.length !== numBands) {
      this.peakHoldValues = new Array(numBands).fill(0);
      this.peakHoldCounters = new Array(numBands).fill(0);
    }

    // Silence detection: calculate total energy
    let totalEnergy = 0;
    for (let i = 0; i < binCount; i++) {
      totalEnergy += rawFft[i];
    }

    if (totalEnergy === 0) {
      // True silence - immediately drop all bands and decay peaks
      this.peakHoldValues.fill(0);
      return { bands, peaks: this.peakHoldValues };
    }

    if (this.frequencyScale === 'linear') {
      const step = binCount / numBands;
      for (let i = 0; i < numBands; i++) {
        const start = Math.floor(i * step);
        const end = Math.min(binCount, Math.floor((i + 1) * step));
        let sum = 0;
        let count = 0;
        for (let j = start; j < end; j++) {
          sum += rawFft[j];
          count++;
        }
        const avg = count > 0 ? sum / count : 0;
        bands[i] = Math.min(1.0, (avg / 255) * sensMultiplier);
      }
    } else if (this.frequencyScale === 'musical') {
      // Musical scale: map to 12 semi-tone octave intervals
      for (let i = 0; i < numBands; i++) {
        const noteFactor = i / numBands;
        const binIdx = Math.min(
          binCount - 1,
          Math.floor(Math.pow(2, noteFactor * 7) * (binCount / 128))
        );
        bands[i] = Math.min(1.0, (rawFft[binIdx] / 255) * sensMultiplier);
      }
    } else {
      // Logarithmic scale (default human hearing curve)
      const logMin = Math.log10(1);
      const logMax = Math.log10(binCount);

      for (let i = 0; i < numBands; i++) {
        const p1 = i / numBands;
        const p2 = (i + 1) / numBands;
        const start = Math.floor(Math.pow(10, logMin + p1 * (logMax - logMin)));
        const end = Math.min(
          binCount,
          Math.max(start + 1, Math.floor(Math.pow(10, logMin + p2 * (logMax - logMin))))
        );

        let sum = 0;
        let count = 0;
        for (let j = start; j < end; j++) {
          sum += rawFft[j];
          count++;
        }
        const avg = count > 0 ? sum / count : rawFft[start] || 0;
        bands[i] = Math.min(1.0, (avg / 255) * sensMultiplier);
      }
    }

    // Update peak hold
    if (peakHold) {
      const decayPerFrame = 0.005 * this.peakDecaySpeed;
      for (let i = 0; i < numBands; i++) {
        const val = bands[i];
        if (val >= this.peakHoldValues[i]) {
          this.peakHoldValues[i] = val;
          this.peakHoldCounters[i] = 0;
        } else {
          this.peakHoldCounters[i]++;
          // Hold for 12 frames, then fall smoothly
          if (this.peakHoldCounters[i] > 12) {
            this.peakHoldValues[i] = Math.max(0, this.peakHoldValues[i] - decayPerFrame);
          }
        }
      }
    } else {
      this.peakHoldValues = [...bands];
    }

    return {
      bands,
      peaks: [...this.peakHoldValues],
    };
  }

  /**
   * Backwards compatible 9-band extraction (60Hz to 16kHz).
   */
  public extract9Bands(rawFft: Uint8Array): number[] {
    if (!rawFft || rawFft.length === 0) {
      return [0, 0, 0, 0, 0, 0, 0, 0, 0];
    }

    const n = rawFft.length;
    const ranges = [
      [0, 1], // ~60Hz
      [1, 2], // ~120Hz
      [2, 4], // ~250Hz
      [4, 8], // ~500Hz
      [8, 16], // ~1000Hz
      [16, 32], // ~2000Hz
      [32, 64], // ~4000Hz
      [64, 128], // ~8000Hz
      [128, Math.min(n - 1, 220)], // ~16000Hz
    ];

    const sensMultiplier = this.sensitivity / 50;

    return ranges.map(([start, end]) => {
      let sum = 0;
      let count = 0;
      for (let i = start; i <= end && i < n; i++) {
        sum += rawFft[i];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      const normalized = (avg / 255) * sensMultiplier;
      return Math.max(0, Math.min(1.0, normalized));
    });
  }

  public reset(): void {
    this.peakHoldValues.fill(0);
    this.peakHoldCounters.fill(0);
  }
}

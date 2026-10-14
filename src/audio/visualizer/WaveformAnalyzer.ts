import { OscilloscopeConfig, WaveformData } from '../../types';

export class WaveformAnalyzer {
  private sensitivity = 50;
  private oscilloscopeConfig: OscilloscopeConfig = {
    triggerLevel: 0.0,
    triggerMode: 'auto',
    timeScale: 1.0,
    amplitudeScale: 1.0,
  };

  public setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(100, sensitivity));
  }

  public setOscilloscopeConfig(config: Partial<OscilloscopeConfig>): void {
    this.oscilloscopeConfig = { ...this.oscilloscopeConfig, ...config };
  }

  public getOscilloscopeConfig(): OscilloscopeConfig {
    return { ...this.oscilloscopeConfig };
  }

  /**
   * Finds the trigger index in time-domain data where signal crosses the trigger level.
   * Locks repeating waveforms to eliminate screen jitter.
   */
  public findTriggerOffset(samples: Float32Array): number {
    const { triggerMode, triggerLevel } = this.oscilloscopeConfig;
    if (triggerMode === 'off') return 0;

    const len = samples.length;
    const searchLimit = Math.min(len - 1, Math.floor(len * 0.4)); // Search first 40% of buffer

    if (triggerMode === 'rising' || triggerMode === 'auto') {
      for (let i = 0; i < searchLimit; i++) {
        if (samples[i] <= triggerLevel && samples[i + 1] > triggerLevel) {
          return i;
        }
      }
    } else if (triggerMode === 'falling') {
      for (let i = 0; i < searchLimit; i++) {
        if (samples[i] >= triggerLevel && samples[i + 1] < triggerLevel) {
          return i;
        }
      }
    }

    // Auto trigger falls back to index 0 if no edge found
    return 0;
  }

  /**
   * Normalizes byte time-domain data (0..255) to float [-1.0, +1.0].
   */
  public byteToFloat(byteBuffer: Uint8Array): Float32Array {
    const len = byteBuffer.length;
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = (byteBuffer[i] - 128) / 128;
    }
    return out;
  }

  /**
   * Checks if the time-domain buffer is essentially silent.
   */
  public isSilent(samples: Float32Array, threshold = 0.002): boolean {
    const len = samples.length;
    let maxAmp = 0;
    for (let i = 0; i < len; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxAmp) maxAmp = abs;
      if (maxAmp > threshold) return false;
    }
    return true;
  }

  /**
   * Extracts aligned waveform for display with trigger stabilization.
   */
  public getAlignedWaveform(
    samples: Float32Array,
    outputLength: number
  ): Float32Array {
    if (this.isSilent(samples)) {
      return new Float32Array(outputLength); // Flat line on silence
    }

    const triggerIdx = this.findTriggerOffset(samples);
    const result = new Float32Array(outputLength);
    const available = samples.length - triggerIdx;
    const step = (available * (1.0 / this.oscilloscopeConfig.timeScale)) / outputLength;
    const ampMultiplier = (this.sensitivity / 50) * this.oscilloscopeConfig.amplitudeScale;

    for (let i = 0; i < outputLength; i++) {
      const srcIdx = Math.min(samples.length - 1, triggerIdx + Math.floor(i * step));
      result[i] = Math.max(-1.0, Math.min(1.0, samples[srcIdx] * ampMultiplier));
    }

    return result;
  }
}

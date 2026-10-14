import { BeatData } from '../../types';

export class BeatDetector {
  private prevLowSpectrum: Float32Array = new Float32Array(32);
  private fluxHistory: number[] = new Array(30).fill(0);
  private fluxIdx = 0;
  private currentEnergy = 0;
  private lastBeatTime = 0;
  private decayRate = 0.92; // Decay factor per frame

  /**
   * Analyzes raw FFT magnitudes to detect rhythmic energy spikes.
   * Focuses strictly on sub-bass and bass frequency bins (20Hz to 250Hz).
   */
  public detect(rawFft: Uint8Array, nowMs = Date.now()): BeatData {
    if (!rawFft || rawFft.length === 0) {
      return { isBeat: false, energy: 0, decay: 0, confidence: 0 };
    }

    // Inspect first 24-32 bins (bass region)
    const numBins = Math.min(32, Math.floor(rawFft.length * 0.15));
    let totalBass = 0;
    let spectralFlux = 0;

    for (let i = 0; i < numBins; i++) {
      const val = rawFft[i] / 255.0;
      totalBass += val;

      const diff = val - this.prevLowSpectrum[i];
      if (diff > 0) {
        spectralFlux += diff;
      }
      this.prevLowSpectrum[i] = val;
    }

    // Silence detection: if bass energy is zero, clear state
    if (totalBass < 0.05) {
      this.currentEnergy *= 0.8;
      if (this.currentEnergy < 0.01) this.currentEnergy = 0;
      return { isBeat: false, energy: 0, decay: this.currentEnergy, confidence: 0 };
    }

    // Sliding average of spectral flux
    this.fluxHistory[this.fluxIdx] = spectralFlux;
    this.fluxIdx = (this.fluxIdx + 1) % this.fluxHistory.length;

    let fluxSum = 0;
    for (let i = 0; i < this.fluxHistory.length; i++) {
      fluxSum += this.fluxHistory[i];
    }
    const meanFlux = fluxSum / this.fluxHistory.length;

    // Variance
    let varSum = 0;
    for (let i = 0; i < this.fluxHistory.length; i++) {
      const d = this.fluxHistory[i] - meanFlux;
      varSum += d * d;
    }
    const stdDev = Math.sqrt(varSum / this.fluxHistory.length);

    // Dynamic threshold: mean + 1.3 * stdDev
    const threshold = meanFlux + 1.3 * stdDev;
    const timeSinceLastBeat = nowMs - this.lastBeatTime;

    let isBeat = false;
    let confidence = 0;

    // Minimum interval between beats (180ms ~ 333 BPM max) to prevent false triggering
    if (spectralFlux > threshold && spectralFlux > 0.15 && timeSinceLastBeat > 180) {
      isBeat = true;
      this.lastBeatTime = nowMs;
      this.currentEnergy = 1.0;
      confidence = Math.min(1.0, (spectralFlux - threshold) / (stdDev + 0.1));
    } else {
      this.currentEnergy *= this.decayRate;
      if (this.currentEnergy < 0.005) this.currentEnergy = 0;
    }

    return {
      isBeat,
      energy: isBeat ? 1.0 : this.currentEnergy,
      decay: this.currentEnergy,
      confidence,
    };
  }

  public reset(): void {
    this.prevLowSpectrum.fill(0);
    this.fluxHistory.fill(0);
    this.currentEnergy = 0;
    this.lastBeatTime = 0;
  }
}

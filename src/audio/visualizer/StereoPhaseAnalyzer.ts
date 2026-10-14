import { StereoData } from '../../types';

export class StereoPhaseAnalyzer {
  private sensitivity = 50;
  private dbRange = 72; // -72dB to 0dB

  public setSensitivity(sensitivity: number): void {
    this.sensitivity = Math.max(0, Math.min(100, sensitivity));
  }

  public setDbRange(range: number): void {
    this.dbRange = Math.max(24, Math.min(120, range));
  }

  /**
   * Computes comprehensive stereo metrics from Left and Right PCM time-domain signals.
   */
  public analyzeStereo(leftPcm: Float32Array, rightPcm: Float32Array): StereoData {
    const len = Math.min(leftPcm.length, rightPcm.length);
    if (len === 0) {
      return {
        leftLevel: 0,
        rightLevel: 0,
        leftDb: -this.dbRange,
        rightDb: -this.dbRange,
        balance: 0,
        width: 0,
        correlation: 1.0,
      };
    }

    let leftSumSquares = 0;
    let rightSumSquares = 0;
    let dotProduct = 0;
    let leftPeak = 0;
    let rightPeak = 0;

    for (let i = 0; i < len; i++) {
      const l = leftPcm[i];
      const r = rightPcm[i];

      const absL = Math.abs(l);
      const absR = Math.abs(r);

      if (absL > leftPeak) leftPeak = absL;
      if (absR > rightPeak) rightPeak = absR;

      leftSumSquares += l * l;
      rightSumSquares += r * r;
      dotProduct += l * r;
    }

    const leftRms = Math.sqrt(leftSumSquares / len);
    const rightRms = Math.sqrt(rightSumSquares / len);

    // Pearson Correlation coefficient: -1 (phase-inverted) to +1 (mono correlated)
    const normL = Math.sqrt(leftSumSquares);
    const normR = Math.sqrt(rightSumSquares);
    const denom = normL * normR;

    let correlation = 1.0;
    if (denom > 1e-7) {
      correlation = Math.max(-1.0, Math.min(1.0, dotProduct / denom));
    } else {
      correlation = 0.0; // Silence or zero energy
    }

    // Convert RMS to dBFS
    const leftDb = leftRms > 1e-5 ? Math.max(-this.dbRange, 20 * Math.log10(leftRms)) : -this.dbRange;
    const rightDb = rightRms > 1e-5 ? Math.max(-this.dbRange, 20 * Math.log10(rightRms)) : -this.dbRange;

    // Stereo Balance (-1 left, +1 right)
    let balance = 0;
    if (leftRms + rightRms > 1e-5) {
      balance = (rightRms - leftRms) / (rightRms + leftRms);
    }

    // Stereo Width: (0 = mono, 1 = maximum wide stereo)
    const width = Math.max(0, Math.min(1.0, 1.0 - Math.max(0, correlation)));

    const sens = this.sensitivity / 50;

    return {
      leftLevel: Math.min(1.0, leftRms * sens),
      rightLevel: Math.min(1.0, rightRms * sens),
      leftDb,
      rightDb,
      balance: Math.max(-1.0, Math.min(1.0, balance)),
      width,
      correlation,
    };
  }

  /**
   * Computes Lissajous / Goniometer XY points for stereo field visualization.
   * X represents Side (L - R) / sqrt(2)
   * Y represents Mid (L + R) / sqrt(2)
   */
  public computeGoniometerPoints(
    leftPcm: Float32Array,
    rightPcm: Float32Array,
    maxPoints = 256
  ): { x: number; y: number }[] {
    const len = Math.min(leftPcm.length, rightPcm.length);
    const step = Math.max(1, Math.floor(len / maxPoints));
    const points: { x: number; y: number }[] = [];
    const sens = this.sensitivity / 50;
    const invSqrt2 = 0.70710678;

    for (let i = 0; i < len; i += step) {
      const l = leftPcm[i] * sens;
      const r = rightPcm[i] * sens;

      // Rotate 45 degrees: Mid / Side representation
      const side = (r - l) * invSqrt2;
      const mid = (l + r) * invSqrt2;

      points.push({
        x: Math.max(-1.0, Math.min(1.0, side)),
        y: Math.max(-1.0, Math.min(1.0, mid)),
      });
    }

    return points;
  }
}

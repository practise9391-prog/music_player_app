import {
  DEFAULT_VISUALIZER_SETTINGS,
  AnalysisTapSource,
  BeatData,
  FftWindowFunction,
  FrequencyScale,
  OscilloscopeConfig,
  PauseBehavior,
  SpectrumData,
  StereoData,
  Track,
  VisualizerColorMode,
  VisualizerDiagnostics,
  VisualizerFftSize,
  VisualizerFps,
  VisualizerMode,
  VisualizerPreset,
  VisualizerQuality,
  VisualizerSettings,
  WaveformData,
} from '../types';
import { AudioAnalysisTap } from './AudioAnalysisTap';
import { SpectrumAnalyzer } from './visualizer/SpectrumAnalyzer';
import { WaveformAnalyzer } from './visualizer/WaveformAnalyzer';
import { SpectrogramAnalyzer } from './visualizer/SpectrogramAnalyzer';
import { StereoPhaseAnalyzer } from './visualizer/StereoPhaseAnalyzer';
import { BeatDetector } from './visualizer/BeatDetector';
import { ParticleSystem } from './visualizer/ParticleSystem';
import { ColorExtractor, ExtractedPalette } from './visualizer/ColorExtractor';

export class VisualizerEngine {
  // Web Audio Analysers
  private masterAnalyser: AnalyserNode | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;
  private analysisTap: AudioAnalysisTap | null = null;

  // Canvas
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  // Sub-modules
  public readonly spectrumAnalyzer = new SpectrumAnalyzer();
  public readonly waveformAnalyzer = new WaveformAnalyzer();
  public readonly spectrogramAnalyzer = new SpectrogramAnalyzer();
  public readonly stereoAnalyzer = new StereoPhaseAnalyzer();
  public readonly beatDetector = new BeatDetector();
  public readonly particleSystem = new ParticleSystem(150);

  // Current Settings
  private settings: VisualizerSettings = { ...DEFAULT_VISUALIZER_SETTINGS };

  // Reusable Data Buffers (pre-allocated to avoid GC churn)
  private masterFftBuffer: Uint8Array = new Uint8Array(1024);
  private masterTimeBuffer: Uint8Array = new Uint8Array(2048);
  private leftTimeBuffer: Uint8Array = new Uint8Array(2048);
  private rightTimeBuffer: Uint8Array = new Uint8Array(2048);
  private leftFloatBuffer: Float32Array = new Float32Array(2048);
  private rightFloatBuffer: Float32Array = new Float32Array(2048);
  private masterFloatBuffer: Float32Array = new Float32Array(2048);

  // Colors & Album Art State
  private primaryColor = '#00e5ff';
  private secondaryColor = '#8000ff';
  private accentColor = '#ffffff';
  private albumArtPalette: ExtractedPalette | null = null;
  private albumArtImage: HTMLImageElement | null = null;
  private currentTrack: Track | null = null;

  // Animation & Throttling
  private lastFrameTime = 0;
  private isRunning = false;
  private isPaused = false;
  private frameCount = 0;
  private fpsCounter = 60;
  private lastFpsCalcTime = 0;
  private droppedFrames = 0;

  constructor() {
    this.applySettingsToAnalyzers();
  }

  // --- Analyser & Tap Configuration ---

  public setAnalyser(
    masterNode: AnalyserNode | null,
    leftNode: AnalyserNode | null = null,
    rightNode: AnalyserNode | null = null
  ): void {
    this.masterAnalyser = masterNode;
    this.leftAnalyser = leftNode;
    this.rightAnalyser = rightNode;

    if (this.masterAnalyser) {
      this.masterAnalyser.fftSize = this.settings.fftSize;
      this.masterAnalyser.smoothingTimeConstant = Math.min(0.99, this.settings.smoothing / 100);
      this.resizeBuffers();
    }
  }

  public setAnalysisTap(tap: AudioAnalysisTap): void {
    this.analysisTap = tap;
    if (this.analysisTap) {
      this.setAnalyser(
        this.analysisTap.getMasterAnalyser(),
        this.analysisTap.getLeftAnalyser(),
        this.analysisTap.getRightAnalyser()
      );
    }
  }

  private resizeBuffers(): void {
    const binCount = this.masterAnalyser ? this.masterAnalyser.frequencyBinCount : 1024;
    const fftSize = this.masterAnalyser ? this.masterAnalyser.fftSize : 2048;

    this.masterFftBuffer = new Uint8Array(binCount);
    this.masterTimeBuffer = new Uint8Array(fftSize);
    this.leftTimeBuffer = new Uint8Array(fftSize);
    this.rightTimeBuffer = new Uint8Array(fftSize);
    this.masterFloatBuffer = new Float32Array(fftSize);
    this.leftFloatBuffer = new Float32Array(fftSize);
    this.rightFloatBuffer = new Float32Array(fftSize);
  }

  // --- Canvas Lifecycle ---

  public attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (canvas.width > 0 && canvas.height > 0) {
      this.particleSystem.resize(canvas.width, canvas.height);
    }
    if (!this.isRunning) {
      this.start();
    }
  }

  public detach(): void {
    this.stop();
    this.canvas = null;
    this.ctx = null;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastFrameTime = performance.now();
    this.renderLoop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public pause(): void {
    this.isPaused = true;
    if (this.settings.pauseBehavior === 'stop') {
      this.clearCanvas();
    }
  }

  public reset(): void {
    this.spectrumAnalyzer.reset();
    this.beatDetector.reset();
    this.spectrogramAnalyzer.clear();
    this.particleSystem.reset();
    this.clearCanvas();
  }

  private clearCanvas(): void {
    if (this.canvas && this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // --- Visualizer Settings Mutators ---

  public setMode(mode: VisualizerMode): void {
    this.settings.mode = mode;
  }

  public setFFTSize(size: VisualizerFftSize): void {
    this.settings.fftSize = size;
    if (this.masterAnalyser) this.masterAnalyser.fftSize = size;
    if (this.leftAnalyser) this.leftAnalyser.fftSize = size;
    if (this.rightAnalyser) this.rightAnalyser.fftSize = size;
    if (this.analysisTap) this.analysisTap.setFftSize(size);
    this.spectrumAnalyzer.setFftSize(size);
    this.resizeBuffers();
  }

  public setWindowFunction(fn: FftWindowFunction): void {
    this.settings.windowFunction = fn;
    this.spectrumAnalyzer.setWindowFunction(fn);
  }

  public setFrequencyScale(scale: FrequencyScale): void {
    this.settings.frequencyScale = scale;
    this.spectrumAnalyzer.setFrequencyScale(scale);
  }

  public setQuality(quality: VisualizerQuality): void {
    this.settings.quality = quality;
    switch (quality) {
      case 'low':
        this.setFFTSize(512);
        this.particleSystem.setParticleCount(60);
        break;
      case 'medium':
        this.setFFTSize(1024);
        this.particleSystem.setParticleCount(120);
        break;
      case 'high':
        this.setFFTSize(2048);
        this.particleSystem.setParticleCount(200);
        break;
      case 'ultra':
        this.setFFTSize(4096);
        this.particleSystem.setParticleCount(300);
        break;
    }
  }

  public setFps(fps: VisualizerFps): void {
    this.settings.fps = fps;
  }

  public setFrameRate(fps: VisualizerFps): void {
    this.setFps(fps);
  }

  public setSensitivity(sensitivity: number): void {
    this.settings.sensitivity = Math.max(0, Math.min(100, sensitivity));
    this.spectrumAnalyzer.setSensitivity(this.settings.sensitivity);
    this.waveformAnalyzer.setSensitivity(this.settings.sensitivity);
    this.stereoAnalyzer.setSensitivity(this.settings.sensitivity);
  }

  public setSmoothing(smoothing: number): void {
    this.settings.smoothing = Math.max(0, Math.min(100, smoothing));
    const factor = Math.min(0.99, this.settings.smoothing / 100);
    if (this.masterAnalyser) this.masterAnalyser.smoothingTimeConstant = factor;
    if (this.leftAnalyser) this.leftAnalyser.smoothingTimeConstant = factor;
    if (this.rightAnalyser) this.rightAnalyser.smoothingTimeConstant = factor;
    if (this.analysisTap) this.analysisTap.setSmoothing(this.settings.smoothing);
  }

  public setColorMode(mode: VisualizerColorMode): void {
    this.settings.colorMode = mode;
  }

  public setMirror(enabled: boolean): void {
    this.settings.mirror = enabled;
  }

  public setStereoMode(enabled: boolean): void {
    this.settings.stereoMode = enabled;
  }

  public setParticleCount(count: number): void {
    this.settings.particleCount = count;
    this.particleSystem.setParticleCount(count);
  }

  public setOscilloscopeConfig(config: Partial<OscilloscopeConfig>): void {
    this.waveformAnalyzer.setOscilloscopeConfig(config);
  }

  public setColors(primary: string, secondary = '#8000ff', accent = '#ffffff'): void {
    this.primaryColor = primary;
    this.secondaryColor = secondary;
    this.accentColor = accent;
  }

  public setTrackMetadata(track: Track | null): void {
    this.currentTrack = track;
    if (track?.coverArtUrl) {
      ColorExtractor.extractFromImage(track.coverArtUrl, this.primaryColor, this.secondaryColor).then(
        (palette) => {
          this.albumArtPalette = palette;
        }
      );
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = track.coverArtUrl;
        img.onload = () => {
          this.albumArtImage = img;
        };
      }
    } else {
      this.albumArtPalette = null;
      this.albumArtImage = null;
    }
  }

  public loadPreset(preset: VisualizerPreset): void {
    this.updateSettings(preset.settings);
  }

  public updateSettings(newSettings: Partial<VisualizerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.fftSize !== undefined) this.setFFTSize(newSettings.fftSize);
    if (newSettings.windowFunction !== undefined) this.setWindowFunction(newSettings.windowFunction);
    if (newSettings.frequencyScale !== undefined) this.setFrequencyScale(newSettings.frequencyScale);
    if (newSettings.sensitivity !== undefined) this.setSensitivity(newSettings.sensitivity);
    if (newSettings.smoothing !== undefined) this.setSmoothing(newSettings.smoothing);
    if (newSettings.quality !== undefined) this.setQuality(newSettings.quality);
    if (newSettings.particleCount !== undefined) this.setParticleCount(newSettings.particleCount);
    if (newSettings.analysisTap !== undefined && this.analysisTap) {
      this.analysisTap.setSource(newSettings.analysisTap);
    }
    this.applySettingsToAnalyzers();
  }

  private applySettingsToAnalyzers(): void {
    this.spectrumAnalyzer.setFftSize(this.settings.fftSize);
    this.spectrumAnalyzer.setWindowFunction(this.settings.windowFunction);
    this.spectrumAnalyzer.setFrequencyScale(this.settings.frequencyScale);
    this.spectrumAnalyzer.setSensitivity(this.settings.sensitivity);
    this.spectrumAnalyzer.setDbRange(this.settings.dbRange);
    this.spectrumAnalyzer.setPeakDecay(this.settings.peakDecaySpeed);

    this.waveformAnalyzer.setSensitivity(this.settings.sensitivity);
    this.stereoAnalyzer.setSensitivity(this.settings.sensitivity);
    this.stereoAnalyzer.setDbRange(this.settings.dbRange);
    this.particleSystem.setParticleCount(this.settings.particleCount);
    this.spectrogramAnalyzer.setHistorySize(this.settings.spectrogramHistory);
  }

  public getSettings(): VisualizerSettings {
    return { ...this.settings };
  }

  // --- Real Audio Analysis Queries ---

  public getFrequencyData(): SpectrumData {
    this.sampleAudioData();
    const result = this.spectrumAnalyzer.processFrequencies(
      this.masterFftBuffer,
      32,
      this.settings.peakHold
    );
    const bands9 = this.spectrumAnalyzer.extract9Bands(this.masterFftBuffer);

    return {
      bands: bands9,
      rawFft: this.masterFftBuffer,
      frequencies: this.masterFloatBuffer,
      peaks: result.peaks,
    };
  }

  public getWaveformData(): WaveformData {
    this.sampleAudioData();
    return {
      timeDomain: this.masterTimeBuffer,
      floatTimeDomain: this.masterFloatBuffer,
      leftTimeDomain: this.leftFloatBuffer,
      rightTimeDomain: this.rightFloatBuffer,
    };
  }

  public getPeakData(): { peak: number; rms: number; peakDb: number; rmsDb: number } {
    this.sampleAudioData();
    let peak = 0;
    let sumSquares = 0;
    const len = this.masterFloatBuffer.length;

    for (let i = 0; i < len; i++) {
      const absVal = Math.abs(this.masterFloatBuffer[i]);
      if (absVal > peak) peak = absVal;
      sumSquares += absVal * absVal;
    }

    const rms = Math.sqrt(sumSquares / Math.max(1, len));
    const sensMultiplier = this.settings.sensitivity / 50;
    const normPeak = Math.min(1.0, peak * sensMultiplier);
    const normRms = Math.min(1.0, rms * sensMultiplier);

    const peakDb = normPeak > 1e-4 ? 20 * Math.log10(normPeak) : -this.settings.dbRange;
    const rmsDb = normRms > 1e-4 ? 20 * Math.log10(normRms) : -this.settings.dbRange;

    return {
      peak: normPeak,
      rms: normRms,
      peakDb: Math.max(-this.settings.dbRange, Math.min(0, peakDb)),
      rmsDb: Math.max(-this.settings.dbRange, Math.min(0, rmsDb)),
    };
  }

  public getRMSData(): {
    leftRms: number;
    rightRms: number;
    combinedRms: number;
    leftRmsDb: number;
    rightRmsDb: number;
  } {
    const stereo = this.getStereoData();
    const peak = this.getPeakData();
    return {
      leftRms: stereo.leftLevel,
      rightRms: stereo.rightLevel,
      combinedRms: peak.rms,
      leftRmsDb: stereo.leftDb,
      rightRmsDb: stereo.rightDb,
    };
  }

  public getStereoData(): StereoData {
    this.sampleAudioData();
    // If left/right analysers exist, use them; otherwise use master split
    const leftPcm = this.leftAnalyser ? this.leftFloatBuffer : this.masterFloatBuffer;
    const rightPcm = this.rightAnalyser ? this.rightFloatBuffer : this.masterFloatBuffer;
    return this.stereoAnalyzer.analyzeStereo(leftPcm, rightPcm);
  }

  public getPhaseData(): { correlation: number; width: number; balance: number } {
    const stereo = this.getStereoData();
    return {
      correlation: stereo.correlation,
      width: stereo.width,
      balance: stereo.balance,
    };
  }

  public getSpectrogramData(): { history: Float32Array[] } {
    return { history: this.spectrogramAnalyzer.getHistory() };
  }

  public getBeatData(): BeatData {
    this.sampleAudioData();
    return this.beatDetector.detect(this.masterFftBuffer);
  }

  public getDiagnostics(): VisualizerDiagnostics {
    const isSilent = this.waveformAnalyzer.isSilent(this.masterFloatBuffer);
    const stereo = this.getStereoData();

    return {
      fps: this.fpsCounter,
      frameTimeMs: performance.now() - this.lastFrameTime,
      droppedFrames: this.droppedFrames,
      activeMode: this.settings.mode,
      fftResolution: this.settings.fftSize,
      particleCount: this.settings.particleCount,
      tapSource: this.settings.analysisTap,
      isSilent,
      leftPeakDb: stereo.leftDb,
      rightPeakDb: stereo.rightDb,
    };
  }

  public extract9Bands(fftArray: Uint8Array): number[] {
    return this.spectrumAnalyzer.extract9Bands(fftArray);
  }

  // --- Internal Audio Sampling ---

  private sampleAudioData(): void {
    if (this.masterAnalyser) {
      this.masterAnalyser.getByteFrequencyData(this.masterFftBuffer as any);
      this.masterAnalyser.getByteTimeDomainData(this.masterTimeBuffer as any);
      // Normalized Float PCM [-1.0, +1.0]
      for (let i = 0; i < this.masterTimeBuffer.length; i++) {
        this.masterFloatBuffer[i] = (this.masterTimeBuffer[i] - 128) / 128;
      }
    }

    if (this.leftAnalyser) {
      this.leftAnalyser.getByteTimeDomainData(this.leftTimeBuffer as any);
      for (let i = 0; i < this.leftTimeBuffer.length; i++) {
        this.leftFloatBuffer[i] = (this.leftTimeBuffer[i] - 128) / 128;
      }
    } else {
      this.leftFloatBuffer.set(this.masterFloatBuffer);
    }

    if (this.rightAnalyser) {
      this.rightAnalyser.getByteTimeDomainData(this.rightTimeBuffer as any);
      for (let i = 0; i < this.rightTimeBuffer.length; i++) {
        this.rightFloatBuffer[i] = (this.rightTimeBuffer[i] - 128) / 128;
      }
    } else {
      this.rightFloatBuffer.set(this.masterFloatBuffer);
    }
  }

  // --- Decoupled Render Loop ---

  private renderLoop = (time = performance.now()): void => {
    if (!this.isRunning) return;

    // Determine target frame interval in ms
    let targetInterval = 16.6; // 60 FPS default
    if (this.settings.fps === 'low' || this.settings.fps === 30) targetInterval = 33.3;
    else if (this.settings.fps === 'medium' || this.settings.fps === 60) targetInterval = 16.6;
    else if (this.settings.fps === 'high' || this.settings.fps === 120) targetInterval = 8.33;
    else if (this.settings.fps === 'ultra' || this.settings.fps === 'auto') targetInterval = 0;

    const delta = time - this.lastFrameTime;
    if (targetInterval > 0 && delta < targetInterval) {
      this.animationFrameId = requestAnimationFrame(this.renderLoop);
      return;
    }

    // Diagnostics calculation
    this.frameCount++;
    if (time - this.lastFpsCalcTime >= 1000) {
      this.fpsCounter = this.frameCount;
      this.frameCount = 0;
      this.lastFpsCalcTime = time;
    }

    if (targetInterval > 0 && delta > targetInterval * 2) {
      this.droppedFrames++;
    }

    this.lastFrameTime = time;

    // Render current frame safely
    try {
      this.renderFrame();
    } catch (err) {
      // Audio safety: rendering errors must never disrupt playback
      console.warn('[VisualizerEngine] Render error safely caught:', err);
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.renderLoop);
    }
  };

  // --- Primary Frame Renderer ---

  public renderFrame(): void {
    if (!this.canvas || !this.ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;
    if (width === 0 || height === 0) return;

    // Pause handling
    if (this.isPaused) {
      if (this.settings.pauseBehavior === 'freeze') {
        return; // Hold frame intact
      } else if (this.settings.pauseBehavior === 'fade') {
        this.ctx.fillStyle = 'rgba(2, 6, 23, 0.08)';
        this.ctx.fillRect(0, 0, width, height);
        return;
      } else if (this.settings.pauseBehavior === 'stop') {
        this.ctx.clearRect(0, 0, width, height);
        return;
      }
    }

    // Clear background
    const bgOpacity = this.settings.backgroundOpacity / 100;
    if (bgOpacity < 1.0) {
      this.ctx.fillStyle = `rgba(2, 6, 23, ${bgOpacity})`;
      this.ctx.fillRect(0, 0, width, height);
    } else {
      this.ctx.clearRect(0, 0, width, height);
    }

    if (this.settings.mode === 'off' || !this.settings.enabled) {
      return;
    }

    // Sample real audio
    this.sampleAudioData();

    // Active colors based on ColorMode
    const { primary, secondary, accent } = this.resolveActiveColors();

    // Check silence
    const isSilent = this.waveformAnalyzer.isSilent(this.masterFloatBuffer);

    // Update Spectrogram buffer
    if (this.settings.mode === 'spectrogram') {
      this.spectrogramAnalyzer.pushFrame(this.masterFftBuffer);
    }

    // Dispatch to selected renderer
    switch (this.settings.mode) {
      case 'waveform':
        this.renderWaveform(width, height, primary);
        break;
      case 'oscilloscope':
        this.renderOscilloscope(width, height, primary);
        break;
      case 'bars':
        this.renderDenseBars(width, height, primary, secondary);
        break;
      case 'smooth_spectrum':
        this.renderSmoothSpectrum(width, height, primary, secondary);
        break;
      case 'circle':
        this.renderCircularSpectrum(width, height, primary, secondary);
        break;
      case 'radial_spectrum':
        this.renderRadialSpectrum(width, height, primary, secondary);
        break;
      case 'spectrogram':
        this.renderSpectrogram(width, height);
        break;
      case 'peak_meter':
        this.renderPeakMeter(width, height, primary);
        break;
      case 'rms_meter':
        this.renderRmsMeter(width, height, primary, secondary);
        break;
      case 'stereo_field':
        this.renderStereoField(width, height, primary);
        break;
      case 'phase_meter':
        this.renderPhaseMeter(width, height, primary);
        break;
      case 'album_art':
        this.renderAlbumArtReactive(width, height, primary, secondary, isSilent);
        break;
      case 'particles':
        this.renderParticles(width, height, primary, secondary, isSilent);
        break;
      case 'minimal':
        this.renderMinimal(width, height, primary);
        break;
      case 'spectrum':
      default:
        this.renderClassicSpectrum(width, height, primary, secondary);
        break;
    }
  }

  private resolveActiveColors(): { primary: string; secondary: string; accent: string } {
    if (this.settings.colorMode === 'album_art' && this.albumArtPalette?.isExtracted) {
      return {
        primary: this.albumArtPalette.primary,
        secondary: this.albumArtPalette.secondary,
        accent: this.albumArtPalette.accent,
      };
    }
    if (this.settings.colorMode === 'neon') {
      return { primary: '#00ffff', secondary: '#ff00ff', accent: '#ffff00' };
    }
    if (this.settings.colorMode === 'monochrome') {
      return { primary: '#e2e8f0', secondary: '#94a3b8', accent: '#ffffff' };
    }
    if (this.settings.colorMode === 'custom') {
      return {
        primary: this.settings.customColor,
        secondary: this.settings.customSecondaryColor,
        accent: '#ffffff',
      };
    }
    return {
      primary: this.primaryColor,
      secondary: this.secondaryColor,
      accent: this.accentColor,
    };
  }

  // --- Rendering Modes Implementation ---

  // 1. Classic 32-Bar Spectrum with Peak Hold
  private renderClassicSpectrum(
    width: number,
    height: number,
    primary: string,
    secondary: string
  ): void {
    if (!this.ctx) return;
    const numBars = 32;
    const { bands, peaks } = this.spectrumAnalyzer.processFrequencies(
      this.masterFftBuffer,
      numBars,
      this.settings.peakHold
    );

    const gap = 3;
    const barWidth = Math.max(2, (width - (numBars - 1) * gap) / numBars);

    const grad = this.ctx.createLinearGradient(0, height, 0, 0);
    grad.addColorStop(0, primary);
    grad.addColorStop(1, secondary);

    for (let i = 0; i < numBars; i++) {
      const val = bands[i];
      const barHeight = Math.max(2, val * height * 0.92);
      const x = i * (barWidth + gap);
      const y = height - barHeight;

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
      this.ctx.fill();

      if (this.settings.peakHold) {
        const peakVal = peaks[i] || 0;
        const peakY = height - Math.max(2, peakVal * height * 0.92);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x, peakY - 2, barWidth, 2);
      }
    }
  }

  // 2. Smooth Continuous Spectrum Curve with Gradient Fill
  private renderSmoothSpectrum(
    width: number,
    height: number,
    primary: string,
    secondary: string
  ): void {
    if (!this.ctx) return;
    const numPoints = 64;
    const { bands } = this.spectrumAnalyzer.processFrequencies(
      this.masterFftBuffer,
      numPoints,
      false
    );

    const grad = this.ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, `${primary}99`);
    grad.addColorStop(1, `${secondary}11`);

    this.ctx.beginPath();
    this.ctx.moveTo(0, height);

    const step = width / (numPoints - 1);
    for (let i = 0; i < numPoints; i++) {
      const x = i * step;
      const y = height - Math.max(3, bands[i] * height * 0.88);
      if (i === 0) {
        this.ctx.lineTo(x, y);
      } else {
        const prevX = (i - 1) * step;
        const prevY = height - Math.max(3, bands[i - 1] * height * 0.88);
        const midX = (prevX + x) / 2;
        const midY = (prevY + y) / 2;
        this.ctx.quadraticCurveTo(prevX, prevY, midX, midY);
      }
    }

    this.ctx.lineTo(width, height);
    this.ctx.closePath();

    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Top crisp curve line
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = primary;
    this.ctx.stroke();
  }

  // 3. Dense High-Resolution FFT Bars
  private renderDenseBars(
    width: number,
    height: number,
    primary: string,
    secondary: string
  ): void {
    if (!this.ctx) return;
    const numBars = 64;
    const { bands } = this.spectrumAnalyzer.processFrequencies(
      this.masterFftBuffer,
      numBars,
      false
    );
    const barWidth = Math.max(1, width / numBars - 1.5);

    for (let i = 0; i < numBars; i++) {
      const val = bands[i];
      const barHeight = Math.max(1, val * height * 0.9);
      const x = i * (barWidth + 1.5);
      const y = height - barHeight;

      this.ctx.fillStyle = i % 2 === 0 ? primary : secondary;
      this.ctx.fillRect(x, y, barWidth, barHeight);
    }
  }

  // 4. Standard Anti-Aliased PCM Waveform
  private renderWaveform(width: number, height: number, primary: string): void {
    if (!this.ctx) return;
    const samples = this.waveformAnalyzer.getAlignedWaveform(this.masterFloatBuffer, 256);
    const len = samples.length;

    this.ctx.lineWidth = 2.0;
    this.ctx.strokeStyle = primary;
    this.ctx.shadowBlur = 8;
    this.ctx.shadowColor = primary;

    this.ctx.beginPath();
    const sliceWidth = width / len;
    let x = 0;

    for (let i = 0; i < len; i++) {
      const y = height / 2 + samples[i] * (height / 2) * 0.85;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
      x += sliceWidth;
    }

    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  // 5. Laboratory Trigger-Stabilized Oscilloscope with Graticule Grid
  private renderOscilloscope(width: number, height: number, primary: string): void {
    if (!this.ctx) return;

    // Draw Oscilloscope Grid / Graticule
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;

    const vDivs = 8;
    const hDivs = 6;
    for (let i = 1; i < vDivs; i++) {
      const x = (i * width) / vDivs;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    for (let i = 1; i < hDivs; i++) {
      const y = (i * height) / hDivs;
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    // Center Crosshair
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    this.ctx.beginPath();
    this.ctx.moveTo(0, height / 2);
    this.ctx.lineTo(width, height / 2);
    this.ctx.moveTo(width / 2, 0);
    this.ctx.lineTo(width / 2, height);
    this.ctx.stroke();

    // Render stabilized waveform trace with phosphor glow
    const samples = this.waveformAnalyzer.getAlignedWaveform(this.masterFloatBuffer, 300);
    this.ctx.lineWidth = 2.5;
    this.ctx.strokeStyle = primary;
    this.ctx.shadowBlur = 12;
    this.ctx.shadowColor = primary;

    this.ctx.beginPath();
    const step = width / samples.length;
    for (let i = 0; i < samples.length; i++) {
      const x = i * step;
      const y = height / 2 + samples[i] * (height / 2) * 0.9;
      if (i === 0) this.ctx.moveTo(x, y);
      else this.ctx.lineTo(x, y);
    }
    this.ctx.stroke();
    this.ctx.shadowBlur = 0;
  }

  // 6. Circular Polar Spectrum
  private renderCircularSpectrum(
    width: number,
    height: number,
    primary: string,
    secondary: string
  ): void {
    if (!this.ctx) return;
    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.22;
    const count = 48;
    const { bands } = this.spectrumAnalyzer.processFrequencies(this.masterFftBuffer, count, false);

    this.ctx.save();
    this.ctx.translate(cx, cy);

    for (let i = 0; i < count; i++) {
      const val = bands[i];
      const angle = (i * 2 * Math.PI) / count;
      const barLength = Math.max(3, val * (baseRadius * 0.85));

      const x1 = Math.cos(angle) * baseRadius;
      const y1 = Math.sin(angle) * baseRadius;
      const x2 = Math.cos(angle) * (baseRadius + barLength);
      const y2 = Math.sin(angle) * (baseRadius + barLength);

      this.ctx.strokeStyle = i % 2 === 0 ? primary : secondary;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // 7. Radial Sunburst Expanding Spectrum
  private renderRadialSpectrum(
    width: number,
    height: number,
    primary: string,
    secondary: string
  ): void {
    if (!this.ctx) return;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.45;
    const rays = 36;
    const { bands } = this.spectrumAnalyzer.processFrequencies(this.masterFftBuffer, rays, false);

    this.ctx.save();
    this.ctx.translate(cx, cy);

    for (let i = 0; i < rays; i++) {
      const val = bands[i];
      const angle = (i * 2 * Math.PI) / rays;
      const r = Math.max(10, val * maxR);

      this.ctx.strokeStyle = i % 2 === 0 ? primary : secondary;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  // 8. Real-Time 2D Spectrogram Waterfall
  private renderSpectrogram(width: number, height: number): void {
    if (!this.ctx) return;
    this.spectrogramAnalyzer.render(this.ctx, width, height);
  }

  // 9. Stereo Peak Meters in Decibels (dBFS)
  private renderPeakMeter(width: number, height: number, primary: string): void {
    if (!this.ctx) return;
    const stereo = this.getStereoData();
    const meterWidth = Math.min(width * 0.7, 360);
    const startX = (width - meterWidth) / 2;
    const barH = 14;

    const ticks = [0, -6, -12, -24, -48, -72];
    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';

    // Left Channel
    this.ctx.fillText('LEFT', startX - 35, height / 2 - 12);
    this.renderMeterBar(startX, height / 2 - 22, meterWidth, barH, stereo.leftDb, primary);

    // Right Channel
    this.ctx.fillText('RIGHT', startX - 35, height / 2 + 18);
    this.renderMeterBar(startX, height / 2 + 8, meterWidth, barH, stereo.rightDb, primary);

    // dB Legend Ticks
    for (const db of ticks) {
      const norm = (db + 72) / 72;
      const tickX = startX + norm * meterWidth;
      this.ctx.fillText(`${db}dB`, tickX - 10, height / 2 + 38);
    }
  }

  // 10. Stereo RMS Loudness Meters with Headroom & Clipping
  private renderRmsMeter(
    width: number,
    height: number,
    primary: string,
    secondary: string
  ): void {
    if (!this.ctx) return;
    const stereo = this.getStereoData();
    const meterWidth = Math.min(width * 0.7, 360);
    const startX = (width - meterWidth) / 2;
    const barH = 18;

    // Left RMS
    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.fillText(`L RMS: ${stereo.leftDb.toFixed(1)} dB`, startX, height / 2 - 25);
    this.renderMeterBar(startX, height / 2 - 18, meterWidth, barH, stereo.leftDb, primary);

    // Right RMS
    this.ctx.fillText(`R RMS: ${stereo.rightDb.toFixed(1)} dB`, startX, height / 2 + 18);
    this.renderMeterBar(startX, height / 2 + 25, meterWidth, barH, stereo.rightDb, secondary);
  }

  private renderMeterBar(
    x: number,
    y: number,
    w: number,
    h: number,
    db: number,
    fillColor: string
  ): void {
    if (!this.ctx) return;
    // Background slot
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.fillRect(x, y, w, h);

    const norm = Math.max(0, Math.min(1.0, (db + 72) / 72));
    const activeW = norm * w;

    // Green -> Yellow -> Red gradient
    const grad = this.ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(0.75, '#eab308');
    grad.addColorStop(0.95, '#ef4444');

    this.ctx.fillStyle = grad;
    this.ctx.fillRect(x, y, activeW, h);
  }

  // 11. Lissajous / Goniometer Stereo Field Vectorscope
  private renderStereoField(width: number, height: number, primary: string): void {
    if (!this.ctx) return;
    const leftPcm = this.leftAnalyser ? this.leftFloatBuffer : this.masterFloatBuffer;
    const rightPcm = this.rightAnalyser ? this.rightFloatBuffer : this.masterFloatBuffer;
    const points = this.stereoAnalyzer.computeGoniometerPoints(leftPcm, rightPcm, 200);

    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.4;

    // Graticule Axes: -45 deg, +45 deg (L / R)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.moveTo(cx - radius, cy);
    this.ctx.lineTo(cx + radius, cy);
    this.ctx.moveTo(cx, cy - radius);
    this.ctx.lineTo(cx, cy + radius);
    this.ctx.stroke();

    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    this.ctx.fillText('+S', cx + radius - 20, cy - 6);
    this.ctx.fillText('-S', cx - radius + 5, cy - 6);
    this.ctx.fillText('M', cx + 6, cy - radius + 15);

    // Plot Vectorscope Points
    this.ctx.fillStyle = primary;
    for (const pt of points) {
      const px = cx + pt.x * radius;
      const py = cy - pt.y * radius;
      this.ctx.fillRect(px, py, 2, 2);
    }
  }

  // 12. Stereo Phase Correlation Meter (-1 to +1)
  private renderPhaseMeter(width: number, height: number, primary: string): void {
    if (!this.ctx) return;
    const stereo = this.getStereoData();
    const barW = Math.min(width * 0.7, 340);
    const x = (width - barW) / 2;
    const y = height / 2;

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.fillRect(x, y - 10, barW, 20);

    // Center divider (correlation = 0)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.beginPath();
    this.ctx.moveTo(x + barW / 2, y - 15);
    this.ctx.lineTo(x + barW / 2, y + 15);
    this.ctx.stroke();

    // Pointer indicator
    const corrNorm = (stereo.correlation + 1.0) / 2.0; // 0 to 1
    const ptrX = x + corrNorm * barW;

    this.ctx.fillStyle = stereo.correlation >= 0 ? primary : '#ef4444';
    this.ctx.fillRect(ptrX - 3, y - 12, 6, 24);

    this.ctx.font = '10px monospace';
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.fillText('-1.0 (Out of Phase)', x, y + 28);
    this.ctx.fillText('0.0 (Stereo)', x + barW / 2 - 30, y + 28);
    this.ctx.fillText('+1.0 (Mono)', x + barW - 65, y + 28);

    this.ctx.fillText(`CORRELATION: ${stereo.correlation.toFixed(2)}`, x + barW / 2 - 45, y - 22);
  }

  // 13. Album-Art Reactive Aura & Pulse
  private renderAlbumArtReactive(
    width: number,
    height: number,
    primary: string,
    secondary: string,
    isSilent: boolean
  ): void {
    if (!this.ctx) return;
    const cx = width / 2;
    const cy = height / 2;
    const peak = this.getPeakData();
    const beat = this.getBeatData();

    const energy = isSilent ? 0 : peak.peak;
    const pulseRadius = Math.min(width, height) * (0.2 + energy * 0.15 + (beat.isBeat ? 0.05 : 0));

    // Outer Aura Rings
    const grad = this.ctx.createRadialGradient(cx, cy, pulseRadius * 0.4, cx, cy, pulseRadius * 1.5);
    grad.addColorStop(0, `${primary}aa`);
    grad.addColorStop(0.6, `${secondary}44`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, pulseRadius * 1.5, 0, Math.PI * 2);
    this.ctx.fill();

    // Central Artwork Image if available
    if (this.albumArtImage && this.albumArtImage.complete) {
      const artSize = pulseRadius * 1.2;
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, artSize / 2, 0, Math.PI * 2);
      this.ctx.clip();
      this.ctx.drawImage(this.albumArtImage, cx - artSize / 2, cy - artSize / 2, artSize, artSize);
      this.ctx.restore();
    } else {
      // Circle icon placeholder
      this.ctx.fillStyle = primary;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, pulseRadius * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  // 14. Audio-Reactive Particle Simulation
  private renderParticles(
    width: number,
    height: number,
    primary: string,
    secondary: string,
    isSilent: boolean
  ): void {
    if (!this.ctx) return;
    this.particleSystem.resize(width, height);

    if (isSilent) {
      // Gentle calm drift
      this.particleSystem.update(0, 0, 0, false, true);
    } else {
      const bands = this.extract9Bands(this.masterFftBuffer);
      const bass = (bands[0] + bands[1]) / 2;
      const mid = (bands[3] + bands[4]) / 2;
      const treble = (bands[7] + bands[8]) / 2;
      const beat = this.getBeatData();
      this.particleSystem.update(bass, mid, treble, beat.isBeat, this.settings.reducedMotion);
    }

    this.particleSystem.render(this.ctx, primary, secondary);
  }

  // 15. Minimal Clean Visualization
  private renderMinimal(width: number, height: number, primary: string): void {
    if (!this.ctx) return;
    const bands = this.extract9Bands(this.masterFftBuffer);
    const count = 7;
    const spacing = width / (count + 1);
    const cy = height / 2;

    for (let i = 0; i < count; i++) {
      const val = bands[i] || 0.05;
      const radius = 2.5 + val * 16;
      const x = (i + 1) * spacing;

      this.ctx.fillStyle = primary;
      this.ctx.beginPath();
      this.ctx.arc(x, cy, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}

import { AnalysisTapSource, VisualizerFftSize } from '../types';

export interface AnalysisTapPoints {
  source: AudioNode | null;
  pre_dsp: AudioNode | null;
  post_dsp: AudioNode | null;
  post_spatial: AudioNode | null;
  post_limiter: AudioNode | null;
}

/**
 * AudioAnalysisTap
 *
 * Implements a high-impedance, non-invasive audio analysis tap across multiple stages
 * of the Web Audio DSP graph.
 *
 * Safety Guarantee:
 * - Tap nodes only feed observation AnalyserNodes.
 * - Tap nodes are NEVER routed to AudioDestination or output nodes.
 * - Changing the analysis source or visualizer settings never alters audio output levels.
 */
export class AudioAnalysisTap {
  private audioCtx: AudioContext | null = null;
  private currentSource: AnalysisTapSource = 'post_spatial';

  // Available observation tap sources in the audio pipeline
  private tapPoints: AnalysisTapPoints = {
    source: null,
    pre_dsp: null,
    post_dsp: null,
    post_spatial: null,
    post_limiter: null,
  };

  // High-impedance isolation nodes
  private tapGainNode: GainNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private channelSplitter: ChannelSplitterNode | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;

  // Active connected node reference
  private activeConnectedNode: AudioNode | null = null;

  constructor() {}

  public init(context: AudioContext): void {
    this.audioCtx = context;

    // 1. Master isolation gain node
    this.tapGainNode = this.audioCtx.createGain();
    this.tapGainNode.gain.value = 1.0;

    // 2. Master Analyser (Mono / Combined)
    this.masterAnalyser = this.audioCtx.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterAnalyser.smoothingTimeConstant = 0.75;
    this.tapGainNode.connect(this.masterAnalyser);

    // 3. Dual-Channel Stereo Analysers for discrete Left / Right analysis
    this.channelSplitter = this.audioCtx.createChannelSplitter(2);
    this.leftAnalyser = this.audioCtx.createAnalyser();
    this.rightAnalyser = this.audioCtx.createAnalyser();

    this.leftAnalyser.fftSize = 2048;
    this.rightAnalyser.fftSize = 2048;
    this.leftAnalyser.smoothingTimeConstant = 0.75;
    this.rightAnalyser.smoothingTimeConstant = 0.75;

    this.tapGainNode.connect(this.channelSplitter);
    this.channelSplitter.connect(this.leftAnalyser, 0);
    this.channelSplitter.connect(this.rightAnalyser, 1);

    // Reconnect to active tap point if already registered
    this.reconnectActiveTap();
  }

  /**
   * Registers audio nodes available at each processing stage.
   */
  public registerTapPoints(points: Partial<AnalysisTapPoints>): void {
    this.tapPoints = { ...this.tapPoints, ...points };
    this.reconnectActiveTap();
  }

  /**
   * Selects the active stage to monitor.
   */
  public setSource(source: AnalysisTapSource): void {
    if (this.currentSource === source && this.activeConnectedNode) {
      return;
    }
    this.currentSource = source;
    this.reconnectActiveTap();
  }

  public getSource(): AnalysisTapSource {
    return this.currentSource;
  }

  private reconnectActiveTap(): void {
    if (!this.audioCtx || !this.tapGainNode) return;

    // Disconnect previously observed node from the tap isolation gain
    if (this.activeConnectedNode) {
      try {
        this.activeConnectedNode.disconnect(this.tapGainNode);
      } catch {
        // Node might not have been connected
      }
      this.activeConnectedNode = null;
    }

    // Determine target node for current source setting
    const targetNode =
      this.tapPoints[this.currentSource] ||
      this.tapPoints.post_spatial ||
      this.tapPoints.post_dsp ||
      this.tapPoints.source;

    if (targetNode) {
      try {
        targetNode.connect(this.tapGainNode);
        this.activeConnectedNode = targetNode;
      } catch (err) {
        console.warn(`[AudioAnalysisTap] Failed to connect tap for "${this.currentSource}":`, err);
      }
    }
  }

  public setFftSize(fftSize: VisualizerFftSize): void {
    if (this.masterAnalyser) this.masterAnalyser.fftSize = fftSize;
    if (this.leftAnalyser) this.leftAnalyser.fftSize = fftSize;
    if (this.rightAnalyser) this.rightAnalyser.fftSize = fftSize;
  }

  public setSmoothing(smoothing: number): void {
    const factor = Math.max(0, Math.min(0.99, smoothing / 100));
    if (this.masterAnalyser) this.masterAnalyser.smoothingTimeConstant = factor;
    if (this.leftAnalyser) this.leftAnalyser.smoothingTimeConstant = factor;
    if (this.rightAnalyser) this.rightAnalyser.smoothingTimeConstant = factor;
  }

  public getMasterAnalyser(): AnalyserNode | null {
    return this.masterAnalyser;
  }

  public getLeftAnalyser(): AnalyserNode | null {
    return this.leftAnalyser;
  }

  public getRightAnalyser(): AnalyserNode | null {
    return this.rightAnalyser;
  }
}

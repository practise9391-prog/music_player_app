import {
  AudioLevelData,
  CompressorConfig,
  DEFAULT_DSP_STATE,
  DspProcessingState,
  EQ_FREQUENCIES,
  AudioProfile,
  LimiterConfig,
  LoudnessMode,
  VocalEnhancementMode,
  SpatialMode,
  SpatialState,
} from '../types';
import { SpatialAudioEngine } from './SpatialAudioEngine';
import { VisualizerEngine } from './VisualizerEngine';
import { AudioAnalysisTap } from './AudioAnalysisTap';
import { AnalysisTapSource } from '../types';

export class AudioProcessor {
  private audioCtx: AudioContext | null = null;
  private isInitialized = false;

  // Spatial & Visualization Engines
  public readonly spatialEngine: SpatialAudioEngine = new SpatialAudioEngine();
  public readonly visualizerEngine: VisualizerEngine = new VisualizerEngine();
  public readonly analysisTap: AudioAnalysisTap = new AudioAnalysisTap();
  private visualizerAnalyser: AnalyserNode | null = null;

  // Pipeline Nodes
  private inputNode: GainNode | null = null;
  private replayGainNode: GainNode | null = null;
  private preampNode: GainNode | null = null;
  private eqNodes: BiquadFilterNode[] = [];
  private bassNode: BiquadFilterNode | null = null;
  private trebleNode: BiquadFilterNode | null = null;
  private vocalNode: BiquadFilterNode | null = null;
  private compNode: DynamicsCompressorNode | null = null;
  private compMakeupNode: GainNode | null = null;

  // Stereo Nodes
  private stereoSplitter: ChannelSplitterNode | null = null;
  private leftGain: GainNode | null = null;
  private rightGain: GainNode | null = null;
  private leftCrossGain: GainNode | null = null;
  private rightCrossGain: GainNode | null = null;
  private stereoMerger: ChannelMergerNode | null = null;
  private pannerNode: StereoPannerNode | null = null;

  // Output stage nodes
  private volumeBoostNode: GainNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private masterGainNode: GainNode | null = null;
  private outputNode: GainNode | null = null;

  // Analyser nodes for Left & Right monitoring
  private meterSplitter: ChannelSplitterNode | null = null;
  private leftAnalyser: AnalyserNode | null = null;
  private rightAnalyser: AnalyserNode | null = null;
  private leftTimeDomain: Float32Array = new Float32Array(512);
  private rightTimeDomain: Float32Array = new Float32Array(512);

  // Current State
  private state: DspProcessingState = {
    ...DEFAULT_DSP_STATE,
    eqBands: [...DEFAULT_DSP_STATE.eqBands],
    compressor: { ...DEFAULT_DSP_STATE.compressor },
    limiter: { ...DEFAULT_DSP_STATE.limiter },
  };
  private savedStateA: DspProcessingState | null = null;
  private masterVolume = 0.8;
  private isMuted = false;

  // Clipping tracking
  private lastClipTimestamp = 0;

  constructor() {}

  public init(context: AudioContext, sourceNode: AudioNode): AudioNode {
    this.audioCtx = context;

    // 1. Input Node
    this.inputNode = this.audioCtx.createGain();

    // 1b. ReplayGain Node (Part 13: Track/Album gain staging)
    this.replayGainNode = this.audioCtx.createGain();
    this.replayGainNode.gain.value = 1.0;

    // 2. Preamp Node (-12dB to +12dB)
    this.preampNode = this.audioCtx.createGain();

    // 3. 9-Band Equalizer (60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz)
    this.eqNodes = EQ_FREQUENCIES.map((freq, i) => {
      const filter = this.audioCtx!.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === EQ_FREQUENCIES.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1.414;
      }
      filter.frequency.value = freq;
      filter.gain.value = 0;
      return filter;
    });

    // 4. Dedicated Bass Boost (Lowshelf at 80Hz)
    this.bassNode = this.audioCtx.createBiquadFilter();
    this.bassNode.type = 'lowshelf';
    this.bassNode.frequency.value = 80;
    this.bassNode.gain.value = 0;

    // 5. Dedicated Treble Control (Highshelf at 10000Hz)
    this.trebleNode = this.audioCtx.createBiquadFilter();
    this.trebleNode.type = 'highshelf';
    this.trebleNode.frequency.value = 10000;
    this.trebleNode.gain.value = 0;

    // 6. Vocal Enhancement (Peaking at 2400Hz, Q=1.0)
    this.vocalNode = this.audioCtx.createBiquadFilter();
    this.vocalNode.type = 'peaking';
    this.vocalNode.frequency.value = 2400;
    this.vocalNode.Q.value = 1.0;
    this.vocalNode.gain.value = 0;

    // 7. Dynamics Compressor & Loudness
    this.compNode = this.audioCtx.createDynamicsCompressor();
    this.compNode.threshold.value = -12;
    this.compNode.knee.value = 6;
    this.compNode.ratio.value = 4;
    this.compNode.attack.value = 0.01;
    this.compNode.release.value = 0.25;

    this.compMakeupNode = this.audioCtx.createGain();
    this.compMakeupNode.gain.value = 1.0;

    // 8. Stereo Width & Balance Matrix
    this.stereoSplitter = this.audioCtx.createChannelSplitter(2);
    this.leftGain = this.audioCtx.createGain();
    this.rightGain = this.audioCtx.createGain();
    this.leftCrossGain = this.audioCtx.createGain();
    this.rightCrossGain = this.audioCtx.createGain();
    this.stereoMerger = this.audioCtx.createChannelMerger(2);

    if (this.audioCtx.createStereoPanner) {
      this.pannerNode = this.audioCtx.createStereoPanner();
      this.pannerNode.pan.value = 0;
    }

    // 9. Volume Boost Gain Stage (100% to 300%)
    this.volumeBoostNode = this.audioCtx.createGain();
    this.volumeBoostNode.gain.value = 1.0;

    // 10. Brickwall Limiter (Safety ceiling against clipping)
    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -1.0;
    this.limiterNode.knee.value = 0.0;
    this.limiterNode.ratio.value = 20.0;
    this.limiterNode.attack.value = 0.002;
    this.limiterNode.release.value = 0.05;

    // 11. Master Volume
    this.masterGainNode = this.audioCtx.createGain();
    this.masterGainNode.gain.value = this.isMuted ? 0 : this.masterVolume;

    // 12. Final Output Node
    this.outputNode = this.audioCtx.createGain();

    // 13. Dual-Channel Analysers for metering
    this.meterSplitter = this.audioCtx.createChannelSplitter(2);
    this.leftAnalyser = this.audioCtx.createAnalyser();
    this.rightAnalyser = this.audioCtx.createAnalyser();
    this.leftAnalyser.fftSize = 512;
    this.rightAnalyser.fftSize = 512;
    this.leftAnalyser.smoothingTimeConstant = 0.4;
    this.rightAnalyser.smoothingTimeConstant = 0.4;

    // --- Graph Connections ---
    sourceNode.connect(this.inputNode);
    this.inputNode.connect(this.replayGainNode);
    this.replayGainNode.connect(this.preampNode);

    let lastNode: AudioNode = this.preampNode;
    for (const eq of this.eqNodes) {
      lastNode.connect(eq);
      lastNode = eq;
    }

    lastNode.connect(this.bassNode);
    this.bassNode.connect(this.trebleNode);
    this.trebleNode.connect(this.vocalNode);
    this.vocalNode.connect(this.compNode);
    this.compNode.connect(this.compMakeupNode);

    // Spatial Audio Processor Insertion (Section 3 & 49: Compressor -> Spatial -> Stereo Matrix)
    const spatialOutput = this.spatialEngine.init(this.audioCtx, this.compMakeupNode);

    // Stereo Matrix
    spatialOutput.connect(this.stereoSplitter);
    // Channel 0 (Left)
    this.stereoSplitter.connect(this.leftGain, 0);
    this.stereoSplitter.connect(this.rightCrossGain, 0);
    // Channel 1 (Right)
    this.stereoSplitter.connect(this.rightGain, 1);
    this.stereoSplitter.connect(this.leftCrossGain, 1);

    this.leftGain.connect(this.stereoMerger, 0, 0);
    this.leftCrossGain.connect(this.stereoMerger, 0, 0);
    this.rightGain.connect(this.stereoMerger, 0, 1);
    this.rightCrossGain.connect(this.stereoMerger, 0, 1);

    if (this.pannerNode) {
      this.stereoMerger.connect(this.pannerNode);
      this.pannerNode.connect(this.volumeBoostNode);
    } else {
      this.stereoMerger.connect(this.volumeBoostNode);
    }

    this.volumeBoostNode.connect(this.limiterNode);
    this.limiterNode.connect(this.masterGainNode);
    this.masterGainNode.connect(this.outputNode);

    // Meter taps
    this.outputNode.connect(this.meterSplitter);
    this.meterSplitter.connect(this.leftAnalyser, 0);
    this.meterSplitter.connect(this.rightAnalyser, 1);

    // Initialize non-invasive Audio Analysis Tap across stages
    this.analysisTap.init(this.audioCtx);
    this.analysisTap.registerTapPoints({
      source: this.inputNode,
      pre_dsp: this.preampNode,
      post_dsp: this.compMakeupNode,
      post_spatial: this.pannerNode || this.stereoMerger,
      post_limiter: this.outputNode,
    });

    // Wire analysis tap to visualizer engine
    this.visualizerEngine.setAnalysisTap(this.analysisTap);
    this.visualizerAnalyser = this.analysisTap.getMasterAnalyser();

    this.isInitialized = true;
    this.applyAllSettings();

    return this.outputNode;
  }

  public setAnalysisTapSource(source: AnalysisTapSource): void {
    this.analysisTap.setSource(source);
    this.visualizerEngine.updateSettings({ analysisTap: source });
  }

  public getAnalysisTapSource(): AnalysisTapSource {
    return this.analysisTap.getSource();
  }

  // --- Real-Time Parameter Setters ---

  public setPreamp(db: number): void {
    const clamped = Math.max(-12, Math.min(12, db));
    this.state.preampDb = clamped;
    this.updatePreampGain();
  }

  public setEqualizerBand(index: number, gainDb: number): void {
    if (index < 0 || index >= this.state.eqBands.length) return;
    const clamped = Math.max(-12, Math.min(12, gainDb));
    this.state.eqBands[index] = clamped;

    if (this.audioCtx && this.eqNodes[index] && !this.state.dspBypass) {
      this.eqNodes[index].gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }

    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public setEqualizerBands(bands: number[]): void {
    for (let i = 0; i < Math.min(bands.length, this.state.eqBands.length); i++) {
      const clamped = Math.max(-12, Math.min(12, bands[i]));
      this.state.eqBands[i] = clamped;
      if (this.audioCtx && this.eqNodes[i] && !this.state.dspBypass) {
        this.eqNodes[i].gain.setValueAtTime(clamped, this.audioCtx.currentTime);
      }
    }
    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public resetEqualizer(): void {
    this.setEqualizerBands([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  }

  public setBassBoost(db: number): void {
    const clamped = Math.max(-10, Math.min(10, db));
    this.state.bassBoostDb = clamped;
    this.state.bassBoostPercent = Math.round(Math.max(0, clamped / 10) * 100);
    if (this.audioCtx && this.bassNode) {
      const effective = this.state.dspBypass ? 0 : clamped;
      this.bassNode.gain.setValueAtTime(effective, this.audioCtx.currentTime);
    }
    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public setBassBoostPercent(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.state.bassBoostPercent = clamped;
    const db = (clamped / 100) * 10;
    this.state.bassBoostDb = Math.round(db * 10) / 10;
    if (this.audioCtx && this.bassNode) {
      const effective = this.state.dspBypass ? 0 : this.state.bassBoostDb;
      this.bassNode.gain.setValueAtTime(effective, this.audioCtx.currentTime);
    }
    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public setTreble(db: number): void {
    const clamped = Math.max(-12, Math.min(12, db));
    this.state.trebleDb = clamped;
    if (this.audioCtx && this.trebleNode) {
      const effective = this.state.dspBypass ? 0 : clamped;
      this.trebleNode.gain.setValueAtTime(effective, this.audioCtx.currentTime);
    }
    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public resetTreble(): void {
    this.setTreble(0);
  }

  public setReplayGainMode(mode: 'off' | 'track' | 'album', track?: { trackGain?: number; albumGain?: number } | null): void {
    this.state.replayGainMode = mode;
    let gainDb = 0;
    if (mode === 'track' && track?.trackGain !== undefined) {
      gainDb = track.trackGain;
    } else if (mode === 'album' && track?.albumGain !== undefined) {
      gainDb = track.albumGain;
    }
    this.state.replayGainDb = gainDb;
    const clampedDb = Math.max(-20, Math.min(6, gainDb));
    const linearGain = Math.pow(10, clampedDb / 20);
    if (this.audioCtx && this.replayGainNode) {
      this.replayGainNode.gain.setValueAtTime(linearGain, this.audioCtx.currentTime);
    }
  }

  public setReplayGain(gainLinear: number): void {
    const clamped = Math.max(0.05, Math.min(2.0, gainLinear));
    if (this.audioCtx && this.replayGainNode) {
      this.replayGainNode.gain.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  public setVolumeNormalization(mode: 'off' | 'track' | 'album'): void {
    this.state.volumeNormalizationMode = mode;
    this.applyCompressorAndLoudness();
  }

  public setPreventClipping(enabled: boolean): void {
    this.state.preventClipping = enabled;
    this.setAutoHeadroom(enabled);
    this.setLimiter(enabled);
  }

  public setVirtualSurround(percent: number): void {
    const clamped = Math.max(0, Math.min(100, percent));
    this.state.virtualSurround = clamped;
    if (clamped > 0) {
      this.spatialEngine.setMode('virtual_surround');
      this.spatialEngine.setIntensity(Math.min(1.2, (clamped / 100) * 1.0));
      this.spatialEngine.setSurroundBalance(0);
    } else if (this.spatialEngine.getState().mode === 'virtual_surround') {
      this.spatialEngine.setMode('off');
    }
  }

  public setNightMode(enabled: boolean): void {
    this.state.nightMode = enabled;
    if (enabled) {
      if (this.audioCtx && this.compNode && this.compMakeupNode) {
        const t = this.audioCtx.currentTime;
        this.compNode.threshold.setValueAtTime(-22, t);
        this.compNode.knee.setValueAtTime(8, t);
        this.compNode.ratio.setValueAtTime(5.5, t);
        this.compNode.attack.setValueAtTime(0.008, t);
        this.compNode.release.setValueAtTime(0.2, t);
        this.compMakeupNode.gain.setValueAtTime(1.0, t);
      }
      if (this.audioCtx && this.bassNode) {
        this.bassNode.gain.setValueAtTime(-2.5, this.audioCtx.currentTime);
      }
      if (this.audioCtx && this.trebleNode) {
        this.trebleNode.gain.setValueAtTime(-2.0, this.audioCtx.currentTime);
      }
    } else {
      this.applyCompressorAndLoudness();
      this.setBassBoost(this.state.bassBoostDb);
      this.setTreble(this.state.trebleDb);
    }
  }

  public setVoiceMode(enabled: boolean): void {
    this.state.voiceMode = enabled;
    if (enabled) {
      this.setVocalEnhancement('high');
      if (this.audioCtx && this.bassNode) {
        this.bassNode.gain.setValueAtTime(-4.0, this.audioCtx.currentTime);
      }
      this.setVolumeNormalization('track');
    } else {
      this.setVocalEnhancement('off');
      this.setBassBoost(this.state.bassBoostDb);
      this.setVolumeNormalization('off');
    }
  }

  public setVocalEnhancement(mode: VocalEnhancementMode): void {
    this.state.vocalMode = mode;
    if (this.audioCtx && this.vocalNode) {
      let gain = 0;
      if (!this.state.dspBypass) {
        if (mode === 'low') gain = 2.0;
        else if (mode === 'medium') gain = 4.0;
        else if (mode === 'high') gain = 6.0;
      }
      this.vocalNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
    }
    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public setLoudness(mode: LoudnessMode): void {
    this.state.loudnessMode = mode;
    this.applyCompressorAndLoudness();
  }

  public setCompressor(config: Partial<CompressorConfig>): void {
    this.state.compressor = { ...this.state.compressor, ...config };
    this.applyCompressorAndLoudness();
  }

  public setLimiter(enabled: boolean, ceilingDb = -1.0): void {
    this.state.limiter = { enabled, ceilingDb };
    if (this.audioCtx && this.limiterNode) {
      if (enabled) {
        this.limiterNode.threshold.setValueAtTime(ceilingDb, this.audioCtx.currentTime);
        this.limiterNode.ratio.setValueAtTime(20.0, this.audioCtx.currentTime);
      } else {
        // Disabling limiter sets threshold to 0dB and ratio to 1:1 (transparent)
        this.limiterNode.threshold.setValueAtTime(0, this.audioCtx.currentTime);
        this.limiterNode.ratio.setValueAtTime(1.0, this.audioCtx.currentTime);
      }
    }
  }

  public setStereoWidth(width: number): void {
    const clamped = Math.max(0, Math.min(1.5, width));
    this.state.stereoWidth = clamped;
    this.applyStereoMatrix();
  }

  public setBalance(balance: number): void {
    const clamped = Math.max(-1.0, Math.min(1.0, balance));
    this.state.balance = clamped;
    if (this.audioCtx && this.pannerNode) {
      this.pannerNode.pan.setValueAtTime(clamped, this.audioCtx.currentTime);
    }
  }

  public setMono(mono: boolean): void {
    this.state.isMono = mono;
    this.applyStereoMatrix();
  }

  public setVolumeBoost(boost: number): void {
    const clamped = Math.max(1.0, Math.min(3.0, boost));
    this.state.volumeBoost = clamped;
    if (this.audioCtx && this.volumeBoostNode) {
      const effective = this.state.dspBypass ? 1.0 : clamped;
      this.volumeBoostNode.gain.setValueAtTime(effective, this.audioCtx.currentTime);
    }
    if (this.state.autoHeadroom) {
      this.updatePreampGain();
    }
  }

  public setAutoHeadroom(enabled: boolean): void {
    this.state.autoHeadroom = enabled;
    this.updatePreampGain();
  }

  public setMaxOutputLevel(level: number): void {
    this.state.maxOutputLevel = Math.max(0.5, Math.min(1.0, level));
    this.updateMasterVolume();
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.updateMasterVolume();
  }

  public setMute(mute: boolean): void {
    this.isMuted = mute;
    this.updateMasterVolume();
  }

  public setDspBypass(bypassed: boolean): void {
    this.state.dspBypass = bypassed;
    this.applyAllSettings();
  }

  public toggleAbComparison(): void {
    if (this.state.abState === 'A') {
      // Save current custom state as A
      this.savedStateA = JSON.parse(JSON.stringify(this.state));
      this.state.abState = 'B';
      this.setDspBypass(true);
    } else {
      // Revert back to state A
      this.state.abState = 'A';
      if (this.savedStateA) {
        this.loadState(this.savedStateA);
      } else {
        this.setDspBypass(false);
      }
    }
  }

  public resetProcessing(): void {
    this.loadState({
      ...DEFAULT_DSP_STATE,
      eqBands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
      compressor: { ...DEFAULT_DSP_STATE.compressor },
      limiter: { ...DEFAULT_DSP_STATE.limiter },
    });
  }

  public loadState(newState: Partial<DspProcessingState>): void {
    this.state = {
      ...this.state,
      ...newState,
      eqBands: newState.eqBands ? [...newState.eqBands] : [...this.state.eqBands],
      compressor: newState.compressor ? { ...newState.compressor } : { ...this.state.compressor },
      limiter: newState.limiter ? { ...newState.limiter } : { ...this.state.limiter },
    };
    this.applyAllSettings();
  }

  public setBypass(bypassed: boolean): void {
    this.setDspBypass(bypassed);
  }

  public toggleAB(): void {
    this.toggleAbComparison();
  }

  public resetAllAudio(): void {
    this.resetProcessing();
  }

  public getState(): DspProcessingState {
    return this.getProcessingState();
  }

  // --- Spatial Audio & Visualizer Delegation ---
  public getSpatialEngine(): SpatialAudioEngine {
    return this.spatialEngine;
  }

  public getVisualizerEngine(): VisualizerEngine {
    return this.visualizerEngine;
  }

  public setSpatialMode(mode: SpatialMode): void {
    this.spatialEngine.setMode(mode);
  }

  public setSpatialIntensity(intensity: number): void {
    this.spatialEngine.setIntensity(intensity);
  }

  public setSpatialBypass(bypass: boolean): void {
    this.spatialEngine.setBypass(bypass);
  }

  public getSpatialState(): SpatialState {
    return this.spatialEngine.getState();
  }

  public loadProfile(profile: AudioProfile): void {
    this.state.activeProfile = profile.name;
    this.setPreamp(profile.preampDb ?? 0);
    this.setEqualizerBands(profile.bands.map((b) => b.gain));
    this.setBassBoost(profile.bassGain);
    this.setTreble(profile.trebleGain);
    if (profile.vocalMode) this.setVocalEnhancement(profile.vocalMode);
    if (profile.loudnessMode) this.setLoudness(profile.loudnessMode);
    if (profile.stereoWidth !== undefined) this.setStereoWidth(profile.stereoWidth);
  }

  public getProcessingState(): DspProcessingState {
    return { ...this.state, eqBands: [...this.state.eqBands] };
  }

  // --- Real-Time Level Metering & Diagnostics ---

  public getLevelData(): AudioLevelData {
    if (!this.leftAnalyser || !this.rightAnalyser || typeof window === 'undefined') {
      return {
        leftPeak: 0,
        rightPeak: 0,
        leftRms: 0,
        rightRms: 0,
        isClipping: false,
        gainReductionDb: 0,
        peakDb: -96,
      };
    }

    try {
      this.leftAnalyser.getFloatTimeDomainData(this.leftTimeDomain as unknown as Float32Array<ArrayBuffer>);
      this.rightAnalyser.getFloatTimeDomainData(this.rightTimeDomain as unknown as Float32Array<ArrayBuffer>);

      let lPeak = 0;
      let rPeak = 0;
      let lSumSquares = 0;
      let rSumSquares = 0;
      const n = this.leftTimeDomain.length;

      for (let i = 0; i < n; i++) {
        const l = Math.abs(this.leftTimeDomain[i]);
        const r = Math.abs(this.rightTimeDomain[i]);
        if (l > lPeak) lPeak = l;
        if (r > rPeak) rPeak = r;
        lSumSquares += l * l;
        rSumSquares += r * r;
      }

      const lRms = Math.sqrt(lSumSquares / n);
      const rRms = Math.sqrt(rSumSquares / n);
      const maxPeak = Math.max(lPeak, rPeak);

      const isClippingNow = maxPeak >= 0.985;
      if (isClippingNow) {
        this.lastClipTimestamp = Date.now();
      }
      // Hold clip indicator for 1.2 seconds for visibility
      const isClipping = Date.now() - this.lastClipTimestamp < 1200;

      const gainReductionDb = this.limiterNode ? Math.abs(this.limiterNode.reduction) : 0;
      const peakDb = maxPeak > 0 ? 20 * Math.log10(maxPeak) : -96;

      return {
        leftPeak: Math.min(1.0, lPeak),
        rightPeak: Math.min(1.0, rPeak),
        leftRms: Math.min(1.0, lRms),
        rightRms: Math.min(1.0, rRms),
        isClipping,
        gainReductionDb: Math.round(gainReductionDb * 10) / 10,
        peakDb: Math.round(peakDb * 10) / 10,
      };
    } catch {
      return {
        leftPeak: 0,
        rightPeak: 0,
        leftRms: 0,
        rightRms: 0,
        isClipping: false,
        gainReductionDb: 0,
        peakDb: -96,
      };
    }
  }

  // --- Internal DSP Routing Helpers ---

  private updatePreampGain(): void {
    let targetDb = this.state.preampDb;

    // Auto Headroom computation
    if (this.state.autoHeadroom && !this.state.dspBypass) {
      let maxPositiveBoost = Math.max(0, this.state.preampDb);
      for (const b of this.state.eqBands) {
        if (b > maxPositiveBoost) maxPositiveBoost = b;
      }
      if (this.state.bassBoostDb > maxPositiveBoost) {
        maxPositiveBoost = this.state.bassBoostDb;
      }
      if (this.state.vocalMode !== 'off') {
        const vGain = this.state.vocalMode === 'high' ? 6 : this.state.vocalMode === 'medium' ? 4 : 2;
        if (vGain > maxPositiveBoost) maxPositiveBoost = vGain;
      }

      // If user enabled volume boost, also account for boost gain headroom
      if (this.state.volumeBoost > 1.0) {
        const boostDb = 20 * Math.log10(this.state.volumeBoost);
        maxPositiveBoost += boostDb * 0.5;
      }

      // Deduct headroom if positive boost exceeds 2.5dB
      const reduction = Math.max(0, maxPositiveBoost - 2.5);
      this.state.calculatedHeadroomDb = Math.round(reduction * 10) / 10;
      targetDb = this.state.preampDb - reduction;
    } else {
      this.state.calculatedHeadroomDb = 0;
    }

    if (!this.audioCtx || !this.preampNode) return;

    const linearGain = Math.pow(10, targetDb / 20);
    this.preampNode.gain.setValueAtTime(linearGain, this.audioCtx.currentTime);
  }

  private applyStereoMatrix(): void {
    if (
      !this.audioCtx ||
      !this.leftGain ||
      !this.rightGain ||
      !this.leftCrossGain ||
      !this.rightCrossGain
    ) {
      return;
    }

    const t = this.audioCtx.currentTime;

    if (this.state.isMono) {
      // Mono mode: L = 0.5*L + 0.5*R, R = 0.5*L + 0.5*R
      this.leftGain.gain.setValueAtTime(0.5, t);
      this.leftCrossGain.gain.setValueAtTime(0.5, t);
      this.rightGain.gain.setValueAtTime(0.5, t);
      this.rightCrossGain.gain.setValueAtTime(0.5, t);
    } else {
      // Mid/Side stereo width formula
      // Direct = (1 + Width)/2, Cross = (1 - Width)/2
      const w = this.state.dspBypass ? 1.0 : this.state.stereoWidth;
      const direct = (1 + w) / 2;
      const cross = (1 - w) / 2;

      this.leftGain.gain.setValueAtTime(direct, t);
      this.leftCrossGain.gain.setValueAtTime(-cross, t);
      this.rightGain.gain.setValueAtTime(direct, t);
      this.rightCrossGain.gain.setValueAtTime(-cross, t);
    }
  }

  private applyCompressorAndLoudness(): void {
    if (!this.audioCtx || !this.compNode || !this.compMakeupNode) return;

    const t = this.audioCtx.currentTime;

    if (this.state.dspBypass) {
      this.compNode.threshold.setValueAtTime(0, t);
      this.compNode.ratio.setValueAtTime(1, t);
      this.compMakeupNode.gain.setValueAtTime(1.0, t);
      return;
    }

    // Volume Normalization mode (Part 13)
    if (this.state.volumeNormalizationMode && this.state.volumeNormalizationMode !== 'off') {
      this.compNode.threshold.setValueAtTime(-15, t);
      this.compNode.knee.setValueAtTime(10, t);
      this.compNode.ratio.setValueAtTime(2.5, t);
      this.compNode.attack.setValueAtTime(0.02, t);
      this.compNode.release.setValueAtTime(0.25, t);
      this.compMakeupNode.gain.setValueAtTime(Math.pow(10, 1.5 / 20), t);
      return;
    }

    // Loudness mode preset defaults
    if (this.state.loudnessMode !== 'off' && !this.state.compressor.enabled) {
      const mode = this.state.loudnessMode;
      const thresh = mode === 'high' ? -22 : mode === 'medium' ? -18 : -14;
      const ratio = mode === 'high' ? 4.5 : mode === 'medium' ? 3.5 : 2.5;
      const makeupDb = mode === 'high' ? 3.5 : mode === 'medium' ? 2.5 : 1.5;

      this.compNode.threshold.setValueAtTime(thresh, t);
      this.compNode.ratio.setValueAtTime(ratio, t);
      this.compNode.attack.setValueAtTime(0.015, t);
      this.compNode.release.setValueAtTime(0.2, t);
      this.compMakeupNode.gain.setValueAtTime(Math.pow(10, makeupDb / 20), t);
      return;
    }

    // Custom compressor settings
    if (this.state.compressor.enabled) {
      this.compNode.threshold.setValueAtTime(this.state.compressor.threshold, t);
      this.compNode.ratio.setValueAtTime(this.state.compressor.ratio, t);
      this.compNode.attack.setValueAtTime(this.state.compressor.attack, t);
      this.compNode.release.setValueAtTime(this.state.compressor.release, t);
      this.compMakeupNode.gain.setValueAtTime(
        Math.pow(10, this.state.compressor.makeupGain / 20),
        t
      );
    } else {
      // Disabled: transparent
      this.compNode.threshold.setValueAtTime(0, t);
      this.compNode.ratio.setValueAtTime(1, t);
      this.compMakeupNode.gain.setValueAtTime(1.0, t);
    }
  }

  private updateMasterVolume(): void {
    if (!this.audioCtx || !this.masterGainNode) return;
    const effective = this.isMuted
      ? 0
      : this.masterVolume * (this.state.maxOutputLevel || 1.0);
    this.masterGainNode.gain.setValueAtTime(effective, this.audioCtx.currentTime);
  }

  private applyAllSettings(): void {
    if (!this.isInitialized) return;

    this.updatePreampGain();

    // Equalizer
    this.state.eqBands.forEach((gain, i) => {
      if (this.eqNodes[i] && this.audioCtx) {
        const effective = this.state.dspBypass ? 0 : gain;
        this.eqNodes[i].gain.setValueAtTime(effective, this.audioCtx.currentTime);
      }
    });

    // Bass / Treble
    this.setBassBoost(this.state.bassBoostDb);
    this.setTreble(this.state.trebleDb);

    // Vocal
    this.setVocalEnhancement(this.state.vocalMode);

    // Compressor & Loudness
    this.applyCompressorAndLoudness();

    // Stereo Matrix & Balance
    this.applyStereoMatrix();
    this.setBalance(this.state.balance);

    // Volume Boost
    this.setVolumeBoost(this.state.volumeBoost);

    // ReplayGain & Normalization
    if (this.state.replayGainMode) {
      this.setReplayGainMode(this.state.replayGainMode);
    }
    if (this.state.virtualSurround !== undefined) {
      this.setVirtualSurround(this.state.virtualSurround);
    }
    if (this.state.nightMode) {
      this.setNightMode(true);
    } else if (this.state.voiceMode) {
      this.setVoiceMode(true);
    }

    // Limiter
    this.setLimiter(this.state.limiter.enabled, this.state.limiter.ceilingDb);

    // Master Volume
    this.updateMasterVolume();
  }
}

export const audioProcessorInstance = new AudioProcessor();

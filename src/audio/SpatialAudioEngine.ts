import {
  CrossfeedMode,
  DEFAULT_SPATIAL_STATE,
  RoomSizeType,
  SpatialCapabilities,
  SpatialMode,
  SpatialPosition,
  SpatialPreset,
  SpatialState,
} from '../types';

export class SpatialAudioEngine {
  private audioCtx: AudioContext | null = null;
  private isInitialized = false;

  // Nodes
  private inputNode: GainNode | null = null;
  private outputNode: GainNode | null = null;
  private dryNode: GainNode | null = null;
  private wetNode: GainNode | null = null;

  // 3D Panner Node (HRTF binaural)
  private pannerNode: PannerNode | null = null;
  private distanceDampingNode: BiquadFilterNode | null = null;

  // Virtual Surround & Stereo Widener
  private splitterNode: ChannelSplitterNode | null = null;
  private mergerNode: ChannelMergerNode | null = null;
  private leftDelayNode: DelayNode | null = null;
  private rightDelayNode: DelayNode | null = null;
  private surroundDiffGainL: GainNode | null = null;
  private surroundDiffGainR: GainNode | null = null;

  // Center Channel (Mid extraction)
  private centerMidGain: GainNode | null = null;

  // Headphone Crossfeed
  private crossfeedFilterL: BiquadFilterNode | null = null;
  private crossfeedFilterR: BiquadFilterNode | null = null;
  private crossfeedDelayL: DelayNode | null = null;
  private crossfeedDelayR: DelayNode | null = null;
  private crossfeedGainL: GainNode | null = null;
  private crossfeedGainR: GainNode | null = null;

  // Room Simulation & Reverb Convolver
  private convolverNode: ConvolverNode | null = null;
  private convolverSendGain: GainNode | null = null;
  private convolverReturnGain: GainNode | null = null;

  // Correlation Analyzer
  private corrSplitter: ChannelSplitterNode | null = null;
  private leftCorrAnalyser: AnalyserNode | null = null;
  private rightCorrAnalyser: AnalyserNode | null = null;
  private leftBuffer = new Float32Array(512);
  private rightBuffer = new Float32Array(512);

  // State
  private state: SpatialState = {
    ...DEFAULT_SPATIAL_STATE,
    position: { ...DEFAULT_SPATIAL_STATE.position },
  };
  private savedStateA: SpatialState | null = null;

  constructor() {}

  public init(context: AudioContext, sourceNode: AudioNode): AudioNode {
    this.audioCtx = context;

    // 1. In/Out and Dry/Wet Routing
    this.inputNode = this.audioCtx.createGain();
    this.outputNode = this.audioCtx.createGain();
    this.dryNode = this.audioCtx.createGain();
    this.wetNode = this.audioCtx.createGain();

    // 2. 3D Binaural HRTF Panner
    try {
      if (typeof this.audioCtx.createPanner === 'function') {
        this.pannerNode = this.audioCtx.createPanner();
        this.pannerNode.panningModel = 'HRTF';
        this.pannerNode.distanceModel = 'inverse';
        this.pannerNode.refDistance = 1;
        this.pannerNode.maxDistance = 10000;
        this.pannerNode.rolloffFactor = 1;
      }
    } catch {
      // Fallback for environments lacking HRTF support
      try {
        if (typeof this.audioCtx.createPanner === 'function') {
          this.pannerNode = this.audioCtx.createPanner();
          this.pannerNode.panningModel = 'equalpower';
        }
      } catch {
        this.pannerNode = null;
      }
    }

    // Distance air-absorption filter
    this.distanceDampingNode = this.audioCtx.createBiquadFilter();
    this.distanceDampingNode.type = 'lowpass';
    this.distanceDampingNode.frequency.value = 20000;

    // 3. Virtual Surround Matrix
    this.splitterNode = this.audioCtx.createChannelSplitter(2);
    this.mergerNode = this.audioCtx.createChannelMerger(2);
    this.leftDelayNode = this.audioCtx.createDelay(0.1);
    this.rightDelayNode = this.audioCtx.createDelay(0.1);
    this.leftDelayNode.delayTime.value = 0.015; // 15ms Haas effect
    this.rightDelayNode.delayTime.value = 0.018; // 18ms Haas effect
    this.surroundDiffGainL = this.audioCtx.createGain();
    this.surroundDiffGainR = this.audioCtx.createGain();
    this.surroundDiffGainL.gain.value = 0.0;
    this.surroundDiffGainR.gain.value = 0.0;

    // 4. Center Vocal / Dialogue Level
    this.centerMidGain = this.audioCtx.createGain();
    this.centerMidGain.gain.value = 0.0;

    // 5. Headphone Crossfeed
    this.crossfeedFilterL = this.audioCtx.createBiquadFilter();
    this.crossfeedFilterR = this.audioCtx.createBiquadFilter();
    this.crossfeedFilterL.type = 'lowpass';
    this.crossfeedFilterR.type = 'lowpass';
    this.crossfeedFilterL.frequency.value = 700;
    this.crossfeedFilterR.frequency.value = 700;

    this.crossfeedDelayL = this.audioCtx.createDelay(0.01);
    this.crossfeedDelayR = this.audioCtx.createDelay(0.01);
    this.crossfeedDelayL.delayTime.value = 0.0003; // 300 microseconds
    this.crossfeedDelayR.delayTime.value = 0.0003;

    this.crossfeedGainL = this.audioCtx.createGain();
    this.crossfeedGainR = this.audioCtx.createGain();
    this.crossfeedGainL.gain.value = 0.0;
    this.crossfeedGainR.gain.value = 0.0;

    // 6. Room Simulation Convolver Reverb
    this.convolverNode = this.audioCtx.createConvolver();
    this.convolverSendGain = this.audioCtx.createGain();
    this.convolverReturnGain = this.audioCtx.createGain();
    this.convolverSendGain.gain.value = 0.0;
    this.convolverReturnGain.gain.value = 0.0;
    this.generateRoomImpulse();

    // 7. Correlation Analyser taps
    this.corrSplitter = this.audioCtx.createChannelSplitter(2);
    this.leftCorrAnalyser = this.audioCtx.createAnalyser();
    this.rightCorrAnalyser = this.audioCtx.createAnalyser();
    this.leftCorrAnalyser.fftSize = 512;
    this.rightCorrAnalyser.fftSize = 512;

    // --- Signal Connections ---
    sourceNode.connect(this.inputNode);

    // Dry path: direct to output
    this.inputNode.connect(this.dryNode);
    this.dryNode.connect(this.outputNode);

    // Wet spatial path
    this.inputNode.connect(this.distanceDampingNode);
    if (this.pannerNode && this.splitterNode) {
      this.distanceDampingNode.connect(this.pannerNode);
      this.pannerNode.connect(this.splitterNode);
    } else if (this.splitterNode) {
      this.distanceDampingNode.connect(this.splitterNode);
    }

    // Channel 0 (L) & Channel 1 (R)
    // Haas surround delay paths
    this.splitterNode.connect(this.leftDelayNode, 0);
    this.splitterNode.connect(this.rightDelayNode, 1);
    this.leftDelayNode.connect(this.surroundDiffGainL);
    this.rightDelayNode.connect(this.surroundDiffGainR);
    this.surroundDiffGainL.connect(this.mergerNode, 0, 0);
    this.surroundDiffGainR.connect(this.mergerNode, 0, 1);

    // Direct L & R into merger
    this.splitterNode.connect(this.mergerNode, 0, 0);
    this.splitterNode.connect(this.mergerNode, 1, 1);

    // Crossfeed paths (L -> R, R -> L)
    this.splitterNode.connect(this.crossfeedFilterL, 0);
    this.splitterNode.connect(this.crossfeedFilterR, 1);
    this.crossfeedFilterL.connect(this.crossfeedDelayL);
    this.crossfeedFilterR.connect(this.crossfeedDelayR);
    this.crossfeedDelayL.connect(this.crossfeedGainL);
    this.crossfeedDelayR.connect(this.crossfeedGainR);
    this.crossfeedGainL.connect(this.mergerNode, 0, 1); // Left crossfed to Right
    this.crossfeedGainR.connect(this.mergerNode, 0, 0); // Right crossfed to Left

    // Center channel extraction: (L + R) sent to both channels
    this.splitterNode.connect(this.centerMidGain, 0);
    this.splitterNode.connect(this.centerMidGain, 1);
    this.centerMidGain.connect(this.mergerNode, 0, 0);
    this.centerMidGain.connect(this.mergerNode, 0, 1);

    // Merger feeds wet node and convolver send
    this.mergerNode.connect(this.wetNode);
    this.mergerNode.connect(this.convolverSendGain);
    this.convolverSendGain.connect(this.convolverNode);
    this.convolverNode.connect(this.convolverReturnGain);
    this.convolverReturnGain.connect(this.wetNode);

    // Wet node merges to output
    this.wetNode.connect(this.outputNode);

    // Output is tapped for real-time phase correlation
    this.outputNode.connect(this.corrSplitter);
    this.corrSplitter.connect(this.leftCorrAnalyser, 0);
    this.corrSplitter.connect(this.rightCorrAnalyser, 1);

    this.isInitialized = true;
    this.applyAllSettings();

    return this.outputNode;
  }

  // --- Parameter Setters ---

  public enable(): void {
    this.state.enabled = true;
    if (this.state.mode === 'off') {
      this.state.mode = 'headphone_spatial';
    }
    if (this.state.intensity === 0) {
      this.state.intensity = 0.5;
    }
    this.applyAllSettings();
  }

  public disable(): void {
    this.state.enabled = false;
    this.state.mode = 'off';
    this.state.intensity = 0.0;
    this.applyAllSettings();
  }

  public setMode(mode: SpatialMode): void {
    this.state.mode = mode;
    if (mode === 'off') {
      this.state.enabled = false;
      this.state.intensity = 0.0;
    } else {
      this.state.enabled = true;
      if (this.state.intensity === 0) {
        this.state.intensity = 0.6;
      }
    }
    this.applyAllSettings();
  }

  public setIntensity(intensity: number): void {
    this.state.intensity = Math.max(0, Math.min(1.5, intensity));
    if (this.state.intensity > 0 && !this.state.enabled) {
      this.state.enabled = true;
      if (this.state.mode === 'off') {
        this.state.mode = 'headphone_spatial';
      }
    }
    this.applyAllSettings();
  }

  public setPosition(azimuthOrObj: number | Partial<SpatialPosition>, elevation?: number, distance?: number, depth?: number): void {
    if (typeof azimuthOrObj === 'object') {
      const p = azimuthOrObj;
      if (p.azimuth !== undefined) this.state.position.azimuth = Math.max(-180, Math.min(180, p.azimuth));
      if (p.elevation !== undefined) this.state.position.elevation = Math.max(-90, Math.min(90, p.elevation));
      if (p.distance !== undefined) {
        this.state.position.distance = Math.max(0, Math.min(1, p.distance));
        this.state.distance = this.state.position.distance;
      }
      if (p.depth !== undefined) {
        this.state.position.depth = Math.max(0, Math.min(1, p.depth));
        this.state.depth = this.state.position.depth;
      }
    } else {
      this.state.position.azimuth = Math.max(-180, Math.min(180, azimuthOrObj));
      if (elevation !== undefined) this.state.position.elevation = Math.max(-90, Math.min(90, elevation));
      if (distance !== undefined) {
        this.state.position.distance = Math.max(0, Math.min(1, distance));
        this.state.distance = this.state.position.distance;
      }
      if (depth !== undefined) {
        this.state.position.depth = Math.max(0, Math.min(1, depth));
        this.state.depth = this.state.position.depth;
      }
    }
    this.apply3DPosition();
  }

  public setAzimuth(azimuth: number): void {
    this.state.position.azimuth = Math.max(-180, Math.min(180, azimuth));
    this.apply3DPosition();
  }

  public setElevation(elevation: number): void {
    this.state.position.elevation = Math.max(-90, Math.min(90, elevation));
    this.apply3DPosition();
  }

  public setDistance(distance: number): void {
    this.state.position.distance = Math.max(0, Math.min(1, distance));
    this.state.distance = this.state.position.distance;
    this.apply3DPosition();
  }

  public setDepth(depth: number): void {
    this.state.position.depth = Math.max(0, Math.min(1, depth));
    this.state.depth = this.state.position.depth;
    this.apply3DPosition();
  }

  public setStereoWidth(width: number): void {
    this.state.stereoWidth = Math.max(0, Math.min(1.5, width));
    this.state.width = this.state.stereoWidth;
    this.applyAllSettings();
  }

  public setWidth(width: number): void {
    this.setStereoWidth(width);
  }

  public setCenterLevel(level: number): void {
    this.state.centerLevel = Math.max(-1, Math.min(1, level));
    if (this.audioCtx && this.centerMidGain) {
      const g = this.state.bypass || !this.state.enabled ? 0 : this.state.centerLevel * 0.35;
      this.centerMidGain.gain.setValueAtTime(g, this.audioCtx.currentTime);
    }
  }

  public setSurroundBalance(balance: number): void {
    this.state.surroundBalance = Math.max(-1, Math.min(1, balance));
    this.applySurroundSettings();
  }

  public setRoomSize(size: RoomSizeType): void {
    this.state.roomSize = size;
    this.generateRoomImpulse();
    this.applyRoomSettings();
  }

  public setRoomMix(mix: number): void {
    this.state.roomMix = Math.max(0, Math.min(1, mix));
    this.applyRoomSettings();
  }

  public setReverbDecay(decay: number): void {
    this.state.reverbDecay = Math.max(0.1, Math.min(10, decay));
    this.generateRoomImpulse();
  }

  public setCrossfeed(crossfeed: CrossfeedMode): void {
    this.state.crossfeed = crossfeed;
    this.applyCrossfeedSettings();
  }

  public setBypass(bypass: boolean): void {
    this.state.bypass = bypass;
    this.applyAllSettings();
  }

  public toggleAB(): void {
    if (this.state.abState === 'A') {
      this.savedStateA = JSON.parse(JSON.stringify(this.state));
      this.state.abState = 'B';
      this.setBypass(true);
    } else {
      this.state.abState = 'A';
      if (this.savedStateA) {
        this.loadState(this.savedStateA);
      } else {
        this.setBypass(false);
      }
    }
  }

  public toggleABComparison(): void {
    this.toggleAB();
    this.state.abComparison = this.state.abState === 'B';
  }

  public loadPreset(preset: SpatialPreset): void {
    this.state = {
      ...this.state,
      ...preset.state,
      activePreset: preset.name,
      position: {
        ...this.state.position,
        ...(preset.state.position || {}),
      },
    };
    this.generateRoomImpulse();
    this.applyAllSettings();
  }

  public loadState(newState: Partial<SpatialState>): void {
    this.state = {
      ...this.state,
      ...newState,
      position: {
        ...this.state.position,
        ...(newState.position || {}),
      },
    };
    this.generateRoomImpulse();
    this.applyAllSettings();
  }

  public reset(): void {
    this.loadState({
      ...DEFAULT_SPATIAL_STATE,
      position: { ...DEFAULT_SPATIAL_STATE.position },
    });
  }

  public resetToDefaults(): void {
    this.reset();
  }

  public getState(): SpatialState {
    return {
      ...this.state,
      stereoWidth: this.state.width,
      position: { ...this.state.position },
      correlation: this.getCorrelation(),
      monoWarning: this.state.correlation < -0.15,
    };
  }

  public getCapabilities(): SpatialCapabilities {
    if (!this.audioCtx) {
      return {
        nativeSpatialAvailable: false,
        hardwareSpatialAvailable: false,
        maxChannels: 2,
        sampleRate: 44100,
        statusText: 'Software Spatial Processing Available',
      };
    }

    const maxCh = this.audioCtx.destination.maxChannelCount || 2;
    const isMultiChannel = maxCh > 2;

    return {
      nativeSpatialAvailable: isMultiChannel,
      hardwareSpatialAvailable: isMultiChannel,
      maxChannels: maxCh,
      sampleRate: this.audioCtx.sampleRate,
      statusText: isMultiChannel
        ? `Native Multi-Channel Destination (${maxCh} ch)`
        : 'Software Spatial Processing (Stereo / Binaural)',
    };
  }

  // --- Real-Time Signal Diagnostics ---

  public getCorrelation(): number {
    if (!this.leftCorrAnalyser || !this.rightCorrAnalyser) return 0.85;

    try {
      this.leftCorrAnalyser.getFloatTimeDomainData(this.leftBuffer);
      this.rightCorrAnalyser.getFloatTimeDomainData(this.rightBuffer);

      let sumLR = 0;
      let sumL2 = 0;
      let sumR2 = 0;
      const len = this.leftBuffer.length;

      for (let i = 0; i < len; i++) {
        const l = this.leftBuffer[i];
        const r = this.rightBuffer[i];
        sumLR += l * r;
        sumL2 += l * l;
        sumR2 += r * r;
      }

      const denominator = Math.sqrt(sumL2 * sumR2);
      if (denominator < 1e-6) return 1.0; // Silence or identical zero

      const corr = sumLR / denominator;
      const clamped = Math.max(-1.0, Math.min(1.0, corr));
      this.state.correlation = Math.round(clamped * 100) / 100;
      this.state.monoWarning = this.state.correlation < -0.15;
      return this.state.correlation;
    } catch {
      return 0.85;
    }
  }

  public getPhaseCorrelation(): { correlation: number; isMonoCompatible: boolean } {
    const correlation = this.getCorrelation();
    return {
      correlation,
      isMonoCompatible: correlation >= -0.15,
    };
  }

  // --- Internal DSP Routing Helpers ---

  private applyAllSettings(): void {
    if (!this.audioCtx) return;

    const isActive = this.state.enabled && !this.state.bypass && this.state.mode !== 'off';
    const effectiveIntensity = isActive ? this.state.intensity : 0.0;

    // Crossfade Dry and Wet paths smoothly
    const wetGain = Math.min(1.0, effectiveIntensity * 0.95);
    const dryGain = Math.max(0.0, 1.0 - effectiveIntensity * 0.55);

    const t = this.audioCtx.currentTime;
    if (this.dryNode) this.dryNode.gain.setValueAtTime(dryGain, t);
    if (this.wetNode) this.wetNode.gain.setValueAtTime(wetGain, t);

    this.apply3DPosition();
    this.applySurroundSettings();
    this.applyCrossfeedSettings();
    this.applyRoomSettings();
    this.setCenterLevel(this.state.centerLevel);
  }

  private apply3DPosition(): void {
    if (!this.audioCtx || !this.pannerNode || !this.distanceDampingNode) return;

    const isActive = this.state.enabled && !this.state.bypass && this.state.mode !== 'off';
    const t = this.audioCtx.currentTime;

    if (!isActive) {
      // Default center forward position
      if (this.pannerNode.positionX?.setValueAtTime) {
        this.pannerNode.positionX.setValueAtTime(0, t);
        this.pannerNode.positionY.setValueAtTime(0, t);
        this.pannerNode.positionZ.setValueAtTime(-1, t);
      }
      if (this.distanceDampingNode.frequency?.setValueAtTime) {
        this.distanceDampingNode.frequency.setValueAtTime(20000, t);
      } else {
        this.distanceDampingNode.frequency.value = 20000;
      }
      return;
    }

    // Convert Azimuth (-180° to +180°) and Elevation (-90° to +90°) to 3D Cartesian coordinates
    const azRad = (this.state.position.azimuth * Math.PI) / 180;
    const elRad = (this.state.position.elevation * Math.PI) / 180;
    const dist = 0.5 + this.state.position.distance * 3.5; // 0.5m to 4m

    const x = Math.sin(azRad) * Math.cos(elRad) * dist;
    const y = Math.sin(elRad) * dist;
    const z = -Math.cos(azRad) * Math.cos(elRad) * dist;

    if (this.pannerNode.positionX?.setValueAtTime) {
      this.pannerNode.positionX.setValueAtTime(x, t);
      this.pannerNode.positionY.setValueAtTime(y, t);
      this.pannerNode.positionZ.setValueAtTime(z, t);
    }

    // Distance air-absorption filter: higher distance rolls off top end slightly
    const cutoff = 20000 - this.state.position.distance * 10000;
    const clampedCutoff = Math.max(4000, cutoff);
    if (this.distanceDampingNode.frequency?.setValueAtTime) {
      this.distanceDampingNode.frequency.setValueAtTime(clampedCutoff, t);
    } else {
      this.distanceDampingNode.frequency.value = clampedCutoff;
    }
  }

  private applySurroundSettings(): void {
    if (!this.audioCtx || !this.surroundDiffGainL || !this.surroundDiffGainR) return;

    const isActive = this.state.enabled && !this.state.bypass && this.state.mode !== 'off';
    const t = this.audioCtx.currentTime;

    if (!isActive) {
      this.surroundDiffGainL.gain.setValueAtTime(0, t);
      this.surroundDiffGainR.gain.setValueAtTime(0, t);
      return;
    }

    let surroundMult = 0.25;
    if (this.state.mode === 'virtual_surround') surroundMult = 0.55;
    if (this.state.mode === 'cinema') surroundMult = 0.65;
    if (this.state.mode === 'live') surroundMult = 0.45;

    const balanceL = 1 - Math.max(0, this.state.surroundBalance);
    const balanceR = 1 + Math.min(0, this.state.surroundBalance);

    const baseSurround = this.state.intensity * surroundMult;
    this.surroundDiffGainL.gain.setValueAtTime(baseSurround * balanceL, t);
    this.surroundDiffGainR.gain.setValueAtTime(baseSurround * balanceR, t);
  }

  private applyCrossfeedSettings(): void {
    if (!this.audioCtx || !this.crossfeedGainL || !this.crossfeedGainR) return;

    const isActive = this.state.enabled && !this.state.bypass && this.state.mode !== 'off';
    const t = this.audioCtx.currentTime;

    if (!isActive || this.state.crossfeed === 'off') {
      this.crossfeedGainL.gain.setValueAtTime(0, t);
      this.crossfeedGainR.gain.setValueAtTime(0, t);
      return;
    }

    let crossAmount = 0.0;
    if (this.state.crossfeed === 'low') crossAmount = 0.15;
    if (this.state.crossfeed === 'medium') crossAmount = 0.28;
    if (this.state.crossfeed === 'high') crossAmount = 0.42;

    this.crossfeedGainL.gain.setValueAtTime(crossAmount, t);
    this.crossfeedGainR.gain.setValueAtTime(crossAmount, t);
  }

  private applyRoomSettings(): void {
    if (!this.audioCtx || !this.convolverSendGain || !this.convolverReturnGain) return;

    const isActive = this.state.enabled && !this.state.bypass && this.state.mode !== 'off';
    const t = this.audioCtx.currentTime;

    if (!isActive || this.state.roomMix <= 0) {
      this.convolverSendGain.gain.setValueAtTime(0, t);
      this.convolverReturnGain.gain.setValueAtTime(0, t);
      return;
    }

    const mix = Math.min(1.0, this.state.roomMix * this.state.intensity);
    this.convolverSendGain.gain.setValueAtTime(mix * 0.7, t);
    this.convolverReturnGain.gain.setValueAtTime(mix * 0.75, t);
  }

  private generateRoomImpulse(): void {
    if (!this.audioCtx || !this.convolverNode || typeof this.audioCtx.createBuffer !== 'function') return;

    const decayTime = this.state.reverbDecay;
    const rate = this.audioCtx.sampleRate;
    const length = Math.floor(rate * decayTime);
    const impulse = this.audioCtx.createBuffer(2, length, rate);
    const leftChannel = impulse.getChannelData(0);
    const rightChannel = impulse.getChannelData(1);

    let roomDiffusion = 2.0;
    if (this.state.roomSize === 'small') roomDiffusion = 3.5;
    if (this.state.roomSize === 'cathedral') roomDiffusion = 0.8;

    for (let i = 0; i < length; i++) {
      const decay = Math.exp((-i / (rate * (decayTime / roomDiffusion))));
      // Synthetic stereo decorrelated noise envelope
      leftChannel[i] = (Math.random() * 2 - 1) * decay;
      rightChannel[i] = (Math.random() * 2 - 1) * decay;
    }

    this.convolverNode.buffer = impulse;
  }

  public getHonestLabel(mode: string): string {
    switch (mode) {
      case 'off':
      case 'stereo':
        return 'Standard 2.0 Stereo (Direct Output)';
      case 'stereo_wide':
        return 'Wide Stereo (Software DSP)';
      case 'virtual_surround':
        return 'Virtual Spatial Audio (Multi-Channel Simulation)';
      case 'headphone_spatial':
        return 'Headphone Spatialization (Binaural Crossfeed)';
      case '3d_audio':
        return '3D Spatial Audio (HRTF Binaural Positioning)';
      case 'native_spatial':
        return 'Native Multi-Channel Spatial Destination';
      case 'room':
        return 'Acoustic Room Simulation (Convolver Reverb)';
      case 'cinema':
        return 'Cinema Immersion (Surround DSP)';
      case 'live':
        return 'Live Stage Simulation (Acoustic DSP)';
      default:
        return 'Software Spatial Processing';
    }
  }
}

import {
  AudioEngineEventType,
  AudioEngineState,
  AudioLevelData,
  AudioOutputDevice,
  AudioProfileName,
  DspProcessingState,
  PlaybackStatus,
  RepeatMode,
  SpatialMode,
  Track,
  OutputDeviceInfo,
  OutputDeviceType,
  AudioFocusEvent,
} from '../types';
import { AUDIO_PROFILE_PRESETS } from './AudioProfiles';
import { audioProcessorInstance, AudioProcessor } from './AudioProcessor';
import { SpatialAudioEngine } from './SpatialAudioEngine';
import { VisualizerEngine } from './VisualizerEngine';
import { AudioSource, LocalAudioSource } from './AudioSource';

type StateListener = (state: AudioEngineState) => void;
type EventListener = (data?: unknown) => void;

export class AudioEngine {
  private audioElement: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private processor: AudioProcessor = audioProcessorInstance;
  public readonly spatialEngine: SpatialAudioEngine = audioProcessorInstance.spatialEngine;
  public readonly visualizerEngine = audioProcessorInstance.visualizerEngine;

  // Audio source abstraction (local or online YouTube)
  private activeAudioSource: AudioSource | null = null;

  // Next track preload element for gapless preparation
  private preloadElement: HTMLAudioElement | null = null;

  // State
  private currentTrack: Track | null = null;
  private status: PlaybackStatus = 'idle';
  private volume = 0.8;
  private previousVolume = 0.8;
  private boostLevel = 1.0; // 1.0 = 100%, up to 3.0 = 300%
  private isMuted = false;
  private playbackRate = 1.0;
  private repeatMode: RepeatMode = 'off';
  private isShuffle = false;
  private activeProfile: AudioProfileName = 'Flat';
  private spatialMode: SpatialMode = 'off';
  private outputDeviceId = 'default';
  private error: string | null = null;
  private bufferedPercent = 0;
  private bufferedSeconds = 0;
  private crossfadeDuration = 0;
  private replayGainMode: 'off' | 'track' | 'album' = 'off';
  private fadeInDuration = 0;
  private fadeOutDuration = 0;
  private isCrossfading = false;
  private isDucked = false;
  private duckFactor = 1.0;

  private listeners: Set<StateListener> = new Set();
  private eventListeners: Map<AudioEngineEventType, Set<EventListener>> = new Map();
  private isAudioGraphInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initAudioElement();
    }
  }

  private initAudioElement() {
    if (typeof Audio === 'undefined') return;
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = 'anonymous';
    this.audioElement.preload = 'metadata';
    // Maintain natural pitch when changing playback speed (0.5x - 2.0x)
    if ('preservesPitch' in this.audioElement) {
      this.audioElement.preservesPitch = true;
    }

    this.audioElement.addEventListener('timeupdate', () => {
      this.emit('POSITION_CHANGED', this.audioElement?.currentTime || 0);
      this.notify();
    });

    this.audioElement.addEventListener('loadedmetadata', () => {
      this.emit('DURATION_CHANGED', this.getDuration());
      this.notify();
    });

    this.audioElement.addEventListener('progress', () => {
      this.updateBufferingProgress();
    });

    this.audioElement.addEventListener('play', () => {
      this.status = 'playing';
      this.emit('PLAY_STARTED', this.currentTrack);
      this.notify();
    });

    this.audioElement.addEventListener('pause', () => {
      if (this.status !== 'error') {
        this.status = 'paused';
        this.emit('PLAY_PAUSED', this.currentTrack);
      }
      this.notify();
    });

    this.audioElement.addEventListener('ended', () => {
      if (this.repeatMode === 'one') {
        if (this.audioElement) {
          this.audioElement.currentTime = 0;
          this.audioElement.play().catch(() => {});
        }
      } else {
        this.status = 'stopped';
        this.emit('TRACK_FINISHED', this.currentTrack);
        this.notify();
      }
    });

    this.audioElement.addEventListener('error', () => {
      this.status = 'error';
      this.error = this.audioElement?.error?.message || 'Playback error occurred.';
      this.emit('PLAYBACK_ERROR', this.error);
      this.notify();
    });
  }

  private setupWebAudioGraph() {
    if (this.isAudioGraphInitialized || !this.audioElement || typeof window === 'undefined') return;

    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);

      // Central AudioProcessor handles the complete pipeline:
      // SOURCE -> PREAMP -> 9-BAND EQ -> BASS/TREBLE -> VOCAL -> COMP/LOUDNESS -> STEREO -> BOOST -> LIMITER -> MASTER -> ANALYSER
      const dspOutput = this.processor.init(this.audioCtx, this.sourceNode);
      dspOutput.connect(this.audioCtx.destination);

      this.isAudioGraphInitialized = true;
      this.applyProfile(this.activeProfile);
    } catch (err) {
      console.warn('WebAudio graph initialization deferred or failed:', err);
    }
  }

  // --- Subscriptions & Events ---

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  public on(event: AudioEngineEventType, callback: EventListener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  public emit(event: AudioEngineEventType, data?: unknown): void {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach((h) => {
        try {
          h(data);
        } catch (err) {
          console.error(`AudioEngine event listener error on ${event}:`, err);
        }
      });
    }
  }

  private notify() {
    const s = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(s);
      } catch (err) {
        console.error('AudioEngine state listener error:', err);
      }
    });
  }

  public getState(): AudioEngineState {
    const currentTime = this.audioElement?.currentTime || 0;
    const duration =
      this.audioElement?.duration && !isNaN(this.audioElement.duration)
        ? this.audioElement.duration
        : this.currentTrack?.duration || 0;

    const procState = this.processor.getProcessingState();

    return {
      status: this.status,
      currentTime,
      duration,
      bufferedPercent: this.bufferedPercent,
      bufferedSeconds: this.bufferedSeconds,
      volume: this.volume,
      previousVolume: this.previousVolume,
      boostLevel: procState.volumeBoost,
      isMuted: this.isMuted,
      playbackRate: this.playbackRate,
      repeatMode: this.repeatMode,
      isShuffle: this.isShuffle,
      activeProfile: (procState.activeProfile as AudioProfileName) || this.activeProfile,
      spatialMode: this.spatialMode,
      isClippingLimiterActive: procState.limiter.enabled && procState.volumeBoost > 1.0,
      outputDeviceId: this.outputDeviceId,
      error: this.error,
    };
  }

  private updateBufferingProgress(): void {
    if (!this.audioElement) return;
    const dur = this.getDuration();
    const buf = this.audioElement.buffered;
    if (dur > 0 && buf && buf.length > 0) {
      const endSec = buf.end(buf.length - 1);
      this.bufferedSeconds = endSec;
      this.bufferedPercent = Math.min(100, Math.round((endSec / dur) * 100));
      this.activeAudioSource?.updateBuffered(this.bufferedSeconds, dur);
      this.emit('BUFFERING_PROGRESS', {
        bufferedPercent: this.bufferedPercent,
        bufferedSeconds: this.bufferedSeconds,
      });
      this.notify();
    }
  }

  public getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  public getPosition(): number {
    return this.audioElement?.currentTime || 0;
  }

  public getCurrentTime(): number {
    return this.getPosition();
  }

  public getDuration(): number {
    return (
      (this.audioElement?.duration && !isNaN(this.audioElement.duration)
        ? this.audioElement.duration
        : this.currentTrack?.duration) || 0
    );
  }

  // --- Central Processor Delegation ---

  public getProcessor(): AudioProcessor {
    return this.processor;
  }

  public getLevelData(): AudioLevelData {
    return this.processor.getLevelData();
  }

  public getProcessingState(): DspProcessingState {
    return this.processor.getProcessingState();
  }

  // --- Playback Controls ---

  public async loadAudioSource(source: AudioSource, autoPlay = true, initialPosition = 0): Promise<void> {
    if (this.activeAudioSource && this.activeAudioSource !== source) {
      this.activeAudioSource.dispose();
    }
    this.activeAudioSource = source;
    const track = source.getTrackMetadata();
    const playbackUrl = await source.getPlaybackUrl();
    await this.loadTrack({ ...track, playbackUrl }, autoPlay, initialPosition);
  }

  public getActiveAudioSource(): AudioSource | null {
    return this.activeAudioSource;
  }

  public async loadTrack(track: Track, autoPlay = true, initialPosition = 0): Promise<void> {
    this.error = null;
    this.currentTrack = track;
    this.processor.visualizerEngine.setTrackMetadata(track);
    this.processor.visualizerEngine.reset();
    this.status = 'loading';
    this.bufferedPercent = 0;
    this.bufferedSeconds = 0;
    this.notify();

    if (!this.audioElement) {
      this.initAudioElement();
    }

    if (!this.isAudioGraphInitialized) {
      this.setupWebAudioGraph();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        // user interaction might be required
      }
    }

    if (this.audioElement) {
      const streamUrl = track.playbackUrl || track.path;
      this.audioElement.src = streamUrl;
      this.audioElement.playbackRate = this.playbackRate;
      this.audioElement.currentTime = initialPosition;

      // Apply replay gain for loaded track (Part 13)
      this.processor.setReplayGainMode(this.replayGainMode, track);

      if (autoPlay) {
        try {
          await this.audioElement.play();
          this.status = 'playing';
          if (this.fadeInDuration > 0) {
            this.fadeIn(this.fadeInDuration).catch(() => {});
          }
        } catch (e: unknown) {
          const err = e as Error;
          if (err.name !== 'AbortError') {
            this.status = 'paused';
          }
        }
      } else {
        this.status = 'paused';
      }
    }

    this.emit('TRACK_LOADED', track);
    this.notify();
  }

  public async play(): Promise<void> {
    if (!this.audioElement || !this.currentTrack) return;

    if (!this.isAudioGraphInitialized) {
      this.setupWebAudioGraph();
    }

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        // ignore
      }
    }

    try {
      await this.audioElement.play();
      this.status = 'playing';
      this.processor.visualizerEngine.start();
      this.error = null;
      this.notify();
    } catch (e: unknown) {
      const err = e as Error;
      this.error = `Playback failed: ${err.message}`;
      this.status = 'error';
      this.emit('PLAYBACK_ERROR', this.error);
      this.notify();
    }
  }

  public async resume(): Promise<void> {
    return this.play();
  }

  public pause(): void {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.status = 'paused';
    this.processor.visualizerEngine.pause();
    this.notify();
  }

  public stop(): void {
    if (!this.audioElement) return;
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.status = 'stopped';
    this.processor.visualizerEngine.reset();
    if (this.activeAudioSource) {
      this.activeAudioSource.dispose();
      this.activeAudioSource = null;
    }
    this.emit('PLAY_STOPPED', this.currentTrack);
    this.notify();
  }

  public seek(seconds: number): void {
    if (!this.audioElement) return;
    const dur = this.getDuration();
    const target = Math.max(0, Math.min(seconds, dur > 0 ? dur : seconds));
    this.audioElement.currentTime = target;
    this.processor.visualizerEngine.reset();
    this.emit('POSITION_CHANGED', target);
    this.notify();
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(vol, 1));
    this.volume = clamped;
    if (clamped > 0) {
      this.previousVolume = clamped;
    }
    const effectiveVolume = this.isMuted ? 0 : (this.isDucked ? clamped * this.duckFactor : clamped);
    this.processor.setMasterVolume(effectiveVolume);
    if (this.audioElement) {
      this.audioElement.volume = effectiveVolume;
    }
    this.emit('VOLUME_CHANGED', clamped);
    this.notify();
  }

  public getVolume(): number {
    return this.volume;
  }

  public setMute(mute: boolean): void {
    this.isMuted = mute;
    if (mute) {
      if (this.volume > 0) {
        this.previousVolume = this.volume;
      }
    } else {
      if (this.volume === 0 && this.previousVolume > 0) {
        this.volume = this.previousVolume;
      }
    }

    const effectiveVolume = this.isMuted ? 0 : (this.isDucked ? this.volume * this.duckFactor : this.volume);
    this.processor.setMute(mute);
    if (this.audioElement) {
      this.audioElement.volume = effectiveVolume;
    }
    this.emit('MUTE_CHANGED', mute);
    this.notify();
  }

  public toggleMute(): void {
    this.setMute(!this.isMuted);
  }

  /**
   * Reduces audio output volume temporarily (e.g. during navigation or assistant prompt).
   * Does NOT alter the user's volume setting.
   */
  public duck(factor = 0.25): void {
    if (this.isDucked) return;
    this.isDucked = true;
    this.duckFactor = Math.max(0.05, Math.min(1.0, factor));
    const effectiveVolume = (this.isMuted ? 0 : this.volume) * this.duckFactor;
    this.processor.setMasterVolume(effectiveVolume);
    if (this.audioElement) {
      this.audioElement.volume = effectiveVolume;
    }
  }

  /**
   * Restores audio volume to the user's original setting after ducking ends.
   */
  public unduck(): void {
    if (!this.isDucked) return;
    this.isDucked = false;
    this.duckFactor = 1.0;
    const effectiveVolume = this.isMuted ? 0 : this.volume;
    this.processor.setMasterVolume(effectiveVolume);
    if (this.audioElement) {
      this.audioElement.volume = effectiveVolume;
    }
  }

  public isAudioDucked(): boolean {
    return this.isDucked;
  }

  public emitAudioFocusChanged(event: AudioFocusEvent): void {
    this.emit('AUDIO_FOCUS_CHANGED', event);
  }

  public emitAudioRouteChanged(device: AudioOutputDevice): void {
    this.emit('AUDIO_ROUTE_CHANGED', device);
  }

  public setPlaybackRate(rate: number): void {
    const clamped = Math.max(0.5, Math.min(rate, 2.5));
    this.playbackRate = clamped;
    if (this.audioElement) {
      this.audioElement.playbackRate = clamped;
    }
    this.notify();
  }

  public setRate(rate: number): void {
    this.setPlaybackRate(rate);
  }

  public setRepeatMode(mode: RepeatMode): void {
    this.repeatMode = mode;
    this.emit('REPEAT_CHANGED', mode);
    this.notify();
  }

  public setLoop(mode: RepeatMode): void {
    this.setRepeatMode(mode);
  }

  public setShuffle(shuffle: boolean): void {
    this.isShuffle = shuffle;
    this.emit('SHUFFLE_CHANGED', shuffle);
    this.notify();
  }

  public setVolumeBoost(boost: number): void {
    const clamped = Math.max(1.0, Math.min(boost, 3.0));
    this.boostLevel = clamped;
    this.processor.setVolumeBoost(clamped);
    this.notify();
  }

  public setAudioProfile(profileName: AudioProfileName): void {
    this.activeProfile = profileName;
    this.applyProfile(profileName);
    this.notify();
  }

  public setSpatialMode(mode: SpatialMode): void {
    this.spatialMode = mode;
    this.spatialEngine.setMode(mode);
    this.notify();
  }

  // --- Output Device & Hardware Management ---

  public async getAudioOutputDevices(): Promise<AudioOutputDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [{ deviceId: 'default', label: 'Default System Output' }];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputDevices = devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d, index) => ({
          deviceId: d.deviceId || `device_${index}`,
          label: d.label || (index === 0 ? 'Default Audio Output' : `Audio Output ${index + 1}`),
          groupId: d.groupId,
        }));
      return outputDevices.length > 0
        ? outputDevices
        : [{ deviceId: 'default', label: 'Default Audio Device' }];
    } catch {
      return [{ deviceId: 'default', label: 'Default Audio Device' }];
    }
  }

  public async setAudioOutputDevice(deviceId: string): Promise<boolean> {
    this.outputDeviceId = deviceId;
    if (
      this.audioElement &&
      typeof (this.audioElement as unknown as { setSinkId?: (id: string) => Promise<void> }).setSinkId ===
        'function'
    ) {
      try {
        await (this.audioElement as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(
          deviceId
        );
        this.emit('OUTPUT_DEVICE_CHANGED', deviceId);
        this.notify();
        return true;
      } catch (err) {
        console.warn('setSinkId failed:', err);
        return false;
      }
    }
    this.emit('OUTPUT_DEVICE_CHANGED', deviceId);
    this.notify();
    return true;
  }

  public classifyDeviceType(label: string): OutputDeviceType {
    const l = (label || '').toLowerCase();
    if (/bluetooth|buds|airpods|wireless|bt\b/i.test(l)) return 'bluetooth';
    if (/headphone|headset|earphone/i.test(l)) return 'headphones';
    if (/usb/i.test(l)) return 'usb';
    if (/speaker|internal|built-in/i.test(l)) return 'speaker';
    return 'speaker';
  }

  public async getDetailedOutputDevices(): Promise<OutputDeviceInfo[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [
        {
          deviceId: 'default',
          label: 'Default Audio Device',
          type: 'speaker',
          isDefault: true,
          isActive: true,
        },
      ];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputDevices = devices.filter((d) => d.kind === 'audiooutput');
      if (outputDevices.length === 0) {
        return [
          {
            deviceId: 'default',
            label: 'Default Audio Device',
            type: 'speaker',
            isDefault: true,
            isActive: true,
          },
        ];
      }
      return outputDevices.map((d, index) => {
        const id = d.deviceId || `device_${index}`;
        const label = d.label || (index === 0 ? 'Default Audio Output' : `Audio Device ${index + 1}`);
        return {
          deviceId: id,
          label,
          type: this.classifyDeviceType(label),
          groupId: d.groupId,
          isDefault: id === 'default' || index === 0,
          isActive: id === this.outputDeviceId || (this.outputDeviceId === 'default' && index === 0),
        };
      });
    } catch {
      return [
        {
          deviceId: 'default',
          label: 'Default Audio Device',
          type: 'speaker',
          isDefault: true,
          isActive: true,
        },
      ];
    }
  }

  public setReplayGainMode(mode: 'off' | 'track' | 'album'): void {
    this.replayGainMode = mode;
    if (this.currentTrack) {
      this.processor.setReplayGainMode(mode, this.currentTrack);
    }
  }

  public getReplayGainMode(): 'off' | 'track' | 'album' {
    return this.replayGainMode;
  }

  public setCrossfadeDuration(sec: number): void {
    this.crossfadeDuration = Math.max(0, Math.min(12, sec));
  }

  public getCrossfadeDuration(): number {
    return this.crossfadeDuration;
  }

  public setFadeDurations(fadeInSec: number, fadeOutSec: number): void {
    this.fadeInDuration = Math.max(0, Math.min(5, fadeInSec));
    this.fadeOutDuration = Math.max(0, Math.min(5, fadeOutSec));
  }

  public async fadeIn(durationSec = 1.0): Promise<void> {
    if (!this.audioElement || durationSec <= 0) return;
    const targetVol = this.isMuted ? 0 : this.volume;
    const steps = 15;
    const stepInterval = (durationSec * 1000) / steps;
    this.audioElement.volume = 0;
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, stepInterval));
      if (this.audioElement) {
        this.audioElement.volume = (i / steps) * targetVol;
      }
    }
  }

  public async fadeOut(durationSec = 1.0): Promise<void> {
    if (!this.audioElement || durationSec <= 0) return;
    const startVol = this.audioElement.volume;
    const steps = 15;
    const stepInterval = (durationSec * 1000) / steps;
    for (let i = steps - 1; i >= 0; i--) {
      await new Promise((r) => setTimeout(r, stepInterval));
      if (this.audioElement) {
        this.audioElement.volume = (i / steps) * startVol;
      }
    }
    this.pause();
    if (this.audioElement) {
      this.audioElement.volume = this.isMuted ? 0 : this.volume;
    }
  }

  public isLossless(track: Track | null = this.currentTrack): boolean {
    if (!track) return false;
    const fmt = (track.format || '').toLowerCase().replace(/^\./, '');
    const codec = (track.codec || '').toLowerCase();
    return (
      ['flac', 'wav', 'alac', 'aiff', 'ape'].includes(fmt) ||
      codec.includes('flac') ||
      codec.includes('alac') ||
      codec.includes('pcm')
    );
  }

  public isHiRes(track: Track | null = this.currentTrack): boolean {
    if (!track) return false;
    const sr = track.sampleRate || 0;
    const bd = track.bitDepth || 0;
    return sr >= 96000 || bd >= 24;
  }

  public getAudioFormatBadge(track: Track | null = this.currentTrack): string {
    if (!track) return '';
    if (this.isHiRes(track)) return 'Hi-Res Lossless';
    if (this.isLossless(track)) return 'Lossless';
    if (track.bitrate && track.bitrate >= 256) return `${track.bitrate} kbps`;
    return (track.format || 'AUDIO').toUpperCase();
  }

  /**
   * Prepares the next track for near-gapless transition by preloading metadata/buffering.
   */
  public prepareNextTrack(track: Track): void {
    if (typeof window === 'undefined') return;
    try {
      if (!this.preloadElement) {
        this.preloadElement = new Audio();
        this.preloadElement.preload = 'metadata';
      }
      this.preloadElement.src = track.path;
    } catch {
      // ignore
    }
  }

  private applyProfile(profileName: AudioProfileName) {
    const preset = AUDIO_PROFILE_PRESETS[profileName];
    if (!preset) return;

    this.processor.loadState({
      activeProfile: profileName,
      preampDb: preset.preampDb || 0,
      eqBands: preset.bands.map((b) => b.gain),
      bassBoostDb: preset.bassGain || 0,
      trebleDb: preset.trebleGain || 0,
      vocalMode: preset.vocalMode || 'off',
      loudnessMode: preset.loudnessMode || 'off',
      stereoWidth: preset.stereoWidth || 1.0,
    });
  }

  public getSpatialEngine(): SpatialAudioEngine {
    return this.processor.spatialEngine;
  }

  public getVisualizerEngine(): VisualizerEngine {
    return this.processor.visualizerEngine;
  }
}

export const audioEngineInstance = new AudioEngine();

import { AudioFocusState, AudioInterruptionType } from '../../types';

export interface AudioFocusCallbacks {
  onPause: () => void;
  onResume: () => void;
  onDuck: (duckFactor?: number) => void;
  onUnduck: () => void;
  isPlaying: () => boolean;
}

export interface AudioFocusOptions {
  audioFocusMode: 'follow_system' | 'pause' | 'duck';
  resumeAfterInterruption: boolean;
  duckVolumePercent: number; // e.g. 25
}

export class AudioFocusManager {
  private static instance: AudioFocusManager | null = null;
  private callbacks: AudioFocusCallbacks | null = null;
  private options: AudioFocusOptions = {
    audioFocusMode: 'follow_system',
    resumeAfterInterruption: true,
    duckVolumePercent: 25,
  };

  private currentFocusState: AudioFocusState = 'GAIN';
  private wasPlayingBeforeInterruption = false;
  private isInterruptionActive = false;
  private userManuallyPausedDuringInterruption = false;
  private lastInterruptionType: AudioInterruptionType | null = null;

  private constructor() {}

  public static getInstance(): AudioFocusManager {
    if (!this.instance) {
      this.instance = new AudioFocusManager();
    }
    return this.instance;
  }

  public init(callbacks: AudioFocusCallbacks, options?: Partial<AudioFocusOptions>): void {
    this.callbacks = callbacks;
    if (options) {
      this.setOptions(options);
    }
  }

  public setOptions(options: Partial<AudioFocusOptions>): void {
    this.options = { ...this.options, ...options };
  }

  public getFocusState(): AudioFocusState {
    return this.currentFocusState;
  }

  public getIsInterruptionActive(): boolean {
    return this.isInterruptionActive;
  }

  /**
   * Called when another application or OS service changes audio focus state.
   */
  public handleFocusChange(
    state: AudioFocusState,
    interruptionType: AudioInterruptionType = 'transient'
  ): void {
    if (!this.callbacks) return;

    this.currentFocusState = state;
    this.lastInterruptionType = interruptionType;

    switch (state) {
      case 'LOSS': {
        // Permanent audio focus loss (e.g., another media app starts)
        this.isInterruptionActive = false;
        this.wasPlayingBeforeInterruption = false;
        this.userManuallyPausedDuringInterruption = false;
        this.callbacks.onUnduck();
        this.callbacks.onPause();
        break;
      }

      case 'LOSS_TRANSIENT': {
        // Temporary interruption where playback should pause (e.g. phone call, alarm)
        const currentlyPlaying = this.callbacks.isPlaying();
        if (!this.isInterruptionActive) {
          this.wasPlayingBeforeInterruption = currentlyPlaying;
          this.userManuallyPausedDuringInterruption = false;
        }
        this.isInterruptionActive = true;
        this.callbacks.onUnduck();
        this.callbacks.onPause();
        break;
      }

      case 'LOSS_TRANSIENT_CAN_DUCK': {
        // Temporary interruption where ducking is preferred (e.g. navigation prompt)
        const currentlyPlaying = this.callbacks.isPlaying();
        if (!this.isInterruptionActive) {
          this.wasPlayingBeforeInterruption = currentlyPlaying;
          this.userManuallyPausedDuringInterruption = false;
        }
        this.isInterruptionActive = true;

        if (this.options.audioFocusMode === 'pause') {
          // User configured strict pause instead of ducking
          this.callbacks.onPause();
        } else {
          // Duck volume (follow_system or duck mode)
          const duckFactor = Math.max(0.05, Math.min(1.0, this.options.duckVolumePercent / 100));
          this.callbacks.onDuck(duckFactor);
        }
        break;
      }

      case 'GAIN': {
        // Audio focus regained
        this.callbacks.onUnduck();

        const shouldResume =
          this.isInterruptionActive &&
          this.wasPlayingBeforeInterruption &&
          !this.userManuallyPausedDuringInterruption &&
          this.options.resumeAfterInterruption;

        this.isInterruptionActive = false;
        this.wasPlayingBeforeInterruption = false;
        this.userManuallyPausedDuringInterruption = false;

        if (shouldResume) {
          this.callbacks.onResume();
        }
        break;
      }
    }
  }

  /**
   * Tracks explicit user pause action.
   * If the user manually paused during an ongoing interruption (e.g., in UI or notification),
   * the player MUST NOT automatically resume when the interruption ends (Requirement 22).
   */
  public notifyUserManualPause(): void {
    if (this.isInterruptionActive) {
      this.userManuallyPausedDuringInterruption = true;
    }
    this.wasPlayingBeforeInterruption = false;
  }

  /**
   * Tracks explicit user play action.
   */
  public notifyUserManualPlay(): void {
    this.userManuallyPausedDuringInterruption = false;
    this.wasPlayingBeforeInterruption = true;
  }

  /**
   * Helper to simulate or trigger an interruption event (for test suite or external events).
   */
  public triggerInterruption(
    type: AudioInterruptionType,
    canDuck = false
  ): void {
    if (type === 'permanent') {
      this.handleFocusChange('LOSS', type);
    } else if (canDuck && this.options.audioFocusMode !== 'pause') {
      this.handleFocusChange('LOSS_TRANSIENT_CAN_DUCK', type);
    } else {
      this.handleFocusChange('LOSS_TRANSIENT', type);
    }
  }

  /**
   * Helper to signal that an interruption has concluded.
   */
  public finishInterruption(): void {
    this.handleFocusChange('GAIN');
  }

  public reset(): void {
    this.currentFocusState = 'GAIN';
    this.wasPlayingBeforeInterruption = false;
    this.isInterruptionActive = false;
    this.userManuallyPausedDuringInterruption = false;
    this.lastInterruptionType = null;
  }
}

export const audioFocusManagerInstance = AudioFocusManager.getInstance();


import { audioEngineInstance } from '../../audio/AudioEngine';

export type SleepTimerMode = 'duration' | 'end_of_track' | 'end_of_queue' | 'track_count';

export interface SleepTimerState {
  isActive: boolean;
  mode: SleepTimerMode;
  durationMinutes: number;
  targetTimestamp: number | null;
  remainingSeconds: number;
  tracksRemaining: number | null;
  fadeOutSeconds: number;
  isFadingOut: boolean;
}

type SleepTimerListener = (state: SleepTimerState) => void;

export class SleepTimerService {
  private static instance: SleepTimerService | null = null;

  private state: SleepTimerState = {
    isActive: false,
    mode: 'duration',
    durationMinutes: 0,
    targetTimestamp: null,
    remainingSeconds: 0,
    tracksRemaining: null,
    fadeOutSeconds: 15,
    isFadingOut: false,
  };

  private listeners = new Set<SleepTimerListener>();
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private savedMasterVolume: number | null = null;
  private unsubscribeTrackEnded: (() => void) | null = null;

  private constructor() {
    this.setupAudioEngineListeners();
  }

  public static getInstance(): SleepTimerService {
    if (!SleepTimerService.instance) {
      SleepTimerService.instance = new SleepTimerService();
    }
    return SleepTimerService.instance;
  }

  private setupAudioEngineListeners(): void {
    this.unsubscribeTrackEnded = audioEngineInstance.on('TRACK_FINISHED', () => {
      this.handleTrackEnded();
    });
  }

  public subscribe(listener: SleepTimerListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const s = this.getState();
    this.listeners.forEach((l) => {
      try {
        l(s);
      } catch (err) {
        console.error('SleepTimerService listener error:', err);
      }
    });
  }

  public getState(): SleepTimerState {
    return { ...this.state };
  }

  /**
   * Start a sleep timer with a specified duration in minutes
   */
  public startDurationTimer(minutes: number, fadeOutSeconds = 15): void {
    if (minutes <= 0) {
      this.cancel();
      return;
    }

    this.stopTick();
    const durationMs = minutes * 60 * 1000;
    const targetTimestamp = Date.now() + durationMs;
    const totalSeconds = Math.round(durationMs / 1000);

    this.savedMasterVolume = audioEngineInstance.getVolume();
    this.state = {
      isActive: true,
      mode: 'duration',
      durationMinutes: minutes,
      targetTimestamp,
      remainingSeconds: totalSeconds,
      tracksRemaining: null,
      fadeOutSeconds: Math.min(fadeOutSeconds, totalSeconds),
      isFadingOut: false,
    };

    this.startTick();
    this.notify();
  }

  /**
   * Stop after current playing track finishes
   */
  public startEndOfTrackTimer(fadeOutSeconds = 10): void {
    this.stopTick();
    this.savedMasterVolume = audioEngineInstance.getVolume();

    this.state = {
      isActive: true,
      mode: 'end_of_track',
      durationMinutes: 0,
      targetTimestamp: null,
      remainingSeconds: 0,
      tracksRemaining: 1,
      fadeOutSeconds,
      isFadingOut: false,
    };

    this.notify();
  }

  /**
   * Stop after current playback queue finishes
   */
  public startEndOfQueueTimer(fadeOutSeconds = 15): void {
    this.stopTick();
    this.savedMasterVolume = audioEngineInstance.getVolume();

    this.state = {
      isActive: true,
      mode: 'end_of_queue',
      durationMinutes: 0,
      targetTimestamp: null,
      remainingSeconds: 0,
      tracksRemaining: null,
      fadeOutSeconds,
      isFadingOut: false,
    };

    this.notify();
  }

  /**
   * Stop after a specific number of tracks finish
   */
  public startTrackCountTimer(trackCount: number, fadeOutSeconds = 10): void {
    if (trackCount <= 0) {
      this.cancel();
      return;
    }

    this.stopTick();
    this.savedMasterVolume = audioEngineInstance.getVolume();

    this.state = {
      isActive: true,
      mode: 'track_count',
      durationMinutes: 0,
      targetTimestamp: null,
      remainingSeconds: 0,
      tracksRemaining: trackCount,
      fadeOutSeconds,
      isFadingOut: false,
    };

    this.notify();
  }

  /**
   * Cancel any active sleep timer and restore master volume
   */
  public cancel(): void {
    this.stopTick();
    if (this.savedMasterVolume !== null) {
      audioEngineInstance.setVolume(this.savedMasterVolume);
      this.savedMasterVolume = null;
    }

    this.state = {
      isActive: false,
      mode: 'duration',
      durationMinutes: 0,
      targetTimestamp: null,
      remainingSeconds: 0,
      tracksRemaining: null,
      fadeOutSeconds: 15,
      isFadingOut: false,
    };

    this.notify();
  }

  /**
   * Handle track completion
   */
  public handleTrackEnded(isQueueEnd = false): void {
    if (!this.state.isActive) return;

    if (this.state.mode === 'end_of_track') {
      this.executeExpiration();
      return;
    }

    if (this.state.mode === 'end_of_queue' && isQueueEnd) {
      this.executeExpiration();
      return;
    }

    if (this.state.mode === 'track_count' && this.state.tracksRemaining !== null) {
      const remaining = this.state.tracksRemaining - 1;
      if (remaining <= 0) {
        this.executeExpiration();
      } else {
        this.state.tracksRemaining = remaining;
        this.notify();
      }
    }
  }

  private startTick(): void {
    this.stopTick();
    this.tickInterval = setInterval(() => {
      this.onTick();
    }, 1000);
  }

  private stopTick(): void {
    if (this.tickInterval !== null) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private onTick(): void {
    if (!this.state.isActive || !this.state.targetTimestamp) return;

    const now = Date.now();
    const remainingMs = this.state.targetTimestamp - now;
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

    this.state.remainingSeconds = remainingSec;

    // Check if we should start fading out
    if (remainingSec <= this.state.fadeOutSeconds && remainingSec > 0 && this.state.fadeOutSeconds > 0) {
      if (!this.state.isFadingOut) {
        this.state.isFadingOut = true;
        if (this.savedMasterVolume === null) {
          this.savedMasterVolume = audioEngineInstance.getVolume();
        }
      }

      // Calculate faded volume factor
      const fadeFraction = remainingSec / this.state.fadeOutSeconds;
      const initialVol = this.savedMasterVolume ?? 0.8;
      const targetVol = Math.max(0, initialVol * fadeFraction);
      audioEngineInstance.setVolume(targetVol);
    }

    if (remainingMs <= 0) {
      this.executeExpiration();
      return;
    }

    this.notify();
  }

  private executeExpiration(): void {
    this.stopTick();

    // Pause audio cleanly
    try {
      audioEngineInstance.pause();
    } catch (e) {
      console.warn('Failed to pause on sleep timer expiry:', e);
    }

    // Restore original volume for next playback session
    if (this.savedMasterVolume !== null) {
      audioEngineInstance.setVolume(this.savedMasterVolume);
      this.savedMasterVolume = null;
    }

    this.state = {
      isActive: false,
      mode: 'duration',
      durationMinutes: 0,
      targetTimestamp: null,
      remainingSeconds: 0,
      tracksRemaining: null,
      fadeOutSeconds: 15,
      isFadingOut: false,
    };

    this.notify();
  }

  public dispose(): void {
    this.stopTick();
    if (this.unsubscribeTrackEnded) {
      this.unsubscribeTrackEnded();
      this.unsubscribeTrackEnded = null;
    }
    this.listeners.clear();
  }
}

export const sleepTimerService = SleepTimerService.getInstance();

import { TrackResumeRepository } from '../../database/repository';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { Track } from '../../types';

export class TrackResumeService {
  private static instance: TrackResumeService | null = null;
  private currentTrackId: string | null = null;
  private currentDuration = 0;
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  private enabled = true;

  private constructor() {
    this.setupListeners();
  }

  public static getInstance(): TrackResumeService {
    if (!TrackResumeService.instance) {
      TrackResumeService.instance = new TrackResumeService();
    }
    return TrackResumeService.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private setupListeners(): void {
    audioEngineInstance.on('TRACK_LOADED', (data) => {
      const track = data as Track | undefined;
      if (track && track.id) {
        this.onTrackLoaded(track.id, track.duration || 0);
      }
    });

    audioEngineInstance.on('PLAY_PAUSED', () => {
      this.saveCurrentPosition();
    });

    audioEngineInstance.on('TRACK_FINISHED', () => {
      if (this.currentTrackId) {
        this.clearPosition(this.currentTrackId);
      }
    });
  }

  public onTrackLoaded(trackId: string, duration: number): void {
    this.currentTrackId = trackId;
    this.currentDuration = duration;
    this.startPeriodicSave();
  }

  public async getResumePosition(trackId: string): Promise<number | null> {
    if (!this.enabled) return null;
    const record = await TrackResumeRepository.getPosition(trackId);
    if (!record || record.position <= 5) return null;

    // If position is within 5 seconds of the end, restart from beginning
    if (record.duration > 0 && record.duration - record.position <= 5) {
      await this.clearPosition(trackId);
      return null;
    }

    return record.position;
  }

  public async saveCurrentPosition(): Promise<void> {
    if (!this.enabled || !this.currentTrackId) return;

    const currentPos = audioEngineInstance.getPosition();
    const duration = this.currentDuration || audioEngineInstance.getDuration();

    // Only save if listened beyond 5 seconds and not finished
    if (currentPos > 5 && (duration === 0 || duration - currentPos > 5)) {
      await TrackResumeRepository.savePosition(this.currentTrackId, currentPos, duration);
    }
  }

  public async clearPosition(trackId: string): Promise<void> {
    await TrackResumeRepository.clearPosition(trackId);
  }

  private startPeriodicSave(): void {
    this.stopPeriodicSave();
    this.saveInterval = setInterval(() => {
      if (audioEngineInstance.getState().status === 'playing') {
        this.saveCurrentPosition().catch(() => {});
      }
    }, 5000);
  }

  private stopPeriodicSave(): void {
    if (this.saveInterval !== null) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
  }

  public dispose(): void {
    this.stopPeriodicSave();
  }
}

export const trackResumeService = TrackResumeService.getInstance();

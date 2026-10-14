import { ListeningSessionConfig, AudioProfileName, RepeatMode } from '../../types';
import { ListeningSessionRepository } from '../../database/repository';
import { sleepTimerService } from './SleepTimerService';

export const BUILTIN_SESSIONS: ListeningSessionConfig[] = [
  {
    id: 'preset_focus',
    name: 'Focus & Study',
    type: 'focus',
    audioProfile: 'Acoustic',
    sleepTimerMinutes: 45,
    fadeOutSeconds: 15,
    shuffle: false,
    repeatMode: 'all',
    createdAt: 1,
  },
  {
    id: 'preset_workout',
    name: 'Workout & Energy',
    type: 'workout',
    audioProfile: 'Electronic',
    sleepTimerMinutes: undefined,
    fadeOutSeconds: 0,
    shuffle: true,
    repeatMode: 'all',
    createdAt: 2,
  },
  {
    id: 'preset_relax',
    name: 'Relax & Wind Down',
    type: 'relax',
    audioProfile: 'Acoustic',
    sleepTimerMinutes: 30,
    fadeOutSeconds: 20,
    shuffle: false,
    repeatMode: 'all',
    createdAt: 3,
  },
  {
    id: 'preset_sleep',
    name: 'Bedtime Sleep',
    type: 'sleep',
    audioProfile: 'Classical',
    sleepTimerMinutes: 20,
    fadeOutSeconds: 30,
    shuffle: false,
    repeatMode: 'off',
    createdAt: 4,
  },
  {
    id: 'preset_commute',
    name: 'Commute & Travel',
    type: 'commute',
    audioProfile: 'Vocal',
    sleepTimerMinutes: 60,
    fadeOutSeconds: 15,
    shuffle: true,
    repeatMode: 'all',
    createdAt: 5,
  },
];

export class ListeningSessionService {
  private static instance: ListeningSessionService | null = null;

  public static getInstance(): ListeningSessionService {
    if (!ListeningSessionService.instance) {
      ListeningSessionService.instance = new ListeningSessionService();
    }
    return ListeningSessionService.instance;
  }

  public getBuiltinPresets(): ListeningSessionConfig[] {
    return BUILTIN_SESSIONS;
  }

  public async getAllSessions(): Promise<ListeningSessionConfig[]> {
    const custom = await ListeningSessionRepository.getAll();
    return [...BUILTIN_SESSIONS, ...custom];
  }

  public async saveCustomSession(
    name: string,
    config: Omit<ListeningSessionConfig, 'id' | 'createdAt' | 'name' | 'type'>
  ): Promise<ListeningSessionConfig> {
    const newSession: ListeningSessionConfig = {
      id: `session_${Date.now()}`,
      name: name.trim() || 'Custom Session',
      type: 'custom',
      ...config,
      createdAt: Date.now(),
    };
    await ListeningSessionRepository.save(newSession);
    return newSession;
  }

  public async deleteSession(id: string): Promise<void> {
    if (id.startsWith('preset_')) return; // Builtin cannot be deleted
    await ListeningSessionRepository.remove(id);
  }

  /**
   * Applies all session parameters (audio profile, shuffle, repeat, sleep timer)
   */
  public applySession(
    session: ListeningSessionConfig,
    handlers: {
      setAudioProfile?: (p: AudioProfileName) => void;
      setShuffleMode?: (mode: 'off' | 'all') => void;
      setRepeatMode?: (r: RepeatMode) => void;
    }
  ): void {
    if (session.audioProfile && handlers.setAudioProfile) {
      handlers.setAudioProfile(session.audioProfile);
    }

    if (session.shuffle !== undefined && handlers.setShuffleMode) {
      handlers.setShuffleMode(session.shuffle ? 'all' : 'off');
    }

    if (session.repeatMode && handlers.setRepeatMode) {
      handlers.setRepeatMode(session.repeatMode);
    }

    if (session.sleepTimerMinutes && session.sleepTimerMinutes > 0) {
      sleepTimerService.startDurationTimer(session.sleepTimerMinutes, session.fadeOutSeconds || 15);
    }
  }
}

export const listeningSessionService = ListeningSessionService.getInstance();

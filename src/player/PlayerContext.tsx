import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  AudioEngineState,
  AudioLevelData,
  AudioOutputDevice,
  AudioPresetRecord,
  AudioProfileName,
  CompressorConfig,
  DEFAULT_DSP_STATE,
  DspProcessingState,
  LoudnessMode,
  PlaybackSessionRecord,
  PlaybackStatePersistence,
  RepeatMode,
  ShuffleMode,
  SpatialMode,
  SpatialState,
  SpatialCapabilities,
  SpatialPresetName,
  RoomSizeType,
  CrossfeedMode,
  DEFAULT_SPATIAL_STATE,
  VisualizerSettings,
  DEFAULT_VISUALIZER_SETTINGS,
  Track,
  VocalEnhancementMode,
  AudioProfileConfig,
  AudioProfileScope,
  OutputDeviceInfo,
  DolbyStatus,
  AudioProfilesExportBundle,
  AudioFocusState,
  AudioInterruptionType,
} from '../types';
import { audioProfileServiceInstance, DEFAULT_GLOBAL_AUDIO_CONFIG } from '../services/audio/AudioProfileService';
import { mediaSessionServiceInstance } from '../services/media/MediaSessionService';
import { audioFocusManagerInstance } from '../services/audio/AudioFocusManager';
import { audioRouteManagerInstance } from '../services/audio/AudioRouteManager';
import { androidBridgeInstance } from '../services/android/AndroidBridge';
import { mediaStoreSyncServiceInstance, MediaStoreSyncResult } from '../services/android/MediaStoreSyncService';
import { androidWidgetServiceInstance } from '../services/android/AndroidWidgetService';
import { deepLinkManagerInstance } from '../services/navigation/DeepLinkManager';
import { parseAudioFileMetadata, generateTrackIdentity } from '../library/metadataParser';
import { nativeBridge } from '../services/nativeBridge';
import { audioEngineInstance } from '../audio/AudioEngine';
import { AUDIO_PROFILE_PRESETS } from '../audio/AudioProfiles';
import { VisualizerEngine } from '../audio/VisualizerEngine';
import { getSpatialPresetByName, BUILTIN_SPATIAL_PRESETS } from '../audio/SpatialPresets';
import {
  TrackRepository,
  PlayHistoryRepository,
  PlayerStateRepository,
  PlaybackSessionRepository,
  AudioPresetRepository,
  YouTubeHistoryRepository,
  PlaylistRepository,
  PlaylistTrackRepository,
} from '../database/repository';
import { useSettings } from '../settings/SettingsContext';
import {
  YouTubePlaybackState,
  DEFAULT_YOUTUBE_PLAYBACK_STATE,
  YouTubeHistoryRecord,
} from '../types/youtube';
import { YouTubeUrlValidator } from '../services/youtube/YouTubeUrlValidator';
import { YouTubeUrlNormalizer } from '../services/youtube/YouTubeUrlNormalizer';
import { youtubeResolverInstance } from '../services/youtube/YouTubeResolver';
import { NetworkAccessManager } from '../network/NetworkAccessManager';
import { OnlineAudioSource, LocalAudioSource } from '../audio/AudioSource';
import { CacheManager } from '../services/youtube/CacheManager';
import { audioBlobStorageService } from '../services/storage/AudioBlobStorageService';

export interface PlayerContextType {
  state: AudioEngineState;
  currentTrack: Track | null;
  setCurrentTrack: (track: Track | null) => void;
  queue: Track[];
  queueIndex: number;
  isFullPlayerOpen: boolean;
  setIsFullPlayerOpen: (open: boolean) => void;
  isQueueOpen: boolean;
  setIsQueueOpen: (open: boolean) => void;
  toggleQueue: () => void;
  isDspModalOpen: boolean;
  setIsDspModalOpen: (open: boolean) => void;
  toggleDspModal: () => void;
  isSpatialModalOpen: boolean;
  setIsSpatialModalOpen: (open: boolean) => void;
  toggleSpatialModal: () => void;
  isFullscreenVisualizerOpen: boolean;
  setIsFullscreenVisualizerOpen: (open: boolean) => void;
  toggleFullscreenVisualizer: () => void;

  // Playback actions
  playTrack: (track: Track, newQueue?: Track[], startIndex?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  nextTrack: () => Promise<void>;
  prevTrack: () => Promise<void>;
  seek: (seconds: number) => void;
  seekForward: (seconds?: number) => void;
  seekBackward: (seconds?: number) => void;
  setVolume: (vol: number) => void;
  setVolumeBoost: (boost: number) => void;
  setMute: (mute: boolean) => void;
  toggleMute: () => void;
  setPlaybackRate: (rate: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  shuffleMode: ShuffleMode;
  setShuffleMode: (mode: ShuffleMode) => void;
  cycleShuffleMode: () => void;
  toggleShuffle: () => void;
  setAudioProfile: (profile: AudioProfileName) => void;
  setSpatialMode: (mode: SpatialMode) => void;

  // DSP & Advanced Audio Processor Actions (Part 4)
  dspState: DspProcessingState;
  levelData: AudioLevelData;
  setPreamp: (db: number) => void;
  setEqualizerBand: (index: number, gainDb: number) => void;
  setEqualizerBands: (bands: number[]) => void;
  resetEqualizer: () => void;
  setBassBoost: (db: number) => void;
  setTreble: (db: number) => void;
  setVocalEnhancement: (mode: VocalEnhancementMode) => void;
  setLoudness: (mode: LoudnessMode) => void;
  setCompressor: (config: Partial<CompressorConfig>) => void;
  setLimiter: (enabled: boolean, ceilingDb?: number) => void;
  setStereoWidth: (width: number) => void;
  setBalance: (balance: number) => void;
  setMono: (mono: boolean) => void;
  setAutoHeadroom: (enabled: boolean) => void;
  setMaxOutputLevel: (level: number) => void;
  setDspBypass: (bypassed: boolean) => void;
  toggleAbComparison: () => void;
  resetAudioProcessing: () => void;
  loadDspState: (state: Partial<DspProcessingState>) => void;

  // Custom Presets
  customPresets: AudioPresetRecord[];
  saveCustomPreset: (name: string) => Promise<void>;
  deleteCustomPreset: (id: string) => Promise<void>;
  loadPreset: (nameOrId: string) => Promise<void>;

  // Spatial Audio (Part 5)
  spatialState: SpatialState;
  spatialCapabilities: SpatialCapabilities;
  setSpatialIntensity: (intensity: number) => void;
  setSpatialPosition: (azimuth: number, elevation: number, distance: number, depth: number) => void;
  setSpatialAzimuth: (azimuth: number) => void;
  setSpatialElevation: (elevation: number) => void;
  setSpatialDistance: (distance: number) => void;
  setSpatialDepth: (depth: number) => void;
  setSpatialWidth: (width: number) => void;
  setSpatialCenterLevel: (level: number) => void;
  setSpatialSurroundBalance: (balance: number) => void;
  setSpatialRoomSize: (size: RoomSizeType) => void;
  setSpatialRoomMix: (mix: number) => void;
  setSpatialReverbDecay: (decay: number) => void;
  setSpatialCrossfeed: (mode: CrossfeedMode) => void;
  setSpatialBypass: (bypass: boolean) => void;
  toggleSpatialAb: () => void;
  resetSpatialSettings: () => void;
  loadSpatialPreset: (presetNameOrId: string) => Promise<void>;
  saveCustomSpatialPreset: (name: string) => Promise<void>;
  customSpatialPresets: AudioPresetRecord[];
  deleteCustomSpatialPreset: (id: string) => Promise<void>;

  // Visualizer (Part 5)
  visualizerSettings: VisualizerSettings;
  updateVisualizerSettings: (settings: Partial<VisualizerSettings>) => void;
  visualizerEngine: VisualizerEngine;

  // Queue actions
  playNext: (track: Track | Track[]) => void;
  addToQueue: (track: Track | Track[]) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: (keepCurrent?: boolean) => void;

  // Favorite and Rating
  toggleFavorite: (trackId?: string) => Promise<void>;
  setTrackRating: (trackId: string, rating: number) => Promise<void>;

  // Playlists (Part 8)
  playPlaylist: (tracks: Track[], startIndex?: number) => Promise<void>;
  shufflePlaylist: (tracks: Track[]) => Promise<void>;
  saveQueueAsPlaylist: (name: string, description?: string) => Promise<string>;

  // Hardware output devices
  outputDevices: AudioOutputDevice[];
  detailedOutputDevices: OutputDeviceInfo[];
  currentOutputDeviceInfo: OutputDeviceInfo | null;
  setOutputDevice: (deviceId: string) => Promise<boolean>;
  refreshOutputDevices: () => Promise<void>;

  // Online / YouTube Playback & Caching (Parts 6 & 7)
  onlinePlaybackState: YouTubePlaybackState;
  playYouTubeUrl: (url: string, titleOrCache?: string | boolean, artist?: string) => Promise<void>;
  playCachedYouTubeTrack: (historyItem: YouTubeHistoryRecord) => Promise<boolean>;
  cacheYouTubeTrack: (videoId: string, canonicalUrl: string) => Promise<boolean>;
  endOnlineSession: () => void;
  pendingOnlineTrack: Track | null;
  playPendingOnlineTrack: () => Promise<void>;
  cancelPendingOnlineTrack: () => void;

  // Part 13: Advanced Audio Control Center & Audio Profiles
  isAudioControlCenterOpen: boolean;
  setIsAudioControlCenterOpen: (open: boolean) => void;
  toggleAudioControlCenter: () => void;
  audioProfileConfig: AudioProfileConfig;
  audioProfileSource: AudioProfileScope;
  audioProfileMatchedName?: string;
  customProfilesEnabled: boolean;
  setCustomProfilesEnabled: (enabled: boolean) => void;
  isSongProfileRemembered: boolean;
  setRememberSongProfile: (remember: boolean) => void;
  saveCurrentAsSongProfile: () => void;
  clearSongProfile: () => void;
  setAlbumAudioProfile: (album: string, config: Partial<AudioProfileConfig>) => void;
  setArtistAudioProfile: (artist: string, config: Partial<AudioProfileConfig>) => void;
  setGlobalAudioProfile: (config: Partial<AudioProfileConfig>) => void;
  resetAudioSettings: (scope: 'global' | 'song' | 'album' | 'artist' | 'all') => void;
  exportAudioProfiles: () => AudioProfilesExportBundle;
  importAudioProfiles: (bundle: AudioProfilesExportBundle, mode?: 'merge' | 'overwrite') => Promise<{ success: boolean; importedCount: number }>;
  renameCustomPreset: (id: string, newName: string) => Promise<boolean>;
  duplicateCustomPreset: (id: string, newName: string) => Promise<AudioPresetRecord | null>;
  resetCustomPresets: () => Promise<void>;
  setBassBoostPercent: (percent: number) => void;
  resetTreble: () => void;
  setReplayGainMode: (mode: 'off' | 'track' | 'album') => void;
  setVolumeNormalization: (mode: 'off' | 'track' | 'album') => void;
  setPreventClipping: (enabled: boolean) => void;
  setVirtualSurround: (percent: number) => void;
  activeDolbyMode: string;
  setDolbyMode: (mode: string) => void;
  dolbyStatus: DolbyStatus;
  isDolbyHardwareSupported: boolean;
  nightModeEnabled: boolean;
  setNightModeEnabled: (enabled: boolean) => void;
  toggleNightMode: () => void;
  voiceModeEnabled: boolean;
  setVoiceModeEnabled: (enabled: boolean) => void;
  toggleVoiceMode: () => void;
  crossfadeDuration: number;
  setCrossfadeDuration: (sec: number) => void;
  activeAudioBadges: string[];
  audioFormatBadge: string;
  audiobookControls: {
    skipForward10: () => void;
    skipBackward10: () => void;
    skipForward30: () => void;
    skipBackward30: () => void;
    sleepTimerMinutes: number | null;
    setSleepTimer: (minutes: number | null) => void;
  };
  fadeIn: (durationSec?: number) => Promise<void>;
  fadeOut: (durationSec?: number) => Promise<void>;

  // Part 15: Background Playback, Audio Focus, Media Controls & Audio Route
  isAudioOutputModalOpen: boolean;
  setIsAudioOutputModalOpen: (open: boolean) => void;
  openAudioOutputModal: () => void;
  triggerMediaButtonPress: () => void;
  simulateAudioFocusInterruption: (type: AudioInterruptionType, canDuck?: boolean) => void;
  simulateAudioFocusRegain: () => void;

  // Part 16: Android System Integration & Native Device Features
  isStoragePermissionModalOpen: boolean;
  setIsStoragePermissionModalOpen: (open: boolean) => void;
  openStoragePermissionModal: () => void;
  isWidgetPreviewModalOpen: boolean;
  setIsWidgetPreviewModalOpen: (open: boolean) => void;
  openWidgetPreviewModal: () => void;
  shareCurrentTrack: () => Promise<boolean>;
  syncMediaStoreFiles: (files: File[]) => Promise<MediaStoreSyncResult>;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings, updateSettings } = useSettings();
  const [engineState, setEngineState] = useState<AudioEngineState>(audioEngineInstance.getState());
  const [currentTrack, setCurrentTrack] = useState<Track | null>(audioEngineInstance.getCurrentTrack());
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);
  const [shuffleMode, setShuffleModeState] = useState<ShuffleMode>('off');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [onlinePlaybackState, setOnlinePlaybackState] = useState<YouTubePlaybackState>(DEFAULT_YOUTUBE_PLAYBACK_STATE);
  const [pendingOnlineTrack, setPendingOnlineTrack] = useState<Track | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isDspModalOpen, setIsDspModalOpen] = useState(false);
  const [isAudioControlCenterOpen, setIsAudioControlCenterOpen] = useState(false);
  const [isSpatialModalOpen, setIsSpatialModalOpen] = useState(false);
  const [isFullscreenVisualizerOpen, setIsFullscreenVisualizerOpen] = useState(false);
  const [isAudioOutputModalOpen, setIsAudioOutputModalOpen] = useState(false);
  const [isStoragePermissionModalOpen, setIsStoragePermissionModalOpen] = useState(false);
  const [isWidgetPreviewModalOpen, setIsWidgetPreviewModalOpen] = useState(false);
  const [outputDevices, setOutputDevices] = useState<AudioOutputDevice[]>([]);
  const [detailedOutputDevices, setDetailedOutputDevices] = useState<OutputDeviceInfo[]>([]);
  const [currentOutputDeviceInfo, setCurrentOutputDeviceInfo] = useState<OutputDeviceInfo | null>(null);

  // Part 13: Audio Profiles & Enhancement states
  const [audioProfileConfig, setAudioProfileConfig] = useState<AudioProfileConfig>(
    audioProfileServiceInstance.getGlobalProfile()
  );
  const [audioProfileSource, setAudioProfileSource] = useState<AudioProfileScope>('global');
  const [audioProfileMatchedName, setAudioProfileMatchedName] = useState<string | undefined>();
  const [customProfilesEnabled, setCustomProfilesEnabledState] = useState<boolean>(
    audioProfileServiceInstance.isCustomProfilesEnabled()
  );
  const [isSongProfileRemembered, setIsSongProfileRemembered] = useState<boolean>(false);
  const [activeDolbyMode, setActiveDolbyMode] = useState<string>(settings.dolbyMode || 'off');
  const [isDolbyHardwareSupported, setIsDolbyHardwareSupported] = useState<boolean>(false);
  const [nightModeEnabled, setNightModeEnabledState] = useState<boolean>(settings.nightModeEnabled || false);
  const [voiceModeEnabled, setVoiceModeEnabledState] = useState<boolean>(settings.voiceModeEnabled || false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const crossfadeDuration = settings.crossfadeDuration ?? 0;

  // DSP and Metering State
  const [dspState, setDspState] = useState<DspProcessingState>(
    audioEngineInstance.getProcessingState()
  );
  const [spatialState, setSpatialState] = useState<SpatialState>(
    audioEngineInstance.getSpatialEngine().getState()
  );
  const [spatialCapabilities, setSpatialCapabilities] = useState<SpatialCapabilities>(
    audioEngineInstance.getSpatialEngine().getCapabilities()
  );
  const [levelData, setLevelData] = useState<AudioLevelData>({
    leftPeak: 0,
    rightPeak: 0,
    leftRms: 0,
    rightRms: 0,
    isClipping: false,
    gainReductionDb: 0,
    peakDb: -96,
  });
  const [customPresets, setCustomPresets] = useState<AudioPresetRecord[]>([]);
  const [customSpatialPresets, setCustomSpatialPresets] = useState<AudioPresetRecord[]>([]);
  const [visualizerSettings, setVisualizerSettings] = useState<VisualizerSettings>(
    audioEngineInstance.getVisualizerEngine().getSettings()
  );

  // Refs for tracking playback sessions and persistence
  const sessionStartRef = useRef<{
    trackId: string;
    startedAt: number;
    startPosition: number;
  } | null>(null);
  const hasInitializedRef = useRef(false);
  const currentTrackRef = useRef<Track | null>(null);
  currentTrackRef.current = currentTrack;
  const queueRef = useRef<Track[]>(queue);
  queueRef.current = queue;
  const queueIndexRef = useRef<number>(queueIndex);
  queueIndexRef.current = queueIndex;
  const engineStateRef = useRef<AudioEngineState>(engineState);
  engineStateRef.current = engineState;
  const shuffleModeRef = useRef<ShuffleMode>(shuffleMode);
  shuffleModeRef.current = shuffleMode;

  // Sync state with AudioEngine
  useEffect(() => {
    const unsub = audioEngineInstance.subscribe((state) => {
      setEngineState(state);
      setDspState(audioEngineInstance.getProcessingState());
      const active = audioEngineInstance.getCurrentTrack();
      if (active && (!currentTrackRef.current || currentTrackRef.current.id !== active.id)) {
        if (currentTrackRef.current?.source === 'online' && active.source !== 'online') {
          return;
        }
        setCurrentTrack(active);
      }
    });
    return unsub;
  }, []);

  // Fetch audio output devices & custom presets
  useEffect(() => {
    audioEngineInstance.getAudioOutputDevices().then(setOutputDevices).catch(() => {});
    AudioPresetRepository.getAll()
      .then((presets) => {
        setCustomPresets(presets.filter((p) => (p.type as string) !== 'spatial'));
        setCustomSpatialPresets(presets.filter((p) => (p.type as string) === 'spatial'));
      })
      .catch(() => {});
  }, []);

  // Real-Time Level Meter & Spatial Diagnostics Poller (runs efficiently at ~30Hz during playback)
  useEffect(() => {
    if (engineState.status !== 'playing') {
      setLevelData({
        leftPeak: 0,
        rightPeak: 0,
        leftRms: 0,
        rightRms: 0,
        isClipping: false,
        gainReductionDb: 0,
        peakDb: -96,
      });
      return;
    }

    const interval = setInterval(() => {
      const data = audioEngineInstance.getLevelData();
      setLevelData(data);
      setSpatialState(audioEngineInstance.getSpatialEngine().getState());
    }, 35);

    return () => clearInterval(interval);
  }, [engineState.status]);

  // Apply default settings on launch
  useEffect(() => {
    if (settings) {
      audioEngineInstance.setVolume(settings.volume);
      audioEngineInstance.setVolumeBoost(settings.volumeBoost);
      audioEngineInstance.setRepeatMode(settings.repeatMode);
      audioEngineInstance.setShuffle(settings.shuffleEnabled);
      audioEngineInstance.setPlaybackRate(settings.playbackRate || 1.0);
      audioEngineInstance.setAudioProfile(settings.audioProfile);
      audioEngineInstance.setSpatialMode(settings.spatialMode);
      audioEngineInstance.getProcessor().setMaxOutputLevel(settings.maxOutputLevel ?? 1.0);
      audioEngineInstance.getProcessor().setAutoHeadroom(settings.autoHeadroom ?? true);
      audioEngineInstance.getProcessor().setDspBypass(settings.dspBypass ?? false);
    }
  }, [settings]);

  // Session finalizer helper
  const finalizeCurrentSession = useCallback(async (completed = false) => {
    const session = sessionStartRef.current;
    const track = currentTrackRef.current;
    if (!session || !track || session.trackId !== track.id) return;

    const currentPos = audioEngineInstance.getPosition();
    const durationListened = Math.max(0, currentPos - session.startPosition);
    const duration = track.duration || 1;
    const isCompleted = completed || (duration > 0 && currentPos / duration >= 0.95);

    // Only record if listened for at least 10 seconds or completed
    if (durationListened >= 10 || isCompleted) {
      try {
        const record: Omit<PlaybackSessionRecord, 'id'> = {
          trackId: track.id,
          startedAt: session.startedAt,
          durationListened: Math.round(durationListened),
          completed: isCompleted,
          lastPosition: currentPos,
        };
        await PlaybackSessionRepository.recordSession(record);
        await PlayHistoryRepository.addRecord({
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          playedAt: session.startedAt,
          playDuration: Math.round(durationListened),
          completed: isCompleted,
          source: track.source,
        });
        await TrackRepository.updatePlayStats(track.id);
      } catch (err) {
        console.warn('Failed to record session history:', err);
      }
    }
    sessionStartRef.current = null;
  }, []);

  // Synchronize MediaSession metadata respecting offline artwork and privacy
  useEffect(() => {
    if (settings.showMediaNotification) {
      mediaSessionServiceInstance.updateMetadata(currentTrack, settings.notificationPrivacy);
    } else {
      mediaSessionServiceInstance.updateMetadata(null);
    }
  }, [currentTrack, settings.showMediaNotification, settings.notificationPrivacy]);

  // Synchronize MediaSession playback and position states
  useEffect(() => {
    mediaSessionServiceInstance.updatePlaybackState(engineState.status);
    mediaSessionServiceInstance.updatePositionState({
      duration: engineState.duration,
      playbackRate: engineState.playbackRate,
      position: engineState.currentTime,
    });
  }, [engineState.status, engineState.duration, engineState.playbackRate, engineState.currentTime]);

  // Compute shuffle indices supporting normal, smart, and album shuffle modes
  const generateShuffleOrder = useCallback((
    length: number,
    currentIndex: number,
    mode: ShuffleMode = 'normal',
    targetQueue?: Track[]
  ): number[] => {
    if (length <= 0) return [];
    const tracks = targetQueue || queueRef.current;

    if (mode === 'smart' && tracks.length === length) {
      const now = Date.now();
      const scored = tracks.map((t, idx) => {
        if (idx === currentIndex) return { idx, score: 9999999 };
        let score = 50;
        // Unplayed bonus
        if (!t.playCount || t.playCount === 0) score += 25;
        // Rating bonus
        if (t.rating && t.rating >= 4) score += t.rating * 6;
        // Favorite bonus
        if (t.isFavorite) score += 20;
        // Penalty for recently played (within past 24 hours)
        if (t.lastPlayedAt && now - t.lastPlayedAt < 24 * 60 * 60 * 1000) {
          score -= 30;
        }
        score += Math.random() * 20;
        return { idx, score };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.map((s) => s.idx);
    }

    if (mode === 'album' && tracks.length === length) {
      const albumGroups = new Map<string, number[]>();
      tracks.forEach((t, idx) => {
        const alb = (t.album || 'Unknown Album').toLowerCase().trim();
        const existing = albumGroups.get(alb) || [];
        existing.push(idx);
        albumGroups.set(alb, existing);
      });

      const currentAlbum = currentIndex >= 0 && currentIndex < tracks.length
        ? (tracks[currentIndex].album || 'Unknown Album').toLowerCase().trim()
        : null;

      const albumKeys = Array.from(albumGroups.keys());
      for (let i = albumKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [albumKeys[i], albumKeys[j]] = [albumKeys[j], albumKeys[i]];
      }

      if (currentAlbum) {
        const albPos = albumKeys.indexOf(currentAlbum);
        if (albPos > -1) {
          albumKeys.splice(albPos, 1);
          albumKeys.unshift(currentAlbum);
        }
      }

      const result: number[] = [];
      for (const k of albumKeys) {
        const indices = albumGroups.get(k) || [];
        indices.sort((a, b) => (tracks[a].trackNumber || a) - (tracks[b].trackNumber || b));
        if (k === currentAlbum && indices.includes(currentIndex)) {
          const curPos = indices.indexOf(currentIndex);
          if (curPos > 0) {
            indices.splice(curPos, 1);
            indices.unshift(currentIndex);
          }
        }
        result.push(...indices);
      }
      return result;
    }

    // Default 'normal' random shuffle
    const indices = Array.from({ length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    if (currentIndex >= 0 && currentIndex < length) {
      const pos = indices.indexOf(currentIndex);
      if (pos > -1) {
        indices.splice(pos, 1);
        indices.unshift(currentIndex);
      }
    }
    return indices;
  }, []);

  // Play track implementation
  const playTrack = useCallback(
    async (track: Track, newQueue?: Track[], startIndex?: number) => {
      // Finalize previous session asynchronously in the background so transient user gesture is preserved
      finalizeCurrentSession(false).catch((err) => console.warn('Finalize session notice:', err));

      let targetQueue = queueRef.current;
      let targetIndex = 0;

      if (newQueue && newQueue.length > 0) {
        targetQueue = newQueue;
        targetIndex =
          startIndex !== undefined && startIndex >= 0
            ? startIndex
            : newQueue.findIndex((t) => t.id === track.id);
        if (targetIndex < 0) targetIndex = 0;
        setQueue(targetQueue);
        setQueueIndex(targetIndex);
      } else {
        const existingIdx = targetQueue.findIndex((t) => t.id === track.id);
        if (existingIdx >= 0) {
          targetIndex = existingIdx;
          setQueueIndex(existingIdx);
        } else {
          targetQueue = [...targetQueue, track];
          targetIndex = targetQueue.length - 1;
          setQueue(targetQueue);
          setQueueIndex(targetIndex);
        }
      }

      if (engineStateRef.current.isShuffle) {
        setShuffledOrder(generateShuffleOrder(targetQueue.length, targetIndex, shuffleModeRef.current, targetQueue));
      }

      if (track.source === 'online') {
        audioEngineInstance.setExternalTrack(track, 'playing');
        setCurrentTrack(track);
        window.dispatchEvent(
          new CustomEvent('play-youtube-video', {
            detail: { url: track.playbackUrl || track.path, videoId: track.sourceId, title: track.title },
          })
        );
        PlayHistoryRepository.addRecord({
          trackId: track.id,
          title: track.title,
          artist: track.artist,
          playedAt: Date.now(),
          playDuration: 0,
          completed: false,
          source: 'online',
        }).catch(() => {});
        return;
      }

      // Guarantee a verified, playable audio URL (memory blob, IndexedDB blob, Capacitor native, or synth)
      const playableUrl = await audioBlobStorageService.getPlayableUrl(track);

      const effectiveTrack: Track = {
        ...track,
        playbackUrl: playableUrl || (track as unknown as { playbackUrl?: string }).playbackUrl,
        path: playableUrl || (track as unknown as { playbackUrl?: string }).playbackUrl || track.path,
      };

      window.dispatchEvent(new CustomEvent('nova-stop-youtube'));
      await audioEngineInstance.loadTrack(effectiveTrack, true);
      setCurrentTrack(track);

      // Record play history & play stats asynchronously
      PlayHistoryRepository.addRecord({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        playedAt: Date.now(),
        playDuration: 0,
        completed: false,
        source: track.source,
      }).catch(() => {});
      TrackRepository.updatePlayStats(track.id).catch(() => {});

      sessionStartRef.current = {
        trackId: track.id,
        startedAt: Date.now(),
        startPosition: 0,
      };

      const nextIndex = targetIndex + 1;
      if (nextIndex < targetQueue.length) {
        audioEngineInstance.prepareNextTrack(targetQueue[nextIndex]);
      }
    },
    [finalizeCurrentSession, generateShuffleOrder]
  );

  const togglePlayPause = useCallback(async () => {
    if (currentTrack?.source === 'online') {
      const nextPlaying = engineState.status !== 'playing';
      audioEngineInstance.setExternalTrack(currentTrack, nextPlaying ? 'playing' : 'paused');
      setEngineState((prev) => ({
        ...prev,
        status: nextPlaying ? 'playing' : 'paused',
      }));
      window.dispatchEvent(
        new CustomEvent('nova-toggle-youtube-playback', {
          detail: { isPlaying: nextPlaying },
        })
      );
      return;
    }

    if (engineState.status === 'playing') {
      audioFocusManagerInstance.notifyUserManualPause();
      audioEngineInstance.pause();
    } else if (currentTrack) {
      audioFocusManagerInstance.notifyUserManualPlay();
      await audioEngineInstance.play();
    } else if (queue.length > 0) {
      audioFocusManagerInstance.notifyUserManualPlay();
      const idx = queueIndex >= 0 ? queueIndex : 0;
      await playTrack(queue[idx]);
    }
  }, [engineState.status, currentTrack, queue, queueIndex, playTrack]);

  const nextTrack = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    await finalizeCurrentSession(true);

    const isShuffle = engineStateRef.current.isShuffle;
    const repeatMode = engineStateRef.current.repeatMode;
    const currentIndex = queueIndexRef.current;

    let nextIdx = currentIndex + 1;

    if (isShuffle) {
      if (shuffledOrder.length !== q.length) {
        const newOrder = generateShuffleOrder(q.length, currentIndex);
        setShuffledOrder(newOrder);
        const pos = newOrder.indexOf(currentIndex);
        const nextPos = pos + 1;
        if (nextPos < newOrder.length) {
          nextIdx = newOrder[nextPos];
        } else if (repeatMode === 'all') {
          nextIdx = newOrder[0];
        } else {
          audioEngineInstance.stop();
          return;
        }
      } else {
        const pos = shuffledOrder.indexOf(currentIndex);
        const nextPos = pos + 1;
        if (nextPos < shuffledOrder.length) {
          nextIdx = shuffledOrder[nextPos];
        } else if (repeatMode === 'all') {
          nextIdx = shuffledOrder[0];
        } else {
          audioEngineInstance.stop();
          return;
        }
      }
    } else {
      if (nextIdx >= q.length) {
        if (repeatMode === 'all') {
          nextIdx = 0;
        } else {
          audioEngineInstance.stop();
          return;
        }
      }
    }

    setQueueIndex(nextIdx);
    const target = q[nextIdx];
    if (target) {
      if (target.source === 'online' && !settings.allowQueuedOnlinePlayback) {
        audioEngineInstance.pause();
        setPendingOnlineTrack(target);
        return;
      }
      await playTrack(target);
    }
  }, [finalizeCurrentSession, shuffledOrder, generateShuffleOrder, playTrack, settings.allowQueuedOnlinePlayback]);

  const prevTrack = useCallback(async () => {
    const threshold = settings.previousTrackThreshold ?? 3;
    const curTime = audioEngineInstance.getPosition();

    if (curTime > threshold) {
      audioEngineInstance.seek(0);
      return;
    }

    const q = queueRef.current;
    if (q.length === 0) return;

    await finalizeCurrentSession(false);

    const isShuffle = engineStateRef.current.isShuffle;
    const currentIndex = queueIndexRef.current;
    let prevIdx = currentIndex - 1;

    if (isShuffle && shuffledOrder.length === q.length) {
      const pos = shuffledOrder.indexOf(currentIndex);
      const prevPos = pos - 1;
      if (prevPos >= 0) {
        prevIdx = shuffledOrder[prevPos];
      } else {
        prevIdx = shuffledOrder[shuffledOrder.length - 1];
      }
    } else {
      if (prevIdx < 0) {
        prevIdx = q.length - 1;
      }
    }

    setQueueIndex(prevIdx);
    const target = q[prevIdx];
    if (target) {
      await playTrack(target);
    }
  }, [settings.previousTrackThreshold, finalizeCurrentSession, shuffledOrder, playTrack]);

  useEffect(() => {
    const unsub = audioEngineInstance.on('TRACK_FINISHED', () => {
      nextTrack();
    });
    return unsub;
  }, [nextTrack]);

  // Synchronize buffering progress into onlinePlaybackState
  useEffect(() => {
    if (engineState.bufferedPercent !== undefined && currentTrack?.source === 'online') {
      setOnlinePlaybackState((prev) => ({
        ...prev,
        bufferedPercent: engineState.bufferedPercent || 0,
        bufferedSeconds: engineState.bufferedSeconds || 0,
        currentTime: engineState.currentTime,
        duration: engineState.duration || prev.duration,
      }));
    }
  }, [
    engineState.bufferedPercent,
    engineState.bufferedSeconds,
    engineState.currentTime,
    engineState.duration,
    currentTrack?.source,
  ]);

  // Online YouTube Playback & Smart Caching Handlers (Parts 6 & 7)
  const playYouTubeUrl = useCallback(
    async (rawUrl: string, titleOrCache?: string | boolean, artist?: string) => {
      // 1. Local URL validation & normalization
      const validation = YouTubeUrlValidator.validate(rawUrl);
      if (!validation.isValid || !validation.cleanUrl || !validation.videoId) {
        const errorMsg = validation.errorMessage || 'Invalid YouTube URL';
        setOnlinePlaybackState((prev) => ({
          ...prev,
          status: 'error',
          errorMessage: errorMsg,
        }));
        throw new Error(errorMsg);
      }

      const { cleanUrl, videoId } = validation;
      const customTitle = typeof titleOrCache === 'string' ? titleOrCache : undefined;
      const customArtist = artist;

      setOnlinePlaybackState({
        ...DEFAULT_YOUTUBE_PLAYBACK_STATE,
        status: 'resolving',
        currentUrl: cleanUrl,
        videoId,
      });

      try {
        // 2. Start session in NetworkAccessManager
        NetworkAccessManager.startOnlineSession(cleanUrl, videoId);

        // 3. Pause local AudioEngine so local audio does not clash with online stream
        audioEngineInstance.pause();

        // 4. Dispatch event for the embedded official YouTube player
        window.dispatchEvent(
          new CustomEvent('play-youtube-video', {
            detail: { url: cleanUrl, videoId, title: customTitle },
          })
        );

        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        const title = customTitle || `YouTube Track (${videoId})`;
        const artistName = customArtist || 'YouTube';

        // 5. Update shared currentTrack so Home, MiniPlayer and other components immediately synchronize
        const onlineTrack: Track = {
          id: `yt_${videoId}`,
          title,
          artist: artistName,
          album: 'Online Stream',
          duration: 0,
          format: 'youtube',
          codec: 'aac',
          path: cleanUrl,
          playbackUrl: cleanUrl,
          coverArtUrl: thumbnailUrl,
          source: 'online',
          isFavorite: false,
          dateAdded: Date.now(),
          lastPlayedAt: Date.now(),
          playCount: 1,
          isAvailable: true,
        };
        audioEngineInstance.setExternalTrack(onlineTrack, 'playing');
        setCurrentTrack(onlineTrack);

        // 6. Update online playback state
        setOnlinePlaybackState((prev) => ({
          ...prev,
          status: 'playing',
          currentUrl: cleanUrl,
          videoId,
          metadata: {
            id: videoId,
            title,
            artist: artistName,
            channel: artistName,
            duration: 0,
            thumbnailUrl,
            videoUrl: cleanUrl,
            codec: 'aac',
            container: 'mp4',
            bitrate: 128,
            isAvailable: true,
            requiresAuth: false,
          },
          errorMessage: null,
        }));

        // 7. Record to local YouTube History & Play History
        await YouTubeHistoryRepository.recordPlay({
          videoId,
          canonicalUrl: cleanUrl,
          title,
          artist: artistName,
          channel: artistName,
          duration: 0,
          thumbnailUrl,
        });

        await PlayHistoryRepository.addRecord({
          trackId: `yt_${videoId}`,
          title,
          artist: artistName,
          playedAt: Date.now(),
          playDuration: 0,
          completed: false,
          source: 'online',
        });
      } catch (err: any) {
        console.warn('Online playback notice:', err);
      }
    },
    [
      playTrack,
      settings.cacheYouTubeAudio,
      settings.autoCachePlayedTracks,
      settings.maxCacheSizeBytes,
      settings.protectFavoritesFromEviction,
    ]
  );

  /**
   * Plays a cached YouTube track completely offline using LocalAudioSource and existing AudioEngine.
   */
  const playCachedYouTubeTrack = useCallback(
    async (historyItem: YouTubeHistoryRecord): Promise<boolean> => {
      // 1. Verify cache offline
      const validation = await CacheManager.verifyCache(historyItem.youtube_video_id);
      if (!validation.isValid || !historyItem.cache_path) {
        return false;
      }

      // 2. Create track descriptor pointing to local cached audio file
      const cachedTrack: Track = {
        id: `cached_${historyItem.youtube_video_id}`,
        title: historyItem.title,
        artist: historyItem.artist,
        album: historyItem.channel || 'YouTube Offline',
        duration: historyItem.duration,
        format: (historyItem.codec || 'opus') as any,
        codec: historyItem.codec,
        bitrate: historyItem.bitrate,
        sampleRate: historyItem.sample_rate,
        path: historyItem.cache_path,
        playbackUrl: historyItem.cache_path,
        coverArtUrl: historyItem.thumbnail_local_path || historyItem.thumbnail_url,
        source: 'local',
        sourceType: 'youtube',
        sourceId: historyItem.youtube_video_id,
        sourceChannel: historyItem.channel,
        originalUrl: historyItem.youtube_url,
        cached: true,
        cachePath: historyItem.cache_path,
        dateAdded: historyItem.first_played_at,
        lastPlayedAt: Date.now(),
        playCount: historyItem.play_count + 1,
        isFavorite: historyItem.is_favorite,
      };

      // 3. Create LocalAudioSource and load into existing AudioEngine (shared DSP pipeline)
      const localSource = new LocalAudioSource(cachedTrack);
      await audioEngineInstance.loadAudioSource(localSource, true);
      await playTrack(cachedTrack);

      // 4. Update play count and touch cache in database
      await YouTubeHistoryRepository.recordPlay({
        videoId: historyItem.youtube_video_id,
        canonicalUrl: historyItem.youtube_url,
        title: historyItem.title,
        artist: historyItem.artist,
        channel: historyItem.channel,
        duration: historyItem.duration,
        thumbnailUrl: historyItem.thumbnail_url,
        codec: historyItem.codec,
        bitrate: historyItem.bitrate,
        sampleRate: historyItem.sample_rate,
      });
      await CacheManager.touchCache(historyItem.youtube_video_id);

      return true;
    },
    [playTrack]
  );

  /**
   * Triggers explicit cache download for a track.
   */
  const cacheYouTubeTrack = useCallback(
    async (videoId: string, canonicalUrl: string): Promise<boolean> => {
      const res = await CacheManager.saveCache({
        videoId,
        canonicalUrl,
        maxLimitBytes: settings.maxCacheSizeBytes,
        protectFavorites: settings.protectFavoritesFromEviction,
      });
      return res.success;
    },
    [settings.maxCacheSizeBytes, settings.protectFavoritesFromEviction]
  );

  const endOnlineSession = useCallback(() => {
    audioEngineInstance.stop();
    youtubeResolverInstance.cancel();
    NetworkAccessManager.endOnlineSession();
    setOnlinePlaybackState({
      ...DEFAULT_YOUTUBE_PLAYBACK_STATE,
      status: 'stopped',
    });
  }, []);

  const playPendingOnlineTrack = useCallback(async () => {
    if (!pendingOnlineTrack) return;
    const trackToPlay = pendingOnlineTrack;
    setPendingOnlineTrack(null);
    if (trackToPlay.originalUrl) {
      await playYouTubeUrl(trackToPlay.originalUrl);
    } else {
      await playTrack(trackToPlay);
    }
  }, [pendingOnlineTrack, playYouTubeUrl, playTrack]);

  const cancelPendingOnlineTrack = useCallback(() => {
    setPendingOnlineTrack(null);
    audioEngineInstance.stop();
  }, []);

  // Controls
  const seek = useCallback((seconds: number) => {
    audioEngineInstance.seek(seconds);
  }, []);

  const seekForward = useCallback(
    (seconds?: number) => {
      const step = seconds ?? settings.seekForwardInterval ?? 5;
      audioEngineInstance.seek(audioEngineInstance.getPosition() + step);
    },
    [settings.seekForwardInterval]
  );

  const seekBackward = useCallback(
    (seconds?: number) => {
      const step = seconds ?? settings.seekBackwardInterval ?? 5;
      audioEngineInstance.seek(audioEngineInstance.getPosition() - step);
    },
    [settings.seekBackwardInterval]
  );

  const setVolume = useCallback((vol: number) => {
    audioEngineInstance.setVolume(vol);
  }, []);

  const setVolumeBoost = useCallback((boost: number) => {
    audioEngineInstance.setVolumeBoost(boost);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setMute = useCallback((mute: boolean) => {
    audioEngineInstance.setMute(mute);
  }, []);

  const toggleMute = useCallback(() => {
    audioEngineInstance.toggleMute();
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    audioEngineInstance.setPlaybackRate(rate);
  }, []);

  const setRepeatMode = useCallback((mode: RepeatMode) => {
    audioEngineInstance.setRepeatMode(mode);
  }, []);

  const setShuffleMode = useCallback((mode: ShuffleMode) => {
    setShuffleModeState(mode);
    const isShuffle = mode !== 'off';
    audioEngineInstance.setShuffle(isShuffle);
    if (isShuffle) {
      setShuffledOrder(generateShuffleOrder(queueRef.current.length, queueIndexRef.current, mode));
    } else {
      setShuffledOrder([]);
    }
  }, [generateShuffleOrder]);

  const cycleShuffleMode = useCallback(() => {
    const modes: ShuffleMode[] = ['off', 'normal', 'smart', 'album'];
    const curIdx = modes.indexOf(shuffleModeRef.current);
    const nextMode = modes[(curIdx + 1) % modes.length];
    setShuffleMode(nextMode);
  }, [setShuffleMode]);

  const toggleShuffle = useCallback(() => {
    if (shuffleModeRef.current === 'off') {
      setShuffleMode('normal');
    } else {
      setShuffleMode('off');
    }
  }, [setShuffleMode]);

  // Part 15: MediaSession Action Handlers Integration
  useEffect(() => {
    mediaSessionServiceInstance.init({
      onPlay: () => {
        audioFocusManagerInstance.notifyUserManualPlay();
        togglePlayPause();
      },
      onPause: () => {
        audioFocusManagerInstance.notifyUserManualPause();
        audioEngineInstance.pause();
      },
      onStop: () => {
        audioFocusManagerInstance.notifyUserManualPause();
        audioEngineInstance.stop();
      },
      onPreviousTrack: () => {
        prevTrack();
      },
      onNextTrack: () => {
        nextTrack();
      },
      onSeekTo: (seconds) => {
        seek(seconds);
      },
      onSeekForward: (offset) => {
        const step = offset || settings.seekForwardInterval || 10;
        seek(audioEngineInstance.getPosition() + step);
      },
      onSeekBackward: (offset) => {
        const step = offset || settings.seekBackwardInterval || 10;
        seek(audioEngineInstance.getPosition() - step);
      },
    });
  }, [togglePlayPause, prevTrack, nextTrack, seek, settings.seekForwardInterval, settings.seekBackwardInterval]);

  // Part 15: Audio Focus Manager Initialization & Updates
  useEffect(() => {
    audioFocusManagerInstance.init(
      {
        onPause: () => {
          audioEngineInstance.pause();
        },
        onResume: () => {
          audioEngineInstance.play();
        },
        onDuck: (duckFactor) => {
          audioEngineInstance.duck(duckFactor);
        },
        onUnduck: () => {
          audioEngineInstance.unduck();
        },
        isPlaying: () => engineStateRef.current.status === 'playing',
      },
      {
        audioFocusMode: settings.audioFocusMode,
        resumeAfterInterruption: settings.resumeAfterInterruption,
        duckVolumePercent: settings.audioDuckVolumePercent,
      }
    );
  }, [settings.audioFocusMode, settings.resumeAfterInterruption, settings.audioDuckVolumePercent]);

  // Part 15: Audio Route & Bluetooth Disconnect Manager
  useEffect(() => {
    audioRouteManagerInstance.init(
      {
        onPause: () => {
          audioEngineInstance.pause();
        },
        onDeviceChange: (devs) => {
          setOutputDevices(devs);
        },
      },
      {
        pauseOnHeadphoneDisconnect: settings.pauseOnHeadphoneDisconnect,
        autoApplyDeviceProfiles: settings.autoApplyDeviceProfiles,
      }
    );
  }, [settings.pauseOnHeadphoneDisconnect, settings.autoApplyDeviceProfiles]);

  // Part 15: Screen WakeLock Management
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const manageWakeLock = async () => {
      if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
      if (engineState.status === 'playing' && settings.wakeLockEnabled) {
        try {
          if (!wakeLockRef.current) {
            wakeLockRef.current = await (navigator as unknown as { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
            wakeLockRef.current.addEventListener('release', () => {
              wakeLockRef.current = null;
            });
          }
        } catch {
          // wake lock denied or unsupported
        }
      } else {
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
          } catch {}
          wakeLockRef.current = null;
        }
      }
    };
    manageWakeLock();
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [engineState.status, settings.wakeLockEnabled]);

  // Part 15: Battery Optimization on Background Visibility Change
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App backgrounded: pause visualizer render loops to save CPU/battery. Audio plays uninterrupted.
        audioEngineInstance.visualizerEngine.pause();
      } else {
        // App returned to foreground: restart visualizer if playing
        if (engineStateRef.current.status === 'playing') {
          audioEngineInstance.visualizerEngine.start();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Part 15: Incremental State Persistence & Crash Recovery
  useEffect(() => {
    const saveIncrementalState = () => {
      if (!currentTrack) return;
      try {
        const payload = {
          trackId: currentTrack.id,
          position: audioEngineInstance.getPosition(),
          queueIndex: queueIndexRef.current,
          repeatMode: engineStateRef.current.repeatMode,
          isShuffle: engineStateRef.current.isShuffle,
          updatedAt: Date.now(),
        };
        localStorage.setItem('nova_playback_incremental_state', JSON.stringify(payload));
      } catch {}
    };

    let interval: ReturnType<typeof setInterval> | null = null;
    if (engineState.status === 'playing') {
      interval = setInterval(saveIncrementalState, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
      saveIncrementalState();
    };
  }, [engineState.status, currentTrack]);

  // Modal and testing helpers
  const openAudioOutputModal = useCallback(() => setIsAudioOutputModalOpen(true), []);
  const triggerMediaButtonPress = useCallback(() => {
    mediaSessionServiceInstance.handleHeadsetButtonPress();
  }, []);
  const simulateAudioFocusInterruption = useCallback((type: AudioInterruptionType, canDuck?: boolean) => {
    audioFocusManagerInstance.triggerInterruption(type, canDuck);
  }, []);
  const simulateAudioFocusRegain = useCallback(() => {
    audioFocusManagerInstance.finishInterruption();
  }, []);

  // Part 16: Android Home Screen Widget & Quick Settings Tile Updates
  useEffect(() => {
    if (settings.enableHomeScreenWidgets) {
      androidWidgetServiceInstance.updateWidgetState(
        currentTrack,
        engineState.status,
        engineState.currentTime
      );
    }
    if (settings.enableQuickSettingsTile) {
      androidBridgeInstance.updateQuickSettingsTile(
        engineState.status === 'playing',
        currentTrack?.title || '',
        currentTrack?.artist || ''
      );
    }
  }, [
    currentTrack,
    engineState.status,
    engineState.currentTime,
    settings.enableHomeScreenWidgets,
    settings.enableQuickSettingsTile,
  ]);

  // Part 16: Modal and native feature helpers
  const openStoragePermissionModal = useCallback(() => setIsStoragePermissionModalOpen(true), []);
  const openWidgetPreviewModal = useCallback(() => setIsWidgetPreviewModalOpen(true), []);

  const shareCurrentTrack = useCallback(async (): Promise<boolean> => {
    if (!currentTrack) return false;
    return await androidBridgeInstance.shareTrack(currentTrack);
  }, [currentTrack]);

  const syncMediaStoreFiles = useCallback(async (files: File[]): Promise<MediaStoreSyncResult> => {
    return await mediaStoreSyncServiceInstance.syncFiles(files, 'Device Media');
  }, []);

  const setAudioProfile = useCallback((profile: AudioProfileName) => {
    audioEngineInstance.setAudioProfile(profile);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setSpatialMode = useCallback(
    (mode: SpatialMode) => {
      audioEngineInstance.setSpatialMode(mode);
      audioEngineInstance.getSpatialEngine().setMode(mode);
      setSpatialState(audioEngineInstance.getSpatialEngine().getState());
      updateSettings({ spatialMode: mode, spatialAudioEnabled: mode !== 'off' });
    },
    [updateSettings]
  );

  // --- Central DSP Setters (Part 4) ---

  const setPreamp = useCallback((db: number) => {
    audioEngineInstance.getProcessor().setPreamp(db);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setEqualizerBand = useCallback((index: number, gainDb: number) => {
    audioEngineInstance.getProcessor().setEqualizerBand(index, gainDb);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setEqualizerBands = useCallback((bands: number[]) => {
    audioEngineInstance.getProcessor().setEqualizerBands(bands);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const resetEqualizer = useCallback(() => {
    audioEngineInstance.getProcessor().resetEqualizer();
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setBassBoost = useCallback((db: number) => {
    audioEngineInstance.getProcessor().setBassBoost(db);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setTreble = useCallback((db: number) => {
    audioEngineInstance.getProcessor().setTreble(db);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setVocalEnhancement = useCallback((mode: VocalEnhancementMode) => {
    audioEngineInstance.getProcessor().setVocalEnhancement(mode);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setLoudness = useCallback((mode: LoudnessMode) => {
    audioEngineInstance.getProcessor().setLoudness(mode);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setCompressor = useCallback((config: Partial<CompressorConfig>) => {
    audioEngineInstance.getProcessor().setCompressor(config);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setLimiter = useCallback((enabled: boolean, ceilingDb = -1.0) => {
    audioEngineInstance.getProcessor().setLimiter(enabled, ceilingDb);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setStereoWidth = useCallback((width: number) => {
    audioEngineInstance.getProcessor().setStereoWidth(width);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setBalance = useCallback((balance: number) => {
    audioEngineInstance.getProcessor().setBalance(balance);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setMono = useCallback((mono: boolean) => {
    audioEngineInstance.getProcessor().setMono(mono);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setAutoHeadroom = useCallback((enabled: boolean) => {
    audioEngineInstance.getProcessor().setAutoHeadroom(enabled);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setMaxOutputLevel = useCallback((level: number) => {
    audioEngineInstance.getProcessor().setMaxOutputLevel(level);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const setDspBypass = useCallback(
    (bypassed: boolean) => {
      audioEngineInstance.getProcessor().setDspBypass(bypassed);
      setDspState(audioEngineInstance.getProcessingState());
      updateSettings({ dspBypass: bypassed });
    },
    [updateSettings]
  );

  const toggleAbComparison = useCallback(() => {
    audioEngineInstance.getProcessor().toggleAbComparison();
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const resetAudioProcessing = useCallback(() => {
    audioEngineInstance.getProcessor().resetProcessing();
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  const loadDspState = useCallback((state: Partial<DspProcessingState>) => {
    audioEngineInstance.getProcessor().loadState(state);
    setDspState(audioEngineInstance.getProcessingState());
  }, []);

  // Custom Presets Management
  const saveCustomPreset = useCallback(
    async (name: string) => {
      const currentState = audioEngineInstance.getProcessingState();
      const preset: AudioPresetRecord = {
        id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        type: 'custom',
        settings_json: JSON.stringify(currentState),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await AudioPresetRepository.save(preset);
      const all = await AudioPresetRepository.getAll();
      setCustomPresets(all);
    },
    []
  );

  const deleteCustomPreset = useCallback(async (id: string) => {
    await AudioPresetRepository.delete(id);
    const all = await AudioPresetRepository.getAll();
    setCustomPresets(all);
  }, []);

  const loadPreset = useCallback(
    async (nameOrId: string) => {
      // Check built-in first
      if (nameOrId in AUDIO_PROFILE_PRESETS) {
        setAudioProfile(nameOrId as AudioProfileName);
        return;
      }
      // Check custom presets
      const custom = customPresets.find((p) => p.id === nameOrId || p.name === nameOrId);
      if (custom) {
        try {
          const parsed = JSON.parse(custom.settings_json);
          loadDspState(parsed);
        } catch (err) {
          console.warn('Failed to parse preset json:', err);
        }
      }
    },
    [customPresets, setAudioProfile, loadDspState]
  );

  // --- Part 13: Advanced Audio Control Center & Audio Profiles ---
  const toggleAudioControlCenter = useCallback(() => {
    setIsAudioControlCenterOpen((prev) => !prev);
    setIsDspModalOpen((prev) => !prev);
  }, []);

  const applyResolvedAudioProfile = useCallback((config: AudioProfileConfig) => {
    setAudioProfileConfig(config);
    const proc = audioEngineInstance.getProcessor();
    proc.loadState({
      activeProfile: config.presetName,
      preampDb: config.preampDb,
      eqBands: config.eqBands,
      bassBoostDb: (config.bassBoostPercent / 100) * 10,
      bassBoostPercent: config.bassBoostPercent,
      trebleDb: config.trebleDb,
      balance: config.balance,
      isMono: config.isMono,
      volumeBoost: config.volumeBoost || 1.0,
      virtualSurround: config.virtualSurround || 0,
      replayGainMode: config.replayGainMode || 'off',
      volumeNormalizationMode: config.volumeNormalization || 'off',
      preventClipping: config.preventClipping !== false,
      nightMode: config.nightMode || false,
      voiceMode: config.voiceMode || false,
    });
    audioEngineInstance.setPlaybackRate(config.playbackRate || 1.0);
    audioEngineInstance.setCrossfadeDuration(config.crossfadeDuration || 0);
    audioEngineInstance.setReplayGainMode(config.replayGainMode || 'off');
    setDspState(proc.getProcessingState());
  }, []);

  const resolveCurrentProfile = useCallback(() => {
    const tr = currentTrackRef.current;
    const devId = engineStateRef.current.outputDeviceId;
    const resolved = audioProfileServiceInstance.resolveProfile(tr, devId);
    setAudioProfileSource(resolved.source);
    setAudioProfileMatchedName(resolved.matchedName);
    if (tr?.id) {
      setIsSongProfileRemembered(audioProfileServiceInstance.hasSongProfile(tr.id));
    } else {
      setIsSongProfileRemembered(false);
    }
    applyResolvedAudioProfile(resolved.config);
  }, [applyResolvedAudioProfile]);

  useEffect(() => {
    resolveCurrentProfile();
  }, [currentTrack, resolveCurrentProfile]);

  useEffect(() => {
    const unsub = audioProfileServiceInstance.subscribe(() => {
      setCustomProfilesEnabledState(audioProfileServiceInstance.isCustomProfilesEnabled());
      setCustomPresets(audioProfileServiceInstance.getCustomPresets());
      resolveCurrentProfile();
    });
    return unsub;
  }, [resolveCurrentProfile]);

  const refreshOutputDevices = useCallback(async () => {
    try {
      const detailed = await audioEngineInstance.getDetailedOutputDevices();
      setDetailedOutputDevices(detailed);
      setOutputDevices(detailed);
      const active = detailed.find((d) => d.isActive) || detailed[0] || null;
      setCurrentOutputDeviceInfo(active);
    } catch {
      // fallback
    }
  }, []);

  useEffect(() => {
    refreshOutputDevices();
    nativeBridge.isDolbyHardwareSupported().then(setIsDolbyHardwareSupported).catch(() => {});
  }, [refreshOutputDevices]);

  useEffect(() => {
    if (!sleepTimerMinutes || sleepTimerMinutes <= 0) return;
    const timeout = setTimeout(() => {
      audioEngineInstance.pause();
      setSleepTimerMinutes(null);
    }, sleepTimerMinutes * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [sleepTimerMinutes]);

  const setCustomProfilesEnabled = useCallback((enabled: boolean) => {
    setCustomProfilesEnabledState(enabled);
    audioProfileServiceInstance.setCustomProfilesEnabled(enabled);
    resolveCurrentProfile();
  }, [resolveCurrentProfile]);

  const setRememberSongProfile = useCallback((remember: boolean) => {
    setIsSongProfileRemembered(remember);
    const tr = currentTrackRef.current;
    if (!tr?.id) return;
    if (remember) {
      audioProfileServiceInstance.setSongProfile(tr.id, audioProfileConfig);
    } else {
      audioProfileServiceInstance.removeSongProfile(tr.id);
    }
    resolveCurrentProfile();
  }, [audioProfileConfig, resolveCurrentProfile]);

  const saveCurrentAsSongProfile = useCallback(() => {
    const tr = currentTrackRef.current;
    if (!tr?.id) return;
    audioProfileServiceInstance.setSongProfile(tr.id, audioProfileConfig);
    setIsSongProfileRemembered(true);
    resolveCurrentProfile();
  }, [audioProfileConfig, resolveCurrentProfile]);

  const clearSongProfile = useCallback(() => {
    const tr = currentTrackRef.current;
    if (!tr?.id) return;
    audioProfileServiceInstance.removeSongProfile(tr.id);
    setIsSongProfileRemembered(false);
    resolveCurrentProfile();
  }, [resolveCurrentProfile]);

  const setAlbumAudioProfile = useCallback((album: string, config: Partial<AudioProfileConfig>) => {
    audioProfileServiceInstance.setAlbumProfile(album, config);
    resolveCurrentProfile();
  }, [resolveCurrentProfile]);

  const setArtistAudioProfile = useCallback((artist: string, config: Partial<AudioProfileConfig>) => {
    audioProfileServiceInstance.setArtistProfile(artist, config);
    resolveCurrentProfile();
  }, [resolveCurrentProfile]);

  const setGlobalAudioProfile = useCallback((config: Partial<AudioProfileConfig>) => {
    audioProfileServiceInstance.setGlobalProfile(config);
    resolveCurrentProfile();
  }, [resolveCurrentProfile]);

  const resetAudioSettings = useCallback((scope: 'global' | 'song' | 'album' | 'artist' | 'all') => {
    if (scope === 'global') audioProfileServiceInstance.resetGlobalSettings();
    else if (scope === 'song') audioProfileServiceInstance.resetSongSettings();
    else if (scope === 'album') audioProfileServiceInstance.resetAlbumSettings();
    else if (scope === 'artist') audioProfileServiceInstance.resetArtistSettings();
    else if (scope === 'all') audioProfileServiceInstance.resetAllAudioProfiles();
    resolveCurrentProfile();
  }, [resolveCurrentProfile]);

  const exportAudioProfiles = useCallback(() => {
    return audioProfileServiceInstance.exportProfilesBundle();
  }, []);

  const importAudioProfiles = useCallback(async (bundle: AudioProfilesExportBundle, mode: 'merge' | 'overwrite' = 'merge') => {
    const res = await audioProfileServiceInstance.importProfilesBundle(bundle, mode);
    resolveCurrentProfile();
    return res;
  }, [resolveCurrentProfile]);

  const renameCustomPreset = useCallback(async (id: string, newName: string) => {
    const res = await audioProfileServiceInstance.renameCustomPreset(id, newName);
    setCustomPresets(audioProfileServiceInstance.getCustomPresets());
    return res;
  }, []);

  const duplicateCustomPreset = useCallback(async (id: string, newName: string) => {
    const res = await audioProfileServiceInstance.duplicateCustomPreset(id, newName);
    setCustomPresets(audioProfileServiceInstance.getCustomPresets());
    return res;
  }, []);

  const resetCustomPresets = useCallback(async () => {
    const all = audioProfileServiceInstance.getCustomPresets();
    for (const p of all) {
      await audioProfileServiceInstance.deleteCustomPreset(p.id);
    }
    setCustomPresets([]);
  }, []);

  const setBassBoostPercent = useCallback((percent: number) => {
    audioEngineInstance.getProcessor().setBassBoostPercent(percent);
    setDspState(audioEngineInstance.getProcessingState());
    setAudioProfileConfig((prev) => {
      const updated = { ...prev, bassBoostPercent: percent };
      if (isSongProfileRemembered && currentTrackRef.current?.id) {
        audioProfileServiceInstance.setSongProfile(currentTrackRef.current.id, updated);
      }
      return updated;
    });
  }, [isSongProfileRemembered]);

  const resetTreble = useCallback(() => {
    audioEngineInstance.getProcessor().resetTreble();
    setDspState(audioEngineInstance.getProcessingState());
    setAudioProfileConfig((prev) => {
      const updated = { ...prev, trebleDb: 0 };
      if (isSongProfileRemembered && currentTrackRef.current?.id) {
        audioProfileServiceInstance.setSongProfile(currentTrackRef.current.id, updated);
      }
      return updated;
    });
  }, [isSongProfileRemembered]);

  const setReplayGainMode = useCallback((mode: 'off' | 'track' | 'album') => {
    audioEngineInstance.setReplayGainMode(mode);
    setDspState(audioEngineInstance.getProcessingState());
    updateSettings({ replayGainMode: mode });
  }, [updateSettings]);

  const setVolumeNormalization = useCallback((mode: 'off' | 'track' | 'album') => {
    audioEngineInstance.getProcessor().setVolumeNormalization(mode);
    setDspState(audioEngineInstance.getProcessingState());
    updateSettings({ volumeNormalization: mode });
  }, [updateSettings]);

  const setPreventClipping = useCallback((enabled: boolean) => {
    audioEngineInstance.getProcessor().setPreventClipping(enabled);
    setDspState(audioEngineInstance.getProcessingState());
    updateSettings({ preventClipping: enabled });
  }, [updateSettings]);

  const setVirtualSurround = useCallback((percent: number) => {
    audioEngineInstance.getProcessor().setVirtualSurround(percent);
    setDspState(audioEngineInstance.getProcessingState());
    updateSettings({ virtualSurround: percent });
  }, [updateSettings]);

  const setDolbyMode = useCallback((mode: string) => {
    setActiveDolbyMode(mode);
    updateSettings({ dolbyMode: mode });
  }, [updateSettings]);

  const setNightModeEnabled = useCallback((enabled: boolean) => {
    setNightModeEnabledState(enabled);
    audioEngineInstance.getProcessor().setNightMode(enabled);
    setDspState(audioEngineInstance.getProcessingState());
    updateSettings({ nightModeEnabled: enabled });
  }, [updateSettings]);

  const toggleNightMode = useCallback(() => {
    setNightModeEnabled(!nightModeEnabled);
  }, [nightModeEnabled, setNightModeEnabled]);

  const setVoiceModeEnabled = useCallback((enabled: boolean) => {
    setVoiceModeEnabledState(enabled);
    audioEngineInstance.getProcessor().setVoiceMode(enabled);
    setDspState(audioEngineInstance.getProcessingState());
    updateSettings({ voiceModeEnabled: enabled });
  }, [updateSettings]);

  const toggleVoiceMode = useCallback(() => {
    setVoiceModeEnabled(!voiceModeEnabled);
  }, [voiceModeEnabled, setVoiceModeEnabled]);

  const setCrossfadeDuration = useCallback((sec: number) => {
    audioEngineInstance.setCrossfadeDuration(sec);
    updateSettings({ crossfadeDuration: sec });
  }, [updateSettings]);

  const fadeIn = useCallback(async (durationSec = 1.0) => {
    await audioEngineInstance.fadeIn(durationSec);
  }, []);

  const fadeOut = useCallback(async (durationSec = 1.0) => {
    await audioEngineInstance.fadeOut(durationSec);
  }, []);

  const dolbyStatus: DolbyStatus = isDolbyHardwareSupported ? 'supported' : 'unavailable';

  const activeAudioBadges = React.useMemo(() => {
    const list: string[] = [];
    if (dspState.eqBands.some((b) => b !== 0)) list.push('EQ');
    if ((dspState.bassBoostPercent && dspState.bassBoostPercent > 0) || dspState.bassBoostDb > 0) list.push('BASS');
    if (dspState.trebleDb !== 0) list.push('TREBLE');
    if (dspState.virtualSurround && dspState.virtualSurround > 0) list.push('SURROUND');
    if (dspState.isMono) list.push('MONO');
    if (dspState.volumeNormalizationMode && dspState.volumeNormalizationMode !== 'off') list.push('NORM');
    if (dspState.replayGainMode && dspState.replayGainMode !== 'off' && dspState.replayGainDb) list.push('REPLAYGAIN');
    if (nightModeEnabled) list.push('NIGHT');
    if (voiceModeEnabled) list.push('VOICE');
    if (spatialState.enabled && !spatialState.bypass) list.push('SPATIAL');
    if (isDolbyHardwareSupported && activeDolbyMode !== 'off') list.push('DOLBY');
    return list;
  }, [dspState, nightModeEnabled, voiceModeEnabled, spatialState, isDolbyHardwareSupported, activeDolbyMode]);

  const audioFormatBadge = React.useMemo(() => {
    return audioEngineInstance.getAudioFormatBadge(currentTrack);
  }, [currentTrack]);

  const audiobookControls = React.useMemo(() => ({
    skipForward10: () => audioEngineInstance.seek(audioEngineInstance.getPosition() + 10),
    skipBackward10: () => audioEngineInstance.seek(Math.max(0, audioEngineInstance.getPosition() - 10)),
    skipForward30: () => audioEngineInstance.seek(audioEngineInstance.getPosition() + 30),
    skipBackward30: () => audioEngineInstance.seek(Math.max(0, audioEngineInstance.getPosition() - 30)),
    sleepTimerMinutes,
    setSleepTimer: (minutes: number | null) => setSleepTimerMinutes(minutes),
  }), [sleepTimerMinutes]);

  // --- Spatial Audio Handlers (Part 5) ---
  const toggleSpatialModal = useCallback(() => {
    setIsSpatialModalOpen((prev) => !prev);
  }, []);

  const toggleFullscreenVisualizer = useCallback(() => {
    setIsFullscreenVisualizerOpen((prev) => !prev);
  }, []);

  const syncSpatialState = useCallback(() => {
    setSpatialState(audioEngineInstance.getSpatialEngine().getState());
    setSpatialCapabilities(audioEngineInstance.getSpatialEngine().getCapabilities());
  }, []);

  const setSpatialIntensity = useCallback(
    (intensity: number) => {
      audioEngineInstance.getSpatialEngine().setIntensity(intensity);
      syncSpatialState();
      updateSettings({ spatialIntensity: intensity });
    },
    [syncSpatialState, updateSettings]
  );

  const setSpatialPosition = useCallback(
    (azimuth: number, elevation: number, distance: number, depth: number) => {
      audioEngineInstance.getSpatialEngine().setPosition(azimuth, elevation, distance, depth);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialAzimuth = useCallback(
    (azimuth: number) => {
      audioEngineInstance.getSpatialEngine().setAzimuth(azimuth);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialElevation = useCallback(
    (elevation: number) => {
      audioEngineInstance.getSpatialEngine().setElevation(elevation);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialDistance = useCallback(
    (distance: number) => {
      audioEngineInstance.getSpatialEngine().setDistance(distance);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialDepth = useCallback(
    (depth: number) => {
      audioEngineInstance.getSpatialEngine().setDepth(depth);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialWidth = useCallback(
    (width: number) => {
      audioEngineInstance.getSpatialEngine().setWidth(width);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialCenterLevel = useCallback(
    (level: number) => {
      audioEngineInstance.getSpatialEngine().setCenterLevel(level);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialSurroundBalance = useCallback(
    (balance: number) => {
      audioEngineInstance.getSpatialEngine().setSurroundBalance(balance);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialRoomSize = useCallback(
    (size: RoomSizeType) => {
      audioEngineInstance.getSpatialEngine().setRoomSize(size);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialRoomMix = useCallback(
    (mix: number) => {
      audioEngineInstance.getSpatialEngine().setRoomMix(mix);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialReverbDecay = useCallback(
    (decay: number) => {
      audioEngineInstance.getSpatialEngine().setReverbDecay(decay);
      syncSpatialState();
    },
    [syncSpatialState]
  );

  const setSpatialCrossfeed = useCallback(
    (mode: CrossfeedMode) => {
      audioEngineInstance.getSpatialEngine().setCrossfeed(mode);
      syncSpatialState();
      updateSettings({ spatialCrossfeed: mode });
    },
    [syncSpatialState, updateSettings]
  );

  const setSpatialBypass = useCallback(
    (bypass: boolean) => {
      audioEngineInstance.getSpatialEngine().setBypass(bypass);
      syncSpatialState();
      updateSettings({ spatialBypass: bypass });
    },
    [syncSpatialState, updateSettings]
  );

  const toggleSpatialAb = useCallback(() => {
    audioEngineInstance.getSpatialEngine().toggleAB();
    syncSpatialState();
  }, [syncSpatialState]);

  const resetSpatialSettings = useCallback(() => {
    audioEngineInstance.getSpatialEngine().reset();
    syncSpatialState();
  }, [syncSpatialState]);

  const loadSpatialPreset = useCallback(
    async (presetNameOrId: string) => {
      const builtin = getSpatialPresetByName(presetNameOrId);
      if (builtin && builtin.isBuiltin) {
        audioEngineInstance.getSpatialEngine().loadPreset(builtin);
        syncSpatialState();
        return;
      }
      const custom = customSpatialPresets.find((p) => p.id === presetNameOrId || p.name === presetNameOrId);
      if (custom) {
        try {
          const parsed = JSON.parse(custom.settings_json);
          audioEngineInstance.getSpatialEngine().loadState(parsed);
          syncSpatialState();
        } catch (err) {
          console.warn('Failed to parse spatial preset:', err);
        }
      }
    },
    [customSpatialPresets, syncSpatialState]
  );

  const saveCustomSpatialPreset = useCallback(
    async (name: string) => {
      const cur = audioEngineInstance.getSpatialEngine().getState();
      const preset: AudioPresetRecord = {
        id: `spatial_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        type: 'spatial' as any,
        settings_json: JSON.stringify(cur),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await AudioPresetRepository.save(preset);
      const all = await AudioPresetRepository.getAll();
      setCustomSpatialPresets(all.filter((p) => (p.type as string) === 'spatial'));
    },
    []
  );

  const deleteCustomSpatialPreset = useCallback(async (id: string) => {
    await AudioPresetRepository.delete(id);
    const all = await AudioPresetRepository.getAll();
    setCustomSpatialPresets(all.filter((p) => (p.type as string) === 'spatial'));
  }, []);

  // --- Visualizer Handlers (Part 5) ---
  const updateVisualizerSettings = useCallback(
    (newSettings: Partial<VisualizerSettings>) => {
      audioEngineInstance.getVisualizerEngine().updateSettings(newSettings);
      setVisualizerSettings(audioEngineInstance.getVisualizerEngine().getSettings());
      updateSettings({
        ...(newSettings.enabled !== undefined ? { visualizerEnabled: newSettings.enabled } : {}),
        ...(newSettings.mode !== undefined ? { visualizerMode: newSettings.mode } : {}),
        ...(newSettings.fps !== undefined ? { visualizerFps: newSettings.fps } : {}),
        ...(newSettings.quality !== undefined ? { visualizerQuality: newSettings.quality } : {}),
        ...(newSettings.fftSize !== undefined ? { visualizerFftSize: newSettings.fftSize } : {}),
        ...(newSettings.windowFunction !== undefined ? { visualizerWindowFunction: newSettings.windowFunction } : {}),
        ...(newSettings.frequencyScale !== undefined ? { visualizerFrequencyScale: newSettings.frequencyScale } : {}),
        ...(newSettings.analysisTap !== undefined ? { visualizerAnalysisTap: newSettings.analysisTap } : {}),
        ...(newSettings.sensitivity !== undefined ? { visualizerSensitivity: newSettings.sensitivity } : {}),
        ...(newSettings.smoothing !== undefined ? { visualizerSmoothing: newSettings.smoothing } : {}),
        ...(newSettings.dbRange !== undefined ? { visualizerDbRange: newSettings.dbRange } : {}),
        ...(newSettings.peakHold !== undefined ? { visualizerPeakHold: newSettings.peakHold } : {}),
        ...(newSettings.mirror !== undefined ? { visualizerMirror: newSettings.mirror } : {}),
        ...(newSettings.stereoMode !== undefined ? { visualizerStereoMode: newSettings.stereoMode } : {}),
        ...(newSettings.reducedMotion !== undefined ? { visualizerReducedMotion: newSettings.reducedMotion } : {}),
        ...(newSettings.pauseBehavior !== undefined ? { visualizerPauseBehavior: newSettings.pauseBehavior } : {}),
        ...(newSettings.colorMode !== undefined ? { visualizerColorMode: newSettings.colorMode } : {}),
        ...(newSettings.customColor !== undefined ? { visualizerCustomColor: newSettings.customColor } : {}),
        ...(newSettings.showArtwork !== undefined ? { visualizerShowArtwork: newSettings.showArtwork } : {}),
        ...(newSettings.showTrackInfo !== undefined ? { visualizerShowTrackInfo: newSettings.showTrackInfo } : {}),
      });
    },
    [updateSettings]
  );

  // Queue actions
  const playNext = useCallback((item: Track | Track[]) => {
    const items = Array.isArray(item) ? item : [item];
    if (items.length === 0) return;

    setQueue((prev) => {
      const curIdx = queueIndexRef.current;
      if (curIdx < 0 || curIdx >= prev.length) {
        return [...prev, ...items];
      }
      const next = [...prev];
      next.splice(curIdx + 1, 0, ...items);
      return next;
    });
  }, []);

  const addToQueue = useCallback((item: Track | Track[]) => {
    const items = Array.isArray(item) ? item : [item];
    if (items.length === 0) return;
    setQueue((prev) => [...prev, ...items]);
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const updated = [...prev];
      updated.splice(index, 1);
      return updated;
    });

    setQueueIndex((prevIndex) => {
      if (index < prevIndex) {
        return prevIndex - 1;
      } else if (index === prevIndex) {
        if (queueRef.current.length <= 1) {
          audioEngineInstance.stop();
          setCurrentTrack(null);
          return -1;
        }
        return Math.min(prevIndex, queueRef.current.length - 2);
      }
      return prevIndex;
    });
  }, []);

  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      if (
        fromIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });

    setQueueIndex((prevIndex) => {
      if (prevIndex === fromIndex) {
        return toIndex;
      }
      if (fromIndex < prevIndex && toIndex >= prevIndex) {
        return prevIndex - 1;
      }
      if (fromIndex > prevIndex && toIndex <= prevIndex) {
        return prevIndex + 1;
      }
      return prevIndex;
    });
  }, []);

  const clearQueue = useCallback((keepCurrent = true) => {
    const cur = currentTrackRef.current;
    if (keepCurrent && cur) {
      setQueue([cur]);
      setQueueIndex(0);
      setShuffledOrder([0]);
    } else {
      audioEngineInstance.stop();
      setCurrentTrack(null);
      setQueue([]);
      setQueueIndex(-1);
      setShuffledOrder([]);
    }
  }, []);

  const toggleFavorite = useCallback(
    async (trackId?: string) => {
      const targetId = trackId || currentTrack?.id;
      if (!targetId) return;

      const track = await TrackRepository.getById(targetId);
      if (track) {
        const nextFav = !track.isFavorite;
        await TrackRepository.setFavorite(targetId, nextFav);
        if (currentTrack && currentTrack.id === targetId) {
          setCurrentTrack({ ...currentTrack, isFavorite: nextFav });
        }
        setQueue((prev) =>
          prev.map((t) => (t.id === targetId ? { ...t, isFavorite: nextFav } : t))
        );
      }
    },
    [currentTrack]
  );

  const setTrackRating = useCallback(
    async (trackId: string, rating: number) => {
      await TrackRepository.setRating(trackId, rating);
      if (currentTrack && currentTrack.id === trackId) {
        setCurrentTrack((prev) => (prev ? { ...prev, rating } : null));
      }
      setQueue((prevQueue) =>
        prevQueue.map((t) => (t.id === trackId ? { ...t, rating } : t))
      );
    },
    [currentTrack]
  );

  const playPlaylist = useCallback(
    async (tracks: Track[], startIndex = 0) => {
      if (!tracks || tracks.length === 0) return;
      const initialIdx = Math.max(0, Math.min(startIndex, tracks.length - 1));
      setQueue(tracks);
      setQueueIndex(initialIdx);
      setShuffledOrder([]);
      await playTrack(tracks[initialIdx]);
    },
    [playTrack]
  );

  const shufflePlaylist = useCallback(
    async (tracks: Track[]) => {
      if (!tracks || tracks.length === 0) return;
      const initialIdx = Math.floor(Math.random() * tracks.length);
      setQueue(tracks);
      setQueueIndex(initialIdx);
      audioEngineInstance.setShuffle(true);
      setShuffledOrder(generateShuffleOrder(tracks.length, initialIdx));
      await playTrack(tracks[initialIdx]);
    },
    [generateShuffleOrder, playTrack]
  );

  const saveQueueAsPlaylist = useCallback(
    async (name: string, description?: string): Promise<string> => {
      const pl = await PlaylistRepository.create(name, description);
      if (queueRef.current.length > 0) {
        await PlaylistTrackRepository.addTracks(pl.id, queueRef.current);
      }
      return pl.id;
    },
    []
  );

  const setOutputDevice = useCallback(async (deviceId: string) => {
    return await audioEngineInstance.setAudioOutputDevice(deviceId);
  }, []);

  const toggleQueue = useCallback(() => {
    setIsQueueOpen((prev) => !prev);
  }, []);

  const toggleDspModal = useCallback(() => {
    setIsDspModalOpen((prev) => !prev);
  }, []);

  // Periodic and unmount state persistence
  useEffect(() => {
    const interval = setInterval(() => {
      const cur = currentTrackRef.current;
      const state = engineStateRef.current;
      const q = queueRef.current;
      const qIdx = queueIndexRef.current;

      if (cur || q.length > 0) {
        const persistence: PlaybackStatePersistence = {
          trackId: cur ? cur.id : null,
          position: state.currentTime,
          volume: state.volume,
          isMuted: state.isMuted,
          playbackRate: state.playbackRate,
          repeatMode: state.repeatMode,
          isShuffle: state.isShuffle,
          queue: q,
          queueIndex: qIdx,
          updatedAt: Date.now(),
        };
        PlayerStateRepository.savePlayerState(persistence);
      }

      // Also persist active DSP state to localStorage
      try {
        localStorage.setItem(
          'nova_dsp_processing_state',
          JSON.stringify(audioEngineInstance.getProcessingState())
        );
      } catch {
        // ignore
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Initial resume on application startup
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    async function restorePlayback() {
      try {
        // Restore DSP processing settings
        const dspLocal = localStorage.getItem('nova_dsp_processing_state');
        if (dspLocal) {
          try {
            const parsed = JSON.parse(dspLocal);
            audioEngineInstance.getProcessor().loadState(parsed);
            setDspState(audioEngineInstance.getProcessingState());
          } catch {
            // ignore
          }
        }

        const last = await PlayerStateRepository.getPlayerState();
        if (!last) return;

        if (last.volume !== undefined) audioEngineInstance.setVolume(last.volume);
        if (last.isMuted !== undefined) audioEngineInstance.setMute(last.isMuted);
        if (last.playbackRate !== undefined) audioEngineInstance.setPlaybackRate(last.playbackRate);
        if (last.repeatMode !== undefined) audioEngineInstance.setRepeatMode(last.repeatMode);
        if (last.isShuffle !== undefined) audioEngineInstance.setShuffle(last.isShuffle);

        if (settings.restoreQueue && last.queue && last.queue.length > 0) {
          setQueue(last.queue);
          const restoredIdx =
            last.queueIndex >= 0 && last.queueIndex < last.queue.length ? last.queueIndex : 0;
          setQueueIndex(restoredIdx);

          const trackToLoad = last.queue[restoredIdx];
          if (trackToLoad) {
            setCurrentTrack(trackToLoad);
            const initialPos = settings.resumeLastPosition ? last.position || 0 : 0;
            const autoPlay = Boolean(settings.autoplay);

            const effectiveTrack: Track = {
              ...trackToLoad,
              path:
                (trackToLoad as unknown as { playbackUrl?: string }).playbackUrl ||
                trackToLoad.path,
            };

            await audioEngineInstance.loadTrack(effectiveTrack, autoPlay, initialPos);

            if (autoPlay) {
              sessionStartRef.current = {
                trackId: trackToLoad.id,
                startedAt: Date.now(),
                startPosition: initialPos,
              };
            }
          }
        }
      } catch (err) {
        console.warn('Playback resume skipped:', err);
      }
    }

    restorePlayback();
  }, [settings.restoreQueue, settings.resumeLastPosition, settings.autoplay]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekForward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, engineStateRef.current.volume + 0.05));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, engineStateRef.current.volume - 0.05));
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyN':
          nextTrack();
          break;
        case 'KeyP':
          prevTrack();
          break;
        case 'KeyS':
          toggleShuffle();
          break;
        case 'KeyR': {
          const modes: RepeatMode[] = ['off', 'all', 'one'];
          const next =
            modes[(modes.indexOf(engineStateRef.current.repeatMode) + 1) % modes.length];
          setRepeatMode(next);
          break;
        }
        case 'KeyQ':
          toggleQueue();
          break;
        case 'KeyE':
          toggleDspModal();
          break;
        case 'KeyV':
          toggleFullscreenVisualizer();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlayPause,
    seekBackward,
    seekForward,
    setVolume,
    toggleMute,
    nextTrack,
    prevTrack,
    toggleShuffle,
    setRepeatMode,
    toggleQueue,
    toggleDspModal,
    toggleFullscreenVisualizer,
  ]);

  // Part 16: External File Open & Intent Handling (ACTION_VIEW / ACTION_SEND)
  useEffect(() => {
    const unsub = androidBridgeInstance.registerIntentListener(async (files, action) => {
      if (!files || files.length === 0) return;
      try {
        const importedTracks: Track[] = [];
        for (const file of files) {
          const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
          const meta = await parseAudioFileMetadata(file, file.name, file.name, Date.now());
          const trackId = generateTrackIdentity(file.name, file.size, Date.now());
          const track: Track = {
            id: trackId,
            folderPath: 'External Files',
            path: file.name,
            filename: file.name,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
            duration: meta.duration,
            format: ext,
            dateAdded: Date.now(),
            playCount: 0,
            isFavorite: false,
            source: 'local',
            playbackUrl: URL.createObjectURL(file),
          };
          importedTracks.push(track);
        }

        if (importedTracks.length > 0) {
          if (settings.externalFileAction === 'play_immediately') {
            await playTrack(importedTracks[0], [...importedTracks, ...queueRef.current], 0);
          } else {
            addToQueue(importedTracks);
          }
        }
      } catch (err) {
        console.warn('Failed to handle external audio intent:', err);
      }
    });
    return unsub;
  }, [playTrack, addToQueue, settings.externalFileAction]);

  // Part 16: Deep Linking & Launcher Shortcuts (novamusic:// and query params)
  useEffect(() => {
    deepLinkManagerInstance.setActionHandler(async (action) => {
      if (action.type === 'nowplaying') {
        setIsFullPlayerOpen(true);
      } else if (action.type === 'track' && action.id) {
        const trk = await TrackRepository.getById(action.id);
        if (trk) {
          await playTrack(trk);
        }
      } else if (action.type === 'online' && action.url) {
        await playYouTubeUrl(action.url);
      }
    });
  }, [playTrack, playYouTubeUrl]);

  return (
    <PlayerContext.Provider
      value={{
        state: engineState,
        currentTrack,
        setCurrentTrack,
        queue,
        queueIndex,
        isFullPlayerOpen,
        setIsFullPlayerOpen,
        isQueueOpen,
        setIsQueueOpen,
        toggleQueue,
        isDspModalOpen,
        setIsDspModalOpen,
        toggleDspModal,
        isSpatialModalOpen,
        setIsSpatialModalOpen,
        toggleSpatialModal,
        isFullscreenVisualizerOpen,
        setIsFullscreenVisualizerOpen,
        toggleFullscreenVisualizer,

        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seek,
        seekForward,
        seekBackward,
        setVolume,
        setVolumeBoost,
        setMute,
        toggleMute,
        setPlaybackRate,
        setRepeatMode,
        shuffleMode,
        setShuffleMode,
        cycleShuffleMode,
        toggleShuffle,
        setAudioProfile,
        setSpatialMode,

        // DSP Actions
        dspState,
        levelData,
        setPreamp,
        setEqualizerBand,
        setEqualizerBands,
        resetEqualizer,
        setBassBoost,
        setTreble,
        setVocalEnhancement,
        setLoudness,
        setCompressor,
        setLimiter,
        setStereoWidth,
        setBalance,
        setMono,
        setAutoHeadroom,
        setMaxOutputLevel,
        setDspBypass,
        toggleAbComparison,
        resetAudioProcessing,
        loadDspState,

        // Custom Presets
        customPresets,
        saveCustomPreset,
        deleteCustomPreset,
        loadPreset,

        // Spatial Audio (Part 5)
        spatialState,
        spatialCapabilities,
        setSpatialIntensity,
        setSpatialPosition,
        setSpatialAzimuth,
        setSpatialElevation,
        setSpatialDistance,
        setSpatialDepth,
        setSpatialWidth,
        setSpatialCenterLevel,
        setSpatialSurroundBalance,
        setSpatialRoomSize,
        setSpatialRoomMix,
        setSpatialReverbDecay,
        setSpatialCrossfeed,
        setSpatialBypass,
        toggleSpatialAb,
        resetSpatialSettings,
        loadSpatialPreset,
        saveCustomSpatialPreset,
        customSpatialPresets,
        deleteCustomSpatialPreset,

        // Visualizer (Part 5)
        visualizerSettings,
        updateVisualizerSettings,
        visualizerEngine: audioEngineInstance.getVisualizerEngine(),

        playNext,
        addToQueue,
        removeFromQueue,
        reorderQueue,
        clearQueue,

        toggleFavorite,
        setTrackRating,
        playPlaylist,
        shufflePlaylist,
        saveQueueAsPlaylist,
        outputDevices,
        detailedOutputDevices,
        currentOutputDeviceInfo,
        setOutputDevice,
        refreshOutputDevices,

        // Online / YouTube Playback & Caching (Parts 6 & 7)
        onlinePlaybackState,
        playYouTubeUrl,
        playCachedYouTubeTrack,
        cacheYouTubeTrack,
        endOnlineSession,
        pendingOnlineTrack,
        playPendingOnlineTrack,
        cancelPendingOnlineTrack,

        // Part 13: Advanced Audio Control Center & Audio Profiles
        isAudioControlCenterOpen,
        setIsAudioControlCenterOpen,
        toggleAudioControlCenter,
        audioProfileConfig,
        audioProfileSource,
        audioProfileMatchedName,
        customProfilesEnabled,
        setCustomProfilesEnabled,
        isSongProfileRemembered,
        setRememberSongProfile,
        saveCurrentAsSongProfile,
        clearSongProfile,
        setAlbumAudioProfile,
        setArtistAudioProfile,
        setGlobalAudioProfile,
        resetAudioSettings,
        exportAudioProfiles,
        importAudioProfiles,
        renameCustomPreset,
        duplicateCustomPreset,
        resetCustomPresets,
        setBassBoostPercent,
        resetTreble,
        setReplayGainMode,
        setVolumeNormalization,
        setPreventClipping,
        setVirtualSurround,
        activeDolbyMode,
        setDolbyMode,
        dolbyStatus,
        isDolbyHardwareSupported,
        nightModeEnabled,
        setNightModeEnabled,
        toggleNightMode,
        voiceModeEnabled,
        setVoiceModeEnabled,
        toggleVoiceMode,
        crossfadeDuration,
        setCrossfadeDuration,
        activeAudioBadges,
        audioFormatBadge,
        audiobookControls,
        fadeIn,
        fadeOut,
        isAudioOutputModalOpen,
        setIsAudioOutputModalOpen,
        openAudioOutputModal,
        triggerMediaButtonPress,
        simulateAudioFocusInterruption,
        simulateAudioFocusRegain,
        isStoragePermissionModalOpen,
        setIsStoragePermissionModalOpen,
        openStoragePermissionModal,
        isWidgetPreviewModalOpen,
        setIsWidgetPreviewModalOpen,
        openWidgetPreviewModal,
        shareCurrentTrack,
        syncMediaStoreFiles,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export function usePlayer(): PlayerContextType {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

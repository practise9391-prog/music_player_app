import { BuiltinPreset, ThemeMode, UiDensity } from './theme';
import { AudioProfileName, RepeatMode, SpatialMode } from './player';
import { CrossfeedMode } from './spatial';
import {
  VisualizerMode,
  VisualizerFps,
  VisualizerColorMode,
  VisualizerFftSize,
  VisualizerQuality,
  FftWindowFunction,
  FrequencyScale,
  AnalysisTapSource,
  PauseBehavior,
} from './visualizer';
import { HomeDashboardSettings, DEFAULT_HOME_SETTINGS } from './homeDashboard';

export interface AppSettings {
  // Theme & Appearance
  themePreset: BuiltinPreset | 'Custom';
  themeMode: ThemeMode;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
  backgroundColor: string;
  textColor: string;
  uiDensity: UiDensity;
  glassEffectEnabled: boolean;
  borderRadiusLevel: 'subtle' | 'rounded' | 'pill';

  // Audio & Volume
  volume: number;
  volumeBoost: number;
  clippingProtectionEnabled: boolean;
  equalizerEnabled: boolean;
  spatialAudioEnabled: boolean;
  spatialMode: SpatialMode;
  spatialIntensity: number; // 0.0 to 1.5
  spatialPreset: string;
  spatialWidth: number;
  spatialDepth: number;
  spatialDistance: number;
  spatialElevation: number;
  spatialAzimuth: number;
  spatialCrossfeed: CrossfeedMode;
  spatialRoomSize: string;
  spatialReverbDecay: number;
  spatialCenterLevel: number;
  spatialBypass: boolean;
  audioProfile: AudioProfileName;
  visualizerEnabled: boolean;
  visualizerMode: VisualizerMode;
  visualizerFps: VisualizerFps;
  visualizerQuality: VisualizerQuality;
  visualizerFftSize: VisualizerFftSize;
  visualizerWindowFunction: FftWindowFunction;
  visualizerFrequencyScale: FrequencyScale;
  visualizerAnalysisTap: AnalysisTapSource;
  visualizerSensitivity: number;
  visualizerSmoothing: number;
  visualizerDbRange: number;
  visualizerPeakHold: boolean;
  visualizerMirror: boolean;
  visualizerStereoMode: boolean;
  visualizerReducedMotion: boolean;
  visualizerPauseBehavior: PauseBehavior;
  visualizerColorMode: VisualizerColorMode;
  visualizerCustomColor: string;
  visualizerShowArtwork: boolean;
  visualizerShowTrackInfo: boolean;
  maxOutputLevel: number; // 0.5 to 1.0 safety ceiling
  autoHeadroom: boolean;
  dspBypass: boolean;
  highVolumeWarningDismissed: boolean;

  // Advanced Audio Engine & Profiles (Part 13)
  customProfilesEnabled: boolean;
  replayGainMode: 'off' | 'track' | 'album';
  volumeNormalization: 'off' | 'track' | 'album';
  preventClipping: boolean;
  virtualSurround: number; // 0 to 100
  dolbyMode: string;
  nightModeEnabled: boolean;
  voiceModeEnabled: boolean;
  fadeInDuration: number; // 0 to 5s
  fadeOutDuration: number; // 0 to 5s
  skipSilence: 'off' | 'low' | 'medium' | 'high';
  skipSilenceOnlySpoken: boolean;
  audiobookMode: boolean;
  monoAudio: boolean;

  // Playback (Section 46)
  autoplay: boolean;
  resumeLastPosition: boolean;
  restoreQueue: boolean;
  previousTrackThreshold: number; // in seconds, default 3
  seekForwardInterval: number; // in seconds, default 5
  seekBackwardInterval: number; // in seconds, default 5
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  playbackRate: number;
  crossfadeDuration: number; // 0, 2, 4, 6, 8, 10, 12 seconds
  gaplessPlayback: boolean;

  // Network & Air-Gap
  networkLocked: boolean;
  askBeforeOnlineAccess: boolean;

  // Online Playback & YouTube (Part 6)
  youtubePlaybackEnabled: boolean;
  askBeforeOnlinePlayback: boolean;
  allowQueuedOnlinePlayback: boolean;
  maxAudioQuality: 'auto' | '128k' | '160k' | '256k' | 'best';
  preferredAudioFormat: 'auto' | 'opus' | 'm4a' | 'aac' | 'webm';
  maxBufferSeconds: number;
  endNetworkSessionOnStop: boolean;

  // YouTube Caching & Offline Replay (Part 7)
  cacheYouTubeAudio: boolean; // default false
  askBeforeCaching: boolean; // default true
  autoCachePlayedTracks: boolean; // default false
  maxCacheSizeBytes: number; // default 2 * 1024 * 1024 * 1024 (2 GB)
  protectFavoritesFromEviction: boolean; // default true

  // Library
  musicFolders: string[];
  scanSubfolders: boolean;
  monitorFolders: boolean;
  autoScanOnStartup: boolean;
  scanIntervalHours: number;
  defaultLibrarySort: string;
  showFileFormat: boolean;
  showBitrate: boolean;
  showSampleRate: boolean;
  saveSearchHistory: boolean; // Part 11: Save search history toggle

  // Debug & Developer
  debugModeEnabled: boolean;

  // Lyrics (Part 14)
  showLyricsAutomatically: boolean;
  searchOnlineLyricsEnabled: boolean;
  askBeforeOnlineLyricsSearch: boolean;
  lyricsAutoScroll: boolean;
  lyricsKaraokeMode: boolean;
  lyricsFontSize: 'sm' | 'md' | 'lg' | 'xl';
  lyricsAlignment: 'left' | 'center' | 'right';
  lyricsLineSpacing: 'compact' | 'normal' | 'large';
  lyricsTheme: 'player' | 'dark' | 'light' | 'album_art';
  lyricsDisplayMode: 'original' | 'translation' | 'both';
  lyricsDefaultLanguage: string;
  saveLyricsOffline: boolean;
  lyricsGlobalOffset: number; // in seconds (-10.0 to +10.0, default 0)
  showLyricsSource: boolean;

  // Background Playback, Media Controls & Audio Focus (Part 15)
  backgroundPlaybackEnabled: boolean;
  wakeLockEnabled: boolean;
  audioFocusMode: 'follow_system' | 'pause' | 'duck';
  resumeAfterInterruption: boolean;
  audioDuckVolumePercent: number; // e.g. 25%
  pauseOnHeadphoneDisconnect: boolean;
  autoApplyDeviceProfiles: boolean;
  showMediaNotification: boolean;
  notificationActionLayout: 'compact' | 'extended';
  notificationPrivacy: 'full' | 'limited' | 'hidden';
  headsetButtonControlsEnabled: boolean;
  resumeOnDeviceRestart: boolean;

  // Android & Native System Integration (Part 16)
  androidStoragePermissionRequested: boolean;
  autoSyncMediaStoreOnLaunch: boolean;
  externalFileAction: 'play_immediately' | 'add_to_queue' | 'ask';
  widgetArtworkQuality: 'low' | 'medium' | 'high';
  enableHomeScreenWidgets: boolean;
  enableQuickSettingsTile: boolean;
  adaptiveTabletLayoutEnabled: boolean;
  safPersistedUris: string[];
  notifyLibraryChanges: boolean;

  // Download Manager & Offline Music (Part 17)
  downloadAllowWifi: boolean;
  downloadAllowCellular: boolean;
  downloadAskCellular: boolean;
  maxConcurrentDownloads: number;
  downloadAutoPauseOffline: boolean;
  downloadAutoResumeOnline: boolean;
  downloadShowNotifications: boolean;
  defaultDownloadLocation: string;
  downloadDuplicateAction: 'rename' | 'skip' | 'overwrite';

  // Home Dashboard & Music Discovery (Part 19)
  homeDashboardSettings?: HomeDashboardSettings;

  // Security & App Lock (Part 20)
  appLockEnabled: boolean;
  appLockPinHash: string;
  appLockPinSalt: string;
  appLockBiometricsEnabled: boolean;
  appLockTimeoutMinutes: number; // 0 = immediately, 1, 5, 15
  appLockGracePeriodSeconds: number;
  appLockSecureScreen: boolean;

  // Privacy & Diagnostics (Part 20)
  saveListeningHistory: boolean;
  diagnosticLoggingEnabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // Extended Audio & Balance (Part 20 & 21)
  audioBalance: number; // -1.0 (left) to 1.0 (right)
  silenceThresholdDb: number; // -60 to -20 dB

  // Extended Library Filter Options (Part 20 & 21)
  ignoreShorterThanSeconds: number;
  fileFormatFilter: string[];

  // Playback Automation, Language & Preferences (Parts 22 - 25)
  language: 'en' | 'te' | 'hi';
  rememberTrackPositions: boolean;
  sleepTimerFadeOutSeconds: number;
  privateListeningMode: boolean;
  firstLaunchCompleted: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themePreset: 'Midnight',
  themeMode: 'dark',
  accentColor: '#00e5ff',
  buttonColor: '#00e5ff',
  buttonTextColor: '#08080c',
  backgroundColor: '#0a0b10',
  textColor: '#f8fafc',
  uiDensity: 'comfortable',
  glassEffectEnabled: true,
  borderRadiusLevel: 'rounded',

  volume: 0.8,
  volumeBoost: 1.0,
  clippingProtectionEnabled: true,
  equalizerEnabled: false,
  spatialAudioEnabled: false,
  spatialMode: 'off',
  spatialIntensity: 0.0,
  spatialPreset: 'Natural',
  spatialWidth: 1.0,
  spatialDepth: 0.5,
  spatialDistance: 0.3,
  spatialElevation: 0,
  spatialAzimuth: 0,
  spatialCrossfeed: 'off',
  spatialRoomSize: 'studio',
  spatialReverbDecay: 1.2,
  spatialCenterLevel: 0.0,
  spatialBypass: false,
  audioProfile: 'Flat',
  visualizerEnabled: true,
  visualizerMode: 'spectrum',
  visualizerFps: 'medium',
  visualizerQuality: 'high',
  visualizerFftSize: 2048,
  visualizerWindowFunction: 'hann',
  visualizerFrequencyScale: 'logarithmic',
  visualizerAnalysisTap: 'post_spatial',
  visualizerSensitivity: 50,
  visualizerSmoothing: 75,
  visualizerDbRange: 72,
  visualizerPeakHold: true,
  visualizerMirror: false,
  visualizerStereoMode: true,
  visualizerReducedMotion: false,
  visualizerPauseBehavior: 'freeze',
  visualizerColorMode: 'theme',
  visualizerCustomColor: '#00e5ff',
  visualizerShowArtwork: true,
  visualizerShowTrackInfo: true,
  maxOutputLevel: 1.0,
  autoHeadroom: true,
  dspBypass: false,
  highVolumeWarningDismissed: false,

  // Advanced Audio Engine & Profiles Defaults (Part 13)
  customProfilesEnabled: true,
  replayGainMode: 'off',
  volumeNormalization: 'off',
  preventClipping: true,
  virtualSurround: 0,
  dolbyMode: 'off',
  nightModeEnabled: false,
  voiceModeEnabled: false,
  fadeInDuration: 0,
  fadeOutDuration: 0,
  skipSilence: 'off',
  skipSilenceOnlySpoken: true,
  audiobookMode: false,
  monoAudio: false,

  // Playback settings defaults (Section 46)
  autoplay: true,
  resumeLastPosition: true,
  restoreQueue: true,
  previousTrackThreshold: 3,
  seekForwardInterval: 5,
  seekBackwardInterval: 5,
  repeatMode: 'off',
  shuffleEnabled: false,
  playbackRate: 1.0,
  crossfadeDuration: 0,
  gaplessPlayback: true,

  networkLocked: true,
  askBeforeOnlineAccess: true,

  // Online Playback & YouTube Defaults (Part 6)
  youtubePlaybackEnabled: true,
  askBeforeOnlinePlayback: true,
  allowQueuedOnlinePlayback: false,
  maxAudioQuality: 'auto',
  preferredAudioFormat: 'auto',
  maxBufferSeconds: 60,
  endNetworkSessionOnStop: true,

  // YouTube Caching & Offline Replay Defaults (Part 7)
  cacheYouTubeAudio: false,
  askBeforeCaching: true,
  autoCachePlayedTracks: false,
  maxCacheSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  protectFavoritesFromEviction: true,

  musicFolders: [],
  scanSubfolders: true,
  monitorFolders: false,
  autoScanOnStartup: true,
  scanIntervalHours: 24,
  defaultLibrarySort: 'title_asc',
  showFileFormat: true,
  showBitrate: true,
  showSampleRate: true,
  saveSearchHistory: true,

  debugModeEnabled: false,

  // Lyrics Defaults (Part 14)
  showLyricsAutomatically: false,
  searchOnlineLyricsEnabled: false,
  askBeforeOnlineLyricsSearch: true,
  lyricsAutoScroll: true,
  lyricsKaraokeMode: false,
  lyricsFontSize: 'md',
  lyricsAlignment: 'center',
  lyricsLineSpacing: 'normal',
  lyricsTheme: 'player',
  lyricsDisplayMode: 'original',
  lyricsDefaultLanguage: 'original',
  saveLyricsOffline: true,
  lyricsGlobalOffset: 0,
  showLyricsSource: true,

  // Background Playback, Media Controls & Audio Focus (Part 15)
  backgroundPlaybackEnabled: true,
  wakeLockEnabled: true,
  audioFocusMode: 'follow_system',
  resumeAfterInterruption: true,
  audioDuckVolumePercent: 25,
  pauseOnHeadphoneDisconnect: true,
  autoApplyDeviceProfiles: true,
  showMediaNotification: true,
  notificationActionLayout: 'compact',
  notificationPrivacy: 'full',
  headsetButtonControlsEnabled: true,
  resumeOnDeviceRestart: false,

  // Android & Native System Integration (Part 16)
  androidStoragePermissionRequested: false,
  autoSyncMediaStoreOnLaunch: true,
  externalFileAction: 'play_immediately',
  widgetArtworkQuality: 'medium',
  enableHomeScreenWidgets: true,
  enableQuickSettingsTile: true,
  adaptiveTabletLayoutEnabled: true,
  safPersistedUris: [],
  notifyLibraryChanges: false,

  // Download Manager & Offline Music (Part 17)
  downloadAllowWifi: true,
  downloadAllowCellular: false,
  downloadAskCellular: true,
  maxConcurrentDownloads: 1,
  downloadAutoPauseOffline: true,
  downloadAutoResumeOnline: true,
  downloadShowNotifications: true,
  defaultDownloadLocation: 'Downloads/NovaMusic',
  downloadDuplicateAction: 'rename',

  // Home Dashboard & Music Discovery (Part 19)
  homeDashboardSettings: DEFAULT_HOME_SETTINGS,

  // Security & App Lock (Part 20)
  appLockEnabled: false,
  appLockPinHash: '',
  appLockPinSalt: '',
  appLockBiometricsEnabled: false,
  appLockTimeoutMinutes: 0,
  appLockGracePeriodSeconds: 30,
  appLockSecureScreen: false,

  // Privacy & Diagnostics (Part 20)
  saveListeningHistory: true,
  diagnosticLoggingEnabled: false,
  logLevel: 'info',

  // Extended Audio & Balance (Part 20 & 21)
  audioBalance: 0.0,
  silenceThresholdDb: -40,

  // Extended Library Filter Options (Part 20 & 21)
  ignoreShorterThanSeconds: 0,
  fileFormatFilter: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'opus', 'aac', 'webm'],

  // Playback Automation, Language & Preferences Defaults (Parts 22 - 25)
  language: 'en',
  rememberTrackPositions: true,
  sleepTimerFadeOutSeconds: 15,
  privateListeningMode: false,
  firstLaunchCompleted: true,
};

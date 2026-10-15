import React, { useEffect, useState } from 'react';
import { useSettings } from '../settings/SettingsContext';
import { useTheme } from '../themes/ThemeContext';
import { useNetwork } from '../network/NetworkContext';
import { usePlayer } from '../player/PlayerContext';
import { THEME_PRESETS } from '../themes/presets';
import { evaluateContrast } from '../themes/contrast';
import { Button } from '../components/ui/Button';
import { notificationService } from '../services/errorService';
import { BuiltinPreset, MusicFolderRecord, SpatialMode, ThemeMode, CacheStatistics } from '../types';
import { FolderRepository, TrackRepository, DownloadRepository } from '../database/repository';
import { CacheManager } from '../services/youtube/CacheManager';
import { downloadStorageService } from '../services/download/DownloadStorageService';
import { db } from '../database/db';
import {
  Palette,
  Volume2,
  Lock,
  Unlock,
  Sliders,
  Shield,
  Keyboard,
  Info,
  Check,
  Sparkles,
  RotateCcw,
  Folder,
  FolderPlus,
  RefreshCw,
  HardDrive,
  Trash2,
  Compass,
  Activity,
  Radio,
  Eye,
  BarChart3,
  Globe,
  FileText,
  Download,
  Upload,
  FileJson,
  CheckCircle2,
  Headphones,
  Bluetooth,
  Bell,
  Smartphone,
  Layers,
  ExternalLink,
  Car,
  AlertCircle,
  Share2,
  Wifi,
  Fingerprint,
  KeyRound,
  CheckSquare,
  FileCheck,
  Terminal,
  Languages,
} from 'lucide-react';
import { androidBridgeInstance } from '../services/android/AndroidBridge';
import { mediaStoreSyncServiceInstance } from '../services/android/MediaStoreSyncService';
import { VisualizerLabModal } from '../components/visualizer/VisualizerLabModal';
import { LibraryDiagnosticsModal } from '../components/diagnostics/LibraryDiagnosticsModal';
import { useTranslation } from '../services/i18n/I18nService';
import { SupportedLanguage } from '../services/i18n/translations';
import {
  MusicDataBackupService,
  ImportBackupResult,
} from '../services/storage/MusicDataBackupService';
import { appLockServiceInstance } from '../services/security/AppLockService';
import { storageManagementServiceInstance } from '../services/storage/StorageManagementService';
import { diagnosticServiceInstance } from '../services/diagnostics/DiagnosticService';
import { permissionManagerServiceInstance } from '../services/security/PermissionManagerService';
import {
  databaseIntegrityServiceInstance,
  IntegrityCheckResult,
} from '../services/integrity/DatabaseIntegrityService';
import { PinSetupModal } from '../components/modals/PinSetupModal';
import { StorageBreakdown, PermissionInfo, DiagnosticLogEntry } from '../types';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { theme, setPreset, setMode, setAccentColor, updateColors, updateButton } = useTheme();
  const { networkState, setLock, grantTemporaryAccess } = useNetwork();
  const {
    setVolumeBoost,
    setSpatialMode,
    dspState,
    toggleDspModal,
    setMaxOutputLevel,
    setAutoHeadroom,
    setDspBypass,
    resetAudioProcessing,
    spatialState,
    setSpatialIntensity,
    setSpatialCrossfeed,
    toggleSpatialModal,
    resetSpatialSettings,
    visualizerSettings,
    updateVisualizerSettings,
    toggleFullscreenVisualizer,
    isDolbyHardwareSupported,
    exportAudioProfiles,
    importAudioProfiles,
    crossfadeDuration,
    setCrossfadeDuration,
    openStoragePermissionModal,
    openWidgetPreviewModal,
  } = usePlayer();

  const [activeSection, setActiveSection] = useState<
    | 'appearance'
    | 'library'
    | 'playback'
    | 'audio'
    | 'spatial'
    | 'visualization'
    | 'lyrics'
    | 'downloads'
    | 'network'
    | 'storage'
    | 'android'
    | 'privacy'
    | 'security'
    | 'permissions'
    | 'backup'
    | 'keyboard'
    | 'about'
  >('appearance');

  const [storageBreakdown, setStorageBreakdown] = useState<StorageBreakdown | null>(null);
  const [permissionsList, setPermissionsList] = useState<PermissionInfo[]>([]);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<'setup' | 'change' | 'disable'>('setup');
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);
  const [isReconcilingIntegrity, setIsReconcilingIntegrity] = useState(false);
  const [integrityResult, setIntegrityResult] = useState<IntegrityCheckResult | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEntry[]>([]);
  const [isClearingSafeCache, setIsClearingSafeCache] = useState(false);
  const [showLicensesModal, setShowLicensesModal] = useState(false);
  const { t, language, setLanguage } = useTranslation();
  const [diagnosticsModalOpen, setDiagnosticsModalOpen] = useState(false);

  const loadStorageBreakdown = async () => {
    try {
      const stats = await storageManagementServiceInstance.getStorageBreakdown(settings.maxCacheSizeBytes);
      setStorageBreakdown(stats);
    } catch {
      // ignore
    }
  };

  const loadPermissions = async () => {
    try {
      const perms = await permissionManagerServiceInstance.getPermissionsList();
      setPermissionsList(perms);
    } catch {
      // ignore
    }
  };

  const loadDiagnostics = () => {
    setDiagnosticLogs(diagnosticServiceInstance.getLogs());
  };

  useEffect(() => {
    appLockServiceInstance.isBiometricsAvailable().then(setIsBiometricsAvailable);
  }, []);

  useEffect(() => {
    if (activeSection === 'storage') {
      loadStorageBreakdown();
    } else if (activeSection === 'permissions') {
      loadPermissions();
    } else if (activeSection === 'privacy' || activeSection === 'about') {
      loadDiagnostics();
    }
  }, [activeSection, settings.maxCacheSizeBytes]);

  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [backupImportMode, setBackupImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [backupImportResult, setBackupImportResult] = useState<ImportBackupResult | null>(null);

  const [isLabOpen, setIsLabOpen] = useState(false);
  const [folders, setFolders] = useState<MusicFolderRecord[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStatistics | null>(null);

  const loadCacheStats = async () => {
    const stats = await CacheManager.getCacheStatistics(settings.maxCacheSizeBytes);
    setCacheStats(stats);
  };

  useEffect(() => {
    FolderRepository.getAll().then(setFolders);
    loadCacheStats();
  }, [settings.maxCacheSizeBytes]);

  const [isSyncingMediaStore, setIsSyncingMediaStore] = useState(false);
  const [mediaStoreSyncResult, setMediaStoreSyncResult] = useState<{
    added: number;
    updated: number;
    markedUnavailable: number;
    restored: number;
    durationMs: number;
  } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>('checking...');

  useEffect(() => {
    const checkPerm = async () => {
      const status = await androidBridgeInstance.checkStoragePermission();
      setPermissionStatus(status);
    };
    checkPerm();
  }, []);

  const handleSyncMediaStore = async () => {
    setIsSyncingMediaStore(true);
    try {
      const files = await androidBridgeInstance.selectAudioFiles();
      if (files.length === 0) {
        notificationService.info('No Files Selected', 'Select audio files to sync into the media library.');
        setIsSyncingMediaStore(false);
        return;
      }
      const res = await mediaStoreSyncServiceInstance.syncFiles(files, 'Device Media');
      setMediaStoreSyncResult(res);
      notificationService.success(
        'MediaStore Sync Complete',
        `Added: ${res.added}, Updated: ${res.updated}, Missing marked unavailable: ${res.markedUnavailable}`
      );
    } catch (err: any) {
      notificationService.error('Sync Failed', err.message || 'Failed to sync MediaStore');
    } finally {
      setIsSyncingMediaStore(false);
    }
  };

  const handlePickMusicFolderSAF = async () => {
    try {
      const res = await androidBridgeInstance.selectMusicFolder();
      if (!res || res.files.length === 0) {
        notificationService.info('No Folder Selected', 'Storage Access Framework selection cancelled.');
        return;
      }
      setIsSyncingMediaStore(true);
      const syncRes = await mediaStoreSyncServiceInstance.syncFiles(res.files, res.folderName);
      setMediaStoreSyncResult(syncRes);
      const currentUris = settings.safPersistedUris || [];
      if (!currentUris.includes(res.folderName)) {
        await updateSettings({ safPersistedUris: [...currentUris, res.folderName] });
      }
      notificationService.success(
        'SAF Folder Synced',
        `Folder "${res.folderName}" indexed: ${syncRes.added} added, ${syncRes.updated} updated.`
      );
    } catch (err: any) {
      notificationService.error('SAF Pick Failed', err.message || 'Folder pick failed');
    } finally {
      setIsSyncingMediaStore(false);
    }
  };

  const handleRemoveSafUri = async (uri: string) => {
    const updated = (settings.safPersistedUris || []).filter((u) => u !== uri);
    await updateSettings({ safPersistedUris: updated });
    notificationService.info('Folder Removed', `Removed SAF access grant for ${uri}`);
  };

  const handleRequestStoragePermission = async () => {
    const status = await androidBridgeInstance.requestStoragePermission();
    setPermissionStatus(status);
    await updateSettings({ androidStoragePermissionRequested: true });
    if (status === 'granted') {
      notificationService.success('Permission Granted', 'Audio storage access enabled.');
    } else if (status === 'permanently_denied') {
      notificationService.warning('Permission Blocked', 'Storage access permanently denied. Open system settings.');
    } else {
      notificationService.info('Permission Denied', 'Storage access denied.');
    }
  };

  const contrastResult = evaluateContrast(theme.colors.textPrimary, theme.colors.background);
  const buttonContrast = evaluateContrast(theme.button.textColor, theme.button.backgroundColor);

  const PRESETS: BuiltinPreset[] = [
    'Midnight',
    'Ocean',
    'Neon',
    'Purple',
    'Forest',
    'Sunset',
    'Minimal',
    'Cyber',
    'AMOLED',
    'Classic',
  ];

  const ACCENT_SWATCHES = [
    '#00f0ff',
    '#38bdf8',
    '#10b981',
    '#a855f7',
    '#f97316',
    '#facc15',
    '#ec4899',
    '#ffffff',
  ];

  const handleRebuildLibrary = async () => {
    if (window.confirm('Rebuild library index? This will refresh track records while preserving your files.')) {
      await db.tracks.clear();
      notificationService.success('Library Cleared', 'Tracks index cleared. Rescan your music folders.');
    }
  };

  const [downloadStats, setDownloadStats] = useState<{
    completedCount: number;
    totalBytes: number;
    failedCount: number;
  }>({ completedCount: 0, totalBytes: 0, failedCount: 0 });

  const loadDownloadStats = async () => {
    try {
      const usage = await DownloadRepository.getStorageUsage();
      const counts = await DownloadRepository.getCountsByStatus();
      setDownloadStats({
        completedCount: usage.completedCount,
        totalBytes: usage.totalBytes,
        failedCount: counts.failed + counts.cancelled,
      });
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadDownloadStats();
  }, [activeSection]);

  const handleClearCompletedDownloads = async () => {
    const cleared = await DownloadRepository.clearCompleted();
    await loadDownloadStats();
    notificationService.info('Download History Cleared', `Removed ${cleared} completed records from download history.`);
  };

  const handleClearFailedDownloads = async () => {
    const failed = await DownloadRepository.clearFailed();
    const cancelled = await DownloadRepository.clearCancelled();
    await loadDownloadStats();
    notificationService.info('Errors Cleared', `Removed ${failed + cancelled} failed/cancelled download tasks.`);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 select-none">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings & Preferences</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Configure library indexing, appearance, offline privacy air-gap, and acoustic pipeline.
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] pb-3">
        {[
          { id: 'appearance', label: 'Appearance', icon: Palette },
          { id: 'playback', label: 'Playback', icon: Sliders },
          { id: 'audio', label: 'Audio Engine', icon: Volume2 },
          { id: 'spatial', label: 'Spatial 3D', icon: Compass },
          { id: 'visualization', label: 'Visualizer', icon: Activity },
          { id: 'library', label: 'Library & Folders', icon: Folder },
          { id: 'lyrics', label: 'Lyrics', icon: FileText },
          { id: 'downloads', label: 'Downloads & Offline', icon: Download },
          { id: 'network', label: 'Network & Air-Gap', icon: Lock },
          { id: 'storage', label: 'Storage & Safe Cache', icon: HardDrive },
          { id: 'android', label: 'Android Integration', icon: Smartphone },
          { id: 'privacy', label: 'Privacy & Air-Gap', icon: Eye },
          { id: 'security', label: 'Security & App Lock', icon: Shield },
          { id: 'permissions', label: 'Permissions Center', icon: CheckSquare },
          { id: 'backup', label: 'Backup & Restore', icon: HardDrive },
          { id: 'keyboard', label: 'Keyboard Shortcuts', icon: Keyboard },
          { id: 'about', label: 'About & Diagnostics', icon: Info },
        ].map((sec) => {
          const Icon = sec.icon;
          const isActive = activeSection === sec.id;
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as typeof activeSection)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[var(--surface-secondary)] text-[var(--accent)] border border-[var(--border)]'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{sec.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION: APPEARANCE */}
      {activeSection === 'appearance' && (
        <div className="space-y-6 max-w-4xl">
          {/* Language Selection */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Language / భాష / भाषा
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {[
                { code: 'en', label: 'English' },
                { code: 'te', label: 'తెలుగు' },
                { code: 'hi', label: 'हिन्दी' },
              ].map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l.code as SupportedLanguage);
                    updateSettings({ language: l.code as SupportedLanguage });
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    language === l.code
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)] font-bold'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Mode */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Theme Mode
            </h3>
            <div className="grid grid-cols-3 gap-3 max-w-md">
              {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMode(mode)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    theme.mode === mode
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)] font-bold'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Theme Presets */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Theme Presets (10 Built-in)
              </h3>
              <span className="text-xs font-mono text-[var(--accent)]">Current: {theme.preset}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {PRESETS.map((p) => {
                const isSelected = theme.preset === p;
                const presetConf = THEME_PRESETS[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPreset(p)}
                    className={`p-3 rounded-xl border text-left transition-all space-y-2 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[var(--surface-secondary)] shadow-md ring-1 ring-[var(--accent)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)] hover:border-[var(--border)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/30"
                        style={{ backgroundColor: presetConf.colors.accent }}
                      />
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/30"
                        style={{ backgroundColor: presetConf.colors.background }}
                      />
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{p}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Accent Swatches */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Accent Color
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              {ACCENT_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  onClick={() => setAccentColor(hex)}
                  className="w-8 h-8 rounded-full border border-white/20 transition-transform hover:scale-110 flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: hex }}
                >
                  {theme.colors.accent.toLowerCase() === hex.toLowerCase() && (
                    <Check className="w-4 h-4 text-black drop-shadow" />
                  )}
                </button>
              ))}
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-[var(--text-secondary)]">Custom Hex:</span>
                <input
                  type="color"
                  value={theme.colors.accent}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                />
              </div>
            </div>
          </div>

          {/* Button Customization */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Button Customization Engine
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Fine-tune button colors, hover dynamics, glows, radius, scale, and opacity.
                </p>
              </div>
              <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)]">
                <Button variant="primary" size="sm">
                  Preview Button
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="text-[var(--text-muted)] block mb-1">Button Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.button.backgroundColor}
                    onChange={(e) => updateButton({ backgroundColor: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono">{theme.button.backgroundColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[var(--text-muted)] block mb-1">Hover Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.button.hoverColor}
                    onChange={(e) => updateButton({ hoverColor: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono">{theme.button.hoverColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[var(--text-muted)] block mb-1">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.button.textColor}
                    onChange={(e) => updateButton({ textColor: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono">{theme.button.textColor}</span>
                </div>
              </div>

              <div>
                <label className="text-[var(--text-muted)] block mb-1">Border Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={theme.button.borderColor}
                    onChange={(e) => updateButton({ borderColor: e.target.value })}
                    className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                  />
                  <span className="font-mono">{theme.button.borderColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: LIBRARY & FOLDERS (Section 3 & Section 49) */}
      {activeSection === 'library' && (
        <div className="space-y-6 max-w-4xl">
          {/* Music Folders Manager */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--accent)]" /> Monitored Folders
            </h3>

            {folders.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)]">No music folders registered yet.</p>
            ) : (
              <div className="space-y-2">
                {folders.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className="w-4 h-4 text-[var(--accent)]" />
                      <span className="font-mono text-xs text-[var(--text-primary)]">{f.path}</span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono">
                      {f.trackCount} tracks
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scanner Preferences */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Scanner Options
            </h3>
            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.scanSubfolders}
                  onChange={(e) => updateSettings({ scanSubfolders: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <span>Scan subfolders recursively (Recommended)</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoScanOnStartup}
                  onChange={(e) => updateSettings({ autoScanOnStartup: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <span>Automatically sync local folders on application startup</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.monitorFolders}
                  onChange={(e) => updateSettings({ monitorFolders: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <span>Filesystem background watcher for new audio files</span>
              </label>
            </div>
          </div>

          {/* Metadata Display Preferences */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Song Table Columns
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-primary)]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showFileFormat}
                  onChange={(e) => updateSettings({ showFileFormat: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <span>Show File Format (FLAC/MP3)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showBitrate}
                  onChange={(e) => updateSettings({ showBitrate: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <span>Show Bitrate (kbps)</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showSampleRate}
                  onChange={(e) => updateSettings({ showSampleRate: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <span>Show Sample Rate (Hz)</span>
              </label>
            </div>
          </div>

          {/* Search & Discovery Preferences (Part 11 Section 13) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Search & Discovery
            </h3>
            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.saveSearchHistory !== false}
                  onChange={(e) => updateSettings({ saveSearchHistory: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold">Save search history locally</span>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Keep track of recent search queries offline for instant reuse.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* File Filtering & Duration Rules (Part 20) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              File Filtering &amp; Duration Rules
            </h3>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-semibold block text-[var(--text-primary)] mb-1.5">
                  Ignore Short Audio Tracks (Ringtones &amp; Notifications)
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 0, label: 'Include All' },
                    { id: 5, label: '> 5 seconds' },
                    { id: 15, label: '> 15 seconds' },
                    { id: 30, label: '> 30 seconds' },
                    { id: 60, label: '> 1 minute' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => updateSettings({ ignoreShorterThanSeconds: id })}
                      className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        (settings.ignoreShorterThanSeconds || 0) === id
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[var(--text-muted)] block mt-1">
                  Audio tracks shorter than this threshold will be excluded from library listings and auto-queues.
                </span>
              </div>
            </div>
          </div>

          {/* Database Referential Integrity & Non-Destructive Reconciliation (Part 21) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Database Integrity &amp; Reconciliation
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Part 21 Verified
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Scans all IndexedDB tables to reconcile orphan playlist track references, validate audio metadata ranges, and clean broken references safely without affecting your playlists or ratings.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isReconcilingIntegrity ? 'animate-spin' : ''}`} />}
                disabled={isReconcilingIntegrity}
                onClick={async () => {
                  setIsReconcilingIntegrity(true);
                  try {
                    const res = await databaseIntegrityServiceInstance.reconcileDatabaseIntegrity();
                    setIntegrityResult(res);
                    notificationService.success(
                      'Database Integrity Verified',
                      `Checked ${res.totalTracksChecked} tracks in ${res.durationMs}ms. Removed ${res.orphanPlaylistTracksRemoved} orphan references.`
                    );
                  } catch (e: any) {
                    notificationService.error('Reconciliation Failed', e.message);
                  } finally {
                    setIsReconcilingIntegrity(false);
                  }
                }}
              >
                {isReconcilingIntegrity ? 'Reconciling Tables...' : 'Check & Repair Database Integrity'}
              </Button>
            </div>

            {integrityResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Referential Consistency Valid ({integrityResult.durationMs}ms)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>Tracks Checked: <span className="font-semibold text-white">{integrityResult.totalTracksChecked}</span></div>
                  <div>Repaired: <span className="font-semibold text-white">{integrityResult.repairedTracks}</span></div>
                  <div>Orphans Removed: <span className="font-semibold text-white">{integrityResult.orphanPlaylistTracksRemoved}</span></div>
                  <div>History Cleaned: <span className="font-semibold text-white">{integrityResult.invalidHistoryEntriesCleaned}</span></div>
                </div>
              </div>
            )}
          </div>


          {/* Database Recovery (Section 56) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Library Maintenance
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Reset the local index without touching your music files.
            </p>
            <Button variant="danger" size="sm" onClick={handleRebuildLibrary}>
              Rebuild Library Index
            </Button>
          </div>
        </div>
      )}

      {/* SECTION: LYRICS */}
      {activeSection === 'lyrics' && (
        <div className="space-y-6 max-w-4xl">
          {/* Display & Behavior */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <span>Lyrics Display &amp; Synchronization</span>
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Show Lyrics Automatically
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Automatically switch full player stage to lyrics view when a track starts
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showLyricsAutomatically}
                  onChange={(e) => updateSettings({ showLyricsAutomatically: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Synchronized Auto-Scroll
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Smoothly scroll lyrics container to keep active line centered
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lyricsAutoScroll}
                  onChange={(e) => updateSettings({ lyricsAutoScroll: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Show Lyrics Source Badge
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Display indicator showing whether lyrics came from embedded tags, sidecar file, or cache
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showLyricsSource}
                  onChange={(e) => updateSettings({ showLyricsSource: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Default Text Alignment
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Visual alignment for lyrics view
                  </div>
                </div>
                <select
                  value={settings.lyricsAlignment}
                  onChange={(e) => updateSettings({ lyricsAlignment: e.target.value as any })}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Default Font Size
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Baseline typography size for lyrics lines
                  </div>
                </div>
                <select
                  value={settings.lyricsFontSize}
                  onChange={(e) => updateSettings({ lyricsFontSize: e.target.value as any })}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="sm">Small (Compact)</option>
                  <option value="md">Medium (Default)</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                </select>
              </div>
            </div>
          </div>

          {/* Online Lyrics & Air-Gap Privacy */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-cyan-400" />
              <span>Online Lyrics &amp; Air-Gap Privacy</span>
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Enable Online Lyrics Searching
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Allow manual searching against the public LRCLIB service when local lyrics are unavailable
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.searchOnlineLyricsEnabled}
                  onChange={(e) => updateSettings({ searchOnlineLyricsEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Default Karaoke Mode
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Prioritize active singing line with high typography emphasis and reduced UI clutter
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lyricsKaraokeMode}
                  onChange={(e) => updateSettings({ lyricsKaraokeMode: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Default Lyrics Theme
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Background and styling mode for the lyrics presentation
                  </div>
                </div>
                <select
                  value={settings.lyricsTheme}
                  onChange={(e) => updateSettings({ lyricsTheme: e.target.value as any })}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="player">Player Theme (Current UI)</option>
                  <option value="dark">Dark Lyrics</option>
                  <option value="light">Light Lyrics</option>
                  <option value="album_art">Album Artwork Backdrop</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Line Spacing
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Vertical spacing between consecutive lyric lines
                  </div>
                </div>
                <select
                  value={settings.lyricsLineSpacing}
                  onChange={(e) => updateSettings({ lyricsLineSpacing: e.target.value as any })}
                  className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="large">Spacious (Large)</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Global Lyrics Offset
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Default timing shift (-10s to +10s) applied when a song has no custom offset
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={-10}
                    max={10}
                    step={0.1}
                    value={settings.lyricsGlobalOffset}
                    onChange={(e) => updateSettings({ lyricsGlobalOffset: parseFloat(e.target.value) })}
                    className="w-28 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                  />
                  <span className="font-mono text-xs text-[var(--accent)] font-bold w-12 text-right">
                    {settings.lyricsGlobalOffset > 0 ? `+${settings.lyricsGlobalOffset}` : settings.lyricsGlobalOffset}s
                  </span>
                  <button
                    onClick={() => updateSettings({ lyricsGlobalOffset: 0 })}
                    className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[var(--text-muted)]"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">
                    Save Retrieved Lyrics Offline
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Automatically persist user-fetched online lyrics into the local offline library
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.saveLyricsOffline}
                  onChange={(e) => updateSettings({ saveLyricsOffline: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: NETWORK & AIR-GAP */}
      {activeSection === 'network' && (
        <div className="space-y-6 max-w-4xl">
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Offline-First Air-Gap Protection</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Blocks all silent external network requests, telemetry, and background tracking.
                </p>
              </div>

              <button
                onClick={() => setLock(!networkState.isAirGapped)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  networkState.isAirGapped
                    ? 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/20'
                    : 'bg-emerald-500 text-black font-extrabold shadow-lg shadow-emerald-500/20'
                }`}
              >
                {networkState.isAirGapped ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{networkState.isAirGapped ? 'LOCKED' : 'UNLOCKED'}</span>
              </button>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  grantTemporaryAccess(10 * 60 * 1000);
                  notificationService.success('Temporary Access', 'Internet enabled for 10 minutes.');
                }}
              >
                Enable Temporary Access (10 min)
              </Button>
            </div>
          </div>

          {/* ONLINE PLAYBACK & YOUTUBE (Part 6) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-[var(--accent)]" />
                <span>On-Demand Online Playback Controls</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Configure YouTube stream resolution, audio codec preferences, and queue network gating.
              </p>
            </div>

            <div className="divide-y divide-[var(--border-subtle)] space-y-3 pt-1">
              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Enable YouTube Playback</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Permit on-demand audio resolution for explicit URLs.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.youtubePlaybackEnabled}
                  onChange={(e) => updateSettings({ youtubePlaybackEnabled: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Ask Before Online Playback</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Always confirm before opening a temporary network session.</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.askBeforeOnlinePlayback}
                  onChange={(e) => updateSettings({ askBeforeOnlinePlayback: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Allow Queued Online Playback</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Automatically play queued YouTube tracks (Default: OFF — prompts for permission).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.allowQueuedOnlinePlayback}
                  onChange={(e) => updateSettings({ allowQueuedOnlinePlayback: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Preferred Audio Format</div>
                  <div className="text-[11px] text-[var(--text-muted)]">Preferred audio-only stream codec.</div>
                </div>
                <select
                  value={settings.preferredAudioFormat}
                  onChange={(e) => updateSettings({ preferredAudioFormat: e.target.value as any })}
                  className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="auto">Auto (Best Quality)</option>
                  <option value="opus">Opus / WebM</option>
                  <option value="m4a">M4A / AAC</option>
                  <option value="aac">AAC</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">End Session on Stop</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Immediately lock network when online playback finishes or stops.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.endNetworkSessionOnStop}
                  onChange={(e) => updateSettings({ endNetworkSessionOnStop: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Privacy Disclosures */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1 text-[11px] text-[var(--text-secondary)]">
              <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                Zero-Telemetry Privacy Guarantee
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] text-[var(--text-muted)]">
                <li>No YouTube search history is collected remotely.</li>
                <li>No analytics or telemetry events are sent.</li>
                <li>Zero listening data is uploaded by this application.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: STORAGE & YOUTUBE CACHE (Part 7 & Part 20) */}
      {activeSection === 'storage' && (
        <div className="space-y-6 max-w-4xl">
          {/* Storage Breakdown Hero Card (Part 20) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[var(--accent)]" />
                  <span>Device Storage Breakdown</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Accurate measurement of local library files, downloads, offline caches, and database footprints.
                </p>
              </div>

              <button
                onClick={loadStorageBreakdown}
                className="p-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
                title="Refresh Storage Breakdown"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh Breakdown</span>
              </button>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Audio Library</div>
                <div className="text-sm font-bold text-[var(--text-primary)]">
                  {storageBreakdown ? (storageBreakdown.audioLibraryBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {storageBreakdown?.audioLibraryCount || 0} tracks
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Downloads</div>
                <div className="text-sm font-bold text-[var(--accent)]">
                  {storageBreakdown ? (storageBreakdown.downloadBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {storageBreakdown?.downloadCount || 0} files
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">YouTube Cache</div>
                <div className="text-sm font-bold text-amber-400">
                  {storageBreakdown ? (storageBreakdown.youtubeCacheBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {storageBreakdown?.youtubeCacheCount || 0} cached
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Artwork Cache</div>
                <div className="text-sm font-bold text-purple-400">
                  {storageBreakdown ? (storageBreakdown.artworkCacheBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {storageBreakdown?.artworkCacheCount || 0} images
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">IndexedDB Data</div>
                <div className="text-sm font-bold text-cyan-400">
                  {storageBreakdown ? (storageBreakdown.databaseSizeBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {storageBreakdown?.lyricsCount || 0} lyrics
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Total App Storage</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">
                  {storageBreakdown ? (storageBreakdown.totalUsageBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  {storageBreakdown?.deviceFreeSpaceBytes
                    ? `${(storageBreakdown.deviceFreeSpaceBytes / (1024 * 1024 * 1024)).toFixed(1)} GB Free`
                    : 'Local Device'}
                </div>
              </div>
            </div>
          </div>

          {/* Safe Clear Cache Card (Part 20) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Safe Cache Cleanup
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Zero Data Loss Guarantee
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Clears temporary regenerable caches (cached album art bitmaps, in-memory object URLs, and temporary buffers).
              <strong className="text-white block mt-1">
                SAFE GUARANTEE: This will NEVER delete your music files, downloads, playlists, favorites, ratings, or listening history.
              </strong>
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                icon={<Trash2 className={`w-3.5 h-3.5 ${isClearingSafeCache ? 'animate-spin' : ''}`} />}
                disabled={isClearingSafeCache}
                onClick={async () => {
                  setIsClearingSafeCache(true);
                  try {
                    const res = await storageManagementServiceInstance.clearSafeCache();
                    await loadStorageBreakdown();
                    notificationService.success(
                      'Cache Cleared Safely',
                      `Freed ${(res.freedBytes / (1024 * 1024)).toFixed(1)} MB (${res.itemsCleared} regenerable items cleared). All music files, playlists, and ratings preserved!`
                    );
                  } catch (e: any) {
                    notificationService.error('Cache Clear Failed', e.message);
                  } finally {
                    setIsClearingSafeCache(false);
                  }
                }}
              >
                {isClearingSafeCache ? 'Clearing Cache...' : 'Clear Regenerable Cache Now'}
              </Button>
            </div>
          </div>

          {/* Granular Resets (Part 20) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Granular Data Resets
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Selectively purge specific metadata categories without touching your music files or settings.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Search History</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Purge offline search query suggestions.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const count = await storageManagementServiceInstance.clearSearchHistory();
                    notificationService.info('Search History Cleared', `Removed ${count} search query records.`);
                  }}
                >
                  Clear Search History
                </Button>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Playback History</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Clear chronological listening log.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    const count = await storageManagementServiceInstance.clearPlayHistory();
                    notificationService.info('Playback History Cleared', `Removed ${count} listening log entries.`);
                  }}
                >
                  Clear Playback History
                </Button>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-col justify-between space-y-3">
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Play Counts &amp; Stats</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">Reset track play counts and timestamps.</div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (window.confirm('Reset all track play counts to 0? Your favorites, playlists, and ratings will be kept.')) {
                      await storageManagementServiceInstance.clearListeningStats();
                      notificationService.info('Stats Reset', 'Reset play counts and listening sessions to 0.');
                    }
                  }}
                >
                  Reset Play Counts
                </Button>
              </div>
            </div>
          </div>

          {/* Cache Stats Hero */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-[var(--accent)]" />
                  <span>YouTube Cache &amp; Storage Management</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Manage locally cached audio streams, inspect disk consumption, and configure automatic eviction.
                </p>
              </div>

              <button
                onClick={loadCacheStats}
                className="p-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
                title="Refresh Cache Stats"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Used Cache</div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  {cacheStats ? (cacheStats.totalCacheSizeBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Cached Tracks</div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  {cacheStats ? cacheStats.cachedTracksCount : 0}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Free Capacity</div>
                <div className="text-base font-bold text-emerald-400">
                  {cacheStats ? (cacheStats.freeCapacityBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Average Size</div>
                <div className="text-base font-bold text-[var(--text-primary)]">
                  {cacheStats ? (cacheStats.averageCacheSizeBytes / (1024 * 1024)).toFixed(1) : 0} MB
                </div>
              </div>
            </div>

            {/* Cache Options */}
            <div className="divide-y divide-[var(--border-subtle)] space-y-3 pt-2">
              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Cache YouTube Audio</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Enable local caching for offline replay without re-streaming.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.cacheYouTubeAudio}
                  onChange={(e) => updateSettings({ cacheYouTubeAudio: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Auto-Cache Played Tracks</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Automatically save streamed YouTube tracks to cache without prompting.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoCachePlayedTracks}
                  onChange={(e) => updateSettings({ autoCachePlayedTracks: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Maximum Cache Limit</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Maximum disk space reserved for offline YouTube audio files.
                  </div>
                </div>
                <select
                  value={settings.maxCacheSizeBytes}
                  onChange={(e) => updateSettings({ maxCacheSizeBytes: Number(e.target.value) })}
                  className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-2.5 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value={500 * 1024 * 1024}>500 MB</option>
                  <option value={1024 * 1024 * 1024}>1 GB</option>
                  <option value={2 * 1024 * 1024 * 1024}>2 GB (Recommended)</option>
                  <option value={5 * 1024 * 1024 * 1024}>5 GB</option>
                  <option value={10 * 1024 * 1024 * 1024}>10 GB</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-3">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-primary)]">Protect Favorites from Eviction</div>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Never automatically delete cached audio for favorited tracks during LRU cleanup.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.protectFavoritesFromEviction}
                  onChange={(e) => updateSettings({ protectFavoritesFromEviction: e.target.checked })}
                  className="rounded accent-[var(--accent)] w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            {/* Actions: Run Maintenance & Clear Cache */}
            <div className="pt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={async () => {
                  const res = await CacheManager.runCacheMaintenance(settings.maxCacheSizeBytes);
                  notificationService.success(
                    'Maintenance Complete',
                    `Checked ${res.checkedCount} tracks, fixed ${res.missingCount} missing, freed ${(
                      res.evictedBytes /
                      (1024 * 1024)
                    ).toFixed(1)} MB.`
                  );
                  loadCacheStats();
                }}
                className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Run Cache Maintenance</span>
              </button>

              <button
                onClick={async () => {
                  if (
                    window.confirm(
                      'Clear all cached YouTube audio files? Your listening history records will be preserved.'
                    )
                  ) {
                    const freed = await CacheManager.clearCache();
                    notificationService.info(
                      'Cache Cleared',
                      `Freed ${(freed / (1024 * 1024)).toFixed(1)} MB of cache space.`
                    );
                    loadCacheStats();
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All Cached Audio</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* SECTION: AUDIO & EQUALIZER DSP (Section 45) */}
      {activeSection === 'audio' && (
        <div className="space-y-6 max-w-4xl">
          {/* Studio Launcher Hero Card */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--surface-card)] to-[var(--surface-secondary)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Audio Control Center &amp; Equalizer DSP
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Active Profile: <b className="text-[var(--accent)]">{dspState.activeProfile}</b> &bull;{' '}
                {dspState.dspBypass ? 'DSP Bypassed' : 'Hardware Limiter Protected'}
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={<Sliders className="w-4 h-4" />}
              onClick={toggleDspModal}
            >
              Open Audio Control Center (E)
            </Button>
          </div>

          {/* Basic Audio Controls */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Basic Audio Controls
            </h3>

            {/* Volume Boost */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Safe Volume Amplification Boost
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Controlled digital gain stage protected by a brickwall limiter (-1.0 dB ceiling).
                  </span>
                </div>
                <span className="font-mono text-base font-bold text-[var(--accent)]">
                  {(dspState.volumeBoost * 100).toFixed(0)}%
                </span>
              </div>

              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.25"
                value={dspState.volumeBoost}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateSettings({ volumeBoost: val });
                  setVolumeBoost(val);
                }}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
              />
            </div>
          </div>

          {/* Safety Settings (Section 46) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Acoustic Safety &amp; Headroom</span>
            </h3>

            {/* Maximum Output Safety Ceiling */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Maximum Output Level Safety Ceiling
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Caps maximum output amplitude regardless of boost or amplification.
                  </span>
                </div>
                <span className="font-mono text-[var(--accent)] font-bold">
                  {Math.round((settings.maxOutputLevel ?? 1.0) * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.05"
                value={settings.maxOutputLevel ?? 1.0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateSettings({ maxOutputLevel: val });
                  setMaxOutputLevel(val);
                }}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
              />
            </div>

            {/* Auto Headroom Protection */}
            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3 text-xs">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoHeadroom ?? true}
                  onChange={(e) => {
                    updateSettings({ autoHeadroom: e.target.checked });
                    setAutoHeadroom(e.target.checked);
                  }}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Automatic EQ Headroom Compensation</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Automatically scales preamp down as EQ frequency bands are boosted to prevent inter-sample clipping.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!settings.highVolumeWarningDismissed}
                  onChange={(e) => {
                    updateSettings({ highVolumeWarningDismissed: !e.target.checked });
                  }}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">High Amplification Confirmation Dialog</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Prompts a confirmation warning when setting volume boost above 150%.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Platform Dolby & Audio Enhancement Architecture (Part 13) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Platform Dolby &amp; Enhancement Architecture
                </h3>
              </div>
              <span
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${
                  isDolbyHardwareSupported
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}
              >
                {isDolbyHardwareSupported ? 'HARDWARE SUPPORTED' : 'NOT AVAILABLE ON THIS DEVICE'}
              </span>
            </div>

            <p className="text-xs text-[var(--text-secondary)]">
              {isDolbyHardwareSupported
                ? 'Hardware Dolby Atmos / Audio Enhancement bridge is active. Audio stream metadata is passed through to native platform decoder.'
                : 'Hardware Dolby Atmos is not available on this platform. The audio engine operates in bit-perfect, uncolored reference mode with zero fake software emulation.'}
            </p>
          </div>

          {/* Audio Profiles Backup & Sync (Part 13) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <FileJson className="w-4 h-4 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Audio Profiles Backup &amp; Presets
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Export and import all custom EQ presets, per-song acoustic memories, and device tunings (audio_profiles.json).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Download className="w-3.5 h-3.5 text-[var(--accent)]" />}
                onClick={() => {
                  const bundle = exportAudioProfiles();
                  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute('href', dataStr);
                  downloadAnchor.setAttribute('download', 'audio_profiles.json');
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
              >
                Export Profiles
              </Button>

              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--text-primary)] transition-colors">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  Import Profiles
                </span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const text = await file.text();
                      const parsed = JSON.parse(text);
                      const res = await importAudioProfiles(parsed, 'merge');
                      notificationService.success('Audio Profiles', `Imported ${res.importedCount} audio profiles successfully.`);
                    } catch (err: any) {
                      notificationService.error('Import Failed', 'Failed to import audio profiles: ' + (err.message || 'Invalid format'));
                    } finally {
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: SPATIAL AUDIO & 3D (Section 44) */}
      {activeSection === 'spatial' && (
        <div className="space-y-6 max-w-4xl">
          {/* Spatial Studio Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--surface-card)] to-[var(--surface-secondary)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Spatial Audio &amp; 3D Studio
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Binaural headphone rendering, HRTF 3D positioning, virtual surround, and convolution acoustics.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={<Compass className="w-4 h-4" />}
              onClick={toggleSpatialModal}
            >
              Open Spatial Studio
            </Button>
          </div>

          {/* Spatial Mode & Intensity */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Spatial Audio Mode
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  Select algorithmic soundstage presentation.
                </span>
              </div>

              <button
                onClick={() => setSpatialMode(spatialState.enabled ? 'off' : 'headphone_spatial')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  spatialState.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    spatialState.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'off', label: 'Off' },
                { id: 'headphone_spatial', label: 'Headphones' },
                { id: 'stereo_wide', label: 'Stereo Wide' },
                { id: 'virtual_surround', label: 'Surround' },
                { id: '3d_audio', label: '3D Audio' },
                { id: 'cinema', label: 'Cinema' },
                { id: 'live', label: 'Live Stage' },
                { id: 'room', label: 'Concert Room' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSpatialMode(id as SpatialMode)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    spatialState.mode === id
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                      : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Intensity */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Spatial Intensity
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Controls the depth and ratio of spatial reflections applied to source audio.
                  </span>
                </div>
                <span className="font-mono text-cyan-400 font-bold text-sm">
                  {Math.round(spatialState.intensity * 100)}%
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={spatialState.intensity}
                onChange={(e) => setSpatialIntensity(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-cyan-400"
              />
            </div>

            {/* Crossfeed */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Headphone Crossfeed
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Simulates natural acoustic cross-ear bleed to eliminate extreme left/right fatigue.
                  </span>
                </div>
                <span className="font-mono text-cyan-400 font-bold text-xs uppercase">
                  {spatialState.crossfeed}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(['off', 'low', 'medium', 'high'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSpatialCrossfeed(mode)}
                    className={`py-1.5 rounded-lg text-xs font-medium border capitalize ${
                      spatialState.crossfeed === mode
                        ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Honest Technical Capabilities */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Platform Audio Capabilities</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Hardware detection &bull; Software DSP processing &bull; Compliant audio reporting
            </p>
            <div className="p-3.5 rounded-xl bg-black/25 border border-white/5 font-mono text-xs text-cyan-300 space-y-1">
              <div>Output Architecture: Software Spatial Processing (Stereo / Binaural)</div>
              <div>License Integrity: Standard Web Audio DSP (No unlicensed Dolby Atmos claims)</div>
              <div>Mono Compatibility Index: {spatialState.correlation >= 0 ? `+${spatialState.correlation.toFixed(2)}` : spatialState.correlation.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: VISUALIZATION (Section 43) */}
      {activeSection === 'visualization' && (
        <div className="space-y-6 max-w-4xl">
          {/* Fullscreen Banner */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--surface-card)] to-[var(--surface-secondary)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Fullscreen Audio Visualizer
                </h3>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Launch an immersive visual performance with real-time spectrum and waveform rendering.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              icon={<Activity className="w-4 h-4" />}
              onClick={toggleFullscreenVisualizer}
            >
              Launch Visualizer (V)
            </Button>
          </div>

          {/* Visualization Preferences */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Visualizer Rendering
                </h3>
                <span className="text-xs text-[var(--text-secondary)]">
                  Enable or disable real-time canvas visualization.
                </span>
              </div>

              <button
                onClick={() => updateVisualizerSettings({ enabled: !visualizerSettings.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  visualizerSettings.enabled ? 'bg-[var(--accent)]' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    visualizerSettings.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Mode Selector — All 16 Modes */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Visualizer Display Mode
                </span>
                <button
                  onClick={() => setIsLabOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--accent)] text-[var(--btn-text)] hover:opacity-90 transition-opacity shadow-sm"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Open Audio Visual Lab
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { id: 'spectrum', label: 'Spectrum' },
                  { id: 'smooth_spectrum', label: 'Smooth Curve' },
                  { id: 'bars', label: 'Dense Bars' },
                  { id: 'waveform', label: 'Waveform' },
                  { id: 'oscilloscope', label: 'Oscilloscope' },
                  { id: 'circle', label: 'Circular' },
                  { id: 'radial_spectrum', label: 'Radial Spectrum' },
                  { id: 'spectrogram', label: 'Spectrogram' },
                  { id: 'peak_meter', label: 'Peak Meter' },
                  { id: 'rms_meter', label: 'RMS Meter' },
                  { id: 'stereo_field', label: 'Stereo Field' },
                  { id: 'phase_meter', label: 'Phase Meter' },
                  { id: 'album_art', label: 'Album Aura' },
                  { id: 'particles', label: 'Particles' },
                  { id: 'minimal', label: 'Minimal' },
                  { id: 'off', label: 'Off' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => updateVisualizerSettings({ mode: id as any })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      visualizerSettings.mode === id
                        ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] pt-1">
                Open the <strong>Audio Visual Lab</strong> above for FFT size, window function, color palette, presets, and live diagnostics.
              </p>
            </div>

            {/* Performance FPS */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Target Framerate (Performance Control)
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Low framerates significantly save CPU on battery power or lower-end machines.
                  </span>
                </div>
                <span className="font-mono text-[var(--accent)] font-bold text-xs uppercase">
                  {visualizerSettings.fps === 'low'
                    ? '30 FPS'
                    : visualizerSettings.fps === 'medium'
                    ? '60 FPS'
                    : 'Native Vsync'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'low', label: 'Low (30 FPS)' },
                  { id: 'medium', label: 'Medium (60 FPS)' },
                  { id: 'high', label: 'High (Display Native)' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => updateVisualizerSettings({ fps: id as any })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      visualizerSettings.fps === id
                        ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                        : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sensitivity */}
            <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
              <div className="flex justify-between items-center text-xs">
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">
                    Visualizer Sensitivity
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)]">
                    Scales visual bar height without altering the underlying audio output.
                  </span>
                </div>
                <span className="font-mono text-[var(--accent)] font-bold text-sm">
                  {visualizerSettings.sensitivity}%
                </span>
              </div>

              <input
                type="range"
                min="10"
                max="100"
                value={visualizerSettings.sensitivity}
                onChange={(e) =>
                  updateVisualizerSettings({ sensitivity: parseInt(e.target.value, 10) })
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Audio Visual Lab Modal — triggered from Visualization section */}
      <VisualizerLabModal isOpen={isLabOpen} onClose={() => setIsLabOpen(false)} />



      {/* SECTION: PLAYBACK & RESUMPTION (Section 46) */}
      {activeSection === 'playback' && (
        <div className="space-y-6 max-w-4xl">
          {/* Startup & Resumption */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Startup &amp; Persistence
            </h3>
            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.restoreQueue}
                  onChange={(e) => updateSettings({ restoreQueue: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Restore Playback Queue</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Preserve your song queue and active track when restarting Nova Music.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.resumeLastPosition}
                  onChange={(e) => updateSettings({ resumeLastPosition: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Resume from Exact Position</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Restore playback at the exact second where you left off.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoplay}
                  onChange={(e) => updateSettings({ autoplay: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Autoplay on Application Launch</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Automatically resume playing audio when the app opens.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.gaplessPlayback}
                  onChange={(e) => updateSettings({ gaplessPlayback: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Near-Gapless Audio Preloading</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Preload the next track buffer ahead of time to minimize transitions.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.rememberTrackPositions}
                  onChange={(e) => updateSettings({ rememberTrackPositions: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Remember Position for Long Tracks &amp; Podcasts</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Preserve exact timestamps and playback offsets across sessions for long recordings.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.privateListeningMode}
                  onChange={(e) => updateSettings({ privateListeningMode: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Private Listening Mode</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Temporarily pause recording songs into your play history and discovery stats.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Navigation & Seek Thresholds */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Navigation Intervals &amp; Thresholds
            </h3>

            {/* Previous Track Threshold */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">
                  Previous Track Restart Threshold
                </span>
                <span className="font-mono text-[var(--accent)]">
                  {settings.previousTrackThreshold || 3} seconds
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Pressing "Previous" restarts the current song if played past this threshold, otherwise goes to the previous song.
              </p>
              <input
                type="range"
                min={1}
                max={15}
                step={1}
                value={settings.previousTrackThreshold || 3}
                onChange={(e) =>
                  updateSettings({ previousTrackThreshold: parseInt(e.target.value, 10) })
                }
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
              />
            </div>

            {/* Seek intervals */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Seek Forward Step</span>
                  <span className="font-mono text-[var(--accent)]">
                    {settings.seekForwardInterval || 5}s
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={settings.seekForwardInterval || 5}
                  onChange={(e) =>
                    updateSettings({ seekForwardInterval: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Seek Backward Step</span>
                  <span className="font-mono text-[var(--accent)]">
                    {settings.seekBackwardInterval || 5}s
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={30}
                  step={1}
                  value={settings.seekBackwardInterval || 5}
                  onChange={(e) =>
                    updateSettings({ seekBackwardInterval: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                />
              </div>
            </div>
          </div>

          {/* Stereo Balance & Acoustic Trimming (Part 20) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent)]" />
              <span>Stereo Balance &amp; Silence Skipping</span>
            </h3>

            {/* Balance slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">Stereo Output Balance</span>
                <span className="font-mono text-[var(--accent)] font-bold">
                  {settings.audioBalance === 0
                    ? 'Center (Balanced)'
                    : settings.audioBalance < 0
                    ? `L ${Math.round(Math.abs(settings.audioBalance) * 100)}%`
                    : `R ${Math.round(settings.audioBalance * 100)}%`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-[var(--text-muted)]">L</span>
                <input
                  type="range"
                  min={-1}
                  max={1}
                  step={0.05}
                  value={settings.audioBalance || 0}
                  onChange={(e) => updateSettings({ audioBalance: parseFloat(e.target.value) })}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                />
                <span className="text-[11px] font-bold text-[var(--text-muted)]">R</span>
                <button
                  onClick={() => updateSettings({ audioBalance: 0 })}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-[var(--text-muted)] font-mono"
                  disabled={settings.audioBalance === 0}
                >
                  Center
                </button>
              </div>
            </div>

            {/* Silence Skipping Threshold */}
            <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-primary)]">Silence Skipping Detection</span>
                <select
                  value={settings.skipSilence || 'off'}
                  onChange={(e) => updateSettings({ skipSilence: e.target.value as any })}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
                >
                  <option value="off">Off (Play All)</option>
                  <option value="low">Low Sensitivity (-50 dB)</option>
                  <option value="medium">Medium (-40 dB)</option>
                  <option value="high">High Sensitivity (-30 dB)</option>
                </select>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Automatically cuts lead-in and tailing silent frames between songs without clipping spoken intros.
              </p>
            </div>
          </div>


          {/* Part 15: Audio Focus & Interruption Handling */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Audio Focus &amp; Interruption Policy</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Controls behavior when phone calls, navigation prompts, alarms, or other apps play audio.
            </p>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  Audio Focus Interruption Mode
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'follow_system', label: 'Follow System' },
                    { id: 'duck', label: 'Duck Volume' },
                    { id: 'pause', label: 'Pause Playback' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => updateSettings({ audioFocusMode: id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        settings.audioFocusMode === id
                          ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {settings.audioFocusMode !== 'pause' && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-[var(--text-primary)]">
                      Ducking Volume Level
                    </span>
                    <span className="font-mono text-[var(--accent)]">
                      {settings.audioDuckVolumePercent || 25}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={50}
                    step={5}
                    value={settings.audioDuckVolumePercent || 25}
                    onChange={(e) =>
                      updateSettings({ audioDuckVolumePercent: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                  />
                </div>
              )}

              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-3 text-xs">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.resumeAfterInterruption}
                    onChange={(e) => updateSettings({ resumeAfterInterruption: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-semibold block">Resume After Temporary Interruption</span>
                    <span className="text-[var(--text-secondary)] text-[11px]">
                      Automatically resumes playback when a phone call or navigation prompt ends (unless manually paused).
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Part 15: Bluetooth & Headphone Disconnect Safety */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Headphones className="w-4 h-4 text-indigo-400" />
              <span>Headphones &amp; Bluetooth Safety</span>
            </h3>

            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.pauseOnHeadphoneDisconnect}
                  onChange={(e) => updateSettings({ pauseOnHeadphoneDisconnect: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Pause on Headphone / Bluetooth Disconnect</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Immediately pauses audio when headphones are unplugged or Bluetooth disconnects, preventing speaker blast.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoApplyDeviceProfiles}
                  onChange={(e) => updateSettings({ autoApplyDeviceProfiles: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Auto-Restore Bluetooth Device Profiles</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Automatically re-applies stored EQ and acoustic presets when known Bluetooth devices reconnect.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Part 15: Background Playback, Wake Lock & Media Notifications */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span>Background Playback, Lock Screen &amp; Notifications</span>
            </h3>

            <div className="space-y-3 text-xs text-[var(--text-primary)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.backgroundPlaybackEnabled}
                  onChange={(e) => updateSettings({ backgroundPlaybackEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Enable Background Playback</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Keep music playing seamlessly when switching apps, minimizing, or when screen is locked.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.wakeLockEnabled}
                  onChange={(e) => updateSettings({ wakeLockEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">Screen Wake Lock during Active Playback</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Prevents the display from dimming or going to sleep while music is actively playing.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.showMediaNotification}
                  onChange={(e) => updateSettings({ showMediaNotification: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block">System Media Notification</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Show persistent playback controls in OS notification shade and lock screen.
                  </span>
                </div>
              </label>

              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <span className="font-semibold block">Notification Action Layout</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'compact', label: 'Compact (Prev, Play, Next)' },
                    { id: 'extended', label: 'Extended (+Rewind, +Forward)' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => updateSettings({ notificationActionLayout: id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        settings.notificationActionLayout === id
                          ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <span className="font-semibold block">Lock Screen Privacy</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'full', label: 'Full Information' },
                    { id: 'limited', label: 'Limited (Title Only)' },
                    { id: 'hidden', label: 'Hidden (Generic)' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => updateSettings({ notificationPrivacy: id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        settings.notificationPrivacy === id
                          ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.resumeOnDeviceRestart}
                    onChange={(e) => updateSettings({ resumeOnDeviceRestart: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-semibold block">Resume Playback After Device Restart</span>
                    <span className="text-[var(--text-secondary)] text-[11px]">
                      Default: OFF. Only auto-resume playback after system reboot if explicitly enabled.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: KEYBOARD SHORTCUTS */}
      {activeSection === 'keyboard' && (
        <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4 max-w-4xl">
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
            Keyboard Shortcuts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { key: 'Space', desc: 'Play / Pause playback' },
              { key: 'N', desc: 'Next track in queue' },
              { key: 'P', desc: 'Previous track (or restart)' },
              { key: 'Arrow Left', desc: 'Seek back 5 seconds' },
              { key: 'Arrow Right', desc: 'Seek forward 5 seconds' },
              { key: 'Arrow Up', desc: 'Volume up (+5%)' },
              { key: 'Arrow Down', desc: 'Volume down (-5%)' },
              { key: 'M', desc: 'Mute / Unmute audio' },
              { key: 'S', desc: 'Toggle shuffle order' },
              { key: 'R', desc: 'Cycle repeat mode (off / all / one)' },
              { key: 'Q', desc: 'Toggle queue drawer' },
              { key: 'F', desc: 'Toggle full screen player' },
              { key: 'Ctrl + K / ⌘ + K', desc: 'Focus global search' },
            ].map((k) => (
              <div
                key={k.key}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]"
              >
                <span className="text-[var(--text-secondary)]">{k.desc}</span>
                <kbd className="px-2 py-1 rounded bg-[var(--surface-secondary)] font-mono text-[11px] font-bold text-[var(--text-primary)] border border-[var(--border)]">
                  {k.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: PRIVACY (PART 20) */}
      {activeSection === 'privacy' && (
        <div className="space-y-6 max-w-4xl text-xs text-[var(--text-secondary)]">
          {/* Zero-Telemetry Guarantee */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Zero-Telemetry &amp; Local Privacy Guarantee
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                100% Offline-First
              </span>
            </div>
            <p className="leading-relaxed">
              Your local music library, playlists, play counts, favorites, and search queries are indexed and stored entirely on this device. Nova Music contains zero third-party telemetry, no Google Analytics, no Firebase tracking, and zero advertising SDKs.
            </p>
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]">
              Audit Status: LOCAL AIR-GAP ACTIVE &bull; Zero external packets emitted.
            </div>
          </div>

          {/* Listening & Search History Privacy */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-5">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              History &amp; Discovery Logging
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">Save Listening History Locally</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Keep a chronological log of tracks played for smart playlist rules and rediscovery.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.saveListeningHistory !== false}
                  onChange={(e) => updateSettings({ saveListeningHistory: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">Save Search Queries Locally</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Store recent search terms offline for instant auto-complete suggestions.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.saveSearchHistory !== false}
                  onChange={(e) => updateSettings({ saveSearchHistory: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                  onClick={async () => {
                    const count = await storageManagementServiceInstance.clearPlayHistory();
                    notificationService.info('Listening History Cleared', `Removed ${count} historical entries.`);
                  }}
                >
                  Clear Listening History
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Trash2 className="w-3.5 h-3.5 text-amber-400" />}
                  onClick={async () => {
                    const count = await storageManagementServiceInstance.clearSearchHistory();
                    notificationService.info('Search History Cleared', `Removed ${count} search history records.`);
                  }}
                >
                  Clear Search History
                </Button>
              </div>
            </div>
          </div>

          {/* Diagnostic Logging Policy */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Diagnostic &amp; Error Logging Privacy
            </h3>
            <p className="leading-relaxed">
              Diagnostic logs are held strictly in temporary device memory. All local directory paths and sensitive parameters are stripped and masked before export. Logs are never sent to external servers.
            </p>

            <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
              <div>
                <div className="font-semibold text-[var(--text-primary)]">Enable In-Memory Diagnostic Logging</div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Records sanitized internal system and playback events for troubleshooting.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.diagnosticLoggingEnabled || false}
                onChange={(e) => {
                  diagnosticServiceInstance.setEnabled(e.target.checked);
                  updateSettings({ diagnosticLoggingEnabled: e.target.checked });
                }}
                className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="font-semibold text-[var(--text-primary)]">Log Verbosity Level</div>
                <div className="text-[11px] text-[var(--text-secondary)]">Minimum event priority captured.</div>
              </div>
              <select
                value={settings.logLevel || 'info'}
                onChange={(e) => updateSettings({ logLevel: e.target.value as any })}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)]"
              >
                <option value="debug">Debug (Verbose)</option>
                <option value="info">Info (Default)</option>
                <option value="warn">Warnings Only</option>
                <option value="error">Errors Only</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: SECURITY & APP LOCK (PART 20) */}
      {activeSection === 'security' && (
        <div className="space-y-6 max-w-4xl text-xs">
          {/* App Lock Hero Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Application Lock &amp; Privacy Shield
                  </h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Secure your music library with a cryptographic 4-digit PIN and device biometrics.
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border ${
                  settings.appLockEnabled && settings.appLockPinHash
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                }`}
              >
                {settings.appLockEnabled && settings.appLockPinHash ? 'LOCKED & ARMED' : 'DISABLED'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <Lock className="w-4 h-4 text-[var(--accent)]" />
                <span>Single Audio Pipeline Background Protection</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                When App Lock is engaged, audio playback continues uninterrupted in the background. Emergency playback controls on the lock screen let you pause or play without unlocking your private music library or favorites.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {settings.appLockEnabled && settings.appLockPinHash ? (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<KeyRound className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setPinModalMode('change');
                      setPinModalOpen(true);
                    }}
                  >
                    Change PIN
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Unlock className="w-3.5 h-3.5" />}
                    onClick={() => {
                      setPinModalMode('disable');
                      setPinModalOpen(true);
                    }}
                  >
                    Disable App Lock
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Lock className="w-3.5 h-3.5" />}
                    onClick={() => {
                      appLockServiceInstance.lock();
                      notificationService.info('App Locked', 'Screen locked manually.');
                    }}
                  >
                    Lock Now
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setPinModalMode('setup');
                    setPinModalOpen(true);
                  }}
                >
                  Set 4-Digit PIN
                </Button>
              )}
            </div>
          </div>

          {/* Biometrics & Auto-Relock Policy */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Authentication &amp; Auto-Lock Policy
            </h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-[var(--accent)]" />
                    <span>Biometric Unlock (Fingerprint / Face ID)</span>
                  </div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    {isBiometricsAvailable
                      ? 'Supported: Use device fingerprint scanner or facial recognition to unlock.'
                      : 'WebAuthn platform authenticator not detected or not supported on this device.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={!settings.appLockEnabled}
                  checked={settings.appLockBiometricsEnabled && settings.appLockEnabled}
                  onChange={(e) => updateSettings({ appLockBiometricsEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer disabled:opacity-40"
                />
              </div>

              <div className="flex items-center justify-between py-2 border-b border-[var(--border-subtle)]">
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">Auto-Relock Timeout</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Automatically lock the app after switching apps or turning off the screen.
                  </div>
                </div>
                <select
                  disabled={!settings.appLockEnabled}
                  value={settings.appLockTimeoutMinutes || 0}
                  onChange={(e) => updateSettings({ appLockTimeoutMinutes: parseInt(e.target.value, 10) })}
                  className="px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] disabled:opacity-40"
                >
                  <option value={0}>Immediately upon minimizing</option>
                  <option value={1}>After 1 minute</option>
                  <option value={5}>After 5 minutes</option>
                  <option value={15}>After 15 minutes</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">Secure Screen (FLAG_SECURE)</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Blocks screenshots and conceals app content in Android recent tasks switcher.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.appLockSecureScreen || false}
                  onChange={(e) => updateSettings({ appLockSecureScreen: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)] cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: PERMISSIONS CENTER (PART 20) */}
      {activeSection === 'permissions' && (
        <div className="space-y-6 max-w-4xl text-xs">
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[var(--accent)]" />
                  <span>Android Runtime Permissions &amp; Hardware Capabilities</span>
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Inspect and manage runtime hardware and platform access grants aligned with Google Play policies.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                onClick={loadPermissions}
              >
                Re-check
              </Button>
            </div>

            <div className="space-y-3 pt-2">
              {permissionsList.map((perm) => (
                <div
                  key={perm.id}
                  className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{perm.name}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          perm.status === 'granted'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : perm.status === 'denied'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : perm.status === 'permanently_denied'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        {perm.status.toUpperCase()}
                      </span>
                      {perm.isRequired && (
                        <span className="text-[10px] text-amber-400 font-semibold">(Required for Library)</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">{perm.description}</p>
                  </div>

                  <Button
                    variant={perm.status === 'granted' ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      const res = await permissionManagerServiceInstance.requestPermission(perm.id);
                      await loadPermissions();
                      if (res === 'granted') {
                        notificationService.success('Permission Granted', `${perm.name} enabled.`);
                      } else {
                        notificationService.info('Permission Status', `Result: ${res}`);
                      }
                    }}
                  >
                    {perm.status === 'granted' ? 'Re-verify' : 'Grant / Enable'}
                  </Button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">
                If permissions are permanently blocked, adjust them in Android System Settings.
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => androidBridgeInstance.openSystemSettings()}
              >
                Open Android System Settings
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: ABOUT & DIAGNOSTICS (PART 20 & 21) */}
      {activeSection === 'about' && (
        <div className="space-y-6 max-w-4xl text-xs">
          {/* App Overview Card */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-cyan-500 flex items-center justify-center text-black font-black text-xl shadow-lg">
                  N
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">Nova Music Player</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Production Release &bull; Version 21.0.0
                  </p>
                </div>
              </div>
              <span className="text-[11px] px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                Production Ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Target Architecture</div>
                <div className="font-bold text-[var(--text-primary)]">Android 14 (API 34) &amp; Web</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Audio Engine Pipeline</div>
                <div className="font-bold text-[var(--text-primary)]">Single Session WebAudio DSP</div>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                <div className="text-[11px] text-[var(--text-muted)]">Privacy Air-Gap</div>
                <div className="font-bold text-emerald-400">100% Offline-First</div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                icon={<Sparkles className="w-3.5 h-3.5" />}
                onClick={() => setDiagnosticsModalOpen(true)}
              >
                Audio Intelligence &amp; Diagnostics Lab
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FileText className="w-3.5 h-3.5" />}
                onClick={() => setShowLicensesModal(true)}
              >
                Open Source Licenses
              </Button>
            </div>
          </div>

          {/* Diagnostic Logging Center (Part 20) */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Diagnostic Logging &amp; Sanitized Export
                </h3>
              </div>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                {diagnosticLogs.length} events logged
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Export sanitized diagnostics for debugging. File system paths, tokens, and personal credentials are automatically redacted.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="primary"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                onClick={() => {
                  diagnosticServiceInstance.downloadSanitizedLogs();
                  notificationService.success('Diagnostics Exported', 'Downloaded sanitized diagnostics log file.');
                }}
              >
                Download Sanitized Log (.txt)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  diagnosticServiceInstance.clearLogs();
                  loadDiagnostics();
                  notificationService.info('Logs Cleared', 'In-memory diagnostic events cleared.');
                }}
              >
                Clear Diagnostic Logs
              </Button>
            </div>

            {/* Log Preview Drawer */}
            <div className="mt-3 p-3 rounded-xl bg-black/40 border border-[var(--border)] font-mono text-[10px] space-y-1 max-h-48 overflow-y-auto">
              {diagnosticLogs.slice(-10).map((log) => (
                <div key={log.id} className="text-[var(--text-secondary)]">
                  <span className="text-[var(--text-muted)]">
                    {new Date(log.timestamp).toTimeString().slice(0, 8)}
                  </span>{' '}
                  <span
                    className={
                      log.level === 'error'
                        ? 'text-rose-400 font-bold'
                        : log.level === 'warn'
                        ? 'text-amber-400 font-bold'
                        : 'text-cyan-400 font-bold'
                    }
                  >
                    [{log.level.toUpperCase()}]
                  </span>{' '}
                  <span className="text-purple-300">[{log.tag}]</span>{' '}
                  <span className="text-[var(--text-primary)]">{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}


      {/* SECTION: BACKUP & RESTORE (PART 12) */}
      {activeSection === 'backup' && (
        <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-6 max-w-4xl text-xs">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[var(--accent)]" /> Local Data Backup &amp; Restore
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Export and restore playlists, smart rules, 1–5 star ratings, favorites, and play statistics across installations.
            </p>
          </div>

          {/* Export Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Download className="w-4 h-4 text-[var(--accent)]" /> Export Metadata Backup
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              Downloads a complete standalone JSON bundle containing all custom playlists, smart definitions, track ratings, entity favorites, and play counts.
            </p>
            <button
              onClick={async () => {
                setIsExportingBackup(true);
                try {
                  const filename = await MusicDataBackupService.downloadBackupFile();
                  notificationService.success('Backup Exported', `Saved backup bundle to ${filename}`);
                } catch (err: any) {
                  notificationService.error('Export Error', err.message || 'Failed to export backup');
                } finally {
                  setIsExportingBackup(false);
                }
              }}
              disabled={isExportingBackup}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-md transition-all"
            >
              <FileJson className="w-4 h-4" />
              <span>{isExportingBackup ? 'Exporting...' : 'Export Backup File (.json)'}</span>
            </button>
          </div>

          {/* Restore Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
            <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-[var(--accent)]" /> Restore from JSON Backup
            </h4>
            <p className="text-xs text-[var(--text-secondary)]">
              Select a previously exported JSON backup file to restore metadata into your library.
            </p>

            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Restore Strategy:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="settingsBackupMode"
                  value="merge"
                  checked={backupImportMode === 'merge'}
                  onChange={() => setBackupImportMode('merge')}
                  className="accent-[var(--accent)]"
                />
                <span>Merge (Keep existing items)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="settingsBackupMode"
                  value="overwrite"
                  checked={backupImportMode === 'overwrite'}
                  onChange={() => setBackupImportMode('overwrite')}
                  className="accent-[var(--accent)]"
                />
                <span>Overwrite (Replace collections)</span>
              </label>
            </div>

            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] transition-colors shadow-sm">
              <Upload className="w-4 h-4 text-[var(--accent)]" />
              <span>{isImportingBackup ? 'Restoring...' : 'Choose JSON File to Restore'}</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={isImportingBackup}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (!file.name.endsWith('.json')) {
                    notificationService.error('Invalid File', 'Please select a .json backup file.');
                    return;
                  }
                  setIsImportingBackup(true);
                  setBackupImportResult(null);
                  try {
                    const text = await file.text();
                    const res = await MusicDataBackupService.importBackup(text, backupImportMode);
                    setBackupImportResult(res);
                    notificationService.success('Backup Restored', res.message);
                  } catch (err: any) {
                    notificationService.error('Restore Failed', err.message || 'Failed to restore');
                  } finally {
                    setIsImportingBackup(false);
                    e.target.value = '';
                  }
                }}
              />
            </label>

            {backupImportResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1 animate-fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Restore Completed Successfully</span>
                </div>
                <p className="text-[11px] text-emerald-400/90">{backupImportResult.message}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION: ANDROID & NATIVE SYSTEM INTEGRATION (PART 16) */}
      {activeSection === 'android' && (
        <div className="space-y-6 max-w-4xl">
          {/* MediaStore Synchronizer */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={`w-5 h-5 text-[var(--accent)] ${isSyncingMediaStore ? 'animate-spin' : ''}`} />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Android MediaStore & Device Audio Synchronizer
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Offline-First Media Sync
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Scans device audio and synchronizes newly discovered tracks into your offline media library. Safely preserves all existing playlists, favorites, play counts, and ratings.
            </p>

            <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Non-Destructive Reconciliation Guarantee</span>
              </div>
              <p className="text-[11px]">
                Nova Music Player never deletes your listening statistics, favorites, or playlist entries when scanning. If an SD card is removed or audio files are temporarily unavailable, tracks are flagged as unavailable rather than removed, and automatically restored upon reconnection.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncingMediaStore ? 'animate-spin' : ''}`} />}
                disabled={isSyncingMediaStore}
                onClick={handleSyncMediaStore}
              >
                {isSyncingMediaStore ? 'Scanning MediaStore...' : 'Sync Device Audio Files'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderPlus className="w-3.5 h-3.5" />}
                disabled={isSyncingMediaStore}
                onClick={handlePickMusicFolderSAF}
              >
                Index Folder via SAF
              </Button>
            </div>

            {mediaStoreSyncResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1.5 animate-fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>MediaStore Synchronization Completed ({mediaStoreSyncResult.durationMs}ms)</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div>Added: <span className="font-semibold text-white">{mediaStoreSyncResult.added}</span></div>
                  <div>Updated: <span className="font-semibold text-white">{mediaStoreSyncResult.updated}</span></div>
                  <div>Unavailable: <span className="font-semibold text-white">{mediaStoreSyncResult.markedUnavailable}</span></div>
                  <div>Restored: <span className="font-semibold text-white">{mediaStoreSyncResult.restored}</span></div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--border-subtle)] space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSyncMediaStoreOnLaunch}
                  onChange={(e) => updateSettings({ autoSyncMediaStoreOnLaunch: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Auto-Sync on Application Launch</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Check Android MediaStore in the background on startup to discover newly downloaded tracks.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.notifyLibraryChanges}
                  onChange={(e) => updateSettings({ notifyLibraryChanges: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Notify on Library Changes</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Display unobtrusive toast alerts when new media files are added or modified on the device.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Android Permissions & Scoped Storage */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Android Permissions & Scoped Storage
                </h3>
              </div>
              <span
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium border ${
                  permissionStatus === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : permissionStatus === 'permanently_denied'
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                Status: {permissionStatus.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Granular permission management aligned with Google Play policies and Android scoped storage.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-1">
                <div className="text-[var(--text-secondary)] text-[11px]">Target Android API</div>
                <div className="font-bold text-[var(--text-primary)]">
                  API {androidBridgeInstance.getAndroidApiLevel()} {androidBridgeInstance.getAndroidApiLevel() >= 33 ? '(Android 13+ Tiramisu)' : '(Android 12 or below)'}
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-1">
                <div className="text-[var(--text-secondary)] text-[11px]">Required Audio Permission</div>
                <div className="font-mono text-[11px] text-[var(--accent)]">
                  {androidBridgeInstance.getRequiredAudioPermissionName()}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Shield className="w-3.5 h-3.5" />}
                onClick={openStoragePermissionModal}
              >
                Manage Storage Permission
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                onClick={() => androidBridgeInstance.openSystemSettings()}
              >
                Open System App Settings
              </Button>
            </div>
          </div>

          {/* Storage Access Framework (SAF) Persisted Folders */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Storage Access Framework (SAF) Directory Access
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                Scoped Access
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Grant permanent directory access to dedicated folders (e.g., SD Card Music, FLAC Collections) without needing full device storage permissions.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-[var(--text-primary)] block">Persisted SAF Folders</span>
              {(!settings.safPersistedUris || settings.safPersistedUris.length === 0) ? (
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/30 border border-dashed border-[var(--border)] text-center text-xs text-[var(--text-secondary)]">
                  No persisted SAF folders yet. Use the button below to grant access to an external music directory.
                </div>
              ) : (
                <div className="space-y-2">
                  {settings.safPersistedUris.map((uri) => (
                    <div
                      key={uri}
                      className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] text-xs"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <Folder className="w-4 h-4 text-[var(--accent)] shrink-0" />
                        <span className="font-medium text-[var(--text-primary)] truncate">{uri}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                        onClick={() => handleRemoveSafUri(uri)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderPlus className="w-3.5 h-3.5" />}
                onClick={handlePickMusicFolderSAF}
              >
                Grant Music Folder Access (SAF)
              </Button>
            </div>
          </div>

          {/* External Audio Files & Intent Handler */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                External Audio Files & Android Intents
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Configure how the player reacts when audio files are opened from external file managers, downloads, or Android ACTION_VIEW / ACTION_SEND intents.
            </p>

            <div className="space-y-2">
              <span className="text-xs font-semibold block text-[var(--text-primary)]">When an external audio file is opened:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'play_immediately', label: 'Play Immediately', desc: 'Interrupt current song and play opened audio' },
                  { id: 'add_to_queue', label: 'Add to Queue', desc: 'Enqueue at the end without interrupting active song' },
                  { id: 'ask', label: 'Always Prompt', desc: 'Ask whether to play immediately or add to queue' },
                ].map(({ id, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => updateSettings({ externalFileAction: id as any })}
                    className={`p-3 rounded-xl text-left border transition-all space-y-1 ${
                      settings.externalFileAction === id
                        ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                        : 'bg-[var(--surface-secondary)]/40 text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <div className="font-semibold text-xs text-[var(--text-primary)]">{label}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] leading-tight">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Home Screen Widgets & Quick Settings */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Home Screen Widgets & Quick Settings Tile
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                AppWidget Provider
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Interact with the single active playback engine directly from your Android launcher or notification shade.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableHomeScreenWidgets}
                  onChange={(e) => updateSettings({ enableHomeScreenWidgets: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Enable Home Screen Widgets</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Broadcast playback updates to Small (2x1), Medium (4x2), and Large (4x4) widgets.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enableQuickSettingsTile}
                  onChange={(e) => updateSettings({ enableQuickSettingsTile: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Enable Quick Settings Tile</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Toggle playback directly from the Android System Quick Settings pull-down drawer.
                  </span>
                </div>
              </label>

              <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
                <span className="text-xs font-semibold block text-[var(--text-primary)]">Widget Artwork Quality</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'low', label: 'Low (Battery Saver)' },
                    { id: 'medium', label: 'Medium (Balanced)' },
                    { id: 'high', label: 'High (Crisp Art)' },
                  ].map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => updateSettings({ widgetArtworkQuality: id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        settings.widgetArtworkQuality === id
                          ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                          : 'bg-[var(--surface-secondary)]/40 text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Layers className="w-3.5 h-3.5" />}
                  onClick={openWidgetPreviewModal}
                >
                  Open Widget Simulator & Previews
                </Button>
              </div>
            </div>
          </div>

          {/* Android Auto & Large-Screen Automotive Mode */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Android Auto & Automotive Large-Screen Layout
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium">
                Car App Quality Compliant
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Certified driver-safety compliant media browsing and adaptive responsive layout for tablet dashboards and in-vehicle head units.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.adaptiveTabletLayoutEnabled}
                  onChange={(e) => updateSettings({ adaptiveTabletLayoutEnabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Adaptive Large-Screen & Automotive Layout</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Optimizes touch targets and displays multi-pane navigation on Android tablets, foldables, and car head units.
                  </span>
                </div>
              </label>

              <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2">
                <div className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                  <span>Integrated Android Auto MediaBrowserService</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] pl-1 text-[var(--text-secondary)]">
                  <li>Offline hierarchical root categories: Recently Played, Favorites, Playlists, and All Songs.</li>
                  <li>Strictly driver-safety compliant: Zero blocking popups or unpausable content.</li>
                  <li>Single Audio Pipeline: Shares the master audio engine and volume headroom safety ceiling.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: DOWNLOAD MANAGER & OFFLINE (PART 17) */}
      {activeSection === 'downloads' && (
        <div className="space-y-6 max-w-4xl">
          {/* Network & Cellular Restrictions */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Network & Cellular Data Rules
                </h3>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                Offline-First Data Protection
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Strict rules to prevent accidental mobile data usage when downloading audio. Downloads are never triggered automatically without your explicit action.
            </p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.downloadAllowWifi}
                  onChange={(e) => updateSettings({ downloadAllowWifi: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Allow Downloads over Wi-Fi</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Permits downloading when connected to unmetered Wi-Fi networks.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.downloadAllowCellular}
                  onChange={(e) => updateSettings({ downloadAllowCellular: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Allow Downloads over Mobile / Cellular Data</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Permits downloads when on 4G/5G/LTE cellular connections.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.downloadAskCellular}
                  onChange={(e) => updateSettings({ downloadAskCellular: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Prompt Confirmation Before Cellular Download</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Displays a confirmation prompt with file size before starting any download on cellular data.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.downloadAutoPauseOffline}
                  onChange={(e) => updateSettings({ downloadAutoPauseOffline: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Auto-Pause when Network Disconnects</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Instantly freezes active downloads if Wi-Fi or Internet connectivity drops, preserving partial progress via byte-range offsets.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.downloadAutoResumeOnline}
                  onChange={(e) => updateSettings({ downloadAutoResumeOnline: e.target.checked })}
                  className="w-4 h-4 rounded accent-[var(--accent)]"
                />
                <div>
                  <span className="font-semibold block text-xs">Auto-Resume when Network Reconnects</span>
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    Automatically resumes paused downloads when a valid network connection is re-established.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Download Concurrency & Notifications */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Queue Engine & Concurrency
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Control download queue scheduling, simultaneous bandwidth allocation, and Android notification controls.
            </p>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-[var(--text-primary)]">Maximum Concurrent Active Downloads</span>
                  <span className="font-mono text-[var(--accent)] font-bold">{settings.maxConcurrentDownloads || 2}</span>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      onClick={() => updateSettings({ maxConcurrentDownloads: val })}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all ${
                        (settings.maxConcurrentDownloads || 2) === val
                          ? 'bg-[var(--accent)] text-black border-[var(--accent)] shadow-md'
                          : 'bg-[var(--surface-secondary)]/50 text-[var(--text-secondary)] border-[var(--border)] hover:text-white'
                      }`}
                    >
                      {val} {val === 1 ? 'task' : 'tasks'}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-1">
                  Remaining downloads wait in the priority-ordered queue until a slot frees up.
                </span>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)]">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.downloadShowNotifications}
                    onChange={(e) => updateSettings({ downloadShowNotifications: e.target.checked })}
                    className="w-4 h-4 rounded accent-[var(--accent)]"
                  />
                  <div>
                    <span className="font-semibold block text-xs">Display Notification Shade Progress</span>
                    <span className="text-[var(--text-secondary)] text-[11px]">
                      Show download progress notifications in Android system tray with pause/cancel controls.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Storage, File Naming & Duplicate Policy */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Storage & Duplicate File Policy
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Specify download destination folder and how name collisions with existing library files are resolved.
            </p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold block text-[var(--text-primary)] mb-1">
                  Default Download Folder
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={settings.defaultDownloadLocation || '/Music/Downloads'}
                    onChange={(e) => updateSettings({ defaultDownloadLocation: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
                    placeholder="/Music/Downloads"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => updateSettings({ defaultDownloadLocation: '/Music/Downloads' })}
                  >
                    Reset
                  </Button>
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] block mt-1">
                  Downloaded audio tracks are saved here and automatically added to your offline music library.
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-xs font-semibold block text-[var(--text-primary)]">
                  When a file with the same name already exists:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      id: 'rename',
                      label: 'Auto-Rename',
                      desc: 'Save as Artist - Title (1).ext without replacing existing file',
                    },
                    {
                      id: 'skip',
                      label: 'Skip Download',
                      desc: 'Do not re-download if matching file is already stored',
                    },
                    {
                      id: 'overwrite',
                      label: 'Overwrite Existing',
                      desc: 'Replace previously downloaded file with newly fetched data',
                    },
                  ].map(({ id, label, desc }) => (
                    <button
                      key={id}
                      onClick={() => updateSettings({ downloadDuplicateAction: id as any })}
                      className={`p-3 rounded-xl text-left border transition-all space-y-1 ${
                        settings.downloadDuplicateAction === id
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                          : 'bg-[var(--surface-secondary)]/30 border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[var(--text-primary)]">{label}</span>
                        {settings.downloadDuplicateAction === id && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Download History & Data Cleanup */}
          <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Download Storage & Maintenance
                </h3>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              View storage consumption and clean completed or failed records from the queue history.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-1">
                <div className="text-[var(--text-secondary)] text-[11px]">Downloaded Media Files</div>
                <div className="font-bold text-[var(--text-primary)] text-sm">
                  {downloadStats.completedCount} songs
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-1">
                <div className="text-[var(--text-secondary)] text-[11px]">Download Storage Used</div>
                <div className="font-bold text-[var(--accent)] text-sm font-mono">
                  {(downloadStats.totalBytes / (1024 * 1024)).toFixed(1)} MB
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-1">
                <div className="text-[var(--text-secondary)] text-[11px]">Failed / Cancelled Tasks</div>
                <div className="font-bold text-rose-400 text-sm">
                  {downloadStats.failedCount} tasks
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5 text-amber-400" />}
                onClick={handleClearCompletedDownloads}
                disabled={downloadStats.completedCount === 0}
              >
                Clear Completed Records
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                onClick={handleClearFailedDownloads}
                disabled={downloadStats.failedCount === 0}
              >
                Clear Failed / Cancelled Records
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={() => {
                  downloadStorageService.clearAllBlobData();
                  notificationService.info('Temporary Blobs Cleared', 'In-memory object URLs have been released.');
                }}
              >
                Purge In-Memory Blobs
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset to Defaults */}
      <div className="pt-4 border-t border-[var(--border)] flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={async () => {
            await resetSettings();
            setPreset('Midnight');
            notificationService.info('Settings Reset', 'Restored default settings.');
          }}
        >
          Reset All Settings to Default
        </Button>
      </div>

      {/* PIN Setup / Change Modal (Part 20) */}
      <PinSetupModal
        isOpen={pinModalOpen}
        mode={pinModalMode}
        onClose={() => setPinModalOpen(false)}
      />

      {/* Audio Intelligence & Library Diagnostics Modal (Parts 23 & 24) */}
      <LibraryDiagnosticsModal
        isOpen={diagnosticsModalOpen}
        onClose={() => setDiagnosticsModalOpen(false)}
      />

      {/* Open Source Licenses Modal (Part 20) */}
      {showLicensesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl p-6 space-y-4 text-[var(--text-primary)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Open Source Licenses</h3>
              <button
                onClick={() => setShowLicensesModal(false)}
                className="p-1 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-3 text-xs text-[var(--text-secondary)] pr-1">
              <div>
                <div className="font-bold text-[var(--text-primary)]">React &amp; React-DOM</div>
                <div className="text-[11px] text-[var(--text-muted)]">MIT License &copy; Meta Platforms, Inc.</div>
              </div>
              <div>
                <div className="font-bold text-[var(--text-primary)]">Dexie.js (IndexedDB Engine)</div>
                <div className="text-[11px] text-[var(--text-muted)]">Apache License 2.0 &copy; David Fahlander</div>
              </div>
              <div>
                <div className="font-bold text-[var(--text-primary)]">Lucide Icons</div>
                <div className="text-[11px] text-[var(--text-muted)]">ISC License &copy; Lucide Contributors</div>
              </div>
              <div>
                <div className="font-bold text-[var(--text-primary)]">Tailwind CSS</div>
                <div className="text-[11px] text-[var(--text-muted)]">MIT License &copy; Tailwind Labs Inc.</div>
              </div>
              <div>
                <div className="font-bold text-[var(--text-primary)]">Web Audio API &amp; DSP Engine</div>
                <div className="text-[11px] text-[var(--text-muted)]">W3C Recommendation compliant offline acoustics</div>
              </div>
            </div>
            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <Button variant="secondary" size="sm" onClick={() => setShowLicensesModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


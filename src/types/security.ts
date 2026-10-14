export interface AppLockConfig {
  enabled: boolean;
  pinHash: string;
  pinSalt: string;
  biometricsEnabled: boolean;
  timeoutMinutes: number; // 0 = immediately, 1, 5, 15
  gracePeriodSeconds: number;
  secureScreen: boolean;
}

export interface StorageBreakdown {
  audioLibraryBytes: number;
  audioLibraryCount: number;
  downloadBytes: number;
  downloadCount: number;
  youtubeCacheBytes: number;
  youtubeCacheCount: number;
  artworkCacheBytes: number;
  artworkCacheCount: number;
  databaseSizeBytes: number;
  lyricsCount: number;
  totalUsageBytes: number;
  deviceFreeSpaceBytes?: number;
  deviceTotalSpaceBytes?: number;
}

export interface DiagnosticLogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  tag: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface PermissionInfo {
  id: 'storage' | 'notifications' | 'bluetooth' | 'wakelock' | 'biometrics';
  name: string;
  description: string;
  status: 'granted' | 'denied' | 'permanently_denied' | 'prompt' | 'unsupported';
  isRequired: boolean;
  category: 'Storage' | 'System' | 'Hardware' | 'Security';
}


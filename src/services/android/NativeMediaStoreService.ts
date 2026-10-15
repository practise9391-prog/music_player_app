import { registerPlugin, Capacitor } from '@capacitor/core';
import { Track, MusicFolderRecord } from '../../types';
import { db } from '../../database/db';
import { TrackRepository } from '../../database/repository';
import { notificationService } from '../errorService';

export interface NativeMediaStoreTrack {
  id: string;
  path: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  fileSize: number;
  modifiedAt: number;
  displayName: string;
  contentUri: string;
  albumArtUri?: string;
}

export interface MediaStoreScannerPluginInterface {
  checkAudioPermission(): Promise<{
    granted: boolean;
    apiLevel: number;
    permissionRequired: string;
  }>;
  requestAudioPermission(): Promise<{ granted: boolean }>;
  scanAudioFiles(): Promise<{ tracks: NativeMediaStoreTrack[]; count: number }>;
  openSettings?(): Promise<{ opened: boolean }>;
}

export const MediaStoreScanner = registerPlugin<MediaStoreScannerPluginInterface>('MediaStoreScanner');

export class NativeMediaStoreService {
  private static instance: NativeMediaStoreService | null = null;
  private isScanning = false;
  private hasInitialized = false;

  private constructor() {}

  public static getInstance(): NativeMediaStoreService {
    if (!this.instance) {
      this.instance = new NativeMediaStoreService();
    }
    return this.instance;
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  public getIsScanning(): boolean {
    return this.isScanning;
  }

  public async checkPermission(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const res = await MediaStoreScanner.checkAudioPermission();
      return !!res?.granted;
    } catch (err) {
      console.warn('Error checking native audio permission:', err);
      return false;
    }
  }

  public async requestPermission(): Promise<boolean> {
    if (!this.isNative()) return true;
    try {
      const res = await MediaStoreScanner.requestAudioPermission();
      return !!res?.granted;
    } catch (err) {
      console.warn('Error requesting native audio permission:', err);
      return false;
    }
  }

  public async openSettings(): Promise<void> {
    if (this.isNative() && MediaStoreScanner.openSettings) {
      try {
        await MediaStoreScanner.openSettings();
      } catch (err) {
        console.warn('Error opening settings:', err);
      }
    }
  }

  /**
   * Queries Android MediaStore and non-destructively reconciles the library.
   * Discovers all audio on both Internal Storage & SD Card in seconds.
   */
  public async scanAndImport(onProgress?: (count: number) => void): Promise<{
    total: number;
    added: number;
    updated: number;
  }> {
    if (this.isScanning) {
      return { total: 0, added: 0, updated: 0 };
    }

    this.isScanning = true;

    try {
      if (!this.isNative()) {
        console.log('Native MediaStore is only available on Android native devices.');
        return { total: 0, added: 0, updated: 0 };
      }

      // 1. Check or request runtime permission
      let granted = await this.checkPermission();
      if (!granted) {
        granted = await this.requestPermission();
      }

      if (!granted) {
        notificationService.warning(
          'Permission Required',
          'Storage permission is required to automatically load your songs.'
        );
        return { total: 0, added: 0, updated: 0 };
      }

      // 2. Fast MediaStore Query (< 1s for 1200+ songs)
      const scanResult = await MediaStoreScanner.scanAudioFiles();
      const rawTracks = scanResult?.tracks || [];

      if (rawTracks.length === 0) {
        notificationService.info('Scanner', 'No audio files detected by MediaStore.');
        return { total: 0, added: 0, updated: 0 };
      }

      if (onProgress) {
        onProgress(rawTracks.length);
      }

      // 3. Load existing tracks to preserve user-created states (favorites, ratings, play count)
      const existingTracks = await db.tracks.toArray();
      const existingMap = new Map<string, Track>();
      for (const t of existingTracks) {
        existingMap.set(t.path, t);
        existingMap.set(t.id, t);
      }

      const folderMap = new Map<string, { path: string; count: number }>();
      const tracksToSave: Track[] = [];
      let added = 0;
      let updated = 0;

      for (const raw of rawTracks) {
        const filePath = raw.path;
        const ext = (raw.displayName || filePath).split('.').pop()?.toLowerCase() || 'mp3';

        // Extract folder information
        const pathSegments = filePath.split('/').filter(Boolean);
        pathSegments.pop(); // remove file name
        const folderPath = '/' + pathSegments.join('/') || '/Music';
        const folderName = pathSegments[pathSegments.length - 1] || 'Music';

        const fEntry = folderMap.get(folderPath) || { path: folderPath, count: 0 };
        fEntry.count++;
        folderMap.set(folderPath, fEntry);

        // Convert file path to playable webview URL
        const playbackUrl = Capacitor.convertFileSrc(filePath);
        const stableId = `ms_${raw.id}`;
        const existing = existingMap.get(filePath) || existingMap.get(stableId);
        const trackId = existing ? existing.id : stableId;

        const track: Track = {
          id: trackId,
          folderPath: folderName,
          path: filePath,
          filename: raw.displayName || `${raw.title}.${ext}`,
          title: raw.title || raw.displayName || 'Unknown Title',
          artist: raw.artist && raw.artist !== '<unknown>' ? raw.artist : 'Unknown Artist',
          album: raw.album && raw.album !== '<unknown>' ? raw.album : 'Unknown Album',
          duration: raw.duration > 0 ? raw.duration : 180,
          format: ext,
          codec: ext,
          fileSize: raw.fileSize || 0,
          modifiedAt: raw.modifiedAt || Date.now(),
          dateAdded: existing?.dateAdded || Date.now(),
          lastPlayedAt: existing?.lastPlayedAt,
          playCount: existing?.playCount || 0,
          isFavorite: existing?.isFavorite || false,
          rating: existing?.rating,
          source: 'local',
          isAvailable: true,
          lyrics: existing?.lyrics,
          playbackUrl,
          coverArtUrl: raw.albumArtUri ? Capacitor.convertFileSrc(raw.albumArtUri) : existing?.coverArtUrl,
        };

        tracksToSave.push(track);
        if (existing) {
          updated++;
        } else {
          added++;
        }
      }

      // 4. Batch save tracks to database in chunks of 100 for maximum performance
      const CHUNK_SIZE = 100;
      for (let i = 0; i < tracksToSave.length; i += CHUNK_SIZE) {
        const chunk = tracksToSave.slice(i, i + CHUNK_SIZE);
        await TrackRepository.saveBatch(chunk);
      }

      // 5. Update folders table for the Folders tab
      for (const [fPath, data] of folderMap.entries()) {
        const folderRecord: MusicFolderRecord = {
          id: fPath,
          path: fPath,
          enabled: true,
          dateAdded: Date.now(),
          lastScanned: Date.now(),
          trackCount: data.count,
        };
        await db.folders.put(folderRecord);
      }

      notificationService.success(
        'Library Synced',
        `Discovered ${tracksToSave.length} songs from internal storage & SD card.`
      );

      return {
        total: tracksToSave.length,
        added,
        updated,
      };
    } catch (err: any) {
      console.error('Error during MediaStore scan:', err);
      notificationService.error('Scan Error', err?.message || 'Failed to scan MediaStore.');
      return { total: 0, added: 0, updated: 0 };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Automatically scans MediaStore upon app launch if on native Android.
   */
  public async autoSyncOnStartup(): Promise<void> {
    if (this.hasInitialized) return;
    this.hasInitialized = true;

    if (!this.isNative()) return;

    try {
      const granted = await this.checkPermission();
      if (granted) {
        await this.scanAndImport();
      } else {
        // Request permission on first startup
        const userGranted = await this.requestPermission();
        if (userGranted) {
          await this.scanAndImport();
        }
      }
    } catch (err) {
      console.warn('Auto sync on startup error:', err);
    }
  }
}

export const nativeMediaStoreService = NativeMediaStoreService.getInstance();

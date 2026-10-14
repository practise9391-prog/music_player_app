import { Track, OutputDeviceType } from '../../types';

export type AndroidPermissionStatus = 'granted' | 'denied' | 'permanently_denied' | 'restricted';

export interface AndroidNativeInterface {
  requestMediaAudioPermission?: () => Promise<string>;
  checkMediaAudioPermission?: () => Promise<string>;
  openApplicationSettings?: () => void;
  openSystemMediaOutputSelector?: () => void;
  updateQuickSettingsTile?: (isPlaying: boolean, title: string, subtitle: string) => void;
  updateHomeScreenWidget?: (size: string, payloadJson: string) => void;
  shareMediaFile?: (uriOrPath: string, title: string, mimeType: string) => void;
  getAndroidApiLevel?: () => number;
}

declare global {
  interface Window {
    AndroidBridge?: AndroidNativeInterface;
    AndroidInterface?: AndroidNativeInterface;
  }
}

export class AndroidBridge {
  private static instance: AndroidBridge | null = null;
  private intentListeners: Set<(files: File[], action: 'play' | 'queue') => void> = new Set();
  private mockPermissionState: AndroidPermissionStatus = 'denied';

  private constructor() {
    this.setupWindowIntentHandlers();
  }

  public static getInstance(): AndroidBridge {
    if (!this.instance) {
      this.instance = new AndroidBridge();
    }
    return this.instance;
  }

  /**
   * Detects whether running inside an Android environment (native container or Android browser).
   */
  public isAndroid(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (window.AndroidBridge || window.AndroidInterface) return true;
    return /android/i.test(navigator.userAgent);
  }

  /**
   * Retrieves the Android API level (e.g. 33 for Android 13 Tiramisu, 34 for Android 14).
   * Used to distinguish between READ_MEDIA_AUDIO (API 33+) and READ_EXTERNAL_STORAGE (API < 33).
   */
  public getAndroidApiLevel(): number {
    if (typeof window !== 'undefined') {
      const native = window.AndroidBridge || window.AndroidInterface;
      if (native?.getAndroidApiLevel) {
        try {
          return native.getAndroidApiLevel();
        } catch {
          // ignore
        }
      }
      const match = navigator.userAgent.match(/Android\s([0-9\.]+)/);
      if (match && match[1]) {
        const major = parseInt(match[1], 10);
        if (major >= 14) return 34;
        if (major === 13) return 33;
        if (major === 12) return 31;
        if (major === 11) return 30;
        if (major <= 10) return 29;
      }
    }
    return 33; // Default to modern Android API 33+
  }

  /**
   * Returns the required permission string for current Android version.
   */
  public getRequiredAudioPermissionName(): string {
    const apiLevel = this.getAndroidApiLevel();
    if (apiLevel >= 33) {
      return 'android.permission.READ_MEDIA_AUDIO';
    }
    return 'android.permission.READ_EXTERNAL_STORAGE';
  }

  /**
   * Checks current media storage permission status.
   */
  public async checkStoragePermission(): Promise<AndroidPermissionStatus> {
    const native = typeof window !== 'undefined' ? window.AndroidBridge || window.AndroidInterface : null;
    if (native?.checkMediaAudioPermission) {
      try {
        const res = await native.checkMediaAudioPermission();
        return (res as AndroidPermissionStatus) || 'denied';
      } catch {
        return 'denied';
      }
    }

    // In web/desktop environment, check stored preference or mock state
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('nova_android_storage_permission');
      if (stored) {
        return stored as AndroidPermissionStatus;
      }
    }

    return this.mockPermissionState;
  }

  /**
   * Requests media audio storage permission from the operating system.
   */
  public async requestStoragePermission(): Promise<AndroidPermissionStatus> {
    const native = typeof window !== 'undefined' ? window.AndroidBridge || window.AndroidInterface : null;
    if (native?.requestMediaAudioPermission) {
      try {
        const res = await native.requestMediaAudioPermission();
        const status = (res as AndroidPermissionStatus) || 'granted';
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('nova_android_storage_permission', status);
        }
        return status;
      } catch {
        return 'denied';
      }
    }

    // Standard Web / File System permission simulation
    this.mockPermissionState = 'granted';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nova_android_storage_permission', 'granted');
    }
    return 'granted';
  }

  /**
   * Opens Android Application Details Settings screen so user can re-enable permission if permanently denied.
   */
  public openSystemSettings(): void {
    const native = typeof window !== 'undefined' ? window.AndroidBridge || window.AndroidInterface : null;
    if (native?.openApplicationSettings) {
      try {
        native.openApplicationSettings();
        return;
      } catch {
        // ignore
      }
    }
    console.info('[AndroidBridge] Requesting OS: android.settings.APPLICATION_DETAILS_SETTINGS');
  }

  /**
   * Storage Access Framework (SAF): Allows selecting individual audio files via system file picker.
   */
  public async selectAudioFiles(): Promise<File[]> {
    if (typeof window === 'undefined') return [];

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'audio/*,.mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,.webm';

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          resolve(Array.from(input.files));
        } else {
          resolve([]);
        }
      };

      input.oncancel = () => resolve([]);
      input.click();
    });
  }

  /**
   * Storage Access Framework (SAF): Allows selecting an entire music directory with persisted access.
   */
  public async selectMusicFolder(): Promise<{ folderName: string; files: File[] } | null> {
    if (typeof window === 'undefined') return null;

    // Use webkitdirectory on HTML5 input element
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.multiple = true;

      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          const files = Array.from(input.files);
          const firstRel = files[0].webkitRelativePath || files[0].name;
          const folderName = firstRel.split('/')[0] || 'Music Folder';
          resolve({ folderName, files });
        } else {
          resolve(null);
        }
      };

      input.oncancel = () => resolve(null);
      input.click();
    });
  }

  /**
   * Android Share Sheet: Share song info, content URI or user-provided online link.
   */
  public async shareTrack(track: Track): Promise<boolean> {
    const shareData: ShareData = {
      title: track.title,
      text: `Listening to "${track.title}" by ${track.artist} on Nova Music Player`,
    };

    if (track.source === 'online' && track.path.startsWith('http')) {
      shareData.url = track.path;
    }

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        return true;
      } catch (err: unknown) {
        const error = err as Error;
        if (error.name !== 'AbortError') {
          console.warn('Native share failed:', error);
        }
        return false;
      }
    }

    // Fallback: Copy to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${shareData.title} - ${shareData.text}`);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Generates standard M3U/M3U8 string from track list.
   */
  public generateM3UPlaylist(tracks: Track[], playlistName = 'Playlist'): string {
    let m3uContent = '#EXTM3U\n';
    tracks.forEach((t) => {
      m3uContent += `#EXTINF:${Math.round(t.duration)},${t.artist} - ${t.title}\n`;
      m3uContent += `${t.path}\n`;
    });
    return m3uContent;
  }

  /**
   * Android Share Sheet: Share playlist as a standard M3U / M3U8 structure.
   * Does NOT duplicate or upload actual audio files.
   */
  public async sharePlaylist(playlistName: string, tracks: Track[]): Promise<boolean> {
    const m3uContent = this.generateM3UPlaylist(tracks, playlistName);

    const filename = `${playlistName.replace(/[^a-zA-Z0-9_\-]/g, '_')}.m3u8`;
    const blob = new Blob([m3uContent], { type: 'application/x-mpegurl;charset=utf-8' });

    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: 'application/x-mpegurl' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `Playlist: ${playlistName}`,
            text: `Playlist containing ${tracks.length} tracks`,
            files: [file],
          });
          return true;
        }
      } catch {
        // fallback to download
      }
    }

    // Fallback: Download .m3u8 file
    if (typeof document !== 'undefined') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }

    return false;
  }

  /**
   * Updates the Android Quick Settings Tile state.
   */
  public updateQuickSettingsTile(isPlaying: boolean, title = '', subtitle = ''): void {
    const native = typeof window !== 'undefined' ? window.AndroidBridge || window.AndroidInterface : null;
    if (native?.updateQuickSettingsTile) {
      try {
        native.updateQuickSettingsTile(isPlaying, title, subtitle);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Sets up external file open / drag-and-drop intent listeners.
   */
  private setupWindowIntentHandlers(): void {
    if (typeof window === 'undefined') return;

    // Handle drag and drop of audio files directly onto the window
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files).filter((f) =>
          f.type.startsWith('audio/') || /\.(mp3|flac|wav|m4a|aac|ogg|opus|webm)$/i.test(f.name)
        );
        if (files.length > 0) {
          this.notifyIntentListeners(files, 'play');
        }
      }
    });
  }

  public registerIntentListener(
    listener: (files: File[], action: 'play' | 'queue') => void
  ): () => void {
    this.intentListeners.add(listener);
    return () => this.intentListeners.delete(listener);
  }

  public notifyIntentListeners(files: File[], action: 'play' | 'queue' = 'play'): void {
    this.intentListeners.forEach((fn) => {
      try {
        fn(files, action);
      } catch (err) {
        console.error('Intent listener error:', err);
      }
    });
  }

  public dispatchExternalAudio(files: File[], action: 'play' | 'queue' = 'play'): void {
    this.notifyIntentListeners(files, action);
  }
}

export const androidBridgeInstance = AndroidBridge.getInstance();


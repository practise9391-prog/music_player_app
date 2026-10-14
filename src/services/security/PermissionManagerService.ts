import { PermissionInfo } from '../../types';
import { androidBridgeInstance } from '../android/AndroidBridge';
import { appLockServiceInstance } from './AppLockService';

export class PermissionManagerService {
  private static instance: PermissionManagerService | null = null;

  public static getInstance(): PermissionManagerService {
    if (!this.instance) {
      this.instance = new PermissionManagerService();
    }
    return this.instance;
  }

  /**
   * Evaluates runtime permission states across all required device capabilities.
   */
  public async getPermissionsList(): Promise<PermissionInfo[]> {
    const list: PermissionInfo[] = [];

    // 1. Storage Permission
    let storageStatus: PermissionInfo['status'] = 'prompt';
    try {
      const androidStatus = await androidBridgeInstance.checkStoragePermission();
      storageStatus =
        androidStatus === 'granted'
          ? 'granted'
          : androidStatus === 'permanently_denied'
          ? 'permanently_denied'
          : 'denied';
    } catch {
      storageStatus = 'prompt';
    }
    list.push({
      id: 'storage',
      name: 'Audio Storage Access',
      description:
        androidBridgeInstance.getAndroidApiLevel() >= 33
          ? 'Required to read audio files from device storage (READ_MEDIA_AUDIO).'
          : 'Required to read audio files from device storage (READ_EXTERNAL_STORAGE).',
      status: storageStatus,
      isRequired: true,
      category: 'Storage',
    });

    // 2. Notifications Permission
    let notifStatus: PermissionInfo['status'] = 'prompt';
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') notifStatus = 'granted';
      else if (Notification.permission === 'denied') notifStatus = 'denied';
      else notifStatus = 'prompt';
    } else {
      notifStatus = 'unsupported';
    }
    list.push({
      id: 'notifications',
      name: 'Media Notifications & Lock Screen Controls',
      description: 'Allows displaying now-playing playback controls in the Android notification drawer and lock screen.',
      status: notifStatus,
      isRequired: false,
      category: 'System',
    });

    // 3. Bluetooth & Audio Routing
    let btStatus: PermissionInfo['status'] = 'prompt';
    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      btStatus = 'granted';
    } else {
      btStatus = 'prompt'; // Supported via Web Audio / Android AudioManager
    }
    list.push({
      id: 'bluetooth',
      name: 'Bluetooth & Output Routing',
      description: 'Enables automatic headphone disconnect pause protection and custom Bluetooth EQ device presets.',
      status: btStatus,
      isRequired: false,
      category: 'Hardware',
    });

    // 4. Background Playback & Wake Lock
    let wakeLockStatus: PermissionInfo['status'] = 'unsupported';
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      wakeLockStatus = 'granted';
    }
    list.push({
      id: 'wakelock',
      name: 'Screen Wake Lock & Keep-Alive',
      description: 'Prevents display from sleeping during active lyrics/visualizer presentation without audio interruption.',
      status: wakeLockStatus,
      isRequired: false,
      category: 'System',
    });

    // 5. Biometrics & Platform Authenticator
    let bioStatus: PermissionInfo['status'] = 'prompt';
    const isBioAvailable = await appLockServiceInstance.isBiometricsAvailable();
    bioStatus = isBioAvailable ? 'granted' : 'unsupported';
    list.push({
      id: 'biometrics',
      name: 'Biometric Screen Unlock',
      description: 'Provides fingerprint and facial authentication to unlock the music application when App Lock is active.',
      status: bioStatus,
      isRequired: false,
      category: 'Security',
    });

    return list;
  }

  /**
   * Prompts the user or system for the requested permission.
   */
  public async requestPermission(id: PermissionInfo['id']): Promise<string> {
    switch (id) {
      case 'storage': {
        const res = await androidBridgeInstance.requestStoragePermission();
        return res;
      }
      case 'notifications': {
        if (typeof Notification !== 'undefined' && Notification.requestPermission) {
          const res = await Notification.requestPermission();
          return res;
        }
        return 'unsupported';
      }
      case 'bluetooth': {
        // Bluetooth routing is active through audio context and device profile detection
        return 'granted';
      }
      case 'wakelock': {
        if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
          try {
            await navigator.wakeLock.request('screen');
            return 'granted';
          } catch {
            return 'denied';
          }
        }
        return 'unsupported';
      }
      case 'biometrics': {
        const success = await appLockServiceInstance.authenticateBiometrics();
        return success ? 'granted' : 'denied';
      }
      default:
        return 'unsupported';
    }
  }
}

export const permissionManagerServiceInstance = PermissionManagerService.getInstance();


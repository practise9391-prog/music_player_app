import { AudioOutputDevice, OutputDeviceType } from '../../types';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { AudioProfileService } from './AudioProfileService';

export interface AudioRouteCallbacks {
  onPause: () => void;
  onDeviceChange?: (devices: AudioOutputDevice[]) => void;
  onRouteSwitched?: (device: AudioOutputDevice) => void;
}

export interface AudioRouteOptions {
  pauseOnHeadphoneDisconnect: boolean;
  autoApplyDeviceProfiles: boolean;
}

export class AudioRouteManager {
  private static instance: AudioRouteManager | null = null;
  private callbacks: AudioRouteCallbacks | null = null;
  private options: AudioRouteOptions = {
    pauseOnHeadphoneDisconnect: true,
    autoApplyDeviceProfiles: true,
  };

  private knownDevices: Map<string, AudioOutputDevice> = new Map();
  private activeDeviceId = 'default';
  private wasHeadphoneOrBluetoothConnected = false;
  private isListening = false;

  private constructor() {}

  public static getInstance(): AudioRouteManager {
    if (!this.instance) {
      this.instance = new AudioRouteManager();
    }
    return this.instance;
  }

  public init(callbacks: AudioRouteCallbacks, options?: Partial<AudioRouteOptions>): void {
    this.callbacks = callbacks;
    if (options) {
      this.setOptions(options);
    }

    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      if (!this.isListening) {
        this.isListening = true;
        navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
      }
      this.refreshDevices().catch(() => {});
    }
  }

  public setOptions(options: Partial<AudioRouteOptions>): void {
    this.options = { ...this.options, ...options };
  }

  private handleDeviceChange = async (): Promise<void> => {
    await this.refreshDevices();
  };

  public async refreshDevices(): Promise<AudioOutputDevice[]> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return [];
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = allDevices.filter((d) => d.kind === 'audiooutput');

      const currentIds = new Set(audioOutputs.map((d) => d.deviceId || 'default'));
      let wasDisconnect = false;

      // Check if previously connected headphone/bluetooth device disappeared
      for (const [id, dev] of this.knownDevices.entries()) {
        if (!currentIds.has(id)) {
          const type = this.classifyDeviceType(dev.label);
          if (type === 'headphones' || type === 'bluetooth') {
            wasDisconnect = true;
          }
        }
      }

      // If headphone or bluetooth disconnected and user configured pauseOnHeadphoneDisconnect:
      if (wasDisconnect && this.options.pauseOnHeadphoneDisconnect) {
        this.callbacks?.onPause();
      }

      // Update known devices map
      this.knownDevices.clear();
      let hasHeadphoneOrBluetooth = false;

      const deviceList: AudioOutputDevice[] = audioOutputs.map((d, idx) => {
        const id = d.deviceId || `output-${idx}`;
        const label = d.label || (idx === 0 ? 'Default Audio Output' : `Audio Device ${idx + 1}`);
        const device: AudioOutputDevice = { deviceId: id, label, groupId: d.groupId };
        this.knownDevices.set(id, device);

        const type = this.classifyDeviceType(label);
        if (type === 'headphones' || type === 'bluetooth') {
          hasHeadphoneOrBluetooth = true;
          // If autoApplyDeviceProfiles is enabled, check for stored profile for this device
          if (this.options.autoApplyDeviceProfiles) {
            this.autoApplyProfileForDevice(id, type);
          }
        }

        return device;
      });

      this.wasHeadphoneOrBluetoothConnected = hasHeadphoneOrBluetooth;
      this.callbacks?.onDeviceChange?.(deviceList);
      return deviceList;
    } catch {
      return [];
    }
  }

  /**
   * Classify device type from label string.
   */
  public classifyDeviceType(label: string): OutputDeviceType {
    const lower = label.toLowerCase();
    if (
      lower.includes('bluetooth') ||
      lower.includes('bt') ||
      lower.includes('airpods') ||
      lower.includes('wireless') ||
      lower.includes('buds') ||
      lower.includes('wh-') ||
      lower.includes('wf-')
    ) {
      return 'bluetooth';
    }
    if (
      lower.includes('headphone') ||
      lower.includes('headset') ||
      lower.includes('earphone') ||
      lower.includes('jack')
    ) {
      return 'headphones';
    }
    if (lower.includes('usb') || lower.includes('dac')) {
      return 'usb';
    }
    if (lower.includes('speaker') || lower.includes('internal') || lower.includes('built-in')) {
      return 'speaker';
    }
    return 'speaker';
  }

  /**
   * Applies stored audio profile for device if found in AudioProfileService.
   */
  private autoApplyProfileForDevice(deviceId: string, deviceType: OutputDeviceType): void {
    try {
      const profileService = AudioProfileService.getInstance();
      const resolution = profileService.resolveProfile(null, deviceId, deviceType);
      if (resolution.source === 'device') {
        const p = resolution.config;
        audioEngineInstance.setVolumeBoost(p.volumeBoost || 1.0);
        audioEngineInstance.setFadeDurations(p.fadeInDuration || 0, p.fadeOutDuration || 0);
        audioEngineInstance.setCrossfadeDuration(p.crossfadeDuration || 0);
        audioEngineInstance.setReplayGainMode(p.replayGainMode || 'off');
      }
    } catch {
      // ignore
    }
  }

  /**
   * Switch the active audio route.
   */
  public async switchOutputDevice(deviceId: string): Promise<boolean> {
    this.activeDeviceId = deviceId;
    const ok = await audioEngineInstance.setAudioOutputDevice(deviceId);
    if (ok) {
      const dev = this.knownDevices.get(deviceId) || {
        deviceId,
        label: 'Active Output Device',
      };
      this.callbacks?.onRouteSwitched?.(dev);
    }
    return ok;
  }

  public getActiveDeviceId(): string {
    return this.activeDeviceId;
  }

  public dispose(): void {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
      this.isListening = false;
    }
    this.callbacks = null;
    this.knownDevices.clear();
  }
}

export const audioRouteManagerInstance = AudioRouteManager.getInstance();

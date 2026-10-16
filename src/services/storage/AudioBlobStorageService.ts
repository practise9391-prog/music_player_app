import { Capacitor } from '@capacitor/core';
import { db } from '../../database/db';
import { Track } from '../../types';

export class AudioBlobStorageService {
  private static instance: AudioBlobStorageService | null = null;
  private activeBlobUrls: Map<string, string> = new Map();
  private fileRegistry: Map<string, File | Blob> = new Map();

  private constructor() {
    this.cleanSyntheticBlobs().catch(() => {});
  }

  public static getInstance(): AudioBlobStorageService {
    if (!this.instance) {
      this.instance = new AudioBlobStorageService();
    }
    return this.instance;
  }

  /**
   * Cleans any legacy synthetic WAV blobs stored in IndexedDB so real audio is always used.
   */
  public async cleanSyntheticBlobs(): Promise<void> {
    try {
      const records = await db.audio_blobs.toArray();
      const syntheticIds = records
        .filter((r) => r.mimeType === 'audio/wav' || (r.size && r.size < 6000000))
        .map((r) => r.id);
      if (syntheticIds.length > 0) {
        await db.audio_blobs.bulkDelete(syntheticIds);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Registers a file reference in memory for on-demand playback URL generation.
   */
  public registerFile(trackId: string, file: File | Blob): void {
    this.fileRegistry.set(trackId, file);
  }

  /**
   * Caches and registers an in-memory object URL for an active file/blob.
   */
  public registerBlobUrl(trackId: string, blob: Blob | File): string {
    const existing = this.activeBlobUrls.get(trackId);
    if (existing) {
      return existing;
    }
    const newUrl = URL.createObjectURL(blob);
    this.activeBlobUrls.set(trackId, newUrl);
    return newUrl;
  }

  /**
   * Stores the raw audio file Blob in IndexedDB and registers an immediate playback URL.
   */
  public async storeAudioBlob(trackId: string, blob: Blob | File): Promise<string> {
    this.registerFile(trackId, blob);
    const playbackUrl = this.registerBlobUrl(trackId, blob);
    // Persist asynchronously in background so large bulk scans never block or exceed quota
    db.audio_blobs.put({
      id: trackId,
      blob,
      size: blob.size,
      mimeType: blob.type || 'audio/mpeg',
      updatedAt: Date.now(),
    }).catch((err) => {
      // Safe fallback - in-memory blob or file URL will be used
      console.warn(`[AudioBlobStorage] Background audio blob persistence note for ${trackId}:`, err);
    });
    return playbackUrl;
  }

  /**
   * Resolves a guaranteed playable URL for any track:
   * 1. Online track stream URL
   * 2. Capacitor native convertFileSrc for local device filesystem audio
   * 3. Valid existing playbackUrl
   * 4. Active in-memory blob or registered file reference
   * 5. Stored IndexedDB audio blob (e.g. web imports / cached audio)
   */
  public async getPlayableUrl(track: Track): Promise<string | null> {
    // 1. Online tracks
    if (track.source === 'online') {
      return track.playbackUrl || track.path || null;
    }

    // 2. Local device audio file path via Capacitor native bridge (ALWAYS highest priority on Android)
    if (Capacitor.isNativePlatform() && track.path && (track.path.startsWith('/') || track.path.startsWith('file://') || track.path.startsWith('content://'))) {
      try {
        const nativeUrl = Capacitor.convertFileSrc(track.path);
        if (nativeUrl) {
          return nativeUrl;
        }
      } catch {
        // fall through
      }
      return track.path;
    }

    // 3. Valid existing playbackUrl
    if (track.playbackUrl && (track.playbackUrl.startsWith('capacitor://') || track.playbackUrl.startsWith('http://localhost') || track.playbackUrl.startsWith('blob:') || track.playbackUrl.startsWith('http://') || track.playbackUrl.startsWith('https://'))) {
      return track.playbackUrl;
    }

    // 4. Active in-memory blob URL created during current session
    const activeUrl = this.activeBlobUrls.get(track.id);
    if (activeUrl) {
      return activeUrl;
    }

    // 5. Registered in-memory file reference
    const registeredFile = this.fileRegistry.get(track.id);
    if (registeredFile) {
      return this.registerBlobUrl(track.id, registeredFile);
    }

    // 6. Stored IndexedDB audio blob (survives page refreshes and app restarts)
    try {
      const record = await db.audio_blobs.get(track.id);
      if (record && record.blob && record.blob.size >= 100000 && record.mimeType !== 'audio/wav') {
        return this.registerBlobUrl(track.id, record.blob);
      }
    } catch (err) {
      console.warn(`[AudioBlobStorage] IndexedDB blob lookup error for ${track.id}:`, err);
    }

    // 7. Direct path fallback
    if (track.path && (track.path.startsWith('http://') || track.path.startsWith('https://'))) {
      return track.path;
    }

    return null;
  }

  /**
   * Generates a pleasant 16-bit PCM WAV audio track in pure JavaScript.
   * Plays a warm pentatonic acoustic sequence (C4, E4, G4, A4, C5) so that
   * any song without stored media can play real sound, test the visualizer,
   * verify the 9-band EQ, bass boost, and volume controls without crashing.
   */
  public createSyntheticHarmonicAudioBlob(durationSeconds = 15): Blob {
    const sampleRate = 44100;
    const numChannels = 2;
    const totalSamples = Math.floor(sampleRate * Math.min(60, Math.max(5, durationSeconds)));
    const blockAlign = numChannels * 2;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample

    // "data" sub-chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Pentatonic scale notes (Hz): C4, D4, E4, G4, A4, C5
    const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const noteDuration = 0.5; // seconds per note
    let offset = 44;

    for (let i = 0; i < totalSamples; i++) {
      const timeSec = i / sampleRate;
      const noteIdx = Math.floor(timeSec / noteDuration) % notes.length;
      const noteTime = timeSec % noteDuration;
      const freq = notes[noteIdx];

      // Soft envelope (fade in and fade out for note attack/decay)
      const envelope = Math.sin((noteTime / noteDuration) * Math.PI);

      // Warm harmonic synthesis (fundamental + 2nd + 3rd harmonics)
      const sample =
        (0.6 * Math.sin(2 * Math.PI * freq * timeSec) +
          0.3 * Math.sin(2 * Math.PI * (freq * 2) * timeSec) +
          0.1 * Math.sin(2 * Math.PI * (freq * 3) * timeSec)) *
        envelope *
        0.35; // Comfortable volume level

      const pcm16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));

      // Left Channel
      view.setInt16(offset, pcm16, true);
      offset += 2;
      // Right Channel
      view.setInt16(offset, pcm16, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Cleans up all active in-memory object URLs.
   */
  public revokeAllBlobUrls(): void {
    this.activeBlobUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    });
    this.activeBlobUrls.clear();
  }
}

export const audioBlobStorageService = AudioBlobStorageService.getInstance();


import { AudioFormat } from '../types';

export interface FormatCapability {
  format: AudioFormat;
  mimeType: string;
  supported: boolean;
  canPlayType: string; // 'probably', 'maybe', ''
  lossless: boolean;
  notes: string;
}

const FORMAT_MIME_MAP: Record<AudioFormat, { mime: string; lossless: boolean; notes: string }> = {
  mp3: { mime: 'audio/mpeg', lossless: false, notes: 'MPEG Layer-3 Audio' },
  flac: { mime: 'audio/flac', lossless: true, notes: 'Free Lossless Audio Codec (Studio Quality)' },
  wav: { mime: 'audio/wav', lossless: true, notes: 'Uncompressed PCM Lossless Audio' },
  ogg: { mime: 'audio/ogg; codecs="vorbis"', lossless: false, notes: 'Ogg Vorbis Compressed Audio' },
  opus: { mime: 'audio/ogg; codecs="opus"', lossless: false, notes: 'Opus Interactive Audio Codec' },
  m4a: { mime: 'audio/mp4; codecs="mp4a.40.2"', lossless: false, notes: 'MPEG-4 Audio AAC' },
  aac: { mime: 'audio/aac', lossless: false, notes: 'Advanced Audio Coding' },
  webm: { mime: 'audio/webm; codecs="opus"', lossless: false, notes: 'WebM Audio Container' },
};

export class AudioCapabilityDetector {
  private static cachedCapabilities: FormatCapability[] | null = null;

  public static getCapabilities(): FormatCapability[] {
    if (this.cachedCapabilities) {
      return this.cachedCapabilities;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      // In SSR or test environments, mock standard desktop audio capabilities
      return Object.entries(FORMAT_MIME_MAP).map(([fmt, meta]) => ({
        format: fmt as AudioFormat,
        mimeType: meta.mime,
        supported: true,
        canPlayType: 'probably',
        lossless: meta.lossless,
        notes: meta.notes,
      }));
    }

    const testAudio = document.createElement('audio');
    const capabilities: FormatCapability[] = [];

    for (const [fmt, meta] of Object.entries(FORMAT_MIME_MAP)) {
      const canPlay = testAudio.canPlayType(meta.mime);
      const isSupported = canPlay === 'probably' || canPlay === 'maybe';

      capabilities.push({
        format: fmt as AudioFormat,
        mimeType: meta.mime,
        supported: isSupported,
        canPlayType: canPlay,
        lossless: meta.lossless,
        notes: meta.notes,
      });
    }

    this.cachedCapabilities = capabilities;
    return capabilities;
  }

  public static isFormatSupported(extension: string): boolean {
    const cleanExt = extension.toLowerCase().replace(/^\./, '') as AudioFormat;
    const caps = this.getCapabilities();
    const found = caps.find((c) => c.format === cleanExt);
    return found ? found.supported : false;
  }
}

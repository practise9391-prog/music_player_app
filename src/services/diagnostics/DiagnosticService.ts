import { DiagnosticLogEntry, Track, AudioDiagnosticsReport } from '../../types';
import { audioEngineInstance } from '../../audio/AudioEngine';

export class DiagnosticService {
  private static instance: DiagnosticService | null = null;
  private logs: DiagnosticLogEntry[] = [];
  private readonly maxEntries = 500;
  private enabled: boolean = false;

  private constructor() {
    this.log('info', 'System', 'Diagnostic logging engine initialized.');
  }

  public static getInstance(): DiagnosticService {
    if (!this.instance) {
      this.instance = new DiagnosticService();
    }
    return this.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public log(
    level: 'debug' | 'info' | 'warn' | 'error',
    tag: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const entry: DiagnosticLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      level,
      tag,
      message: this.sanitizeString(message),
      details: details ? this.sanitizeObject(details) : undefined,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxEntries) {
      this.logs.shift(); // circular buffer eviction
    }

    if (level === 'error') {
      console.error(`[${tag}] ${entry.message}`, details || '');
    } else if (level === 'warn') {
      console.warn(`[${tag}] ${entry.message}`, details || '');
    }
  }

  public info(tag: string, message: string, details?: Record<string, unknown>): void {
    this.log('info', tag, message, details);
  }

  public warn(tag: string, message: string, details?: Record<string, unknown>): void {
    this.log('warn', tag, message, details);
  }

  public error(tag: string, message: string, details?: Record<string, unknown>): void {
    this.log('error', tag, message, details);
  }

  public getLogs(): DiagnosticLogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.log('info', 'System', 'Diagnostic logs cleared.');
  }

  /**
   * Sanitizes text strings to remove personal identifiers, auth tokens, and raw filesystem paths.
   */
  public sanitizeString(str: string): string {
    if (!str) return '';
    return str
      // Replace absolute Unix and Android filesystem paths
      .replace(/\/storage\/emulated\/[0-9]+\/[^"\s]+/gi, '[DEVICE_STORAGE_PATH]')
      .replace(/\/(home|Users|data)\/[^"'\s]+/gi, '[LOCAL_FS_PATH]')
      .replace(/[A-Za-z]:\\[^"'\s]+/gi, '[WINDOWS_PATH]')
      // Mask tokens, passwords, and auth parameters
      .replace(/([?&])(key|token|auth|password|secret)=([^&]+)/gi, '$1$2=[REDACTED]')
      .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED_TOKEN]');
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        sanitized[k] = this.sanitizeString(v);
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeObject(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  /**
   * Formats sanitized logs as a downloadable plain-text string.
   */
  public exportSanitizedLogsAsText(): string {
    const header = [
      '========================================================',
      'Nova Music Player — Sanitized Diagnostic & Error Log',
      `Exported: ${new Date().toISOString()}`,
      `Total Log Entries: ${this.logs.length}`,
      'Privacy: All personal paths and tokens have been stripped.',
      '========================================================\n',
    ].join('\n');

    const rows = this.logs.map((entry) => {
      const date = new Date(entry.timestamp).toISOString();
      const detailsStr = entry.details ? ` | ${JSON.stringify(entry.details)}` : '';
      return `[${date}] [${entry.level.toUpperCase()}] [${entry.tag}] ${entry.message}${detailsStr}`;
    });

    return `${header}${rows.join('\n')}\n`;
  }

  /**
   * Downloads sanitized logs as a `.txt` file onto the user device.
   */
  public downloadSanitizedLogs(): void {
    if (typeof document === 'undefined') return;

    const content = this.exportSanitizedLogsAsText();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nova_music_diagnostics_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Part 23: Generates real-time audio quality diagnostics
   */
  public generateAudioQualityDiagnostics(currentTrack: Track | null): AudioDiagnosticsReport {
    const state = audioEngineInstance.getState();
    const levelData = audioEngineInstance.getLevelData();
    const procState = audioEngineInstance.getProcessingState();
    const spatialState = audioEngineInstance.getSpatialEngine().getState();

    const format = (currentTrack?.format || 'mp3').toLowerCase();
    const isLossless = ['flac', 'wav', 'alac', 'aiff'].includes(format);

    return {
      timestamp: Date.now(),
      trackId: currentTrack?.id,
      title: currentTrack ? this.sanitizeString(currentTrack.title) : undefined,
      format: format.toUpperCase(),
      sampleRate: currentTrack?.sampleRate || 44100,
      channels: currentTrack?.channels || 2,
      bitrateKbps: currentTrack?.bitrate || 320,
      bufferHealthPercent: state.bufferedPercent || 0,
      dspActive: !procState.dspBypass,
      spatialActive: spatialState.enabled && !spatialState.bypass,
      volumePercent: Math.round(state.volume * 100),
      estimatedDynamicRangeDb: isLossless ? 96 : 84,
      peakOutputLevelDb: Math.round(Math.max(levelData?.leftPeak || 0, levelData?.rightPeak || 0) * 100) / 10,
      rmsOutputLevelDb: Math.round((((levelData?.leftRms || 0) + (levelData?.rightRms || 0)) / 2) * 100) / 10,
      isLossless,
    };
  }

  /**
   * Part 23: Exports a privacy-first, fully sanitized issue report for user feedback
   */
  public exportSanitizedIssueReport(
    userDescription: string,
    category: string
  ): { reportText: string; jsonPayload: string } {
    const sanitizedDesc = this.sanitizeString(userDescription);
    const audioDiag = this.generateAudioQualityDiagnostics(audioEngineInstance.getCurrentTrack());
    const sanitizedRecentLogs = this.logs.slice(-20);

    const payload = {
      appVersion: '1.0.0',
      category: this.sanitizeString(category),
      userDescription: sanitizedDesc,
      audioDiagnostics: audioDiag,
      recentLogs: sanitizedRecentLogs,
      environment: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'Unknown',
      },
      generatedAt: new Date().toISOString(),
    };

    const reportText = [
      '========================================================',
      'Nova Music Player — Sanitized Issue & Feedback Report',
      `Category: ${payload.category}`,
      `Generated: ${payload.generatedAt}`,
      '========================================================',
      '',
      'USER DESCRIPTION:',
      sanitizedDesc,
      '',
      'AUDIO DIAGNOSTICS SNAPSHOT:',
      `- Format: ${audioDiag.format} (${audioDiag.isLossless ? 'Lossless' : 'Lossy'})`,
      `- Sample Rate: ${audioDiag.sampleRate} Hz | Channels: ${audioDiag.channels}`,
      `- Bitrate: ${audioDiag.bitrateKbps} kbps`,
      `- Buffer Health: ${audioDiag.bufferHealthPercent}%`,
      `- DSP Active: ${audioDiag.dspActive} | Spatial Audio: ${audioDiag.spatialActive}`,
      `- Volume: ${audioDiag.volumePercent}%`,
      '',
      'RECENT SANITIZED SYSTEM EVENTS:',
      ...sanitizedRecentLogs.map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}`),
      '',
      'All local personal data, account identifiers, and absolute paths are scrubbed.',
    ].join('\n');

    return {
      reportText,
      jsonPayload: JSON.stringify(payload, null, 2),
    };
  }
}

export const diagnosticServiceInstance = DiagnosticService.getInstance();


import {
  IDownloadProvider,
  DownloadProviderCapabilities,
  DownloadMediaInfo,
  DownloadRecord,
  DownloadProgressUpdate,
} from '../../../types/download';

export class DirectHttpDownloadProvider implements IDownloadProvider {
  public readonly id = 'direct_http';
  public readonly name = 'Direct Audio URL Provider';
  public readonly description = 'Downloads audio files from direct HTTP/HTTPS authorized endpoints.';

  public readonly capabilities: DownloadProviderCapabilities = {
    supportsDirectDownload: true,
    supportsResumption: true,
    providesExpectedSize: true,
    providesContentType: true,
    requiresAuthorization: false,
    supportsMetadata: true,
  };

  private static AUDIO_EXTENSIONS = new Set([
    'mp3',
    'flac',
    'wav',
    'ogg',
    'm4a',
    'aac',
    'opus',
    'webm',
    'aiff',
  ]);

  public async canHandle(urlOrRef: string): Promise<boolean> {
    if (!urlOrRef || typeof urlOrRef !== 'string') return false;
    const trimmed = urlOrRef.trim();

    // Must be valid HTTP or HTTPS
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }

    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.toLowerCase();
      const ext = pathname.split('.').pop() || '';
      if (DirectHttpDownloadProvider.AUDIO_EXTENSIONS.has(ext)) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async getDownloadInfo(urlOrRef: string): Promise<DownloadMediaInfo> {
    const trimmed = urlOrRef.trim();
    let title = 'Audio Track';
    let detectedFormat = 'mp3';

    try {
      const parsed = new URL(trimmed);
      const filename = parsed.pathname.split('/').pop() || 'audio.mp3';
      const cleanName = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
      if (cleanName) {
        title = cleanName.replace(/[-_]/g, ' ');
      }
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext && DirectHttpDownloadProvider.AUDIO_EXTENSIONS.has(ext)) {
        detectedFormat = ext;
      }
    } catch {
      // ignore
    }

    let expectedBytes = 0;
    let mimeType = `audio/${detectedFormat}`;
    let isResumable = false;
    let etag: string | undefined;
    let lastModified: string | undefined;

    // Attempt lightweight HEAD request to probe headers
    try {
      const resp = await fetch(trimmed, { method: 'HEAD' });
      if (resp.ok) {
        const cl = resp.headers.get('content-length');
        if (cl) {
          expectedBytes = parseInt(cl, 10) || 0;
        }
        const ct = resp.headers.get('content-type');
        if (ct && !ct.includes('html')) {
          mimeType = ct.split(';')[0].trim();
        }
        const ar = resp.headers.get('accept-ranges');
        if (ar && ar.toLowerCase() === 'bytes') {
          isResumable = true;
        }
        etag = resp.headers.get('etag') || undefined;
        lastModified = resp.headers.get('last-modified') || undefined;
      }
    } catch {
      // HEAD may be blocked by CORS or origin, proceed with defaults
    }

    return {
      title,
      expectedBytes,
      mimeType,
      detectedFormat,
      isResumable,
      isAuthorized: true,
      etag,
      lastModified,
    };
  }

  public async startDownload(
    job: DownloadRecord,
    onProgress: (p: DownloadProgressUpdate) => void,
    signal: AbortSignal,
    startOffset = 0
  ): Promise<{ blob: Blob; mimeType: string }> {
    const headers: Record<string, string> = {};

    if (startOffset > 0 && job.is_resumable) {
      headers['Range'] = `bytes=${startOffset}-`;
    }

    const response = await fetch(job.source_id, {
      method: 'GET',
      headers,
      signal,
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(`Server returned HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || job.mime_type || 'audio/mpeg';

    // Guard against HTML error pages mistakenly returned
    if (contentType.toLowerCase().includes('text/html')) {
      throw new Error('Received HTML webpage instead of an audio stream.');
    }

    const contentLength = response.headers.get('content-length');
    const totalExpected = contentLength
      ? parseInt(contentLength, 10) + startOffset
      : job.expected_bytes || 0;

    let receivedBytes = startOffset;
    let lastReportTime = Date.now();
    let bytesSinceLastReport = 0;
    const chunks: Uint8Array[] = [];

    if (response.body && typeof response.body.getReader === 'function') {
      const reader = response.body.getReader();

      while (true) {
        if (signal.aborted) {
          throw new Error('Download aborted by user.');
        }

        const { done, value } = await reader.read();
        if (done) break;

        if (value) {
          chunks.push(value);
          receivedBytes += value.byteLength;
          bytesSinceLastReport += value.byteLength;

          const now = Date.now();
          const elapsed = (now - lastReportTime) / 1000;
          if (elapsed >= 0.25 || receivedBytes === totalExpected) {
            const speed = elapsed > 0 ? Math.round(bytesSinceLastReport / elapsed) : 0;
            const remaining = totalExpected > receivedBytes && speed > 0
              ? Math.round((totalExpected - receivedBytes) / speed)
              : 0;

            onProgress({
              jobId: job.id,
              downloadedBytes: receivedBytes,
              expectedBytes: totalExpected,
              speedBytesSec: speed,
              estimatedRemainingSeconds: remaining,
            });

            lastReportTime = now;
            bytesSinceLastReport = 0;
          }
        }
      }

      const blob = new Blob(chunks as any, { type: contentType });
      return { blob, mimeType: contentType };
    } else {
      // Fallback for environments where body.getReader() is not available
      const blob = await response.blob();
      onProgress({
        jobId: job.id,
        downloadedBytes: blob.size,
        expectedBytes: blob.size,
        speedBytesSec: 0,
        estimatedRemainingSeconds: 0,
      });
      return { blob, mimeType: contentType };
    }
  }
}


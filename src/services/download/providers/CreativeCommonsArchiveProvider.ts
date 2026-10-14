import {
  IDownloadProvider,
  DownloadProviderCapabilities,
  DownloadMediaInfo,
  DownloadRecord,
  DownloadProgressUpdate,
} from '../../../types/download';

export class CreativeCommonsArchiveProvider implements IDownloadProvider {
  public readonly id = 'archive_cc';
  public readonly name = 'Open Access & Creative Commons Provider';
  public readonly description = 'Downloads openly licensed and public domain audio from recognized digital archives.';

  public readonly capabilities: DownloadProviderCapabilities = {
    supportsDirectDownload: true,
    supportsResumption: true,
    providesExpectedSize: true,
    providesContentType: true,
    requiresAuthorization: false,
    supportsMetadata: true,
  };

  private static ARCHIVE_HOSTS = [
    'archive.org',
    'ia80',
    'ia90',
    'upload.wikimedia.org',
    'freemusicarchive.org',
    'ccmixter.org',
    'jamendo.com',
  ];

  public async canHandle(urlOrRef: string): Promise<boolean> {
    if (!urlOrRef || typeof urlOrRef !== 'string') return false;
    const lower = urlOrRef.toLowerCase();
    return CreativeCommonsArchiveProvider.ARCHIVE_HOSTS.some((host) => lower.includes(host));
  }

  public async getDownloadInfo(urlOrRef: string): Promise<DownloadMediaInfo> {
    let title = 'Archive Track';
    let artist = 'Creative Commons Artist';
    let detectedFormat = 'mp3';
    let expectedBytes = 0;
    let mimeType = 'audio/mpeg';
    let isResumable = true;

    try {
      const parsed = new URL(urlOrRef);
      const filename = parsed.pathname.split('/').pop() || 'track.mp3';
      const cleanName = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
      if (cleanName) {
        title = cleanName.replace(/[-_]/g, ' ');
      }
      const ext = filename.split('.').pop()?.toLowerCase();
      if (ext) {
        detectedFormat = ext;
        mimeType = ext === 'ogg' ? 'audio/ogg' : ext === 'flac' ? 'audio/flac' : 'audio/mpeg';
      }
    } catch {
      // ignore
    }

    try {
      const resp = await fetch(urlOrRef, { method: 'HEAD' });
      if (resp.ok) {
        const cl = resp.headers.get('content-length');
        if (cl) expectedBytes = parseInt(cl, 10) || 0;
        const ct = resp.headers.get('content-type');
        if (ct && !ct.includes('html')) mimeType = ct;
      }
    } catch {
      // ignore
    }

    return {
      title,
      artist,
      expectedBytes,
      mimeType,
      detectedFormat,
      isResumable,
      isAuthorized: true,
      authorizationReason: 'Public Domain / Creative Commons Licensed Material',
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
      throw new Error(`Archive server returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || job.mime_type || 'audio/mpeg';
    if (contentType.toLowerCase().includes('text/html')) {
      throw new Error('Archive server returned HTML page instead of an audio stream.');
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


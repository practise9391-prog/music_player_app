import {
  IDownloadProvider,
  DownloadProviderCapabilities,
  DownloadMediaInfo,
  DownloadRecord,
  DownloadProgressUpdate,
} from '../../../types/download';

export class AuthorizedStreamEndpointProvider implements IDownloadProvider {
  public readonly id = 'authorized_stream';
  public readonly name = 'Authorized Stream Endpoint Provider';
  public readonly description = 'Downloads media from user-authorized audio streaming endpoints and CDNs.';

  public readonly capabilities: DownloadProviderCapabilities = {
    supportsDirectDownload: true,
    supportsResumption: true,
    providesExpectedSize: true,
    providesContentType: true,
    requiresAuthorization: true,
    supportsMetadata: true,
  };

  public async canHandle(urlOrRef: string): Promise<boolean> {
    if (!urlOrRef || typeof urlOrRef !== 'string') return false;
    const lower = urlOrRef.toLowerCase();
    return (
      (lower.startsWith('http://') || lower.startsWith('https://')) &&
      (lower.includes('/media/') ||
        lower.includes('/audio/') ||
        lower.includes('/stream/') ||
        lower.includes('cdn') ||
        lower.includes('download'))
    );
  }

  public async getDownloadInfo(urlOrRef: string): Promise<DownloadMediaInfo> {
    let title = 'Authorized Stream';
    let expectedBytes = 0;
    let mimeType = 'audio/mpeg';

    try {
      const parsed = new URL(urlOrRef);
      const filename = parsed.pathname.split('/').pop() || 'stream.mp3';
      title = decodeURIComponent(filename).replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Authorized Stream';
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
      expectedBytes,
      mimeType,
      isResumable: true,
      isAuthorized: true,
      authorizationReason: 'User Authorized Media Endpoint',
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
      throw new Error(`Endpoint returned HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || job.mime_type || 'audio/mpeg';
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


import {
  IDownloadProvider,
  DownloadProviderCapabilities,
  DownloadMediaInfo,
  DownloadRecord,
  DownloadProgressUpdate,
} from '../../../types/download';

export class StreamingFallbackProvider implements IDownloadProvider {
  public readonly id = 'streaming_unsupported';
  public readonly name = 'Streaming Platform Compliance Provider';
  public readonly description = 'Enforces copyright compliance and Terms of Service policies for streaming sites.';

  public readonly capabilities: DownloadProviderCapabilities = {
    supportsDirectDownload: false,
    supportsResumption: false,
    providesExpectedSize: false,
    providesContentType: false,
    requiresAuthorization: true,
    supportsMetadata: true,
  };

  private static STREAMING_HOSTS = [
    'youtube.com',
    'youtu.be',
    'music.youtube.com',
    'spotify.com',
    'soundcloud.com',
    'apple.com',
  ];

  public async canHandle(urlOrRef: string): Promise<boolean> {
    if (!urlOrRef || typeof urlOrRef !== 'string') return false;
    const lower = urlOrRef.toLowerCase();
    return StreamingFallbackProvider.STREAMING_HOSTS.some((host) => lower.includes(host));
  }

  public async getDownloadInfo(urlOrRef: string): Promise<DownloadMediaInfo> {
    return {
      title: 'Protected Online Stream',
      expectedBytes: 0,
      mimeType: 'audio/unsupported',
      isResumable: false,
      isAuthorized: false,
      authorizationReason:
        'This streaming platform does not permit direct offline downloads under its Terms of Service. Please stream online via Nova Player instead.',
    };
  }

  public async startDownload(
    job: DownloadRecord,
    onProgress: (p: DownloadProgressUpdate) => void,
    signal: AbortSignal
  ): Promise<{ blob: Blob; mimeType: string }> {
    throw new Error(
      'Direct offline downloads from this streaming platform are unauthorized under provider terms. Online streaming playback remains available.'
    );
  }
}


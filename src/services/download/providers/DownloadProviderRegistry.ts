import { IDownloadProvider } from '../../../types/download';
import { DirectHttpDownloadProvider } from './DirectHttpDownloadProvider';
import { CreativeCommonsArchiveProvider } from './CreativeCommonsArchiveProvider';
import { AuthorizedStreamEndpointProvider } from './AuthorizedStreamEndpointProvider';
import { StreamingFallbackProvider } from './StreamingFallbackProvider';

export class DownloadProviderRegistry {
  private static instance: DownloadProviderRegistry | null = null;
  private providers: IDownloadProvider[] = [];

  private constructor() {
    this.registerProvider(new StreamingFallbackProvider()); // checked first to catch protected sites
    this.registerProvider(new CreativeCommonsArchiveProvider());
    this.registerProvider(new DirectHttpDownloadProvider());
    this.registerProvider(new AuthorizedStreamEndpointProvider());
  }

  public static getInstance(): DownloadProviderRegistry {
    if (!this.instance) {
      this.instance = new DownloadProviderRegistry();
    }
    return this.instance;
  }

  public registerProvider(provider: IDownloadProvider): void {
    // Avoid duplicate registration
    if (!this.providers.some((p) => p.id === provider.id)) {
      this.providers.push(provider);
    }
  }

  public getAllProviders(): IDownloadProvider[] {
    return [...this.providers];
  }

  public async getProviderForUrl(url: string): Promise<IDownloadProvider | null> {
    for (const provider of this.providers) {
      if (await provider.canHandle(url)) {
        return provider;
      }
    }
    return null;
  }
}

export const downloadProviderRegistry = DownloadProviderRegistry.getInstance();


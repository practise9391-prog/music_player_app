export type NetworkStatus =
  | 'OFFLINE_LOCKED'
  | 'RESOLVING'
  | 'ONLINE_PLAYBACK_ACTIVE'
  | 'ENDING_SESSION'
  | 'ERROR'
  // Backward compatibility aliases from Part 1:
  | 'LOCKED'
  | 'OFFLINE'
  | 'TEMPORARY_ONLINE'
  | 'ACTIVE_STREAM';

export interface NetworkSession {
  sessionId: string;
  url: string;
  videoId: string;
  allowedEndpoint: string | null;
  startedAt: number;
  status: NetworkStatus;
  state: 'idle' | 'resolving' | 'active' | 'ending' | 'closed';
}

export interface NetworkState {
  status: NetworkStatus;
  isAirGapped: boolean; // default true: air-gapped / locked
  temporaryAccessExpiresAt: number | null; // epoch timestamp if temporary access granted
  activeConnections: number;
  lastAllowedOperation: string | null;
  askBeforeAccess: boolean;
  activeSession: NetworkSession | null;
  allowedHosts: string[];
}

export interface NetworkOperationRequest {
  id: string;
  url: string;
  purpose: 'stream' | 'metadata' | 'artwork';
  requestedAt: number;
}

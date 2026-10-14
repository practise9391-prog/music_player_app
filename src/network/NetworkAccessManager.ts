import { NetworkSession, NetworkState, NetworkStatus } from '../types';

type NetworkStateListener = (state: NetworkState) => void;

/**
 * NetworkAccessManager
 *
 * Implements strict application-level network gating:
 * - Default state: OFFLINE_LOCKED (Zero background requests, telemetry, or unprompted calls).
 * - Maximum active online playback sessions: exactly 1.
 * - Granular media endpoint whitelist: only the validated YouTube URL and the
 *   session-scoped audio CDN stream endpoint are permitted.
 * - Transparent security disclosure: blocks application-level HTTP/TCP requests;
 *   does not claim physical OS-level air-gap isolation.
 */
class NetworkAccessManagerImpl {
  private status: NetworkStatus = 'OFFLINE_LOCKED';
  private isAirGapped = true; // Default: Locked / Offline
  private activeSession: NetworkSession | null = null;
  private allowedHosts: Set<string> = new Set();
  private temporaryMediaEndpoint: string | null = null;

  // Connection tracking
  private activeConnections = 0;
  private lastAllowedOperation: string | null = null;
  private askBeforeAccess = true;
  private temporaryAccessExpiresAt: number | null = null;
  private temporaryTimer: ReturnType<typeof setTimeout> | null = null;

  private listeners: Set<NetworkStateListener> = new Set();

  constructor() {
    // Application starts strictly locked
    this.status = 'OFFLINE_LOCKED';
    this.isAirGapped = true;
  }

  // --- Core Part 6 Gateway API ---

  /**
   * Check if outbound network access is currently authorized for an active session or temporary grant.
   */
  public isNetworkAllowed(): boolean {
    if (this.isAirGapped) {
      return false;
    }
    return (
      this.status === 'RESOLVING' ||
      this.status === 'ONLINE_PLAYBACK_ACTIVE' ||
      this.status === 'TEMPORARY_ONLINE' ||
      this.status === 'ACTIVE_STREAM'
    );
  }

  /**
   * User requests to start an online playback session for a validated YouTube URL.
   */
  public async requestOnlineSession(url: string): Promise<boolean> {
    if (!url) return false;
    // If already in an active session, close previous session to enforce single-session limit
    if (this.activeSession) {
      this.endOnlineSession();
    }
    return true;
  }

  /**
   * Initiates a temporary online playback session for a validated YouTube video.
   * Changes state to RESOLVING.
   */
  public startOnlineSession(url: string, videoId: string): string {
    // Enforce exactly 1 active online session
    if (this.activeSession) {
      this.endOnlineSession();
    }

    const sessionId = `yt_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.isAirGapped = false;
    this.status = 'RESOLVING';

    // Allow official YouTube hosts initially for resolution
    this.allowedHosts.clear();
    this.allowedHosts.add('youtube.com');
    this.allowedHosts.add('www.youtube.com');
    this.allowedHosts.add('m.youtube.com');
    this.allowedHosts.add('music.youtube.com');
    this.allowedHosts.add('youtu.be');

    this.activeSession = {
      sessionId,
      url,
      videoId,
      allowedEndpoint: null,
      startedAt: Date.now(),
      status: 'RESOLVING',
      state: 'resolving',
    };

    this.notify();
    return sessionId;
  }

  /**
   * Called once the stream URL is obtained: permits the temporary media CDN endpoint
   * and transitions state to ONLINE_PLAYBACK_ACTIVE.
   */
  public allowMediaEndpoint(endpointUrl: string): void {
    if (!this.activeSession) {
      throw new Error('Cannot permit media endpoint without an active online session.');
    }

    try {
      const parsed = new URL(endpointUrl);
      const host = parsed.hostname.toLowerCase();
      this.allowedHosts.add(host);
      this.temporaryMediaEndpoint = endpointUrl;

      this.status = 'ONLINE_PLAYBACK_ACTIVE';
      this.activeSession.allowedEndpoint = endpointUrl;
      this.activeSession.status = 'ONLINE_PLAYBACK_ACTIVE';
      this.activeSession.state = 'active';

      this.notify();
    } catch (e) {
      console.error('Invalid media endpoint format:', e);
    }
  }

  /**
   * Revokes the temporary media CDN endpoint without ending the entire session (e.g. on stream change).
   */
  public revokeMediaEndpoint(): void {
    if (this.temporaryMediaEndpoint) {
      try {
        const parsed = new URL(this.temporaryMediaEndpoint);
        this.allowedHosts.delete(parsed.hostname.toLowerCase());
      } catch {
        // ignore
      }
      this.temporaryMediaEndpoint = null;
    }
    if (this.activeSession) {
      this.activeSession.allowedEndpoint = null;
    }
    this.notify();
  }

  /**
   * Ends the active online playback session.
   * Immediately revokes all temporary media endpoints, clears session, and locks network.
   */
  public endOnlineSession(): void {
    if (this.status === 'OFFLINE_LOCKED' && !this.activeSession) {
      return;
    }

    this.status = 'ENDING_SESSION';
    this.revokeMediaEndpoint();
    this.allowedHosts.clear();

    if (this.activeSession) {
      this.activeSession.state = 'closed';
      this.activeSession = null;
    }

    // Immediately restore strict offline locked state
    this.isAirGapped = true;
    this.status = 'OFFLINE_LOCKED';
    this.activeConnections = 0;
    this.lastAllowedOperation = null;

    if (this.temporaryTimer) {
      clearTimeout(this.temporaryTimer);
      this.temporaryTimer = null;
    }
    this.temporaryAccessExpiresAt = null;

    this.notify();
  }

  /**
   * Verifies if a given host or URL is authorized under the active session.
   */
  public isHostAllowed(hostOrUrl: string): boolean {
    if (this.isAirGapped || !this.activeSession) {
      return false;
    }

    let targetHost = hostOrUrl.toLowerCase();
    try {
      if (hostOrUrl.includes('://')) {
        targetHost = new URL(hostOrUrl).hostname.toLowerCase();
      }
    } catch {
      // not a full URL, treat as raw host
    }

    return this.allowedHosts.has(targetHost);
  }

  /**
   * Returns current active session or null.
   */
  public getSessionState(): NetworkSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  /**
   * Sets error state on the gateway (e.g. resolution failed).
   */
  public setSessionError(errorMessage?: string): void {
    this.status = 'ERROR';
    if (this.activeSession) {
      this.activeSession.status = 'ERROR';
    }
    this.notify();
    // After reporting error, automatically return to OFFLINE_LOCKED after a brief delay
    setTimeout(() => {
      this.endOnlineSession();
    }, 2500);
  }

  // --- Backward-Compatible Part 1 API ---

  public getState(): NetworkState {
    return {
      status: (this.status === 'OFFLINE_LOCKED' ? 'LOCKED' : this.status) as NetworkStatus,
      isAirGapped: this.isAirGapped,
      temporaryAccessExpiresAt: this.temporaryAccessExpiresAt,
      activeConnections: this.activeConnections,
      lastAllowedOperation: this.lastAllowedOperation,
      askBeforeAccess: this.askBeforeAccess,
      activeSession: this.activeSession ? { ...this.activeSession } : null,
      allowedHosts: Array.from(this.allowedHosts),
    };
  }

  public subscribe(listener: NetworkStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.error('Error notifying network listener:', err);
      }
    });
  }

  public setLock(locked: boolean): void {
    if (locked) {
      this.endOnlineSession();
    } else {
      this.isAirGapped = false;
      this.status = 'TEMPORARY_ONLINE';
      this.notify();
    }
  }

  public grantTemporaryAccess(durationMs = 5 * 60 * 1000): void {
    if (this.temporaryTimer) {
      clearTimeout(this.temporaryTimer);
    }
    this.isAirGapped = false;
    this.status = 'TEMPORARY_ONLINE';
    this.temporaryAccessExpiresAt = Date.now() + durationMs;

    this.temporaryTimer = setTimeout(() => {
      this.revokeTemporaryAccess();
    }, durationMs);

    this.notify();
  }

  public revokeTemporaryAccess(): void {
    if (this.temporaryTimer) {
      clearTimeout(this.temporaryTimer);
      this.temporaryTimer = null;
    }
    this.temporaryAccessExpiresAt = null;
    this.isAirGapped = true;
    this.status = 'OFFLINE_LOCKED';
    this.notify();
  }

  public checkAccessAllowed(operationName: string): { allowed: boolean; reason?: string } {
    if (this.isAirGapped) {
      return {
        allowed: false,
        reason: `Network access is disabled (Air-Gap Locked). Operation "${operationName}" was blocked.`,
      };
    }

    if (this.temporaryAccessExpiresAt && Date.now() > this.temporaryAccessExpiresAt) {
      this.revokeTemporaryAccess();
      return {
        allowed: false,
        reason: 'Temporary network access has expired.',
      };
    }

    return { allowed: true };
  }

  public async executeExplicitOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const check = this.checkAccessAllowed(operationName);
    if (!check.allowed) {
      throw new Error(check.reason || 'Network access blocked by Air-Gap policy.');
    }

    this.activeConnections++;
    this.lastAllowedOperation = operationName;
    this.notify();

    try {
      return await operation();
    } finally {
      this.activeConnections = Math.max(0, this.activeConnections - 1);
      this.notify();
    }
  }

  public setAskBeforeAccess(ask: boolean): void {
    this.askBeforeAccess = ask;
    this.notify();
  }
}

export const NetworkAccessManager = new NetworkAccessManagerImpl();

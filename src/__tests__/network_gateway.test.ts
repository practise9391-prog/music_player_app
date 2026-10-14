import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Part 6 — Network Access Manager & Online Gateway', () => {
  beforeEach(() => {
    NetworkAccessManager.endOnlineSession();
  });

  it('starts in OFFLINE_LOCKED state by default', () => {
    const state = NetworkAccessManager.getState();
    expect(['OFFLINE_LOCKED', 'LOCKED']).toContain(state.status);
    expect(state.isAirGapped).toBe(true);
    expect(NetworkAccessManager.isNetworkAllowed()).toBe(false);
  });

  it('transitions to RESOLVING when an online session starts', () => {
    const sessionId = NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    );
    expect(sessionId).toBeDefined();

    const state = NetworkAccessManager.getState();
    expect(state.status).toBe('RESOLVING');
    expect(state.isAirGapped).toBe(false);
    expect(NetworkAccessManager.isNetworkAllowed()).toBe(true);
    expect(state.allowedHosts).toContain('www.youtube.com');
  });

  it('transitions to ONLINE_PLAYBACK_ACTIVE when media endpoint is permitted', () => {
    NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    );
    const cdnUrl = 'https://rr3---sn-4g5ednls.googlevideo.com/videoplayback?id=123';
    NetworkAccessManager.allowMediaEndpoint(cdnUrl);

    const state = NetworkAccessManager.getState();
    expect(state.status).toBe('ONLINE_PLAYBACK_ACTIVE');
    expect(NetworkAccessManager.isHostAllowed(cdnUrl)).toBe(true);
    expect(NetworkAccessManager.isHostAllowed('rr3---sn-4g5ednls.googlevideo.com')).toBe(true);
  });

  it('strictly rejects unauthorized remote hosts outside the active session whitelist', () => {
    NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    );
    NetworkAccessManager.allowMediaEndpoint('https://rr3.googlevideo.com/media');

    expect(NetworkAccessManager.isHostAllowed('https://telemetry.tracker.com')).toBe(false);
    expect(NetworkAccessManager.isHostAllowed('https://adservice.google.com')).toBe(false);
    expect(NetworkAccessManager.isHostAllowed('https://arbitrary-site.org')).toBe(false);
  });

  it('enforces single online session constraint by terminating previous session', () => {
    const session1 = NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=firstVideo123',
      'firstVideo123'
    );
    expect(NetworkAccessManager.getSessionState()?.sessionId).toBe(session1);

    const session2 = NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=secondVid456',
      'secondVid456'
    );
    expect(NetworkAccessManager.getSessionState()?.sessionId).toBe(session2);
    expect(NetworkAccessManager.getSessionState()?.videoId).toBe('secondVid456');
  });

  it('returns to OFFLINE_LOCKED immediately when session ends and revokes endpoints', () => {
    NetworkAccessManager.startOnlineSession(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'dQw4w9WgXcQ'
    );
    NetworkAccessManager.allowMediaEndpoint('https://rr3.googlevideo.com/videoplayback');

    NetworkAccessManager.endOnlineSession();

    const state = NetworkAccessManager.getState();
    expect(['OFFLINE_LOCKED', 'LOCKED']).toContain(state.status);
    expect(state.isAirGapped).toBe(true);
    expect(NetworkAccessManager.isNetworkAllowed()).toBe(false);
    expect(NetworkAccessManager.isHostAllowed('https://rr3.googlevideo.com')).toBe(false);
    expect(NetworkAccessManager.getSessionState()).toBeNull();
  });
});

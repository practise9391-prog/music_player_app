import { describe, it, expect, beforeEach } from 'vitest';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Network Access Manager & Air-Gap System', () => {
  beforeEach(() => {
    localStorage.clear();
    NetworkAccessManager.setLock(true);
  });

  it('starts in LOCKED state by default', () => {
    const state = NetworkAccessManager.getState();
    expect(state.status).toBe('LOCKED');
    expect(state.isAirGapped).toBe(true);
  });

  it('blocks network operations when air-gapped', () => {
    const check = NetworkAccessManager.checkAccessAllowed('Test Stream');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Air-Gap Locked');
  });

  it('rejects explicit operations when locked with human-readable error', async () => {
    await expect(
      NetworkAccessManager.executeExplicitOperation('Fetch Online Audio', async () => {
        return 'success';
      })
    ).rejects.toThrow(/Network access is disabled/);
  });

  it('permits operations when unlocked', async () => {
    NetworkAccessManager.setLock(false);
    const result = await NetworkAccessManager.executeExplicitOperation(
      'Fetch Online Audio',
      async () => 'stream_data'
    );
    expect(result).toBe('stream_data');
  });

  it('supports temporary access with auto-expiration', () => {
    NetworkAccessManager.grantTemporaryAccess(5000);
    const state = NetworkAccessManager.getState();
    expect(state.isAirGapped).toBe(false);
    expect(state.status).toBe('TEMPORARY_ONLINE');
    expect(NetworkAccessManager.checkAccessAllowed('Temporary Op').allowed).toBe(true);

    NetworkAccessManager.revokeTemporaryAccess();
    expect(NetworkAccessManager.getState().status).toBe('LOCKED');
  });
});

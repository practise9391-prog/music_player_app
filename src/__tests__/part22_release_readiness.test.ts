import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../types/settings';
import fs from 'fs';
import path from 'path';

describe('Part 22 — Final Release & Launch Readiness', () => {
  it('enforces privacy air-gap and local-first defaults', () => {
    expect(DEFAULT_SETTINGS.networkLocked).toBe(true);
    expect(DEFAULT_SETTINGS.askBeforeOnlineAccess).toBe(true);
    expect(DEFAULT_SETTINGS.saveListeningHistory).toBe(true);
    expect(DEFAULT_SETTINGS.language).toBe('en');
  });

  it('contains comprehensive PRIVACY_POLICY.md with offline guarantees', () => {
    const policyPath = path.resolve(__dirname, '../../PRIVACY_POLICY.md');
    expect(fs.existsSync(policyPath)).toBe(true);
    const content = fs.readFileSync(policyPath, 'utf-8');

    expect(content).toContain('Zero Telemetry');
    expect(content).toContain('Air-Gapped Architecture');
    expect(content).toContain('READ_MEDIA_AUDIO');
    expect(content).toContain('FOREGROUND_SERVICE_MEDIA_PLAYBACK');
  });

  it('contains complete RELEASE_NOTES.md with full feature coverage', () => {
    const releasePath = path.resolve(__dirname, '../../RELEASE_NOTES.md');
    expect(fs.existsSync(releasePath)).toBe(true);
    const content = fs.readFileSync(releasePath, 'utf-8');

    expect(content).toContain('Nova Music Player');
    expect(content).toContain('10-Band Equalizer');
    expect(content).toContain('Sleep Timer');
    expect(content).toContain('Driving Mode');
    expect(content).toContain('Telugu');
    expect(content).toContain('Hindi');
  });
});


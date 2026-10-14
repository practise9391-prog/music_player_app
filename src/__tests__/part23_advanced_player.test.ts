import { describe, it, expect } from 'vitest';
import { diagnosticServiceInstance } from '../services/diagnostics/DiagnosticService';
import { Track } from '../types';

describe('Part 23 — Advanced Player & Sanitized Diagnostics', () => {
  it('generates real-time audio quality diagnostics for tracks', () => {
    const mockTrack: Track = {
      id: 'test_track_1',
      title: 'High Resolution Audio',
      artist: 'Studio Masters',
      album: 'Acoustic Sessions',
      duration: 240,
      format: 'flac',
      path: '/storage/emulated/0/Music/track.flac',
      sampleRate: 96000,
      bitrate: 1411,
      channels: 2,
      source: 'local',
      dateAdded: Date.now(),
      isAvailable: true,
      playCount: 0,
      isFavorite: false,
    };

    const report = diagnosticServiceInstance.generateAudioQualityDiagnostics(mockTrack);
    expect(report.format).toBe('FLAC');
    expect(report.isLossless).toBe(true);
    expect(report.sampleRate).toBe(96000);
    expect(report.bitrateKbps).toBe(1411);
    expect(report.estimatedDynamicRangeDb).toBe(96);
  });

  it('correctly classifies lossy audio streams in diagnostics', () => {
    const mockTrack: Track = {
      id: 'test_track_2',
      title: 'Compressed Stream',
      artist: 'Web Artist',
      duration: 180,
      format: 'mp3',
      path: '/storage/music/track.mp3',
      sampleRate: 44100,
      bitrate: 320,
      channels: 2,
      source: 'local',
      dateAdded: Date.now(),
      isAvailable: true,
      playCount: 0,
      isFavorite: false,
    };

    const report = diagnosticServiceInstance.generateAudioQualityDiagnostics(mockTrack);
    expect(report.format).toBe('MP3');
    expect(report.isLossless).toBe(false);
    expect(report.estimatedDynamicRangeDb).toBe(84);
  });

  it('sanitizes user paths and tokens when generating issue reports', () => {
    const rawIssue =
      'Playback failed at /storage/emulated/0/Music/Album/song.mp3 with token bearer eyJhbGciOiJIUzI1NiJ9';
    const { reportText, jsonPayload } = diagnosticServiceInstance.exportSanitizedIssueReport(
      rawIssue,
      'Playback Issue'
    );

    expect(reportText).not.toContain('/storage/emulated/0/Music');
    expect(reportText).toContain('[DEVICE_STORAGE_PATH]');
    expect(reportText).toContain('USER DESCRIPTION');

    const parsed = JSON.parse(jsonPayload);
    expect(parsed.category).toBe('Playback Issue');
    expect(parsed.appVersion).toBe('1.0.0');
  });
});

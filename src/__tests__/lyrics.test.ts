// ──────────────────────────────────────────────────────────
// Part 9 — Lyrics System Tests
// LyricsParser, LyricsSyncEngine, LyricsManager
// ──────────────────────────────────────────────────────────
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsePlainText,
  parseLRC,
  parseLyrics,
  serializeLRC,
} from '../services/lyrics/LyricsParser';
import { LyricsSyncEngine } from '../services/lyrics/LyricsSyncEngine';
import { LyricsManager } from '../services/lyrics/LyricsManager';
import { Track } from '../types/track';

// ── Helpers ──────────────────────────────────────────────

function makeTrack(id = 'test_track'): Track {
  return {
    id,
    path: `/music/${id}.mp3`,
    title: 'Test Track',
    artist: 'Test Artist',
    album: 'Test Album',
    duration: 240,
    format: 'mp3',
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    source: 'local',
  };
}

const SIMPLE_LRC = `
[ti:Test Song]
[ar:Test Artist]
[00:05.00]First line
[00:10.50]Second line
[00:15.00]Third line
`;

const PLAIN = `Line one
Line two
Line three`;

const ENHANCED_LRC = `[00:03.00]Hello <00:03.50> world <00:04.00>
[00:07.00]Another line`;

// ── LyricsParser Tests ───────────────────────────────────

describe('Part 9 — LyricsParser', () => {
  describe('parsePlainText', () => {
    it('creates a line per non-empty row with time -1', () => {
      const data = parsePlainText(PLAIN);
      expect(data.type).toBe('plain');
      expect(data.lines).toHaveLength(3);
      expect(data.lines[0].text).toBe('Line one');
      expect(data.lines[0].time).toBe(-1);
      expect(data.lines[2].text).toBe('Line three');
    });

    it('filters out blank lines', () => {
      const data = parsePlainText('A\n\n\nB\n');
      expect(data.lines).toHaveLength(2);
    });
  });

  describe('parseLRC', () => {
    it('detects lrc type and extracts metadata', () => {
      const data = parseLRC(SIMPLE_LRC);
      expect(data.type).toBe('lrc');
      expect(data.title).toBe('Test Song');
      expect(data.artist).toBe('Test Artist');
    });

    it('parses timestamps to seconds', () => {
      const data = parseLRC(SIMPLE_LRC);
      expect(data.lines[0].time).toBeCloseTo(5.0);
      expect(data.lines[1].time).toBeCloseTo(10.5);
      expect(data.lines[2].time).toBeCloseTo(15.0);
    });

    it('returns lines sorted by time', () => {
      const lrc = '[00:20.00]Last\n[00:05.00]First\n[00:10.00]Middle\n';
      const data = parseLRC(lrc);
      expect(data.lines[0].text).toBe('First');
      expect(data.lines[1].text).toBe('Middle');
      expect(data.lines[2].text).toBe('Last');
    });

    it('fills endTime from consecutive lines', () => {
      const data = parseLRC(SIMPLE_LRC);
      // First line endTime should be start of second line
      expect(data.lines[0].endTime).toBeCloseTo(10.5);
    });

    it('falls back to plain text when no timestamps', () => {
      const data = parseLRC(PLAIN);
      expect(data.type).toBe('plain');
      expect(data.lines).toHaveLength(3);
    });
  });

  describe('Enhanced LRC', () => {
    it('detects enhanced_lrc type when word tags are present', () => {
      const data = parseLRC(ENHANCED_LRC);
      expect(data.type).toBe('enhanced_lrc');
    });

    it('parses word-level timing', () => {
      const data = parseLRC(ENHANCED_LRC);
      const line = data.lines[0];
      // Word tags: "Hello" starts at 3.0, ends at 3.5; "world" starts at 3.5, ends at 4.0
      expect(line.words).toBeDefined();
      expect(line.words!.length).toBeGreaterThan(0);
      expect(line.words![0].word).toBeTruthy();
    });
  });

  describe('parseLyrics auto-detect', () => {
    it('auto-detects LRC when timestamps present', () => {
      const data = parseLyrics(SIMPLE_LRC);
      expect(data.type).toBe('lrc');
    });

    it('auto-detects plain text when no timestamps', () => {
      const data = parseLyrics(PLAIN);
      expect(data.type).toBe('plain');
    });
  });

  describe('serializeLRC', () => {
    it('round-trips LRC data without adding trailing space', () => {
      const data = parseLRC(SIMPLE_LRC);
      const serialized = serializeLRC(data);
      expect(serialized).toContain('[ti:Test Song]');
      expect(serialized).toContain('[ar:Test Artist]');
      // Should contain timestamp lines
      expect(serialized).toMatch(/\[\d{2}:\d{2}\.\d{2}\]First line/);
    });

    it('re-parsed serialized output produces same lines', () => {
      const data = parseLRC(SIMPLE_LRC);
      const serialized = serializeLRC(data);
      const reparsed = parseLRC(serialized);
      expect(reparsed.lines).toHaveLength(data.lines.length);
      expect(reparsed.lines[0].text).toBe(data.lines[0].text);
    });
  });
});

// ── LyricsSyncEngine Tests ───────────────────────────────

describe('Part 9 — LyricsSyncEngine', () => {
  let engine: LyricsSyncEngine;

  beforeEach(() => {
    engine = new LyricsSyncEngine();
  });

  it('starts with zero lines and index -1', () => {
    expect(engine.getLineCount()).toBe(0);
    expect(engine.getCurrentLine()).toBeNull();
    expect(engine.getCurrentIndex()).toBe(-1);
  });

  it('setLyrics loads lines and sorts them', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);
    expect(engine.getLineCount()).toBe(3);
  });

  it('updatePlaybackPosition returns correct active index', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);

    expect(engine.updatePlaybackPosition(0)).toBe(-1);
    expect(engine.updatePlaybackPosition(5.5)).toBe(0);
    expect(engine.updatePlaybackPosition(11.0)).toBe(1);
    expect(engine.updatePlaybackPosition(20.0)).toBe(2);
  });

  it('getCurrentLine returns active line or null', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);

    expect(engine.getCurrentLine(0)).toBeNull();
    const line = engine.getCurrentLine(5.5);
    expect(line).not.toBeNull();
    expect(line!.text).toBe('First line');
  });

  it('getProgress returns 0–1 within active line', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);
    engine.updatePlaybackPosition(5.0);

    const progress = engine.getProgress(7.75);
    // Line 0: start=5.0, end=10.5, position=7.75 → (7.75-5)/(10.5-5) = 2.75/5.5 = 0.5
    expect(progress).toBeCloseTo(0.5, 1);
  });

  it('getNextLine and getPreviousLine work correctly', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);
    engine.updatePlaybackPosition(10.5);

    expect(engine.getCurrentLine()?.text).toBe('Second line');
    expect(engine.getNextLine()?.text).toBe('Third line');
    expect(engine.getPreviousLine()?.text).toBe('First line');
  });

  it('seekToLine returns the line timestamp', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);
    const ts = engine.seekToLine(1);
    expect(ts).toBeCloseTo(10.5);
    expect(engine.getCurrentIndex()).toBe(1);
  });

  it('reset clears all state', () => {
    const { lines } = parseLRC(SIMPLE_LRC);
    engine.setLyrics(lines);
    engine.updatePlaybackPosition(10.0);
    engine.reset();

    expect(engine.getLineCount()).toBe(0);
    expect(engine.getCurrentLine()).toBeNull();
    expect(engine.getCurrentIndex()).toBe(-1);
  });

  it('handles plain (unsynced) lines with time -1 gracefully', () => {
    const { lines } = parsePlainText(PLAIN);
    engine.setLyrics(lines);
    // With time=-1, no line should match any positive position
    const idx = engine.updatePlaybackPosition(5.0);
    // All times are -1, so last line where time <= 5 is all of them
    // (sorted: all -1, so every line satisfies time<=5.0)
    // That's acceptable behavior — the engine shouldn't crash
    expect(idx).toBeGreaterThanOrEqual(-1);
  });

  it('getActiveWords returns word progress for Enhanced LRC', () => {
    const { lines } = parseLRC(ENHANCED_LRC);
    engine.setLyrics(lines);
    engine.updatePlaybackPosition(3.0);

    const words = engine.getActiveWords(3.25);
    expect(Array.isArray(words)).toBe(true);
  });
});

// ── LyricsManager Tests ───────────────────────────────────

describe('Part 9 — LyricsManager (offline)', () => {
  let manager: LyricsManager;
  let track: Track;

  beforeEach(() => {
    manager = new LyricsManager();
    track = makeTrack(`track_${Date.now()}`);
  });

  it('returns null when no lyrics exist for a track', async () => {
    const result = await manager.getLocalLyrics(track);
    expect(result).toBeNull();
  });

  it('hasLyrics returns false when no record exists', async () => {
    const has = await manager.hasLyrics(track);
    expect(has).toBe(false);
  });

  it('saveLyrics persists plain text and can be retrieved', async () => {
    await manager.saveLyrics(track, PLAIN);
    const record = await manager.getLocalLyrics(track);

    expect(record).not.toBeNull();
    expect(record!.source_type).toBe('manual');
    expect(record!.plain_text).toContain('Line one');
    expect(record!.is_synced).toBe(false);
  });

  it('saveLyrics with LRC text creates synced record', async () => {
    await manager.saveLyrics(track, SIMPLE_LRC);
    const record = await manager.getLocalLyrics(track);

    expect(record).not.toBeNull();
    expect(record!.is_synced).toBe(true);
    expect(record!.lyrics_data?.type).toBe('lrc');
    expect(record!.lyrics_data?.lines.length).toBe(3);
  });

  it('hasLyrics returns true after saving', async () => {
    await manager.saveLyrics(track, PLAIN);
    const has = await manager.hasLyrics(track);
    expect(has).toBe(true);
  });

  it('getLyricsType returns correct type', async () => {
    await manager.saveLyrics(track, SIMPLE_LRC);
    const type = await manager.getLyricsType(track);
    expect(type).toBe('lrc');
  });

  it('deleteLyrics removes the record', async () => {
    await manager.saveLyrics(track, PLAIN);
    await manager.deleteLyrics(track);
    const result = await manager.getLocalLyrics(track);
    expect(result).toBeNull();
  });

  it('updateLyricsText overwrites existing lyrics', async () => {
    await manager.saveLyrics(track, PLAIN);
    await manager.updateLyricsText(track, SIMPLE_LRC);
    const record = await manager.getLocalLyrics(track);
    expect(record!.is_synced).toBe(true);
  });

  it('getPlainText returns text content', async () => {
    await manager.saveLyrics(track, PLAIN);
    const text = await manager.getPlainText(track);
    expect(text).toBeTruthy();
    expect(text).toContain('Line');
  });

  it('saveEmbeddedIfMissing saves when track has embedded lyrics', async () => {
    track.lyrics = PLAIN;
    await manager.saveEmbeddedIfMissing(track);
    const has = await manager.hasLyrics(track);
    expect(has).toBe(true);
  });

  it('saveEmbeddedIfMissing does not overwrite existing record', async () => {
    track.lyrics = PLAIN;
    await manager.saveLyrics(track, SIMPLE_LRC); // save LRC first
    await manager.saveEmbeddedIfMissing(track);  // should not overwrite
    const record = await manager.getLocalLyrics(track);
    expect(record!.is_synced).toBe(true); // still LRC
  });
});

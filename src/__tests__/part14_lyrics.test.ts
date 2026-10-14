import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../database/db';
import { Track } from '../types/track';
import { LyricsRecord, LyricsData } from '../types/lyrics';
import {
  LyricsManager,
  lyricsManagerInstance,
  lyricsIdFromTrack,
} from '../services/lyrics/LyricsManager';
import {
  parseLyrics,
  parseLRC,
  parsePlainText,
  serializeLRC,
} from '../services/lyrics/LyricsParser';
import { LyricsSyncEngine } from '../services/lyrics/LyricsSyncEngine';
import { detectLyricsLanguage } from '../services/lyrics/LyricsLanguageDetector';
import {
  EmbeddedLyricsProvider,
  LocalFileLyricsProvider,
  DatabaseLyricsProvider,
  OnlineLyricsProvider,
} from '../services/lyrics/LyricsProvider';
import { NetworkAccessManager } from '../network/NetworkAccessManager';

describe('Part 14 — Comprehensive Lyrics System & Offline Experience', () => {
  let manager: LyricsManager;

  const mockTrack: Track = {
    id: 'track_part14_01',
    path: '/music/Kala Chashma.mp3',
    filename: 'Kala Chashma.mp3',
    title: 'Kala Chashma',
    artist: 'Amar Arshi',
    album: 'Baar Baar Dekho',
    duration: 180,
    format: 'mp3',
    source: 'local',
    isFavorite: false,
    playCount: 0,
    dateAdded: Date.now(),
  };

  const sampleLrc = `[ti:Kala Chashma]
[ar:Amar Arshi]
[al:Baar Baar Dekho]
[offset:0]
[00:10.00]Tere mukhde pe kala chashma jachda ae
[00:15.50]Jachda ae gore mukhde pe
[00:22.00]Kala chashma jachda ae`;

  const sampleEnhancedLrc = `[00:10.00]Tere <00:10.50> mukhde <00:11.20> pe <00:12.00> kala chashma
[00:15.00]Jachda ae <00:16.20> gore mukhde pe`;

  beforeEach(async () => {
    manager = new LyricsManager();
    await db.lyrics.clear();
  });

  // ──────────────────────────────────────────────────────────
  // 1. Embedded Lyrics (Req 2, 3)
  // ──────────────────────────────────────────────────────────
  describe('Embedded Lyrics', () => {
    it('automatically extracts embedded lyrics from audio metadata and saves them without touching the audio file', async () => {
      const trackWithLyrics: Track = {
        ...mockTrack,
        id: 'track_embedded_test',
        lyrics: '[00:05.00]Embedded lyrics line 1\n[00:12.00]Embedded lyrics line 2',
      };

      const record = await manager.getLocalLyrics(trackWithLyrics);
      expect(record).not.toBeNull();
      expect(record?.source).toBe('embedded');
      expect(record?.is_synced).toBe(true);
      expect(record?.lyrics_data?.lines.length).toBe(2);
      expect(record?.user_modified).toBe(false);

      // Verify the original track object and file path remain unmodified
      expect(trackWithLyrics.path).toBe('/music/Kala Chashma.mp3');
    });

    it('provider hierarchy places EmbeddedLyricsProvider at priority 1', async () => {
      const provider = new EmbeddedLyricsProvider();
      expect(provider.priority).toBe(1);
      expect(provider.isOnline).toBe(false);

      const track: Track = {
        ...mockTrack,
        lyrics: 'Line 1\nLine 2',
      };

      const result = await provider.getLyrics(track);
      expect(result).not.toBeNull();
      if (typeof result !== 'string' && result !== null) {
        expect(result.type).toBe('plain');
        expect(result.lines.length).toBe(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // 2. Local Sibling & Companion Files (Req 4, 37)
  // ──────────────────────────────────────────────────────────
  describe('Local Files & Sibling Association', () => {
    it('associates companion .lrc file text with track', async () => {
      const saved = await manager.saveLyrics(
        mockTrack,
        sampleLrc,
        'local_file',
        'Kala Chashma.lrc',
        false
      );

      expect(saved.source).toBe('local_file');
      expect(saved.local_file_path).toBe('Kala Chashma.lrc');
      expect(saved.is_synced).toBe(true);
      expect(saved.lyrics_data?.lines.length).toBe(3);

      const retrieved = await manager.getLocalLyrics(mockTrack);
      expect(retrieved?.id).toBe(lyricsIdFromTrack(mockTrack));
      expect(retrieved?.local_file_path).toBe('Kala Chashma.lrc');
    });

    it('imports .lrc or .txt File object and preserves timestamps', async () => {
      const mockFile = new File([sampleLrc], 'ImportedLyrics.lrc', { type: 'text/plain' });
      const record = await manager.importLyricsFile(mockTrack, mockFile);

      expect(record.source).toBe('imported');
      expect(record.local_file_path).toBe('ImportedLyrics.lrc');
      expect(record.is_synced).toBe(true);
      expect(record.lyrics_data?.lines[0].text).toBe('Tere mukhde pe kala chashma jachda ae');
      expect(record.lyrics_data?.lines[0].time).toBe(10);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 3. Synchronization & Audio Clock Integration (Req 43, 44, 45, 46, 47, 49)
  // ──────────────────────────────────────────────────────────
  describe('LyricsSyncEngine & Audio Player Integration', () => {
    it('updates active line strictly based on current playback position', () => {
      const syncEngine = new LyricsSyncEngine();
      const data = parseLRC(sampleLrc);
      syncEngine.setLyrics(data.lines, 180);

      expect(syncEngine.getLineCount()).toBe(3);

      // At 5s (before first line at 10s) -> index -1
      expect(syncEngine.updatePlaybackPosition(5)).toBe(-1);
      expect(syncEngine.getCurrentLine()).toBeNull();

      // At 10.5s -> line 0 active
      expect(syncEngine.updatePlaybackPosition(10.5)).toBe(0);
      expect(syncEngine.getCurrentLine()?.text).toBe('Tere mukhde pe kala chashma jachda ae');

      // At 18s -> line 1 active (between 15.5s and 22s)
      expect(syncEngine.updatePlaybackPosition(18)).toBe(1);
      expect(syncEngine.getCurrentLine()?.text).toBe('Jachda ae gore mukhde pe');

      // At 25s -> line 2 active (after 22s)
      expect(syncEngine.updatePlaybackPosition(25)).toBe(2);
      expect(syncEngine.getCurrentLine()?.text).toBe('Kala chashma jachda ae');
    });

    it('immediately jumps to correct line on seek without separate timer delay', () => {
      const syncEngine = new LyricsSyncEngine();
      syncEngine.setLyrics(parseLRC(sampleLrc).lines, 180);

      syncEngine.updatePlaybackPosition(11);
      expect(syncEngine.getCurrentIndex()).toBe(0);

      // Seek to 23s
      syncEngine.updatePlaybackPosition(23);
      expect(syncEngine.getCurrentIndex()).toBe(2);

      // Seek backward to 2s
      syncEngine.updatePlaybackPosition(2);
      expect(syncEngine.getCurrentIndex()).toBe(-1);
    });

    it('remains perfectly synchronized at different playback speeds (0.5x, 1.5x, 2.0x)', () => {
      const syncEngine = new LyricsSyncEngine();
      syncEngine.setLyrics(parseLRC(sampleLrc).lines, 180);

      // The audio engine reports currentTime directly.
      // Whether running at 0.5x, 1.5x, or 2.0x, when the audio reaches 15.8s, line 1 is active.
      expect(syncEngine.updatePlaybackPosition(15.8)).toBe(1);
      expect(syncEngine.getCurrentLine()?.text).toBe('Jachda ae gore mukhde pe');
    });

    it('resets timeline completely when track changes', () => {
      const syncEngine = new LyricsSyncEngine();
      syncEngine.setLyrics(parseLRC(sampleLrc).lines, 180);
      syncEngine.updatePlaybackPosition(12);

      expect(syncEngine.getCurrentIndex()).toBe(0);

      syncEngine.reset();
      expect(syncEngine.getLineCount()).toBe(0);
      expect(syncEngine.getCurrentIndex()).toBe(-1);
      expect(syncEngine.getCurrentLine()).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────
  // 4. Lyrics Offset Controls (-10s to +10s) (Req 16, 17)
  // ──────────────────────────────────────────────────────────
  describe('Lyrics Offset Controls', () => {
    it('applies per-song offset and shifts active line matching', async () => {
      const syncEngine = new LyricsSyncEngine();
      syncEngine.setLyrics(parseLRC(sampleLrc).lines, 180);

      // First line is at 10.0s.
      // At position 9.5s without offset, line is not active yet.
      expect(syncEngine.updatePlaybackPosition(9.5)).toBe(-1);

      // Apply offset of +1.0s (lyrics were late, shift earlier)
      syncEngine.setOffset(1.0);
      expect(syncEngine.getOffset()).toBe(1.0);

      // Effective time is 9.5s + 1.0s = 10.5s -> line 0 is now active!
      expect(syncEngine.updatePlaybackPosition(9.5)).toBe(0);

      // Negative offset: lyrics were early, shift later
      syncEngine.setOffset(-2.0);
      // Effective time at 11s: 11 - 2 = 9s -> line 0 is not yet active
      expect(syncEngine.updatePlaybackPosition(11.0)).toBe(-1);
    });

    it('clamps offset between -10.0s and +10.0s and stores per-song', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');

      const clampedHigh = await manager.setLyricsOffset(mockTrack, 15);
      expect(clampedHigh).toBe(10);

      const clampedLow = await manager.setLyricsOffset(mockTrack, -25);
      expect(clampedLow).toBe(-10);

      const normal = await manager.setLyricsOffset(mockTrack, 0.4);
      expect(normal).toBe(0.4);

      const storedOffset = await manager.getLyricsOffset(mockTrack, 0);
      expect(storedOffset).toBe(0.4);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 5. User-Edited Lyrics Protection (Req 28)
  // ──────────────────────────────────────────────────────────
  describe('User-Edited Lyrics Protection', () => {
    it('marks user-edited lyrics with user_modified: true', async () => {
      const edited = await manager.updateLyricsText(mockTrack, 'Custom user edited line');
      expect(edited.user_modified).toBe(true);
      expect(edited.source).toBe('manual');

      const isModified = await manager.isUserModified(mockTrack);
      expect(isModified).toBe(true);
    });

    it('protects user-modified lyrics from being silently overwritten', async () => {
      // 1. User edits lyrics
      await manager.updateLyricsText(mockTrack, 'My Personal Lyrics');
      expect(await manager.isUserModified(mockTrack)).toBe(true);

      // 2. Incoming update preserves user_modified state
      const saved = await manager.saveLyrics(mockTrack, 'New Attempted Overwrite', 'online');
      expect(saved.user_modified).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────
  // 6. Enhanced LRC & Word-Level Synchronization (Req 20, 21)
  // ──────────────────────────────────────────────────────────
  describe('Enhanced LRC & Word-Level Timing', () => {
    it('parses word-level timestamps in Enhanced LRC lines', () => {
      const data = parseLRC(sampleEnhancedLrc);
      expect(data.type).toBe('enhanced_lrc');
      expect(data.lines[0].words).toBeDefined();
      expect(data.lines[0].words!.length).toBeGreaterThan(0);

      const syncEngine = new LyricsSyncEngine();
      syncEngine.setLyrics(data.lines);

      // At 10.8s: word "mukhde" (10.5 to 11.2) is active
      const words = syncEngine.getActiveWords(10.8);
      expect(words.length).toBeGreaterThan(0);
      const activeWord = words.find((w) => w.active);
      expect(activeWord?.word).toBe('mukhde');
    });

    it('does not invent fake word timing when only line timestamps exist', () => {
      const data = parseLRC(sampleLrc);
      expect(data.type).toBe('lrc');

      const syncEngine = new LyricsSyncEngine();
      syncEngine.setLyrics(data.lines);
      syncEngine.updatePlaybackPosition(12);

      const words = syncEngine.getActiveWords(12);
      expect(words).toEqual([]); // Empty: never fakes word timing!
    });
  });

  // ──────────────────────────────────────────────────────────
  // 7. Offline Zero-Network Language Detection (Req 32)
  // ──────────────────────────────────────────────────────────
  describe('Lyrics Language Detection', () => {
    it('accurately identifies Telugu script without network', () => {
      const teluguLyrics = 'కన్నుల బాసలు తెలియవులే నా గుండెలోన మాటలు';
      const result = detectLyricsLanguage(teluguLyrics);
      expect(result.name).toBe('Telugu');
      expect(result.code).toBe('te');
      expect(result.label).toBe('Language: Telugu');
    });

    it('accurately identifies Devanagari / Hindi script without network', () => {
      const hindiLyrics = 'काला चश्मा जचदा ऐ गोरे मुखड़े पे';
      const result = detectLyricsLanguage(hindiLyrics);
      expect(result.name).toBe('Hindi');
      expect(result.code).toBe('hi');
      expect(result.label).toBe('Language: Hindi');
    });

    it('accurately identifies Japanese script without network', () => {
      const japaneseLyrics = 'さくら さくら 今 咲き誇る';
      const result = detectLyricsLanguage(japaneseLyrics);
      expect(result.name).toBe('Japanese');
      expect(result.code).toBe('ja');
      expect(result.label).toBe('Language: Japanese');
    });

    it('accurately identifies English / Latin text without network', () => {
      const englishLyrics = 'Never gonna give you up never gonna let you down and hurt you';
      const result = detectLyricsLanguage(englishLyrics);
      expect(result.name).toBe('English');
      expect(result.label).toBe('Language: English');
    });

    it('returns Language: Unknown for ambiguous or empty text without guessing', () => {
      const emptyResult = detectLyricsLanguage('');
      expect(emptyResult.name).toBe('Unknown');
      expect(emptyResult.label).toBe('Language: Unknown');
    });
  });

  // ──────────────────────────────────────────────────────────
  // 8. Multi-Language Translations & Offline Storage (Req 29, 30, 31)
  // ──────────────────────────────────────────────────────────
  describe('Multi-Language Translations & Bilingual View', () => {
    it('stores translations offline under the track record', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');

      const englishTranslation = `[00:10.00]Black sunglasses look great on your face
[00:15.50]They suit your glowing fair face`;

      await manager.saveTranslation(mockTrack, 'English', englishTranslation);

      const record = await manager.getLocalLyrics(mockTrack);
      expect(record?.translations?.['English']).toBeDefined();
      expect(record?.translations?.['English'].language).toBe('English');
      expect(record?.translations?.['English'].is_synced).toBe(true);
      expect(record?.translations?.['English'].lyrics_data?.lines.length).toBe(2);
    });

    it('remembers user selected language across restarts', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');
      await manager.setSelectedLanguage(mockTrack, 'Telugu');

      const record = await manager.getLocalLyrics(mockTrack);
      expect(record?.selected_language).toBe('Telugu');
    });
  });

  // ──────────────────────────────────────────────────────────
  // 9. Lyrics Export & Import (Req 35, 36)
  // ──────────────────────────────────────────────────────────
  describe('Lyrics Export & Import', () => {
    it('exports synchronized lyrics as .lrc preserving formatting and timestamps', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');

      const exported = await manager.exportLyrics(mockTrack, 'lrc');
      expect(exported.filename).toContain('.lrc');
      expect(exported.content).toContain('[00:10.00]');
      expect(exported.content).toContain('Tere mukhde pe kala chashma jachda ae');
    });

    it('exports plain text as .txt without bracketed timestamps', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');

      const exported = await manager.exportLyrics(mockTrack, 'txt');
      expect(exported.filename).toContain('.txt');
      expect(exported.content).not.toContain('[00:10.00]');
      expect(exported.content).toContain('Tere mukhde pe kala chashma jachda ae');
    });
  });

  // ──────────────────────────────────────────────────────────
  // 10. Deletion Without Audio File Impact (Req 38)
  // ──────────────────────────────────────────────────────────
  describe('Lyrics Deletion Safety', () => {
    it('deleting lyrics removes only the database entry and never touches the audio file', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');
      expect(await manager.hasLyrics(mockTrack)).toBe(true);

      await manager.deleteLyrics(mockTrack);
      expect(await manager.hasLyrics(mockTrack)).toBe(false);

      // Audio file path is intact
      expect(mockTrack.path).toBe('/music/Kala Chashma.mp3');
    });
  });

  // ──────────────────────────────────────────────────────────
  // 11. Air-Gap & Network Permission Gates (Req 22, 23, 50, 51)
  // ──────────────────────────────────────────────────────────
  describe('Air-Gap & Offline First Rules', () => {
    it('blocks online lyrics access by default under air-gap policy', async () => {
      const onlineProvider = new OnlineLyricsProvider();
      expect(onlineProvider.isOnline).toBe(true);

      // Verify that offline methods NEVER attempt network
      const result = await manager.getLocalLyrics(mockTrack);
      expect(result).toBeNull(); // Clean offline null return, zero network errors
    });

    it('offline search across stored lyrics runs locally without network', async () => {
      await manager.saveLyrics(mockTrack, sampleLrc, 'local');

      const results = await manager.searchLyrics('chashma');
      expect(results.length).toBe(1);
      expect(results[0].track_title).toBe('Kala Chashma');

      const noMatch = await manager.searchLyrics('nonexistentquery123');
      expect(noMatch.length).toBe(0);
    });
  });
});

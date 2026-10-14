// ──────────────────────────────────────────────────────────
// LyricsManager — Part 14 Complete Offline Lyrics Manager
// Coordinates modular providers, stores offline lyrics,
// manages per-song offsets, multi-language translations,
// and protects user-edited lyrics from silent replacement.
// ──────────────────────────────────────────────────────────
import { db } from '../../database/db';
import {
  LyricsRecord,
  LyricsData,
  LyricsSource,
  LyricsTranslationRecord,
} from '../../types/lyrics';
import { Track } from '../../types/track';
import { parseLyrics, serializeLRC } from './LyricsParser';
import { detectLyricsLanguage } from './LyricsLanguageDetector';
import {
  embeddedLyricsProviderInstance,
  localFileLyricsProviderInstance,
  databaseLyricsProviderInstance,
  onlineLyricsProviderInstance,
} from './LyricsProvider';

/** Derive a deterministic record ID from a Track */
export function lyricsIdFromTrack(track: Track): string {
  return `lyrics_${track.id}`;
}

export class LyricsManager {
  // ── Offline read ────────────────────────────────────────

  /**
   * Load the local lyrics record for a track.
   * Priority hierarchy:
   * 1. Check local offline database (db.lyrics)
   * 2. Check embedded lyrics on the track object (ID3/Vorbis)
   * Never contacts the network automatically.
   */
  async getLocalLyrics(track: Track): Promise<LyricsRecord | null> {
    try {
      const id = lyricsIdFromTrack(track);
      const record = await db.lyrics.get(id);
      if (record) return record;

      // Check embedded lyrics fallback
      if (track.lyrics && track.lyrics.trim().length > 0) {
        return await this.saveLyrics(track, track.lyrics, 'embedded', undefined, false);
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check whether lyrics exist offline for a track.
   */
  async hasLyrics(track: Track): Promise<boolean> {
    const record = await this.getLocalLyrics(track);
    return record !== null;
  }

  /**
   * Get the type of stored lyrics ('plain' | 'lrc' | 'enhanced_lrc' | null).
   */
  async getLyricsType(track: Track): Promise<LyricsData['type'] | null> {
    const record = await this.getLocalLyrics(track);
    return record?.lyrics_data?.type ?? null;
  }

  /**
   * Check if the lyrics were modified by the user.
   */
  async isUserModified(track: Track): Promise<boolean> {
    const record = await this.getLocalLyrics(track);
    return !!record?.user_modified;
  }

  // ── Save ────────────────────────────────────────────────

  /**
   * Save or update lyrics for a track.
   * Preserves existing translations, creation date, and offsets unless specified.
   */
  async saveLyrics(
    track: Track,
    input: string | LyricsData,
    source: LyricsSource = 'manual',
    localFilePath?: string,
    userModified?: boolean
  ): Promise<LyricsRecord> {
    const id = lyricsIdFromTrack(track);
    const now = Date.now();

    let data: LyricsData;
    let lrcRaw: string | undefined;

    if (typeof input === 'string') {
      data = parseLyrics(input);
      lrcRaw = input;
    } else {
      data = input;
      if (data.type !== 'plain') {
        lrcRaw = serializeLRC(data);
      }
    }

    const plainText = data.lines.map((l) => l.text).join('\n');
    const detection = detectLyricsLanguage(plainText);

    // Check existing record to preserve metadata
    let existing: LyricsRecord | undefined;
    try {
      existing = await db.lyrics.get(id);
    } catch {
      /* ignore */
    }

    const isUserEdited = userModified !== undefined
      ? userModified
      : source === 'manual' ? true : (existing?.user_modified ?? false);

    const record: LyricsRecord = {
      id,
      song_id: track.id,
      track_source_type: track.source === 'local' ? 'local' : 'youtube',
      track_source_id: track.sourceId,
      lyrics_type: data.type,
      source,
      source_type: source === 'online' ? 'online' : source === 'manual' ? 'manual' : 'local',
      track_title: track.title,
      track_artist: track.artist,
      lyrics_data: data,
      plain_text: plainText,
      lrc_raw: lrcRaw,
      language: existing?.language || detection.name,
      detected_language: detection.name,
      translations: existing?.translations || {},
      selected_language: existing?.selected_language || 'original',
      offset: existing?.offset ?? 0,
      local_file_path: localFilePath || existing?.local_file_path,
      user_modified: isUserEdited,
      created_at: existing?.created_at || now,
      updated_at: now,
      is_synced: data.type !== 'plain' && data.lines.some((l) => l.time >= 0),
    };

    await db.lyrics.put(record);
    return record;
  }

  /**
   * Save embedded lyrics if no record currently exists.
   */
  async saveEmbeddedIfMissing(track: Track, embeddedText?: string): Promise<void> {
    const text = embeddedText || track.lyrics;
    if (!text) return;
    const existing = await db.lyrics.get(lyricsIdFromTrack(track));
    if (existing) return;
    await this.saveLyrics(track, text, 'embedded', undefined, false);
  }

  /**
   * Update lyrics text in-place (from lyrics editor). Marks as user-modified.
   */
  async updateLyricsText(track: Track, newText: string): Promise<LyricsRecord> {
    return this.saveLyrics(track, newText, 'manual', undefined, true);
  }

  // ── Offsets ─────────────────────────────────────────────

  /**
   * Update per-song lyrics offset (-10s to +10s).
   */
  async setLyricsOffset(track: Track, offset: number): Promise<number> {
    const clamped = Math.max(-10, Math.min(10, parseFloat(offset.toFixed(2))));
    const id = lyricsIdFromTrack(track);
    const existing = await db.lyrics.get(id);
    if (existing) {
      existing.offset = clamped;
      existing.updated_at = Date.now();
      await db.lyrics.put(existing);
    }
    return clamped;
  }

  /**
   * Get lyrics offset for a track, falling back to global offset.
   */
  async getLyricsOffset(track: Track, globalOffset = 0): Promise<number> {
    const record = await this.getLocalLyrics(track);
    if (record && record.offset !== undefined && !isNaN(record.offset)) {
      return record.offset;
    }
    return globalOffset;
  }

  // ── Translations & Languages ────────────────────────────

  /**
   * Save a translation for a specific language offline.
   */
  async saveTranslation(
    track: Track,
    language: string,
    input: string | LyricsData
  ): Promise<LyricsRecord | null> {
    const record = await this.getLocalLyrics(track);
    if (!record) return null;

    let transData: LyricsData | undefined;
    let plain: string | undefined;

    if (typeof input === 'string') {
      transData = parseLyrics(input);
      plain = input;
    } else {
      transData = input;
      plain = input.lines.map((l) => l.text).join('\n');
    }

    if (!record.translations) {
      record.translations = {};
    }

    record.translations[language] = {
      language,
      lyrics_data: transData,
      plain_text: plain,
      is_synced: transData.type !== 'plain',
      translated_at: Date.now(),
    };

    record.updated_at = Date.now();
    await db.lyrics.put(record);
    return record;
  }

  /**
   * Change selected language for this song (remembers across sessions).
   */
  async setSelectedLanguage(track: Track, language: string): Promise<void> {
    const id = lyricsIdFromTrack(track);
    const existing = await db.lyrics.get(id);
    if (existing) {
      existing.selected_language = language;
      existing.updated_at = Date.now();
      await db.lyrics.put(existing);
    }
  }

  // ── Import & Export ─────────────────────────────────────

  /**
   * Import a local lyric file (.lrc or .txt).
   */
  async importLyricsFile(track: Track, file: File): Promise<LyricsRecord> {
    const text = await file.text();
    return this.saveLyrics(track, text, 'imported', file.name, false);
  }

  /**
   * Prepare exported lyrics text and filename for user download.
   */
  async exportLyrics(
    track: Track,
    format?: 'lrc' | 'txt'
  ): Promise<{ content: string; filename: string; mimeType: string }> {
    const record = await this.getLocalLyrics(track);
    const safeTitle = `${track.artist} - ${track.title}`.replace(/[\/\\?%*:|"<>]/g, '_');

    if (!record) {
      return {
        content: '',
        filename: `${safeTitle}.txt`,
        mimeType: 'text/plain;charset=utf-8',
      };
    }

    // Determine target format
    const targetFormat = format || (record.is_synced ? 'lrc' : 'txt');

    if (targetFormat === 'lrc' && record.lyrics_data && record.is_synced) {
      const lrcContent = record.lrc_raw || serializeLRC(record.lyrics_data);
      return {
        content: lrcContent,
        filename: `${safeTitle}.lrc`,
        mimeType: 'application/octet-stream;charset=utf-8',
      };
    }

    // Plain text export
    const plainContent = record.plain_text || record.lyrics_data?.lines.map((l) => l.text).join('\n') || '';
    return {
      content: plainContent,
      filename: `${safeTitle}.txt`,
      mimeType: 'text/plain;charset=utf-8',
    };
  }

  // ── Delete ──────────────────────────────────────────────

  /**
   * Delete lyrics record for a track.
   * CRITICAL: Deletes ONLY the database lyrics entry; NEVER touches the audio file!
   */
  async deleteLyrics(track: Track): Promise<void> {
    try {
      const id = lyricsIdFromTrack(track);
      await db.lyrics.delete(id);
    } catch {
      /* ignore */
    }
  }

  // ── Search ──────────────────────────────────────────────

  /**
   * Search offline stored lyrics by title, artist, or lyric lines.
   */
  async searchLyrics(query: string): Promise<LyricsRecord[]> {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    try {
      const all = await db.lyrics.toArray();
      return all.filter(
        (r) =>
          r.track_title?.toLowerCase().includes(q) ||
          r.track_artist?.toLowerCase().includes(q) ||
          r.plain_text?.toLowerCase().includes(q)
      );
    } catch {
      return [];
    }
  }

  // ── Getters ─────────────────────────────────────────────

  /** Get plain text for a track (no timing info) */
  async getPlainText(track: Track): Promise<string | null> {
    const record = await this.getLocalLyrics(track);
    return record?.plain_text ?? null;
  }

  /** Get the parsed LyricsData for a track */
  async getLyricsData(track: Track): Promise<LyricsData | null> {
    const record = await this.getLocalLyrics(track);
    return record?.lyrics_data ?? null;
  }
}

// ── Singleton ────────────────────────────────────────────
export const lyricsManagerInstance = new LyricsManager();

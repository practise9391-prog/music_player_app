// ──────────────────────────────────────────────────────────
// Lyrics types — Part 14 Complete Lyrics System
// ──────────────────────────────────────────────────────────

/** A single timed word inside an Enhanced LRC line */
export interface LyricWord {
  word: string;
  startTime: number; // seconds
  endTime: number;   // seconds
}

/** A single lyric line (plain or synchronized) */
export interface LyricLine {
  time: number;       // start time in seconds (-1 for plain/unsynced)
  endTime?: number;   // optional end time in seconds
  text: string;
  words?: LyricWord[]; // word-level timing (Enhanced LRC)
  duration?: number;   // optional explicit duration in seconds
  translation?: string; // Optional translated text line
}

/** Full lyrics data stored for a track */
export interface LyricsData {
  type: 'plain' | 'lrc' | 'enhanced_lrc';
  lines: LyricLine[];
  /** LRC metadata tags */
  title?: string;
  artist?: string;
  album?: string;
  by?: string;       // author of the LRC file
  offset?: number;   // global time offset in milliseconds from LRC header
  rawText?: string;  // original source text
}

export type LyricsSource = 'embedded' | 'local_file' | 'imported' | 'online' | 'manual' | 'local';

export type LyricsTheme = 'player' | 'dark' | 'light' | 'album_art';

export type LyricsDisplayMode = 'original' | 'translation' | 'both';

export type LyricsFontSize = 'small' | 'medium' | 'large' | 'xlarge';

export type LyricsAlignment = 'left' | 'center';

export type LyricsLineSpacing = 'compact' | 'normal' | 'large';

/** Translation entry for multi-language support */
export interface LyricsTranslationRecord {
  language: string;
  lyrics_data?: LyricsData;
  plain_text?: string;
  is_synced?: boolean;
  translated_at?: number;
}

/** Stored record in the database */
export interface LyricsRecord {
  id: string;              // lyrics_<trackId>
  song_id: string;         // track id
  track_source_type?: 'local' | 'youtube';
  track_source_id?: string;
  lyrics_type?: 'plain' | 'lrc' | 'enhanced_lrc';
  source: LyricsSource;
  source_type?: 'local' | 'online' | 'manual'; // backward compatibility
  track_title?: string;
  track_artist?: string;
  lyrics_data?: LyricsData;
  plain_text?: string;     // fallback plain text without timing
  lrc_raw?: string;        // original LRC source if available
  language?: string;       // detected or user-defined language (e.g., 'English', 'Telugu')
  detected_language?: string;
  translations?: Record<string, LyricsTranslationRecord>;
  selected_language?: string;
  offset?: number;         // per-song lyrics offset in seconds (-10 to +10)
  local_file_path?: string;// sibling or imported file path/name
  user_modified?: boolean; // protects manual edits from being overwritten
  online_source_reference?: string;
  created_at: number;
  updated_at: number;
  is_synced: boolean;      // true if timing data is present
}

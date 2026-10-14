// ──────────────────────────────────────────────────────────
// LyricsParser — Part 9
// Parses plain text, LRC, and Enhanced LRC lyrics formats.
// Works entirely offline.
// ──────────────────────────────────────────────────────────
import { LyricLine, LyricWord, LyricsData } from '../../types/lyrics';

const TIMESTAMP_REGEX = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG_REGEX = /^\[(ti|ar|al|by|offset|length|re|ve):(.+?)\]$/i;
const WORD_TAG_REGEX = /<(\d{1,3}):(\d{2})\.(\d{2,3})>/g;

/**
 * Convert `mm:ss.cc` or `mm:ss:cc` components to seconds.
 */
function toSeconds(min: string, sec: string, centisec?: string): number {
  const m = parseInt(min, 10);
  const s = parseInt(sec, 10);
  let cs = 0;
  if (centisec) {
    // May be 2 or 3 digits; normalise to centiseconds
    const raw = parseInt(centisec, 10);
    cs = centisec.length === 3 ? raw / 1000 : raw / 100;
  }
  return m * 60 + s + cs;
}

/**
 * Parse Enhanced LRC word-timing tags from a line text.
 * e.g.  "Hello <01:02.50> world" → [{word:"Hello",startTime:x,endTime:y}, ...]
 */
function parseWordTimings(text: string, lineStartTime: number): LyricWord[] {
  const words: LyricWord[] = [];
  let cursor = 0;
  let pendingWord = '';
  let prevTime = lineStartTime;

  WORD_TAG_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = WORD_TAG_REGEX.exec(text)) !== null) {
    const tagStart = match.index;
    const tagEnd = tagStart + match[0].length;
    const currentTime = toSeconds(match[1], match[2], match[3]);

    // Collect text before this tag
    const fragment = text.slice(cursor, tagStart).trim();
    if (fragment) pendingWord += (pendingWord ? ' ' : '') + fragment;

    if (pendingWord) {
      words.push({ word: pendingWord, startTime: prevTime, endTime: currentTime });
      pendingWord = '';
    }

    prevTime = currentTime;
    cursor = tagEnd;
  }

  // Remaining text after last tag
  const remaining = text.slice(cursor).trim();
  if (remaining) {
    words.push({ word: remaining, startTime: prevTime, endTime: prevTime + 5 });
  }

  return words;
}

/** Strip all LRC timestamp tags and word-timing tags from text */
function stripTags(raw: string): string {
  return raw
    .replace(TIMESTAMP_REGEX, '')
    .replace(WORD_TAG_REGEX, '')
    .trim();
}

/**
 * Parse plain text lyrics (no timing information).
 */
export function parsePlainText(text: string): LyricsData {
  const lines: LyricLine[] = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((text) => ({ time: -1, text }));

  return { type: 'plain', lines, rawText: text };
}

/**
 * Parse LRC or Enhanced LRC lyrics.
 * Falls back to plain-text parsing if no timestamps are found.
 */
export function parseLRC(lrcText: string): LyricsData {
  const rawLines = lrcText.split('\n');

  const metaTitle: string[] = [];
  const metaArtist: string[] = [];
  const metaAlbum: string[] = [];
  const metaBy: string[] = [];
  let offset = 0;

  const lines: LyricLine[] = [];
  let hasTimestamps = false;
  let isEnhanced = false;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // ── Metadata tags ──────────────────────────────────────
    const metaMatch = trimmed.match(META_TAG_REGEX);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === 'ti') metaTitle.push(val);
      else if (key === 'ar') metaArtist.push(val);
      else if (key === 'al') metaAlbum.push(val);
      else if (key === 'by') metaBy.push(val);
      else if (key === 'offset') offset = parseInt(val, 10) || 0;
      continue;
    }

    // ── Timed lines ────────────────────────────────────────
    TIMESTAMP_REGEX.lastIndex = 0;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP_REGEX.exec(trimmed)) !== null) {
      timestamps.push(toSeconds(match[1], match[2], match[3]));
      hasTimestamps = true;
    }

    if (timestamps.length === 0) continue;

    // Strip all timestamp tags → remaining is the lyric text
    const textPart = trimmed.replace(TIMESTAMP_REGEX, '').trim();

    // Check for Enhanced LRC word tags
    const hasWordTags = WORD_TAG_REGEX.test(textPart);
    WORD_TAG_REGEX.lastIndex = 0;
    if (hasWordTags) isEnhanced = true;

    const cleanText = stripTags(textPart);

    // Each timestamp can refer to the same line (multiple cue points)
    for (const ts of timestamps) {
      const time = ts + offset / 1000;
      const words = hasWordTags ? parseWordTimings(textPart, time) : undefined;
      lines.push({ time, text: cleanText, words });
    }
  }

  // No timed lines found → treat as plain text
  if (!hasTimestamps) {
    return parsePlainText(lrcText);
  }

  // Sort by time ascending
  lines.sort((a, b) => a.time - b.time);

  // Fill in endTime from consecutive line start times
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].endTime) {
      lines[i].endTime = lines[i + 1].time;
    }
  }

  return {
    type: isEnhanced ? 'enhanced_lrc' : 'lrc',
    lines,
    title: metaTitle[0],
    artist: metaArtist[0],
    album: metaAlbum[0],
    by: metaBy[0],
    offset,
    rawText: lrcText,
  };
}

/**
 * Auto-detect format and parse.
 * If text contains `[mm:ss` patterns → LRC; otherwise plain.
 */
export function parseLyrics(text: string): LyricsData {
  if (/\[\d{1,3}:\d{2}/.test(text)) {
    return parseLRC(text);
  }
  return parsePlainText(text);
}

/**
 * Serialise a LyricsData object back to LRC text (for saving).
 */
export function serializeLRC(data: LyricsData): string {
  const meta: string[] = [];
  if (data.title) meta.push(`[ti:${data.title}]`);
  if (data.artist) meta.push(`[ar:${data.artist}]`);
  if (data.album) meta.push(`[al:${data.album}]`);
  if (data.by) meta.push(`[by:${data.by}]`);
  if (data.offset) meta.push(`[offset:${data.offset}]`);

  const lineStrings = data.lines
    .filter((l) => l.time >= 0)
    .map((l) => {
      const min = Math.floor(l.time / 60);
      const sec = l.time % 60;
      const cs = Math.round((sec % 1) * 100);
      const secInt = Math.floor(sec);
      const ts = `[${String(min).padStart(2, '0')}:${String(secInt).padStart(2, '0')}.${String(cs).padStart(2, '0')}]`;
      return `${ts}${l.text}`;
    });

  return [...meta, ...lineStrings].join('\n');
}


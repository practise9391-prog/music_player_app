// ──────────────────────────────────────────────────────────
// LyricsSyncEngine — Part 14
// Real-time synchronization engine between player playback position
// and lyric lines. No network calls. Purely computational.
// Supports offset, line highlights, word-level progress (Enhanced LRC),
// and seek timestamps.
// ──────────────────────────────────────────────────────────
import { LyricLine, LyricsData } from '../../types/lyrics';

export class LyricsSyncEngine {
  private lines: LyricLine[] = [];
  private currentIndex = -1;
  private offset = 0; // seconds (-10 to +10)

  /** Set playback offset in seconds (positive = lyrics earlier, negative = lyrics later) */
  setOffset(seconds: number): void {
    this.offset = isNaN(seconds) ? 0 : Math.max(-10, Math.min(10, seconds));
  }

  getOffset(): number {
    return this.offset;
  }

  /** Load lyrics data and preprocess end-times if not present */
  setLyrics(lines: LyricLine[], durationHint?: number): void {
    this.lines = [...lines];
    this.currentIndex = -1;

    // Ensure lines are sorted by time
    this.lines.sort((a, b) => a.time - b.time);

    // Fill missing endTime from consecutive line start times
    for (let i = 0; i < this.lines.length - 1; i++) {
      if (!this.lines[i].endTime && this.lines[i].time >= 0) {
        this.lines[i] = { ...this.lines[i], endTime: this.lines[i + 1].time };
      }
    }

    // Last line: use duration hint or +5 seconds
    const last = this.lines[this.lines.length - 1];
    if (last && !last.endTime) {
      const fallback = durationHint ?? last.time + 5;
      this.lines[this.lines.length - 1] = { ...last, endTime: fallback };
    }
  }

  /** Load from a full LyricsData object */
  setLyricsData(data: LyricsData, durationHint?: number): void {
    this.setLyrics(data.lines, durationHint);
  }

  /** Reset — call when the track changes */
  reset(): void {
    this.lines = [];
    this.currentIndex = -1;
    this.offset = 0;
  }

  /** Returns total number of loaded lines */
  getLineCount(): number {
    return this.lines.length;
  }

  /** Returns all lines */
  getLines(): LyricLine[] {
    return this.lines;
  }

  /**
   * Update the current playback position.
   * Applies lyrics offset before checking line timestamps.
   * @param position - playback position in seconds
   * @returns index of the currently active line, or -1
   */
  updatePlaybackPosition(position: number): number {
    if (this.lines.length === 0 || position < 0) {
      this.currentIndex = -1;
      return -1;
    }

    const effectiveTime = Math.max(0, position + this.offset);

    // Find the last line whose start time <= effectiveTime
    let idx = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (this.lines[i].time <= effectiveTime) {
        idx = i;
      } else {
        break;
      }
    }

    this.currentIndex = idx;
    return idx;
  }

  /**
   * Get the currently active line.
   * Optionally pass a position to auto-update first.
   */
  getCurrentLine(position?: number): LyricLine | null {
    if (position !== undefined) {
      this.updatePlaybackPosition(position);
    }
    if (this.currentIndex < 0 || this.currentIndex >= this.lines.length) {
      return null;
    }
    return this.lines[this.currentIndex];
  }

  /** Get the index of the currently active line */
  getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get progress (0–1) within the current line.
   * @param position - optional override position; defaults to using currentIndex's start time
   */
  getProgress(position?: number): number {
    const line = this.getCurrentLine();
    if (!line || line.time < 0) return 0;
    const pos = (position !== undefined ? position + this.offset : line.time);
    const start = line.time;
    const end = line.endTime ?? start + 5;
    if (end <= start) return 1;
    return Math.max(0, Math.min(1, (pos - start) / (end - start)));
  }

  /** Get the next line (if any) */
  getNextLine(): LyricLine | null {
    const next = this.currentIndex + 1;
    return next < this.lines.length ? this.lines[next] : null;
  }

  /** Get the previous line (if any) */
  getPreviousLine(): LyricLine | null {
    const prev = this.currentIndex - 1;
    return prev >= 0 ? this.lines[prev] : null;
  }

  /**
   * Seek to a specific line by index.
   * Returns the audio timestamp so the caller can seek the audio there.
   */
  seekToLine(index: number): number {
    if (index < 0 || index >= this.lines.length) return 0;
    this.currentIndex = index;
    // Calculate raw audio seek position accounting for offset
    return Math.max(0, this.lines[index].time - this.offset);
  }

  /**
   * Check if a line at the given index is currently active.
   */
  isLineActive(index: number): boolean {
    return index === this.currentIndex;
  }

  /**
   * Returns word-level progress inside the current line for karaoke highlighting.
   * Returns [] if no word timing is available.
   */
  getActiveWords(position: number): Array<{ word: string; active: boolean; progress: number }> {
    const line = this.getCurrentLine(position);
    if (!line?.words?.length) return [];

    const effectiveTime = Math.max(0, position + this.offset);

    return line.words.map((w) => {
      const done = effectiveTime >= w.endTime;
      const started = effectiveTime >= w.startTime;
      const progress = done ? 1 : started ? (effectiveTime - w.startTime) / (w.endTime - w.startTime) : 0;
      return { word: w.word, active: started && !done, progress };
    });
  }
}

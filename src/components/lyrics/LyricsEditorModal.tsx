// ──────────────────────────────────────────────────────────
// LyricsEditorModal — Part 14 Complete Lyrics & Sync Editor
// Features:
// - Timestamped LRC editing with line reordering (Up/Down)
// - Live Lyric Synchronization Wizard ("Start Syncing")
// - Plain text line editor
// - Import & Export (.lrc, .txt)
// - Timestamp precision mm:ss.xx
// - Protects user modifications
// ──────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Clock,
  Plus,
  Trash2,
  Download,
  Upload,
  FileText,
  AlignLeft,
  Check,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  Sparkles,
  RotateCcw,
  SkipForward,
  FastForward,
} from 'lucide-react';
import { Track } from '../../types/track';
import { lyricsManagerInstance } from '../../services/lyrics/LyricsManager';
import { usePlayer } from '../../player/PlayerContext';
import { notificationService } from '../../services/errorService';

interface LyricsEditorModalProps {
  isOpen: boolean;
  track: Track | null;
  onClose: () => void;
  onSaved?: () => void;
}

interface EditorLine {
  id: string;
  timeStr: string; // "00:12.40"
  timeSec: number;
  text: string;
}

export const LyricsEditorModal: React.FC<LyricsEditorModalProps> = ({
  isOpen,
  track,
  onClose,
  onSaved,
}) => {
  const { state, togglePlayPause, seek } = usePlayer();
  const [editorMode, setEditorMode] = useState<'lrc' | 'plain' | 'wizard'>('lrc');
  const [lines, setLines] = useState<EditorLine[]>([]);
  const [plainText, setPlainText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Live Sync Wizard State
  const [wizardLineIndex, setWizardLineIndex] = useState(0);
  const [isWizardActive, setIsWizardActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wizardContainerRef = useRef<HTMLDivElement>(null);

  // Format seconds to mm:ss.xx
  const formatTimeTag = (seconds: number): string => {
    const sPos = Math.max(0, seconds);
    const m = Math.floor(sPos / 60);
    const s = sPos % 60;
    const sec = Math.floor(s);
    const cs = Math.floor((s % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  };

  // Parse time mm:ss.xx to seconds
  const parseTimeTag = (str: string): number => {
    const clean = str.replace(/[\[\]]/g, '').trim();
    const parts = clean.split(':');
    if (parts.length < 2) return -1;
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(s)) return -1;
    return m * 60 + s;
  };

  // Load existing lyrics when opening modal
  useEffect(() => {
    if (!isOpen || !track) return;

    setIsLoading(true);
    lyricsManagerInstance.getLocalLyrics(track).then((record) => {
      setIsLoading(false);
      if (!record) {
        setLines([]);
        setPlainText('');
        setEditorMode('plain');
        return;
      }

      if (record.is_synced && record.lyrics_data?.lines) {
        setEditorMode('lrc');
        const editorLines: EditorLine[] = record.lyrics_data.lines.map((l, idx) => ({
          id: `line_${idx}_${Date.now()}`,
          timeStr: l.time >= 0 ? formatTimeTag(l.time) : '',
          timeSec: l.time,
          text: l.text,
        }));
        setLines(editorLines);
        setPlainText(record.plain_text || '');
      } else {
        setEditorMode('plain');
        setPlainText(record.plain_text || '');
        // Also populate lines so user can switch to LRC or wizard
        const plainLines: EditorLine[] = (record.plain_text || '')
          .split('\n')
          .filter((l) => l.trim())
          .map((text, idx) => ({
            id: `line_${idx}_${Date.now()}`,
            timeStr: '',
            timeSec: -1,
            text: text.trim(),
          }));
        setLines(plainLines);
      }
    });
  }, [isOpen, track?.id]);

  // Keyboard shortcut listener during Live Syncing Wizard
  useEffect(() => {
    if (!isOpen || editorMode !== 'wizard' || !isWizardActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handleWizardSyncCurrentLine();
      } else if (e.code === 'Enter') {
        e.preventDefault();
        handleWizardSyncCurrentLine();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editorMode, isWizardActive, wizardLineIndex, lines]);

  if (!isOpen || !track) return null;

  // ── Line Manipulation ───────────────────────────────────

  const handleInsertCurrentTimestamp = () => {
    const curTimeSec = state.currentTime;
    const curTimeStr = formatTimeTag(curTimeSec);

    const newLine: EditorLine = {
      id: `line_${Date.now()}_${Math.random()}`,
      timeStr: curTimeStr,
      timeSec: curTimeSec,
      text: '',
    };

    const newLines = [...lines, newLine].sort((a, b) => a.timeSec - b.timeSec);
    setLines(newLines);
  };

  const handleUpdateLine = (id: string, field: 'timeStr' | 'text', value: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === 'timeStr') {
          const sec = parseTimeTag(value);
          return { ...l, timeStr: value, timeSec: sec };
        }
        return { ...l, text: value };
      })
    );
  };

  const handleDeleteLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleMoveLine = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === lines.length - 1)
    ) {
      return;
    }
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...lines];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setLines(updated);
  };

  const handleClearTimestamps = () => {
    if (!window.confirm('Clear all line timestamps? Text will be kept.')) return;
    setLines((prev) => prev.map((l) => ({ ...l, timeStr: '', timeSec: -1 })));
  };

  // Convert plain text to lines
  const handleConvertPlainToLines = () => {
    const splitLines = plainText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((text, idx) => ({
        id: `line_${idx}_${Date.now()}`,
        timeStr: '',
        timeSec: -1,
        text,
      }));
    setLines(splitLines);
    setEditorMode('lrc');
  };

  // ── Live Syncing Wizard ─────────────────────────────────

  const handleStartSyncWizard = () => {
    // If lines is empty, try building from plainText
    if (lines.length === 0 && plainText.trim()) {
      const splitLines = plainText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((text, idx) => ({
          id: `line_${idx}_${Date.now()}`,
          timeStr: '',
          timeSec: -1,
          text,
        }));
      setLines(splitLines);
    }
    setWizardLineIndex(0);
    setIsWizardActive(true);
    setEditorMode('wizard');

    // Auto-start playback if paused
    if (state.status !== 'playing') {
      togglePlayPause();
    }
  };

  const handleWizardSyncCurrentLine = () => {
    if (wizardLineIndex >= lines.length) return;

    const stampSec = state.currentTime;
    const stampStr = formatTimeTag(stampSec);

    setLines((prev) =>
      prev.map((l, idx) =>
        idx === wizardLineIndex ? { ...l, timeSec: stampSec, timeStr: stampStr } : l
      )
    );

    // Advance to next line
    if (wizardLineIndex < lines.length - 1) {
      setWizardLineIndex((prev) => prev + 1);
    } else {
      setIsWizardActive(false);
      notificationService.success('Sync Complete', 'All lines synchronized! Click Save to apply.');
    }
  };

  const handleWizardPreviousLine = () => {
    if (wizardLineIndex > 0) {
      setWizardLineIndex((prev) => prev - 1);
    }
  };

  const handleWizardSkipLine = () => {
    if (wizardLineIndex < lines.length - 1) {
      setWizardLineIndex((prev) => prev + 1);
    }
  };

  // ── Save & Export ───────────────────────────────────────

  const handleSave = async () => {
    try {
      if (editorMode === 'plain') {
        await lyricsManagerInstance.saveLyrics(track, plainText, 'manual', undefined, true);
      } else {
        // Build LRC text from lines
        const lrcString = lines
          .map((l) => (l.timeSec >= 0 ? `[${l.timeStr}]${l.text}` : l.text))
          .join('\n');
        await lyricsManagerInstance.saveLyrics(track, lrcString, 'manual', undefined, true);
      }

      notificationService.success('Lyrics Saved', 'Local lyrics updated and protected.');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      notificationService.error('Save Failed', err.message || 'Could not save lyrics.');
    }
  };

  const handleExport = async (format: 'lrc' | 'txt') => {
    const { content, filename, mimeType } = await lyricsManagerInstance.exportLyrics(
      track,
      format
    );
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notificationService.success('Exported', `Lyrics saved as ${filename}`);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const record = await lyricsManagerInstance.importLyricsFile(track, file);
      if (record.is_synced && record.lyrics_data?.lines) {
        setEditorMode('lrc');
        setLines(
          record.lyrics_data.lines.map((l, idx) => ({
            id: `line_${idx}_${Date.now()}`,
            timeStr: l.time >= 0 ? formatTimeTag(l.time) : '',
            timeSec: l.time,
            text: l.text,
          }))
        );
      } else {
        setEditorMode('plain');
        setPlainText(record.plain_text || '');
      }
      notificationService.success('Lyrics imported successfully', `Loaded from ${file.name}`);
      if (onSaved) onSaved();
    } catch (err: any) {
      notificationService.error('Import Failed', err.message || 'Could not parse lyric file.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('Delete local lyrics for this track? Audio files will NOT be affected.')) {
      return;
    }
    try {
      await lyricsManagerInstance.deleteLyrics(track);
      notificationService.info('Lyrics Deleted', 'Lyric association removed without modifying audio files.');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      notificationService.error('Delete Failed', err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-secondary)]/50">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Lyrics Editor</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {track.title} &bull; {track.artist}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Selector Tabs */}
            <div className="flex items-center bg-[var(--surface-card)] p-1 rounded-xl border border-[var(--border)] text-xs font-semibold">
              <button
                onClick={() => setEditorMode('lrc')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  editorMode === 'lrc'
                    ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                Timed LRC
              </button>
              <button
                onClick={() => setEditorMode('wizard')}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                  editorMode === 'wizard'
                    ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                Live Sync
              </button>
              <button
                onClick={() => setEditorMode('plain')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  editorMode === 'plain'
                    ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                Plain Text
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Audio Playback Mini-Bar */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-black/20 border-b border-[var(--border)] text-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              className="w-7 h-7 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shadow-sm"
              title="Play / Pause Audio"
            >
              {state.status === 'playing' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>
            <div className="font-mono text-[var(--accent)] font-bold text-sm">
              {formatTimeTag(state.currentTime)}
            </div>
            <span className="text-[var(--text-muted)] text-[11px]">
              / {formatTimeTag(state.duration || 0)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {editorMode === 'lrc' && (
              <button
                onClick={handleInsertCurrentTimestamp}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all font-medium text-xs shadow-sm"
                title="Add a new line at current audio position"
              >
                <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Stamp Current Position</span>
              </button>
            )}

            {editorMode === 'plain' && (
              <button
                onClick={handleConvertPlainToLines}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] font-semibold text-xs shadow-sm"
              >
                <span>Convert to Timed Lines</span>
              </button>
            )}

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".lrc,.txt"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
              title="Import .lrc or .txt file"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleExport(editorMode === 'lrc' ? 'lrc' : 'txt')}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
              title="Export file (.lrc / .txt)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Mode 1: LIVE SYNC WIZARD */}
          {editorMode === 'wizard' && (
            <div ref={wizardContainerRef} className="space-y-6 max-w-xl mx-auto py-4 text-center">
              <div className="p-4 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 space-y-1">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-[var(--accent)] tracking-wider uppercase">
                  <Sparkles className="w-4 h-4" />
                  <span>Live Synchronization Wizard</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Play the track and press <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/20 font-mono text-[10px]">Space</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/20 font-mono text-[10px]">Sync Line</kbd> when each lyric line is sung.
                </p>
              </div>

              {/* Progress counter */}
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono">
                <span>Line {wizardLineIndex + 1} of {lines.length || 1}</span>
                <span>{Math.round(((wizardLineIndex + 1) / (lines.length || 1)) * 100)}% Complete</span>
              </div>

              {/* Stamped previous line */}
              {wizardLineIndex > 0 && (
                <div className="text-sm text-[var(--text-muted)] opacity-50 font-medium">
                  {lines[wizardLineIndex - 1]?.text}
                  <span className="ml-2 text-xs font-mono text-emerald-400">
                    [{lines[wizardLineIndex - 1]?.timeStr}]
                  </span>
                </div>
              )}

              {/* ACTIVE LINE HIGHLIGHT */}
              <div className="p-6 rounded-2xl bg-[var(--surface-secondary)] border-2 border-[var(--accent)] shadow-xl space-y-3">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--accent)]">
                  CURRENT LINE TO SYNC
                </span>
                <p className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] leading-relaxed">
                  {lines[wizardLineIndex]?.text || 'No text in this line'}
                </p>
                {lines[wizardLineIndex]?.timeStr && (
                  <p className="text-xs font-mono text-emerald-400 font-semibold">
                    Current stamp: [{lines[wizardLineIndex].timeStr}]
                  </p>
                )}
              </div>

              {/* Upcoming line preview */}
              {wizardLineIndex < lines.length - 1 && (
                <div className="text-sm text-[var(--text-secondary)] font-medium opacity-60">
                  Next: {lines[wizardLineIndex + 1]?.text}
                </div>
              )}

              {/* Sync Actions Bar */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={handleWizardPreviousLine}
                  disabled={wizardLineIndex === 0}
                  className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white disabled:opacity-30"
                >
                  Previous Line
                </button>

                <button
                  onClick={handleWizardSyncCurrentLine}
                  className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold bg-[var(--accent)] text-[var(--btn-text)] shadow-lg hover:opacity-90 active:scale-95 transition-all"
                >
                  <Clock className="w-4 h-4" />
                  <span>Sync Line ({formatTimeTag(state.currentTime)})</span>
                </button>

                <button
                  onClick={handleWizardSkipLine}
                  disabled={wizardLineIndex >= lines.length - 1}
                  className="px-3 py-2 rounded-xl border border-[var(--border)] text-xs text-[var(--text-secondary)] hover:text-white disabled:opacity-30"
                >
                  Skip Line
                </button>
              </div>
            </div>
          )}

          {/* Mode 2: TIMED LRC LIST */}
          {editorMode === 'lrc' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-[var(--text-secondary)]">
                  {lines.length} Timestamped Lines
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartSyncWizard}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] hover:bg-[var(--accent)]/25 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Start Syncing Wizard</span>
                  </button>
                  <button
                    onClick={handleClearTimestamps}
                    className="text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                  >
                    Clear Timestamps
                  </button>
                </div>
              </div>

              {lines.map((l, index) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] group hover:border-[var(--border-strong)] transition-colors"
                >
                  {/* Reorder Buttons (Req 13) */}
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleMoveLine(index, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-[var(--text-muted)] hover:text-white disabled:opacity-20 transition-colors"
                      title="Move line up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveLine(index, 'down')}
                      disabled={index === lines.length - 1}
                      className="p-0.5 text-[var(--text-muted)] hover:text-white disabled:opacity-20 transition-colors"
                      title="Move line down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Timestamp Input */}
                  <input
                    type="text"
                    value={l.timeStr}
                    placeholder="00:00.00"
                    onChange={(e) => handleUpdateLine(l.id, 'timeStr', e.target.value)}
                    className="w-24 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] font-mono text-xs text-[var(--accent)] text-center focus:outline-none focus:border-[var(--accent)]"
                  />

                  {/* Lyric Text Input */}
                  <input
                    type="text"
                    value={l.text}
                    placeholder="Lyric line text…"
                    onChange={(e) => handleUpdateLine(l.id, 'text', e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                  />

                  {/* Stamp button */}
                  <button
                    onClick={() => handleUpdateLine(l.id, 'timeStr', formatTimeTag(state.currentTime))}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-card)] transition-colors"
                    title="Stamp current player time onto this line"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteLine(l.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete line"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  const newLine: EditorLine = {
                    id: `line_${Date.now()}_${Math.random()}`,
                    timeStr: '',
                    timeSec: -1,
                    text: '',
                  };
                  setLines([...lines, newLine]);
                }}
                className="w-full py-2.5 rounded-xl border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Lyric Line</span>
              </button>
            </div>
          )}

          {/* Mode 3: PLAIN TEXT EDITOR */}
          {editorMode === 'plain' && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Plain Text Lyrics (One line per row)
              </label>
              <textarea
                value={plainText}
                onChange={(e) => setPlainText(e.target.value)}
                placeholder="Paste or write song lyrics here line by line…"
                rows={14}
                className="w-full p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] font-sans leading-relaxed focus:outline-none focus:border-[var(--accent)] resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface-secondary)]/40">
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Lyrics</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-[var(--btn-text)] hover:opacity-90 active:scale-95 transition-all shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

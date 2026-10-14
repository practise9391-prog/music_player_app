// ──────────────────────────────────────────────────────────
// LyricsView — Part 14 Complete Synchronized Lyrics Experience
// Features:
// - Real-time line highlighting & smooth auto-scrolling
// - Manual scroll detection + floating "Jump to Current Line" button
// - Enhanced LRC word-level karaoke synchronization
// - Karaoke Mode toggle (clean singing stage)
// - Per-song lyrics offset (-10s to +10s) with 1-click step buttons
// - Bilingual translation display (Original / Translation / Both)
// - Local language detection label (Telugu, Hindi, English, etc.)
// - Themes: Player Theme, Dark, Light, Album Art
// - Copy line / Copy all / Share / Export / Import
// - Offline-first: zero network requests unless explicitly initiated
// ──────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Music2,
  FileText,
  Clock,
  Globe,
  Edit3,
  Maximize2,
  CheckCircle,
  RefreshCw,
  ArrowDownCircle,
  Mic2,
  Sliders,
  Copy,
  Share2,
  Download,
  Upload,
  Settings2,
  Shield,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { Track } from '../../types/track';
import {
  LyricLine,
  LyricsRecord,
  LyricsTheme,
  LyricsDisplayMode,
  LyricsFontSize,
  LyricsAlignment,
} from '../../types/lyrics';
import { lyricsManagerInstance } from '../../services/lyrics/LyricsManager';
import { LyricsSyncEngine } from '../../services/lyrics/LyricsSyncEngine';
import { onlineLyricsProviderInstance } from '../../services/lyrics/LyricsProvider';
import { useSettings } from '../../settings/SettingsContext';
import { notificationService } from '../../services/errorService';
import { OnlineLyricsConfirmModal } from './OnlineLyricsConfirmModal';
import { LyricsEditorModal } from './LyricsEditorModal';
import { FullscreenLyricsModal } from './FullscreenLyricsModal';
import { LyricsReplaceConfirmModal } from './LyricsReplaceConfirmModal';

interface LyricsViewProps {
  track: Track | null;
  currentAudioPosition: number;
  onSeek?: (position: number) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({
  track,
  currentAudioPosition,
  onSeek,
}) => {
  const { settings, updateSettings } = useSettings();
  const [currentRecord, setCurrentRecord] = useState<LyricsRecord | null>(null);
  const [lines, setLines] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [hasLyrics, setHasLyrics] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // User scrolling & Jump to current line
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Offset state
  const [songOffset, setSongOffset] = useState(0);

  // Display customizations
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [displayMode, setDisplayMode] = useState<LyricsDisplayMode>('original');
  const [fontSize, setFontSize] = useState<LyricsFontSize>('medium');
  const [alignment, setAlignment] = useState<LyricsAlignment>('center');
  const [lyricsTheme, setLyricsTheme] = useState<LyricsTheme>('player');
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Modals state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
  const [isFullscreenModalOpen, setIsFullscreenModalOpen] = useState(false);
  const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
  const [pendingOnlineResult, setPendingOnlineResult] = useState<any>(null);

  const syncEngineRef = useRef(new LyricsSyncEngine());
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reload lyrics for current track
  const reloadLyrics = useCallback(() => {
    if (!track) {
      setLines([]);
      setHasLyrics(false);
      setIsSynced(false);
      setActiveIndex(-1);
      setCurrentRecord(null);
      syncEngineRef.current.reset();
      return;
    }

    setIsLoading(true);

    lyricsManagerInstance.getLocalLyrics(track).then((record) => {
      setIsLoading(false);
      if (!record) {
        setHasLyrics(false);
        setLines([]);
        setCurrentRecord(null);
        syncEngineRef.current.reset();
        return;
      }

      setCurrentRecord(record);
      setHasLyrics(true);
      const effOffset = record.offset ?? settings.lyricsGlobalOffset ?? 0;
      setSongOffset(effOffset);
      syncEngineRef.current.setOffset(effOffset);

      if (record.lyrics_data?.lines && record.lyrics_data.lines.length > 0) {
        syncEngineRef.current.setLyrics(record.lyrics_data.lines, track.duration);
        setLines(syncEngineRef.current.getLines());
        setIsSynced(record.is_synced);
      } else if (record.plain_text) {
        const plainLines: LyricLine[] = record.plain_text
          .split('\n')
          .filter((l) => l.trim())
          .map((text) => ({ time: -1, text }));
        syncEngineRef.current.setLyrics(plainLines);
        setLines(plainLines);
        setIsSynced(false);
      }
    });
  }, [track?.id, settings.lyricsGlobalOffset]);

  useEffect(() => {
    reloadLyrics();
  }, [reloadLyrics]);

  // Update active line from current audio position
  useEffect(() => {
    if (!isSynced || lines.length === 0) return;

    const idx = syncEngineRef.current.updatePlaybackPosition(currentAudioPosition);
    if (idx !== activeIndex) {
      setActiveIndex(idx);

      // Smooth auto-scroll only when user is not manually scrolling
      if (!isUserScrolling && idx >= 0 && lineRefs.current[idx] && containerRef.current) {
        const el = lineRefs.current[idx]!;
        const container = containerRef.current;
        container.scrollTo({
          top: el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [currentAudioPosition, isSynced, lines.length, activeIndex, isUserScrolling]);

  // Handle manual scroll detection (Req 7, 8)
  const handleContainerScroll = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    // Resume auto-scroll after 4s idle
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4000);
  };

  const jumpToCurrentLine = () => {
    setIsUserScrolling(false);
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    if (activeIndex >= 0 && lineRefs.current[activeIndex] && containerRef.current) {
      const el = lineRefs.current[activeIndex]!;
      const container = containerRef.current;
      container.scrollTo({
        top: el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2,
        behavior: 'smooth',
      });
    }
  };

  // Adjust offset
  const handleOffsetChange = async (delta: number, reset = false) => {
    if (!track) return;
    const newOffset = reset ? 0 : parseFloat((songOffset + delta).toFixed(2));
    const clamped = await lyricsManagerInstance.setLyricsOffset(track, newOffset);
    setSongOffset(clamped);
    syncEngineRef.current.setOffset(clamped);
    notificationService.info('Lyrics Offset', `${clamped > 0 ? '+' : ''}${clamped}s`);
  };

  // Online search flow with protected user edit confirmation (Req 28)
  const executeOnlineSearch = async () => {
    if (!track) return;
    setIsSearchingOnline(true);
    try {
      const result = await onlineLyricsProviderInstance.getLyrics(track);
      if (result) {
        const isUserModified = await lyricsManagerInstance.isUserModified(track);
        if (isUserModified) {
          setPendingOnlineResult(result);
          setIsReplaceModalOpen(true);
        } else {
          await lyricsManagerInstance.saveLyrics(track, result, 'online');
          notificationService.success('Lyrics Found', 'Online lyrics saved to offline library.');
          reloadLyrics();
        }
      } else {
        notificationService.info(
          'Not Found',
          'No online lyrics found for this track on LRCLIB.'
        );
      }
    } catch (err: any) {
      notificationService.error('Search Failed', err.message || 'Error fetching online lyrics.');
    } finally {
      setIsSearchingOnline(false);
      setIsConfirmModalOpen(false);
    }
  };

  const handleOnlineSearchClick = () => {
    if (settings.askBeforeOnlineLyricsSearch) {
      setIsConfirmModalOpen(true);
    } else {
      executeOnlineSearch();
    }
  };

  // Copy & Share & Export Actions
  const handleCopyCurrentLine = () => {
    const cur = syncEngineRef.current.getCurrentLine();
    if (cur?.text) {
      navigator.clipboard.writeText(cur.text);
      notificationService.success('Copied', 'Current lyric line copied to clipboard.');
    }
  };

  const handleCopyAllLyrics = () => {
    const text = lines.map((l) => l.text).join('\n');
    if (text) {
      navigator.clipboard.writeText(text);
      notificationService.success('Copied', 'All lyrics copied to clipboard.');
    }
  };

  const handleShareLyrics = async () => {
    const text = lines.map((l) => l.text).join('\n');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${track?.title} Lyrics`,
          text: `${track?.title} - ${track?.artist}\n\n${text}`,
        });
      } catch {
        /* user cancelled share */
      }
    } else {
      handleCopyAllLyrics();
    }
  };

  const handleExportFile = async (format: 'lrc' | 'txt') => {
    if (!track) return;
    const { content, filename, mimeType } = await lyricsManagerInstance.exportLyrics(track, format);
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
    if (!file || !track) return;
    try {
      await lyricsManagerInstance.importLyricsFile(track, file);
      notificationService.success('Lyrics imported successfully', `Loaded from ${file.name}`);
      reloadLyrics();
    } catch (err: any) {
      notificationService.error('Import Failed', err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Typography sizing helpers
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-xl';
      case 'xlarge':
        return 'text-2xl';
      default:
        return 'text-base';
    }
  };

  const getThemeClass = () => {
    switch (lyricsTheme) {
      case 'dark':
        return 'bg-zinc-950 text-zinc-100';
      case 'light':
        return 'bg-zinc-50 text-zinc-900 border border-zinc-200';
      case 'album_art':
        return 'bg-black/60 backdrop-blur-xl text-white';
      default:
        return 'bg-transparent text-[var(--text-primary)]';
    }
  };

  // Source badge label (Req 38)
  const getSourceBadge = () => {
    if (!currentRecord) return 'Not available';
    if (currentRecord.user_modified) return 'User Edited';
    switch (currentRecord.source) {
      case 'embedded':
        return 'Embedded (ID3)';
      case 'local_file':
        return 'Local File (.lrc)';
      case 'imported':
        return 'Imported';
      case 'online':
        return 'Saved Online';
      default:
        return 'Local Lyrics';
    }
  };

  // ── Render States ───────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
        <FileText className="w-8 h-8 animate-pulse text-[var(--accent)]" />
        <span className="text-sm">Loading offline lyrics…</span>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--text-muted)]">
        <Music2 className="w-8 h-8 opacity-40" />
        <span className="text-sm">No track playing</span>
      </div>
    );
  }

  if (!hasLyrics) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <FileText className="w-12 h-12 opacity-30 text-[var(--text-muted)]" />
        <div className="space-y-1">
          <span className="text-base font-bold text-[var(--text-primary)]">
            No lyrics available
          </span>
          <p className="text-xs max-w-sm text-[var(--text-secondary)]">
            Offline-first player. You can import a local .lrc file, add lyrics manually, or search online.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {settings.searchOnlineLyricsEnabled && (
            <button
              onClick={handleOnlineSearchClick}
              disabled={isSearchingOnline}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] text-[var(--btn-text)] hover:opacity-90 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {isSearchingOnline ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <span>{isSearchingOnline ? 'Searching…' : 'Search Lyrics'}</span>
            </button>
          )}

          <button
            onClick={() => setIsEditorModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-white transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Add Lyrics</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".lrc,.txt"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-white transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Lyrics</span>
          </button>

          <button
            onClick={reloadLyrics}
            className="p-2 rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:text-white transition-colors"
            title="Try Again"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <OnlineLyricsConfirmModal
          isOpen={isConfirmModalOpen}
          track={track}
          onConfirm={executeOnlineSearch}
          onClose={() => setIsConfirmModalOpen(false)}
        />

        <LyricsEditorModal
          isOpen={isEditorModalOpen}
          track={track}
          onClose={() => setIsEditorModalOpen(false)}
          onSaved={reloadLyrics}
        />
      </div>
    );
  }

  return (
    <div className={`relative h-full flex flex-col rounded-2xl overflow-hidden transition-colors ${getThemeClass()}`}>
      {/* Background artwork blur if Album Art theme is active */}
      {lyricsTheme === 'album_art' && track.coverArtUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-25 blur-2xl pointer-events-none -z-10 transform scale-110"
          style={{ backgroundImage: `url(${track.coverArtUrl})` }}
        />
      )}

      {/* Top Toolbar (Collapses in Karaoke Mode for clean singing experience) */}
      {!karaokeMode && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]/40 text-xs">
          {/* Status & Language Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
              <CheckCircle className="w-3 h-3" />
              {getSourceBadge()}
            </span>

            {isSynced ? (
              <span className="flex items-center gap-1 text-[var(--accent)] font-semibold bg-[var(--accent)]/10 px-2 py-0.5 rounded-full border border-[var(--accent)]/20 text-[11px]">
                <Clock className="w-3 h-3" />
                Synced {songOffset !== 0 ? `(${songOffset > 0 ? '+' : ''}${songOffset}s)` : ''}
              </span>
            ) : (
              <span className="text-[var(--text-muted)] text-[11px] bg-black/20 px-2 py-0.5 rounded-full">
                Lyrics are not synchronized
              </span>
            )}

            {currentRecord?.detected_language && (
              <span className="text-[11px] text-[var(--text-secondary)] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                {`Language: ${currentRecord.detected_language}`}
              </span>
            )}
          </div>

          {/* Action Icons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setKaraokeMode(!karaokeMode)}
              className={`p-1.5 rounded-lg transition-colors ${
                karaokeMode
                  ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                  : 'text-[var(--text-muted)] hover:text-white hover:bg-white/10'
              }`}
              title="Toggle Karaoke Mode"
            >
              <Mic2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className={`p-1.5 rounded-lg transition-colors ${
                showSettingsPanel
                  ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                  : 'text-[var(--text-muted)] hover:text-white hover:bg-white/10'
              }`}
              title="Lyrics Display Settings"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {settings.searchOnlineLyricsEnabled && (
              <button
                onClick={handleOnlineSearchClick}
                disabled={isSearchingOnline}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
                title="Search Online Lyrics"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSearchingOnline ? 'animate-spin' : ''}`} />
              </button>
            )}

            <button
              onClick={() => setIsEditorModalOpen(true)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
              title="Edit Lyrics"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setIsFullscreenModalOpen(true)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-colors"
              title="Fullscreen Lyrics"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Settings / Offset Panel (Expandable) */}
      {showSettingsPanel && !karaokeMode && (
        <div className="px-4 py-3 bg-black/40 border-b border-[var(--border)]/40 text-xs space-y-3 animate-fade-in">
          {/* Offset Controls (Req 16) */}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[var(--text-secondary)]">Lyrics Offset:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleOffsetChange(-0.5)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-mono"
              >
                -0.5s
              </button>
              <button
                onClick={() => handleOffsetChange(-0.1)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-mono"
              >
                -0.1s
              </button>
              <span className="font-mono px-2 text-[var(--accent)] font-bold">
                {songOffset > 0 ? `+${songOffset}` : songOffset}s
              </span>
              <button
                onClick={() => handleOffsetChange(0.1)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-mono"
              >
                +0.1s
              </button>
              <button
                onClick={() => handleOffsetChange(0.5)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 font-mono"
              >
                +0.5s
              </button>
              <button
                onClick={() => handleOffsetChange(0, true)}
                className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--text-muted)]"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Theme, Sizing & Copy Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Theme:</span>
              <select
                value={lyricsTheme}
                onChange={(e) => setLyricsTheme(e.target.value as LyricsTheme)}
                className="bg-[var(--surface-card)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text-primary)]"
              >
                <option value="player">Player Theme</option>
                <option value="dark">Dark Lyrics</option>
                <option value="light">Light Lyrics</option>
                <option value="album_art">Album Artwork</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Size:</span>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as LyricsFontSize)}
                className="bg-[var(--surface-card)] border border-[var(--border)] rounded px-2 py-0.5 text-xs text-[var(--text-primary)]"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
                <option value="xlarge">Extra Large</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={handleCopyCurrentLine}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px]"
                title="Copy current lyric line"
              >
                <Copy className="w-3 h-3" />
                <span>Copy Line</span>
              </button>
              <button
                onClick={handleCopyAllLyrics}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px]"
                title="Copy all lyrics"
              >
                <span>Copy All</span>
              </button>
              <button
                onClick={handleShareLyrics}
                className="p-1 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-[11px]"
                title="Share Lyrics"
              >
                <Share2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Karaoke Mode Floating Exit Button */}
      {karaokeMode && (
        <div className="absolute top-3 right-3 z-20">
          <button
            onClick={() => setKaraokeMode(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-xs font-semibold text-white hover:bg-black/80 transition-all shadow-lg"
          >
            <Mic2 className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Exit Karaoke</span>
          </button>
        </div>
      )}

      {/* Floating "Jump to Current Line" Button (Req 8) */}
      {isUserScrolling && isSynced && activeIndex >= 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 animate-bounce">
          <button
            onClick={jumpToCurrentLine}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold shadow-2xl hover:opacity-90 active:scale-95 transition-all"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Jump to Current Line</span>
          </button>
        </div>
      )}

      {/* Main Lyrics Scroll Container */}
      <div
        ref={containerRef}
        onScroll={handleContainerScroll}
        className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-[var(--border)] scrollbar-track-transparent px-4 py-2 select-text"
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)',
        }}
      >
        <div className="h-20" />

        {lines.map((line, i) => {
          const isActive = isSynced && i === activeIndex;
          const isPast = isSynced && i < activeIndex;
          const isClickable = isSynced && line.time >= 0 && !!onSeek;
          const words = isActive ? syncEngineRef.current.getActiveWords(currentAudioPosition) : [];

          return (
            <button
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              onClick={() => {
                if (isClickable && onSeek) {
                  onSeek(line.time);
                }
              }}
              disabled={!isClickable}
              className={`w-full ${alignment === 'left' ? 'text-left' : 'text-center'} px-4 py-2.5 rounded-2xl transition-all duration-300 leading-relaxed ${
                isActive
                  ? `text-[var(--accent)] font-extrabold scale-105 bg-[var(--accent)]/10 shadow-sm ${
                      karaokeMode ? 'text-2xl md:text-3xl' : 'text-xl'
                    }`
                  : isPast
                  ? 'text-[var(--text-muted)] text-sm opacity-40 font-normal'
                  : 'text-[var(--text-primary)] text-sm font-medium opacity-80'
              } ${getFontSizeClass()} ${
                isClickable
                  ? 'cursor-pointer hover:text-[var(--accent)]/80 hover:opacity-100'
                  : 'cursor-default'
              }`}
            >
              {/* Word-level Enhanced LRC Karaoke highlighting (Req 21) */}
              {isActive && words.length > 0 ? (
                <span className="inline-flex flex-wrap items-center justify-center gap-1.5">
                  {words.map((w, wIdx) => (
                    <span
                      key={wIdx}
                      className={`transition-colors duration-150 ${
                        w.active
                          ? 'text-white underline decoration-[var(--accent)] decoration-2'
                          : w.progress === 1
                          ? 'text-[var(--accent)]'
                          : 'opacity-50'
                      }`}
                    >
                      {w.word}
                    </span>
                  ))}
                </span>
              ) : (
                <span>{line.text || '♪'}</span>
              )}

              {/* Translation line below if bilingual display enabled (Req 31) */}
              {displayMode === 'both' && line.translation && (
                <div className="text-xs font-normal text-[var(--text-secondary)] opacity-70 mt-1">
                  {line.translation}
                </div>
              )}
            </button>
          );
        })}

        <div className="h-20" />
      </div>

      {/* Online Search Confirmation Modal */}
      <OnlineLyricsConfirmModal
        isOpen={isConfirmModalOpen}
        track={track}
        onConfirm={executeOnlineSearch}
        onClose={() => setIsConfirmModalOpen(false)}
      />

      {/* User-Edited Lyrics Replace Confirmation Modal (Req 28) */}
      <LyricsReplaceConfirmModal
        isOpen={isReplaceModalOpen}
        track={track}
        onReplace={async () => {
          if (track && pendingOnlineResult) {
            await lyricsManagerInstance.saveLyrics(track, pendingOnlineResult, 'online', undefined, false);
            setIsReplaceModalOpen(false);
            reloadLyrics();
            notificationService.success('Replaced', 'Online lyrics applied.');
          }
        }}
        onKeepExisting={() => {
          setIsReplaceModalOpen(false);
          notificationService.info('Kept Existing', 'Your edited lyrics were preserved.');
        }}
        onSaveAsNewVersion={async () => {
          if (track && pendingOnlineResult) {
            await lyricsManagerInstance.saveTranslation(track, 'Online Alternative', pendingOnlineResult);
            setIsReplaceModalOpen(false);
            notificationService.success('Saved Alternative', 'Online lyrics saved as alternative version.');
          }
        }}
        onClose={() => setIsReplaceModalOpen(false)}
      />

      {/* Full Editor Modal */}
      <LyricsEditorModal
        isOpen={isEditorModalOpen}
        track={track}
        onClose={() => setIsEditorModalOpen(false)}
        onSaved={reloadLyrics}
      />

      {/* Fullscreen Overlay */}
      <FullscreenLyricsModal
        isOpen={isFullscreenModalOpen}
        onClose={() => setIsFullscreenModalOpen(false)}
      />
    </div>
  );
};

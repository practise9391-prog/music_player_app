// ──────────────────────────────────────────────────────────
// FullscreenLyricsModal — Part 14 Fullscreen Lyrics Stage
// Features:
// - Grand stage typography with prominent active line & glow
// - Themes: Player Theme, Dark, Light, Album Art backdrop
// - Karaoke Mode toggle (singing focus)
// - Word-level synchronization when available
// - Per-song lyrics offset adjustments
// - Jump to current line on manual scrolling
// - Transport controls, seek, and keyboard navigation (Esc, Space, Arrows)
// ──────────────────────────────────────────────────────────
import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music2,
  Activity,
  Mic2,
  Sliders,
  Copy,
  Share2,
  ArrowDownCircle,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import { lyricsManagerInstance } from '../../services/lyrics/LyricsManager';
import { LyricsSyncEngine } from '../../services/lyrics/LyricsSyncEngine';
import { LyricLine, LyricsTheme } from '../../types/lyrics';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import { notificationService } from '../../services/errorService';

interface FullscreenLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FullscreenLyricsModal: React.FC<FullscreenLyricsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentTrack,
    state,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    visualizerSettings,
  } = usePlayer();

  const [lines, setLines] = useState<LyricLine[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showVisualizerBg, setShowVisualizerBg] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [karaokeMode, setKaraokeMode] = useState(false);
  const [theme, setTheme] = useState<LyricsTheme>('album_art');
  const [songOffset, setSongOffset] = useState(0);

  // Manual scroll state
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncEngineRef = useRef(new LyricsSyncEngine());
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load lyrics on track change or modal open
  useEffect(() => {
    if (!isOpen || !currentTrack) {
      setLines([]);
      setActiveIndex(-1);
      syncEngineRef.current.reset();
      return;
    }

    lyricsManagerInstance.getLocalLyrics(currentTrack).then((record) => {
      if (record) {
        const effOffset = record.offset ?? 0;
        setSongOffset(effOffset);
        syncEngineRef.current.setOffset(effOffset);

        if (record.lyrics_data?.lines && record.lyrics_data.lines.length > 0) {
          syncEngineRef.current.setLyrics(record.lyrics_data.lines, currentTrack.duration);
          setLines(syncEngineRef.current.getLines());
        } else if (record.plain_text) {
          const plainLines: LyricLine[] = record.plain_text
            .split('\n')
            .filter((l) => l.trim())
            .map((text) => ({ time: -1, text }));
          syncEngineRef.current.setLyrics(plainLines);
          setLines(plainLines);
        }
      } else {
        syncEngineRef.current.reset();
        setLines([]);
      }
    });
  }, [isOpen, currentTrack?.id]);

  // Update active line from current audio position
  useEffect(() => {
    if (!isOpen || lines.length === 0) return;

    const idx = syncEngineRef.current.updatePlaybackPosition(state.currentTime);
    if (idx !== activeIndex) {
      setActiveIndex(idx);
      if (!isUserScrolling && idx >= 0 && lineRefs.current[idx] && containerRef.current) {
        const el = lineRefs.current[idx]!;
        const container = containerRef.current;
        container.scrollTo({
          top: el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2,
          behavior: 'smooth',
        });
      }
    }
  }, [state.currentTime, isOpen, lines.length, activeIndex, isUserScrolling]);

  // Handle manual scrolling
  const handleScroll = () => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4000);
  };

  const jumpToCurrentLine = () => {
    setIsUserScrolling(false);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    if (activeIndex >= 0 && lineRefs.current[activeIndex] && containerRef.current) {
      const el = lineRefs.current[activeIndex]!;
      const container = containerRef.current;
      container.scrollTo({
        top: el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2,
        behavior: 'smooth',
      });
    }
  };

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(0, state.currentTime - 5));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(state.duration, state.currentTime + 5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.currentTime, state.duration, seek, togglePlayPause, onClose]);

  // Mouse activity auto-hide controls
  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setIsControlsVisible(false);
    }, 4000);
  };

  if (!isOpen || !currentTrack) return null;

  const formatTime = (seconds: number) => {
    const sPos = Math.max(0, seconds);
    const m = Math.floor(sPos / 60);
    const s = Math.floor(sPos % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyAll = () => {
    const text = lines.map((l) => l.text).join('\n');
    if (text) {
      navigator.clipboard.writeText(text);
      notificationService.success('Copied', 'All lyrics copied to clipboard.');
    }
  };

  const getThemeWrapperClass = () => {
    switch (theme) {
      case 'dark':
        return 'bg-black text-white';
      case 'light':
        return 'bg-zinc-100 text-zinc-900';
      case 'player':
        return 'bg-[var(--surface-base)] text-[var(--text-primary)]';
      default:
        return 'bg-slate-950 text-white';
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`fixed inset-0 z-50 flex flex-col select-none overflow-hidden transition-colors ${getThemeWrapperClass()}`}
    >
      {/* Background artwork blur if album_art theme */}
      {theme === 'album_art' && currentTrack.coverArtUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl pointer-events-none transform scale-110"
          style={{ backgroundImage: `url(${currentTrack.coverArtUrl})` }}
        />
      )}

      {/* Optional Background Visualizer / Subtle Glow */}
      {showVisualizerBg && (
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          <AudioVisualizer mode={visualizerSettings.mode} className="w-full h-full" />
        </div>
      )}

      {/* Top Header */}
      <div
        className={`relative z-10 flex items-center justify-between px-8 py-5 transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } bg-gradient-to-b from-black/80 to-transparent`}
      >
        <div className="flex items-center gap-3.5">
          {currentTrack.coverArtUrl ? (
            <img
              src={currentTrack.coverArtUrl}
              alt="Cover"
              className="w-11 h-11 rounded-xl object-cover shadow-xl border border-white/10"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Music2 className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">{currentTrack.title}</h1>
            <p className="text-xs text-slate-300">{currentTrack.artist}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme selector */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as LyricsTheme)}
            className="bg-black/50 border border-white/15 rounded-xl px-2.5 py-1 text-xs text-white"
          >
            <option value="album_art">Album Backdrop</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
            <option value="player">Player Theme</option>
          </select>

          {/* Karaoke mode toggle */}
          <button
            onClick={() => setKaraokeMode(!karaokeMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              karaokeMode
                ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                : 'bg-white/10 text-white border-white/15 hover:bg-white/20'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Karaoke</span>
          </button>

          <button
            onClick={() => setShowVisualizerBg(!showVisualizerBg)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              showVisualizerBg
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Visualizer</span>
          </button>

          <button
            onClick={handleCopyAll}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
            title="Copy all lyrics"
          >
            <Copy className="w-4 h-4" />
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
            title="Exit Fullscreen (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Floating Jump to current line button */}
      {isUserScrolling && activeIndex >= 0 && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <button
            onClick={jumpToCurrentLine}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-400 text-black text-xs font-bold shadow-2xl hover:opacity-90 active:scale-95 transition-all"
          >
            <ArrowDownCircle className="w-4 h-4" />
            <span>Jump to Current Line</span>
          </button>
        </div>
      )}

      {/* Main Center Stage: Synchronized Lyrics */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 relative z-10 overflow-y-auto px-6 md:px-20 scrollbar-none scroll-smooth flex flex-col items-center select-text"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
        }}
      >
        <div className="h-44" />

        {lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-3">
            <Music2 className="w-12 h-12 opacity-30" />
            <p className="text-lg font-medium">No lyrics available for this track</p>
          </div>
        ) : (
          lines.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPast = idx < activeIndex;
            const isClickable = line.time >= 0;
            const words = isActive ? syncEngineRef.current.getActiveWords(state.currentTime) : [];

            return (
              <div
                key={idx}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                onClick={() => {
                  if (isClickable) seek(line.time);
                }}
                className={`py-3 md:py-4 px-6 text-center transition-all duration-500 max-w-4xl ${
                  isActive
                    ? `text-cyan-300 font-extrabold scale-105 drop-shadow-[0_0_30px_rgba(34,211,238,0.5)] ${
                        karaokeMode ? 'text-3xl md:text-5xl py-6' : 'text-2xl md:text-4xl'
                      }`
                    : isPast
                    ? 'text-slate-500 text-lg md:text-xl font-normal opacity-40 hover:opacity-75'
                    : 'text-slate-300 text-lg md:text-xl font-medium opacity-60 hover:opacity-90'
                } ${isClickable ? 'cursor-pointer' : ''}`}
              >
                {/* Word-level Enhanced LRC highlighting */}
                {isActive && words.length > 0 ? (
                  <span className="inline-flex flex-wrap items-center justify-center gap-2">
                    {words.map((w, wIdx) => (
                      <span
                        key={wIdx}
                        className={`transition-colors duration-150 ${
                          w.active
                            ? 'text-white underline decoration-cyan-400 decoration-4'
                            : w.progress === 1
                            ? 'text-cyan-300'
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
              </div>
            );
          })
        )}

        <div className="h-44" />
      </div>

      {/* Bottom Transport Controls */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-auto px-6 py-6 space-y-3 transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } bg-gradient-to-t from-black/80 to-transparent`}
      >
        {/* Seekbar */}
        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
          <span>{formatTime(state.currentTime)}</span>
          <div
            className="flex-1 h-2 bg-white/10 rounded-full cursor-pointer relative overflow-hidden pointer-events-auto"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              seek(pos * state.duration);
            }}
          >
            <div
              className="h-full bg-cyan-400 rounded-full transition-all"
              style={{
                width: `${state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0}%`,
              }}
            />
          </div>
          <span>{formatTime(state.duration)}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-center gap-5 pointer-events-auto">
          <button
            onClick={() => prevTrack()}
            className="p-3 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <button
            onClick={() => togglePlayPause()}
            className="p-3.5 rounded-full bg-cyan-400 text-black hover:bg-cyan-300 shadow-lg shadow-cyan-400/25 transition-transform active:scale-95"
          >
            {state.status === 'playing' ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>

          <button
            onClick={() => nextTrack()}
            className="p-3 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

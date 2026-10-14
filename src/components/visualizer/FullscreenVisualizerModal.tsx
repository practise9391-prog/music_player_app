import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  Sliders,
  Sparkles,
  Music2,
  Activity,
  Circle,
  BarChart3,
  Waves,
  Eye,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import { AudioVisualizer } from './AudioVisualizer';
import { VisualizerLabModal } from './VisualizerLabModal';
import { VisualizerMode } from '../../types';
import { lyricsManagerInstance } from '../../services/lyrics/LyricsManager';
import { LyricsSyncEngine } from '../../services/lyrics/LyricsSyncEngine';

export const FullscreenVisualizerModal: React.FC = () => {
  const {
    isFullscreenVisualizerOpen,
    setIsFullscreenVisualizerOpen,
    currentTrack,
    state,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    visualizerSettings,
    updateVisualizerSettings,
  } = usePlayer();

  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [currentLyricLine, setCurrentLyricLine] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncEngineRef = useRef<LyricsSyncEngine>(new LyricsSyncEngine());

  // Load lyrics for current track and sync with playback position
  useEffect(() => {
    if (!currentTrack) {
      setCurrentLyricLine(null);
      syncEngineRef.current.reset();
      return;
    }

    lyricsManagerInstance.getLocalLyrics(currentTrack).then((rec) => {
      if (rec && rec.lyrics_data?.lines) {
        syncEngineRef.current.setLyrics(rec.lyrics_data.lines);
      } else {
        syncEngineRef.current.reset();
      }
    });
  }, [currentTrack?.id]);

  // Update synchronized lyric text
  useEffect(() => {
    if (syncEngineRef.current.getLineCount() > 0) {
      const idx = syncEngineRef.current.updatePlaybackPosition(state.currentTime);
      const line = syncEngineRef.current.getCurrentLine();
      setCurrentLyricLine(line ? line.text : null);
    } else {
      setCurrentLyricLine(null);
    }
  }, [state.currentTime]);

  // Mouse activity auto-hide (3.5s inactivity)
  const handleMouseMove = () => {
    setIsControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setIsControlsVisible(false);
    }, 3500);
  };

  // Keyboard controls ('V', 'F', '1'-'5', 'Esc')
  useEffect(() => {
    if (!isFullscreenVisualizerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      switch (e.key.toLowerCase()) {
        case 'escape':
          setIsFullscreenVisualizerOpen(false);
          break;
        case 'v':
          updateVisualizerSettings({ enabled: !visualizerSettings.enabled });
          break;
        case 'f':
          setIsFullscreenVisualizerOpen(false);
          break;
        case '1':
          updateVisualizerSettings({ mode: 'spectrum' });
          break;
        case '2':
          updateVisualizerSettings({ mode: 'waveform' });
          break;
        case '3':
          updateVisualizerSettings({ mode: 'circle' });
          break;
        case '4':
          updateVisualizerSettings({ mode: 'spectrogram' });
          break;
        case '5':
          updateVisualizerSettings({ mode: 'stereo_field' });
          break;
        case '6':
          updateVisualizerSettings({ mode: 'particles' });
          break;
        case '7':
          updateVisualizerSettings({ mode: 'album_art' });
          break;
        case '8':
          updateVisualizerSettings({ mode: 'oscilloscope' });
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenVisualizerOpen, visualizerSettings, updateVisualizerSettings, setIsFullscreenVisualizerOpen]);

  if (!isFullscreenVisualizerOpen) return null;

  const MODES: { id: VisualizerMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'spectrum', label: 'Spectrum', icon: BarChart3 },
    { id: 'smooth_spectrum', label: 'Curve', icon: Waves },
    { id: 'waveform', label: 'Waveform', icon: Activity },
    { id: 'oscilloscope', label: 'Oscilloscope', icon: Activity },
    { id: 'circle', label: 'Circular', icon: Circle },
    { id: 'spectrogram', label: 'Spectrogram', icon: BarChart3 },
    { id: 'stereo_field', label: 'Stereo Field', icon: SlidersHorizontal },
    { id: 'particles', label: 'Particles', icon: Sparkles },
    { id: 'album_art', label: 'Album Aura', icon: Music2 },
    { id: 'minimal', label: 'Minimal', icon: Sparkles },
  ];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white select-none overflow-hidden"
    >
      {/* Immersive Background Canvas */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        <AudioVisualizer mode={visualizerSettings.mode} className="w-full h-full" />
      </div>

      {/* Top Bar Overlay */}
      <div
        className={`relative z-10 flex items-center justify-between px-8 py-5 transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        } bg-gradient-to-b from-black/80 to-transparent`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Audio Visualizer Lab</h1>
            <p className="text-[11px] text-slate-400">Shortcuts: 1-8 Modes | V Toggle | Esc Exit</p>
          </div>
        </div>

        {/* Quick Mode Picker */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10 backdrop-blur-md">
          {MODES.slice(0, 6).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => updateVisualizerSettings({ mode: id })}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                visualizerSettings.mode === id
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}

          <button
            onClick={() => setIsLabOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-cyan-500/30 transition-colors ml-1"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Lab Studio</span>
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={() => setIsFullscreenVisualizerOpen(false)}
          className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors"
          title="Exit Fullscreen (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Center Stage Info & Synchronized Lyrics Overlay */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-8 pointer-events-none">
        {/* Track Title & Artist */}
        {visualizerSettings.showTrackInfo && currentTrack && (
          <div
            className={`text-center space-y-1 mb-6 transition-opacity duration-500 ${
              isControlsVisible ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
              {currentTrack.title}
            </h2>
            <p className="text-base sm:text-lg text-slate-300 font-medium drop-shadow-sm">
              {currentTrack.artist}
            </p>
          </div>
        )}

        {/* Synchronized Lyric Line Overlay (Section 30) */}
        {visualizerSettings.showLyricsOverlay && currentLyricLine && (
          <div className="max-w-3xl text-center px-6 py-3 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-2xl animate-fade-in mt-2">
            <p className="text-lg sm:text-2xl font-bold tracking-tight text-cyan-300 drop-shadow-lg leading-relaxed">
              "{currentLyricLine}"
            </p>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div
        className={`relative z-10 w-full max-w-3xl mx-auto px-8 py-6 space-y-4 transition-opacity duration-300 ${
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

        {/* Transport Buttons & Quick Sliders */}
        <div className="flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Sensitivity:</span>
            <input
              type="range"
              min="10"
              max="100"
              value={visualizerSettings.sensitivity}
              onChange={(e) =>
                updateVisualizerSettings({ sensitivity: parseInt(e.target.value, 10) })
              }
              className="w-24 accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => prevTrack()}
              className="p-3 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={() => togglePlayPause()}
              className="p-3.5 rounded-full bg-cyan-500 text-black hover:bg-cyan-400 shadow-lg shadow-cyan-500/25 transition-transform active:scale-95"
            >
              {state.status === 'playing' ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" />
              )}
            </button>

            <button
              onClick={() => nextTrack()}
              className="p-3 rounded-full hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                updateVisualizerSettings({ showLyricsOverlay: !visualizerSettings.showLyricsOverlay })
              }
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 ${
                visualizerSettings.showLyricsOverlay
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-white/5 border-white/10 text-slate-400'
              }`}
              title="Toggle synchronized lyric line"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Lyrics</span>
            </button>

            <button
              onClick={() => setIsLabOpen(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border bg-white/5 border-white/10 text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Audio Visual Lab Studio Panel */}
      <VisualizerLabModal isOpen={isLabOpen} onClose={() => setIsLabOpen(false)} />
    </div>
  );
};

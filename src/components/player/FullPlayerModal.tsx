import React from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { useNetwork } from '../../network/NetworkContext';
import { useSettings } from '../../settings/SettingsContext';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Shuffle,
  ChevronDown,
  Sparkles,
  Sliders,
  Shield,
  Radio,
  ListMusic,
  RotateCcw,
  RotateCw,
  Speaker,
  Gauge,
  Waves,
  Compass,
  Activity,
  Heart,
  Plus,
  FileText,
  FileAudio,
  Clock,
  Car,
  Bookmark,
} from 'lucide-react';
import { AddToPlaylistModal } from '../playlists/AddToPlaylistModal';
import { AudioProfileName, SpatialMode } from '../../types';
import { AudioVisualizer } from '../visualizer/AudioVisualizer';
import { LyricsView } from '../lyrics/LyricsView';
import { StarRating } from '../common/StarRating';
import { AudioFormatInfoModal } from '../modals/AudioFormatInfoModal';
import { SleepTimerModal } from './SleepTimerModal';
import { DrivingModeModal } from './DrivingModeModal';
import { BookmarksDrawer } from './BookmarksDrawer';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const FullPlayerModal: React.FC = () => {
  const {
    state,
    currentTrack,
    queue,
    isFullPlayerOpen,
    setIsFullPlayerOpen,
    toggleQueue,
    toggleDspModal,
    toggleSpatialModal,
    toggleFullscreenVisualizer,
    spatialState,
    visualizerSettings,
    updateVisualizerSettings,
    dspState,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    seekForward,
    seekBackward,
    setVolume,
    setVolumeBoost,
    toggleMute,
    setPlaybackRate,
    setRepeatMode,
    shuffleMode,
    cycleShuffleMode,
    toggleShuffle,
    setAudioProfile,
    setSpatialMode,
    outputDevices,
    setOutputDevice,
    toggleFavorite,
    setTrackRating,
    audioFormatBadge,
    activeAudioBadges,
    audiobookControls,
  } = usePlayer();

  const { networkState } = useNetwork();
  const { settings } = useSettings();
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = React.useState(false);
  const [showLyrics, setShowLyrics] = React.useState(false);
  const [isAudioFormatModalOpen, setIsAudioFormatModalOpen] = React.useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = React.useState(false);
  const [isDrivingModeOpen, setIsDrivingModeOpen] = React.useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = React.useState(false);

  // Auto-show lyrics if configured in settings (Req 40)
  React.useEffect(() => {
    if (settings.showLyricsAutomatically && currentTrack) {
      setShowLyrics(true);
    }
  }, [currentTrack?.id, settings.showLyricsAutomatically]);

  // Listen for 'open-lyrics-view' from mini player or lock screen (Req 41)
  React.useEffect(() => {
    const handler = () => setShowLyrics(true);
    window.addEventListener('open-lyrics-view', handler);
    return () => window.removeEventListener('open-lyrics-view', handler);
  }, []);

  // Toggle lyrics with 'L' key
  React.useEffect(() => {
    if (!isFullPlayerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setShowLyrics((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullPlayerOpen]);

  if (!isFullPlayerOpen) return null;

  const isPlaying = state.status === 'playing';
  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek((val / 100) * state.duration);
  };

  const PROFILES: AudioProfileName[] = [
    'Flat',
    'Bass Boost',
    'Deep Bass',
    'Vocal',
    'Rock',
    'Pop',
    'Classical',
    'Movie',
  ];

  const SPATIAL_MODES: { mode: SpatialMode; label: string }[] = [
    { mode: 'off', label: 'Off / Direct' },
    { mode: 'stereo_wide', label: 'Wide Stereo' },
    { mode: 'virtual_surround', label: 'Virtual Surround' },
    { mode: 'headphone_spatial', label: 'Headphone Spatial' },
    { mode: '3d_audio', label: '3D Spatial Audio' },
    { mode: 'cinema', label: 'Cinema Immersion' },
    { mode: 'live', label: 'Live Stage' },
    { mode: 'room', label: 'Acoustic Room' },
  ];

  const BOOST_LEVELS = [
    { label: '100%', val: 1.0 },
    { label: '125%', val: 1.25 },
    { label: '150%', val: 1.5 },
    { label: '200%', val: 2.0 },
    { label: '250%', val: 2.5 },
    { label: '300%', val: 3.0 },
  ];

  const PLAYBACK_SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)]/95 backdrop-blur-2xl animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="h-14 md:h-16 px-4 md:px-8 flex items-center justify-between border-b border-[var(--border)] gap-2 shrink-0">
        <button
          onClick={() => setIsFullPlayerOpen(false)}
          className="flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
        >
          <ChevronDown className="w-5 h-5" />
          <span className="hidden sm:inline">Minimize Player</span>
        </button>

        {/* Network State Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-medium">
          <span
            className={`w-2 h-2 rounded-full ${
              networkState.isAirGapped ? 'bg-amber-400' : 'bg-emerald-400'
            }`}
          />
          <span className="text-[var(--text-secondary)]">
            {networkState.isAirGapped ? '● OFFLINE (AIR-GAP)' : '● ONLINE — REQUESTED'}
          </span>
        </div>

        {/* Desktop Buttons */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            onClick={toggleDspModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-xs font-semibold text-[var(--accent)] border border-[var(--border)] transition-colors"
            title="Open Equalizer & DSP Audio Studio (E)"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Equalizer &amp; DSP</span>
          </button>

          <button
            onClick={toggleSpatialModal}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              spatialState.enabled && !spatialState.bypass
                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border)]'
            }`}
            title="Open Spatial Audio & 3D Acoustics Studio"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Spatial Audio</span>
          </button>

          <button
            onClick={toggleFullscreenVisualizer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)] transition-colors"
            title="Open Fullscreen Visualizer (V)"
          >
            <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Visualizer</span>
          </button>

          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              showLyrics
                ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)] shadow-sm'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border)]'
            }`}
            title="Toggle Synchronized Lyrics (L)"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Lyrics</span>
          </button>

          <button
            onClick={toggleQueue}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)] transition-colors"
            title="Open Queue"
          >
            <ListMusic className="w-4 h-4 text-[var(--accent)]" />
            <span>Queue ({queue.length})</span>
          </button>
        </div>

        {/* Mobile Icon Buttons */}
        <div className="flex md:hidden items-center gap-1.5">
          <button
            onClick={() => setShowLyrics(!showLyrics)}
            className={`p-2 rounded-lg border transition-colors ${
              showLyrics
                ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                : 'bg-[var(--surface-secondary)] text-[var(--text-primary)] border-[var(--border)]'
            }`}
            title="Lyrics"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={toggleDspModal}
            className="p-2 rounded-lg bg-[var(--surface-secondary)] text-[var(--accent)] border border-[var(--border)]"
            title="Equalizer & DSP"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={toggleQueue}
            className="p-2 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border)]"
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Player Visual Stage */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-8 flex flex-col justify-center items-center gap-6 overflow-y-auto">
        {/* Track Header */}
        <div className="text-center space-y-1.5 max-w-lg">
          <h1 className="text-2xl md:text-3xl font-extrabold text-[var(--text-primary)] tracking-tight">
            {currentTrack?.title || 'No Track Selected'}
          </h1>
          <p className="text-base text-[var(--text-secondary)] font-medium">
            {currentTrack?.artist || 'Unknown Artist'}
          </p>
          {currentTrack?.album && (
            <p className="text-xs text-[var(--text-muted)]">{currentTrack.album}</p>
          )}

          {currentTrack && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => toggleFavorite(currentTrack.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                  currentTrack.isFavorite
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                    : 'bg-[var(--surface-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${currentTrack.isFavorite ? 'fill-current' : ''}`} />
                <span>{currentTrack.isFavorite ? 'Favorited' : 'Favorite'}</span>
              </button>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)]">
                <StarRating
                  rating={currentTrack.rating || 0}
                  onChange={(r) => setTrackRating(currentTrack.id, r)}
                  size="sm"
                />
              </div>

              <button
                onClick={() => setIsAddToPlaylistOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add to Playlist</span>
              </button>

              <button
                onClick={() => setIsSleepTimerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all"
                title="Sleep Timer"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Timer</span>
              </button>

              <button
                onClick={() => setIsBookmarksOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all"
                title="Audio Bookmarks"
              >
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Bookmarks</span>
              </button>

              <button
                onClick={() => setIsDrivingModeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-all"
                title="Driving Mode"
              >
                <Car className="w-3.5 h-3.5 text-emerald-400" />
                <span>Drive</span>
              </button>
            </div>
          )}
        </div>

        {/* Center Stage: Synchronized Lyrics View OR Circular Artwork Visualizer */}
        {showLyrics ? (
          <div className="w-full max-w-2xl h-80 my-2 animate-fade-in">
            <LyricsView
              track={currentTrack}
              currentAudioPosition={state.currentTime}
              onSeek={seek}
            />
          </div>
        ) : (
          <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center my-2">
            {/* Outer Glowing Visualizer Ring */}
            <div
              className={`absolute inset-0 rounded-full border-2 border-[var(--accent)]/30 ${
                isPlaying ? 'animate-pulse scale-105' : 'scale-100'
              } transition-all duration-700`}
              style={{
                boxShadow: isPlaying ? '0 0 45px var(--accent-glow)' : 'none',
              }}
            />

            <div className="absolute inset-4 rounded-full border border-[var(--border)] flex items-center justify-center bg-[var(--surface-card)] shadow-inner overflow-hidden">
              {currentTrack?.coverArtUrl ? (
                <img
                  src={currentTrack.coverArtUrl}
                  alt="Album Cover"
                  className={`w-full h-full object-cover ${isPlaying ? 'rotate-1' : ''}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-[var(--accent)] gap-3">
                  <Waves className={`w-16 h-16 ${isPlaying ? 'animate-bounce' : ''}`} />
                  <span className="font-mono text-xs tracking-widest uppercase text-[var(--text-muted)]">
                    AUDIO VISUAL
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Real-Time Spectrum / Waveform Visualizer (Section 39) */}
        {visualizerSettings.enabled && (
          <div className="w-full max-w-md h-16 rounded-xl overflow-hidden bg-black/25 border border-[var(--border)] px-3 py-1 shadow-inner relative group">
            <AudioVisualizer mode={visualizerSettings.mode} className="w-full h-full" />
            <button
              onClick={toggleFullscreenVisualizer}
              className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded bg-black/70 text-cyan-300 text-[10px] flex items-center gap-1 transition-opacity border border-white/10"
              title="Fullscreen Visualizer (V)"
            >
              <span>V</span>
            </button>
          </div>
        )}

        {/* Technical Badges: Lossless & Stereo & Spatial & Processing Label */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {audioFormatBadge && (
            <div
              onClick={() => setIsAudioFormatModalOpen(true)}
              className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-all flex items-center gap-1.5 ${
                audioFormatBadge === 'HI-RES'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  : audioFormatBadge === 'LOSSLESS'
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border)]'
              }`}
              title="Click to view full audio stream specifications"
            >
              <FileAudio className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>{audioFormatBadge}</span>
            </div>
          )}

          <div
            onClick={() => setIsAudioFormatModalOpen(true)}
            className="px-3 py-1 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-secondary)] flex items-center gap-1.5 font-mono cursor-pointer"
            title="Inspect audio properties"
          >
            <Radio className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>
              {currentTrack?.format?.toLowerCase() === 'flac' ||
              currentTrack?.format?.toLowerCase() === 'wav'
                ? `LOSSLESS ${currentTrack?.sampleRate ? `${currentTrack.sampleRate / 1000}kHz` : 'PCM'}`
                : currentTrack?.bitrate
                ? `${currentTrack.format?.toUpperCase()} / ${currentTrack.bitrate} kbps`
                : `${currentTrack?.format?.toUpperCase() || 'AUDIO'}`}
            </span>
          </div>

          <div className="px-3 py-1 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] flex items-center gap-1.5 font-mono">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>{currentTrack?.channels === 1 ? '1.0 MONO' : '2.0 STEREO'}</span>
          </div>

          <div
            onClick={toggleSpatialModal}
            className="px-3 py-1 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono cursor-pointer transition-colors flex items-center gap-1.5"
            title="Click to configure Spatial Audio"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className={spatialState.enabled && !spatialState.bypass ? 'text-cyan-400' : 'text-slate-400'}>
              SPATIAL: {spatialState.enabled && !spatialState.bypass ? `${spatialState.mode.toUpperCase()} (${Math.round(spatialState.intensity * 100)}%)` : 'OFF'}
            </span>
          </div>

          <div
            onClick={toggleDspModal}
            className="px-3 py-1 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-mono cursor-pointer transition-colors flex items-center gap-1.5"
            title="Click to configure Audio Control Center"
          >
            <Sliders className="w-3 h-3 text-[var(--accent)]" />
            <span className={dspState.dspBypass ? 'text-amber-400' : 'text-emerald-400'}>
              {dspState.dspBypass ? 'DSP BYPASS' : activeAudioBadges.length > 0 ? activeAudioBadges.join(' • ') : 'DSP ACTIVE'}
            </span>
          </div>

          <div className="px-3 py-1 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] font-mono">
            SPEED: {state.playbackRate.toFixed(2).replace(/\.00$/, '')}x
          </div>
        </div>

        {/* Progress Seek Bar */}
        <div className="w-full max-w-xl space-y-1.5 font-mono text-xs">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent}
            onChange={handleSeekChange}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--progress-bg)] accent-[var(--accent)] focus:outline-none"
          />
          <div className="flex justify-between text-[var(--text-muted)]">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        {/* Primary Controls */}
        <div className="flex items-center justify-center gap-2 md:gap-5 w-full">
          <button
            onClick={cycleShuffleMode}
            className={`px-2.5 py-1.5 md:px-3 md:py-2 rounded-xl transition-all flex items-center gap-1.5 ${
              shuffleMode !== 'off'
                ? 'text-[var(--accent)] bg-[var(--surface-secondary)] border border-[var(--accent)]/30'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
            title={`Shuffle Mode: ${shuffleMode.toUpperCase()} (Click to cycle Off / Normal / Smart / Album)`}
          >
            <Shuffle className="w-4 h-4 md:w-5 md:h-5" />
            {shuffleMode !== 'off' && (
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">
                {shuffleMode}
              </span>
            )}
          </button>

          <button
            onClick={() => seekBackward(5)}
            className="hidden sm:flex p-2 rounded-full text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
            title="Rewind 5s"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={prevTrack}
            className="p-2 md:p-3 rounded-full text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors active:scale-95"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-14 h-14 md:w-16 md:h-16 rounded-full btn-primary flex items-center justify-center shadow-xl active:scale-95 transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 md:w-7 md:h-7 fill-current text-[var(--btn-text)]" />
            ) : (
              <Play className="w-6 h-6 md:w-7 md:h-7 fill-current ml-1 text-[var(--btn-text)]" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-2 md:p-3 rounded-full text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors active:scale-95"
            title="Next"
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6 fill-current" />
          </button>

          <button
            onClick={() => seekForward(5)}
            className="hidden sm:flex p-2 rounded-full text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
            title="Forward 5s"
          >
            <RotateCw className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              if (state.repeatMode === 'off') setRepeatMode('all');
              else if (state.repeatMode === 'all') setRepeatMode('one');
              else setRepeatMode('off');
            }}
            className={`p-2.5 rounded-xl transition-colors relative ${
              state.repeatMode !== 'off'
                ? 'text-[var(--accent)] bg-[var(--surface-secondary)]'
                : 'text-[var(--text-muted)] hover:text-white'
            }`}
            title={`Repeat: ${state.repeatMode}`}
          >
            <Repeat className="w-5 h-5" />
            {state.repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[9px] font-bold text-[var(--accent)]">
                1
              </span>
            )}
          </button>
        </div>

        {/* Advanced Audio Processing Controls Panel */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-[var(--border-subtle)]">
          {/* 1. Volume & Safe Amplification Boost */}
          <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-primary)]">
              <span className="flex items-center gap-1.5 cursor-pointer" onClick={toggleMute}>
                {state.isMuted ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                )}
                <span>Volume &amp; Boost</span>
              </span>
              <span className="font-mono text-[var(--accent)]">
                {state.isMuted ? 'Muted' : `${(state.volume * 100).toFixed(0)}%`}
              </span>
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={state.isMuted ? 0 : state.volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
            />

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                Amplification Boost
              </span>
              <div className="grid grid-cols-3 gap-1">
                {BOOST_LEVELS.map((b) => (
                  <button
                    key={b.val}
                    onClick={() => setVolumeBoost(b.val)}
                    className={`py-1 text-[10px] font-mono rounded font-semibold transition-colors ${
                      state.boostLevel === b.val
                        ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                        : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {state.boostLevel > 1.0 && (
              <div className="text-[10px] text-amber-400 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                Limiter active: Clipping protected (-0.5dB).
              </div>
            )}
          </div>

          {/* 2. Sound EQ Profile Selector */}
          <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-primary)]">
              <span className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-[var(--accent)]" /> Sound Profile
              </span>
              <span className="text-[var(--accent)] font-semibold truncate max-w-[80px]">
                {state.activeProfile}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {PROFILES.map((p) => (
                <button
                  key={p}
                  onClick={() => setAudioProfile(p)}
                  className={`text-left px-2 py-1.5 rounded text-xs font-medium transition-colors truncate ${
                    state.activeProfile === p
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] font-bold'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Spatial Audio Selector */}
          <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-primary)]">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Spatial Audio
              </span>
            </div>
            <div className="space-y-1">
              {SPATIAL_MODES.map((sm) => (
                <button
                  key={sm.mode}
                  onClick={() => setSpatialMode(sm.mode)}
                  className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors flex items-center justify-between ${
                    state.spatialMode === sm.mode
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] font-bold'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-white'
                  }`}
                >
                  <span className="truncate">{sm.label}</span>
                  {state.spatialMode === sm.mode && <span className="text-[10px]">●</span>}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Playback Speed & Output Device */}
          <div className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-[var(--accent)]" /> Speed
                </span>
                <span className="text-[var(--accent)] font-mono">{state.playbackRate}x</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {PLAYBACK_SPEEDS.map((sp) => (
                  <button
                    key={sp}
                    onClick={() => setPlaybackRate(sp)}
                    className={`py-1 text-[10px] font-mono rounded font-semibold transition-colors ${
                      state.playbackRate === sp
                        ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                        : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    {sp}x
                  </button>
                ))}
              </div>
            </div>

            {outputDevices.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider flex items-center gap-1">
                  <Speaker className="w-3 h-3 text-[var(--accent)]" /> Audio Output
                </span>
                <select
                  value={state.outputDeviceId || 'default'}
                  onChange={(e) => setOutputDevice(e.target.value)}
                  className="w-full bg-[var(--surface-secondary)] text-xs text-[var(--text-secondary)] border border-[var(--border)] rounded px-2 py-1 outline-none focus:border-[var(--accent)]"
                >
                  {outputDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add To Playlist Modal */}
      {currentTrack && (
        <AddToPlaylistModal
          isOpen={isAddToPlaylistOpen}
          onClose={() => setIsAddToPlaylistOpen(false)}
          track={currentTrack}
        />
      )}

      {/* Audio Format Info Modal */}
      <AudioFormatInfoModal
        isOpen={isAudioFormatModalOpen}
        onClose={() => setIsAudioFormatModalOpen(false)}
        track={currentTrack}
      />

      {/* Sleep Timer Modal (Part 25) */}
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
      />

      {/* Driving Mode Modal (Part 25) */}
      <DrivingModeModal
        isOpen={isDrivingModeOpen}
        onClose={() => setIsDrivingModeOpen(false)}
        currentTrack={currentTrack}
        isPlaying={state.status === 'playing'}
        onTogglePlayPause={togglePlayPause}
        onNext={nextTrack}
        onPrev={prevTrack}
      />

      {/* Bookmarks Drawer (Part 25) */}
      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        currentTrack={currentTrack}
      />
    </div>
  );
};

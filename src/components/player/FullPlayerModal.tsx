import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
  Sparkles,
  Sliders,
  RotateCcw,
  RotateCw,
  Speaker,
  Heart,
  Plus,
  FileText,
  FileAudio,
  Clock,
  Bookmark,
  Activity,
  Compass,
  X,
  Car,
  Home,
} from 'lucide-react';
import { AddToPlaylistModal } from '../playlists/AddToPlaylistModal';
import { AudioProfileName, SpatialMode } from '../../types';
import { LyricsView } from '../lyrics/LyricsView';
import { StarRating } from '../common/StarRating';
import { AudioFormatInfoModal } from '../modals/AudioFormatInfoModal';
import { SleepTimerModal } from './SleepTimerModal';
import { DrivingModeModal } from './DrivingModeModal';
import { BookmarksDrawer } from './BookmarksDrawer';
import { generateVibrantCover } from '../../library/artworkCache';

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
    isFullPlayerOpen,
    setIsFullPlayerOpen,
    toggleDspModal,
    toggleSpatialModal,
    toggleFullscreenVisualizer,
    spatialState,
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
    setAudioProfile,
    setSpatialMode,
    outputDevices,
    setOutputDevice,
    toggleFavorite,
    setTrackRating,
    audioFormatBadge,
  } = usePlayer();

  const { networkState } = useNetwork();
  const { settings } = useSettings();

  // Settings Panels State (Exactly TWO right-side icons)
  const [isSoundSettingsOpen, setIsSoundSettingsOpen] = useState(false);
  const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);

  // Submodals & Views
  const [showLyrics, setShowLyrics] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [isAudioFormatModalOpen, setIsAudioFormatModalOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isDrivingModeOpen, setIsDrivingModeOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);

  // Auto-show lyrics if configured
  useEffect(() => {
    if (settings.showLyricsAutomatically && currentTrack) {
      setShowLyrics(true);
    }
  }, [currentTrack?.id, settings.showLyricsAutomatically]);

  // Toggle lyrics with 'L' key
  useEffect(() => {
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
  ];

  const BOOST_LEVELS = [
    { label: '100%', val: 1.0 },
    { label: '125%', val: 1.25 },
    { label: '150%', val: 1.5 },
    { label: '200%', val: 2.0 },
  ];

  const coverUrl =
    currentTrack?.coverArtUrl ||
    generateVibrantCover(currentTrack?.title || 'Track', currentTrack?.artist);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] text-[var(--text-primary)] animate-in fade-in duration-200 select-none overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-14 sm:h-16 px-3 sm:px-6 flex items-center justify-between border-b border-[var(--border)] shrink-0 bg-[var(--background)]/80 backdrop-blur-md z-20">
        {/* Back / Minimize and Home Navigation */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsFullPlayerOpen(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-xs sm:text-sm font-semibold text-[var(--text-primary)] transition-all shrink-0 border border-[var(--border)] active:scale-95 shadow-sm"
            title="Minimize Now Playing"
            aria-label="Back"
          >
            <ChevronDown className="w-5 h-5 text-[var(--accent)]" />
            <span className="hidden sm:inline">Minimize</span>
          </button>

          <button
            onClick={() => {
              setIsFullPlayerOpen(false);
              window.dispatchEvent(new CustomEvent('nova-navigate-home'));
            }}
            className="p-1.5 sm:p-2 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-[var(--accent)] border border-[var(--border)] transition-all active:scale-95 shadow-sm flex items-center justify-center"
            title="Go to Home"
            aria-label="Home"
          >
            <Home className="w-4 h-4 text-[var(--accent)]" />
          </button>
        </div>

        {/* Center Track Title preview */}
        <div className="text-center px-2 min-w-0 flex-1 max-w-xs sm:max-w-md">
          <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--accent)]">
            Now Playing
          </p>
          <h2 className="text-xs sm:text-sm font-bold truncate text-[var(--text-primary)]">
            {currentTrack?.title || 'No Track Playing'}
          </h2>
        </div>

        {/* Exactly TWO Right-Side Settings Action Icons (Section 9 Requirement) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Icon 1: Sound Settings (Volume, Boost, EQ/Profiles) */}
          <button
            onClick={() => {
              setIsSoundSettingsOpen(!isSoundSettingsOpen);
              setIsDisplaySettingsOpen(false);
            }}
            className={`p-2.5 rounded-full border transition-all active:scale-95 ${
              isSoundSettingsOpen
                ? 'bg-purple-600 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-purple-400 border-[var(--border)]'
            }`}
            title="Sound Settings (Volume, Boost, Profiles)"
            aria-label="Sound Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Icon 2: Display & Appearance (Visualizer, Lyrics, Sleep Timer) */}
          <button
            onClick={() => {
              setIsDisplaySettingsOpen(!isDisplaySettingsOpen);
              setIsSoundSettingsOpen(false);
            }}
            className={`p-2.5 rounded-full border transition-all active:scale-95 ${
              isDisplaySettingsOpen || showLyrics
                ? 'bg-pink-600 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.5)]'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-pink-400 border-[var(--border)]'
            }`}
            title="Display & Appearance (Visualizer, Lyrics, Timer)"
            aria-label="Display & Appearance"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col justify-between items-center px-4 sm:px-8 py-3 overflow-y-auto relative z-10 max-w-2xl mx-auto w-full">
        {/* Center Stage: Rotating Vinyl Disc OR Synchronized Lyrics */}
        {showLyrics ? (
          <div className="w-full max-w-xl h-72 sm:h-80 my-auto animate-fade-in">
            <LyricsView
              track={currentTrack}
              currentAudioPosition={state.currentTime}
              onSeek={seek}
            />
          </div>
        ) : (
          <div className="relative my-auto flex items-center justify-center py-4">
            {/* Outer Ambient Multi-Color Halo */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600/30 via-pink-600/20 to-cyan-500/30 blur-3xl -z-10 animate-pulse pointer-events-none" />

            {/* Vinyl Record Disc with Concentric Grooves */}
            <div
              className="relative w-64 h-64 sm:w-72 sm:h-72 md:w-80 md:h-80 rounded-full bg-gradient-to-tr from-[#08090f] via-[#121524] to-[#08090f] p-3 shadow-2xl border-4 border-zinc-800/90 flex items-center justify-center animate-spin-slow transition-transform duration-700"
              style={{
                animationPlayState: isPlaying ? 'running' : 'paused',
              }}
            >
              {/* Concentric Grooves */}
              <div className="absolute inset-3 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-6 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-14 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-18 rounded-full border border-white/5 pointer-events-none" />

              {/* Center Record Label with Album Art */}
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44 rounded-full overflow-hidden border-2 border-purple-500/40 shadow-inner">
                <img
                  src={coverUrl}
                  alt={currentTrack?.title || 'Cover'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = generateVibrantCover(
                      currentTrack?.title || 'Track',
                      currentTrack?.artist
                    );
                  }}
                />
                {/* Center Spindle Hole */}
                <div className="absolute inset-0 m-auto w-6 h-6 rounded-full bg-[#090B14] border-2 border-white/40 shadow-inner" />
              </div>
            </div>
          </div>
        )}

        {/* Track Metadata & Favorite */}
        <div className="w-full text-center space-y-1.5 pt-2">
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate max-w-md">
              {currentTrack?.title || 'No Track Selected'}
            </h1>
            {currentTrack && (
              <button
                onClick={() => toggleFavorite(currentTrack.id)}
                className="p-1.5 rounded-full hover:scale-110 active:scale-95 transition-all text-rose-500"
                title="Favorite"
              >
                <Heart
                  className={`w-5 h-5 ${
                    currentTrack.isFavorite ? 'fill-current text-rose-500' : 'text-slate-400'
                  }`}
                />
              </button>
            )}
          </div>

          <p className="text-xs sm:text-sm font-semibold text-purple-300 truncate">
            {currentTrack?.artist || 'Unknown Artist'}
            {currentTrack?.album ? ` • ${currentTrack.album}` : ''}
          </p>

          {/* Quick Badges: Audio Format & Rating */}
          {currentTrack && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {audioFormatBadge && (
                <span
                  onClick={() => setIsAudioFormatModalOpen(true)}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 cursor-pointer"
                >
                  {audioFormatBadge}
                </span>
              )}
              <div className="flex items-center">
                <StarRating
                  rating={currentTrack.rating || 0}
                  onChange={(r) => setTrackRating(currentTrack.id, r)}
                  size="sm"
                />
              </div>
              <button
                onClick={() => setIsAddToPlaylistOpen(true)}
                className="p-1 text-[var(--text-muted)] hover:text-white"
                title="Add to Playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Progress Seek Bar */}
        <div className="w-full space-y-1 pt-3 font-mono text-xs">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent}
            onChange={handleSeekChange}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-purple-500 focus:outline-none"
            aria-label="Seek track position"
          />
          <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
            <span>{formatTime(state.currentTime)}</span>
            <span>{formatTime(state.duration)}</span>
          </div>
        </div>

        {/* Primary Controls (Shuffle, Prev, Play/Pause, Next, Repeat) */}
        <div className="flex items-center justify-between w-full max-w-sm pt-2 pb-1">
          {/* Shuffle Button */}
          <button
            onClick={cycleShuffleMode}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${
              shuffleMode !== 'off'
                ? 'text-purple-400 bg-purple-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
            title={`Shuffle: ${shuffleMode.toUpperCase()}`}
          >
            <Shuffle className="w-5 h-5" />
          </button>

          {/* Previous Track */}
          <button
            onClick={prevTrack}
            className="p-3 rounded-full text-white hover:bg-[var(--surface-secondary)] transition-all active:scale-95"
            title="Previous"
          >
            <SkipBack className="w-6 h-6 fill-current" />
          </button>

          {/* Big Glowing Play / Pause Button */}
          <button
            onClick={togglePlayPause}
            className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95 transition-transform"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 fill-current" />
            ) : (
              <Play className="w-7 h-7 fill-current ml-1" />
            )}
          </button>

          {/* Next Track */}
          <button
            onClick={nextTrack}
            className="p-3 rounded-full text-white hover:bg-[var(--surface-secondary)] transition-all active:scale-95"
            title="Next"
          >
            <SkipForward className="w-6 h-6 fill-current" />
          </button>

          {/* Repeat Button */}
          <button
            onClick={() => {
              if (state.repeatMode === 'off') setRepeatMode('all');
              else if (state.repeatMode === 'all') setRepeatMode('one');
              else setRepeatMode('off');
            }}
            className={`p-2.5 rounded-full transition-all relative active:scale-95 ${
              state.repeatMode !== 'off'
                ? 'text-pink-400 bg-pink-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
            title={`Repeat: ${state.repeatMode}`}
          >
            <Repeat className="w-5 h-5" />
            {state.repeatMode === 'one' && (
              <span className="absolute top-1 right-1 text-[9px] font-bold text-pink-400">
                1
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Bottom Glowing Neon Wave Effect (Panel 7 of Reference Image) */}
      <div className="w-full h-16 pointer-events-none relative overflow-hidden shrink-0 mt-auto opacity-75">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          <defs>
            <linearGradient id="neonWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#EC4899" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.8" />
            </linearGradient>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <path
            d="M0,60 C150,110 350,10 500,60 C650,110 850,10 1000,60 C1100,85 1150,50 1200,60 L1200,120 L0,120 Z"
            fill="url(#neonWaveGrad)"
            opacity="0.25"
            filter="url(#neonGlow)"
            className={isPlaying ? 'animate-pulse' : ''}
          />
          <path
            d="M0,70 Q300,10 600,60 T1200,50 L1200,120 L0,120 Z"
            fill="url(#neonWaveGrad)"
            opacity="0.4"
          />
          <path
            d="M0,80 C200,40 400,100 600,70 C800,40 1000,90 1200,75 L1200,120 L0,120 Z"
            fill="url(#neonWaveGrad)"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Slide-out Panel 1: Sound Settings (Icon 1) */}
      {isSoundSettingsOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-sm h-full bg-[#101426] border-l border-[var(--border)] p-6 flex flex-col justify-between overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-white text-base">Sound Settings</h3>
                </div>
                <button
                  onClick={() => setIsSoundSettingsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-semibold">
                  <span
                    className="flex items-center gap-1.5 cursor-pointer text-white"
                    onClick={toggleMute}
                  >
                    {state.isMuted ? (
                      <VolumeX className="w-4 h-4 text-red-400" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-purple-400" />
                    )}
                    <span>Master Volume</span>
                  </span>
                  <span className="font-mono text-purple-400">
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
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-purple-500"
                />
              </div>

              {/* Volume Boost */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Amplification Boost
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {BOOST_LEVELS.map((b) => (
                    <button
                      key={b.val}
                      onClick={() => setVolumeBoost(b.val)}
                      className={`py-1.5 text-xs font-mono rounded-lg font-semibold transition-all ${
                        state.boostLevel === b.val
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equalizer & Sound Profiles */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Sound Profile (EQ)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PROFILES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setAudioProfile(p)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                        state.activeProfile === p
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-white'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Spatial Mode Selector */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Spatial Acoustics
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {SPATIAL_MODES.map((sm) => (
                    <button
                      key={sm.mode}
                      onClick={() => setSpatialMode(sm.mode)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-left transition-all truncate ${
                        state.spatialMode === sm.mode
                          ? 'bg-cyan-600 text-white shadow-md'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:bg-[var(--surface-card)] hover:text-white'
                      }`}
                    >
                      {sm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Device */}
              {outputDevices.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                    <Speaker className="w-3.5 h-3.5 text-purple-400" /> Audio Output
                  </span>
                  <select
                    value={state.outputDeviceId || 'default'}
                    onChange={(e) => setOutputDevice(e.target.value)}
                    className="w-full bg-[var(--surface-secondary)] text-xs text-white border border-[var(--border)] rounded-xl px-3 py-2 outline-none"
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

            {/* Launch Full Studio */}
            <button
              onClick={() => {
                setIsSoundSettingsOpen(false);
                toggleDspModal();
              }}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg active:scale-95 transition-all text-center"
            >
              Open Equalizer Studio
            </button>
          </div>
        </div>
      )}

      {/* Slide-out Panel 2: Display & Appearance (Icon 2) */}
      {isDisplaySettingsOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex justify-end animate-fade-in">
          <div className="w-full max-w-sm h-full bg-[#101426] border-l border-[var(--border)] p-6 flex flex-col justify-between overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  <h3 className="font-bold text-white text-base">Display &amp; Modes</h3>
                </div>
                <button
                  onClick={() => setIsDisplaySettingsOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action List */}
              <div className="space-y-2.5">
                {/* Lyrics View */}
                <button
                  onClick={() => {
                    setShowLyrics(!showLyrics);
                    setIsDisplaySettingsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    showLyrics
                      ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                      : 'bg-[var(--surface-secondary)] border-[var(--border)] text-white hover:bg-[var(--surface-card)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-pink-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Synchronized Lyrics</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {showLyrics ? 'Currently Showing' : 'Show embedded & synced lyrics'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono">
                    {showLyrics ? 'ON' : 'OFF'}
                  </span>
                </button>

                {/* Fullscreen Visualizer */}
                <button
                  onClick={() => {
                    setIsDisplaySettingsOpen(false);
                    toggleFullscreenVisualizer();
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-white hover:bg-[var(--surface-card)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-5 h-5 text-cyan-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Audio Visualizer</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Real-time spectrum & waveform visualizer
                      </p>
                    </div>
                  </div>
                </button>

                {/* Sleep Timer */}
                <button
                  onClick={() => {
                    setIsDisplaySettingsOpen(false);
                    setIsSleepTimerOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-white hover:bg-[var(--surface-card)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Sleep Timer</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Auto-stop playback after selected duration
                      </p>
                    </div>
                  </div>
                </button>

                {/* Driving Mode */}
                <button
                  onClick={() => {
                    setIsDisplaySettingsOpen(false);
                    setIsDrivingModeOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-white hover:bg-[var(--surface-card)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Car className="w-5 h-5 text-emerald-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Driving Mode</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Large high-contrast touch interface
                      </p>
                    </div>
                  </div>
                </button>

                {/* Audio Bookmarks */}
                <button
                  onClick={() => {
                    setIsDisplaySettingsOpen(false);
                    setIsBookmarksOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-white hover:bg-[var(--surface-card)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Bookmark className="w-5 h-5 text-purple-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Bookmarks</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Save and recall position timestamps
                      </p>
                    </div>
                  </div>
                </button>

                {/* Audio Properties Modal */}
                <button
                  onClick={() => {
                    setIsDisplaySettingsOpen(false);
                    setIsAudioFormatModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-white hover:bg-[var(--surface-card)] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <FileAudio className="w-5 h-5 text-violet-400" />
                    <div className="text-left">
                      <p className="text-xs font-bold">Audio Stream Specs</p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        Bitrate, sample rate, codec & channels
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-modals */}
      {currentTrack && (
        <AddToPlaylistModal
          isOpen={isAddToPlaylistOpen}
          onClose={() => setIsAddToPlaylistOpen(false)}
          track={currentTrack}
        />
      )}

      <AudioFormatInfoModal
        isOpen={isAudioFormatModalOpen}
        onClose={() => setIsAudioFormatModalOpen(false)}
        track={currentTrack}
      />

      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
      />

      <DrivingModeModal
        isOpen={isDrivingModeOpen}
        onClose={() => setIsDrivingModeOpen(false)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        onTogglePlayPause={togglePlayPause}
        onNext={nextTrack}
        onPrev={prevTrack}
      />

      <BookmarksDrawer
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        currentTrack={currentTrack}
      />
    </div>
  );
};

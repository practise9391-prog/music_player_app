import React from 'react';
import { usePlayer } from '../../player/PlayerContext';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Heart,
  Repeat,
  Shuffle,
  Shield,
  Disc,
  ListMusic,
  RotateCcw,
  RotateCw,
  Sliders,
  Compass,
  Activity,
  Globe,
  Check,
  FileText,
} from 'lucide-react';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const MiniPlayer: React.FC = () => {
  const {
    state,
    currentTrack,
    queue,
    toggleQueue,
    toggleDspModal,
    toggleSpatialModal,
    toggleFullscreenVisualizer,
    spatialState,
    levelData,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    seekForward,
    seekBackward,
    setVolume,
    setMute,
    toggleMute,
    setPlaybackRate,
    setRepeatMode,
    shuffleMode,
    cycleShuffleMode,
    toggleShuffle,
    setIsFullPlayerOpen,
    toggleFavorite,
    setTrackRating,
    audioFormatBadge,
    activeAudioBadges,
  } = usePlayer();

  const isPlaying = state.status === 'playing';
  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    seek((val / 100) * state.duration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (state.isMuted) setMute(false);
  };

  const cycleRepeat = () => {
    if (state.repeatMode === 'off') setRepeatMode('all');
    else if (state.repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  return (
    <div className="relative h-16 md:h-24 w-full bg-[var(--surface)] border-t border-[var(--border)] px-3 md:px-6 flex items-center justify-between gap-2 md:gap-4 z-40 select-none backdrop-blur-md">
      {/* Top Thin Progress Bar for Mobile */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-1 bg-[var(--progress-bg)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Left: Track Information & Artwork */}
      <div className="flex items-center gap-2.5 md:gap-4 min-w-0 flex-1 md:flex-none md:min-w-[220px] md:max-w-[320px]">
        <div
          onClick={() => setIsFullPlayerOpen(true)}
          className="relative group w-11 h-11 md:w-14 md:h-14 rounded-xl overflow-hidden bg-[var(--surface-secondary)] border border-[var(--border)] shrink-0 cursor-pointer flex items-center justify-center shadow-md"
        >
          {currentTrack?.coverArtUrl ? (
            <img
              src={currentTrack.coverArtUrl}
              alt={currentTrack.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <Disc
              className={`w-6 h-6 md:w-7 md:h-7 text-[var(--accent)] ${
                isPlaying ? 'animate-spin' : ''
              } transition-transform duration-1000`}
              style={{ animationDuration: '4s' }}
            />
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Maximize2 className="w-4 h-4 md:w-5 md:h-5 text-white" />
          </div>
        </div>

        <div className="min-w-0 flex-1" onClick={() => setIsFullPlayerOpen(true)}>
          <div className="flex items-center gap-1.5">
            <span
              className="text-xs md:text-sm font-bold text-[var(--text-primary)] truncate hover:text-[var(--accent)] cursor-pointer transition-colors block"
            >
              {currentTrack?.title || 'No track selected'}
            </span>
          </div>
          <p className="text-[11px] md:text-xs text-[var(--text-secondary)] truncate">
            {currentTrack?.artist || 'Select audio to begin playback'}
          </p>
          <div className="hidden md:flex items-center gap-2 mt-1">
            {currentTrack?.sourceType === 'youtube' && currentTrack?.cached && (
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-2.5 h-2.5" /> CACHED YOUTUBE (OFFLINE)
              </span>
            )}
            {currentTrack?.source === 'online' && !currentTrack?.cached && (
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" /> YOUTUBE STREAM (ONLINE)
              </span>
            )}
            <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {currentTrack?.format?.toUpperCase() || 'PCM'}
            </span>
            {audioFormatBadge && (
              <span
                onClick={toggleDspModal}
                className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border cursor-pointer ${
                  audioFormatBadge === 'HI-RES'
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : audioFormatBadge === 'LOSSLESS'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                }`}
                title="Audio Format"
              >
                {audioFormatBadge}
              </span>
            )}
            {activeAudioBadges.length > 0 && (
              <span
                onClick={toggleDspModal}
                className="hidden md:inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 cursor-pointer"
                title="Active Audio Processing"
              >
                {activeAudioBadges.slice(0, 3).join(' • ')}
              </span>
            )}
            {state.boostLevel > 1.0 && (
              <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                BOOST {(state.boostLevel * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {currentTrack && (
          <button
            onClick={() => toggleFavorite()}
            className={`p-1.5 rounded-lg transition-colors ${
              currentTrack.isFavorite
                ? 'text-rose-500 hover:text-rose-400'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Favorite"
          >
            <Heart className={`w-4 h-4 ${currentTrack.isFavorite ? 'fill-current' : ''}`} />
          </button>
        )}
      </div>

      {/* Center: Controls & Progress Seek (Desktop) */}
      <div className="hidden md:flex flex-1 max-w-2xl flex-col items-center gap-2">
        <div className="flex items-center gap-4">
          <button
            onClick={cycleShuffleMode}
            className={`px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              shuffleMode !== 'off'
                ? 'text-[var(--accent)] bg-[var(--surface-secondary)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title={`Shuffle Mode: ${shuffleMode.toUpperCase()} (Click to cycle)`}
          >
            <Shuffle className="w-4 h-4" />
            {shuffleMode !== 'off' && (
              <span className="text-[9px] font-bold uppercase tracking-wider">{shuffleMode}</span>
            )}
          </button>

          <button
            onClick={() => seekBackward(5)}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Rewind 5s"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={prevTrack}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-10 h-10 rounded-full btn-primary flex items-center justify-center shadow-lg transition-transform active:scale-95"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current text-[var(--btn-text)]" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5 text-[var(--btn-text)]" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => seekForward(5)}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Forward 5s"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={cycleRepeat}
            className={`p-1.5 rounded-lg transition-colors relative ${
              state.repeatMode !== 'off'
                ? 'text-[var(--accent)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title={`Repeat: ${state.repeatMode}`}
          >
            <Repeat className="w-4 h-4" />
            {state.repeatMode === 'one' && (
              <span className="absolute -top-1 -right-1 text-[8px] font-bold">1</span>
            )}
          </button>
        </div>

        {/* Seek Bar */}
        <div className="w-full flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
          <span className="w-10 text-right">{formatTime(state.currentTime)}</span>
          <div className="relative flex-1 group flex items-center">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progressPercent}
              onChange={handleSeekChange}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--progress-bg)] accent-[var(--accent)] focus:outline-none"
            />
          </div>
          <span className="w-10">{formatTime(state.duration)}</span>
        </div>
      </div>

      {/* Mobile Playback Actions */}
      <div className="flex md:hidden items-center gap-1 shrink-0">
        <button
          onClick={togglePlayPause}
          className="w-9 h-9 rounded-full btn-primary flex items-center justify-center shadow-md active:scale-95"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current text-[var(--btn-text)]" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
          )}
        </button>
        <button
          onClick={nextTrack}
          className="p-1.5 rounded-lg text-[var(--text-secondary)] active:scale-95"
          title="Next"
        >
          <SkipForward className="w-4 h-4 fill-current" />
        </button>
        <button
          onClick={() => setIsFullPlayerOpen(true)}
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          title="Open Full Player"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Audio Profile, Playback Rate, Queue Drawer, Volume Slider, Full Screen (Desktop) */}
      <div className="hidden md:flex items-center gap-3 min-w-[220px] justify-end">
        {/* Playback speed toggle */}
        <button
          onClick={() => {
            const rates = [1.0, 1.25, 1.5, 2.0, 0.75];
            const nextIdx = (rates.indexOf(state.playbackRate) + 1) % rates.length;
            setPlaybackRate(rates[nextIdx]);
          }}
          className="hidden lg:flex px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border-subtle)] transition-colors"
          title="Playback Speed"
        >
          {state.playbackRate.toFixed(2).replace(/\.00$/, '')}x
        </button>

        {/* Queue Drawer Button */}
        <button
          onClick={toggleQueue}
          className="relative p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-colors"
          title="Playback Queue"
        >
          <ListMusic className="w-4 h-4" />
          {queue.length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[var(--accent)] text-[var(--btn-text)] text-[9px] font-bold flex items-center justify-center">
              {queue.length}
            </span>
          )}
        </button>

        {/* Equalizer & Audio DSP Studio */}
        <button
          onClick={toggleDspModal}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-colors"
          title="Equalizer &amp; Audio DSP Studio (E)"
        >
          <Sliders className="w-4 h-4 text-[var(--accent)]" />
        </button>

        {/* Spatial Audio & 3D Studio */}
        <button
          onClick={toggleSpatialModal}
          className={`p-2 rounded-xl border transition-colors ${
            spatialState.enabled && !spatialState.bypass
              ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border-transparent'
          }`}
          title="Spatial Audio &amp; 3D Studio"
        >
          <Compass className="w-4 h-4" />
        </button>

        {/* Real-Time Audio Activity Meter Dots (Section 40) */}
        {isPlaying && (
          <div
            onClick={toggleFullscreenVisualizer}
            className="hidden sm:flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border-subtle)] cursor-pointer hover:border-[var(--accent)] transition-colors"
            title="Real-Time Signal Activity • Click for Fullscreen Visualizer (V)"
          >
            {[0.15, 0.35, 0.6, 0.85].map((threshold, idx) => {
              const active = Math.max(levelData.leftPeak, levelData.rightPeak) >= threshold;
              return (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${
                    active ? 'bg-[var(--accent)] scale-110 shadow-sm' : 'bg-white/15 scale-90'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Fullscreen Visualizer Button */}
        <button
          onClick={toggleFullscreenVisualizer}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-colors"
          title="Fullscreen Visualizer (V)"
        >
          <Activity className="w-4 h-4 text-[var(--accent)]" />
        </button>

        {/* Open Lyrics Button (Req 41) */}
        <button
          onClick={() => {
            setIsFullPlayerOpen(true);
            window.dispatchEvent(new CustomEvent('open-lyrics-view'));
          }}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-colors"
          title="Open Synchronized Lyrics (L)"
        >
          <FileText className="w-4 h-4 text-[var(--accent)]" />
        </button>

        {/* Volume Slider */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Mute / Unmute"
          >
            {state.isMuted || state.volume === 0 ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : state.volume < 0.5 ? (
              <Volume1 className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={state.isMuted ? 0 : state.volume}
            onChange={handleVolumeChange}
            className="w-18 h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)] focus:outline-none"
          />
        </div>

        <button
          onClick={() => setIsFullPlayerOpen(true)}
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-colors"
          title="Open Full Player"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

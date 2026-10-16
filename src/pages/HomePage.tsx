import React, { useEffect, useState, useMemo } from 'react';
import { Track, AudioProfileName, SpatialMode, ThemeMode, UiDensity } from '../types';
import { TrackRepository, PlayHistoryRepository } from '../database/repository';
import { usePlayer } from '../player/PlayerContext';
import { useTheme } from '../themes/ThemeContext';
import { useSettings } from '../settings/SettingsContext';
import { generateVibrantCover } from '../library/artworkCache';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Music2,
  Sliders,
  Sparkles,
  ChevronRight,
  Disc3,
  Clock,
  Globe,
  HardDrive,
  Volume2,
  VolumeX,
  Volume1,
  Palette,
  Layout,
  Sun,
  Moon,
  Monitor,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  SlidersHorizontal,
} from 'lucide-react';

interface HomePageProps {
  onOpenFolder?: () => void;
  onAddMusic?: () => void;
  onNavigateToOnline?: () => void;
  onOpenFullPlayer?: () => void;
  onNavigate?: (route: any, playlistId?: string) => void;
  onOpenSearchModal?: () => void;
  onOpenIdentifyModal?: () => void;
  searchQuery?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const COLOR_PRESETS = [
  { id: 'purple', name: 'Purple', hex: '#8B5CF6' },
  { id: 'blue', name: 'Blue', hex: '#0284C7' },
  { id: 'violet', name: 'Neon Purple', hex: '#A855F7' },
  { id: 'green', name: 'Green', hex: '#10B981' },
  { id: 'orange', name: 'Orange', hex: '#F97316' },
  { id: 'red', name: 'Red', hex: '#EF4444' },
  { id: 'pink', name: 'Pink', hex: '#EC4899' },
  { id: 'teal', name: 'Teal', hex: '#14B8A6' },
  { id: 'cyan', name: 'Cyan', hex: '#06B6D4' },
  { id: 'amber', name: 'Amber', hex: '#F59E0B' },
];

const EQ_PRESETS: AudioProfileName[] = [
  'Flat',
  'Bass Boost',
  'Treble Boost',
  'Vocal',
  'Rock',
  'Pop',
  'Classical',
];

const SPATIAL_OPTIONS: { mode: SpatialMode; label: string; desc: string }[] = [
  { mode: 'off', label: 'Off', desc: 'Direct Stereo' },
  { mode: 'virtual_surround', label: 'Surround', desc: 'Haas Effect Widener' },
  { mode: 'stereo_wide', label: 'Wide', desc: 'Expanded Soundstage' },
  { mode: '3d_audio', label: '3D Audio', desc: 'Binaural HRTF Panner' },
  { mode: 'headphone_spatial', label: 'Headphone', desc: 'Acoustic Crossfeed' },
];

export const HomePage: React.FC<HomePageProps> = ({
  onOpenFullPlayer,
  onNavigate,
}) => {
  const { theme, setMode, setAccentColor, setDensity } = useTheme();
  const { settings, updateSettings } = useSettings();

  const {
    currentTrack,
    state: engineState,
    playTrack,
    togglePlayPause,
    nextTrack,
    prevTrack,
    seek,
    toggleShuffle,
    setRepeatMode,
    toggleFavorite,
    toggleAudioControlCenter,
    setVolume,
    setMute,
    toggleMute,
    dspState,
    setAudioProfile,
    audioProfileMatchedName,
    setBassBoostPercent,
    spatialState,
    setSpatialMode,
    setSpatialIntensity,
    activeDolbyMode,
    setDolbyMode,
    isDolbyHardwareSupported,
  } = usePlayer();

  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [homeFilter, setHomeFilter] = useState<'all' | 'local' | 'online' | 'favorites'>('all');
  const [homeStudioTab, setHomeStudioTab] = useState<'music' | 'appearance' | 'audio' | 'display'>('music');
  const [isStudioOpen, setIsStudioOpen] = useState(true);

  const [totalSongsCount, setTotalSongsCount] = useState<number>(0);
  const [localSongsCount, setLocalSongsCount] = useState<number>(0);
  const [onlineSongsCount, setOnlineSongsCount] = useState<number>(0);
  const [favoritesSongsCount, setFavoritesSongsCount] = useState<number>(0);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPosition, setScrubPosition] = useState(0);

  const isAudioPlaying = engineState.status === 'playing';

  // Synchronize reduced-motion with document root
  useEffect(() => {
    if (settings.visualizerReducedMotion) {
      document.documentElement.classList.add('reduced-motion');
    } else {
      document.documentElement.classList.remove('reduced-motion');
    }
  }, [settings.visualizerReducedMotion]);

  // Load recently played (local + online) and library stats
  const loadRecentAndStats = async () => {
    try {
      const all = await TrackRepository.getAll();
      setTotalSongsCount(all.length);
      setLocalSongsCount(all.filter((t) => t.source !== 'online').length);
      setFavoritesSongsCount(all.filter((t) => t.isFavorite).length);

      const allMap = new Map<string, Track>();
      for (const t of all) {
        allMap.set(t.id, t);
        allMap.set(`${t.title.toLowerCase().trim()}:::${t.artist.toLowerCase().trim()}`, t);
      }

      // Fetch combined history records (both local and online)
      const historyRecords = await PlayHistoryRepository.getRecent(30);
      const combinedTracks: Track[] = [];
      const seenIds = new Set<string>();

      for (const rec of historyRecords) {
        if (rec.source === 'online') {
          const videoId = rec.trackId ? rec.trackId.replace('yt_', '') : '';
          const onlineId = rec.trackId || `yt_${encodeURIComponent(rec.title)}`;
          if (seenIds.has(onlineId)) continue;
          seenIds.add(onlineId);

          const ytTrack: Track = {
            id: onlineId,
            title: rec.title,
            artist: rec.artist || 'YouTube',
            album: 'Online Stream',
            duration: rec.playDuration || 0,
            format: 'youtube',
            path: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
            playbackUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
            coverArtUrl: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined,
            source: 'online',
            dateAdded: rec.playedAt,
            lastPlayedAt: rec.playedAt,
            playCount: 1,
            isFavorite: false,
          };
          combinedTracks.push(ytTrack);
        } else {
          const localTrack =
            (rec.trackId ? allMap.get(rec.trackId) : null) ||
            allMap.get(`${rec.title.toLowerCase().trim()}:::${rec.artist.toLowerCase().trim()}`);

          if (localTrack && !seenIds.has(localTrack.id)) {
            seenIds.add(localTrack.id);
            combinedTracks.push(localTrack);
          }
        }
      }

      // Add recently played local tracks from track metadata
      const localRecent = all
        .filter((t) => (t.lastPlayedAt || 0) > 0 && !seenIds.has(t.id))
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));

      for (const t of localRecent) {
        if (!seenIds.has(t.id)) {
          seenIds.add(t.id);
          combinedTracks.push(t);
        }
      }

      if (combinedTracks.length > 0) {
        setRecentTracks(combinedTracks);
        setOnlineSongsCount(combinedTracks.filter((t) => t.source === 'online').length);
      } else if (all.length > 0) {
        setRecentTracks(all.slice(0, 8));
        setOnlineSongsCount(0);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadRecentAndStats();
    const handleUpdated = () => loadRecentAndStats();
    window.addEventListener('nova-library-updated', handleUpdated);
    window.addEventListener('nova-playlists-updated', handleUpdated);
    return () => {
      window.removeEventListener('nova-library-updated', handleUpdated);
      window.removeEventListener('nova-playlists-updated', handleUpdated);
    };
  }, []);

  // Update scrub position with playback time when not dragging
  useEffect(() => {
    if (!isScrubbing) {
      setScrubPosition(engineState.currentTime || 0);
    }
  }, [engineState.currentTime, isScrubbing]);

  const activeDuration =
    engineState.duration && !isNaN(engineState.duration) && engineState.duration > 0
      ? engineState.duration
      : currentTrack?.duration || 180;

  const currentCover = useMemo(() => {
    if (currentTrack) {
      return (
        currentTrack.coverArtUrl ||
        generateVibrantCover(currentTrack.title, currentTrack.artist)
      );
    }
    return null;
  }, [currentTrack]);

  const cycleRepeat = () => {
    if (engineState.repeatMode === 'off') {
      setRepeatMode('all');
    } else if (engineState.repeatMode === 'all') {
      setRepeatMode('one');
    } else {
      setRepeatMode('off');
    }
  };

  const isCompact = settings.uiDensity === 'compact';

  return (
    <div
      className={`flex-1 overflow-y-auto ${
        isCompact ? 'px-2.5 sm:px-4 md:px-6 py-3 space-y-4' : 'px-3 sm:px-6 md:px-10 py-4 sm:py-6 space-y-6'
      } max-w-2xl mx-auto select-none`}
    >
      {/* 1. App Header Branding with Realistic Icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-lg border-2 border-[var(--accent)]/40 p-0.5 bg-black/40">
            <img
              src="/icon.png"
              alt="SoundFlow Icon"
              className="w-full h-full object-contain drop-shadow"
            />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-[var(--text-primary)]">
              SOUNDFLOW
            </h1>
            <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] font-medium">
              Hi-Fi Music Player
            </p>
          </div>
        </div>

        {/* Quick Link to Full Library */}
        <button
          onClick={() => onNavigate?.('library')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] text-xs font-semibold transition-all active:scale-95 shadow-sm"
        >
          <Music2 className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Library</span>
          <span className="text-[10px] bg-[var(--accent)]/20 text-[var(--accent)] px-1.5 py-0.2 rounded-full font-mono font-bold">
            {totalSongsCount}
          </span>
        </button>
      </div>

      {/* 2. Centerpiece: Dedicated Now Playing Card */}
      {currentTrack ? (
        <div className="relative overflow-hidden rounded-3xl bg-[var(--surface-card)] border border-[var(--border)] p-5 sm:p-7 shadow-xl space-y-5">
          {/* Subtle Ambient Accent Glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[var(--accent)]/10 blur-3xl pointer-events-none" />

          {/* Top Status & Audio Source Badge */}
          <div className="flex items-center justify-between relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full bg-[var(--accent)] ${isAudioPlaying ? 'animate-ping' : ''}`} />
              {isAudioPlaying ? 'NOW PLAYING' : 'PAUSED'}
            </span>

            <div className="flex items-center gap-2">
              {currentTrack.source === 'online' ? (
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500 border border-blue-500/30 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-blue-500" /> Online Stream
                </span>
              ) : (
                <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-emerald-500" /> Local Audio
                </span>
              )}

              {/* Bouncing audio equalizer bars when active */}
              {isAudioPlaying && (
                <div className="flex items-end gap-1 h-4 ml-1">
                  <span className="w-1 h-3 bg-[var(--accent)] rounded-full animate-pulse" />
                  <span className="w-1 h-4 bg-[var(--accent)] rounded-full animate-pulse delay-75" />
                  <span className="w-1 h-2.5 bg-[var(--accent)] rounded-full animate-pulse delay-150" />
                  <span className="w-1 h-3.5 bg-[var(--accent)] rounded-full animate-pulse delay-100" />
                </div>
              )}
            </div>
          </div>

          {/* Large Rounded Artwork Card */}
          <div className="relative flex justify-center py-2 sm:py-4 z-10">
            <div
              onClick={onOpenFullPlayer}
              className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-3xl overflow-hidden cursor-pointer group shadow-[0_12px_35px_rgba(0,0,0,0.3)] border border-[var(--border)] bg-black/40 transition-transform hover:scale-[1.02]"
            >
              <img
                src={currentCover || generateVibrantCover(currentTrack.title, currentTrack.artist)}
                alt={currentTrack.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = generateVibrantCover(
                    currentTrack.title,
                    currentTrack.artist
                  );
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-3">
                <span className="text-[11px] font-bold text-white bg-black/70 px-3 py-1 rounded-full backdrop-blur-sm">
                  Click to Expand
                </span>
              </div>
            </div>
          </div>

          {/* Song Info & Favorite */}
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--text-primary)] truncate tracking-tight">
                {currentTrack.title}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate mt-0.5 font-medium">
                {currentTrack.artist}
                {currentTrack.album ? ` • ${currentTrack.album}` : ''}
              </p>
            </div>

            <button
              onClick={() => toggleFavorite(currentTrack.id)}
              className="p-2.5 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-rose-500 transition-all active:scale-90 shrink-0"
              title="Toggle Favorite"
            >
              <Heart
                className={`w-5 h-5 ${
                  currentTrack.isFavorite ? 'text-rose-500 fill-current' : ''
                }`}
              />
            </button>
          </div>

          {/* Interactive Scrub Progress Bar */}
          <div className="space-y-1.5 pt-1 relative z-10">
            <div className="relative flex items-center">
              <input
                type="range"
                min={0}
                max={activeDuration}
                step={0.5}
                value={scrubPosition}
                onChange={(e) => {
                  setIsScrubbing(true);
                  setScrubPosition(parseFloat(e.target.value));
                }}
                onMouseUp={() => {
                  seek(scrubPosition);
                  setIsScrubbing(false);
                }}
                onTouchEnd={() => {
                  seek(scrubPosition);
                  setIsScrubbing(false);
                }}
                className="w-full h-1.5 bg-[var(--progress-bg)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                title={`Seek: ${formatDuration(scrubPosition)} / ${formatDuration(activeDuration)}`}
                aria-label="Seek track position"
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-[var(--text-muted)]">
              <span>{formatDuration(scrubPosition)}</span>
              <span>{formatDuration(activeDuration)}</span>
            </div>
          </div>

          {/* Playback Controls (Shuffle, Prev, Big Play/Pause, Next, Repeat) */}
          <div className="flex items-center justify-between pt-2 relative z-10">
            <button
              onClick={toggleShuffle}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${
                engineState.isShuffle
                  ? 'text-[var(--accent)] bg-[var(--accent)]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-5 h-5" />
            </button>

            <button
              onClick={prevTrack}
              className="p-2.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-all active:scale-90"
              title="Previous Track"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>

            {/* Big Gradient / Accent Play/Pause Button */}
            <button
              onClick={togglePlayPause}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shadow-[0_0_25px_var(--accent-glow)] hover:scale-105 active:scale-95 transition-transform"
              title={isAudioPlaying ? 'Pause' : 'Play'}
            >
              {isAudioPlaying ? (
                <Pause className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
              ) : (
                <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="p-2.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-all active:scale-90"
              title="Next Track"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>

            <button
              onClick={cycleRepeat}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${
                engineState.repeatMode !== 'off'
                  ? 'text-[var(--accent)] bg-[var(--accent)]/20'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title={`Repeat: ${engineState.repeatMode}`}
            >
              {engineState.repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5" />
              ) : (
                <Repeat className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* Volume Control Slider */}
          <div className="flex items-center gap-3 px-1 pt-1 text-[var(--text-muted)] relative z-10">
            <button
              onClick={() => toggleMute()}
              className="p-1 hover:text-[var(--text-primary)] transition-colors"
              title={engineState.isMuted ? 'Unmute' : 'Mute'}
            >
              {engineState.isMuted || engineState.volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-500" />
              ) : engineState.volume < 0.5 ? (
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
              value={engineState.isMuted ? 0 : engineState.volume}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setVolume(val);
                if (engineState.isMuted && val > 0) setMute(false);
              }}
              className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--progress-bg)] accent-[var(--accent)] focus:outline-none"
              title={`Volume: ${Math.round((engineState.isMuted ? 0 : engineState.volume) * 100)}%`}
              aria-label="Volume slider"
            />
            <span className="text-[11px] font-mono w-9 text-right text-[var(--text-muted)]">
              {Math.round((engineState.isMuted ? 0 : engineState.volume) * 100)}%
            </span>
          </div>

          {/* Consolidated Sound & Audio Effects Button */}
          <div className="pt-2 border-t border-[var(--border-subtle)] relative z-10">
            <button
              onClick={toggleAudioControlCenter}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-card)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] transition-all shadow-sm active:scale-95 group"
            >
              <Sliders className="w-4 h-4 text-[var(--accent)] group-hover:rotate-90 transition-transform duration-300" />
              <span>Equalizer, Bass Boost &amp; Sound Profiles</span>
            </button>
          </div>
        </div>
      ) : (
        /* Empty State: Ready to Play Card */
        <div className="p-8 sm:p-10 rounded-3xl bg-[var(--surface-card)] border border-[var(--border)] text-center space-y-4 shadow-xl">
          <div className="w-20 h-20 mx-auto rounded-full bg-[var(--accent)]/15 border-2 border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shadow-md">
            <Disc3 className="w-10 h-10 animate-spin-slow" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              No Song Playing Right Now
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Select any track from your library or paste an online link to begin listening.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => onNavigate?.('library')}
              className="px-5 py-2.5 rounded-full bg-[var(--accent)] text-white text-xs font-bold shadow-md hover:scale-105 transition-transform active:scale-95 inline-flex items-center gap-2"
            >
              <Music2 className="w-4 h-4" />
              <span>Open Library</span>
            </button>
            <button
              onClick={() => onNavigate?.('online')}
              className="px-5 py-2.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs font-bold hover:bg-[var(--surface-card)] transition-transform active:scale-95 inline-flex items-center gap-2"
            >
              <Globe className="w-4 h-4 text-[var(--accent)]" />
              <span>Online Stream</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. HOME FILTERS & STUDIO SETTINGS PANEL (Part 2, 3, 4, 5) */}
      <div className="rounded-3xl bg-[var(--surface-card)] border border-[var(--border)] shadow-md overflow-hidden transition-all">
        {/* Panel Header & Section Tabs */}
        <div className="p-3 sm:p-4 border-b border-[var(--border)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <SlidersHorizontal className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider truncate">
              Home Studio &amp; Filters
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-semibold text-[var(--text-muted)] hidden sm:inline-block">
              {theme.mode.toUpperCase()} • {theme.preset || 'CUSTOM'}
            </span>
            <button
              onClick={() => setIsStudioOpen(!isStudioOpen)}
              className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title={isStudioOpen ? 'Collapse Settings' : 'Expand Settings'}
            >
              {isStudioOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Tab Row */}
        <div className="flex items-center gap-1 px-3 pt-3 overflow-x-auto scrollbar-none border-b border-[var(--border-subtle)] pb-2">
          {[
            { id: 'music', label: 'Music Filters', icon: Music2 },
            { id: 'appearance', label: 'Appearance & Themes', icon: Palette },
            { id: 'audio', label: 'Audio & DSP', icon: Sliders },
            { id: 'display', label: 'Display & Motion', icon: Layout },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = homeStudioTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setHomeStudioTab(tab.id as any);
                  if (!isStudioOpen) setIsStudioOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                  isActive
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Expandable Tab Content */}
        {isStudioOpen && (
          <div className="p-3.5 sm:p-5 space-y-4 animate-in fade-in duration-200">
            {/* TAB 1: MUSIC FILTERS */}
            {homeStudioTab === 'music' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium px-0.5">
                  <span>Filter recently played and library tracks below:</span>
                  <span>{recentTracks.length} tracks</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                  {[
                    { id: 'all', label: 'All Songs', count: totalSongsCount },
                    { id: 'local', label: 'Local Audio', count: localSongsCount },
                    { id: 'online', label: 'Online Streams', count: onlineSongsCount },
                    { id: 'favorites', label: 'Favorites', count: favoritesSongsCount },
                  ].map((chip) => {
                    const isActive = homeFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        onClick={() => setHomeFilter(chip.id as any)}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                          isActive
                            ? 'bg-[var(--accent)] text-white shadow-md'
                            : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]'
                        }`}
                      >
                        <span>{chip.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isActive ? 'bg-white/20 text-white' : 'bg-[var(--border)] text-[var(--text-muted)]'
                          }`}
                        >
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: APPEARANCE & COLOR THEMES (Part 3 & Part 4) */}
            {homeStudioTab === 'appearance' && (
              <div className="space-y-4">
                {/* Theme Mode: Light, Dark, System */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Appearance Mode
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'light', label: 'Light', icon: Sun },
                      { id: 'dark', label: 'Dark', icon: Moon },
                      { id: 'system', label: 'System', icon: Monitor },
                    ].map((modeItem) => {
                      const Icon = modeItem.icon;
                      const isActive = theme.mode === modeItem.id;
                      return (
                        <button
                          key={modeItem.id}
                          onClick={() => {
                            setMode(modeItem.id as ThemeMode);
                            updateSettings({ themeMode: modeItem.id as ThemeMode });
                          }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-semibold transition-all active:scale-95 border ${
                            isActive
                              ? 'bg-[var(--surface-secondary)] text-[var(--accent)] border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{modeItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color Customization Swatches (Part 4) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Accent Color Palette
                    </span>
                    <span className="text-[11px] font-mono text-[var(--accent)] font-semibold">
                      {theme.colors.accent.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {COLOR_PRESETS.map((col) => {
                      const isSelected =
                        theme.colors.accent.toLowerCase() === col.hex.toLowerCase();
                      return (
                        <button
                          key={col.id}
                          onClick={() => {
                            setAccentColor(col.hex);
                            updateSettings({ accentColor: col.hex });
                          }}
                          className={`flex flex-col items-center gap-1 p-2 rounded-2xl border transition-all active:scale-90 ${
                            isSelected
                              ? 'border-[var(--accent)] bg-[var(--surface-secondary)] ring-2 ring-[var(--accent)]/40 shadow-md'
                              : 'border-[var(--border)] bg-[var(--surface-secondary)] hover:border-[var(--text-muted)]'
                          }`}
                          title={col.name}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center shadow-inner relative"
                            style={{ backgroundColor: col.hex }}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                          </div>
                          <span className="text-[9px] font-medium text-[var(--text-secondary)] truncate w-full text-center">
                            {col.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: AUDIO & SPATIAL SETTINGS (Part 5) */}
            {homeStudioTab === 'audio' && (
              <div className="space-y-4">
                {/* Equalizer Presets */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Equalizer Presets
                    </span>
                    <button
                      onClick={toggleAudioControlCenter}
                      className="text-[11px] text-[var(--accent)] font-semibold hover:underline"
                    >
                      Open 9-Band EQ Studio
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                    {EQ_PRESETS.map((profile) => {
                      const activeProfile = audioProfileMatchedName || settings.audioProfile || 'Flat';
                      const isActive = activeProfile === profile;
                      return (
                        <button
                          key={profile}
                          onClick={() => {
                            setAudioProfile(profile);
                            updateSettings({ audioProfile: profile });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 border ${
                            isActive
                              ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {profile}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Bass Enhancement Slider */}
                <div className="space-y-1.5 p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-[var(--accent)]" /> Bass Enhancement
                    </span>
                    <span className="font-mono text-[var(--accent)] font-semibold">
                      +{((dspState.bassBoostPercent || 0) * 0.12).toFixed(1)} dB (
                      {Math.round(dspState.bassBoostPercent || 0)}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={dspState.bassBoostPercent || 0}
                    onChange={(e) => setBassBoostPercent(parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--progress-bg)] accent-[var(--accent)]"
                    aria-label="Bass enhancement"
                  />
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                    <span>Clean Bypass (0dB)</span>
                    <span className="text-emerald-500 font-medium">Limiter: Active</span>
                    <span>Max Punch (+12dB)</span>
                  </div>
                </div>

                {/* Virtual Surround / Spatial Audio Mode */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Virtual Surround &amp; Spatial Audio
                    </span>
                    {spatialState.mode !== 'off' && (
                      <span className="text-[10px] text-emerald-500 font-bold uppercase">
                        Active (Web Audio HRTF)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {SPATIAL_OPTIONS.map((opt) => {
                      const isActive = spatialState.mode === opt.mode;
                      return (
                        <button
                          key={opt.mode}
                          onClick={() => setSpatialMode(opt.mode)}
                          className={`flex flex-col text-left p-2.5 rounded-2xl border transition-all active:scale-95 ${
                            isActive
                              ? 'bg-[var(--surface-card)] text-[var(--accent)] border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="text-xs font-bold">{opt.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {spatialState.mode !== 'off' && (
                    <div className="space-y-1 pt-1.5 px-0.5">
                      <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                        <span>Spatial Immersion &amp; Depth</span>
                        <span className="font-mono text-[var(--accent)] font-semibold">
                          {Math.round((spatialState.intensity || 1.0) * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={1.5}
                        step={0.05}
                        value={spatialState.intensity || 1.0}
                        onChange={(e) => setSpatialIntensity(parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-[var(--progress-bg)] accent-[var(--accent)]"
                        aria-label="Spatial audio intensity"
                      />
                    </div>
                  )}
                </div>

                {/* Dolby Atmos & Platform Compatibility Status Card (Part 5 Honesty) */}
                <div className="p-3 rounded-2xl bg-[var(--surface-secondary)]/60 border border-[var(--border)] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                      <Shield className="w-3.5 h-3.5 text-amber-500" />
                      <span>Dolby Atmos &amp; Platform Audio Compatibility</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        isDolbyHardwareSupported
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                      }`}
                    >
                      {isDolbyHardwareSupported ? 'Hardware Active' : 'Limited by Platform'}
                    </span>
                  </div>

                  {isDolbyHardwareSupported ? (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center gap-2">
                        {['off', 'auto', 'music', 'movie', 'voice'].map((m) => (
                          <button
                            key={m}
                            onClick={() => setDolbyMode(m)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                              activeDolbyMode === m
                                ? 'bg-[var(--accent)] text-white'
                                : 'bg-[var(--surface-card)] text-[var(--text-secondary)]'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      <strong className="text-[var(--text-primary)]">Dolby Atmos Bitstream:</strong>{' '}
                      Hardware / license-limited on standard Web Audio and WebView engines. Proprietary
                      Dolby AC-4 bitstream decoding requires certified hardware or OEM HAL.
                    </p>
                  )}
                  <p className="text-[11px] text-emerald-500 font-medium">
                    ✓ Genuine Web Audio 3D Binaural HRTF Panner and Haas Virtual Surround DSP are active.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: DISPLAY & MOTION SETTINGS */}
            {homeStudioTab === 'display' && (
              <div className="space-y-4">
                {/* Layout Density */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] block">
                    Layout Density
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'compact', label: 'Compact Layout', desc: 'Higher density, compact spacing' },
                      { id: 'comfortable', label: 'Comfortable Layout', desc: 'Spacious cards, relaxed listening' },
                    ].map((den) => {
                      const isActive = settings.uiDensity === den.id;
                      return (
                        <button
                          key={den.id}
                          onClick={() => {
                            setDensity(den.id as UiDensity);
                            updateSettings({ uiDensity: den.id as UiDensity });
                          }}
                          className={`flex flex-col text-left p-3 rounded-2xl border transition-all active:scale-95 ${
                            isActive
                              ? 'bg-[var(--surface-secondary)] text-[var(--accent)] border-[var(--accent)] ring-1 ring-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="text-xs font-bold">{den.label}</span>
                          <span className="text-[10px] text-[var(--text-muted)] mt-0.5">{den.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reduced Motion Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)]">
                  <div>
                    <span className="text-xs font-bold text-[var(--text-primary)] block">
                      Reduced Motion
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      Disable spinning vinyl and pulse animations for performance
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      updateSettings({
                        visualizerReducedMotion: !settings.visualizerReducedMotion,
                      })
                    }
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      settings.visualizerReducedMotion
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'bg-[var(--surface-card)] text-[var(--text-secondary)] border border-[var(--border)]'
                    }`}
                  >
                    {settings.visualizerReducedMotion ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Recently Played Tracks Carousel / List */}
      {recentTracks.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--accent)]" />
              <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Recently Played Songs
              </h3>
            </div>
            <button
              onClick={() => onNavigate?.('library')}
              className="text-[11px] text-[var(--accent)] hover:underline font-semibold flex items-center gap-0.5"
            >
              <span>See All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTracks
            .filter((t) => {
              if (homeFilter === 'local') return t.source !== 'online';
              if (homeFilter === 'online') return t.source === 'online';
              if (homeFilter === 'favorites') return t.isFavorite;
              return true;
            })
            .slice(0, 8).length === 0 ? (
            <div className="p-6 text-center rounded-2xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] text-xs text-[var(--text-muted)]">
              No tracks found matching this filter.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {recentTracks
                .filter((t) => {
                  if (homeFilter === 'local') return t.source !== 'online';
                  if (homeFilter === 'online') return t.source === 'online';
                  if (homeFilter === 'favorites') return t.isFavorite;
                  return true;
                })
                .slice(0, 8)
                .map((track) => {
                  const coverUrl =
                    track.coverArtUrl || generateVibrantCover(track.title, track.artist);

                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, recentTracks)}
                      className="flex flex-col p-2.5 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 cursor-pointer transition-all shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-full aspect-square rounded-xl overflow-hidden bg-[var(--surface-secondary)] border border-[var(--border-subtle)] relative shadow-sm mb-2">
                        <img
                          src={coverUrl}
                          alt={track.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = generateVibrantCover(
                              track.title,
                              track.artist
                            );
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white shadow-lg">
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          </div>
                        </div>

                        {track.source === 'online' && (
                          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold uppercase backdrop-blur-sm">
                            Online
                          </div>
                        )}
                      </div>

                      <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                        {track.artist}
                      </p>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* 5. Popular Playlists Section */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Popular Playlists
            </h3>
          </div>
          <button
            onClick={() => onNavigate?.('playlists')}
            className="text-[11px] text-[var(--accent)] hover:underline font-semibold flex items-center gap-0.5"
          >
            <span>See All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              id: 'favorites',
              title: 'Liked Songs',
              desc: 'Your favorites',
              gradient: 'from-purple-600 to-pink-600',
              icon: Heart,
              route: 'favorites' as const,
            },
            {
              id: 'chill',
              title: 'Chill Vibes',
              desc: 'Relax & lo-fi beats',
              gradient: 'from-indigo-600 to-cyan-600',
              icon: Music2,
              route: 'playlists' as const,
            },
            {
              id: 'workout',
              title: 'Workout Energy',
              desc: 'High BPM pump',
              gradient: 'from-orange-600 to-rose-600',
              icon: Sparkles,
              route: 'playlists' as const,
            },
            {
              id: 'focus',
              title: 'Deep Focus',
              desc: 'Ambient soundscapes',
              gradient: 'from-emerald-600 to-teal-600',
              icon: Disc3,
              route: 'playlists' as const,
            },
          ].map((pl) => {
            const Icon = pl.icon;
            return (
              <div
                key={pl.id}
                onClick={() => onNavigate?.(pl.route)}
                className="flex flex-col p-3 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 cursor-pointer transition-all shadow-md group active:scale-[0.98]"
              >
                <div
                  className={`w-full aspect-square rounded-xl bg-gradient-to-tr ${pl.gradient} flex items-center justify-center text-white shadow-lg mb-2 group-hover:scale-105 transition-transform`}
                >
                  <Icon className="w-8 h-8 drop-shadow" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                  {pl.title}
                </h4>
                <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">
                  {pl.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

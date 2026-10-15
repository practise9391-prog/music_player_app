import React, { useEffect, useState, useMemo } from 'react';
import {
  Track,
  Album,
  Artist,
  PlaylistRecord,
  MusicFolderRecord,
} from '../types';
import {
  TrackRepository,
  PlaylistRepository,
  FolderRepository,
} from '../database/repository';
import { usePlayer } from '../player/PlayerContext';
import { generateVibrantCover } from '../library/artworkCache';
import { ContextMenu } from '../components/ui/ContextMenu';
import { AddToPlaylistModal } from '../components/playlists/AddToPlaylistModal';
import { TrackInfoModal } from '../components/modals/TrackInfoModal';
import { AlbumDetailsModal } from '../components/modals/AlbumDetailsModal';
import { ArtistDetailsModal } from '../components/modals/ArtistDetailsModal';
import { notificationService } from '../services/errorService';
import {
  Play,
  Pause,
  Shuffle,
  Star,
  Clock,
  Disc3,
  Folder,
  FolderPlus,
  ArrowUpDown,
  MoreVertical,
  ChevronRight,
  Heart,
  Video,
  Music2,
  Users,
  Search,
  Sparkles,
  Sliders,
  ListMusic,
  Plus,
  Check,
  RefreshCw,
} from 'lucide-react';
import { nativeMediaStoreService } from '../services/android/NativeMediaStoreService';

export type HomeTab = 'songs' | 'videos' | 'artists' | 'albums' | 'folders';
export type QuickFilter = 'all' | 'favorites' | 'offline' | 'lossless' | 'recent';

interface HomePageProps {
  onOpenFolder: () => void;
  onAddMusic: () => void;
  onNavigateToOnline: () => void;
  onOpenFullPlayer: () => void;
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

export const HomePage: React.FC<HomePageProps> = ({
  onOpenFolder,
  onAddMusic,
  onNavigateToOnline,
  onOpenFullPlayer,
  onNavigate,
  onOpenSearchModal,
  onOpenIdentifyModal,
  searchQuery = '',
}) => {
  const {
    playTrack,
    playPlaylist,
    shufflePlaylist,
    togglePlayPause,
    toggleFavorite,
    addToQueue,
    playNext,
    currentTrack,
    state: engineState,
  } = usePlayer();

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<HomeTab>('songs');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [sortField, setSortField] = useState<'title' | 'artist' | 'album' | 'dateAdded'>('title');
  const [sortAsc, setSortAsc] = useState(true);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Data States
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [folders, setFolders] = useState<MusicFolderRecord[]>([]);
  const [recentTracks, setRecentTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Interactive States
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedTrackForInfo, setSelectedTrackForInfo] = useState<Track | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<Track[] | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    track: Track;
  } | null>(null);

  // Load all library data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allTracks, allAlbums, allArtists, allPlaylists, allFolders] = await Promise.all([
        TrackRepository.getAll(),
        TrackRepository.getAlbums(),
        TrackRepository.getArtists(),
        PlaylistRepository.getAll(),
        FolderRepository.getAll(),
      ]);

      setTracks(allTracks);
      setAlbums(allAlbums);
      setArtists(allArtists);
      setPlaylists(allPlaylists);
      setFolders(allFolders);

      // Most recent tracks for the top recent card
      const recent = [...allTracks]
        .filter((t) => (t.lastPlayedAt || 0) > 0)
        .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
      setRecentTracks(recent.length > 0 ? recent : allTracks.slice(0, 20));
    } catch (err) {
      console.warn('Failed to load home data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdated = () => loadData();
    window.addEventListener('nova-playlists-updated', handleUpdated);
    window.addEventListener('nova-library-updated', handleUpdated);
    return () => {
      window.removeEventListener('nova-playlists-updated', handleUpdated);
      window.removeEventListener('nova-library-updated', handleUpdated);
    };
  }, []);

  // Filtered and sorted songs
  const processedTracks = useMemo(() => {
    let result = [...tracks];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.artist.toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q))
      );
    }

    // Quick filter chips
    if (quickFilter === 'favorites') {
      result = result.filter((t) => t.isFavorite);
    } else if (quickFilter === 'offline') {
      result = result.filter((t) => t.source === 'local');
    } else if (quickFilter === 'lossless') {
      result = result.filter((t) => ['flac', 'wav', 'alac'].includes(t.format?.toLowerCase() || ''));
    } else if (quickFilter === 'recent') {
      result = result.filter((t) => (t.lastPlayedAt || 0) > 0);
      result.sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
      return result;
    }

    // Sorting
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortField === 'artist') {
        cmp = a.artist.localeCompare(b.artist);
      } else if (sortField === 'album') {
        cmp = (a.album || '').localeCompare(b.album || '');
      } else if (sortField === 'dateAdded') {
        cmp = (a.dateAdded || 0) - (b.dateAdded || 0);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [tracks, searchQuery, quickFilter, sortField, sortAsc]);

  // Favorites count
  const favoritesCount = useMemo(() => tracks.filter((t) => t.isFavorite).length, [tracks]);

  // Handle playing all tracks with shuffle
  const handleShuffleAll = () => {
    if (processedTracks.length > 0) {
      shufflePlaylist(processedTracks);
      notificationService.success('Shuffle Playback', `Playing ${processedTracks.length} tracks.`);
    }
  };

  const isAudioPlaying = engineState.status === 'playing';

  return (
    <div className="flex-1 overflow-y-auto px-3 sm:px-5 md:px-8 py-3 sm:py-5 space-y-4 sm:space-y-6 max-w-5xl mx-auto select-none">
      {/* 1. TOP 3 VIBRANT QUICK ACTION CARDS (Matching Reference Screenshots) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Card 1: Favorites (Vibrant Royal Purple Gradient) */}
        <button
          onClick={() => {
            setActiveTab('songs');
            setQuickFilter('favorites');
          }}
          className="relative overflow-hidden rounded-2xl p-3 sm:p-4 text-left transition-all duration-200 shadow-lg active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Star className="w-4 h-4 sm:w-5 sm:h-5 text-white fill-current" />
          </div>
          <div className="text-xs sm:text-base font-extrabold text-white tracking-tight truncate">
            Favorites
          </div>
          <div className="text-[10px] sm:text-xs text-white/80 font-medium">
            {favoritesCount} songs
          </div>
        </button>

        {/* Card 2: Playlists (Vibrant Emerald / Teal Gradient) */}
        <button
          onClick={() => {
            if (onNavigate) {
              onNavigate('playlists');
            }
          }}
          className="relative overflow-hidden rounded-2xl p-3 sm:p-4 text-left transition-all duration-200 shadow-lg active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #0d9488 0%, #059669 100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="text-xs sm:text-base font-extrabold text-white tracking-tight truncate">
            Playlists
          </div>
          <div className="text-[10px] sm:text-xs text-white/80 font-medium">
            {playlists.length} lists
          </div>
        </button>

        {/* Card 3: Recent (Vibrant Orange / Amber Gradient) */}
        <button
          onClick={() => {
            if (onNavigate) {
              onNavigate('history');
            } else {
              setActiveTab('songs');
              setQuickFilter('recent');
            }
          }}
          className="relative overflow-hidden rounded-2xl p-3 sm:p-4 text-left transition-all duration-200 shadow-lg active:scale-95 group"
          style={{
            background: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="text-xs sm:text-base font-extrabold text-white tracking-tight truncate">
            Recent
          </div>
          <div className="text-[10px] sm:text-xs text-white/80 font-medium">
            {recentTracks.length} played
          </div>
        </button>
      </div>

      {/* 2. RECENT / CURRENTLY PLAYED ANIMATED CARD (Requirement 7) */}
      {currentTrack && (
        <div
          onClick={onOpenFullPlayer}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/60 via-slate-900/80 to-purple-950/40 border border-purple-500/30 p-3 sm:p-4 cursor-pointer shadow-xl transition-all duration-300 hover:border-purple-400 group"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Spinning 3D Vinyl / Movie Artwork */}
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 shadow-md border-2 border-purple-500/40">
              <img
                src={currentTrack.coverArtUrl || generateVibrantCover(currentTrack.title, currentTrack.artist)}
                alt={currentTrack.title}
                className={`w-full h-full object-cover ${isAudioPlaying ? 'animate-spin-slow' : ''}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = generateVibrantCover(currentTrack.title, currentTrack.artist);
                }}
              />
              <div className="absolute inset-0 m-auto w-3.5 h-3.5 rounded-full bg-black/80 border border-purple-400" />
            </div>

            {/* Track Info & Animated Equalizer Waves */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  {isAudioPlaying ? 'NOW PLAYING' : 'RECENTLY PLAYED'}
                </span>
                {/* Bouncing audio equalizer bars when active */}
                {isAudioPlaying && (
                  <div className="flex items-end gap-0.5 h-3.5">
                    <span className="w-0.5 h-2.5 bg-purple-400 rounded-full animate-pulse" />
                    <span className="w-0.5 h-3.5 bg-pink-400 rounded-full animate-pulse delay-75" />
                    <span className="w-0.5 h-2 bg-cyan-400 rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                {currentTrack.title}
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {currentTrack.artist} {currentTrack.album ? `• ${currentTrack.album}` : ''}
              </p>
            </div>

            {/* Quick Play/Pause Action Button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlayPause();
                }}
                className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90"
              >
                {isAudioPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. HORIZONTAL CATEGORY NAVIGATION TABS (Matching Reference Screenshots) */}
      <div className="flex items-center border-b border-[var(--border)] overflow-x-auto no-scrollbar pt-1">
        {(
          [
            { id: 'songs', label: 'Songs' },
            { id: 'videos', label: 'Videos' },
            { id: 'artists', label: 'Artists' },
            { id: 'albums', label: 'Albums' },
            { id: 'folders', label: 'Folders' },
          ] as { id: HomeTab; label: string }[]
        ).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative px-3 sm:px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
            >
              <span
                className={`${
                  isActive
                    ? 'text-white font-extrabold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </span>
              {/* Vibrant Active Tab Underline Pill (Matching Reference) */}
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* 4. SUB-ACTION BAR: SHUFFLE PLAYBACK & SORT CONTROLS */}
      <div className="flex items-center justify-between gap-3 pt-1">
        {/* Shuffle playback button (Vibrant purple circle + text) */}
        <button
          onClick={handleShuffleAll}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] font-bold text-xs sm:text-sm transition-colors active:scale-95 group"
        >
          <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md group-hover:bg-purple-500">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
          <span>Shuffle playback</span>
        </button>

        {/* Sort and Options */}
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={async () => {
              if (nativeMediaStoreService.isNative()) {
                await nativeMediaStoreService.scanAndImport();
                loadData();
              } else {
                loadData();
              }
            }}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-purple-400 hover:bg-[var(--surface-secondary)] transition-colors"
            title="Scan & Sync Device Music (Internal & SD Card)"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setSortAsc(!sortAsc)}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
            title="Toggle Sort Order"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          {activeTab === 'folders' && (
            <button
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Add Folder</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. VIBRANT CUSTOMIZE FILTER CHIPS (Requirement 8) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'favorites', label: 'Favorites ★' },
            { id: 'offline', label: 'Offline ⚡' },
            { id: 'lossless', label: 'Lossless 🎧' },
            { id: 'recent', label: 'Recent 🕒' },
          ] as { id: QuickFilter; label: string }[]
        ).map((f) => {
          const isSelected = quickFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setQuickFilter(f.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150 ${
                isSelected
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md font-bold border border-purple-400/40'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 6. TAB CONTENT VIEWS (Matching Reference Screenshots 1, 2, 3) */}

      {/* TAB A: SONGS LIST (Matching Reference Screenshot 2) */}
      {activeTab === 'songs' && (
        <div className="space-y-1.5">
          {processedTracks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
              <Music2 className="w-12 h-12 text-purple-400 mx-auto opacity-50" />
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">No Songs Found</h3>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  Scan a music folder from your phone to load all your songs automatically.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (nativeMediaStoreService.isNative()) {
                      await nativeMediaStoreService.scanAndImport();
                      loadData();
                    } else if (onOpenFolder) {
                      onOpenFolder();
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Auto Scan Device Music
                </button>
                <button
                  onClick={onOpenFolder}
                  className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white text-xs font-medium transition-all border border-[var(--border)] flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4" /> Pick Folder
                </button>
              </div>
            </div>
          ) : (
            processedTracks.map((track) => {
              const coverUrl =
                track.coverArtUrl || generateVibrantCover(track.title, track.artist);

              return (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, processedTracks)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--surface-secondary)] cursor-pointer group transition-colors border border-transparent hover:border-[var(--border-subtle)]"
                >
                  {/* Left: 48x48 Rounded Movie Poster / Artwork */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[var(--surface-card)] border border-[var(--border-subtle)] relative shadow-sm">
                      <img
                        src={coverUrl}
                        alt={track.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = generateVibrantCover(track.title, track.artist);
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs sm:text-sm text-white truncate group-hover:text-purple-300 transition-colors">
                        {track.title}
                      </div>
                      <div className="text-[11px] sm:text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">
                          {track.artist} {track.album ? `| ${track.album}` : ''}{' '}
                          {track.year ? `- (${track.year})` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Favorite Toggle & Context Menu (3 Dots) */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(track.id);
                      }}
                      className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                      title="Toggle Favorite"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          track.isFavorite ? 'text-rose-500 fill-current' : ''
                        }`}
                      />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenuState({ x: e.clientX, y: e.clientY, track });
                      }}
                      className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-white transition-colors"
                      title="Song Options"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB B: ALBUMS (Matching Reference Screenshot 1) */}
      {activeTab === 'albums' && (
        <div className="space-y-2">
          {albums.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
              No albums discovered yet. Scan a folder containing music tracks.
            </div>
          ) : (
            albums.map((album) => {
              const coverUrl =
                album.coverArtUrl || generateVibrantCover(album.title, album.artist);

              return (
                <div
                  key={album.id}
                  onClick={() => setSelectedAlbum(album)}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-purple-500/40 cursor-pointer transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* 52x52 Rounded Movie Poster */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[var(--surface-secondary)] border border-[var(--border-subtle)] shadow-md">
                      <img
                        src={coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = generateVibrantCover(album.title, album.artist);
                        }}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                        {album.title}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {album.artist}
                      </p>
                      <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                        {album.trackCount} track{album.trackCount !== 1 ? 's' : ''} •{' '}
                        {formatDuration(album.duration)}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white group-hover:translate-x-0.5 transition-all shrink-0 ml-3" />
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB C: FOLDERS (Matching Reference Screenshot 3) */}
      {activeTab === 'folders' && (
        <div className="space-y-2">
          {folders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
              <Folder className="w-12 h-12 text-purple-400 mx-auto opacity-50" />
              <div className="text-sm font-semibold text-white">No Music Folders Added</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Add your phone's Music or Audio directory to manage all your songs by folder.
              </p>
              <button
                onClick={onOpenFolder}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4" /> Add Music Folder
              </button>
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.path}
                onClick={() => {
                  setActiveTab('songs');
                }}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-purple-500/40 cursor-pointer transition-all shadow-sm group"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Purple Folder Icon */}
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Folder className="w-6 h-6 fill-current" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                      {folder.path.split('/').filter(Boolean).pop() || 'Music'}
                    </h4>
                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5 font-mono">
                      {folder.trackCount} songs | {folder.path}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-white transition-colors shrink-0 ml-3" />
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB D: ARTISTS */}
      {activeTab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {artists.length === 0 ? (
            <div className="col-span-full p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
              No artists discovered yet.
            </div>
          ) : (
            artists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => setSelectedArtist(artist)}
                className="p-4 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-purple-500/40 cursor-pointer transition-all text-center space-y-2.5 group shadow-sm"
              >
                <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-purple-600/20 border-2 border-purple-500/40 flex items-center justify-center text-purple-300 font-black text-xl shadow-md group-hover:scale-105 transition-transform">
                  <Users className="w-8 h-8" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                    {artist.name}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)] font-mono">
                    {artist.trackCount} song{artist.trackCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB E: VIDEOS */}
      {activeTab === 'videos' && (
        <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
          <Video className="w-12 h-12 text-purple-400 mx-auto opacity-50" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Music Videos &amp; Streaming</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
              Stream or cache online music videos without tracking.
            </p>
          </div>
          <button
            onClick={onNavigateToOnline}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" /> Open Online Music Discovery
          </button>
        </div>
      )}

      {/* Track Context Menu */}
      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          track={contextMenuState.track}
          onClose={() => setContextMenuState(null)}
          onPlay={(track) => playTrack(track, processedTracks)}
          onPlayNext={(track) => playNext(track)}
          onAddToQueue={(track) => addToQueue(track)}
          onAddToPlaylist={(track) => setPlaylistModalTracks([track])}
          onToggleFavorite={(track) => toggleFavorite(track.id)}
          onShowProperties={(track) => setSelectedTrackForInfo(track)}
        />
      )}

      {/* Add To Playlist Modal */}
      {playlistModalTracks && (
        <AddToPlaylistModal
          isOpen={true}
          trackOrTracks={playlistModalTracks}
          onClose={() => setPlaylistModalTracks(null)}
        />
      )}

      {/* Album Details Modal */}
      {selectedAlbum && (
        <AlbumDetailsModal
          isOpen={true}
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
        />
      )}

      {/* Artist Details Modal */}
      {selectedArtist && (
        <ArtistDetailsModal
          isOpen={true}
          artist={selectedArtist}
          onClose={() => setSelectedArtist(null)}
        />
      )}

      {/* Track Info Modal */}
      {selectedTrackForInfo && (
        <TrackInfoModal
          isOpen={true}
          track={selectedTrackForInfo}
          onClose={() => setSelectedTrackForInfo(null)}
        />
      )}
    </div>
  );
};

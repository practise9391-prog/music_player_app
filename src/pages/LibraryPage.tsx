import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Track,
  Album,
  Artist,
  FolderNode,
  MusicFolderRecord,
} from '../types';
import {
  TrackRepository,
  FolderRepository,
} from '../database/repository';
import { usePlayer } from '../player/PlayerContext';
import { nativeMediaStoreService } from '../services/android/NativeMediaStoreService';
import { notificationService } from '../services/errorService';
import { ContextMenu } from '../components/ui/ContextMenu';
import { AddToPlaylistModal } from '../components/playlists/AddToPlaylistModal';
import { AlbumDetailsModal } from '../components/modals/AlbumDetailsModal';
import { FolderDetailsModal } from '../components/modals/FolderDetailsModal';
import { TrackInfoModal } from '../components/modals/TrackInfoModal';
import { generateVibrantCover } from '../library/artworkCache';
import {
  Music2,
  Disc,
  Folder,
  Heart,
  Search,
  MoreVertical,
  Play,
  Shuffle,
  RefreshCw,
  ChevronUp,
  ArrowUpDown,
  Clock,
} from 'lucide-react';

import { VerticalAlphabetNavigator } from '../components/library/VerticalAlphabetNavigator';

export type LibraryTab = 'songs' | 'albums' | 'folders' | 'favorites';
export type SortOption = 'title' | 'artist' | 'album' | 'dateAdded' | 'duration';

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface LibraryPageProps {
  initialTab?: LibraryTab;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({
  initialTab = 'songs',
  searchQuery: externalSearchQuery,
  onSearchChange,
}) => {
  const {
    playTrack,
    currentTrack,
    toggleFavorite,
    addToQueue,
    playNext,
    shufflePlaylist,
  } = usePlayer();

  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation & Filter States
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = onSearchChange || setInternalSearchQuery;

  const [selectedLetter, setSelectedLetter] = useState<string>('All');
  const [selectedAlbumLetter, setSelectedAlbumLetter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortOption>('title');
  const [sortAsc, setSortAsc] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Swipe-Down-To-Refresh State
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  // Data States
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [folders, setFolders] = useState<MusicFolderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals & Context Menus
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null);
  const [trackInfoTrack, setTrackInfoTrack] = useState<Track | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<Track[] | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    track: Track;
  } | null>(null);

  // Load Library Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTracks, allAlbums, allFolders] = await Promise.all([
        TrackRepository.getAll(),
        TrackRepository.getAlbums(),
        FolderRepository.getAll(),
      ]);

      setTracks(allTracks);
      setAlbums(allAlbums);
      setFolders(allFolders);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('nova-library-updated', handleUpdate);
    return () => window.removeEventListener('nova-library-updated', handleUpdate);
  }, [loadData]);

  // Handle Rescan Media
  const handleRescan = async () => {
    setIsScanning(true);
    try {
      const result = await nativeMediaStoreService.scanAndImport();
      if (result) {
        notificationService.success(
          'Library Synced',
          `Discovered ${result.total} audio files (${result.added} new).`
        );
      }
      await loadData();
    } catch (err: any) {
      notificationService.error('Scan Error', err?.message || 'Could not scan audio files.');
    } finally {
      setIsScanning(false);
    }
  };

  // Processed Songs (Search, Filter, Sort)
  const processedTracks = useMemo(() => {
    let result = [...tracks];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.artist || '').toLowerCase().includes(q) ||
          (t.album && t.album.toLowerCase().includes(q)) ||
          (t.filename && t.filename.toLowerCase().includes(q))
      );
    }

    // Tab filter for Favorites
    if (activeTab === 'favorites') {
      result = result.filter((t) => t.isFavorite);
    }

    // Alphabetical Letter filter for Songs
    if (activeTab === 'songs' && selectedLetter && selectedLetter !== 'All') {
      if (selectedLetter === '#') {
        result = result.filter((t) => !/^[a-zA-Z]/.test((t.title || '').trim()));
      } else {
        const char = selectedLetter.toUpperCase();
        result = result.filter((t) => (t.title || '').trim().toUpperCase().startsWith(char));
      }
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'title') {
        cmp = (a.title || '').localeCompare(b.title || '');
      } else if (sortField === 'artist') {
        cmp = (a.artist || '').localeCompare(b.artist || '');
      } else if (sortField === 'album') {
        cmp = (a.album || '').localeCompare(b.album || '');
      } else if (sortField === 'dateAdded') {
        cmp = (a.dateAdded || 0) - (b.dateAdded || 0);
      } else if (sortField === 'duration') {
        cmp = (a.duration || 0) - (b.duration || 0);
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [tracks, searchQuery, activeTab, selectedLetter, sortField, sortAsc]);

  // Processed Albums (Search filter + Alphabetical A-Z letter filter)
  const processedAlbums = useMemo(() => {
    let result = [...albums];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (a) => (a.title || '').toLowerCase().includes(q) || (a.artist || '').toLowerCase().includes(q)
      );
    }
    if (selectedAlbumLetter && selectedAlbumLetter !== 'ALL') {
      if (selectedAlbumLetter === '#') {
        result = result.filter((a) => !/^[a-zA-Z]/.test((a.title || '').trim()));
      } else {
        const char = selectedAlbumLetter.toUpperCase();
        result = result.filter((a) => (a.title || '').trim().toUpperCase().startsWith(char));
      }
    }
    return result;
  }, [albums, searchQuery, selectedAlbumLetter]);

  // Processed Folders (Search filter)
  const processedFolders = useMemo(() => {
    if (!searchQuery.trim()) return folders;
    const q = searchQuery.toLowerCase().trim();
    return folders.filter((f) => (f.path || '').toLowerCase().includes(q));
  }, [folders, searchQuery]);

  // Favorite Songs count
  const favoritesCount = useMemo(() => tracks.filter((t) => t.isFavorite).length, [tracks]);

  // Tab definitions: Exactly Songs, Albums, Folders, Favorites (No Artists tab)
  const tabs: { id: LibraryTab; label: string; icon: React.ComponentType<{ className?: string }>; count: number }[] = [
    { id: 'songs', label: 'Songs', icon: Music2, count: tracks.length },
    { id: 'albums', label: 'Albums', icon: Disc, count: albums.length },
    { id: 'folders', label: 'Folders', icon: Folder, count: folders.length },
    { id: 'favorites', label: 'Favorites', icon: Heart, count: favoritesCount },
  ];

  // Open folder details
  const handleOpenFolder = async (folderPath: string) => {
    const hierarchy = await TrackRepository.getFolderHierarchy();
    const found = hierarchy.find((node) => node.path === folderPath);
    if (found) {
      setSelectedFolder(found);
    }
  };

  // Set of letters that actually have songs in the collection
  const availableLetters = useMemo(() => {
    const set = new Set<string>();
    tracks.forEach((t) => {
      const firstChar = (t.title || '').trim().charAt(0).toUpperCase();
      if (/^[A-Z]$/.test(firstChar)) {
        set.add(firstChar);
      } else if (firstChar) {
        set.add('#');
      }
    });
    return set;
  }, [tracks]);

  // Smooth scroll and letter selection handler
  const handleSelectLetter = useCallback(
    (letter: string) => {
      setSelectedLetter(letter);
      if (letter === 'All') {
        containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const targetIdx = processedTracks.findIndex((t) => {
        const first = (t.title || '').trim().charAt(0).toUpperCase();
        return letter === '#' ? !/^[A-Z]$/.test(first) : first === letter;
      });
      if (targetIdx >= 0) {
        const el = document.getElementById(`track-row-${targetIdx}`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [processedTracks]
  );

  // Swipe pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop <= 0) {
      touchStartY.current = e.touches[0].clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isScanning) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop <= 0) {
      setPullDistance(Math.min(diff * 0.45, 80));
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance >= 50 && !isScanning) {
      setPullDistance(0);
      await handleRescan();
    } else {
      setPullDistance(0);
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 200)}
      className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-8 py-3 sm:py-5 select-none relative scroll-smooth space-y-4 max-w-5xl mx-auto"
    >
      {/* Swipe Down Pull Indicator */}
      {pullDistance > 0 && (
        <div
          style={{ height: `${pullDistance}px` }}
          className="flex items-center justify-center overflow-hidden transition-all duration-75 text-purple-400"
        >
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-xs font-semibold backdrop-blur-md">
            <RefreshCw
              className={`w-4 h-4 ${pullDistance >= 50 ? 'animate-spin text-cyan-400' : ''}`}
              style={{ transform: `rotate(${pullDistance * 4}deg)` }}
            />
            <span>{pullDistance >= 50 ? 'Release to scan library' : 'Pull down to refresh'}</span>
          </div>
        </div>
      )}
      {/* 1. Category Tabs & Rescan Action (Clean single-row header) */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Rescan / Refresh Button with Radar Scan Animation */}
        <button
          onClick={handleRescan}
          disabled={isScanning}
          className="relative p-2.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-purple-300 transition-colors shrink-0 shadow-sm flex items-center gap-1.5"
          title="Rescan Device Audio"
          aria-label="Rescan Device Audio"
        >
          {isScanning && (
            <span className="absolute inset-0 rounded-xl bg-purple-500/20 animate-ping pointer-events-none" />
          )}
          <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-purple-400' : ''}`} />
          {isScanning && <span className="text-[10px] font-bold text-purple-400">Scanning...</span>}
        </button>
      </div>

      {/* 3. Toolbar / Sort Header for Songs and Favorites */}
      {(activeTab === 'songs' || activeTab === 'favorites') && (
        <div className="flex items-center justify-between px-1 text-xs">
          <div className="text-[11px] text-[var(--text-muted)] font-mono">
            {processedTracks.length} song{processedTracks.length !== 1 ? 's' : ''}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'favorites' && processedTracks.length > 0 && (
              <button
                onClick={() => shufflePlaylist(processedTracks)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-semibold transition-colors shadow-sm active:scale-95"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Shuffle All</span>
              </button>
            )}

            <div className="flex items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-xl px-2 py-1">
              <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortOption)}
                className="bg-transparent text-[var(--text-primary)] text-xs outline-none cursor-pointer"
              >
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="dateAdded">Date Added</option>
                <option value="duration">Duration</option>
              </select>
              <button
                onClick={() => setSortAsc(!sortAsc)}
                className="px-1 text-[10px] font-bold text-purple-400 hover:underline"
              >
                {sortAsc ? '▲ ASC' : '▼ DESC'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Tab Content */}

      {/* TAB A: SONGS or FAVORITES */}
      {(activeTab === 'songs' || activeTab === 'favorites') && (
        <div className="flex gap-2 relative items-start">
          <div className="flex-1 space-y-1.5 min-w-0">
            {processedTracks.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-2">
                <Music2 className="w-8 h-8 mx-auto opacity-50 text-purple-400" />
                <p className="font-semibold text-[var(--text-secondary)]">
                  {isLoading ? 'Loading your library...' : activeTab === 'favorites' ? 'No favorite songs yet' : 'No songs found'}
                </p>
                <p className="text-[11px]">
                  {activeTab === 'favorites'
                    ? 'Tap the heart icon on any song to add it to your favorites.'
                    : 'Tap the rescan icon at the top right to discover music on your device.'}
                </p>
              </div>
            ) : (
              processedTracks.map((track, idx) => {
                const coverUrl =
                  track.coverArtUrl || generateVibrantCover(track.title, track.artist);
                const isCurrent = currentTrack?.id === track.id;

                return (
                  <div
                    key={track.id}
                    id={`track-row-${idx}`}
                    onClick={() => playTrack(track, processedTracks)}
                    className={`flex items-center justify-between p-2.5 rounded-2xl hover:bg-[var(--surface-secondary)] cursor-pointer group transition-all border ${
                      isCurrent
                        ? 'bg-purple-950/30 border-purple-500/40 shadow-sm'
                        : 'border-transparent hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    {/* Left: 48x48 Rounded Movie / Album Artwork */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-sm">
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
                        {isCurrent && (
                          <div className="absolute inset-0 bg-purple-900/60 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white fill-current animate-pulse" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4
                          className={`text-xs sm:text-sm font-semibold truncate transition-colors ${
                            isCurrent ? 'text-purple-300 font-bold' : 'text-white group-hover:text-purple-200'
                          }`}
                        >
                          {track.title}
                        </h4>
                        <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                          {track.artist}
                          {track.album ? ` • ${track.album}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Right: Video Badge, Duration, Favorite Heart, Context Menu */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {Boolean(track.mediaType === 'video' || track.format === 'mp4' || track.format === 'mkv') && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
                          VIDEO
                        </span>
                      )}
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {formatDuration(track.duration)}
                      </span>

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
                        title="More Options"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right-Side Vertical Draggable Alphabet Navigator */}
          {activeTab === 'songs' && processedTracks.length > 0 && (
            <div className="sticky top-2 shrink-0 self-start pt-1">
              <VerticalAlphabetNavigator
                selectedLetter={selectedLetter}
                onSelectLetter={handleSelectLetter}
                availableLetters={availableLetters}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB B: ALBUMS (Movie Soundtracks Unified) */}
      {activeTab === 'albums' && (
        <div className="space-y-4">
          {/* Horizontal A–Z Alphabet Navigator */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 px-0.5">
            {['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')].map((letter) => {
              const isActive = selectedAlbumLetter === letter;
              return (
                <button
                  key={letter}
                  onClick={() => setSelectedAlbumLetter(letter)}
                  className={`min-w-[2rem] px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {processedAlbums.length === 0 ? (
              <div className="col-span-full p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
                {selectedAlbumLetter !== 'ALL'
                  ? `No albums found starting with "${selectedAlbumLetter}".`
                  : 'No albums discovered yet.'}
              </div>
            ) : (
              processedAlbums.map((album) => {
                const coverUrl =
                  album.coverArtUrl || generateVibrantCover(album.title, album.artist);

                return (
                  <div
                    key={album.id}
                    onClick={() => setSelectedAlbum(album)}
                    className="p-3 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-purple-500/40 cursor-pointer transition-all shadow-sm group active:scale-[0.98]"
                  >
                    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[var(--surface-secondary)] border border-[var(--border-subtle)] shadow-md mb-2.5">
                      <img
                        src={coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = generateVibrantCover(
                            album.title,
                            album.artist
                          );
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-current drop-shadow-lg" />
                      </div>
                    </div>

                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                      {album.title}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      {album.artist}
                    </p>
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                      {album.trackCount} track{album.trackCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB C: FOLDERS */}
      {activeTab === 'folders' && (
        <div className="space-y-2">
          {processedFolders.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
              No music folders detected.
            </div>
          ) : (
            processedFolders.map((folder) => (
              <div
                key={folder.path}
                onClick={() => handleOpenFolder(folder.path)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-purple-500/40 cursor-pointer transition-all shadow-sm group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Folder className="w-6 h-6 fill-current" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                      {folder.path.split('/').filter(Boolean).pop() || 'Music'}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5 font-mono">
                      {folder.trackCount} songs | {folder.path}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Floating "Scroll to Top" Button with Arrow Symbol */}
      {showScrollTop && (
        <button
          onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-20 right-4 sm:right-8 z-40 p-3 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-2xl hover:scale-110 active:scale-95 transition-all flex items-center justify-center animate-in fade-in zoom-in-75 duration-200 border border-white/20"
          title="Scroll to top"
          aria-label="Scroll to top"
        >
          <ChevronUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}

      {/* Modals & Menus */}
      <AlbumDetailsModal
        album={selectedAlbum}
        isOpen={Boolean(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
      />

      <FolderDetailsModal
        folder={selectedFolder}
        isOpen={Boolean(selectedFolder)}
        onClose={() => setSelectedFolder(null)}
        onAddToPlaylist={(t) => setPlaylistModalTracks(t)}
      />

      <TrackInfoModal
        track={trackInfoTrack}
        isOpen={Boolean(trackInfoTrack)}
        onClose={() => setTrackInfoTrack(null)}
      />

      <AddToPlaylistModal
        isOpen={Boolean(playlistModalTracks)}
        onClose={() => setPlaylistModalTracks(null)}
        trackOrTracks={playlistModalTracks}
      />

      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          track={contextMenuState.track}
          onClose={() => setContextMenuState(null)}
          onPlay={(t) => playTrack(t, processedTracks)}
          onAddToPlaylist={(t) => setPlaylistModalTracks([t])}
          onToggleFavorite={(t) => toggleFavorite(t.id)}
          onShowProperties={(t) => setTrackInfoTrack(t)}
        />
      )}

      {/* 5. Radar Scanning Animation Overlay */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-fade-in select-none">
          <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
            {/* Concentric radar rings */}
            <div className="absolute inset-0 rounded-full border border-purple-500/20" />
            <div className="absolute inset-8 rounded-full border border-purple-500/30" />
            <div className="absolute inset-16 rounded-full border border-purple-500/40" />
            <div className="absolute inset-24 rounded-full border border-purple-500/50" />
            <div className="absolute inset-0 rounded-full border-2 border-purple-500/40 animate-ping opacity-25" />

            {/* Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-purple-500/20" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-purple-500/20" />

            {/* Rotating radar sweep line */}
            <div
              className="absolute inset-0 rounded-full overflow-hidden animate-spin"
              style={{ animationDuration: '2s' }}
            >
              <div
                className="w-1/2 h-1/2 origin-bottom-right"
                style={{
                  background: 'conic-gradient(from 180deg at 100% 100%, rgba(168, 85, 247, 0.4) 0deg, transparent 60deg)',
                }}
              />
            </div>

            {/* Center Blip */}
            <div className="relative z-10 w-4 h-4 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 shadow-[0_0_15px_rgba(168,85,247,0.8)] animate-pulse" />
          </div>

          <div className="mt-8 text-center space-y-2">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              Scanning Local Media...
            </h3>
            <p className="text-xs text-purple-300 font-medium">
              Checking internal storage & SD card for audio files
            </p>
            <div className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--surface-card)] px-3 py-1 rounded-full border border-[var(--border)] inline-block mt-2">
              Discovered: {tracks.length} tracks
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

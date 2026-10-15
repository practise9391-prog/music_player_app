// ──────────────────────────────────────────────────────────
// GlobalSearchModal — Part 11
// Advanced Global Search, Smart Multi-Criteria Filtering,
// Smart Sorting, Category Tabs, Full Result Actions,
// Current Playing Indicator, and Offline Library Discovery.
// ──────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SearchEngine,
  GlobalSearchResults,
  SearchFilterCriteria,
  DEFAULT_SEARCH_FILTERS,
  SearchCategoryType,
  SearchSourceFilter,
  SearchDurationFilter,
  SearchQualityFilter,
  SearchSortOption,
} from '../../services/search/SearchEngine';
import {
  SearchHistoryRepository,
  PlaylistRepository,
  TrackRepository,
} from '../../database/repository';
import {
  SearchHistoryRecord,
  Track,
  Album,
  Artist,
  PlaylistRecord,
  Genre,
  FolderNode,
} from '../../types';
import { usePlayer } from '../../player/PlayerContext';
import { useSettings } from '../../settings/SettingsContext';
import { notificationService } from '../../services/errorService';
import {
  Search,
  X,
  History,
  Trash2,
  Music2,
  Users,
  Disc,
  ListMusic,
  Tag,
  Folder,
  Globe,
  Play,
  Pause,
  ArrowRight,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Filter,
  ArrowUpDown,
  ListPlus,
  Heart,
  Share2,
  Info,
  Check,
  RefreshCw,
  MoreVertical,
  SlidersHorizontal,
  ArrowLeft,
} from 'lucide-react';
import { AlbumDetailsModal } from '../modals/AlbumDetailsModal';
import { ArtistDetailsModal } from '../modals/ArtistDetailsModal';
import { GenreDetailsModal } from '../modals/GenreDetailsModal';
import { FolderDetailsModal } from '../modals/FolderDetailsModal';
import { TrackPropertiesModal } from '../modals/TrackPropertiesModal';
import { AddToPlaylistModal } from '../playlists/AddToPlaylistModal';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  onSelectAlbum?: (album: Album) => void;
  onSelectArtist?: (artist: Artist) => void;
  onSelectPlaylist?: (playlist: PlaylistRecord) => void;
  onSelectGenre?: (genre: Genre) => void;
  onRescanLibrary?: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
  onSelectAlbum,
  onSelectArtist,
  onSelectPlaylist,
  onSelectGenre,
  onRescanLibrary,
}) => {
  const {
    playTrack,
    playPlaylist,
    playCachedYouTubeTrack,
    playYouTubeUrl,
    addToQueue,
    playNext,
    toggleFavorite,
    currentTrack,
    state: playerState,
    togglePlayPause,
  } = usePlayer();

  const { settings, updateSettings } = useSettings();

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<GlobalSearchResults | null>(null);
  const [history, setHistory] = useState<SearchHistoryRecord[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<SearchCategoryType>('all');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<SearchFilterCriteria>(DEFAULT_SEARCH_FILTERS);

  // Sub-modal states
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null);
  const [propertiesTrack, setPropertiesTrack] = useState<Track | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<Track[] | null>(null);
  const [actionMenuTrackId, setActionMenuTrackId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const loadHistory = useCallback(async () => {
    const list = await SearchHistoryRepository.getRecent(10);
    setHistory(list);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      setQuery(initialQuery);
      if (initialQuery) {
        handleSearch(initialQuery, filters);
      }
      setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
    } else {
      setResults(null);
      setSuggestions([]);
      setIsFilterPanelOpen(false);
      setActionMenuTrackId(null);
    }
  }, [isOpen, initialQuery, loadHistory]);

  const handleSearch = async (searchTerm: string, currentFilters: SearchFilterCriteria) => {
    if (!searchTerm.trim() && currentFilters.source === 'all' && currentFilters.duration === 'all' && currentFilters.quality === 'all' && (!currentFilters.formats || currentFilters.formats.length === 0)) {
      setResults(null);
      setSuggestions([]);
      return;
    }

    const res = await SearchEngine.executeGlobalSearch(searchTerm, currentFilters);
    setResults(res);

    if (searchTerm.trim()) {
      const sugg = await SearchEngine.generateSuggestions(searchTerm, 5);
      setSuggestions(sugg);
    } else {
      setSuggestions([]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleSearch(val, filters);
    }, 150);
  };

  const commitSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setQuery(clean);

    if (settings.saveSearchHistory !== false) {
      await SearchHistoryRepository.addSearch(clean);
      await loadHistory();
    }

    handleSearch(clean, filters);
  };

  const handleFilterChange = (newFilters: Partial<SearchFilterCriteria>) => {
    const updated = { ...filters, ...newFilters };
    setFilters(updated);
    handleSearch(query, updated);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_SEARCH_FILTERS);
    handleSearch(query, DEFAULT_SEARCH_FILTERS);
  };

  const handleTabChange = (tab: SearchCategoryType) => {
    setActiveTab(tab);
    handleFilterChange({ type: tab });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isFilterPanelOpen) {
        setIsFilterPanelOpen(false);
      } else {
        onClose();
      }
    } else if (e.key === 'Enter') {
      if (query.trim()) {
        commitSearch(query);
      }
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id?: number) => {
    e.stopPropagation();
    if (id !== undefined) {
      await SearchHistoryRepository.remove(id);
      await loadHistory();
    }
  };

  const handleClearAllHistory = async () => {
    await SearchHistoryRepository.clear();
    setHistory([]);
  };

  const handlePlaySong = async (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
      return;
    }
    if (query.trim()) {
      await commitSearch(query);
    }
    await playTrack(track);
  };

  const handleShareTrack = (track: Track) => {
    const text = `${track.title} by ${track.artist}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      notificationService.success('Copied to Clipboard', `"${text}" copied.`);
    }
  };

  const handleDeleteLocalTrack = async (track: Track) => {
    if (window.confirm(`Remove "${track.title}" from local music library?`)) {
      await TrackRepository.remove(track.id);
      notificationService.success('Track Removed', `Removed "${track.title}" from library.`);
      handleSearch(query, filters);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.source && filters.source !== 'all') count++;
    if (filters.duration && filters.duration !== 'all') count++;
    if (filters.quality && filters.quality !== 'all') count++;
    if (filters.formats && filters.formats.length > 0) count++;
    if (filters.sortBy && filters.sortBy !== 'relevance') count++;
    return count;
  }, [filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 px-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden text-[var(--text-primary)]">
        {/* Top Search Input Bar */}
        <div className="relative flex items-center px-3 sm:px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)] gap-2">
          <button
            onClick={onClose}
            className="p-1.5 -ml-1 rounded-full text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors shrink-0 active:scale-95"
            title="Go back (Close search)"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--accent)]" />
          </button>
          <Search className="w-4 h-4 text-[var(--text-muted)] shrink-0 hidden sm:inline" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search songs, artists, albums, playlists, genres, folders... (Esc to close)"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none"
          />

          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults(null);
                setSuggestions([]);
              }}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-white"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Filter Toggle Button */}
          <button
            onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isFilterPanelOpen || activeFilterCount > 0
                ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)] shadow-sm'
                : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:text-white'
            }`}
            title="Toggle Search Filters"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[var(--btn-text)] text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-muted)] hover:text-white"
          >
            <kbd className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-muted)]">
              ESC
            </kbd>
          </button>
        </div>

        {/* Expandable Filter Panel (Section 3) */}
        {isFilterPanelOpen && (
          <div className="p-4 bg-[var(--surface)] border-b border-[var(--border)] space-y-3.5 text-xs animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent)]" /> Search Filters
              </span>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleResetFilters}
                  className="text-[11px] text-[var(--accent)] hover:underline font-semibold"
                >
                  Reset All Filters
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Source Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Source</label>
                <select
                  value={filters.source || 'all'}
                  onChange={(e) => handleFilterChange({ source: e.target.value as SearchSourceFilter })}
                  className="w-full p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs outline-none"
                >
                  <option value="all">All Sources</option>
                  <option value="local">Local Files Only</option>
                  <option value="online">Online Saved Links</option>
                  <option value="cached">Cached Audio</option>
                  <option value="recently_added">Recently Added</option>
                </select>
              </div>

              {/* Duration Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Duration</label>
                <select
                  value={filters.duration || 'all'}
                  onChange={(e) => handleFilterChange({ duration: e.target.value as SearchDurationFilter })}
                  className="w-full p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs outline-none"
                >
                  <option value="all">Any Duration</option>
                  <option value="under_3">&lt; 3 Minutes</option>
                  <option value="3_to_5">3 – 5 Minutes</option>
                  <option value="5_to_10">5 – 10 Minutes</option>
                  <option value="over_10">&gt; 10 Minutes</option>
                </select>
              </div>

              {/* Audio Quality Filter */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Quality</label>
                <select
                  value={filters.quality || 'all'}
                  onChange={(e) => handleFilterChange({ quality: e.target.value as SearchQualityFilter })}
                  className="w-full p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs outline-none"
                >
                  <option value="all">Any Quality</option>
                  <option value="low">Low (&lt; 128 kbps)</option>
                  <option value="standard">Standard (128–256 kbps)</option>
                  <option value="high">High (256–320 kbps)</option>
                  <option value="lossless">Lossless (FLAC/WAV)</option>
                  <option value="hires">Hi-Res (&ge; 48kHz / 24-bit)</option>
                </select>
              </div>

              {/* Sort By Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-[var(--text-muted)] block">Sort By</label>
                <select
                  value={filters.sortBy || 'relevance'}
                  onChange={(e) => handleFilterChange({ sortBy: e.target.value as SearchSortOption })}
                  className="w-full p-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-xs outline-none"
                >
                  <option value="relevance">Relevance</option>
                  <option value="recently_added">Recently Added</option>
                  <option value="recently_played">Recently Played</option>
                  <option value="most_played">Most Played</option>
                  <option value="title_asc">Song Name (A–Z)</option>
                  <option value="title_desc">Song Name (Z–A)</option>
                  <option value="artist_asc">Artist (A–Z)</option>
                  <option value="artist_desc">Artist (Z–A)</option>
                  <option value="album_asc">Album (A–Z)</option>
                  <option value="album_desc">Album (Z–A)</option>
                  <option value="duration_asc">Duration (Shortest)</option>
                  <option value="duration_desc">Duration (Longest)</option>
                  <option value="file_size">File Size</option>
                  <option value="year_desc">Release Year</option>
                </select>
              </div>
            </div>

            {/* Format Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase text-[var(--text-muted)] mr-1">Formats:</span>
              {['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg', 'opus'].map((fmt) => {
                const isSelected = (filters.formats || []).includes(fmt);
                return (
                  <button
                    key={fmt}
                    onClick={() => {
                      const cur = filters.formats || [];
                      const next = isSelected ? cur.filter((f) => f !== fmt) : [...cur, fmt];
                      handleFilterChange({ formats: next });
                    }}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase font-bold transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                        : 'bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-white border border-[var(--border)]'
                    }`}
                  >
                    {fmt}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Category Tabs: All | Songs | Artists | Albums | Playlists | Folders | Online */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto text-xs font-semibold scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'songs', label: 'Songs', count: results?.songs.length },
            { id: 'artists', label: 'Artists', count: results?.artists.length },
            { id: 'albums', label: 'Albums', count: results?.albums.length },
            { id: 'playlists', label: 'Playlists', count: results?.playlists.length },
            { id: 'folders', label: 'Folders', count: results?.folders.length },
            { id: 'online', label: 'Online', count: results?.online.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as SearchCategoryType)}
              className={`px-3 py-1 rounded-lg transition-all shrink-0 flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full font-mono ${activeTab === tab.id ? 'bg-black/20 text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-[var(--border)]">
          {/* Suggestions while typing */}
          {suggestions.length > 0 && query.trim() && (
            <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-[var(--border-subtle)]">
              <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--accent)]" /> Suggestions:
              </span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => commitSearch(s)}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Search History (when query is empty) */}
          {!query.trim() && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[var(--accent)]" /> Recent Searches
                </span>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.saveSearchHistory !== false}
                      onChange={(e) => updateSettings({ saveSearchHistory: e.target.checked })}
                      className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                    />
                    <span>Save Search History</span>
                  </label>
                  {history.length > 0 && (
                    <button
                      onClick={handleClearAllHistory}
                      className="text-[11px] text-[var(--text-muted)] hover:text-red-400 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              </div>

              {history.length === 0 ? (
                <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-2">
                  <Search className="w-8 h-8 mx-auto opacity-30 text-[var(--accent)]" />
                  <p className="font-semibold text-[var(--text-secondary)]">No recent searches</p>
                  <p>Start typing to search your library, artists, albums, or online history.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => commitSearch(item.query)}
                      className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] cursor-pointer transition-colors"
                    >
                      <span>{item.query}</span>
                      <button
                        onClick={(e) => handleDeleteHistory(e, item.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-400 transition-opacity"
                        title="Delete entry"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search Results Display */}
          {results && (query.trim() || activeFilterCount > 0) && (
            <div className="space-y-6">
              {results.totalLocalResults === 0 && results.online.length === 0 ? (
                /* Smart Empty State (Section 14) */
                <div className="py-12 text-center space-y-3">
                  <Search className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-40" />
                  <div className="space-y-1">
                    <p className="text-base font-bold text-[var(--text-primary)]">
                      No songs match your search
                    </p>
                    <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                      We couldn't find matches for "{query}". Try checking your spelling or adjusting active filters.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {activeFilterCount > 0 && (
                      <button
                        onClick={handleResetFilters}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--accent)] text-[var(--btn-text)]"
                      >
                        Clear Filters
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setQuery('');
                        setResults(null);
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] hover:bg-[var(--surface-secondary)]"
                    >
                      Clear Search
                    </button>
                    {onRescanLibrary && (
                      <button
                        onClick={() => {
                          onClose();
                          onRescanLibrary();
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border)] hover:bg-[var(--surface-secondary)] text-[var(--accent)]"
                      >
                        Rescan Library
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Category: Songs */}
                  {(activeTab === 'all' || activeTab === 'songs') && results.songs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                          <Music2 className="w-3.5 h-3.5 text-[var(--accent)]" /> Songs ({results.songs.length})
                        </span>
                      </div>
                      <div className="space-y-1 divide-y divide-[var(--border-subtle)] bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                        {(activeTab === 'songs' ? results.songs : results.songs.slice(0, 5)).map(
                          ({ track, matchedFields }) => {
                            const isCurrent = currentTrack?.id === track.id;
                            const isPlaying = isCurrent && playerState.status === 'playing';

                            return (
                              <div
                                key={track.id}
                                onClick={() => handlePlaySong(track)}
                                className={`group flex items-center justify-between p-2.5 hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors ${
                                  isCurrent ? 'bg-[var(--surface-secondary)]/80 text-[var(--accent)]' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {/* Play Indicator / Cover Art */}
                                  <div className="w-10 h-10 rounded-lg bg-[var(--surface-card)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)] overflow-hidden relative">
                                    {track.coverArtUrl ? (
                                      <img src={track.coverArtUrl} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <Disc className="w-5 h-5 text-[var(--text-muted)]" />
                                    )}
                                    {isCurrent && (
                                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        {isPlaying ? (
                                          <Play className="w-4 h-4 fill-current text-[var(--accent)]" />
                                        ) : (
                                          <Pause className="w-4 h-4 text-[var(--accent)]" />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      {isCurrent && (
                                        <span className="text-[10px] font-bold text-[var(--accent)]">
                                          {isPlaying ? '▶' : 'Ⅱ'}
                                        </span>
                                      )}
                                      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
                                        {track.title}
                                      </h4>
                                      {track.isFavorite && (
                                        <Heart className="w-3 h-3 text-rose-500 fill-current shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                                      {track.artist} • {track.album || 'Unknown Album'}
                                    </p>
                                  </div>
                                </div>

                                {/* Right: Metadata badges & Action buttons (Section 2) */}
                                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {track.format && (
                                    <span className="hidden md:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                                      {track.format}
                                    </span>
                                  )}

                                  {/* Quick Actions */}
                                  <button
                                    onClick={() => toggleFavorite(track.id)}
                                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                                    title="Toggle favorite"
                                  >
                                    <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'text-rose-500 fill-current' : ''}`} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      addToQueue(track);
                                      notificationService.success('Added to Queue', `"${track.title}" added to queue.`);
                                    }}
                                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                                    title="Add to queue"
                                  >
                                    <ListPlus className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Context Menu Button */}
                                  <div className="relative">
                                    <button
                                      onClick={() =>
                                        setActionMenuTrackId(actionMenuTrackId === track.id ? null : track.id)
                                      }
                                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                                      title="More Actions"
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>

                                    {actionMenuTrackId === track.id && (
                                      <div className="absolute right-0 top-8 z-30 w-44 py-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-xl text-xs space-y-0.5">
                                        <button
                                          onClick={() => {
                                            playNext(track);
                                            setActionMenuTrackId(null);
                                            notificationService.info('Play Next', `"${track.title}" will play next.`);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                                        >
                                          Play Next
                                        </button>
                                        <button
                                          onClick={() => {
                                            setPlaylistModalTracks([track]);
                                            setActionMenuTrackId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                                        >
                                          Add to Playlist
                                        </button>
                                        <button
                                          onClick={() => {
                                            TrackRepository.getAlbums().then((albs) => {
                                              const found = albs.find(
                                                (a) => a.title.toLowerCase() === (track.album || '').toLowerCase()
                                              );
                                              if (found) {
                                                setSelectedAlbum(found);
                                                onSelectAlbum?.(found);
                                              }
                                            });
                                            setActionMenuTrackId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                                        >
                                          View Album
                                        </button>
                                        <button
                                          onClick={() => {
                                            TrackRepository.getArtists().then((arts) => {
                                              const found = arts.find(
                                                (a) => a.name.toLowerCase() === track.artist.toLowerCase()
                                              );
                                              if (found) {
                                                setSelectedArtist(found);
                                                onSelectArtist?.(found);
                                              }
                                            });
                                            setActionMenuTrackId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                                        >
                                          View Artist
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleShareTrack(track);
                                            setActionMenuTrackId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                                        >
                                          Share / Copy Info
                                        </button>
                                        <button
                                          onClick={() => {
                                            setPropertiesTrack(track);
                                            setActionMenuTrackId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-[var(--surface-secondary)] text-[var(--text-primary)]"
                                        >
                                          File Information
                                        </button>
                                        <button
                                          onClick={() => {
                                            handleDeleteLocalTrack(track);
                                            setActionMenuTrackId(null);
                                          }}
                                          className="w-full px-3 py-1.5 text-left hover:bg-rose-500/10 text-rose-400"
                                        >
                                          Delete from Library
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}

                  {/* Category: Artists */}
                  {(activeTab === 'all' || activeTab === 'artists') && results.artists.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[var(--accent)]" /> Artists ({results.artists.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.artists.map(({ artist }) => (
                          <div
                            key={artist.id}
                            onClick={() => {
                              setSelectedArtist(artist);
                              onSelectArtist?.(artist);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors border border-[var(--border-subtle)] hover:border-[var(--border)]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                                <Users className="w-4 h-4 text-[var(--accent)]" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {artist.name}
                                </h4>
                                <p className="text-[10px] text-[var(--text-muted)]">
                                  {artist.trackCount} songs • {artist.albumCount} albums
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => playPlaylist(artist.tracks)}
                                className="p-1 rounded bg-[var(--accent)] text-[var(--btn-text)]"
                                title="Play all songs by artist"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] ml-1" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category: Albums */}
                  {(activeTab === 'all' || activeTab === 'albums') && results.albums.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                          <Disc className="w-3.5 h-3.5 text-[var(--accent)]" /> Albums ({results.albums.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.albums.map(({ album }) => (
                          <div
                            key={album.id}
                            onClick={() => {
                              setSelectedAlbum(album);
                              onSelectAlbum?.(album);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors border border-[var(--border-subtle)] hover:border-[var(--border)]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center shrink-0 overflow-hidden border border-[var(--border-subtle)]">
                                {album.coverArtUrl ? (
                                  <img src={album.coverArtUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Disc className="w-4 h-4 text-[var(--text-muted)]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {album.title}
                                </h4>
                                <p className="text-[10px] text-[var(--text-muted)] truncate">
                                  {album.artist} • {album.trackCount} tracks
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => playPlaylist(album.tracks)}
                                className="p-1 rounded bg-[var(--accent)] text-[var(--btn-text)]"
                                title="Play album"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] ml-1" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category: Playlists */}
                  {(activeTab === 'all' || activeTab === 'playlists') && results.playlists.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                          <ListMusic className="w-3.5 h-3.5 text-[var(--accent)]" /> Playlists ({results.playlists.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.playlists.map(({ playlist }) => (
                          <div
                            key={playlist.id}
                            onClick={() => {
                              onSelectPlaylist?.(playlist);
                              onClose();
                            }}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors border border-[var(--border-subtle)] hover:border-[var(--border)]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                                <ListMusic className="w-4 h-4 text-[var(--accent)]" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {playlist.name}
                                </h4>
                                <p className="text-[10px] text-[var(--text-muted)]">
                                  {playlist.songCount || 0} tracks
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category: Folders */}
                  {(activeTab === 'all' || activeTab === 'folders') && results.folders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-[var(--accent)]" /> Folders ({results.folders.length})
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {results.folders.map(({ folder }) => (
                          <div
                            key={folder.path}
                            onClick={() => setSelectedFolder(folder)}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors border border-[var(--border-subtle)] hover:border-[var(--border)]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                                <Folder className="w-4 h-4 text-[var(--accent)]" />
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {folder.name}
                                </h4>
                                <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                                  {folder.trackCount} tracks • {folder.path}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => playPlaylist(folder.tracks)}
                                className="p-1 rounded bg-[var(--accent)] text-[var(--btn-text)]"
                                title="Play all folder tracks"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                              <ChevronRight className="w-4 h-4 text-[var(--text-muted)] ml-1" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Category: Online History Links (Section 12) */}
                  {(activeTab === 'all' || activeTab === 'online') && results.online.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-[var(--accent)]" /> Saved Online Links ({results.online.length})
                        </span>
                      </div>
                      <div className="space-y-1 bg-[var(--surface)] rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                        {results.online.map(({ item, isCached }) => {
                          const isYT = 'youtube_video_id' in item;
                          const title = item.title || (isYT ? (item as any).title : (item as any).url);
                          const artist = isYT ? (item as any).artist || (item as any).channel : 'Online Stream';

                          return (
                            <div
                              key={item.id}
                              onClick={async () => {
                                if (isCached && isYT) {
                                  await playCachedYouTubeTrack(item as any);
                                } else if (isYT) {
                                  await playYouTubeUrl((item as any).url);
                                }
                                onClose();
                              }}
                              className="flex items-center justify-between p-2.5 hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-[var(--surface-card)] flex items-center justify-center shrink-0">
                                  <Globe className="w-4 h-4 text-sky-400" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                    {title}
                                  </h4>
                                  <p className="text-[10px] text-[var(--text-muted)] truncate">
                                    {artist} {isCached ? '• ✓ Available Offline' : '• Online'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {isCached && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Cached
                                  </span>
                                )}
                                <button className="p-1 rounded bg-[var(--accent)] text-[var(--btn-text)]">
                                  <Play className="w-3 h-3 fill-current" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sub-modals for rich item interaction */}
      <AlbumDetailsModal
        album={selectedAlbum}
        isOpen={Boolean(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
      />

      <ArtistDetailsModal
        artist={selectedArtist}
        isOpen={Boolean(selectedArtist)}
        onClose={() => setSelectedArtist(null)}
        onSelectAlbum={(alb) => {
          setSelectedAlbum(alb);
          setSelectedArtist(null);
        }}
        onAddToPlaylist={(tracks) => setPlaylistModalTracks(tracks)}
      />

      <GenreDetailsModal
        genre={selectedGenre}
        isOpen={Boolean(selectedGenre)}
        onClose={() => setSelectedGenre(null)}
        onAddToPlaylist={(tracks) => setPlaylistModalTracks(tracks)}
      />

      <FolderDetailsModal
        folder={selectedFolder}
        isOpen={Boolean(selectedFolder)}
        onClose={() => setSelectedFolder(null)}
        onAddToPlaylist={(tracks) => setPlaylistModalTracks(tracks)}
      />

      <TrackPropertiesModal
        track={propertiesTrack}
        isOpen={Boolean(propertiesTrack)}
        onClose={() => setPropertiesTrack(null)}
      />

      <AddToPlaylistModal
        isOpen={Boolean(playlistModalTracks)}
        trackOrTracks={playlistModalTracks}
        onClose={() => setPlaylistModalTracks(null)}
      />
    </div>
  );
};

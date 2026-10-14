import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Track,
  Album,
  Artist,
  Genre,
  FolderNode,
  MusicFolderRecord,
  ScanProgress,
} from '../types';
import {
  TrackRepository,
  FolderRepository,
  EntityFavoriteRepository,
} from '../database/repository';
import { usePlayer } from '../player/PlayerContext';
import { Button } from '../components/ui/Button';
import { nativeBridge } from '../services/nativeBridge';
import { notificationService } from '../services/errorService';
import { FolderScanner } from '../library/folderScanner';
import { ContextMenu } from '../components/ui/ContextMenu';
import { AddToPlaylistModal } from '../components/playlists/AddToPlaylistModal';
import { TrackPropertiesModal } from '../components/modals/TrackPropertiesModal';
import { AlbumDetailsModal } from '../components/modals/AlbumDetailsModal';
import { ArtistDetailsModal } from '../components/modals/ArtistDetailsModal';
import { GenreDetailsModal } from '../components/modals/GenreDetailsModal';
import { FolderDetailsModal } from '../components/modals/FolderDetailsModal';
import { ScanProgressModal } from '../components/modals/ScanProgressModal';
import { MetadataEditorModal } from '../components/modals/MetadataEditorModal';
import { BulkMetadataEditorModal } from '../components/modals/BulkMetadataEditorModal';
import { DuplicateDetectionModal } from '../components/modals/DuplicateDetectionModal';
import { MissingFilesModal } from '../components/modals/MissingFilesModal';
import { LibraryStatisticsModal } from '../components/library/LibraryStatisticsModal';
import { TrackInfoModal } from '../components/modals/TrackInfoModal';
import { ArtworkManagerModal } from '../components/modals/ArtworkManagerModal';
import { FileActionModal, FileActionMode } from '../components/modals/FileActionModal';
import { OrganizeFilesModal } from '../components/modals/OrganizeFilesModal';
import { fileManagementService } from '../services/file/FileManagementService';
import {
  LibraryFilterPanel,
} from '../components/library/LibraryFilterPanel';
import {
  ColumnCustomizerModal,
  VisibleColumnsConfig,
  DEFAULT_VISIBLE_COLUMNS,
} from '../components/library/ColumnCustomizerModal';
import { StarRating } from '../components/common/StarRating';
import {
  FilterEngine,
  LibraryFilterCriteria,
  DEFAULT_FILTER_CRITERIA,
  QuickFilterType,
  SortField,
  SortDirection,
  SortOptions,
} from '../../src/services/filter/FilterEngine';
import {
  Music2,
  Disc,
  Users,
  Tag,
  Folder,
  FolderOpen,
  FolderPlus,
  Play,
  Shuffle,
  ListPlus,
  Search,
  LayoutList,
  LayoutGrid,
  Table as TableIcon,
  AlignJustify,
  ArrowUpDown,
  Filter,
  HardDrive,
  RefreshCw,
  Heart,
  Upload,
  Clock,
  Sparkles,
  BarChart2,
  Copy,
  FileWarning,
  Columns,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  Edit3,
  FolderTree,
} from 'lucide-react';

export type LibraryTab = 'songs' | 'albums' | 'artists' | 'genres' | 'folders';
export type ViewMode = 'list' | 'compact' | 'grid' | 'detailed';
export type GroupByOption = 'none' | 'artist' | 'album' | 'genre' | 'year' | 'composer';

export const LibraryPage: React.FC = () => {
  const {
    playTrack,
    currentTrack,
    toggleFavorite,
    addToQueue,
    playNext,
    playPlaylist,
    shufflePlaylist,
    setTrackRating,
  } = usePlayer();

  // Tab & View States
  const [activeTab, setActiveTab] = useState<LibraryTab>('songs');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [groupBy, setGroupBy] = useState<GroupByOption>('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all');
  const [filterCriteria, setFilterCriteria] = useState<LibraryFilterCriteria>(DEFAULT_FILTER_CRITERIA);
  const [visibleColumns, setVisibleColumns] = useState<VisibleColumnsConfig>(DEFAULT_VISIBLE_COLUMNS);

  // Selected tracks for bulk operations
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());

  // Data States
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [folders, setFolders] = useState<MusicFolderRecord[]>([]);
  const [missingFilesCount, setMissingFilesCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Collapsed Groups State
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Modals & Interactive States
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isColumnsModalOpen, setIsColumnsModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isMissingModalOpen, setIsMissingModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isOrganizeModalOpen, setIsOrganizeModalOpen] = useState(false);
  const [editMetadataTrack, setEditMetadataTrack] = useState<Track | null>(null);
  const [trackInfoTrack, setTrackInfoTrack] = useState<Track | null>(null);
  const [artworkModalTrack, setArtworkModalTrack] = useState<Track | null>(null);
  const [fileActionState, setFileActionState] = useState<{
    track: Track;
    mode: FileActionMode;
  } | null>(null);
  const [playlistModalTracks, setPlaylistModalTracks] = useState<Track[] | null>(null);

  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderNode | null>(null);
  const [propertyTrack, setPropertyTrack] = useState<Track | null>(null);
  const [contextMenuState, setContextMenuState] = useState<{
    x: number;
    y: number;
    track: Track;
  } | null>(null);

  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allTracks, allAlbums, allArtists, allGenres, allFolders, missing] = await Promise.all([
        TrackRepository.getAll(),
        TrackRepository.getAlbums(),
        TrackRepository.getArtists(),
        TrackRepository.getGenres(),
        FolderRepository.getAll(),
        TrackRepository.getMissingFiles(),
      ]);

      setTracks(allTracks);
      setAlbums(allAlbums);
      setArtists(allArtists);
      setGenres(allGenres);
      setFolders(allFolders);
      setMissingFilesCount(missing.length);
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Restore saved view and column preferences
  useEffect(() => {
    const savedView = localStorage.getItem('nova_library_view_mode');
    if (savedView) setViewMode(savedView as ViewMode);

    const savedCols = localStorage.getItem('nova_library_columns');
    if (savedCols) {
      try {
        setVisibleColumns(JSON.parse(savedCols));
      } catch {
        // fallback
      }
    }
  }, []);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('nova_library_view_mode', mode);
  };

  const handleColumnsChange = (cols: VisibleColumnsConfig) => {
    setVisibleColumns(cols);
    localStorage.setItem('nova_library_columns', JSON.stringify(cols));
  };

  // Keyboard shortcut Ctrl+F to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        const searchInput = document.getElementById('library-search-input') as HTMLInputElement;
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered & Sorted Tracks Pipeline
  const processedTracks = useMemo(() => {
    const sortOpts: SortOptions = {
      field: sortField,
      direction: sortDirection,
    };

    return FilterEngine.processPipeline(
      tracks,
      searchQuery,
      filterCriteria,
      quickFilter,
      sortOpts
    );
  }, [tracks, searchQuery, filterCriteria, quickFilter, sortField, sortDirection]);

  // Grouping computation
  const groupedTracks = useMemo(() => {
    if (groupBy === 'none') {
      return null;
    }

    const groups = new Map<string, Track[]>();

    for (const t of processedTracks) {
      let key = 'Unassigned';
      if (groupBy === 'artist') key = t.artist || 'Unknown Artist';
      else if (groupBy === 'album') key = t.album || 'Unknown Album';
      else if (groupBy === 'genre') key = t.genre || 'Unclassified';
      else if (groupBy === 'year') key = t.year ? String(t.year) : 'Unknown Year';
      else if (groupBy === 'composer') key = t.composer || 'Unknown Composer';

      const list = groups.get(key) || [];
      list.push(t);
      groups.set(key, list);
    }

    // Sort group keys alphabetically
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [processedTracks, groupBy]);

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  // Multi-Selection Handlers
  const handleToggleSelectTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTrackIds.size === processedTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(processedTracks.map((t) => t.id)));
    }
  };

  const selectedTracksList = useMemo(() => {
    return tracks.filter((t) => selectedTrackIds.has(t.id));
  }, [tracks, selectedTrackIds]);

  // Add Folder Flow
  const handleAddFolder = async () => {
    const res = await nativeBridge.pickDirectoryFiles();
    if (!res) return;

    const { folderPath, files } = res;
    await FolderRepository.addFolder(folderPath);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await FolderScanner.scanFiles(folderPath, files, {
        signal: controller.signal,
        onProgress: (prog) => setScanProgress(prog),
      });

      notificationService.success('Folder Indexed', `Indexed files in "${folderPath}"`);
      await loadData();
    } catch {
      notificationService.error('Scan Interrupted', 'Scanning was interrupted.');
    } finally {
      setAbortController(null);
    }
  };

  const handleRescanFolder = async (folderPath: string) => {
    const files = await nativeBridge.openFileDialog();
    if (files.length === 0) return;

    const controller = new AbortController();
    setAbortController(controller);

    try {
      await FolderScanner.scanFiles(folderPath, files, {
        signal: controller.signal,
        onProgress: (prog) => setScanProgress(prog),
      });
      notificationService.success('Folder Rescanned', `Updated library from "${folderPath}"`);
      await loadData();
    } catch {
      notificationService.error('Rescan Interrupted', 'Rescanning was aborted.');
    } finally {
      setAbortController(null);
    }
  };

  const handleRemoveFolder = async (folderPath: string) => {
    const confirmed = window.confirm(
      `Remove folder "${folderPath}" from library? Files on disk will NOT be deleted.`
    );
    if (!confirmed) return;

    await FolderRepository.removeFolder(folderPath);
    await FolderScanner.removeFolderTracks(folderPath);
    notificationService.success('Folder Removed', `Removed folder "${folderPath}" from library.`);
    await loadData();
  };

  // Drag and Drop folder scanning
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry && entry.isFile) {
        const file = e.dataTransfer.files[i];
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      const folderName = 'Dropped Media';
      await FolderRepository.addFolder(folderName);
      await FolderScanner.scanFiles(folderName, files);
      notificationService.success('Files Added', `Imported ${files.length} track(s).`);
      await loadData();
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '—';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex-1 flex flex-col h-full overflow-hidden select-none bg-[var(--background)]"
    >
      {/* Top Header & Navigation */}
      <div className="p-6 border-b border-[var(--border)] space-y-4 shrink-0 bg-[var(--background)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Main Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] overflow-x-auto">
            {[
              { id: 'songs', label: 'Songs', icon: Music2, count: tracks.length },
              { id: 'albums', label: 'Albums', icon: Disc, count: albums.length },
              { id: 'artists', label: 'Artists', icon: Users, count: artists.length },
              { id: 'genres', label: 'Genres', icon: Tag, count: genres.length },
              { id: 'folders', label: 'Folders', icon: Folder, count: folders.length },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as LibraryTab)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive
                        ? 'bg-black/20 text-[var(--btn-text)]'
                        : 'bg-[var(--surface)] text-[var(--text-muted)]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action Utilities: Stats, Duplicates, Missing Files, Add Folder */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsStatsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Library Statistics & Quality Analytics"
            >
              <BarChart2 className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Stats</span>
            </button>

            <button
              onClick={() => setIsDuplicateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Detect Duplicate Songs"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Duplicates</span>
            </button>

            <button
              onClick={() => setIsMissingModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                missingFilesCount > 0
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
              }`}
              title="Detect Missing or Moved Audio Files"
            >
              <FileWarning className="w-3.5 h-3.5 text-amber-400" />
              <span>Missing ({missingFilesCount})</span>
            </button>

            <Button
              variant="primary"
              size="sm"
              icon={<FolderPlus className="w-4 h-4" />}
              onClick={handleAddFolder}
            >
              + ADD MUSIC FOLDER
            </Button>
          </div>
        </div>

        {/* Toolbar: Search, Filters, Group By, Sort, View Modes */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Search bar with Ctrl+F indication */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              id="library-search-input"
              type="text"
              placeholder="Filter library (Ctrl+F)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-12 py-1.5 rounded-[var(--radius)] bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-white"
              >
                ×
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Advanced Filter Panel Button */}
            <button
              onClick={() => setIsFilterPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] transition-colors"
            >
              <Filter className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Filter Panel</span>
            </button>

            {/* Group By Selector */}
            {activeTab === 'songs' && (
              <div className="flex items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-2 py-0.5">
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Group:</span>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value as GroupByOption)}
                  className="bg-transparent text-[var(--text-primary)] text-xs outline-none cursor-pointer"
                >
                  <option value="none">None</option>
                  <option value="artist">By Artist</option>
                  <option value="album">By Album</option>
                  <option value="genre">By Genre</option>
                  <option value="year">By Year</option>
                  <option value="composer">By Composer</option>
                </select>
              </div>
            )}

            {/* Sort Field & Direction */}
            <div className="flex items-center gap-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-2 py-0.5">
              <ArrowUpDown className="w-3 h-3 text-[var(--text-muted)]" />
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-transparent text-[var(--text-primary)] text-xs outline-none cursor-pointer"
              >
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="duration">Duration</option>
                <option value="dateAdded">Date Added</option>
                <option value="lastPlayedAt">Recently Played</option>
                <option value="playCount">Play Count</option>
                <option value="rating">Rating</option>
                <option value="year">Year</option>
                <option value="bitrate">Bitrate</option>
                <option value="fileSize">File Size</option>
              </select>
              <button
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                className="px-1 text-[10px] font-bold text-[var(--accent)] hover:underline"
              >
                {sortDirection === 'asc' ? '▲ ASC' : '▼ DESC'}
              </button>
            </div>

            {/* Column Customizer (for Detailed table) */}
            {activeTab === 'songs' && viewMode === 'detailed' && (
              <button
                onClick={() => setIsColumnsModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]"
                title="Configure visible columns"
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Columns</span>
              </button>
            )}

            {/* View Modes Toggle */}
            {activeTab === 'songs' && (
              <div className="flex items-center p-0.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)]">
                <button
                  onClick={() => handleViewModeChange('list')}
                  className={`p-1 rounded ${
                    viewMode === 'list'
                      ? 'bg-[var(--surface-card)] text-[var(--accent)] shadow'
                      : 'text-[var(--text-muted)]'
                  }`}
                  title="List View"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleViewModeChange('compact')}
                  className={`p-1 rounded ${
                    viewMode === 'compact'
                      ? 'bg-[var(--surface-card)] text-[var(--accent)] shadow'
                      : 'text-[var(--text-muted)]'
                  }`}
                  title="Compact List"
                >
                  <AlignJustify className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleViewModeChange('detailed')}
                  className={`p-1 rounded ${
                    viewMode === 'detailed'
                      ? 'bg-[var(--surface-card)] text-[var(--accent)] shadow'
                      : 'text-[var(--text-muted)]'
                  }`}
                  title="Detailed Table"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleViewModeChange('grid')}
                  className={`p-1 rounded ${
                    viewMode === 'grid'
                      ? 'bg-[var(--surface-card)] text-[var(--accent)] shadow'
                      : 'text-[var(--text-muted)]'
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quick Filter Chips (Requirement 34) */}
        {activeTab === 'songs' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'favorites', label: 'Favorites (★)' },
              { id: 'recently_added', label: 'Recently Added' },
              { id: 'most_played', label: 'Most Played' },
              { id: 'lossless', label: 'Lossless (FLAC/WAV)' },
              { id: 'high_rating', label: 'High Rating (4★+)' },
              { id: 'local', label: 'Local Only' },
              { id: 'downloaded', label: 'Downloaded' },
              { id: 'online', label: 'Online' },
              { id: 'cached', label: 'Cached' },
            ].map((chip) => {
              const isSelected = quickFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  onClick={() => setQuickFilter(chip.id as QuickFilterType)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white border border-[var(--border-subtle)]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Floating Bulk Action Bar when tracks are selected */}
        {selectedTrackIds.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)] text-xs animate-fade-in">
            <div className="flex items-center gap-3 font-semibold text-[var(--text-primary)]">
              <span>{selectedTrackIds.size} song(s) selected</span>
              <button
                onClick={() => setSelectedTrackIds(new Set())}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Clear Selection
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Play className="w-3.5 h-3.5 fill-current" />}
                onClick={() => playPlaylist(selectedTracksList)}
              >
                Play Selected
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ListPlus className="w-3.5 h-3.5" />}
                onClick={() => {
                  selectedTracksList.forEach((t) => addToQueue(t));
                  notificationService.success('Added to Queue', `Added ${selectedTracksList.length} tracks.`);
                }}
              >
                Queue
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ListPlus className="w-3.5 h-3.5" />}
                onClick={() => setPlaylistModalTracks(selectedTracksList)}
              >
                Add to Playlist
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit3 className="w-3.5 h-3.5" />}
                onClick={() => setIsBulkEditModalOpen(true)}
              >
                Bulk Edit
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderTree className="w-3.5 h-3.5" />}
                onClick={() => setIsOrganizeModalOpen(true)}
              >
                Organize Files
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Main Viewport Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* EMPTY STATE */}
        {!isLoading && tracks.length === 0 && (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4 max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--accent)] border border-[var(--border)] shadow-inner">
              <Music2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[var(--text-primary)]">YOUR LIBRARY IS EMPTY</h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Add a music folder to start listening to your local music offline.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              icon={<FolderPlus className="w-4 h-4" />}
              onClick={handleAddFolder}
            >
              + ADD MUSIC FOLDER
            </Button>
            <div className="text-[11px] text-[var(--text-muted)] pt-2 font-mono">
              Your music never leaves this device. Zero telemetry.
            </div>
          </div>
        )}

        {/* TAB: SONGS */}
        {activeTab === 'songs' && tracks.length > 0 && (
          <>
            {/* Grouped View */}
            {groupedTracks ? (
              <div className="space-y-6">
                {groupedTracks.map(([groupName, groupItems]) => {
                  const isCollapsed = collapsedGroups.has(groupName);
                  const totalGroupDuration = groupItems.reduce(
                    (acc, t) => acc + (t.duration || 0),
                    0
                  );
                  return (
                    <div
                      key={groupName}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden"
                    >
                      {/* Group Header */}
                      <div
                        onClick={() => toggleGroupCollapse(groupName)}
                        className="flex items-center justify-between p-4 bg-[var(--surface)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors border-b border-[var(--border-subtle)] select-none"
                      >
                        <div className="flex items-center gap-3">
                          {isCollapsed ? (
                            <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--accent)]" />
                          )}
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">
                            {groupName}
                          </h3>
                          <span className="text-xs text-[var(--text-muted)] font-mono">
                            ({groupItems.length} tracks • {formatDuration(totalGroupDuration)})
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => playPlaylist(groupItems)}
                            className="p-1.5 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] hover:opacity-90"
                            title="Play all in group"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            onClick={() => shufflePlaylist(groupItems)}
                            className="p-1.5 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white"
                            title="Shuffle group"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Group Songs Table */}
                      {!isCollapsed && (
                        <div className="divide-y divide-[var(--border-subtle)] text-xs">
                          {groupItems.map((track, i) => {
                            const isCurrent = currentTrack?.id === track.id;
                            const isSelected = selectedTrackIds.has(track.id);
                            return (
                              <div
                                key={track.id}
                                onClick={() => playTrack(track, groupItems)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenuState({ x: e.clientX, y: e.clientY, track });
                                }}
                                className={`flex items-center justify-between p-2.5 hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors ${
                                  isCurrent ? 'bg-[var(--surface-secondary)]/70 text-[var(--accent)]' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => handleToggleSelectTrack(track.id)}
                                    className="accent-[var(--accent)]"
                                  />
                                  <span className="w-6 text-center font-mono text-[var(--text-muted)] text-[11px]">
                                    {i + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <h4 className="font-bold text-[var(--text-primary)] truncate">
                                      {track.title}
                                    </h4>
                                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                                      {track.artist} • {track.album}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                                  <StarRating
                                    rating={track.rating || 0}
                                    onChange={(r) => setTrackRating(track.id, r)}
                                    size="sm"
                                  />
                                  <span>{formatDuration(track.duration)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'list' ? (
              /* Standard List View */
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-card)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-secondary)] text-[var(--text-muted)] border-b border-[var(--border)] font-semibold select-none">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            processedTracks.length > 0 &&
                            selectedTrackIds.size === processedTracks.length
                          }
                          onChange={handleSelectAll}
                          className="accent-[var(--accent)]"
                        />
                      </th>
                      <th className="p-3 w-10 text-center font-mono">#</th>
                      <th className="p-3">Title</th>
                      <th className="p-3">Artist</th>
                      <th className="p-3">Album</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3">Format</th>
                      <th className="p-3 w-20 text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {processedTracks.map((track, i) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isSelected = selectedTrackIds.has(track.id);
                      return (
                        <tr
                          key={track.id}
                          onClick={() => playTrack(track, processedTracks)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenuState({ x: e.clientX, y: e.clientY, track });
                          }}
                          className={`hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors group ${
                            isCurrent ? 'bg-[var(--surface-secondary)]/70 text-[var(--accent)] font-semibold' : ''
                          }`}
                        >
                          <td
                            className="p-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectTrack(track.id)}
                              className="accent-[var(--accent)]"
                            />
                          </td>
                          <td className="p-3 text-center font-mono text-[var(--text-muted)]">
                            {isCurrent ? (
                              <Play className="w-3.5 h-3.5 mx-auto fill-current text-[var(--accent)]" />
                            ) : (
                              i + 1
                            )}
                          </td>
                          <td className="p-3 font-semibold text-[var(--text-primary)]">
                            <div className="truncate flex items-center gap-2">
                              <span>{track.title}</span>
                              {track.isFavorite && (
                                <Heart className="w-3 h-3 text-rose-500 fill-current shrink-0" />
                              )}
                            </div>
                          </td>
                          <td className="p-3 truncate">{track.artist}</td>
                          <td className="p-3 truncate">{track.album || '—'}</td>
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <StarRating
                              rating={track.rating || 0}
                              onChange={(r) => setTrackRating(track.id, r)}
                              size="sm"
                            />
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-[var(--surface)] text-[10px] font-mono uppercase text-[var(--text-muted)] border border-[var(--border-subtle)]">
                              {track.format}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-[var(--text-muted)]">
                            {formatDuration(track.duration)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : viewMode === 'compact' ? (
              /* Compact Dense View */
              <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-card)] divide-y divide-[var(--border-subtle)] text-xs">
                {processedTracks.map((track, i) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isSelected = selectedTrackIds.has(track.id);
                  return (
                    <div
                      key={track.id}
                      onClick={() => playTrack(track, processedTracks)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenuState({ x: e.clientX, y: e.clientY, track });
                      }}
                      className={`flex items-center justify-between px-3 py-1.5 hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors ${
                        isCurrent ? 'bg-[var(--surface-secondary)]/70 text-[var(--accent)] font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => handleToggleSelectTrack(track.id)}
                          className="accent-[var(--accent)]"
                        />
                        <span className="w-6 text-center font-mono text-[10px] text-[var(--text-muted)]">
                          {i + 1}
                        </span>
                        <div className="truncate flex items-center gap-2">
                          <span className="font-semibold text-[var(--text-primary)]">{track.title}</span>
                          <span className="text-[var(--text-muted)]">• {track.artist}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                        <span className="uppercase text-[10px] px-1.5 py-0.2 rounded bg-[var(--surface)] border border-[var(--border-subtle)]">
                          {track.format}
                        </span>
                        <span>{formatDuration(track.duration)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : viewMode === 'detailed' ? (
              /* Detailed Table with Custom Columns */
              <div className="rounded-xl border border-[var(--border)] overflow-x-auto bg-[var(--surface-card)]">
                <table className="w-full text-left text-xs min-w-[700px]">
                  <thead className="bg-[var(--surface-secondary)] text-[var(--text-muted)] border-b border-[var(--border)] font-semibold select-none">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            processedTracks.length > 0 &&
                            selectedTrackIds.size === processedTracks.length
                          }
                          onChange={handleSelectAll}
                          className="accent-[var(--accent)]"
                        />
                      </th>
                      <th className="p-3 w-10 text-center font-mono">#</th>
                      {visibleColumns.title && <th className="p-3">Title</th>}
                      {visibleColumns.artist && <th className="p-3">Artist</th>}
                      {visibleColumns.album && <th className="p-3">Album</th>}
                      {visibleColumns.rating && <th className="p-3">Rating</th>}
                      {visibleColumns.genre && <th className="p-3">Genre</th>}
                      {visibleColumns.year && <th className="p-3">Year</th>}
                      {visibleColumns.format && <th className="p-3">Format</th>}
                      {visibleColumns.bitrate && <th className="p-3">Bitrate</th>}
                      {visibleColumns.fileSize && <th className="p-3">Size</th>}
                      {visibleColumns.duration && <th className="p-3 w-20 text-right">Time</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {processedTracks.map((track, i) => {
                      const isCurrent = currentTrack?.id === track.id;
                      const isSelected = selectedTrackIds.has(track.id);
                      return (
                        <tr
                          key={track.id}
                          onClick={() => playTrack(track, processedTracks)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenuState({ x: e.clientX, y: e.clientY, track });
                          }}
                          className={`hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors ${
                            isCurrent ? 'bg-[var(--surface-secondary)]/70 text-[var(--accent)] font-semibold' : ''
                          }`}
                        >
                          <td
                            className="p-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectTrack(track.id)}
                              className="accent-[var(--accent)]"
                            />
                          </td>
                          <td className="p-3 text-center font-mono text-[var(--text-muted)]">
                            {i + 1}
                          </td>
                          {visibleColumns.title && (
                            <td className="p-3 font-semibold text-[var(--text-primary)]">
                              <div className="truncate flex items-center gap-2">
                                <span>{track.title}</span>
                                {track.isFavorite && (
                                  <Heart className="w-3 h-3 text-rose-500 fill-current shrink-0" />
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.artist && <td className="p-3 truncate">{track.artist}</td>}
                          {visibleColumns.album && <td className="p-3 truncate">{track.album || '—'}</td>}
                          {visibleColumns.rating && (
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <StarRating
                                rating={track.rating || 0}
                                onChange={(r) => setTrackRating(track.id, r)}
                                size="sm"
                              />
                            </td>
                          )}
                          {visibleColumns.genre && <td className="p-3 truncate">{track.genre || '—'}</td>}
                          {visibleColumns.year && <td className="p-3 font-mono">{track.year || '—'}</td>}
                          {visibleColumns.format && (
                            <td className="p-3 font-mono uppercase text-[10px]">{track.format}</td>
                          )}
                          {visibleColumns.bitrate && (
                            <td className="p-3 font-mono text-[10px]">
                              {track.bitrate ? `${track.bitrate} kbps` : '—'}
                            </td>
                          )}
                          {visibleColumns.fileSize && (
                            <td className="p-3 font-mono text-[10px]">{formatBytes(track.fileSize)}</td>
                          )}
                          {visibleColumns.duration && (
                            <td className="p-3 text-right font-mono text-[var(--text-muted)]">
                              {formatDuration(track.duration)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View for Songs */
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {processedTracks.map((track) => (
                  <div
                    key={track.id}
                    onClick={() => playTrack(track, processedTracks)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenuState({ x: e.clientX, y: e.clientY, track });
                    }}
                    className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 group shadow-sm hover:shadow-lg"
                  >
                    <div className="aspect-square rounded-lg bg-[var(--surface-secondary)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                      {track.coverArtUrl ? (
                        <img
                          src={track.coverArtUrl}
                          alt="Artwork"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Disc className="w-10 h-10 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full btn-primary flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {track.artist}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <StarRating
                          rating={track.rating || 0}
                          onChange={(r) => setTrackRating(track.id, r)}
                          size="sm"
                        />
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TAB: ALBUMS */}
        {activeTab === 'albums' && albums.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => setSelectedAlbum(album)}
                className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-3 group shadow-sm hover:shadow-xl"
              >
                <div className="aspect-square rounded-xl bg-[var(--surface-secondary)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)] shadow-inner">
                  {album.coverArtUrl ? (
                    <img
                      src={album.coverArtUrl}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors">
                      <Disc className="w-12 h-12" />
                      <span className="text-[9px] font-mono tracking-widest uppercase">ALBUM</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <div className="w-10 h-10 rounded-full btn-primary flex items-center justify-center shadow-xl">
                      <Play className="w-5 h-5 fill-current ml-0.5 text-[var(--btn-text)]" />
                    </div>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        await EntityFavoriteRepository.toggleFavorite({
                          itemId: album.id,
                          itemType: 'album',
                          title: album.title,
                          subtitle: album.artist,
                          coverArtUrl: album.coverArtUrl,
                        });
                        notificationService.success('Favorite Updated', `Toggled favorite for album "${album.title}".`);
                      }}
                      className="p-2.5 rounded-full bg-black/60 text-rose-400 hover:text-rose-500 hover:bg-black/80 transition-colors shadow-lg"
                      title="Favorite album"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {album.title}
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    {album.artist}
                  </p>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono flex items-center justify-between pt-1">
                    <span>{album.trackCount} tracks</span>
                    {album.year && <span>{album.year}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: ARTISTS */}
        {activeTab === 'artists' && artists.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => setSelectedArtist(artist)}
                className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 text-center group"
              >
                <div className="w-20 h-20 rounded-full bg-[var(--surface-secondary)] mx-auto flex items-center justify-center border border-[var(--border-subtle)] text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent)] transition-colors">
                  <Users className="w-8 h-8" />
                </div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {artist.name}
                </h4>
                <div className="text-[10px] text-[var(--text-muted)] font-mono">
                  {artist.trackCount} tracks • {artist.albumCount} albums
                </div>
                <div className="pt-1 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPlaylist(artist.tracks);
                    }}
                    className="p-1 rounded bg-[var(--accent)] text-[var(--btn-text)]"
                    title="Play artist"
                  >
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      shufflePlaylist(artist.tracks);
                    }}
                    className="p-1 rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white"
                    title="Shuffle artist"
                  >
                    <Shuffle className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await EntityFavoriteRepository.toggleFavorite({
                        itemId: artist.name,
                        itemType: 'artist',
                        title: artist.name,
                      });
                      notificationService.success('Favorite Updated', `Toggled favorite for artist "${artist.name}".`);
                    }}
                    className="p-1 rounded bg-[var(--surface)] text-rose-400 hover:text-rose-500 hover:bg-rose-500/10"
                    title="Favorite artist"
                  >
                    <Heart className="w-3 h-3 fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: GENRES */}
        {activeTab === 'genres' && genres.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {genres.map((g) => (
              <div
                key={g.name}
                onClick={() => setSelectedGenre(g)}
                className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 group"
              >
                <div className="flex items-center justify-between">
                  <Tag className="w-5 h-5 text-[var(--accent)]" />
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {g.trackCount} songs
                  </span>
                </div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{g.name}</h4>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {formatDuration(g.duration)}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        playPlaylist(g.tracks);
                      }}
                      className="p-1 rounded bg-[var(--accent)] text-[var(--btn-text)]"
                      title="Play genre"
                    >
                      <Play className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        shufflePlaylist(g.tracks);
                      }}
                      className="p-1 rounded bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white"
                      title="Shuffle genre"
                    >
                      <Shuffle className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB: FOLDERS */}
        {activeTab === 'folders' && (
          <div className="space-y-4 max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Monitored Music Folders
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">Manage indexed storage roots.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<FolderPlus className="w-4 h-4" />}
                onClick={handleAddFolder}
              >
                Add Folder
              </Button>
            </div>

            <div className="space-y-2">
              {folders.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border)]"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-6 h-6 text-[var(--accent)] shrink-0" />
                    <div>
                      <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                        {f.path}
                      </span>
                      <p className="text-[11px] text-[var(--text-muted)] font-mono">
                        {f.trackCount} tracks • Last scanned:{' '}
                        {f.lastScanned ? new Date(f.lastScanned).toLocaleString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FolderOpen className="w-3.5 h-3.5" />}
                      onClick={async () => {
                        const hierarchy = await TrackRepository.getFolderHierarchy();
                        const found = hierarchy.find((node) => node.path === f.path);
                        if (found) setSelectedFolder(found);
                      }}
                    >
                      Browse
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<RefreshCw className="w-3.5 h-3.5" />}
                      onClick={() => handleRescanFolder(f.path)}
                    >
                      Rescan
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFolder(f.path)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenuState && (
        <ContextMenu
          x={contextMenuState.x}
          y={contextMenuState.y}
          track={contextMenuState.track}
          onClose={() => setContextMenuState(null)}
          onPlay={(t) => playTrack(t)}
          onPlayNext={(t) => playNext(t)}
          onAddToQueue={(t) => addToQueue(t)}
          onAddToPlaylist={(t) => setPlaylistModalTracks([t])}
          onToggleFavorite={(t) => toggleFavorite(t.id)}
          onShowProperties={(t) => setTrackInfoTrack(t)}
          onEditMetadata={(t) => setEditMetadataTrack(t)}
          onChangeArtwork={(t) => setArtworkModalTrack(t)}
          onRenameFile={(t) => setFileActionState({ track: t, mode: 'rename' })}
          onMoveFile={(t) => setFileActionState({ track: t, mode: 'move' })}
          onCopyFile={(t) => setFileActionState({ track: t, mode: 'copy' })}
          onDeletePhysicalFile={(t) => setFileActionState({ track: t, mode: 'delete' })}
          onRemoveFromLibrary={async (t) => {
            const res = await fileManagementService.removeFromLibrary(t.id);
            if (res.success) {
              notificationService.success('Removed', `Removed "${t.title}" from library.`);
              await loadData();
            }
          }}
          onOpenFileLocation={(p) => nativeBridge.openFileLocation(p)}
          onNavigateToAlbum={(alb) => {
            const found = albums.find((a) => a.title.toLowerCase() === alb.toLowerCase());
            if (found) setSelectedAlbum(found);
          }}
          onNavigateToArtist={(art) => {
            const found = artists.find((a) => a.name.toLowerCase() === art.toLowerCase());
            if (found) {
              setSelectedArtist(found);
            } else {
              setSearchQuery(art);
              setActiveTab('songs');
            }
          }}
        />
      )}

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={Boolean(playlistModalTracks && playlistModalTracks.length > 0)}
        trackOrTracks={playlistModalTracks}
        onClose={() => setPlaylistModalTracks(null)}
      />

      {/* Album Details Modal */}
      <AlbumDetailsModal
        album={selectedAlbum}
        isOpen={Boolean(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
      />

      {/* Artist Details Modal */}
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

      {/* Genre Details Modal */}
      <GenreDetailsModal
        genre={selectedGenre}
        isOpen={Boolean(selectedGenre)}
        onClose={() => setSelectedGenre(null)}
        onAddToPlaylist={(tracks) => setPlaylistModalTracks(tracks)}
      />

      {/* Folder Details Modal */}
      <FolderDetailsModal
        folder={selectedFolder}
        isOpen={Boolean(selectedFolder)}
        onClose={() => setSelectedFolder(null)}
        onAddToPlaylist={(tracks) => setPlaylistModalTracks(tracks)}
      />

      {/* Track Properties Modal */}
      <TrackPropertiesModal
        track={propertyTrack}
        isOpen={Boolean(propertyTrack)}
        onClose={() => setPropertyTrack(null)}
      />

      {/* Detailed Track Info & File Management Modal */}
      <TrackInfoModal
        track={trackInfoTrack}
        isOpen={Boolean(trackInfoTrack)}
        onClose={() => setTrackInfoTrack(null)}
        onEditMetadata={(t) => {
          setTrackInfoTrack(null);
          setEditMetadataTrack(t);
        }}
        onChangeArtwork={(t) => {
          setTrackInfoTrack(null);
          setArtworkModalTrack(t);
        }}
        onRenameFile={(t) => {
          setTrackInfoTrack(null);
          setFileActionState({ track: t, mode: 'rename' });
        }}
        onMoveFile={(t) => {
          setTrackInfoTrack(null);
          setFileActionState({ track: t, mode: 'move' });
        }}
        onCopyFile={(t) => {
          setTrackInfoTrack(null);
          setFileActionState({ track: t, mode: 'copy' });
        }}
        onDeleteFile={(t) => {
          setTrackInfoTrack(null);
          setFileActionState({ track: t, mode: 'delete' });
        }}
      />

      {/* Artwork Manager Modal */}
      <ArtworkManagerModal
        track={artworkModalTrack}
        isOpen={Boolean(artworkModalTrack)}
        onClose={() => setArtworkModalTrack(null)}
        onArtworkUpdated={loadData}
      />

      {/* File Action Modal (Rename, Move, Copy, Delete Physical) */}
      <FileActionModal
        track={fileActionState?.track || null}
        mode={fileActionState?.mode || 'rename'}
        isOpen={Boolean(fileActionState)}
        onClose={() => setFileActionState(null)}
        onCompleted={loadData}
      />

      {/* File & Folder Organization Modal */}
      <OrganizeFilesModal
        tracks={selectedTrackIds.size > 0 ? selectedTracksList : tracks}
        isOpen={isOrganizeModalOpen}
        onClose={() => setIsOrganizeModalOpen(false)}
        onOrganized={async () => {
          setSelectedTrackIds(new Set());
          await loadData();
        }}
      />

      {/* Metadata Editor Modal (Single Song) */}
      <MetadataEditorModal
        track={editMetadataTrack}
        isOpen={Boolean(editMetadataTrack)}
        onClose={() => setEditMetadataTrack(null)}
        onSaved={async () => {
          await loadData();
        }}
      />

      {/* Bulk Metadata Editor Modal (Multi-Song) */}
      <BulkMetadataEditorModal
        tracks={selectedTracksList}
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        onUpdated={async () => {
          setSelectedTrackIds(new Set());
          await loadData();
        }}
      />

      {/* Advanced Filter Panel */}
      <LibraryFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        criteria={filterCriteria}
        onChange={setFilterCriteria}
        availableGenres={genres.map((g) => g.name)}
      />

      {/* Column Customizer Modal */}
      <ColumnCustomizerModal
        isOpen={isColumnsModalOpen}
        onClose={() => setIsColumnsModalOpen(false)}
        config={visibleColumns}
        onChange={handleColumnsChange}
      />

      {/* Duplicate Detection Modal */}
      <DuplicateDetectionModal
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        onUpdated={loadData}
      />

      {/* Missing Files Modal */}
      <MissingFilesModal
        isOpen={isMissingModalOpen}
        onClose={() => setIsMissingModalOpen(false)}
        onUpdated={loadData}
      />

      {/* Library Statistics Modal */}
      <LibraryStatisticsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />

      {/* Scanning Progress & Summary Modal */}
      <ScanProgressModal
        progress={scanProgress}
        onCancel={() => {
          if (abortController) abortController.abort();
          setScanProgress(null);
        }}
        onClose={() => setScanProgress(null)}
      />
    </div>
  );
};

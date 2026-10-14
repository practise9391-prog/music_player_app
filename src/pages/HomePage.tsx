import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Track,
  Album,
  Artist,
  Genre,
  PlaylistRecord,
  HomeDashboardSettings,
  DEFAULT_HOME_SETTINGS,
  ExplainableTrackRecommendation,
  DailyMixCollection,
  UnplayedAndForgottenBundle,
  ListeningInsightsData,
  ContinueListeningData,
  SearchHistoryRecord,
} from '../types';
import {
  TrackRepository,
  PlaylistRepository,
  PlaylistTrackRepository,
  SearchHistoryRepository,
} from '../database/repository';
import { SmartPlaylistEngine } from '../services/playlists/SmartPlaylistEngine';
import { usePlayer } from '../player/PlayerContext';
import { Button } from '../components/ui/Button';
import {
  FolderOpen,
  PlusCircle,
  Link2,
  Play,
  Music2,
  Clock,
  Heart,
  Disc,
  Headphones,
  Sparkles,
  Calendar,
  User,
  Star,
  RotateCcw,
  SlidersHorizontal,
  BarChart3,
  Search,
  X,
  History,
  Users,
  Tag,
  Shuffle,
  ChevronRight,
  Pin,
  Info,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { musicDiscoveryService } from '../services/discovery/MusicDiscoveryService';
import { SearchEngine } from '../services/search/SearchEngine';
import { notificationService } from '../services/errorService';

// Modals
import { ArtistDetailsModal } from '../components/modals/ArtistDetailsModal';
import { AlbumDetailsModal } from '../components/modals/AlbumDetailsModal';
import { GenreDetailsModal } from '../components/modals/GenreDetailsModal';
import { TrackInfoModal } from '../components/modals/TrackInfoModal';
import { HomeCustomizationModal } from '../components/modals/HomeCustomizationModal';
import { ListeningStatsModal } from '../components/modals/ListeningStatsModal';
import { MusicProfileModal } from '../components/modals/MusicProfileModal';

interface HomePageProps {
  onOpenFolder: () => void;
  onAddMusic: () => void;
  onNavigateToOnline: () => void;
  onOpenFullPlayer: () => void;
  onNavigate?: (route: any, playlistId?: string) => void;
  onOpenSearchModal?: () => void;
  searchQuery?: string;
}

function formatDuration(seconds?: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const HomePage: React.FC<HomePageProps> = ({
  onOpenFolder,
  onAddMusic,
  onNavigateToOnline,
  onOpenFullPlayer,
  onNavigate,
  onOpenSearchModal,
  searchQuery = '',
}) => {
  const { playTrack, playPlaylist, shufflePlaylist, toggleFavorite, currentTrack, state } =
    usePlayer();

  // Dashboard Settings & Section Order
  const [dashboardSettings, setDashboardSettings] =
    useState<HomeDashboardSettings>(DEFAULT_HOME_SETTINGS);

  // Data States
  const [tracks, setTracks] = useState<Track[]>([]);
  const [continueData, setContinueData] = useState<ContinueListeningData | null>(null);
  const [recentlyAdded, setRecentlyAdded] = useState<Track[]>([]);
  const [mostPlayed, setMostPlayed] = useState<Track[]>([]);
  const [dailyMixes, setDailyMixes] = useState<DailyMixCollection[]>([]);
  const [recommendations, setRecommendations] = useState<ExplainableTrackRecommendation[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [unplayedData, setUnplayedData] = useState<UnplayedAndForgottenBundle | null>(null);
  const [pinnedPlaylists, setPinnedPlaylists] = useState<PlaylistRecord[]>([]);
  const [recentPlaylists, setRecentPlaylists] = useState<PlaylistRecord[]>([]);
  const [insights, setInsights] = useState<ListeningInsightsData | null>(null);

  // Search Suggestions State
  const [localSearchInput, setLocalSearchInput] = useState(searchQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryRecord[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<Track[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Active Modals State
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [selectedTrackForInfo, setSelectedTrackForInfo] = useState<Track | null>(null);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Active Tab for Explore Section
  const [exploreTab, setExploreTab] = useState<'artists' | 'albums' | 'genres'>('artists');
  // Active Tab for Unplayed Section
  const [unplayedTab, setUnplayedTab] = useState<'never' | 'forgotten' | 'rarely'>('never');

  const [isLoading, setIsLoading] = useState(true);

  // Load Dashboard Settings
  const loadSettings = async () => {
    const s = await musicDiscoveryService.getDashboardSettings();
    setDashboardSettings(s);
  };

  // Load Full Home Data
  const loadHomeData = async () => {
    setIsLoading(true);
    try {
      const [
        allTracks,
        contData,
        added,
        played,
        mixes,
        recs,
        allArtists,
        allAlbums,
        allGenres,
        unplayed,
        allPlaylists,
        insightsData,
        recentSearchTerms,
      ] = await Promise.all([
        TrackRepository.getAll(),
        musicDiscoveryService.getContinueListeningData(),
        musicDiscoveryService.getRecentlyAdded(12),
        musicDiscoveryService.getMostPlayed(12),
        musicDiscoveryService.getDailyMixes(),
        musicDiscoveryService.getMadeForYouRecommendations(6),
        TrackRepository.getArtists(),
        TrackRepository.getAlbums(),
        TrackRepository.getGenres(),
        musicDiscoveryService.getUnplayedAndForgotten(),
        PlaylistRepository.getAll(),
        musicDiscoveryService.getListeningInsights('30days'),
        SearchHistoryRepository.getRecent(5),
      ]);

      setTracks(allTracks);
      setContinueData(contData);
      setRecentlyAdded(added);
      setMostPlayed(played);
      setDailyMixes(mixes);
      setRecommendations(recs);
      setArtists(allArtists.slice(0, 8));
      setAlbums(allAlbums.slice(0, 8));
      setGenres(allGenres.slice(0, 10));
      setUnplayedData(unplayed);
      setPinnedPlaylists(allPlaylists.filter((p) => p.isPinned));
      setRecentPlaylists(allPlaylists.slice(0, 6));
      setInsights(insightsData);
      setRecentSearches(recentSearchTerms);
    } catch (err) {
      console.error('Error loading home discovery data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadHomeData();

    const handleLibraryUpdate = () => loadHomeData();
    const handleSettingsUpdate = () => loadSettings();
    const handleRecsUpdate = async () => {
      const updatedRecs = await musicDiscoveryService.getMadeForYouRecommendations(6);
      setRecommendations(updatedRecs);
    };

    window.addEventListener('nova-library-updated', handleLibraryUpdate);
    window.addEventListener('nova-playlists-updated', handleLibraryUpdate);
    window.addEventListener('nova-home-settings-updated', handleSettingsUpdate);
    window.addEventListener('nova-recommendations-updated', handleRecsUpdate);

    return () => {
      window.removeEventListener('nova-library-updated', handleLibraryUpdate);
      window.removeEventListener('nova-playlists-updated', handleLibraryUpdate);
      window.removeEventListener('nova-home-settings-updated', handleSettingsUpdate);
      window.removeEventListener('nova-recommendations-updated', handleRecsUpdate);
    };
  }, []);

  // Live Search Suggestions
  useEffect(() => {
    if (!localSearchInput.trim()) {
      setSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const results = await SearchEngine.executeGlobalSearch(localSearchInput);
        setSearchSuggestions(results.songs.slice(0, 5).map((r) => r.track));
      } catch (err) {
        console.error('Failed to run home search:', err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [localSearchInput]);

  // Handle Outside Click for Search Dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Safe Track Playback with Availability Check
  const handleSafePlayTrack = (track: Track, queueList?: Track[]) => {
    const check = musicDiscoveryService.verifyTrackPlayback(track);
    if (!check.canPlay) {
      notificationService.error('Cannot Play Track', check.reason || 'File is unavailable.');
      return;
    }
    playTrack(track, queueList || [track]);
  };

  // Safe Playlist Playback
  const handleSafePlayPlaylist = async (playlist: PlaylistRecord) => {
    let tracksToPlay: Track[] = [];
    if (playlist.type === 'smart' && playlist.smartDefinition) {
      const all = await TrackRepository.getAll();
      tracksToPlay = SmartPlaylistEngine.filterTracks(all, playlist.smartDefinition);
    } else {
      const pTracks = await PlaylistTrackRepository.getTracksForPlaylist(playlist.id);
      tracksToPlay = pTracks.map((pt) => pt.trackData).filter(Boolean) as Track[];
    }
    if (tracksToPlay.length > 0) {
      playPlaylist(tracksToPlay, 0);
    } else {
      notificationService.info('Empty Playlist', `"${playlist.name}" has no tracks.`);
    }
  };

  // Dismiss a Recommendation
  const handleDismissRecommendation = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    musicDiscoveryService.dismissRecommendation(trackId);
    setRecommendations((prev) => prev.filter((r) => r.track.id !== trackId));
    notificationService.info('Recommendation Dismissed', 'This song will no longer be suggested.');
  };

  // Toggle Pin Playlist
  const handleTogglePinPlaylist = async (playlistId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isPinned = await PlaylistRepository.togglePinned(playlistId);
    const updated = await PlaylistRepository.getAll();
    setPinnedPlaylists(updated.filter((p) => p.isPinned));
    notificationService.info(
      isPinned ? 'Playlist Pinned' : 'Playlist Unpinned',
      isPinned ? 'Added to quick collections.' : 'Removed from quick collections.'
    );
  };

  // Items display count & density classes
  const isCompact = dashboardSettings.cardDensity === 'compact';
  const itemsLimit = dashboardSettings.itemsPerSection || 6;

  // ─────────────────────────────────────────────────────────────
  // RENDER SECTIONS
  // ─────────────────────────────────────────────────────────────

  // Section 1: Greeting & Quick Access
  const renderGreetingQuickAccess = () => (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--surface-secondary)] via-[var(--surface-card)] to-[var(--surface-secondary)] border border-[var(--border)] p-6 md:p-8 shadow-sm">
      <div className="relative z-10 max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--surface)] text-[var(--accent)] text-xs font-semibold border border-[var(--border)]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Local Music Station • Air-Gapped &amp; Private</span>
          </div>
          <span className="text-xs text-[var(--text-muted)]">•</span>
          <span className="text-xs text-[var(--text-secondary)]">
            {tracks.length} tracks in collection
          </span>
        </div>

        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            {getGreeting()}, Explorer
          </h1>
          <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1 max-w-xl leading-relaxed">
            Personalized offline music hub. Rediscover songs you own, explore your artists and genres,
            and enjoy high-resolution sound without telemetry.
          </p>
        </div>

        {/* Quick Access Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {onOpenSearchModal && (
            <button
              onClick={onOpenSearchModal}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm"
            >
              <Search className="w-3.5 h-3.5 text-[var(--accent)]" /> Search
            </button>
          )}
          {onNavigate && (
            <>
              <button
                onClick={() => onNavigate('library')}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm"
              >
                <Music2 className="w-3.5 h-3.5 text-[var(--accent)]" /> Library
              </button>
              <button
                onClick={() => onNavigate('favorites')}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm"
              >
                <Heart className="w-3.5 h-3.5 text-rose-400" /> Favorites
              </button>
              <button
                onClick={() => onNavigate('playlists')}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm"
              >
                <Pin className="w-3.5 h-3.5 text-amber-400" /> Playlists
              </button>
              <button
                onClick={() => onNavigate('downloads')}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm"
              >
                <Disc className="w-3.5 h-3.5 text-emerald-400" /> Downloads
              </button>
            </>
          )}
          <button
            onClick={() => setIsStatsModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" /> Stats &amp; Insights
          </button>
          <button
            onClick={() => setIsCustomizationOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--accent)] flex items-center gap-2 transition-all shadow-sm ml-auto"
            title="Customize Home Dashboard"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Customize
          </button>
        </div>
      </div>
    </div>
  );

  // Search Input Bar with Suggestions
  const renderSearchBar = () => (
    <div ref={searchContainerRef} className="relative w-full max-w-2xl">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={localSearchInput}
          onChange={(e) => setLocalSearchInput(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          placeholder="Search your library (songs, artists, albums, genres)..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-all shadow-sm"
        />
        {localSearchInput && (
          <button
            onClick={() => setLocalSearchInput('')}
            className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Suggestions & Recent Searches Dropdown */}
      {isSearchFocused && (
        <div className="absolute top-full mt-2 left-0 right-0 z-40 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden divide-y divide-[var(--border-subtle)]">
          {/* Quick Track Suggestions */}
          {searchSuggestions.length > 0 && (
            <div className="p-2 space-y-1">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Matching Songs
              </div>
              {searchSuggestions.map((track) => (
                <div
                  key={track.id}
                  onClick={() => {
                    handleSafePlayTrack(track);
                    setIsSearchFocused(false);
                    SearchHistoryRepository.addSearch(track.title);
                  }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors group"
                >
                  <div className="w-8 h-8 rounded bg-[var(--surface)] shrink-0 overflow-hidden flex items-center justify-center border border-[var(--border)]">
                    {track.coverArtUrl ? (
                      <img src={track.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                      <Music2 className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)]">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] truncate">
                      {track.artist}
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="p-2 space-y-1 bg-[var(--surface-secondary)]/30">
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <History className="w-3 h-3 text-[var(--accent)]" /> Recent Searches
                </span>
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await SearchHistoryRepository.clear();
                    setRecentSearches([]);
                  }}
                  className="text-[10px] text-[var(--text-muted)] hover:text-rose-400 transition-colors"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => {
                    setLocalSearchInput(rec.query);
                  }}
                  className="flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-[var(--surface)] cursor-pointer text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="truncate">{rec.query}</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (rec.id !== undefined) {
                        await SearchHistoryRepository.remove(rec.id);
                        setRecentSearches((prev) => prev.filter((r) => r.id !== rec.id));
                      }
                    }}
                    className="text-[var(--text-muted)] hover:text-rose-400 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Section 2: Continue Listening
  const renderContinueListening = () => {
    if (!continueData || (!continueData.lastTrack && continueData.recentTracks.length === 0)) {
      return null;
    }

    const { lastTrack, lastPosition, recentTracks, recentAlbums } = continueData;

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[var(--accent)]" /> Continue Listening
          </h2>
          {recentTracks.length > 0 && (
            <button
              onClick={() => handleSafePlayTrack(recentTracks[0], recentTracks)}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              Play All Recent <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Hero Resume Card */}
        {lastTrack && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[var(--surface-secondary)] to-[var(--surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center shadow-md">
                {lastTrack.coverArtUrl ? (
                  <img src={lastTrack.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Disc className="w-8 h-8 text-[var(--text-muted)]" />
                )}
              </div>
              <div className="min-w-0 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                  Last Played Track
                </span>
                <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {lastTrack.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {lastTrack.artist} • {lastTrack.album || 'Single'}
                </p>
                {lastPosition && lastPosition > 0 ? (
                  <span className="inline-block text-[11px] font-mono text-[var(--text-muted)]">
                    Position: {formatDuration(lastPosition)} / {formatDuration(lastTrack.duration)}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="primary"
                size="md"
                icon={<Play className="w-4 h-4 fill-current ml-0.5" />}
                onClick={() => handleSafePlayTrack(lastTrack, recentTracks)}
              >
                Resume Song
              </Button>
              <button
                type="button"
                onClick={() => setSelectedTrackForInfo(lastTrack)}
                className="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] transition-all"
                title="Song Details"
              >
                <Info className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Recently Played Tracks Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {recentTracks.slice(0, itemsLimit).map((track) => (
            <div
              key={track.id}
              onClick={() => handleSafePlayTrack(track, recentTracks)}
              className="group p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 shadow-sm"
            >
              <div className="aspect-square rounded-lg bg-[var(--surface-secondary)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                {track.coverArtUrl ? (
                  <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <Disc className="w-8 h-8 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full btn-primary flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
                  </div>
                </div>
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">{track.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 3: Daily Mixes & Dynamic Collections
  const renderDailyMixes = () => {
    if (dailyMixes.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Daily Mixes &amp; Collections
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Dynamic collections automatically generated from your library
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {dailyMixes.map((mix) => (
            <div
              key={mix.id}
              className={`group relative p-5 rounded-2xl bg-gradient-to-br ${mix.gradient} text-white shadow-lg overflow-hidden flex flex-col justify-between transition-all transform hover:-translate-y-0.5`}
            >
              <div className="space-y-1 z-10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                  {mix.subtitle}
                </span>
                <h3 className="text-lg font-black tracking-tight">{mix.name}</h3>
                <p className="text-xs text-white/85 line-clamp-2 leading-relaxed">
                  {mix.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 z-10">
                <span className="text-[11px] font-mono text-white/75">
                  {formatDuration(mix.totalDuration)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (mix.tracks.length > 0) {
                        const shuffled = [...mix.tracks].sort(() => 0.5 - Math.random());
                        handleSafePlayTrack(shuffled[0], shuffled);
                      }
                    }}
                    className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white transition-all"
                    title="Shuffle Mix"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (mix.tracks.length > 0) {
                        handleSafePlayTrack(mix.tracks[0], mix.tracks);
                      }
                    }}
                    className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-all shadow-md"
                    title="Play Mix"
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 4: Made for You (Personalized Recommendations)
  const renderMadeForYou = () => {
    if (!dashboardSettings.recommendationsEnabled || recommendations.length === 0) {
      return null;
    }

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" /> Made for You
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Explainable local recommendations based on your listening history
            </p>
          </div>
          <button
            onClick={() => setIsCustomizationOpen(true)}
            className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Manage Signals
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {recommendations.slice(0, itemsLimit).map((rec) => (
            <div
              key={rec.track.id}
              onClick={() => handleSafePlayTrack(rec.track)}
              className="group relative p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2.5 shadow-sm"
            >
              {/* Dismiss Button */}
              <button
                type="button"
                onClick={(e) => handleDismissRecommendation(rec.track.id, e)}
                className="absolute top-2 right-2 z-20 p-1 rounded-full bg-black/60 text-white/70 hover:text-white hover:bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Dismiss Recommendation"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[var(--surface-secondary)] shrink-0 overflow-hidden flex items-center justify-center border border-[var(--border)]">
                  {rec.track.coverArtUrl ? (
                    <img src={rec.track.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <Music2 className="w-6 h-6 text-[var(--text-muted)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)]">
                    {rec.track.title}
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    {rec.track.artist}
                  </p>
                </div>
              </div>

              {/* Explainability Tag */}
              <div className="px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 truncate border border-[var(--border-subtle)]">
                <Info className="w-3 h-3 text-[var(--accent)] shrink-0" />
                <span className="truncate">{rec.reason}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 5: Recently Added Music
  const renderRecentlyAdded = () => {
    if (recentlyAdded.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[var(--accent)]" /> Recently Added Music
          </h2>
          {onNavigate && (
            <button
              onClick={() => onNavigate('library')}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              See All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {recentlyAdded.slice(0, itemsLimit).map((track) => (
            <div
              key={track.id}
              onClick={() => handleSafePlayTrack(track, recentlyAdded)}
              className="group p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 shadow-sm"
            >
              <div className="aspect-square rounded-lg bg-[var(--surface-secondary)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                {track.coverArtUrl ? (
                  <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <Disc className="w-8 h-8 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full btn-primary flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
                  </div>
                </div>
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">{track.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 6: Most-Played Music
  const renderMostPlayed = () => {
    if (mostPlayed.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Headphones className="w-4 h-4 text-[var(--accent)]" /> Most-Played Music
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Ranked by your verified playback counts
            </p>
          </div>
          <button
            onClick={() => handleSafePlayTrack(mostPlayed[0], mostPlayed)}
            className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            Play All <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {mostPlayed.slice(0, itemsLimit).map((track, idx) => (
            <div
              key={track.id}
              onClick={() => handleSafePlayTrack(track, mostPlayed)}
              className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all group shadow-sm"
            >
              <span className="w-5 text-center text-xs font-black font-mono text-[var(--accent)] shrink-0">
                #{idx + 1}
              </span>
              <div className="w-11 h-11 rounded-lg bg-[var(--surface-secondary)] shrink-0 overflow-hidden flex items-center justify-center border border-[var(--border)]">
                {track.coverArtUrl ? (
                  <img src={track.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Music2 className="w-5 h-5 text-[var(--text-muted)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)]">
                  {track.title}
                </h4>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">
                  {track.artist}
                </p>
              </div>
              <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0 px-2 py-0.5 rounded bg-[var(--surface-secondary)]">
                {track.playCount || 1} plays
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 7: Explore Your Library (Artists, Albums, Genres)
  const renderExploreLibrary = () => {
    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Compass className="w-4 h-4 text-[var(--accent)]" /> Explore Your Library
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Browse your personal music collection
            </p>
          </div>

          <div className="flex rounded-lg overflow-hidden border border-[var(--border)] p-1 bg-[var(--surface)]">
            {(['artists', 'albums', 'genres'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setExploreTab(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-all ${
                  exploreTab === tab
                    ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {exploreTab === 'artists' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {artists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => setSelectedArtist(artist)}
                className="group p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all text-center space-y-2 shadow-sm"
              >
                <div className="w-16 h-16 rounded-full mx-auto bg-[var(--surface-secondary)] flex items-center justify-center border border-[var(--border-subtle)] overflow-hidden">
                  <Users className="w-7 h-7 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                    {artist.name}
                  </h4>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {artist.trackCount} tracks
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {exploreTab === 'albums' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {albums.map((album) => (
              <div
                key={album.id}
                onClick={() => setSelectedAlbum(album)}
                className="group p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 shadow-sm"
              >
                <div className="aspect-square rounded-lg bg-[var(--surface-secondary)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                  {album.coverArtUrl ? (
                    <img src={album.coverArtUrl} alt={album.title} className="w-full h-full object-cover" />
                  ) : (
                    <Disc className="w-8 h-8 text-[var(--text-muted)]" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full btn-primary flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
                    </div>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{album.title}</h4>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">{album.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {exploreTab === 'genres' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {genres.map((genre) => (
              <div
                key={genre.name}
                onClick={() => setSelectedGenre(genre)}
                className="p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all flex items-center justify-between gap-2 group shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Tag className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                  <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                    {genre.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-muted)] shrink-0">
                  {genre.trackCount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  // Section 8: Rediscover Unplayed & Forgotten Music
  const renderUnplayedForgotten = () => {
    if (!unplayedData) return null;

    let activeList: Track[] = [];
    let titleDescription = '';

    if (unplayedTab === 'never') {
      activeList = unplayedData.neverPlayed;
      titleDescription = 'Songs in your library that have zero recorded plays';
    } else if (unplayedTab === 'forgotten') {
      activeList = unplayedData.forgottenFavorites;
      titleDescription = 'Favorite songs you have not listened to in a while';
    } else {
      activeList = unplayedData.highlyRatedRarelyPlayed;
      titleDescription = 'Songs rated 4–5 stars that have fewer than 3 plays';
    }

    if (activeList.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-emerald-400" /> Rediscover Your Collection
            </h2>
            <p className="text-xs text-[var(--text-muted)]">{titleDescription}</p>
          </div>

          <div className="flex rounded-lg overflow-hidden border border-[var(--border)] p-1 bg-[var(--surface)]">
            <button
              type="button"
              onClick={() => setUnplayedTab('never')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                unplayedTab === 'never'
                  ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Never Played ({unplayedData.neverPlayed.length})
            </button>
            <button
              type="button"
              onClick={() => setUnplayedTab('forgotten')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                unplayedTab === 'forgotten'
                  ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Forgotten Favorites ({unplayedData.forgottenFavorites.length})
            </button>
            <button
              type="button"
              onClick={() => setUnplayedTab('rarely')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                unplayedTab === 'rarely'
                  ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Rarely Played ({unplayedData.highlyRatedRarelyPlayed.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {activeList.slice(0, itemsLimit).map((track) => (
            <div
              key={track.id}
              onClick={() => handleSafePlayTrack(track, activeList)}
              className="group p-3 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all space-y-2 shadow-sm"
            >
              <div className="aspect-square rounded-lg bg-[var(--surface-secondary)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                {track.coverArtUrl ? (
                  <img src={track.coverArtUrl} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <Music2 className="w-8 h-8 text-[var(--text-muted)]" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full btn-primary flex items-center justify-center shadow-lg">
                    <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
                  </div>
                </div>
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
                <p className="text-[11px] text-[var(--text-secondary)] truncate">{track.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 9: Quick Collections & Pinned Playlists
  const renderQuickCollections = () => {
    const listToDisplay = pinnedPlaylists.length > 0 ? pinnedPlaylists : recentPlaylists;
    if (listToDisplay.length === 0) return null;

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Pin className="w-4 h-4 text-amber-400" /> Quick Collections &amp; Playlists
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {pinnedPlaylists.length > 0 ? 'Your pinned playlists' : 'Recently updated playlists'}
            </p>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('playlists')}
              className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {listToDisplay.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => handleSafePlayPlaylist(playlist)}
              className="group p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all flex items-center justify-between gap-3 shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] shrink-0 flex items-center justify-center text-[var(--accent)]">
                  <Disc className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)]">
                    {playlist.name}
                  </h4>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {playlist.songCount || 0} songs • {playlist.type === 'smart' ? 'Smart' : 'Custom'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleTogglePinPlaylist(playlist.id, e)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    playlist.isPinned
                      ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                      : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                  title={playlist.isPinned ? 'Unpin' : 'Pin to Home'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <div className="w-7 h-7 rounded-full btn-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5 text-[var(--btn-text)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // Section 10: Listening Insights & Statistics Summary
  const renderListeningInsights = () => {
    if (!insights) return null;

    return (
      <section className="space-y-4">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-[var(--surface-secondary)] to-[var(--surface-card)] border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-[var(--surface)] text-[var(--accent)] text-[10px] font-mono border border-[var(--border)]">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Offline Listening Analytics</span>
            </div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              Your Music Habits at a Glance
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              In the past 30 days, you listened to{' '}
              <strong className="text-[var(--text-primary)]">
                {insights.topArtist ? insights.topArtist.name : 'your music library'}
              </strong>{' '}
              and logged {insights.completedSessionsCount} sessions without sending any data to the cloud.
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <Button
              variant="primary"
              size="md"
              icon={<BarChart3 className="w-4 h-4" />}
              onClick={() => setIsStatsModalOpen(true)}
            >
              View Full Analytics
            </Button>
          </div>
        </div>
      </section>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // SECTION MAPPER
  // ─────────────────────────────────────────────────────────────

  const renderSectionById = (id: string) => {
    switch (id) {
      case 'greeting_quick_access':
        return renderGreetingQuickAccess();
      case 'continue_listening':
        return renderContinueListening();
      case 'daily_mixes':
        return renderDailyMixes();
      case 'made_for_you':
        return renderMadeForYou();
      case 'recently_added':
        return renderRecentlyAdded();
      case 'most_played':
        return renderMostPlayed();
      case 'explore_library':
        return renderExploreLibrary();
      case 'unplayed_forgotten':
        return renderUnplayedForgotten();
      case 'quick_collections':
        return renderQuickCollections();
      case 'listening_insights':
        return renderListeningInsights();
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 select-none">
      {/* Prominent Search Input Entrypoint */}
      {renderSearchBar()}

      {/* Empty State when Library has 0 Songs */}
      {!isLoading && tracks.length === 0 && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--accent)] border border-[var(--border)] shadow-inner">
            <Music2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[var(--text-primary)]">No local music yet</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md">
              Index your local music directory to populate personalized mixes, recommendations,
              recently added tracks, and acoustic insights.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              size="md"
              icon={<FolderOpen className="w-4 h-4" />}
              onClick={onOpenFolder}
            >
              Add Music Folder
            </Button>
            <Button
              variant="secondary"
              size="md"
              icon={<PlusCircle className="w-4 h-4" />}
              onClick={onAddMusic}
            >
              Add Audio Files
            </Button>
          </div>
        </div>
      )}

      {/* Render Dynamic Sections Based on Section Order & Preferences */}
      {dashboardSettings.sectionOrder.map((sectionId) => {
        const isEnabled = dashboardSettings.enabledSections[sectionId] !== false;
        if (!isEnabled) return null;

        const rendered = renderSectionById(sectionId);
        if (!rendered) return null;

        return <React.Fragment key={sectionId}>{rendered}</React.Fragment>;
      })}

      {/* Interactive Detail Modals */}
      <ArtistDetailsModal
        artist={selectedArtist}
        isOpen={Boolean(selectedArtist)}
        onClose={() => setSelectedArtist(null)}
      />

      <AlbumDetailsModal
        album={selectedAlbum}
        isOpen={Boolean(selectedAlbum)}
        onClose={() => setSelectedAlbum(null)}
      />

      <GenreDetailsModal
        genre={selectedGenre}
        isOpen={Boolean(selectedGenre)}
        onClose={() => setSelectedGenre(null)}
      />

      <TrackInfoModal
        track={selectedTrackForInfo}
        isOpen={Boolean(selectedTrackForInfo)}
        onClose={() => setSelectedTrackForInfo(null)}
      />

      <HomeCustomizationModal
        isOpen={isCustomizationOpen}
        onClose={() => setIsCustomizationOpen(false)}
        settings={dashboardSettings}
        onSave={async (newSettings) => {
          setDashboardSettings(newSettings);
          await musicDiscoveryService.saveDashboardSettings(newSettings);
        }}
      />

      <ListeningStatsModal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
      />

      <MusicProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};

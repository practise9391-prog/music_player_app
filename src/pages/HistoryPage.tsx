import React, { useEffect, useState, useMemo } from 'react';
import { YouTubeHistoryRecord, PlayHistoryRecord, Track } from '../types';
import { YouTubeHistoryRepository, PlayHistoryRepository, TrackRepository } from '../database/repository';
import { CacheManager } from '../services/youtube/CacheManager';
import { usePlayer } from '../player/PlayerContext';
import { notificationService } from '../services/errorService';
import { generateVibrantCover } from '../library/artworkCache';
import { YouTubeHistoryCard } from '../components/youtube/YouTubeHistoryCard';
import { CacheDetailsModal } from '../components/youtube/CacheDetailsModal';
import {
  Clock,
  Globe,
  Search,
  Filter,
  ArrowUpDown,
  History as HistoryIcon,
  HardDrive,
  Trash2,
  CheckCircle,
  Heart,
  RefreshCw,
  Play,
} from 'lucide-react';

import { NavRoute } from '../components/layout/Sidebar';
import { PlaybackNotificationService } from '../services/notification/PlaybackNotificationService';

type SortOption = 'recent' | 'most_played' | 'oldest' | 'cached' | 'favorites';
type FilterOption = 'all' | 'cached' | 'online_only' | 'favorites';

interface HistoryPageProps {
  onNavigate?: (route: NavRoute) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ onNavigate }) => {
  const { playCachedYouTubeTrack, playYouTubeUrl, playTrack } = usePlayer();

  const [activeTab, setActiveTab] = useState<'all' | 'local' | 'online'>('all');
  const [youtubeHistory, setYoutubeHistory] = useState<YouTubeHistoryRecord[]>([]);
  const [playHistory, setPlayHistory] = useState<PlayHistoryRecord[]>([]);
  const [tracksById, setTracksById] = useState<Map<string, Track>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<YouTubeHistoryRecord | null>(null);
  const [deleteConfirmationItem, setDeleteConfirmationItem] = useState<YouTubeHistoryRecord | null>(null);

  const loadData = async () => {
    const yt = await YouTubeHistoryRepository.getAll();
    const local = await PlayHistoryRepository.getAll();
    const allTracks = await TrackRepository.getAll();
    const tMap = new Map<string, Track>();
    allTracks.forEach((t) => tMap.set(t.id, t));

    setYoutubeHistory(yt);
    setPlayHistory(local);
    setTracksById(tMap);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute unique history entries per track
  const uniqueHistory = useMemo(() => {
    const map = new Map<string, PlayHistoryRecord>();
    playHistory.forEach((rec) => {
      const key = rec.trackId || `${rec.title}:::${rec.artist}:::${rec.source}`;
      const existing = map.get(key);
      if (!existing || rec.playedAt > existing.playedAt) {
        map.set(key, rec);
      }
    });
    return Array.from(map.values()).sort((a, b) => b.playedAt - a.playedAt);
  }, [playHistory]);

  const localCount = useMemo(
    () => uniqueHistory.filter((r) => r.source !== 'online').length,
    [uniqueHistory]
  );
  const onlineCount = useMemo(
    () => uniqueHistory.filter((r) => r.source === 'online').length,
    [uniqueHistory]
  );
  const allCount = localCount + onlineCount;

  // Daily de-duplicated and sorted Local Play History (Requirement 11)
  const groupedLocalHistory = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dayMap = new Map<string, { label: string; dateSort: number; records: PlayHistoryRecord[] }>();

    const filteredRecords = playHistory.filter((rec) => {
      if (activeTab === 'local') return rec.source !== 'online';
      if (activeTab === 'online') return rec.source === 'online';
      return true;
    });

    filteredRecords.forEach((rec) => {
      const d = new Date(rec.playedAt);
      const dayStart = new Date(d);
      dayStart.setHours(0, 0, 0, 0);
      const dayKey = dayStart.toISOString().split('T')[0];

      let label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      if (dayStart.getTime() === today.getTime()) {
        label = 'Today';
      } else if (dayStart.getTime() === yesterday.getTime()) {
        label = 'Yesterday';
      }

      let group = dayMap.get(dayKey);
      if (!group) {
        group = { label, dateSort: dayStart.getTime(), records: [] };
        dayMap.set(dayKey, group);
      }
      group.records.push(rec);
    });

    const result: {
      label: string;
      dateSort: number;
      items: {
        trackId: string;
        title: string;
        artist: string;
        source?: 'local' | 'online';
        lastPlayedAt: number;
        playCountToday: number;
        track?: Track;
      }[];
    }[] = [];

    dayMap.forEach((group) => {
      const trackAgg = new Map<string, {
        trackId: string;
        title: string;
        artist: string;
        source?: 'local' | 'online';
        lastPlayedAt: number;
        playCountToday: number;
        track?: Track;
      }>();

      group.records.forEach((rec) => {
        const key = rec.trackId || `${rec.title}:::${rec.artist}`;
        const existing = trackAgg.get(key);
        if (existing) {
          existing.playCountToday += 1;
          if (rec.playedAt > existing.lastPlayedAt) {
            existing.lastPlayedAt = rec.playedAt;
          }
        } else {
          trackAgg.set(key, {
            trackId: rec.trackId,
            title: rec.title,
            artist: rec.artist,
            source: rec.source,
            lastPlayedAt: rec.playedAt,
            playCountToday: 1,
            track: tracksById.get(rec.trackId),
          });
        }
      });

      // Sort items descending by lastPlayedAt (most recently replayed appears on TOP!)
      const items = Array.from(trackAgg.values()).sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
      result.push({ label: group.label, dateSort: group.dateSort, items });
    });

    result.sort((a, b) => b.dateSort - a.dateSort);
    return result;
  }, [playHistory, tracksById, activeTab]);

  // Filter & Search
  const filteredAndSorted = useMemo(() => {
    let list = [...youtubeHistory];

    // Search query (title, artist, channel, video ID)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.artist.toLowerCase().includes(q) ||
          (item.channel && item.channel.toLowerCase().includes(q)) ||
          item.youtube_video_id.toLowerCase().includes(q)
      );
    }

    // Filter
    if (filterBy === 'cached') {
      list = list.filter((item) => item.cache_status === 'CACHED' && Boolean(item.cache_path));
    } else if (filterBy === 'online_only') {
      list = list.filter((item) => item.cache_status !== 'CACHED');
    } else if (filterBy === 'favorites') {
      list = list.filter((item) => item.is_favorite);
    }

    // Sort
    if (sortBy === 'recent') {
      list.sort((a, b) => b.last_played_at - a.last_played_at);
    } else if (sortBy === 'most_played') {
      list.sort((a, b) => b.play_count - a.play_count);
    } else if (sortBy === 'oldest') {
      list.sort((a, b) => a.last_played_at - b.last_played_at);
    } else if (sortBy === 'cached') {
      list.sort((a, b) => (b.cache_size || 0) - (a.cache_size || 0));
    } else if (sortBy === 'favorites') {
      list.sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0));
    }

    return list;
  }, [youtubeHistory, searchQuery, filterBy, sortBy]);

  // Group by timeline: Today, Yesterday, Older
  const groupedTimeline = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { [key: string]: YouTubeHistoryRecord[] } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredAndSorted.forEach((item) => {
      const itemDate = new Date(item.last_played_at);
      if (itemDate >= today) {
        groups.Today.push(item);
      } else if (itemDate >= yesterday) {
        groups.Yesterday.push(item);
      } else {
        groups.Earlier.push(item);
      }
    });

    return groups;
  }, [filteredAndSorted]);

  // Play Actions
  const handlePlayOffline = async (item: YouTubeHistoryRecord) => {
    const success = await playCachedYouTubeTrack(item);
    if (!success) {
      notificationService.error(
        'Offline Playback Unavailable',
        'Cached audio file is missing or corrupted. You can re-stream online.'
      );
      loadData();
    }
  };

  const handlePlayOnline = async (item: YouTubeHistoryRecord) => {
    try {
      await playYouTubeUrl(item.youtube_url, item.title, item.channel || item.artist);
      onNavigate?.('online');
      if (PlaybackNotificationService.shouldNotify(item.youtube_video_id)) {
        notificationService.success('Now Streaming Online', item.title);
      }
    } catch (err: any) {
      notificationService.error('Online Playback Failed', err.message || 'Could not start stream');
    }
  };

  const handleCache = async (item: YouTubeHistoryRecord) => {
    notificationService.info('Caching Initiated', `Downloading ${item.title}...`);
    try {
      await CacheManager.saveCache({
        videoId: item.youtube_video_id,
        canonicalUrl: item.youtube_url,
      });
      notificationService.success('Cached', `${item.title} is now available offline!`);
      loadData();
    } catch (err: any) {
      notificationService.error('Caching Failed', err.message || 'Could not cache track');
    }
  };

  const handleToggleFavorite = async (item: YouTubeHistoryRecord) => {
    const newVal = await YouTubeHistoryRepository.toggleFavorite(item.youtube_video_id);
    setYoutubeHistory((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_favorite: newVal } : i))
    );
  };

  const handleDeleteHistory = (item: YouTubeHistoryRecord) => {
    setDeleteConfirmationItem(item);
  };

  const confirmDelete = async (deleteCacheToo: boolean) => {
    if (!deleteConfirmationItem) return;
    const item = deleteConfirmationItem;

    if (deleteCacheToo) {
      await CacheManager.deleteCache(item.youtube_video_id);
    }
    await YouTubeHistoryRepository.remove(item.id);

    setYoutubeHistory((prev) => prev.filter((i) => i.id !== item.id));
    setDeleteConfirmationItem(null);
    notificationService.info('History Updated', 'Item removed from listening history.');
  };

  const handleDeleteCache = async (item: YouTubeHistoryRecord) => {
    await CacheManager.deleteCache(item.youtube_video_id);
    notificationService.info('Cache Deleted', `Local cache for ${item.title} removed.`);
    loadData();
  };

  const handlePlayLocalTrack = async (item: PlayHistoryRecord) => {
    try {
      let track = item.trackId ? await TrackRepository.getById(item.trackId) : null;
      if (!track && tracksById.has(item.trackId)) {
        track = tracksById.get(item.trackId)!;
      }
      if (!track) {
        notificationService.error('Playback Failed', 'Local audio file could not be found or was moved.');
        return;
      }
      await playTrack(track);
      if (PlaybackNotificationService.shouldNotify(track.id)) {
        notificationService.success('Now Playing', `${track.title} - ${track.artist}`);
      }
    } catch (err: any) {
      notificationService.error('Replay Failed', err?.message || 'Could not play history track.');
    }
  };

  const handleHistoryItemClick = async (item: {
    trackId: string;
    title: string;
    artist: string;
    source?: 'local' | 'online';
    lastPlayedAt: number;
    playCountToday: number;
    track?: Track;
  }) => {
    if (item.source === 'online' || item.trackId?.startsWith('yt_')) {
      const vid = item.trackId?.startsWith('yt_') ? item.trackId.slice(3) : item.trackId;
      const url = item.track?.originalUrl || `https://www.youtube.com/watch?v=${vid}`;
      try {
        await playYouTubeUrl(url, item.title, item.artist);
        onNavigate?.('online');
        if (PlaybackNotificationService.shouldNotify(vid)) {
          notificationService.success('Now Streaming Online', item.title);
        }
      } catch (err: any) {
        notificationService.error('Online Playback Failed', err?.message || 'Could not start stream');
      }
    } else {
      await handlePlayLocalTrack(item as unknown as PlayHistoryRecord);
    }
  };

  const handleClearLocalHistory = async () => {
    if (window.confirm('Clear all playback history records?')) {
      await PlayHistoryRepository.clear();
      setPlayHistory([]);
      notificationService.info('History Cleared', 'Local playback history logs cleared.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Listening History</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Locally stored play logs, YouTube history, and offline cached audio.
          </p>
        </div>

        {/* Tab switcher: [ All ] [ Local ] [ Online ] (Melo Panel 5) */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)]">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'all' ? 'bg-white/20' : 'bg-[var(--surface-secondary)]'}`}>
              {allCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'local'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
            }`}
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            <span>Local</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'local' ? 'bg-white/20' : 'bg-[var(--surface-secondary)]'}`}>
              {localCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('online')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'online'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--surface-secondary)]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Online</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${activeTab === 'online' ? 'bg-white/20' : 'bg-[var(--surface-secondary)]'}`}>
              {onlineCount}
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {activeTab === 'all' ? 'All Activity' : activeTab === 'local' ? 'Local Tracks' : 'Online Streams'} ({
              activeTab === 'all'
                ? allCount
                : activeTab === 'local'
                ? localCount
                : onlineCount
            })
          </span>
          {playHistory.length > 0 && (
            <button
              onClick={handleClearLocalHistory}
              className="px-2.5 py-1 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        <div className="space-y-6">
          {groupedLocalHistory.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-2">
              <HistoryIcon className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No Playback History Yet</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Play songs from your local library or online streams to track your listening journey.
              </p>
            </div>
          ) : (
            groupedLocalHistory.map((group) => (
              <div key={group.label} className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{group.label}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono font-normal">
                      ({group.items.length} song{group.items.length !== 1 ? 's' : ''})
                    </span>
                  </h3>
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => {
                    const coverUrl =
                      item.track?.coverArtUrl ||
                      generateVibrantCover(item.title, item.artist);

                    return (
                      <div
                        key={item.trackId || `${item.title}-${item.lastPlayedAt}`}
                        onClick={() => handleHistoryItemClick(item)}
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] text-xs cursor-pointer group transition-all shadow-sm hover:border-[var(--accent)]"
                      >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Artwork Thumbnail */}
                            <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 relative bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
                              <img
                                src={coverUrl}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = generateVibrantCover(item.title, item.artist);
                                }}
                              />
                              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Play className="w-4 h-4 text-white fill-current" />
                              </div>
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] text-sm">
                                {item.title}
                              </div>
                              <div className="text-xs text-[var(--text-secondary)] truncate">
                                {item.artist} {item.track?.album ? `• ${item.track.album}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0 ml-3">
                            {/* Play count badge for today / this day */}
                            {item.playCountToday > 1 && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                {item.playCountToday} plays
                              </span>
                            )}

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.source === 'online'
                                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {item.source === 'online' ? 'Online' : 'Local'}
                            </span>

                            <div className="text-[11px] text-[var(--text-muted)] font-mono">
                              {new Date(item.lastPlayedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      {activeTab === 'online' && (
        <>
          {/* Controls: Search, Filters, Sort */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search history by title, artist, or video ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Filters & Sorting */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Filter */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs">
                {(['all', 'cached', 'online_only', 'favorites'] as FilterOption[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterBy(f)}
                    className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-colors ${
                      filterBy === f
                        ? 'bg-[var(--surface-secondary)] text-[var(--text-primary)] font-bold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {f === 'all' ? 'All' : f.replace('_', ' ')}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="recent">Recently Played</option>
                <option value="most_played">Most Played</option>
                <option value="cached">Largest Cache</option>
                <option value="oldest">Oldest</option>
                <option value="favorites">Favorites First</option>
              </select>
            </div>
          </div>

          {/* Timeline List */}
          {filteredAndSorted.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-2">
              <Globe className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No YouTube History Found</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Play a YouTube track in the Online page or cache audio for instant offline replay.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {(['Today', 'Yesterday', 'Earlier'] as const).map((groupName) => {
                const items = groupedTimeline[groupName];
                if (!items || items.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-2.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] px-1">
                      {groupName} ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <YouTubeHistoryCard
                          key={item.id}
                          item={item}
                          onPlayOffline={handlePlayOffline}
                          onPlayOnline={handlePlayOnline}
                          onCache={handleCache}
                          onDeleteHistory={handleDeleteHistory}
                          onDeleteCache={handleDeleteCache}
                          onToggleFavorite={handleToggleFavorite}
                          onViewDetails={(i) => setSelectedDetailsItem(i)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Details Modal */}
      {selectedDetailsItem && (
        <CacheDetailsModal
          item={selectedDetailsItem}
          onClose={() => setSelectedDetailsItem(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmationItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] p-6 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Remove from History</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Remove &quot;{deleteConfirmationItem.title}&quot; from listening history?
              {deleteConfirmationItem.cache_status === 'CACHED' &&
                ' This track also has cached audio on your disk.'}
            </p>

            <div className="flex flex-col gap-2 pt-2">
              {deleteConfirmationItem.cache_status === 'CACHED' ? (
                <>
                  <button
                    onClick={() => confirmDelete(true)}
                    className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/30 transition-colors"
                  >
                    Delete Both (History & Cached Audio)
                  </button>
                  <button
                    onClick={() => confirmDelete(false)}
                    className="w-full py-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border)] text-xs font-semibold hover:bg-[var(--surface-hover)] transition-colors"
                  >
                    Keep Cached Audio (Remove History Only)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => confirmDelete(false)}
                  className="w-full py-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold hover:bg-rose-500/30 transition-colors"
                >
                  Remove from History
                </button>
              )}

              <button
                onClick={() => setDeleteConfirmationItem(null)}
                className="w-full py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

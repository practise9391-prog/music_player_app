import React, { useEffect, useState, useMemo } from 'react';
import { YouTubeHistoryRecord, PlayHistoryRecord } from '../types';
import { YouTubeHistoryRepository, PlayHistoryRepository } from '../database/repository';
import { CacheManager } from '../services/youtube/CacheManager';
import { usePlayer } from '../player/PlayerContext';
import { notificationService } from '../services/errorService';
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
} from 'lucide-react';

type SortOption = 'recent' | 'most_played' | 'oldest' | 'cached' | 'favorites';
type FilterOption = 'all' | 'cached' | 'online_only' | 'favorites';

export const HistoryPage: React.FC = () => {
  const { playCachedYouTubeTrack, playYouTubeUrl } = usePlayer();

  const [activeTab, setActiveTab] = useState<'youtube' | 'local'>('youtube');
  const [youtubeHistory, setYoutubeHistory] = useState<YouTubeHistoryRecord[]>([]);
  const [playHistory, setPlayHistory] = useState<PlayHistoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [selectedDetailsItem, setSelectedDetailsItem] = useState<YouTubeHistoryRecord | null>(null);
  const [deleteConfirmationItem, setDeleteConfirmationItem] = useState<YouTubeHistoryRecord | null>(null);

  const loadData = async () => {
    const yt = await YouTubeHistoryRepository.getAll();
    const local = await PlayHistoryRepository.getRecent(100);
    setYoutubeHistory(yt);
    setPlayHistory(local);
  };

  useEffect(() => {
    loadData();
  }, []);

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
      await playYouTubeUrl(item.youtube_url);
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

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Listening History</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Locally stored play logs, YouTube history, and offline cached audio.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border)]">
          <button
            onClick={() => setActiveTab('youtube')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'youtube'
                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>YouTube History ({youtubeHistory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 ${
              activeTab === 'local'
                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <HistoryIcon className="w-3.5 h-3.5" />
            <span>Local Play History ({playHistory.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'youtube' && (
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

      {/* Local Play History Tab */}
      {activeTab === 'local' && (
        <div className="space-y-2">
          {playHistory.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
              No playback history recorded yet.
            </div>
          ) : (
            playHistory.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs"
              >
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{item.title}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">{item.artist}</div>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono">
                  {new Date(item.playedAt).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
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

import React, { useState, useEffect } from 'react';
import { ListeningInsightsData } from '../../types/homeDashboard';
import { musicDiscoveryService } from '../../services/discovery/MusicDiscoveryService';
import { PlayHistoryRepository } from '../../database/repository';
import { Button } from '../ui/Button';
import {
  BarChart3,
  X,
  Clock,
  Music2,
  Users,
  Disc,
  Tag,
  Heart,
  ListMusic,
  CheckCircle2,
  Calendar,
  RotateCcw,
  AlertCircle,
  Play,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import { notificationService } from '../../services/errorService';

interface ListeningStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatListeningTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '0 mins';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);

  if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  }
  return `${mins} min${mins > 1 ? 's' : ''}`;
}

export const ListeningStatsModal: React.FC<ListeningStatsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { playTrack } = usePlayer();
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | 'all'>('30days');
  const [insights, setInsights] = useState<ListeningInsightsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const loadInsights = async (range = timeRange) => {
    setIsLoading(true);
    try {
      const data = await musicDiscoveryService.getListeningInsights(range);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load listening insights:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadInsights(timeRange);
    }
  }, [isOpen, timeRange]);

  if (!isOpen) return null;

  const handleResetHistory = async () => {
    try {
      await PlayHistoryRepository.clear();
      setShowResetConfirm(false);
      await loadInsights(timeRange);
      notificationService.success(
        'History Reset',
        'Listening history and play statistics have been cleared.'
      );
    } catch (err) {
      console.error('Failed to clear listening history:', err);
      notificationService.error('Reset Failed', 'Could not clear history.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--accent)] border border-[var(--border)]">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Listening Statistics &amp; Insights
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Offline listening metrics and collection analytics computed locally
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Time Range Selector */}
        <div className="px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)]/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[var(--accent)] mr-1" />
            {(['today', '7days', '30days', 'all'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  timeRange === range
                    ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                }`}
              >
                {range === '7days' ? 'Last 7 Days' : range === '30days' ? 'Last 30 Days' : range}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 underline transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset Listening Stats
          </button>
        </div>

        {/* Reset Confirmation Banner */}
        {showResetConfirm && (
          <div className="p-4 bg-rose-950/40 border-b border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Are you sure? This permanently resets your playback history and stats.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleResetHistory}
              >
                Confirm Reset
              </Button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              Computing local listening statistics...
            </div>
          ) : insights ? (
            <>
              {/* Primary Metrics Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Listening Time */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-4 h-4 text-[var(--accent)]" /> Listening Time
                    </span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-secondary)]">
                      {timeRange}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-[var(--text-primary)]">
                    {formatListeningTime(insights.totalListeningSeconds)}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {insights.completedSessionsCount} listening sessions logged
                  </p>
                </div>

                {/* Top Artist */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Users className="w-4 h-4 text-purple-400" /> Top Artist
                    </span>
                  </div>
                  <div className="text-lg font-bold text-[var(--text-primary)] truncate">
                    {insights.topArtist ? insights.topArtist.name : 'No listens recorded'}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {insights.topArtist
                      ? `${insights.topArtist.playCount} plays • ${insights.topArtist.songCount} library tracks`
                      : 'Play music to discover top artists'}
                  </p>
                </div>

                {/* Top Genre */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Tag className="w-4 h-4 text-emerald-400" /> Top Genre
                    </span>
                  </div>
                  <div className="text-lg font-bold text-[var(--text-primary)] truncate">
                    {insights.topGenre ? insights.topGenre.name : 'Uncategorized'}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {insights.topGenre
                      ? `${insights.topGenre.playCount} plays in period`
                      : 'Genres will appear as music is played'}
                  </p>
                </div>
              </div>

              {/* Top Song & Top Album Feature Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Top Song */}
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-[var(--accent)]" /> Most-Played Song
                  </h4>
                  {insights.topSong ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
                        {insights.topSong.coverArtUrl ? (
                          <img
                            src={insights.topSong.coverArtUrl}
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc className="w-7 h-7 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {insights.topSong.title}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">
                          {insights.topSong.artist}
                        </div>
                        <div className="text-[10px] text-[var(--accent)] font-mono mt-0.5">
                          {insights.topSong.playCount || 1} total plays
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => playTrack(insights.topSong!)}
                        className="w-9 h-9 rounded-full btn-primary flex items-center justify-center shrink-0 shadow-md"
                        title="Play Song"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5 text-[var(--btn-text)]" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      No track playback recorded yet for this period.
                    </p>
                  )}
                </div>

                {/* Top Album */}
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                    <Disc className="w-4 h-4 text-[var(--accent)]" /> Most-Played Album
                  </h4>
                  {insights.topAlbum ? (
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-lg bg-[var(--surface)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
                        {insights.topAlbum.coverArtUrl ? (
                          <img
                            src={insights.topAlbum.coverArtUrl}
                            alt="Cover"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Disc className="w-7 h-7 text-[var(--text-muted)]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                          {insights.topAlbum.title}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] truncate">
                          {insights.topAlbum.artist}
                        </div>
                        <div className="text-[10px] text-[var(--accent)] font-mono mt-0.5">
                          {insights.topAlbum.playCount} album plays
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">
                      No album plays recorded yet for this period.
                    </p>
                  )}
                </div>
              </div>

              {/* Total Local Library Overview */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Local Music Library Overview
                  </h4>
                  <span className="text-[10px] font-mono text-[var(--text-muted)]">
                    Physical Collection
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-0.5">
                    <Music2 className="w-4 h-4 text-[var(--accent)] mx-auto mb-1" />
                    <div className="text-base font-black text-[var(--text-primary)]">
                      {insights.librarySummary.totalSongs}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Songs</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-0.5">
                    <Disc className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                    <div className="text-base font-black text-[var(--text-primary)]">
                      {insights.librarySummary.totalAlbums}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Albums</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-0.5">
                    <Users className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                    <div className="text-base font-black text-[var(--text-primary)]">
                      {insights.librarySummary.totalArtists}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Artists</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-0.5">
                    <Tag className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                    <div className="text-base font-black text-[var(--text-primary)]">
                      {insights.librarySummary.totalGenres}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Genres</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-0.5">
                    <ListMusic className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                    <div className="text-base font-black text-[var(--text-primary)]">
                      {insights.librarySummary.totalPlaylists}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Playlists</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-0.5">
                    <Heart className="w-4 h-4 text-rose-400 mx-auto mb-1" />
                    <div className="text-base font-black text-[var(--text-primary)]">
                      {insights.librarySummary.totalFavorites}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)]">Favorites</div>
                  </div>
                </div>
              </div>

              {/* Data Qualification Notice */}
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-[11px] text-[var(--text-muted)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <p>
                  <strong>Private &amp; Offline:</strong> All analytics and listening history are
                  stored locally on your device. Listening time is computed from playback sessions
                  and historical playback events.
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface)]">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};


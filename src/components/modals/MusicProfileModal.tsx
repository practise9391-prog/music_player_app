import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Clock,
  PlayCircle,
  CheckCircle,
  SkipForward,
  Flame,
  Award,
  Sparkles,
  ShieldCheck,
  Disc,
  Music,
} from 'lucide-react';
import {
  ListeningStatsService,
  ListeningProfileStats,
  StatsTimeframe,
} from '../../services/statistics/ListeningStatsService';

interface MusicProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatListeningTime(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds <= 0) return '0 mins';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export const MusicProfileModal: React.FC<MusicProfileModalProps> = ({ isOpen, onClose }) => {
  const [timeframe, setTimeframe] = useState<StatsTimeframe>('week');
  const [stats, setStats] = useState<ListeningProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    ListeningStatsService.getStats(timeframe)
      .then((data) => setStats(data))
      .finally(() => setIsLoading(false));
  }, [isOpen, timeframe]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-3xl rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">My Music Profile</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Local listening trends, top artists, and listening analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe Pills */}
            <div className="flex items-center bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)]">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'week', label: 'This Week' },
                  { id: 'month', label: 'This Month' },
                  { id: 'all', label: 'All Time' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTimeframe(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    timeframe === tab.id
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)] transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)]">
              Calculating personal analytics...
            </div>
          ) : stats ? (
            <>
              {/* Highlight Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center gap-1.5 text-[var(--accent)] text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" /> Total Time
                  </div>
                  <div className="text-xl font-extrabold text-[var(--text-primary)]">
                    {formatListeningTime(stats.totalListeningTimeSec)}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Time spent enjoying music</p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                    <PlayCircle className="w-3.5 h-3.5" /> Total Plays
                  </div>
                  <div className="text-xl font-extrabold text-[var(--text-primary)]">
                    {stats.totalPlays}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {stats.completionRatePercent}% completion rate
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-semibold">
                    <Award className="w-3.5 h-3.5" /> Top Rated
                  </div>
                  <div className="text-xl font-extrabold text-[var(--text-primary)]">
                    {stats.topRatedCount}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Rated 4 stars or higher</p>
                </div>

                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1">
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs font-semibold">
                    <Flame className="w-3.5 h-3.5" /> Favorites
                  </div>
                  <div className="text-xl font-extrabold text-[var(--text-primary)]">
                    {stats.favoriteTracksCount}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">Saved in favorites</p>
                </div>
              </div>

              {/* Two Column Grid: Top Tracks & Top Artists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Top Tracks */}
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[var(--accent)]" /> Top Songs
                  </h3>

                  {stats.topTracks.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                      No tracks played in this timeframe yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topTracks.slice(0, 5).map((track, idx) => (
                        <div
                          key={track.trackId}
                          className="flex items-center gap-3 p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs"
                        >
                          <span className="font-mono text-[var(--accent)] font-bold w-4 text-center">
                            {idx + 1}
                          </span>
                          <div className="w-8 h-8 rounded bg-[var(--surface-secondary)] overflow-hidden shrink-0 flex items-center justify-center">
                            {track.coverArtUrl ? (
                              <img
                                src={track.coverArtUrl}
                                alt={track.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Music className="w-4 h-4 text-[var(--text-muted)]" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--text-primary)] truncate">
                              {track.title}
                            </p>
                            <p className="text-[10px] text-[var(--text-muted)] truncate">
                              {track.artist}
                            </p>
                          </div>
                          <div className="text-right shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                            {track.playCount} plays
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Artists & Genres */}
                <div className="space-y-4">
                  {/* Top Artists */}
                  <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                      <Disc className="w-4 h-4 text-[var(--accent)]" /> Top Artists
                    </h3>

                    {stats.topArtists.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                        No artist activity recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {stats.topArtists.slice(0, 4).map((art, idx) => (
                          <div
                            key={art.artist}
                            className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <span className="font-mono text-[var(--accent)] font-bold w-4 text-center">
                                {idx + 1}
                              </span>
                              <span className="font-semibold text-[var(--text-primary)] truncate">
                                {art.artist}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-[var(--text-muted)] shrink-0">
                              {art.playCount} plays
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Genres */}
                  {stats.topGenres.length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Favorite Genres
                      </h4>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {stats.topGenres.slice(0, 6).map((g) => (
                          <span
                            key={g.genre}
                            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border)]"
                          >
                            {g.genre} • {g.playCount}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Privacy Guarantee Note */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-300">
                <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
                <p>
                  <strong>Private &amp; Offline:</strong> All listening metrics are analyzed locally from your machine. No accounts, cookies, or telemetry are ever communicated across the network.
                </p>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

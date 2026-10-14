import React, { useState, useEffect } from 'react';
import { LibraryStatistics } from '../../types';
import { TrackRepository } from '../../database/repository';
import {
  BarChart2,
  X,
  Music2,
  Disc,
  Users,
  Tag,
  Clock,
  HardDrive,
  Heart,
  Star,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';

interface LibraryStatisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx++;
  }
  return `${size.toFixed(2)} ${units[idx]}`;
}

function formatHours(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export const LibraryStatisticsModal: React.FC<LibraryStatisticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [stats, setStats] = useState<LibraryStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      TrackRepository.getLibraryStatistics()
        .then((res) => setStats(res))
        .catch((err) => console.error('Failed to load library statistics:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <BarChart2 className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Library Statistics &amp; Audio Analytics
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              100% OFFLINE
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {isLoading || !stats ? (
            <div className="py-16 text-center text-[var(--text-muted)]">
              Computing library statistics...
            </div>
          ) : (
            <>
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="text-[10px] uppercase font-bold">Songs</span>
                    <Music2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <p className="text-lg font-black text-[var(--text-primary)]">{stats.totalSongs}</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="text-[10px] uppercase font-bold">Albums</span>
                    <Disc className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <p className="text-lg font-black text-[var(--text-primary)]">{stats.totalAlbums}</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="text-[10px] uppercase font-bold">Artists</span>
                    <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <p className="text-lg font-black text-[var(--text-primary)]">{stats.totalArtists}</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="text-[10px] uppercase font-bold">Genres</span>
                    <Tag className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <p className="text-lg font-black text-[var(--text-primary)]">{stats.totalGenres}</p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="text-[10px] uppercase font-bold">Playtime</span>
                    <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <p className="text-sm font-black text-[var(--text-primary)] truncate mt-1">
                    {formatHours(stats.totalDuration)}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="flex items-center justify-between text-[var(--text-muted)]">
                    <span className="text-[10px] uppercase font-bold">Storage</span>
                    <HardDrive className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <p className="text-sm font-black text-[var(--text-primary)] truncate mt-1">
                    {formatBytes(stats.totalStorageBytes)}
                  </p>
                </div>
              </div>

              {/* Highlights Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Most Played Song */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)]">
                    <Award className="w-4 h-4" />
                    <span>Most Played Song</span>
                  </div>
                  {stats.mostPlayedSong ? (
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)] truncate text-sm">
                        {stats.mostPlayedSong.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)] truncate">
                        {stats.mostPlayedSong.artist}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">
                        {stats.mostPlayedSong.playCount} plays
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">No playback data yet</p>
                  )}
                </div>

                {/* Most Played Artist */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent)]">
                    <Users className="w-4 h-4" />
                    <span>Top Artist</span>
                  </div>
                  {stats.mostPlayedArtist ? (
                    <div>
                      <h4 className="font-bold text-[var(--text-primary)] truncate text-sm">
                        {stats.mostPlayedArtist.artist}
                      </h4>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono mt-2">
                        {stats.mostPlayedArtist.playCount} total plays
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[var(--text-muted)]">No playback data yet</p>
                  )}
                </div>

                {/* Favorite & Ratings */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <Star className="w-4 h-4 fill-current" />
                    <span>Ratings &amp; Favorites</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-[var(--text-primary)] flex justify-between">
                      <span>Favorites:</span>
                      <strong>{stats.favoriteSongsCount} songs</strong>
                    </p>
                    <p className="text-xs text-[var(--text-primary)] flex justify-between">
                      <span>Rated Songs:</span>
                      <strong>{stats.ratedSongsCount} songs</strong>
                    </p>
                    <p className="text-xs text-[var(--text-primary)] flex justify-between">
                      <span>Avg Rating:</span>
                      <strong>★ {stats.averageRating} / 5</strong>
                    </p>
                  </div>
                </div>
              </div>

              {/* Audio Quality & Format Distribution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Formats */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    Audio Format Breakdown
                  </span>
                  <div className="space-y-1.5">
                    {Object.entries(stats.formatCounts).map(([fmt, count]) => {
                      const pct = Math.round((count / (stats.totalSongs || 1)) * 100);
                      return (
                        <div key={fmt} className="space-y-0.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="uppercase font-semibold text-[var(--text-secondary)]">
                              {fmt}
                            </span>
                            <span className="font-mono text-[var(--text-muted)]">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--accent)] rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bitrate Distribution */}
                <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    Bitrate Quality Distribution
                  </span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--surface-secondary)]">
                      <span>Lossless / Hi-Res (FLAC, WAV)</span>
                      <strong className="text-emerald-400 font-mono">
                        {stats.bitrateDistribution.lossless}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--surface-secondary)]">
                      <span>High Bitrate (256 – 320 kbps)</span>
                      <strong className="text-[var(--accent)] font-mono">
                        {stats.bitrateDistribution.high256to320}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--surface-secondary)]">
                      <span>Standard Bitrate (128 – 256 kbps)</span>
                      <strong className="text-[var(--text-secondary)] font-mono">
                        {stats.bitrateDistribution.standard128to256}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-lg bg-[var(--surface-secondary)]">
                      <span>Low Bitrate (&lt; 128 kbps)</span>
                      <strong className="text-[var(--text-muted)] font-mono">
                        {stats.bitrateDistribution.under128}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

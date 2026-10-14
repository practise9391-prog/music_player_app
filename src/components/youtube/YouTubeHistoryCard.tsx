import React, { useState } from 'react';
import { YouTubeHistoryRecord } from '../../types';
import {
  Play,
  Download,
  Trash2,
  Heart,
  Globe,
  HardDrive,
  Clock,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Share2,
} from 'lucide-react';

interface YouTubeHistoryCardProps {
  item: YouTubeHistoryRecord;
  onPlayOffline: (item: YouTubeHistoryRecord) => void;
  onPlayOnline: (item: YouTubeHistoryRecord) => void;
  onCache: (item: YouTubeHistoryRecord) => void;
  onDeleteHistory: (item: YouTubeHistoryRecord) => void;
  onDeleteCache: (item: YouTubeHistoryRecord) => void;
  onToggleFavorite: (item: YouTubeHistoryRecord) => void;
  onViewDetails: (item: YouTubeHistoryRecord) => void;
}

export const YouTubeHistoryCard: React.FC<YouTubeHistoryCardProps> = ({
  item,
  onPlayOffline,
  onPlayOnline,
  onCache,
  onDeleteHistory,
  onDeleteCache,
  onToggleFavorite,
  onViewDetails,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isCached = item.cache_status === 'CACHED' && Boolean(item.cache_path);
  const isCaching = item.cache_status === 'CACHING';
  const isCorrupted = item.cache_status === 'CORRUPTED';
  const isMissing = item.cache_status === 'MISSING';

  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-colors group">
      {/* Left: Thumbnail & Info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="relative w-12 h-12 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] overflow-hidden shrink-0 flex items-center justify-center">
          {item.thumbnail_local_path || item.thumbnail_url ? (
            <img
              src={item.thumbnail_local_path || item.thumbnail_url}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <Globe className="w-5 h-5 text-[var(--text-muted)]" />
          )}

          {/* Quick play overlay */}
          <button
            onClick={() => (isCached ? onPlayOffline(item) : onPlayOnline(item))}
            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title={isCached ? 'Play Offline' : 'Play Online'}
          >
            <Play className="w-5 h-5 text-white fill-current" />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[280px] sm:max-w-[420px]">
              {item.title}
            </h4>
            {item.is_favorite && (
              <Heart className="w-3 h-3 text-rose-500 fill-current shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--text-muted)]">
            <span className="truncate max-w-[160px]">{item.artist || item.channel || 'YouTube'}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {formatDuration(item.duration)}
            </span>
            <span>•</span>
            <span>{item.play_count} plays</span>
          </div>
        </div>
      </div>

      {/* Center: Cache Status Badges */}
      <div className="hidden sm:flex items-center gap-2 px-4 shrink-0">
        {isCached && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            <span>Cached ({formatBytes(item.cache_size)})</span>
          </span>
        )}

        {isCaching && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Caching...</span>
          </span>
        )}

        {isMissing && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Cache Missing</span>
          </span>
        )}

        {isCorrupted && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3" />
            <span>Cache Corrupt</span>
          </span>
        )}

        {!isCached && !isCaching && !isMissing && !isCorrupted && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <Globe className="w-3 h-3" />
            <span>Online Only</span>
          </span>
        )}
      </div>

      {/* Right: Primary Actions & Context Menu */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isCached ? (
          <button
            onClick={() => onPlayOffline(item)}
            className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Play cached audio completely offline"
          >
            <Play className="w-3 h-3 fill-current" />
            <span className="hidden md:inline">Play Offline</span>
          </button>
        ) : (
          <button
            onClick={() => onPlayOnline(item)}
            className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors"
            title="Explicitly start an online streaming session"
          >
            <Globe className="w-3 h-3 text-[var(--accent)]" />
            <span className="hidden md:inline">Play Online</span>
          </button>
        )}

        {/* Favorite Button */}
        <button
          onClick={() => onToggleFavorite(item)}
          className={`p-2 rounded-lg hover:bg-[var(--surface-secondary)] transition-colors ${
            item.is_favorite ? 'text-rose-500' : 'text-[var(--text-muted)]'
          }`}
          title={item.is_favorite ? 'Remove Favorite' : 'Mark Favorite'}
        >
          <Heart className={`w-3.5 h-3.5 ${item.is_favorite ? 'fill-current' : ''}`} />
        </button>

        {/* Three dots / Context Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl py-1.5 z-50 text-xs">
                {isCached ? (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onPlayOffline(item);
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Play Offline</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onPlayOnline(item);
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2"
                  >
                    <Globe className="w-3.5 h-3.5 text-[var(--accent)]" />
                    <span>Play Online</span>
                  </button>
                )}

                {!isCached && !isCaching && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onCache(item);
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Cache Audio</span>
                  </button>
                )}

                {isCached && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDeleteCache(item);
                    }}
                    className="w-full px-3.5 py-1.5 text-left text-amber-400 hover:bg-[var(--surface-hover)] flex items-center gap-2"
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Delete Cached Audio</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onViewDetails(item);
                  }}
                  className="w-full px-3.5 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                <div className="my-1 border-t border-[var(--border)]" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDeleteHistory(item);
                  }}
                  className="w-full px-3.5 py-1.5 text-left text-rose-400 hover:bg-[var(--surface-hover)] flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove from History</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

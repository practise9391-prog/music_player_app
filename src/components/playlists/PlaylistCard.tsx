import React from 'react';
import { PlaylistRecord } from '../../types';
import {
  ListMusic,
  Play,
  Shuffle,
  Sparkles,
  Heart,
  MoreVertical,
  Clock,
  Music,
  Edit2,
  Trash2,
  Copy,
} from 'lucide-react';

interface PlaylistCardProps {
  playlist: PlaylistRecord;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
  onShuffle: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onDuplicate: (e: React.MouseEvent) => void;
}

export const PlaylistCard: React.FC<PlaylistCardProps> = ({
  playlist,
  onClick,
  onPlay,
  onShuffle,
  onToggleFavorite,
  onDelete,
  onDuplicate,
}) => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const formatDuration = (sec?: number) => {
    if (!sec) return '0 min';
    const m = Math.floor(sec / 60);
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}h ${m % 60}m`;
    }
    return `${m}m`;
  };

  const isSmart = playlist.type === 'smart';

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] transition-all cursor-pointer group flex flex-col justify-between space-y-3 relative overflow-hidden"
    >
      {/* Cover Art / Icon */}
      <div className="relative aspect-square w-full rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] overflow-hidden flex items-center justify-center">
        {playlist.coverArtUrl ? (
          <img src={playlist.coverArtUrl} alt={playlist.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-[var(--text-muted)]">
            {isSmart ? (
              <Sparkles className="w-8 h-8 text-[var(--accent)] animate-pulse" />
            ) : (
              <ListMusic className="w-8 h-8" />
            )}
          </div>
        )}

        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={onPlay}
            className="w-10 h-10 rounded-full bg-[var(--accent)] text-[var(--btn-text)] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
            title="Play Playlist"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
          <button
            onClick={onShuffle}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur flex items-center justify-center shadow transition-all"
            title="Shuffle Playlist"
          >
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        {/* Smart Badge */}
        {isSmart && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--accent)] text-[var(--btn-text)] shadow flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> SMART
          </span>
        )}

        {/* Favorite Heart */}
        <button
          onClick={onToggleFavorite}
          className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur transition-all ${
            playlist.isFavorite
              ? 'bg-black/60 text-rose-500'
              : 'bg-black/30 text-white/70 opacity-0 group-hover:opacity-100'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${playlist.isFavorite ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Info */}
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">
            {playlist.name}
          </h4>

          {/* Context Menu Button */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded text-[var(--text-muted)] hover:text-white transition-colors"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-1 w-40 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl py-1 z-50 text-xs">
                  <button
                    onClick={(e) => {
                      setMenuOpen(false);
                      onDuplicate(e);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[var(--text-primary)] hover:bg-[var(--surface-hover)] flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  <button
                    onClick={(e) => {
                      setMenuOpen(false);
                      onDelete(e);
                    }}
                    className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-[var(--surface-hover)] flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-secondary)]">
          <span>{playlist.songCount || 0} songs</span>
          <span>•</span>
          <span>{formatDuration(playlist.totalDuration)}</span>
        </div>
      </div>
    </div>
  );
};

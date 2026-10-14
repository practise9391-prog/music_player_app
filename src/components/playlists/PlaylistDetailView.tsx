import React, { useState } from 'react';
import { PlaylistRecord, Track } from '../../types';
import {
  Play,
  Shuffle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Search,
  ArrowLeft,
  Clock,
  Sparkles,
  Music,
  Heart,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import { StarRating } from '../common/StarRating';

interface PlaylistDetailViewProps {
  playlist: PlaylistRecord;
  tracks: Track[];
  onBack: () => void;
  onPlayAll: () => void;
  onShuffleAll: () => void;
  onPlayTrack: (track: Track) => void;
  onRemoveTrack: (trackId: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onAddTracksModal: () => void;
  onToggleFavoriteTrack: (trackId: string) => void;
  onEditRules?: () => void;
  onRateTrack?: (trackId: string, rating: number) => void;
}

export const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({
  playlist,
  tracks,
  onBack,
  onPlayAll,
  onShuffleAll,
  onPlayTrack,
  onRemoveTrack,
  onMoveUp,
  onMoveDown,
  onAddTracksModal,
  onToggleFavoriteTrack,
  onEditRules,
  onRateTrack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'position' | 'title' | 'artist' | 'duration'>('position');

  const formatDuration = (sec?: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredTracks = tracks.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
  });

  const sortedTracks = [...filteredTracks].sort((a, b) => {
    if (sortField === 'title') return a.title.localeCompare(b.title);
    if (sortField === 'artist') return a.artist.localeCompare(b.artist);
    if (sortField === 'duration') return (a.duration || 0) - (b.duration || 0);
    return 0; // custom position
  });

  const totalSeconds = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMins = Math.floor(totalSeconds / 60);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Playlists</span>
      </button>

      {/* Playlist Hero */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)]">
        <div className="w-36 h-36 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 overflow-hidden shadow-lg">
          {playlist.coverArtUrl ? (
            <img src={playlist.coverArtUrl} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <Music className="w-12 h-12 text-[var(--text-muted)]" />
          )}
        </div>

        <div className="flex-1 text-center sm:text-left space-y-2">
          <div className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--surface-secondary)] text-[var(--accent)] border border-[var(--border-subtle)]">
            {playlist.type} Playlist
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-xs text-[var(--text-secondary)] max-w-xl">{playlist.description}</p>
          )}

          <div className="flex items-center justify-center sm:justify-start gap-3 text-xs text-[var(--text-muted)] pt-1">
            <span>{tracks.length} tracks</span>
            <span>•</span>
            <span>{totalMins} minutes</span>
            <span>•</span>
            <span>Created {new Date(playlist.createdAt).toLocaleDateString()}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 pt-3">
            <button
              onClick={onPlayAll}
              disabled={tracks.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 shadow-md"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Play All</span>
            </button>

            <button
              onClick={onShuffleAll}
              disabled={tracks.length === 0}
              className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Shuffle</span>
            </button>

            {playlist.type === 'normal' && (
              <button
                onClick={onAddTracksModal}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--accent)] transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Songs</span>
              </button>
            )}

            {playlist.type === 'smart' && onEditRules && (
              <button
                onClick={onEditRules}
                className="px-4 py-2.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--accent)] transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Edit Rules</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Track List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Filter songs in playlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">Sort:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
            >
              <option value="position">Custom Order</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="duration">Duration</option>
            </select>
          </div>
        </div>

        {/* Tracks Table */}
        {sortedTracks.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
            No tracks in this playlist matching your search.
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {sortedTracks.map((track, idx) => {
              const isMissing = track.isAvailable === false;

              return (
                <div
                  key={track.id}
                  className="flex items-center justify-between p-3 hover:bg-[var(--surface-hover)] transition-colors group text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-6 text-center text-[var(--text-muted)] text-[11px] font-mono">
                      {idx + 1}
                    </span>

                    <button
                      onClick={() => onPlayTrack(track)}
                      className="w-8 h-8 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center text-[var(--text-primary)] hover:text-[var(--accent)] shrink-0 transition-colors"
                      title="Play Track"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-primary)] truncate max-w-[260px] sm:max-w-[360px]">
                          {track.title}
                        </span>
                        {isMissing && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-bold">
                            <AlertTriangle className="w-3 h-3" /> Unavailable
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] truncate">
                        {track.artist} {track.album ? `• ${track.album}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[var(--text-muted)] shrink-0">
                    <span className="font-mono text-[11px]">{formatDuration(track.duration)}</span>

                    {/* Reorder Buttons (Custom sort only) */}
                    {sortField === 'position' && playlist.type === 'normal' && (
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          disabled={idx === 0}
                          onClick={() => onMoveUp(idx)}
                          className="p-1 hover:text-white disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === sortedTracks.length - 1}
                          onClick={() => onMoveDown(idx)}
                          className="p-1 hover:text-white disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Rating */}
                    {onRateTrack && (
                      <div className="hidden sm:block">
                        <StarRating
                          rating={track.rating || 0}
                          onChange={(r) => onRateTrack(track.id, r)}
                          size="sm"
                        />
                      </div>
                    )}

                    {/* Favorite */}
                    <button
                      onClick={() => onToggleFavoriteTrack(track.id)}
                      className={`p-1.5 rounded hover:bg-[var(--surface-secondary)] ${
                        track.isFavorite ? 'text-rose-500' : 'text-[var(--text-muted)]'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-current' : ''}`} />
                    </button>

                    {/* Remove from Playlist */}
                    {playlist.type === 'normal' && (
                      <button
                        onClick={() => onRemoveTrack(track.id)}
                        className="p-1.5 rounded hover:bg-[var(--surface-secondary)] hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove from playlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

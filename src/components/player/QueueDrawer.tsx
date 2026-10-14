import React, { useState } from 'react';
import { usePlayer } from '../../player/PlayerContext';
import {
  X,
  Trash2,
  Play,
  Volume2,
  ChevronUp,
  ChevronDown,
  Music,
  ListMusic,
  BookmarkPlus,
  Heart,
  ListPlus,
  GripVertical,
  History,
  RotateCcw,
} from 'lucide-react';
import { Track } from '../../types';
import { StarRating } from '../common/StarRating';

function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    queueIndex,
    currentTrack,
    state,
    isQueueOpen,
    setIsQueueOpen,
    playTrack,
    playNext,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    saveQueueAsPlaylist,
    toggleFavorite,
    setTrackRating,
  } = usePlayer();

  const [isSavingPlaylist, setIsSavingPlaylist] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  if (!isQueueOpen) return null;

  const totalQueueDuration = queue.reduce((acc, t) => acc + (t.duration || 0), 0);
  const pastTracks = queueIndex > 0 ? queue.slice(0, queueIndex) : [];
  const upcomingTracks = queueIndex >= 0 ? queue.slice(queueIndex + 1) : queue;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    const sourceIndex = draggedIdx;
    setDraggedIdx(null);
    if (sourceIndex !== null && sourceIndex !== targetIndex) {
      reorderQueue(sourceIndex, targetIndex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      {/* Click outside to close */}
      <div
        className="flex-1 cursor-pointer"
        onClick={() => setIsQueueOpen(false)}
        aria-label="Close Queue"
      />

      {/* Drawer content */}
      <div className="w-full max-w-md h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 px-6 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ListMusic className="w-5 h-5 text-[var(--accent)]" />
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Playback Queue</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
                {totalQueueDuration > 0 && ` • ${formatDuration(totalQueueDuration)} total`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {queue.length > 0 && (
              <>
                <button
                  onClick={() => setIsSavingPlaylist(true)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-secondary)] transition-colors"
                  title="Save Queue as Playlist"
                >
                  <BookmarkPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => clearQueue(true)}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Clear Queue (keeps current track)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={() => setIsQueueOpen(false)}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
              title="Close Queue"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Queue Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* NOW PLAYING SECTION */}
          {currentTrack && (
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent)] block mb-2 px-1">
                Now Playing
              </span>
              <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--accent)]/30 flex items-center gap-3 shadow-md">
                <div className="w-12 h-12 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] shrink-0 overflow-hidden flex items-center justify-center">
                  {currentTrack.coverArtUrl ? (
                    <img
                      src={currentTrack.coverArtUrl}
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Music className="w-6 h-6 text-[var(--accent)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {currentTrack.title}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {currentTrack.artist}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--surface)] text-[var(--accent)] border border-[var(--border-subtle)]">
                      {currentTrack.format?.toUpperCase() || 'AUDIO'}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {formatDuration(state.currentTime)} / {formatDuration(state.duration)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleFavorite(currentTrack.id)}
                    className={`p-1.5 rounded hover:bg-[var(--surface)] transition-colors ${
                      currentTrack.isFavorite ? 'text-rose-500' : 'text-[var(--text-muted)]'
                    }`}
                    title="Toggle Favorite"
                  >
                    <Heart className={`w-4 h-4 ${currentTrack.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <div className="flex items-center text-[var(--accent)]">
                    {state.status === 'playing' ? (
                      <div className="flex items-end gap-0.5 h-4">
                        <span className="w-1 bg-[var(--accent)] h-full animate-pulse rounded-full" />
                        <span
                          className="w-1 bg-[var(--accent)] h-2/3 animate-pulse rounded-full"
                          style={{ animationDelay: '150ms' }}
                        />
                        <span
                          className="w-1 bg-[var(--accent)] h-4/5 animate-pulse rounded-full"
                          style={{ animationDelay: '300ms' }}
                        />
                      </div>
                    ) : (
                      <Volume2 className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QUEUE HISTORY ACCORDION (PREVIOUS TRACKS) */}
          {pastTracks.length > 0 && (
            <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface-secondary)]/30">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full p-2.5 px-3 flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>Previous in Queue ({pastTracks.length})</span>
                </div>
                {showHistory ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {showHistory && (
                <div className="p-2 pt-0 space-y-1">
                  {pastTracks.map((track, pIdx) => (
                    <div
                      key={`hist-${track.id}-${pIdx}`}
                      className="p-2 rounded-lg bg-[var(--surface-card)]/50 border border-[var(--border-subtle)] flex items-center justify-between text-xs opacity-75 hover:opacity-100 transition-opacity"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => playTrack(track, queue, pIdx)}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)]"
                          title="Replay"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <div className="truncate">
                          <p className="font-medium text-[var(--text-primary)] truncate">{track.title}</p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">{track.artist}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {formatDuration(track.duration || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* UP NEXT SECTION */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Up Next ({queue.length})
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                Drag handle to reorder
              </span>
            </div>

            {queue.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Music className="w-8 h-8 opacity-40" />
                <p className="text-sm font-medium">Queue is empty</p>
                <p className="text-xs">Add songs from your Library or Albums to play next.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {queue.map((track: Track, idx: number) => {
                  const isCurrent = idx === queueIndex;
                  const isDragOver = dragOverIdx === idx;

                  return (
                    <div
                      key={`${track.id}-${idx}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      className={`group p-2.5 rounded-xl border transition-all flex items-center gap-2.5 ${
                        isCurrent
                          ? 'bg-[var(--accent)]/10 border-[var(--accent)]/40 text-[var(--text-primary)] shadow-sm'
                          : isDragOver
                          ? 'bg-[var(--surface-hover)] border-[var(--accent)] scale-[1.01]'
                          : 'bg-[var(--surface-card)] border-[var(--border)] hover:border-[var(--accent)]/30 text-[var(--text-secondary)]'
                      }`}
                    >
                      {/* Drag Handle */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-white p-0.5"
                        title="Drag to reorder"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      {/* Play action or index */}
                      <button
                        onClick={() => playTrack(track, queue, idx)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors"
                        title="Play now"
                      >
                        {isCurrent ? (
                          <Volume2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                        ) : (
                          <>
                            <span className="text-xs font-mono group-hover:hidden">
                              {idx + 1}
                            </span>
                            <Play className="w-3 h-3 hidden group-hover:block fill-current" />
                          </>
                        )}
                      </button>

                      {/* Cover Thumbnail */}
                      <div className="w-8 h-8 rounded bg-[var(--surface-secondary)] shrink-0 overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                        {track.coverArtUrl ? (
                          <img
                            src={track.coverArtUrl}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        )}
                      </div>

                      {/* Track Details */}
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">
                          {track.artist}
                        </p>
                      </div>

                      {/* Interactive Rating */}
                      <div className="hidden sm:block opacity-0 group-hover:opacity-100 transition-opacity">
                        <StarRating
                          rating={track.rating || 0}
                          onChange={(r) => setTrackRating(track.id, r)}
                          size="sm"
                        />
                      </div>

                      {/* Duration */}
                      <span className="text-[11px] font-mono text-[var(--text-muted)] shrink-0">
                        {formatDuration(track.duration || 0)}
                      </span>

                      {/* Actions: Play Next, Move Up/Down, Favorite, Remove */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => playNext(track)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                          title="Play Next"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleFavorite(track.id)}
                          className={`p-1 rounded transition-colors ${
                            track.isFavorite
                              ? 'text-rose-500'
                              : 'text-[var(--text-muted)] hover:text-white'
                          }`}
                          title="Toggle Favorite"
                        >
                          <Heart
                            className={`w-3.5 h-3.5 ${track.isFavorite ? 'fill-current' : ''}`}
                          />
                        </button>
                        <button
                          disabled={idx === 0}
                          onClick={() => reorderQueue(idx, idx - 1)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-white disabled:opacity-20 transition-colors"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={idx === queue.length - 1}
                          onClick={() => reorderQueue(idx, idx + 1)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-white disabled:opacity-20 transition-colors"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFromQueue(idx)}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 transition-colors"
                          title="Remove from queue"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Save Queue as Playlist Modal */}
        {isSavingPlaylist && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-xs p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4 shadow-2xl">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Save Current Queue</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Save {queue.length} track(s) as a new playlist. Order will be preserved.
              </p>
              <input
                type="text"
                autoFocus
                placeholder="Playlist name..."
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsSavingPlaylist(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={!playlistName.trim()}
                  onClick={async () => {
                    await saveQueueAsPlaylist(playlistName.trim());
                    setIsSavingPlaylist(false);
                    setPlaylistName('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

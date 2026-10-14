// ──────────────────────────────────────────────────────────
// FolderDetailsModal — Part 11 (Section 8)
// Folder-based browser modal view with:
// - Folder name, path, track count, total size, total duration
// - Play all, Shuffle, Add to Playlist
// - Complete tracks list with playback and favorite controls
// ──────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { FolderNode, Track } from '../../types';
import { Button } from '../ui/Button';
import {
  Folder,
  Play,
  Shuffle,
  ListPlus,
  Heart,
  X,
  HardDrive,
  Clock,
  Music2,
  Pause,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';

interface FolderDetailsModalProps {
  folder: FolderNode | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlaylist?: (tracks: Track[]) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const FolderDetailsModal: React.FC<FolderDetailsModalProps> = ({
  folder,
  isOpen,
  onClose,
  onAddToPlaylist,
}) => {
  const {
    playTrack,
    currentTrack,
    state,
    togglePlayPause,
    toggleFavorite,
    shufflePlaylist,
  } = usePlayer();

  const { totalDuration, totalSize } = useMemo(() => {
    if (!folder) return { totalDuration: 0, totalSize: 0 };
    const dur = folder.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    const sz = folder.tracks.reduce((acc, t) => acc + (t.fileSize || 0), 0);
    return { totalDuration: dur, totalSize: sz };
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handlePlayAll = () => {
    if (folder.tracks.length > 0) {
      playTrack(folder.tracks[0], folder.tracks);
    }
  };

  const handleShuffle = () => {
    if (folder.tracks.length > 0) {
      shufflePlaylist(folder.tracks);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Banner */}
        <div className="p-6 bg-gradient-to-b from-[var(--surface-secondary)] to-[var(--surface-card)] flex flex-col sm:flex-row items-center gap-5 border-b border-[var(--border)]">
          <div className="w-20 h-20 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-lg flex items-center justify-center text-[var(--accent)] shrink-0">
            <Folder className="w-10 h-10" />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              LOCAL MUSIC FOLDER
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[var(--text-primary)] leading-tight truncate max-w-md">
              {folder.name}
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-mono truncate max-w-md">
              {folder.path}
            </p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-[var(--text-muted)] font-mono">
              <span>• {folder.trackCount} Songs</span>
              <span>• {formatBytes(totalSize)}</span>
              <span>• {formatDuration(totalDuration)}</span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Play className="w-4 h-4 fill-current ml-0.5" />}
                onClick={handlePlayAll}
              >
                Play All
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Shuffle className="w-4 h-4" />}
                onClick={handleShuffle}
              >
                Shuffle
              </Button>
              {onAddToPlaylist && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ListPlus className="w-4 h-4" />}
                  onClick={() => onAddToPlaylist(folder.tracks)}
                >
                  Add to Playlist
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tracks List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 divide-y divide-[var(--border-subtle)] scrollbar-thin scrollbar-thumb-[var(--border)] text-xs">
          {folder.tracks.map((track, idx) => {
            const isCurrent = currentTrack?.id === track.id;
            const isPlaying = isCurrent && state.status === 'playing';

            return (
              <div
                key={track.id}
                onClick={() => {
                  if (isCurrent) togglePlayPause();
                  else playTrack(track, folder.tracks);
                }}
                className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors group ${
                  isCurrent ? 'bg-[var(--surface-secondary)]/80 text-[var(--accent)] font-semibold' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="w-5 text-center font-mono text-[var(--text-muted)] text-[11px]">
                    {isCurrent ? (
                      isPlaying ? (
                        <Play className="w-3.5 h-3.5 fill-current text-[var(--accent)] inline" />
                      ) : (
                        <Pause className="w-3.5 h-3.5 text-[var(--accent)] inline" />
                      )
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
                      {track.isFavorite && (
                        <Heart className="w-3 h-3 text-rose-500 fill-current shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {track.artist} • {track.album || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id);
                    }}
                    className="p-1 hover:text-rose-500 transition-colors"
                  >
                    <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'text-rose-500 fill-current' : ''}`} />
                  </button>
                  <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border-subtle)]">
                    {track.format}
                  </span>
                  <span>{formatDuration(track.duration)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

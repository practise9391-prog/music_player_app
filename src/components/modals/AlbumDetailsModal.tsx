import React, { useState, useEffect } from 'react';
import { Album, Track } from '../../types';
import { Button } from '../ui/Button';
import { Play, Disc, Clock, X, Heart, Shuffle, ListPlus } from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import { EntityFavoriteRepository } from '../../database/repository';

interface AlbumDetailsModalProps {
  album: Album | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const AlbumDetailsModal: React.FC<AlbumDetailsModalProps> = ({
  album,
  isOpen,
  onClose,
}) => {
  const { playTrack, currentTrack, toggleFavorite, shufflePlaylist, addToQueue } = usePlayer();
  const [isAlbumFavorite, setIsAlbumFavorite] = useState(false);

  useEffect(() => {
    if (album) {
      EntityFavoriteRepository.isFavorite(album.id, 'album').then((fav) =>
        setIsAlbumFavorite(fav)
      );
    }
  }, [album]);

  if (!isOpen || !album) return null;

  const handleToggleAlbumFavorite = async () => {
    const next = await EntityFavoriteRepository.toggleFavorite({
      itemId: album.id,
      itemType: 'album',
      title: album.title,
      subtitle: album.artist,
      coverArtUrl: album.coverArtUrl,
    });
    setIsAlbumFavorite(next);
  };

  const handlePlayAlbum = () => {
    if (album.tracks.length > 0) {
      playTrack(album.tracks[0], album.tracks);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Top Header Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Section */}
        <div className="p-6 bg-gradient-to-b from-[var(--surface-secondary)] to-[var(--surface-card)] flex flex-col sm:flex-row items-center gap-6 border-b border-[var(--border)]">
          <div className="w-36 h-36 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-xl overflow-hidden shrink-0 flex items-center justify-center">
            {album.coverArtUrl ? (
              <img src={album.coverArtUrl} alt={album.title} className="w-full h-full object-cover" />
            ) : (
              <Disc className="w-16 h-16 text-[var(--accent)]" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              ALBUM
            </span>
            <h2 className="text-2xl font-black text-[var(--text-primary)] leading-tight">
              {album.title}
            </h2>
            <p className="text-sm font-semibold text-[var(--text-secondary)]">{album.artist}</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-[var(--text-muted)] font-mono">
              {album.year && <span>{album.year}</span>}
              {album.genre && <span>• {album.genre}</span>}
              <span>• {album.trackCount} Tracks</span>
              <span>• {formatDuration(album.duration)}</span>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <Button
                variant="primary"
                size="sm"
                icon={<Play className="w-4 h-4 fill-current ml-0.5" />}
                onClick={handlePlayAlbum}
              >
                Play Album
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Shuffle className="w-3.5 h-3.5" />}
                onClick={() => {
                  if (album.tracks.length > 0) {
                    shufflePlaylist(album.tracks);
                  }
                }}
              >
                Shuffle
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<ListPlus className="w-3.5 h-3.5" />}
                onClick={() => {
                  album.tracks.forEach((t) => addToQueue(t));
                }}
              >
                Queue All
              </Button>
              <button
                type="button"
                onClick={handleToggleAlbumFavorite}
                className={`p-2 rounded-xl border transition-colors ${
                  isAlbumFavorite
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-white'
                }`}
                title={isAlbumFavorite ? 'Favorited Album' : 'Favorite Album'}
              >
                <Heart className={`w-4 h-4 ${isAlbumFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tracklist Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--text-muted)] border-b border-[var(--border-subtle)] pb-2">
              <tr>
                <th className="p-2 w-10 text-center font-mono">#</th>
                <th className="p-2">Title</th>
                <th className="p-2 w-20 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {album.tracks.map((track, i) => {
                const isCurrent = currentTrack?.id === track.id;
                return (
                  <tr
                    key={track.id}
                    onClick={() => playTrack(track, album.tracks)}
                    className={`hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors ${
                      isCurrent ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)]'
                    }`}
                  >
                    <td className="p-2.5 text-center font-mono text-[var(--text-muted)]">
                      {track.trackNumber || i + 1}
                    </td>
                    <td className="p-2.5 font-medium text-[var(--text-primary)]">
                      <div className="truncate">{track.title}</div>
                      {track.artist !== album.artist && (
                        <div className="text-[10px] text-[var(--text-muted)]">{track.artist}</div>
                      )}
                    </td>
                    <td className="p-2.5 text-right font-mono text-[var(--text-muted)]">
                      {formatDuration(track.duration)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

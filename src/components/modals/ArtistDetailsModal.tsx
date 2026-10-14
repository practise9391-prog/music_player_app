// ──────────────────────────────────────────────────────────
// ArtistDetailsModal — Part 11 (Section 6)
// Complete Artist Page view with:
// - Popular Songs (most played)
// - Albums (grid/carousel)
// - All Songs list
// - Play all, Shuffle, Add to Playlist, Favorite
// - Currently playing indicator
// ──────────────────────────────────────────────────────────
import React, { useState, useEffect, useMemo } from 'react';
import { Artist, Album, Track } from '../../types';
import { Button } from '../ui/Button';
import {
  Users,
  Play,
  Shuffle,
  ListPlus,
  Heart,
  X,
  Disc,
  Clock,
  Sparkles,
  Flame,
  ChevronRight,
  Music2,
  Pause,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import { EntityFavoriteRepository, TrackRepository } from '../../database/repository';
import { StarRating } from '../common/StarRating';

interface ArtistDetailsModalProps {
  artist: Artist | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAlbum?: (album: Album) => void;
  onAddToPlaylist?: (tracks: Track[]) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const ArtistDetailsModal: React.FC<ArtistDetailsModalProps> = ({
  artist,
  isOpen,
  onClose,
  onSelectAlbum,
  onAddToPlaylist,
}) => {
  const {
    playTrack,
    currentTrack,
    state,
    togglePlayPause,
    toggleFavorite,
    shufflePlaylist,
    setTrackRating,
  } = usePlayer();

  const [isFavorite, setIsFavorite] = useState(false);
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);

  useEffect(() => {
    if (artist && isOpen) {
      EntityFavoriteRepository.isFavorite(artist.id || artist.name, 'artist').then(setIsFavorite);
      TrackRepository.getAlbums().then((albums) => {
        const artistAlbums = albums.filter(
          (a) => a.artist.toLowerCase() === artist.name.toLowerCase()
        );
        setAllAlbums(artistAlbums);
      });
    }
  }, [artist, isOpen]);

  // Sort popular songs (most played first)
  const popularSongs = useMemo(() => {
    if (!artist) return [];
    return [...artist.tracks]
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, 5);
  }, [artist]);

  if (!isOpen || !artist) return null;

  const handleToggleFavorite = async () => {
    const next = await EntityFavoriteRepository.toggleFavorite({
      itemId: artist.id || artist.name,
      itemType: 'artist',
      title: artist.name,
    });
    setIsFavorite(next);
  };

  const handlePlayAll = () => {
    if (artist.tracks.length > 0) {
      playTrack(artist.tracks[0], artist.tracks);
    }
  };

  const handleShuffle = () => {
    if (artist.tracks.length > 0) {
      shufflePlaylist(artist.tracks);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Top Header Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white bg-black/40 hover:bg-black/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero Section */}
        <div className="p-6 bg-gradient-to-b from-[var(--surface-secondary)] to-[var(--surface-card)] flex flex-col sm:flex-row items-center gap-6 border-b border-[var(--border)]">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-[var(--surface-card)] border-2 border-[var(--border)] shadow-xl overflow-hidden shrink-0 flex items-center justify-center text-[var(--accent)]">
            <Users className="w-16 h-16" />
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
              ARTIST PROFILE
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] leading-tight">
              {artist.name}
            </h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-[var(--text-muted)] font-mono">
              <span>• {artist.trackCount} Songs</span>
              <span>• {artist.albumCount} Albums</span>
              <span>• {formatDuration(artist.duration)} Total Duration</span>
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
                  onClick={() => onAddToPlaylist(artist.tracks)}
                >
                  Add to Playlist
                </Button>
              )}
              <Button
                variant={isFavorite ? 'primary' : 'ghost'}
                size="sm"
                icon={<Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />}
                onClick={handleToggleFavorite}
              >
                {isFavorite ? 'Favorited' : 'Favorite'}
              </Button>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-[var(--border)]">
          {/* Section 1: Popular Songs */}
          {popularSongs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" /> Popular Songs
              </h3>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] divide-y divide-[var(--border-subtle)] text-xs">
                {popularSongs.map((track, idx) => {
                  const isCurrent = currentTrack?.id === track.id;
                  const isPlaying = isCurrent && state.status === 'playing';

                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (isCurrent) togglePlayPause();
                        else playTrack(track, artist.tracks);
                      }}
                      className={`flex items-center justify-between p-3 hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors group ${
                        isCurrent ? 'bg-[var(--surface-secondary)]/80 text-[var(--accent)] font-semibold' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
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
                        <div className="w-8 h-8 rounded-lg bg-[var(--surface-card)] flex items-center justify-center shrink-0 overflow-hidden border border-[var(--border-subtle)]">
                          {track.coverArtUrl ? (
                            <img src={track.coverArtUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music2 className="w-4 h-4 text-[var(--text-muted)]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
                          <p className="text-[11px] text-[var(--text-secondary)] truncate">
                            {track.album || 'Unknown Album'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                        <span className="text-[10px] bg-[var(--surface-card)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                          {track.playCount || 0} plays
                        </span>
                        <span>{formatDuration(track.duration)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Albums */}
          {allAlbums.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Disc className="w-4 h-4 text-[var(--accent)]" /> Albums ({allAlbums.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allAlbums.map((album) => (
                  <div
                    key={album.id}
                    onClick={() => {
                      onSelectAlbum?.(album);
                      onClose();
                    }}
                    className="p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-secondary)] cursor-pointer transition-all border border-[var(--border-subtle)] hover:border-[var(--accent)] space-y-2 group shadow-sm"
                  >
                    <div className="aspect-square rounded-lg bg-[var(--surface-card)] relative overflow-hidden flex items-center justify-center border border-[var(--border-subtle)]">
                      {album.coverArtUrl ? (
                        <img src={album.coverArtUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Disc className="w-10 h-10 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">{album.title}</h4>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono">
                        {album.year ? `${album.year} • ` : ''}{album.trackCount} tracks
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: All Songs */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Music2 className="w-4 h-4 text-[var(--accent)]" /> All Songs ({artist.tracks.length})
            </h3>
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] divide-y divide-[var(--border-subtle)] text-xs">
              {artist.tracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isPlaying = isCurrent && state.status === 'playing';

                return (
                  <div
                    key={track.id}
                    onClick={() => {
                      if (isCurrent) togglePlayPause();
                      else playTrack(track, artist.tracks);
                    }}
                    className={`flex items-center justify-between p-3 hover:bg-[var(--surface-secondary)] cursor-pointer transition-colors group ${
                      isCurrent ? 'bg-[var(--surface-secondary)]/80 text-[var(--accent)] font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
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
                          {track.album || 'Unknown Album'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 font-mono text-[11px] text-[var(--text-muted)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(track.id);
                        }}
                        className="text-[var(--text-muted)] hover:text-rose-500 transition-colors"
                        title="Toggle favorite"
                      >
                        <Heart className={`w-3.5 h-3.5 ${track.isFavorite ? 'text-rose-500 fill-current' : ''}`} />
                      </button>
                      <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)]">
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
      </div>
    </div>
  );
};

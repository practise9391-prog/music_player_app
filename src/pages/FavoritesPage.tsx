import React, { useEffect, useState } from 'react';
import { Track, Album, Artist, EntityFavoriteRecord } from '../types';
import { TrackRepository, EntityFavoriteRepository } from '../database/repository';
import { usePlayer } from '../player/PlayerContext';
import { Heart, Play, Music, Disc, User, Sparkles, Search } from 'lucide-react';

export const FavoritesPage: React.FC = () => {
  const { playTrack, playPlaylist, toggleFavorite } = usePlayer();

  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'artists'>('tracks');
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [favoriteAlbums, setFavoriteAlbums] = useState<EntityFavoriteRecord[]>([]);
  const [favoriteArtists, setFavoriteArtists] = useState<EntityFavoriteRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const tracks = await TrackRepository.getFavorites();
    const albums = await EntityFavoriteRepository.getByType('album');
    const artists = await EntityFavoriteRepository.getByType('artist');
    setFavoriteTracks(tracks);
    setFavoriteAlbums(albums);
    setFavoriteArtists(artists);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleEntityFavorite = async (item: EntityFavoriteRecord) => {
    await EntityFavoriteRepository.toggleFavorite({
      itemId: item.itemId,
      itemType: item.itemType,
      title: item.title,
    });
    loadData();
  };

  const filteredTracks = favoriteTracks.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const filteredAlbums = favoriteAlbums.filter((a) =>
    a.title.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    (a.subtitle && a.subtitle.toLowerCase().includes(searchQuery.toLowerCase().trim()))
  );

  const filteredArtists = favoriteArtists.filter((art) =>
    art.title.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Favorite Music</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Quick access to starred tracks, favorite albums, and top artists.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-card)] border border-[var(--border)]">
          <button
            onClick={() => setActiveTab('tracks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'tracks'
                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>Songs ({favoriteTracks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('albums')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'albums'
                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Albums ({favoriteAlbums.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('artists')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'artists'
                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Artists ({favoriteArtists.length})</span>
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search favorites..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>

      {/* Tracks Tab */}
      {activeTab === 'tracks' && (
        <>
          {filteredTracks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
              <Heart className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-40" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No Favorite Songs Found</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Click the heart icon on any playing track or library item to add it here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => playTrack(track, filteredTracks)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--accent)] cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4 text-[var(--accent)]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--text-primary)] truncate">{track.title}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate">{track.artist}</div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id);
                      setFavoriteTracks((prev) => prev.filter((f) => f.id !== track.id));
                    }}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-400"
                    title="Remove from favorites"
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Albums Tab */}
      {activeTab === 'albums' && (
        <>
          {filteredAlbums.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
              <Disc className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-40" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No Favorite Albums</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Star albums from your Library to quickly find them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredAlbums.map((alb) => (
                <div
                  key={alb.id}
                  className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-2 relative group"
                >
                  <div className="aspect-square w-full rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden">
                    {alb.coverArtUrl ? (
                      <img src={alb.coverArtUrl} alt={alb.title} className="w-full h-full object-cover" />
                    ) : (
                      <Disc className="w-8 h-8 text-[var(--text-muted)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text-primary)] truncate">{alb.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">{alb.subtitle}</div>
                  </div>
                  <button
                    onClick={() => handleToggleEntityFavorite(alb)}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-rose-500"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Artists Tab */}
      {activeTab === 'artists' && (
        <>
          {filteredArtists.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
              <User className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-40" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No Favorite Artists</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Star artists from your Library to follow their releases and tracks.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredArtists.map((art) => (
                <div
                  key={art.id}
                  className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] text-center space-y-2 relative group"
                >
                  <div className="w-20 h-20 mx-auto rounded-full bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden">
                    <User className="w-8 h-8 text-[var(--text-muted)]" />
                  </div>
                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">{art.title}</div>
                  <button
                    onClick={() => handleToggleEntityFavorite(art)}
                    className="absolute top-4 right-4 p-1.5 rounded-full bg-black/60 text-rose-500"
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

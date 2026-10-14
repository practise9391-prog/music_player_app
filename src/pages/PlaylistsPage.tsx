import React, { useEffect, useState } from 'react';
import { PlaylistRecord, Track, SmartPlaylistDefinition } from '../types';
import {
  PlaylistRepository,
  PlaylistTrackRepository,
  TrackRepository,
  PlayHistoryRepository,
  YouTubeHistoryRepository,
} from '../database/repository';
import { SmartPlaylistEngine } from '../services/playlists/SmartPlaylistEngine';
import { usePlayer } from '../player/PlayerContext';
import { notificationService } from '../services/errorService';
import { PlaylistCard } from '../components/playlists/PlaylistCard';
import { PlaylistDetailView } from '../components/playlists/PlaylistDetailView';
import { SmartPlaylistModal } from '../components/playlists/SmartPlaylistModal';
import { PlaylistImportExportModal } from '../components/playlists/PlaylistImportExportModal';
import {
  ListMusic,
  Plus,
  Sparkles,
  Search,
  FolderPlus,
  Shuffle,
  Play,
  Filter,
  FileText,
} from 'lucide-react';

export interface PlaylistsPageProps {
  initialPlaylistId?: string | null;
  onClearInitialId?: () => void;
}

export const PlaylistsPage: React.FC<PlaylistsPageProps> = ({
  initialPlaylistId,
  onClearInitialId,
}) => {
  const { playPlaylist, shufflePlaylist, playTrack, toggleFavorite, setTrackRating } = usePlayer();

  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistRecord | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isSmartModalOpen, setIsSmartModalOpen] = useState(false);
  const [editingSmartPlaylist, setEditingSmartPlaylist] = useState<PlaylistRecord | null>(null);
  const [isCreatingNormal, setIsCreatingNormal] = useState(false);
  const [normalName, setNormalName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImportExportOpen, setIsImportExportOpen] = useState(false);

  // Load all playlists (and ensure default automated smart collections exist)
  const loadPlaylists = async () => {
    let list = await PlaylistRepository.getAll();

    // Auto-create standard smart collections if empty
    if (list.length === 0) {
      const p1 = await PlaylistRepository.create('Favorites', 'Your most loved tracks', 'favorites');
      const p2 = await PlaylistRepository.create('Recently Played', 'Tracks you listened to recently', 'recently_played');
      const p3 = await PlaylistRepository.create('Most Played', 'Your top played music', 'most_played');
      const p4 = await PlaylistRepository.create('Recently Added', 'Newly discovered additions to your library', 'recently_added');
      const p5 = await PlaylistRepository.create('Online History', 'Streams played from YouTube and online links', 'online_history');
      list = [p1, p2, p3, p4, p5];
    }

    setPlaylists(list);
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  // Sync selection when initialPlaylistId changes from Sidebar
  useEffect(() => {
    if (initialPlaylistId) {
      const found = playlists.find((p) => p.id === initialPlaylistId);
      if (found) {
        setSelectedPlaylist(found);
        loadTracksForPlaylist(found);
      } else {
        PlaylistRepository.getById(initialPlaylistId).then((pl) => {
          if (pl) {
            setSelectedPlaylist(pl);
            loadTracksForPlaylist(pl);
          }
        });
      }
    } else if (initialPlaylistId === null && selectedPlaylist) {
      setSelectedPlaylist(null);
    }
  }, [initialPlaylistId, playlists]);

  // When a playlist is selected, resolve its tracks
  const loadTracksForPlaylist = async (pl: PlaylistRecord) => {
    if (pl.type === 'smart' && pl.smartDefinition) {
      const allTracks = await TrackRepository.getAll();
      const matched = SmartPlaylistEngine.filterTracks(allTracks, pl.smartDefinition);
      setPlaylistTracks(matched);
    } else if (pl.type === 'favorites') {
      const favs = await TrackRepository.getFavorites();
      setPlaylistTracks(favs);
    } else if (pl.type === 'recently_played') {
      const recentLogs = await PlayHistoryRepository.getRecent(50);
      const allTracks = await TrackRepository.getAll();
      const tracksMap = new Map(allTracks.map((t) => [t.id, t]));
      const resolved = recentLogs
        .map((log) => tracksMap.get(log.trackId))
        .filter((t): t is Track => Boolean(t));
      setPlaylistTracks(resolved);
    } else if (pl.type === 'most_played') {
      const allTracks = await TrackRepository.getAll();
      const sorted = [...allTracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, 50);
      setPlaylistTracks(sorted);
    } else if (pl.type === 'recently_added') {
      const added = await TrackRepository.getRecentlyAdded(50);
      setPlaylistTracks(added);
    } else if (pl.type === 'online_history') {
      const onlineHistory = await YouTubeHistoryRepository.getAll();
      const onlineTracks: Track[] = onlineHistory.map((h) => ({
        id: `yt_${h.youtube_video_id}`,
        title: h.title,
        artist: h.artist || h.channel || 'YouTube',
        album: 'YouTube Stream',
        duration: h.duration || 0,
        format: h.codec || 'webm',
        path: h.cache_path || h.youtube_url,
        source: 'online',
        sourceType: 'youtube',
        sourceId: h.youtube_video_id,
        sourceChannel: h.channel,
        originalUrl: h.youtube_url,
        cached: h.cache_status === 'CACHED',
        coverArtUrl: h.thumbnail_url,
        dateAdded: h.first_played_at,
        lastPlayedAt: h.last_played_at,
        playCount: h.play_count || 1,
        isFavorite: Boolean(h.is_favorite),
        isAvailable: true,
      }));
      setPlaylistTracks(onlineTracks);
    } else {
      // Normal playlist
      const records = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      const allTracks = await TrackRepository.getAllIncludingUnavailable();
      const map = new Map(allTracks.map((t) => [t.id, t]));

      const resolved: Track[] = records.map((r) => {
        const found = map.get(r.trackId);
        if (found) return found;
        // Fallback to snapshot track data if local file was removed
        if (r.trackData) return r.trackData;
        return {
          id: r.trackId,
          title: 'Unknown Track',
          artist: 'Unknown Artist',
          album: 'Unknown Album',
          duration: 0,
          format: 'mp3',
          path: '',
          source: 'local' as const,
          dateAdded: r.addedAt || Date.now(),
          playCount: 0,
          isFavorite: false,
          isAvailable: false,
        };
      });

      setPlaylistTracks(resolved);
    }
  };

  const handleSelectPlaylist = async (pl: PlaylistRecord) => {
    setSelectedPlaylist(pl);
    await loadTracksForPlaylist(pl);
  };

  const handleCreateNormal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalName.trim()) return;

    const newPl = await PlaylistRepository.create(normalName.trim(), '', 'normal');
    setNormalName('');
    setIsCreatingNormal(false);
    notificationService.success('Playlist Created', `Created playlist "${newPl.name}".`);
    await loadPlaylists();
  };

  const handleSaveSmartPlaylist = async (
    name: string,
    description: string,
    definition: SmartPlaylistDefinition
  ) => {
    if (editingSmartPlaylist) {
      await PlaylistRepository.updateMetadata(editingSmartPlaylist.id, {
        name,
        description,
        smartDefinition: definition,
      });
      notificationService.success('Smart Collection Updated', `Updated smart playlist "${name}".`);
      setEditingSmartPlaylist(null);
      if (selectedPlaylist?.id === editingSmartPlaylist.id) {
        const updated = await PlaylistRepository.getById(editingSmartPlaylist.id);
        if (updated) {
          setSelectedPlaylist(updated);
          loadTracksForPlaylist(updated);
        }
      }
    } else {
      const pl = await PlaylistRepository.create(name, description, 'smart');
      await PlaylistRepository.updateMetadata(pl.id, { smartDefinition: definition });
      notificationService.success('Smart Collection Created', `Created smart playlist "${name}".`);
    }
    await loadPlaylists();
  };

  const handleDeletePlaylist = async (e: React.MouseEvent, pl: PlaylistRecord) => {
    e.stopPropagation();
    if (window.confirm(`Delete playlist "${pl.name}"?`)) {
      await PlaylistRepository.delete(pl.id);
      if (selectedPlaylist?.id === pl.id) {
        setSelectedPlaylist(null);
      }
      await loadPlaylists();
    }
  };

  const handleDuplicatePlaylist = async (e: React.MouseEvent, pl: PlaylistRecord) => {
    e.stopPropagation();
    const copy = await PlaylistRepository.duplicate(pl.id);
    if (copy) {
      notificationService.success('Duplicated', `Duplicated "${pl.name}".`);
      await loadPlaylists();
    }
  };

  const handleToggleFavoritePlaylist = async (e: React.MouseEvent, pl: PlaylistRecord) => {
    e.stopPropagation();
    const nextVal = await PlaylistRepository.toggleFavorite(pl.id);
    setPlaylists((prev) =>
      prev.map((item) => (item.id === pl.id ? { ...item, isFavorite: nextVal } : item))
    );
  };

  // Detailed view actions
  const handleRemoveTrackFromDetail = async (trackId: string) => {
    if (!selectedPlaylist) return;
    await PlaylistTrackRepository.removeTrack(selectedPlaylist.id, trackId);
    await loadTracksForPlaylist(selectedPlaylist);
    await loadPlaylists();
  };

  const handleMoveUp = async (idx: number) => {
    if (!selectedPlaylist || idx <= 0) return;
    await PlaylistTrackRepository.reorderTrack(selectedPlaylist.id, idx, idx - 1);
    await loadTracksForPlaylist(selectedPlaylist);
  };

  const handleMoveDown = async (idx: number) => {
    if (!selectedPlaylist || idx >= playlistTracks.length - 1) return;
    await PlaylistTrackRepository.reorderTrack(selectedPlaylist.id, idx, idx + 1);
    await loadTracksForPlaylist(selectedPlaylist);
  };

  const filteredPlaylists = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6">
      {selectedPlaylist ? (
        <PlaylistDetailView
          playlist={selectedPlaylist}
          tracks={playlistTracks}
          onBack={() => {
            setSelectedPlaylist(null);
            if (onClearInitialId) onClearInitialId();
            loadPlaylists();
          }}
          onPlayAll={() => playPlaylist(playlistTracks, 0)}
          onShuffleAll={() => shufflePlaylist(playlistTracks)}
          onPlayTrack={(track) => playTrack(track, playlistTracks)}
          onRemoveTrack={handleRemoveTrackFromDetail}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onAddTracksModal={() => {
            notificationService.info('Add Tracks', 'Browse your Library and use track context menus or Add to Playlist button.');
          }}
          onToggleFavoriteTrack={async (trackId) => {
            await toggleFavorite(trackId);
            if (selectedPlaylist) loadTracksForPlaylist(selectedPlaylist);
          }}
          onEditRules={() => {
            if (selectedPlaylist && selectedPlaylist.type === 'smart') {
              setEditingSmartPlaylist(selectedPlaylist);
              setIsSmartModalOpen(true);
            }
          }}
          onRateTrack={async (trackId, rating) => {
            await setTrackRating(trackId, rating);
            if (selectedPlaylist) loadTracksForPlaylist(selectedPlaylist);
          }}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Playlists &amp; Collections</h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Manage manual playlists, smart auto-updating rules, and favorite music groups.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreatingNormal(true)}
                className="px-3.5 py-2 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 text-[var(--accent)]" />
                <span>New Playlist</span>
              </button>

              <button
                onClick={() => setIsSmartModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 flex items-center gap-1.5 transition-all shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>Smart Collection</span>
              </button>

              <button
                onClick={() => setIsImportExportOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <FileText className="w-4 h-4 text-cyan-400" />
                <span>Import / Export M3U</span>
              </button>
            </div>
          </div>

          {/* Inline Create Form */}
          {isCreatingNormal && (
            <form
              onSubmit={handleCreateNormal}
              className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] flex items-center gap-3 animate-fade-in"
            >
              <input
                type="text"
                autoFocus
                required
                value={normalName}
                onChange={(e) => setNormalName(e.target.value)}
                placeholder="Enter playlist name..."
                className="flex-1 px-4 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingNormal(false)}
                className="px-3 py-2 text-xs text-[var(--text-muted)] hover:text-white"
              >
                Cancel
              </button>
            </form>
          )}

          {/* Search Bar */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Playlists Grid */}
          {filteredPlaylists.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
              <ListMusic className="w-10 h-10 text-[var(--text-muted)] mx-auto opacity-50" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">No Playlists Found</div>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                Create a standard playlist or build a smart collection with custom rules.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredPlaylists.map((pl) => (
                <PlaylistCard
                  key={pl.id}
                  playlist={pl}
                  onClick={() => handleSelectPlaylist(pl)}
                  onPlay={async (e) => {
                    e.stopPropagation();
                    await loadTracksForPlaylist(pl);
                    playPlaylist(playlistTracks, 0);
                  }}
                  onShuffle={async (e) => {
                    e.stopPropagation();
                    await loadTracksForPlaylist(pl);
                    shufflePlaylist(playlistTracks);
                  }}
                  onToggleFavorite={(e) => handleToggleFavoritePlaylist(e, pl)}
                  onDelete={(e) => handleDeletePlaylist(e, pl)}
                  onDuplicate={(e) => handleDuplicatePlaylist(e, pl)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Smart Playlist Builder Modal */}
      <SmartPlaylistModal
        isOpen={isSmartModalOpen}
        onClose={() => {
          setIsSmartModalOpen(false);
          setEditingSmartPlaylist(null);
        }}
        onSave={handleSaveSmartPlaylist}
        initialName={editingSmartPlaylist ? editingSmartPlaylist.name : ''}
        initialDescription={editingSmartPlaylist ? editingSmartPlaylist.description : ''}
        initialDefinition={editingSmartPlaylist ? editingSmartPlaylist.smartDefinition : undefined}
      />

      {/* M3U / M3U8 Import & Export Modal (Final Project Polish) */}
      <PlaylistImportExportModal
        isOpen={isImportExportOpen}
        onClose={() => setIsImportExportOpen(false)}
        onSuccess={loadPlaylists}
      />
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { PlaylistRecord, Track } from '../../types';
import { PlaylistRepository, PlaylistTrackRepository } from '../../database/repository';
import { notificationService } from '../../services/errorService';
import { X, Plus, Check, ListMusic, Search } from 'lucide-react';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackOrTracks?: Track | Track[] | null;
  track?: Track | null;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  trackOrTracks,
  track,
}) => {
  const target = trackOrTracks || track;
  if (!isOpen || !target) return null;

  const tracks = Array.isArray(target) ? target : [target];
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const loadPlaylists = async () => {
    const list = await PlaylistRepository.getAll();
    setPlaylists(list.filter((p) => p.type === 'normal'));
  };

  useEffect(() => {
    loadPlaylists();
  }, []);

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPl = await PlaylistRepository.create(newPlaylistName.trim());
    await PlaylistTrackRepository.addTracks(newPl.id, tracks);
    notificationService.success('Added to Playlist', `Added ${tracks.length} track(s) to "${newPl.name}".`);
    onClose();
  };

  const handleAddToPlaylist = async (playlist: PlaylistRecord) => {
    await PlaylistTrackRepository.addTracks(playlist.id, tracks);
    setAddedIds((prev) => new Set(prev).add(playlist.id));
    notificationService.success('Added to Playlist', `Added ${tracks.length} track(s) to "${playlist.name}".`);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  const filtered = playlists.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Add to Playlist</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
          {/* Target track notice */}
          <div className="p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] truncate">
            Adding <b>{tracks.length} track{tracks.length > 1 ? 's' : ''}</b>: {tracks[0].title}
            {tracks.length > 1 ? ` + ${tracks.length - 1} more` : ''}
          </div>

          {/* New Playlist Form */}
          {isCreatingNew ? (
            <form onSubmit={handleCreateAndAdd} className="space-y-2 p-3 rounded-xl bg-[var(--surface-secondary)]">
              <label className="block text-[11px] font-semibold text-[var(--text-primary)]">Playlist Title</label>
              <input
                type="text"
                autoFocus
                required
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Playlist name..."
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-2.5 py-1 text-xs text-[var(--text-muted)] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] font-semibold text-xs"
                >
                  Create &amp; Add
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsCreatingNew(true)}
              className="w-full py-2 px-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--accent)] flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Playlist</span>
            </button>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search your playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Playlists List */}
          <div className="space-y-1.5 pt-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-[11px] text-[var(--text-muted)]">No playlists found.</div>
            ) : (
              filtered.map((pl) => {
                const isAdded = addedIds.has(pl.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleAddToPlaylist(pl)}
                    disabled={isAdded}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left ${
                      isAdded
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">{pl.name}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{pl.songCount || 0} tracks</div>
                    </div>
                    {isAdded ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Plus className="w-4 h-4 text-[var(--text-muted)]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

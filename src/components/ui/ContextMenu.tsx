import React, { useEffect, useRef } from 'react';
import {
  Play,
  ListPlus,
  ListMusic,
  Heart,
  Disc,
  User,
  FolderOpen,
  Info,
  Trash2,
  CornerDownRight,
  Edit3,
  Image as ImageIcon,
  FileEdit,
  FolderInput,
  Copy as CopyIcon,
} from 'lucide-react';
import { Track } from '../../types';

export interface ContextMenuProps {
  x: number;
  y: number;
  track: Track;
  onClose: () => void;
  onPlay: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
  onToggleFavorite: (track: Track) => void;
  onShowProperties: (track: Track) => void;
  onEditMetadata?: (track: Track) => void;
  onChangeArtwork?: (track: Track) => void;
  onRenameFile?: (track: Track) => void;
  onMoveFile?: (track: Track) => void;
  onCopyFile?: (track: Track) => void;
  onDeletePhysicalFile?: (track: Track) => void;
  onOpenFileLocation?: (path: string) => void;
  onRemoveFromLibrary?: (track: Track) => void;
  onNavigateToAlbum?: (albumName: string) => void;
  onNavigateToArtist?: (artistName: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  track,
  onClose,
  onPlay,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onToggleFavorite,
  onShowProperties,
  onEditMetadata,
  onChangeArtwork,
  onRenameFile,
  onMoveFile,
  onCopyFile,
  onDeletePhysicalFile,
  onOpenFileLocation,
  onRemoveFromLibrary,
  onNavigateToAlbum,
  onNavigateToArtist,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Adjust coordinates so menu does not overflow window edges
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-52 p-1.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl backdrop-blur-xl animate-in fade-in duration-100 select-none text-xs"
    >
      <div className="px-3 py-1.5 border-b border-[var(--border-subtle)] mb-1">
        <p className="font-bold text-[var(--text-primary)] truncate">{track.title}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate">{track.artist}</p>
      </div>

      <button
        onClick={() => {
          onPlay(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
      >
        <Play className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span>Play</span>
      </button>

      {onPlayNext && (
        <button
          onClick={() => {
            onPlayNext(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <CornerDownRight className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Play Next</span>
        </button>
      )}

      <button
        onClick={() => {
          onAddToQueue(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
      >
        <ListPlus className="w-3.5 h-3.5" />
        <span>Add to Queue</span>
      </button>

      {onAddToPlaylist && (
        <button
          onClick={() => {
            onAddToPlaylist(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <ListMusic className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Add to Playlist...</span>
        </button>
      )}

      <button
        onClick={() => {
          onToggleFavorite(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
      >
        <Heart
          className={`w-3.5 h-3.5 ${track.isFavorite ? 'text-rose-500 fill-current' : ''}`}
        />
        <span>{track.isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
      </button>

      {track.album && onNavigateToAlbum && (
        <button
          onClick={() => {
            onNavigateToAlbum(track.album!);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <Disc className="w-3.5 h-3.5" />
          <span>Show Album</span>
        </button>
      )}

      {track.artist && onNavigateToArtist && (
        <button
          onClick={() => {
            onNavigateToArtist(track.artist);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <User className="w-3.5 h-3.5" />
          <span>Show Artist</span>
        </button>
      )}

      {onOpenFileLocation && (
        <button
          onClick={() => {
            onOpenFileLocation(track.path);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open File Location</span>
        </button>
      )}

      {onEditMetadata && (
        <button
          onClick={() => {
            onEditMetadata(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Edit Metadata</span>
        </button>
      )}

      {onChangeArtwork && (
        <button
          onClick={() => {
            onChangeArtwork(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Change Cover Art</span>
        </button>
      )}

      {onRenameFile && (
        <button
          onClick={() => {
            onRenameFile(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <FileEdit className="w-3.5 h-3.5" />
          <span>Rename File</span>
        </button>
      )}

      {onMoveFile && (
        <button
          onClick={() => {
            onMoveFile(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <FolderInput className="w-3.5 h-3.5" />
          <span>Move File</span>
        </button>
      )}

      {onCopyFile && (
        <button
          onClick={() => {
            onCopyFile(track);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
        >
          <CopyIcon className="w-3.5 h-3.5" />
          <span>Copy File</span>
        </button>
      )}

      <button
        onClick={() => {
          onShowProperties(track);
          onClose();
        }}
        className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
        <span>Properties / Details</span>
      </button>

      {(onRemoveFromLibrary || onDeletePhysicalFile) && (
        <div className="border-t border-[var(--border-subtle)] mt-1 pt-1 space-y-0.5">
          {onRemoveFromLibrary && (
            <button
              onClick={() => {
                onRemoveFromLibrary(track);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-amber-950/30 text-amber-400 transition-colors"
              title="Removes track from app database; does not delete file on drive"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove from Library</span>
            </button>
          )}

          {onDeletePhysicalFile && (
            <button
              onClick={() => {
                onDeletePhysicalFile(track);
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-red-950/40 text-red-400 transition-colors"
              title="Permanently deletes the audio file from storage"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Physical File...</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

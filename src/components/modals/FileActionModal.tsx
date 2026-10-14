import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { Button } from '../ui/Button';
import { fileManagementService } from '../../services/file/FileManagementService';
import { FolderRepository } from '../../database/repository';
import { notificationService } from '../../services/errorService';
import { usePlayer } from '../../player/PlayerContext';
import {
  FileEdit,
  FolderInput,
  Copy,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Folder,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';

export type FileActionMode = 'rename' | 'move' | 'copy' | 'delete';

interface FileActionModalProps {
  track: Track | null;
  mode: FileActionMode;
  isOpen: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export const FileActionModal: React.FC<FileActionModalProps> = ({
  track,
  mode,
  isOpen,
  onClose,
  onCompleted,
}) => {
  const { currentTrack } = usePlayer();
  const [newBasename, setNewBasename] = useState('');
  const [targetFolder, setTargetFolder] = useState('');
  const [deleteMode, setDeleteMode] = useState<'library_only' | 'physical_file'>('library_only');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLyrics, setDeleteLyrics] = useState(true);
  const [availableFolders, setAvailableFolders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (track) {
      const currentName = track.filename || track.path.split('/').pop() || `${track.title}.mp3`;
      const base = currentName.replace(/\.[a-zA-Z0-9]+$/, '');
      setNewBasename(base);
      setTargetFolder(track.folderPath || '/Music');
      setDeleteConfirmed(false);
      setDeleteMode('library_only');
      setValidationError(null);
    }
  }, [track, mode, isOpen]);

  useEffect(() => {
    FolderRepository.getAll().then((folders) => {
      setAvailableFolders(folders.map((f) => f.path));
    });
  }, [isOpen]);

  if (!isOpen || !track) return null;

  const isCurrentlyPlaying = currentTrack?.id === track.id;
  const currentFilename = track.filename || track.path.split('/').pop() || `${track.title}.mp3`;
  const extension = currentFilename.split('.').pop() || 'mp3';

  const handleAction = async () => {
    setValidationError(null);
    setIsProcessing(true);

    try {
      if (mode === 'rename') {
        const res = await fileManagementService.renameFile(track, newBasename);
        if (!res.success) {
          setValidationError(res.message);
          setIsProcessing(false);
          return;
        }
        notificationService.success('Rename Complete', res.message);
      } else if (mode === 'move') {
        const res = await fileManagementService.moveFile(track, targetFolder);
        if (!res.success) {
          setValidationError(res.message);
          setIsProcessing(false);
          return;
        }
        notificationService.success('File Moved', res.message);
      } else if (mode === 'copy') {
        const res = await fileManagementService.copyFile(track, targetFolder);
        if (!res.success) {
          setValidationError(res.message);
          setIsProcessing(false);
          return;
        }
        notificationService.success('Copy Created', res.message);
      } else if (mode === 'delete') {
        if (deleteMode === 'physical_file') {
          if (!deleteConfirmed) {
            setValidationError('Please check the confirmation box before deleting the file.');
            setIsProcessing(false);
            return;
          }
          const res = await fileManagementService.deletePhysicalFile(track.id, deleteLyrics);
          if (!res.success) {
            setValidationError(res.message);
            setIsProcessing(false);
            return;
          }
          notificationService.info('File Deleted', res.message);
        } else {
          const res = await fileManagementService.removeFromLibrary(track.id);
          notificationService.info('Library Updated', res.message);
        }
      }

      if (onCompleted) onCompleted();
      onClose();
    } catch (err: any) {
      setValidationError(err?.message || 'Operation failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            {mode === 'rename' && <FileEdit className="w-5 h-5 text-[var(--accent)]" />}
            {mode === 'move' && <FolderInput className="w-5 h-5 text-[var(--accent)]" />}
            {mode === 'copy' && <Copy className="w-5 h-5 text-[var(--accent)]" />}
            {mode === 'delete' && <Trash2 className="w-5 h-5 text-rose-400" />}
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {mode === 'rename' && 'Rename Music File'}
              {mode === 'move' && 'Move Music File'}
              {mode === 'copy' && 'Copy Music File'}
              {mode === 'delete' && 'Delete or Remove Music File'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4 text-xs">
          {/* Target Track Preview */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
            <div className="font-bold text-[var(--text-primary)] truncate">{track.title}</div>
            <div className="text-[11px] text-[var(--text-secondary)] truncate">{track.artist}</div>
            <div className="text-[10px] text-[var(--text-muted)] font-mono truncate">{track.path}</div>
          </div>

          {/* Currently Playing Protection Notice */}
          {isCurrentlyPlaying && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-start gap-2.5">
              <PlayCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold block">Currently Playing Song</span>
                <span>This song is currently loaded in playback. Executing this file operation will pause playback safely before updating references.</span>
              </div>
            </div>
          )}

          {/* Mode: RENAME */}
          {mode === 'rename' && (
            <div className="space-y-3">
              <div>
                <label className="font-semibold block text-[var(--text-primary)] mb-1">
                  New File Name (without extension)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newBasename}
                    onChange={(e) => {
                      setNewBasename(e.target.value);
                      setValidationError(null);
                    }}
                    className="flex-1 px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
                    placeholder="Song Title"
                    autoFocus
                  />
                  <span className="px-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-muted)] font-mono font-bold">
                    .{extension}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)] space-y-1">
                <span className="font-semibold text-[var(--text-primary)] block">Format Integrity Guarantee</span>
                <p>
                  Renaming preserves the original <code className="text-[var(--accent)] font-mono">.{extension}</code> extension.
                  Renaming a file does not convert its underlying audio format.
                </p>
              </div>
            </div>
          )}

          {/* Mode: MOVE or COPY */}
          {(mode === 'move' || mode === 'copy') && (
            <div className="space-y-3">
              <div>
                <label className="font-semibold block text-[var(--text-primary)] mb-1">
                  Destination Folder Path
                </label>
                <input
                  type="text"
                  value={targetFolder}
                  onChange={(e) => {
                    setTargetFolder(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
                  placeholder="/Music/TargetFolder"
                />
              </div>

              {availableFolders.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[11px] text-[var(--text-muted)] font-semibold block">
                    Or select an indexed folder:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {availableFolders.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setTargetFolder(f)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all truncate max-w-full ${
                          targetFolder === f
                            ? 'bg-[var(--accent)] text-black border-[var(--accent)]'
                            : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:text-white'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-[var(--text-secondary)]">
                {mode === 'move'
                  ? 'Moving preserves playlists, favorites, star ratings, listening statistics, and moves sidecar .lrc lyrics together.'
                  : 'Copying creates an independent song copy in the destination folder without modifying the original.'}
              </p>
            </div>
          )}

          {/* Mode: DELETE */}
          {mode === 'delete' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setDeleteMode('library_only')}
                  className={`w-full p-3 rounded-xl text-left border transition-all space-y-1 ${
                    deleteMode === 'library_only'
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs">Remove from Library Only</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Removes the song from the application index. The actual audio file on your device storage remains completely safe and untouched.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteMode('physical_file')}
                  className={`w-full p-3 rounded-xl text-left border transition-all space-y-1 ${
                    deleteMode === 'physical_file'
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 ring-1 ring-rose-500/30'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-rose-400">Delete Physical Audio File</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Permanently deletes the audio file from storage and clears all library and playlist references.
                  </div>
                </button>
              </div>

              {deleteMode === 'physical_file' && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2.5 animate-fade-in">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteConfirmed}
                      onChange={(e) => setDeleteConfirmed(e.target.checked)}
                      className="w-4 h-4 rounded accent-rose-500"
                    />
                    <span className="text-[11px] font-bold text-rose-300">
                      I understand this action permanently deletes the audio file.
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer pl-6">
                    <input
                      type="checkbox"
                      checked={deleteLyrics}
                      onChange={(e) => setDeleteLyrics(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-rose-500"
                    />
                    <span className="text-[10px] text-rose-300/80">
                      Also delete sidecar lyrics file (.lrc)
                    </span>
                  </label>
                </div>
              )}
            </div>
          )}

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>

          <Button
            variant={mode === 'delete' && deleteMode === 'physical_file' ? 'danger' : 'primary'}
            size="sm"
            onClick={handleAction}
            disabled={
              isProcessing ||
              (mode === 'rename' && !newBasename.trim()) ||
              ((mode === 'move' || mode === 'copy') && !targetFolder.trim()) ||
              (mode === 'delete' && deleteMode === 'physical_file' && !deleteConfirmed)
            }
          >
            {isProcessing ? 'Processing...' : mode === 'rename' ? 'Rename File' : mode === 'move' ? 'Move File' : mode === 'copy' ? 'Copy File' : deleteMode === 'physical_file' ? 'Delete File' : 'Remove from Library'}
          </Button>
        </div>
      </div>
    </div>
  );
};


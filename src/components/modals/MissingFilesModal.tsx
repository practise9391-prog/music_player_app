import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { TrackRepository } from '../../database/repository';
import { nativeBridge } from '../../services/nativeBridge';
import { notificationService } from '../../services/errorService';
import {
  FileWarning,
  X,
  Search,
  Trash2,
  CheckCircle,
  FolderOpen,
  ArrowRight,
} from 'lucide-react';

interface MissingFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const MissingFilesModal: React.FC<MissingFilesModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [missingTracks, setMissingTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadMissing = async () => {
    setIsLoading(true);
    try {
      const missing = await TrackRepository.getMissingFiles();
      setMissingTracks(missing);
    } catch (err) {
      console.error('Failed to load missing tracks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMissing();
    }
  }, [isOpen]);

  const handleLocateFile = async (track: Track) => {
    const files = await nativeBridge.openFileDialog();
    if (files.length > 0) {
      const selected = files[0];
      const newPath = (selected as any).path || selected.name;
      await TrackRepository.updateTrackPath(track.id, newPath, selected.name);
      notificationService.success('File Located', `Relinked "${track.title}" to new file location.`);
      await loadMissing();
      onUpdated();
    }
  };

  const handleRemoveTrack = async (id: string, title: string) => {
    await TrackRepository.remove(id);
    notificationService.success('Removed from Library', `Removed "${title}" from library.`);
    await loadMissing();
    onUpdated();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <FileWarning className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Missing Audio Files
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {missingTracks.length} missing
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="text-xs text-[var(--text-muted)]">
            These tracks were moved, deleted, or their source drive is currently disconnected.
            You can relocate them to re-link their playback metadata and statistics.
          </p>

          {isLoading ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)]">
              Checking library files...
            </div>
          ) : missingTracks.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-400 opacity-80" />
              <p className="text-sm font-bold text-[var(--text-primary)]">
                All Library Files Available!
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                No missing files found. Every audio track in your library is accessible.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {missingTracks.map((track) => (
                <div
                  key={track.id}
                  className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-[var(--text-primary)] truncate">
                      {track.title}
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate">
                      {track.artist} • {track.album}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono truncate mt-0.5">
                      Last known path: {track.path}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleLocateFile(track)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] text-xs font-semibold transition-opacity hover:opacity-90"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Locate File</span>
                    </button>
                    <button
                      onClick={() => handleRemoveTrack(track.id, track.title)}
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove from Library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

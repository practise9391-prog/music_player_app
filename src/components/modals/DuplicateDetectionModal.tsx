import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { DuplicateGroupDetail } from '../../types/fileManagement';
import { duplicateDetectorService } from '../../services/file/DuplicateDetectorService';
import { fileManagementService } from '../../services/file/FileManagementService';
import { notificationService } from '../../services/errorService';
import { usePlayer } from '../../player/PlayerContext';
import {
  Copy,
  X,
  Trash2,
  CheckCircle,
  FileMusic,
  ArrowRight,
  HardDrive,
  Clock,
  Sparkles,
  Play,
  Pause,
  AlertTriangle,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface DuplicateDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function formatDuration(sec?: number): string {
  if (!sec || sec <= 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

export const DuplicateDetectionModal: React.FC<DuplicateDetectionModalProps> = ({
  isOpen,
  onClose,
  onUpdated,
}) => {
  const { playTrack, currentTrack, state, togglePlayPause } = usePlayer();
  const isPlaying = state.status === 'playing';
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroupDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const loadDuplicates = async () => {
    setIsLoading(true);
    try {
      const groups = await duplicateDetectorService.findDuplicates();
      setDuplicateGroups(groups);
    } catch (err) {
      console.error('Failed to detect duplicates:', err);
      notificationService.error('Scan Error', 'Failed to scan for duplicate tracks.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDuplicates();
    }
  }, [isOpen]);

  const handlePlayPreview = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlayPause();
    } else {
      playTrack(track);
    }
  };

  const handleRemoveFromLibrary = async (track: Track) => {
    setActionInProgress(track.id);
    try {
      const res = await fileManagementService.removeFromLibrary(track.id);
      if (res.success) {
        notificationService.success(
          'Removed from Library',
          `Removed "${track.title}" from library database. Physical file was NOT touched.`
        );
        await loadDuplicates();
        onUpdated();
      } else {
        notificationService.error('Error', res.error || 'Could not remove track.');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDeletePhysical = async (track: Track) => {
    const confirmed = window.confirm(
      `PERMANENT FILE DELETION:\n\nAre you sure you want to permanently delete "${track.filename || track.title}" from storage?\n\nPath: ${track.path}\n\nThis CANNOT be undone.`
    );
    if (!confirmed) return;

    setActionInProgress(track.id);
    try {
      const res = await fileManagementService.deletePhysicalFile(track.id, {
        confirmDelete: true,
      });
      if (res.success) {
        notificationService.success(
          'File Deleted',
          `Permanently deleted "${track.filename || track.title}" from storage.`
        );
        await loadDuplicates();
        onUpdated();
      } else {
        notificationService.error('Delete Failed', res.error || 'Could not delete physical file.');
      }
    } finally {
      setActionInProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[88vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <Copy className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Advanced Duplicate Audio Detection
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--surface-secondary)] text-[var(--text-muted)] border border-[var(--border)]">
              {duplicateGroups.length} cluster{duplicateGroups.length === 1 ? '' : 's'}
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
          <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex items-start gap-3 text-xs leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--text-primary)]">
                Intelligent Comparison &amp; Safety Guarantee
              </p>
              <p className="text-[var(--text-muted)] text-[11px]">
                Tracks are compared by exact audio hash, matching size + duration, or normalized acoustic metadata.
                The application highlights the highest quality copy (based on bitrate, sample rate, and format) but{' '}
                <strong className="text-[var(--text-primary)]">NEVER automatically deletes any file</strong> without your direct approval.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center space-y-2 text-xs text-[var(--text-muted)]">
              <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Analyzing library files and matching duplicate audio fingerprints...</p>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle className="w-12 h-12 mx-auto text-emerald-400 opacity-90" />
              <p className="text-sm font-bold text-[var(--text-primary)]">
                No Duplicate Songs Detected!
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Your music library has no redundant or duplicate copies.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {duplicateGroups.map((group, gIdx) => (
                <div
                  key={gIdx}
                  className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-3"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)] pb-2 border-b border-[var(--border-subtle)]">
                    <span className="truncate">
                      {group.originalTrack.title} — {group.originalTrack.artist}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--accent)] border border-[var(--border)]">
                        {group.reason}
                      </span>
                    </div>
                  </div>

                  {/* Recommendation banner */}
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      <strong>Recommendation:</strong> {group.recommendationReason}
                    </span>
                  </div>

                  {/* Tracks Comparison List */}
                  <div className="space-y-2">
                    {group.allTracks.map((track) => {
                      const isRecommended = track.id === group.recommendedToKeepId;
                      const isCurrent = currentTrack?.id === track.id;
                      const isTrackPlaying = isCurrent && isPlaying;

                      return (
                        <div
                          key={track.id}
                          className={`p-3 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isRecommended
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-[var(--surface-secondary)] border-[var(--border-subtle)]'
                          }`}
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              {isRecommended && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  Recommended Keep
                                </span>
                              )}
                              <p className="font-semibold text-[var(--text-primary)] truncate">
                                {track.filename || track.title}
                              </p>
                            </div>

                            <p className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                              {track.path}
                            </p>

                            {/* Technical Specs Comparison Badges */}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[var(--text-secondary)]">
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                                {track.format.toUpperCase()}
                              </span>
                              {track.bitrate && (
                                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                                  {track.bitrate} kbps
                                </span>
                              )}
                              {track.sampleRate && (
                                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                                  {(track.sampleRate / 1000).toFixed(1)} kHz
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                                {formatDuration(track.duration)}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)]">
                                {formatBytes(track.fileSize)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                            {/* Preview Play Button */}
                            <button
                              onClick={() => handlePlayPreview(track)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isTrackPlaying
                                  ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                                  : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white border-[var(--border)]'
                              }`}
                              title={isTrackPlaying ? 'Pause preview' : 'Play audio preview'}
                            >
                              {isTrackPlaying ? (
                                <Pause className="w-3.5 h-3.5" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current" />
                              )}
                            </button>

                            {/* Remove from Library Only */}
                            <button
                              onClick={() => handleRemoveFromLibrary(track)}
                              disabled={actionInProgress === track.id}
                              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)] text-[11px] font-medium transition-colors"
                              title="Remove record from library only (file remains intact)"
                            >
                              Remove from Library
                            </button>

                            {/* Delete Physical File */}
                            <button
                              onClick={() => handleDeletePhysical(track)}
                              disabled={actionInProgress === track.id}
                              className="p-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 transition-colors"
                              title="Delete physical file from storage"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <p className="text-[11px] text-[var(--text-muted)]">
            {duplicateGroups.length > 0 &&
              `${duplicateGroups.length} cluster(s) with redundant copies found`}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)] shadow-md"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

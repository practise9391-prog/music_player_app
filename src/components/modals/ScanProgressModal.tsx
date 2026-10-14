import React, { useState } from 'react';
import { ScanProgress } from '../../types';
import { Button } from '../ui/Button';
import { RefreshCw, CheckCircle, AlertTriangle, X, FileAudio, Folder } from 'lucide-react';

interface ScanProgressModalProps {
  progress: ScanProgress | null;
  onCancel: () => void;
  onClose: () => void;
}

export const ScanProgressModal: React.FC<ScanProgressModalProps> = ({
  progress,
  onCancel,
  onClose,
}) => {
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  if (!progress) return null;

  const isComplete = !progress.isScanning;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                isComplete
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30'
              }`}
            >
              {isComplete ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <RefreshCw className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                {isComplete ? 'Library Scan Complete' : 'Scanning Local Music...'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] font-mono truncate max-w-xs">
                {progress.currentFolder}
              </p>
            </div>
          </div>

          {isComplete && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Progress Bar & Current File */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-mono text-[var(--text-secondary)]">
            <span>
              {progress.processedFiles} / {progress.totalFiles} files
            </span>
            <span className="font-bold text-[var(--text-primary)]">{progress.percentage}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-200"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          {!isComplete && progress.currentFile && (
            <div className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1.5 pt-1">
              <FileAudio className="w-3.5 h-3.5 shrink-0 text-[var(--accent)]" />
              <span className="truncate">{progress.currentFile}</span>
            </div>
          )}
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-5 gap-2 text-center">
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">New</div>
            <div className="text-base font-extrabold text-emerald-400 font-mono">
              {progress.newTracks}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Updated</div>
            <div className="text-base font-extrabold text-sky-400 font-mono">
              {progress.updatedTracks}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Removed</div>
            <div className="text-base font-extrabold text-amber-400 font-mono">
              {progress.removedTracks}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Duplicates</div>
            <div className="text-base font-extrabold text-purple-400 font-mono">
              {progress.duplicateCandidates ?? 0}
            </div>
          </div>
          <div className="p-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div className="text-[10px] uppercase font-bold text-[var(--text-muted)]">Skipped</div>
            <div className="text-base font-extrabold text-[var(--text-muted)] font-mono">
              {progress.skippedFiles}
            </div>
          </div>
        </div>

        {/* Errors notification if any */}
        {progress.errors.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-400 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{progress.errors.length} file(s) could not be parsed.</span>
              </div>
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="underline hover:text-white font-semibold text-[11px]"
              >
                {showErrorDetails ? 'Hide' : 'View Errors'}
              </button>
            </div>

            {showErrorDetails && (
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[11px] font-mono">
                {progress.errors.map((err, i) => (
                  <div key={i} className="text-red-400 truncate">
                    {err.path}: {err.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-2">
          {!isComplete ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel Scan
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

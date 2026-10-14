// ──────────────────────────────────────────────────────────
// LyricsReplaceConfirmModal — Part 14
// Protects user-edited lyrics from being silently overwritten
// when new online or imported lyrics are fetched.
// Options: Replace, Keep Existing, Save as New Version, Cancel
// ──────────────────────────────────────────────────────────
import React from 'react';
import { AlertTriangle, X, Shield, FileCheck, CopyPlus } from 'lucide-react';
import { Track } from '../../types/track';

interface LyricsReplaceConfirmModalProps {
  isOpen: boolean;
  track: Track | null;
  onReplace: () => void;
  onKeepExisting: () => void;
  onSaveAsNewVersion: () => void;
  onClose: () => void;
}

export const LyricsReplaceConfirmModal: React.FC<LyricsReplaceConfirmModalProps> = ({
  isOpen,
  track,
  onReplace,
  onKeepExisting,
  onSaveAsNewVersion,
  onClose,
}) => {
  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Replace your edited lyrics?
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {track.title} &bull; {track.artist}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice */}
        <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-[var(--text-secondary)] leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>User Edited Lyrics Protected</span>
          </div>
          <p>
            You previously edited or synchronized lyrics for this song. Choose how you would like to proceed with the newly retrieved lyrics.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onReplace}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-sm active:scale-98"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Replace with New Lyrics</span>
          </button>

          <button
            onClick={onSaveAsNewVersion}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-all active:scale-98"
          >
            <CopyPlus className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Save as Alternative Version</span>
          </button>

          <button
            onClick={onKeepExisting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-primary)] transition-all active:scale-98"
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Keep Existing Edited Lyrics</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

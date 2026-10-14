// ──────────────────────────────────────────────────────────
// OnlineLyricsConfirmModal — Part 9
// Privacy & Air-Gap permission confirmation before querying
// external online lyrics provider (LRCLIB).
// ──────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { ShieldAlert, Globe, X, Check, Lock } from 'lucide-react';
import { Track } from '../../types/track';
import { useSettings } from '../../settings/SettingsContext';

interface OnlineLyricsConfirmModalProps {
  isOpen: boolean;
  track: Track | null;
  onConfirm: () => void;
  onClose: () => void;
}

export const OnlineLyricsConfirmModal: React.FC<OnlineLyricsConfirmModalProps> = ({
  isOpen,
  track,
  onConfirm,
  onClose,
}) => {
  const { settings, updateSettings } = useSettings();
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen || !track) return null;

  const handleConfirm = () => {
    if (dontAskAgain) {
      updateSettings({ askBeforeOnlineLyricsSearch: false });
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl space-y-5 text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Network Access Confirmation</h2>
              <p className="text-xs text-[var(--text-secondary)]">Air-Gap Privacy Protection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <div className="p-4 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2 text-xs text-[var(--text-secondary)]">
          <p>
            You are about to query the public <strong className="text-[var(--text-primary)]">LRCLIB service</strong> for:
          </p>
          <div className="font-semibold text-sm text-[var(--accent)] truncate">
            {track.title} <span className="text-[var(--text-muted)] font-normal">— {track.artist}</span>
          </div>
          <p className="text-[11px] leading-relaxed pt-1 text-[var(--text-muted)]">
            This will temporarily open an outbound HTTP session. Once lyrics are retrieved, they will be saved to your local offline library and the connection will immediately close.
          </p>
        </div>

        {/* Don't ask again toggle */}
        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--accent)]"
          />
          <span>Do not ask again (allow explicit searches without prompt)</span>
        </label>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            Keep Offline
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-[var(--btn-text)] hover:opacity-90 shadow-md transition-all active:scale-95"
          >
            <Globe className="w-3.5 h-3.5" />
            Connect &amp; Search
          </button>
        </div>
      </div>
    </div>
  );
};

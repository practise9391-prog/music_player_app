import React from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { Globe, AlertTriangle, Play, X } from 'lucide-react';

export const QueuedOnlineTrackModal: React.FC = () => {
  const {
    pendingOnlineTrack,
    playPendingOnlineTrack,
    cancelPendingOnlineTrack,
  } = usePlayer();

  if (!pendingOnlineTrack) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl space-y-5">
        <div className="flex items-center gap-3 text-amber-400">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">
              Online Playback Permission
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Network access required for queued item
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
          <div className="text-xs font-bold text-[var(--text-primary)] truncate">
            {pendingOnlineTrack.title}
          </div>
          <div className="text-xs text-[var(--text-secondary)] truncate">
            {pendingOnlineTrack.sourceChannel || pendingOnlineTrack.artist}
          </div>
          <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mt-1">
            Source: YouTube Online Stream
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
          The next track in your queue is an online YouTube stream. Because network access is locked by default, starting playback will open a temporary online session.
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={cancelPendingOnlineTrack}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" /> Cancel / Pause
          </button>
          <button
            onClick={playPendingOnlineTrack}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-[var(--btn-text)] hover:brightness-110 shadow-lg transition-all flex items-center gap-1.5"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Start Online Playback
          </button>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Track } from '../../types';
import { Button } from '../ui/Button';
import { FileText, X, Disc, Shield, HardDrive } from 'lucide-react';

interface TrackPropertiesModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return 'Unknown Size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const TrackPropertiesModal: React.FC<TrackPropertiesModalProps> = ({
  track,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !track) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Track Properties</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
          <div className="w-16 h-16 rounded-lg bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border-subtle)]">
            {track.coverArtUrl ? (
              <img src={track.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <Disc className="w-8 h-8 text-[var(--text-muted)]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
            <p className="text-xs text-[var(--text-secondary)] truncate">{track.artist}</p>
            <p className="text-xs text-[var(--text-muted)] truncate">{track.album}</p>
          </div>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Codec / Format</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {track.codec?.toUpperCase() || track.format?.toUpperCase() || 'UNKNOWN'}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Audio Quality</span>
              <span className="font-semibold text-[var(--accent)]">
                {track.bitrate ? `${track.bitrate} kbps` : 'Standard'}
                {track.sampleRate ? ` / ${track.sampleRate} Hz` : ''}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Channels</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {track.channels === 1 ? '1.0 Mono' : '2.0 Stereo'}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Duration</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatDuration(track.duration)}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Genre</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {track.genre || 'Unspecified'}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Release Year</span>
              <span className="font-semibold text-[var(--text-primary)]">{track.year || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">Track / Disc #</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {track.trackNumber ? `Track ${track.trackNumber}` : '—'}
                {track.discNumber ? ` (Disc ${track.discNumber})` : ''}
              </span>
            </div>
            <div>
              <span className="text-[var(--text-muted)] block text-[10px] uppercase">File Size</span>
              <span className="font-semibold text-[var(--text-primary)]">
                {formatBytes(track.fileSize)}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-1">
            <span className="text-[var(--text-muted)] block text-[10px] uppercase">File Location</span>
            <div className="text-[11px] text-[var(--text-secondary)] break-all select-all">
              {track.path}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

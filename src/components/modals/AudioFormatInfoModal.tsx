import React from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { Track } from '../../types';
import {
  FileAudio,
  X,
  Sparkles,
  HardDrive,
  Clock,
  Layers,
  Zap,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface AudioFormatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  track?: Track | null;
}

export const AudioFormatInfoModal: React.FC<AudioFormatInfoModalProps> = ({
  isOpen,
  onClose,
  track: propTrack,
}) => {
  const { currentTrack, audioFormatBadge } = usePlayer();
  const track = propTrack || currentTrack;

  if (!isOpen || !track) return null;

  const isLossless =
    track.format === 'flac' ||
    track.format === 'wav' ||
    track.format === 'alac' ||
    track.format === 'aiff' ||
    (track.codec && /(flac|alac|pcm|wav)/i.test(track.codec));

  const sampleRate = track.sampleRate || 44100;
  const bitDepth = track.bitDepth || (isLossless && (track.format === 'flac' || track.format === 'wav') ? 16 : undefined);
  const isHiRes = (sampleRate >= 48000 && (bitDepth ?? 16) >= 24) || sampleRate >= 88200;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audio-format-info-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-16 px-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-secondary)]/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)]">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="audio-format-info-title"
                className="text-base font-bold text-[var(--text-primary)]"
              >
                Audio File Information
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Verified stream specs and hardware decoder resolution
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quality Banner */}
        <div className="p-5 bg-[var(--surface)]/40 border-b border-[var(--border)] flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[320px]">
              {track.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] truncate max-w-[320px]">
              {track.artist} &bull; {track.album || 'Unknown Album'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isHiRes && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Hi-Res Audio
              </span>
            )}
            {isLossless && !isHiRes && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Lossless
              </span>
            )}
            {!isLossless && (
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-[var(--surface-secondary)] text-[var(--text-secondary)] border border-[var(--border)]">
                {track.format?.toUpperCase() || 'Audio'}
              </span>
            )}
          </div>
        </div>

        {/* Specs Grid */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {/* Format & Codec */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[var(--accent)]" />
                Format / Codec
              </span>
              <p className="font-mono font-bold text-[var(--text-primary)] uppercase">
                {track.format || 'Unknown'} {track.codec ? `(${track.codec})` : ''}
              </p>
            </div>

            {/* Sample Rate */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-sky-400" />
                Sample Rate
              </span>
              <p className="font-mono font-bold text-[var(--text-primary)]">
                {sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : '44.1 kHz'}
              </p>
            </div>

            {/* Bit Depth */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-purple-400" />
                Bit Depth
              </span>
              <p className="font-mono font-bold text-[var(--text-primary)]">
                {bitDepth ? `${bitDepth}-bit` : isLossless ? '16-bit' : '16-bit (Lossy)'}
              </p>
            </div>

            {/* Bitrate */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-emerald-400" />
                Bitrate
              </span>
              <p className="font-mono font-bold text-[var(--text-primary)]">
                {track.bitrate ? `${track.bitrate} kbps` : isLossless ? 'Variable (Lossless)' : 'Standard'}
              </p>
            </div>

            {/* Channels */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <FileAudio className="w-3 h-3 text-amber-400" />
                Channels
              </span>
              <p className="font-mono font-bold text-[var(--text-primary)]">
                {track.channels ? (track.channels === 1 ? '1 (Mono)' : `${track.channels} (Stereo)`) : '2 (Stereo)'}
              </p>
            </div>

            {/* Duration */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-pink-400" />
                Duration
              </span>
              <p className="font-mono font-bold text-[var(--text-primary)]">
                {formatDuration(track.duration)}
              </p>
            </div>
          </div>

          {/* ReplayGain Info */}
          {(track.trackGain !== undefined || track.albumGain !== undefined) && (
            <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/40 border border-[var(--border-subtle)] text-xs flex items-center justify-between">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">ReplayGain Tags:</span>
              <div className="flex gap-3 font-mono text-[11px]">
                {track.trackGain !== undefined && (
                  <span>
                    Track: <b className="text-[var(--accent)]">{track.trackGain > 0 ? `+${track.trackGain}` : track.trackGain} dB</b>
                  </span>
                )}
                {track.albumGain !== undefined && (
                  <span>
                    Album: <b className="text-sky-400">{track.albumGain > 0 ? `+${track.albumGain}` : track.albumGain} dB</b>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* File Path & Storage */}
          <div className="p-3.5 rounded-xl bg-[var(--surface)]/70 border border-[var(--border-subtle)] space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-1.5">
                <HardDrive className="w-3 h-3 text-[var(--accent)]" />
                File Source
              </span>
              <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                {formatFileSize(track.fileSize)}
              </span>
            </div>
            <p className="font-mono text-[11px] text-[var(--text-secondary)] break-all select-text bg-[var(--surface-card)] p-2 rounded-lg border border-[var(--border-subtle)]">
              {track.path || track.playbackUrl || 'Local Audio Track'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t border-[var(--border)] bg-[var(--surface-secondary)]/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
            <Info className="w-3.5 h-3.5" />
            <span>Parsed offline directly from audio stream header</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

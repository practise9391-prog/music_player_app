import React from 'react';
import { YouTubeHistoryRecord } from '../../types';
import { X, Globe, HardDrive, Clock, CheckCircle, AlertTriangle, FileAudio } from 'lucide-react';

interface CacheDetailsModalProps {
  item: YouTubeHistoryRecord | null;
  onClose: () => void;
}

export const CacheDetailsModal: React.FC<CacheDetailsModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  const formatDate = (ts?: number) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleString();
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--surface-secondary)] text-[var(--accent)]">
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Track & Cache Details</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">Locally stored metadata and cache inspection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          {/* Metadata Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2.5">
            <div className="font-semibold text-sm text-[var(--text-primary)]">{item.title}</div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[var(--text-muted)]">Artist / Channel: </span>
                <span className="text-[var(--text-primary)]">{item.artist || item.channel || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Duration: </span>
                <span className="text-[var(--text-primary)]">{formatDuration(item.duration)}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Video ID: </span>
                <span className="font-mono text-[var(--text-primary)]">{item.youtube_video_id}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Play Count: </span>
                <span className="text-[var(--text-primary)]">{item.play_count}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">First Played: </span>
                <span className="text-[var(--text-primary)]">{formatDate(item.first_played_at)}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Last Played: </span>
                <span className="text-[var(--text-primary)]">{formatDate(item.last_played_at)}</span>
              </div>
            </div>
          </div>

          {/* Cache Card */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Cache Information</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  item.cache_status === 'CACHED'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}
              >
                {item.cache_status === 'CACHED' ? <CheckCircle className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                {item.cache_status}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div>
                <span className="text-[var(--text-muted)]">Cache File Path: </span>
                <span className="font-mono text-[10px] text-[var(--text-primary)] break-all">
                  {item.cache_path || 'None (Audio not cached)'}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Cache Size: </span>
                <span className="text-[var(--text-primary)]">{formatBytes(item.cache_size)}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Cached At: </span>
                <span className="text-[var(--text-primary)]">{formatDate(item.cache_created_at)}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Last Used / Touched: </span>
                <span className="text-[var(--text-primary)]">{formatDate(item.cache_last_used_at)}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Audio Codec: </span>
                <span className="uppercase text-[var(--text-primary)]">{item.codec || 'Opus / Compatible'}</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
            <strong>Offline Guarantee:</strong> When cached, playback utilizes the local file directly. No YouTube API or network requests are ever triggered.
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

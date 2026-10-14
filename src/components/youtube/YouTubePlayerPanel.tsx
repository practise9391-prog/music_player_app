import React, { useState } from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { useNetwork } from '../../network/NetworkContext';
import { YouTubeUrlValidator } from '../../services/youtube/YouTubeUrlValidator';
import {
  Globe,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  Loader2,
  Lock,
  Unlock,
  Radio,
  Music,
  Info,
  ShieldCheck,
  Download,
} from 'lucide-react';

export const YouTubePlayerPanel: React.FC = () => {
  const {
    onlinePlaybackState,
    playYouTubeUrl,
    endOnlineSession,
    currentTrack,
    state: engineState,
  } = usePlayer();
  const { networkState } = useNetwork();

  const [inputUrl, setInputUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [playlistNotice, setPlaylistNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputUrl(val);

    if (!val.trim()) {
      setValidationError(null);
      setPlaylistNotice(null);
      return;
    }

    const res = YouTubeUrlValidator.validate(val);
    if (!res.isValid) {
      setValidationError(res.errorMessage || 'Invalid YouTube URL');
      setPlaylistNotice(null);
    } else {
      setValidationError(null);
      if (res.isPlaylistIgnored) {
        setPlaylistNotice('Playlist detected: Will resolve single video only (playlist expansion disabled).');
      } else {
        setPlaylistNotice(null);
      }
    }
  };

  const handlePlayOnline = async (andCache = false) => {
    if (!inputUrl.trim()) return;

    const res = YouTubeUrlValidator.validate(inputUrl);
    if (!res.isValid) {
      setValidationError(res.errorMessage || 'Invalid URL');
      return;
    }

    setIsSubmitting(true);
    setValidationError(null);

    try {
      await playYouTubeUrl(inputUrl, andCache);
    } catch (err: any) {
      setValidationError(err?.message || 'Playback failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isResolving = onlinePlaybackState.status === 'resolving';
  const isBuffering = onlinePlaybackState.status === 'buffering';
  const isOnlineActive = networkState.status === 'ONLINE_PLAYBACK_ACTIVE' || isResolving;
  const isPlayingOnline = currentTrack?.source === 'online';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Network Status Badge */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isOnlineActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
            }`}
          >
            {isOnlineActive ? <Globe className="w-4 h-4 animate-pulse" /> : <Lock className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {networkState.status === 'ONLINE_PLAYBACK_ACTIVE'
                ? '🌐 Online Playback Active'
                : networkState.status === 'RESOLVING'
                ? '⏳ Resolving YouTube Stream...'
                : '🔒 Internet Off (Network Locked)'}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              {isOnlineActive
                ? 'Temporary session permits current media endpoint only.'
                : 'All background connections, telemetry, and tracking blocked.'}
            </div>
          </div>
        </div>

        {isOnlineActive && (
          <button
            onClick={endOnlineSession}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors flex items-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-current" /> End Online Session
          </button>
        )}
      </div>

      {/* URL Input Box */}
      <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Radio className="w-4 h-4 text-[var(--accent)]" /> Play YouTube Audio On-Demand
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Paste a YouTube video link. Network access activates only for this audio session.
          </p>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              value={inputUrl}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handlePlayOnline();
              }}
              className="w-full px-4 py-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors pr-48"
            />
            <div className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1.5">
              <button
                onClick={() => handlePlayOnline(false)}
                disabled={isSubmitting || isResolving || !inputUrl.trim()}
                className="h-full px-3 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                title="Stream without caching"
              >
                {isSubmitting || isResolving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Stream</span>
              </button>

              <button
                onClick={() => handlePlayOnline(true)}
                disabled={isSubmitting || isResolving || !inputUrl.trim()}
                className="h-full px-3.5 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                title="Stream and cache for offline replay"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Play & Cache</span>
              </button>
            </div>
          </div>

          {validationError && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {playlistNotice && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 mt-1">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>{playlistNotice}</span>
            </div>
          )}
        </div>

        {/* Security & Isolation Summary */}
        <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] flex items-start gap-2.5 text-[11px] text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-[var(--text-primary)]">Strict Application-Level Network Policy</div>
            <div>
              Network access is isolated to this specific video stream. No background searches, no recommendation queries,
              and no credentials or telemetry are transmitted.
            </div>
          </div>
        </div>
      </div>

      {/* Active Online Playback Details Card */}
      {isPlayingOnline && currentTrack && (
        <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Active Online Stream
            </span>
            <span className="text-xs font-mono text-[var(--text-muted)]">
              ID: {currentTrack.sourceId || 'Unknown'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {currentTrack.coverArtUrl ? (
              <img
                src={currentTrack.coverArtUrl}
                alt="Thumbnail"
                className="w-16 h-16 rounded-xl object-cover shadow-lg border border-[var(--border)]"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center">
                <Music className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                {currentTrack.title}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {currentTrack.sourceChannel || currentTrack.artist}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {currentTrack.format?.toUpperCase() || 'OPUS'}
                </span>
                {currentTrack.bitrate && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-secondary)]">
                    {currentTrack.bitrate} kbps
                  </span>
                )}
                {currentTrack.sampleRate && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-secondary)]">
                    {(currentTrack.sampleRate / 1000).toFixed(1)} kHz
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Real Stream Buffering Progress */}
          <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
            <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
              <span>Stream Buffer</span>
              <span className="font-mono">{onlinePlaybackState.bufferedPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-[var(--surface-secondary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${onlinePlaybackState.bufferedPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

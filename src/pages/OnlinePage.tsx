import React, { useState, useEffect } from 'react';
import { YouTubePlayerPanel } from '../components/youtube/YouTubePlayerPanel';
import { WifiOff, ShieldCheck, Globe, Info, Radio, Sparkles } from 'lucide-react';
import { useNetwork } from '../network/NetworkContext';

interface OnlinePageProps {
  onOpenNetworkModal?: () => void;
}

export const OnlinePage: React.FC<OnlinePageProps> = () => {
  const { networkState } = useNetwork();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 sm:space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Globe className="w-3.5 h-3.5" />
          <span>Online Music Discovery</span>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)]">
          Online Audio Gateway &amp; Streaming
        </h1>
        <p className="text-xs md:text-sm text-[var(--text-secondary)]">
          Separate discovery space for online music. Stream on-demand, cache tracks for offline replay, and protect your privacy with zero background tracking.
        </p>
      </div>

      {/* Offline Status Warning Banner if device is offline */}
      {!isOnline && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
          <WifiOff className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-amber-200">Device is Offline</h4>
            <p className="text-amber-300/90 leading-relaxed">
              No internet connection is detected. Online search and live streams require an active connection. Your local music library, cached songs, and playlists are 100% playable right now without any data.
            </p>
          </div>
        </div>
      )}

      {/* Distinction Explainer Banner */}
      <div className="p-3.5 rounded-xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-secondary)] flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-[var(--text-primary)]">Isolated &amp; Clean:</strong> Online activity never uploads or modifies your local device music.
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
          <span>AIR-GAP PROTECTED</span>
        </div>
      </div>

      <YouTubePlayerPanel />
    </div>
  );
};

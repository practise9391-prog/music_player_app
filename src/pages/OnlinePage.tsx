import React from 'react';
import { YouTubePlayerPanel } from '../components/youtube/YouTubePlayerPanel';

interface OnlinePageProps {
  onOpenNetworkModal: () => void;
}

export const OnlinePage: React.FC<OnlinePageProps> = () => {
  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Online YouTube Audio Gateway</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Zero-telemetry on-demand YouTube audio playback. Network remains locked unless an explicit session is active.
        </p>
      </div>

      <YouTubePlayerPanel />
    </div>
  );
};

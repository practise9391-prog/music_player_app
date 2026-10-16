import React from 'react';
import { YouTubePlayerPanel } from '../components/youtube/YouTubePlayerPanel';
import { Globe } from 'lucide-react';

interface OnlinePageProps {
  onOpenNetworkModal?: () => void;
}

export const OnlinePage: React.FC<OnlinePageProps> = () => {
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 max-w-4xl mx-auto select-none">
      <YouTubePlayerPanel />
    </div>
  );
};

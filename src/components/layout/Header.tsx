import React from 'react';
import { Search, Lock, Unlock, Terminal, Sliders, Shield, Mic, ArrowLeft, Home } from 'lucide-react';
import { useNetwork } from '../../network/NetworkContext';
import { useSettings } from '../../settings/SettingsContext';

interface HeaderProps {
  currentRoute?: string;
  title: string;
  onOpenNetworkModal: () => void;
  onOpenDebugModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSearchModal?: () => void;
  onOpenIdentifyModal?: () => void;
  canGoBack?: boolean;
  onBack?: () => void;
  onNavigateHome?: () => void;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRoute,
  title,
  onOpenNetworkModal,
  onOpenDebugModal,
  searchQuery,
  onSearchChange,
  onOpenSearchModal,
  onOpenIdentifyModal,
  canGoBack,
  onBack,
  onNavigateHome,
  onToggleSidebar,
}) => {
  const { networkState } = useNetwork();
  const { settings, updateSettings } = useSettings();

  const toggleDevMode = () => {
    updateSettings({ debugModeEnabled: !settings.debugModeEnabled });
  };

  return (
    <header className="h-14 md:h-16 px-2.5 sm:px-4 md:px-6 bg-[var(--background)]/85 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between gap-1.5 sm:gap-3 md:gap-4 select-none shrink-0">
      {/* Route Title & Search */}
      <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 max-w-xl min-w-0">
        {/* Navigation Buttons: Back button (if available) and persistent direct Home button */}
        <div className="flex items-center gap-1 shrink-0">
          {canGoBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors flex items-center justify-center active:scale-90"
              title="Go Back"
              aria-label="Go Back"
            >
              <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateHome?.();
            }}
            className={`p-1.5 sm:p-2 rounded-xl transition-all flex items-center justify-center active:scale-95 ${
              currentRoute === 'home'
                ? 'bg-[var(--surface-secondary)] text-[var(--accent)] ring-1 ring-[var(--accent)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
            }`}
            title="Home"
            aria-label="Home"
            aria-current={currentRoute === 'home' ? 'page' : undefined}
          >
            <Home className={`w-5 h-5 ${currentRoute === 'home' ? 'text-[var(--accent)]' : ''}`} />
          </button>
        </div>

        <h2 className="hidden sm:block text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] capitalize shrink-0 tracking-tight">
          {title}
        </h2>

        {/* Global Search Bar with Search Icon and Mic (matching reference) */}
        <div
          className="relative flex-1 cursor-pointer min-w-0"
          onClick={onOpenSearchModal}
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            readOnly={Boolean(onOpenSearchModal)}
            placeholder="Search songs, playlists, and artists"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-10 py-1.5 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer truncate shadow-inner"
          />
          {onOpenIdentifyModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenIdentifyModal();
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent)] p-1 rounded-full transition-colors flex items-center gap-1"
              title="Song Radar / Speech"
            >
              <span className="text-[var(--border)] text-xs">|</span>
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right: Clean Header Actions */}
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Song Identifier (Shazam) */}
        {onOpenIdentifyModal && (
          <button
            onClick={onOpenIdentifyModal}
            className="flex items-center gap-1.5 px-2.5 py-1 md:py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Identify Ambient Song (Acoustic Radar)"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Identify</span>
          </button>
        )}
      </div>
    </header>
  );
};

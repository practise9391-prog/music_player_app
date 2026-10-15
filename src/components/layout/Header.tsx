import React from 'react';
import { Search, Lock, Unlock, Terminal, Sliders, Shield, Mic, ArrowLeft } from 'lucide-react';
import { useNetwork } from '../../network/NetworkContext';
import { useSettings } from '../../settings/SettingsContext';

interface HeaderProps {
  title: string;
  onOpenNetworkModal: () => void;
  onOpenDebugModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSearchModal?: () => void;
  onOpenIdentifyModal?: () => void;
  canGoBack?: boolean;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenNetworkModal,
  onOpenDebugModal,
  searchQuery,
  onSearchChange,
  onOpenSearchModal,
  onOpenIdentifyModal,
  canGoBack,
  onBack,
}) => {
  const { networkState } = useNetwork();
  const { settings, updateSettings } = useSettings();

  const toggleDevMode = () => {
    updateSettings({ debugModeEnabled: !settings.debugModeEnabled });
  };

  return (
    <header className="h-14 md:h-16 px-2.5 sm:px-4 md:px-6 bg-[var(--background)]/85 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between gap-1.5 sm:gap-3 md:gap-4 select-none shrink-0">
      {/* Route Title & Search */}
      <div className="flex items-center gap-1.5 sm:gap-3 md:gap-6 flex-1 max-w-xl min-w-0">
        {canGoBack && (
          <button
            onClick={onBack}
            className="p-1.5 -ml-1 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--text-primary)] transition-colors flex items-center justify-center shrink-0 active:scale-90"
            title="Go Back"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
          </button>
        )}

        <h2 className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] capitalize shrink-0 tracking-tight">
          {title}
        </h2>

        {/* Global Search Bar (Ctrl+K ready) */}
        <div
          className="relative flex-1 cursor-pointer min-w-0"
          onClick={onOpenSearchModal}
        >
          <Search className="w-3.5 h-3.5 md:w-4 md:h-4 absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            readOnly={Boolean(onOpenSearchModal)}
            placeholder="Search music..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 md:pl-9 pr-3 md:pr-12 py-1 md:py-1.5 rounded-[var(--radius)] bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer truncate"
          />
          <kbd className="hidden md:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Network Status Indicator & Dev Mode Toggle */}
      <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
        {/* Network State Badge (Section 3) */}
        <button
          onClick={onOpenNetworkModal}
          className={`flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-full border text-[11px] md:text-xs font-semibold transition-all ${
            networkState.isAirGapped
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
          }`}
          title="Click to view Network Air-Gap settings"
        >
          {networkState.isAirGapped ? (
            <>
              <Lock className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>● <span className="hidden sm:inline">OFFLINE (LOCKED)</span><span className="sm:hidden">OFFLINE</span></span>
            </>
          ) : (
            <>
              <Unlock className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span>● <span className="hidden sm:inline">ONLINE</span><span className="sm:hidden">ONLINE</span></span>
            </>
          )}
        </button>

        {/* Song Identifier (Shazam) */}
        {onOpenIdentifyModal && (
          <button
            onClick={onOpenIdentifyModal}
            className="flex items-center gap-1.5 px-2 md:px-2.5 py-1 md:py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Identify Ambient Song (Acoustic Radar)"
          >
            <Mic className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Identify</span>
          </button>
        )}

        {/* Developer Telemetry Button */}
        <button
          onClick={onOpenDebugModal}
          className="p-2 rounded-[var(--radius)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] border border-transparent hover:border-[var(--border)] transition-colors"
          title="Open Audio & Engine Telemetry"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

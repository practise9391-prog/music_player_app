import React from 'react';
import { Search, Lock, Unlock, Terminal, Sliders, Shield } from 'lucide-react';
import { useNetwork } from '../../network/NetworkContext';
import { useSettings } from '../../settings/SettingsContext';

interface HeaderProps {
  title: string;
  onOpenNetworkModal: () => void;
  onOpenDebugModal: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenSearchModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onOpenNetworkModal,
  onOpenDebugModal,
  searchQuery,
  onSearchChange,
  onOpenSearchModal,
}) => {
  const { networkState } = useNetwork();
  const { settings, updateSettings } = useSettings();

  const toggleDevMode = () => {
    updateSettings({ debugModeEnabled: !settings.debugModeEnabled });
  };

  return (
    <header className="h-16 px-6 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--border)] flex items-center justify-between gap-4 select-none shrink-0">
      {/* Route Title & Search */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <h2 className="text-lg font-bold text-[var(--text-primary)] capitalize shrink-0 tracking-tight">
          {title}
        </h2>

        {/* Global Search Bar (Ctrl+K ready) */}
        <div
          className="relative flex-1 cursor-pointer"
          onClick={onOpenSearchModal}
        >
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            readOnly={Boolean(onOpenSearchModal)}
            placeholder="Search library, artists, history... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-12 py-1.5 rounded-[var(--radius)] bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Network Status Indicator & Dev Mode Toggle */}
      <div className="flex items-center gap-3">
        {/* Network State Badge (Section 3) */}
        <button
          onClick={onOpenNetworkModal}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
            networkState.isAirGapped
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
          }`}
          title="Click to view Network Air-Gap settings"
        >
          {networkState.isAirGapped ? (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>● OFFLINE (LOCKED)</span>
            </>
          ) : (
            <>
              <Unlock className="w-3.5 h-3.5" />
              <span>● ONLINE — USER REQUESTED</span>
            </>
          )}
        </button>

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

import React from 'react';
import { Home, Music2, ListMusic, Download, Settings, Globe } from 'lucide-react';
import { NavRoute } from './Sidebar';

interface MobileBottomNavProps {
  currentRoute: NavRoute;
  onNavigate: (route: NavRoute) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentRoute,
  onNavigate,
}) => {
  const tabs: {
    route: NavRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { route: 'home', label: 'Home', icon: Home },
    { route: 'library', label: 'Library', icon: Music2 },
    { route: 'playlists', label: 'Playlists', icon: ListMusic },
    { route: 'downloads', label: 'Downloads', icon: Download },
    { route: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden w-full bg-[var(--surface)]/95 backdrop-blur-lg border-t border-[var(--border)] px-2 py-1.5 flex items-center justify-around z-40 select-none pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentRoute === tab.route;
        return (
          <button
            key={tab.route}
            onClick={() => onNavigate(tab.route)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive
                ? 'text-[var(--accent)] font-semibold scale-105'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--accent)] stroke-[2.5]' : ''}`} />
            <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};


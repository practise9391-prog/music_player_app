import React, { useEffect, useState } from 'react';
import {
  Home,
  Music2,
  ListMusic,
  History,
  Heart,
  Globe,
  Settings,
  Lock,
  Unlock,
  Disc3,
  Shield,
  Plus,
  Sparkles,
  Clock,
  Flame,
  Download,
} from 'lucide-react';
import { useNetwork } from '../../network/NetworkContext';
import { PlaylistRecord } from '../../types';
import { PlaylistRepository } from '../../database/repository';

export type NavRoute =
  | 'home'
  | 'library'
  | 'playlists'
  | 'history'
  | 'favorites'
  | 'online'
  | 'downloads'
  | 'settings';

interface SidebarProps {
  currentRoute: NavRoute;
  selectedPlaylistId?: string | null;
  onNavigate: (route: NavRoute, playlistId?: string) => void;
  onOpenNetworkModal: () => void;
  onCreatePlaylist?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRoute,
  selectedPlaylistId,
  onNavigate,
  onOpenNetworkModal,
  onCreatePlaylist,
}) => {
  const { networkState } = useNetwork();
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);

  const loadPlaylists = async () => {
    try {
      const list = await PlaylistRepository.getAll();
      setPlaylists(list);
    } catch (err) {
      console.warn('Failed to load sidebar playlists:', err);
    }
  };

  useEffect(() => {
    loadPlaylists();

    const handlePlaylistsUpdated = () => {
      loadPlaylists();
    };

    window.addEventListener('nova-playlists-updated', handlePlaylistsUpdated);
    return () => {
      window.removeEventListener('nova-playlists-updated', handlePlaylistsUpdated);
    };
  }, []);

  const navItems: {
    route: NavRoute;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { route: 'home', label: 'Home', icon: Home },
    { route: 'library', label: 'Library', icon: Music2 },
    { route: 'playlists', label: 'Playlists', icon: ListMusic },
    { route: 'history', label: 'History', icon: History },
    { route: 'favorites', label: 'Favorites', icon: Heart },
    { route: 'online', label: 'Online Media', icon: Globe },
    { route: 'downloads', label: 'Downloads', icon: Download },
    { route: 'settings', label: 'Settings', icon: Settings },
  ];

  const getPlaylistIcon = (type: PlaylistRecord['type']) => {
    switch (type) {
      case 'favorites':
        return Heart;
      case 'smart':
        return Sparkles;
      case 'recently_played':
        return Clock;
      case 'most_played':
        return Flame;
      default:
        return ListMusic;
    }
  };

  return (
    <aside className="w-64 h-full bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col justify-between p-4 shrink-0 select-none overflow-hidden">
      <div className="flex flex-col min-h-0 flex-1 space-y-5">
        {/* App Logo & Header */}
        <div className="flex items-center gap-3 px-2 py-1 shrink-0">
          <div className="w-9 h-9 rounded-xl btn-primary flex items-center justify-center shadow-md">
            <Disc3 className="w-5 h-5 text-[var(--btn-text)]" />
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-[var(--text-primary)]">
              NOVA MUSIC
            </h1>
            <p className="text-[10px] tracking-widest text-[var(--text-muted)] uppercase font-mono">
              OFFLINE AUDIO
            </p>
          </div>
        </div>

        {/* Primary Library Navigation */}
        <div className="shrink-0 space-y-1">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            LIBRARY
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentRoute === item.route && (!selectedPlaylistId || item.route !== 'playlists');
              return (
                <button
                  key={item.route}
                  onClick={() => onNavigate(item.route)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-[var(--radius)] text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-[var(--surface-secondary)] text-[var(--accent)] font-semibold border border-[var(--border)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Playlists Section (Part 8, Section 6) */}
        <div className="flex-1 min-h-0 flex flex-col pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center justify-between px-3 pb-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              PLAYLISTS
            </span>
            <button
              onClick={() => {
                if (onCreatePlaylist) {
                  onCreatePlaylist();
                } else {
                  onNavigate('playlists');
                }
              }}
              className="p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface-secondary)] transition-colors"
              title="Create Playlist"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable Playlists List */}
          <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
            {playlists.length === 0 ? (
              <button
                onClick={() => onNavigate('playlists')}
                className="w-full text-left px-3 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--surface)] transition-colors flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Create Playlist</span>
              </button>
            ) : (
              playlists.map((pl) => {
                const Icon = getPlaylistIcon(pl.type);
                const isSelected = currentRoute === 'playlists' && selectedPlaylistId === pl.id;

                return (
                  <button
                    key={pl.id}
                    onClick={() => onNavigate('playlists', pl.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all group ${
                      isSelected
                        ? 'bg-[var(--surface-secondary)] text-[var(--accent)] font-semibold border border-[var(--border)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                    }`}
                    title={pl.name}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected
                            ? 'text-[var(--accent)]'
                            : pl.type === 'favorites'
                            ? 'text-rose-400'
                            : pl.type === 'smart'
                            ? 'text-amber-400'
                            : 'text-[var(--text-muted)] group-hover:text-[var(--accent)]'
                        }`}
                      />
                      <span className="truncate text-left">{pl.name}</span>
                    </div>
                    {pl.songCount !== undefined && pl.songCount > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono ml-1 shrink-0">
                        {pl.songCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Network Air-Gap Privacy Card (Section 4) */}
      <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)] shrink-0">
        <div
          onClick={onOpenNetworkModal}
          className={`p-3 rounded-xl border transition-all cursor-pointer group ${
            networkState.isAirGapped
              ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
              : 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/50'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              NETWORK SECURITY
            </span>
            {networkState.isAirGapped ? (
              <Lock className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            ) : (
              <Unlock className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
            )}
          </div>
          <div className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
            {networkState.isAirGapped ? 'Air-Gap Locked' : 'Online Permitted'}
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
            {networkState.isAirGapped ? 'Internet access: BLOCKED' : 'Connected on-demand'}
          </div>
        </div>

        <div className="px-2 text-[11px] text-[var(--text-muted)] flex items-center justify-between font-mono">
          <span>v1.0.0 (Part 8)</span>
          <span className="flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-400" />
            <span>Zero Telemetry</span>
          </span>
        </div>
      </div>
    </aside>
  );
};

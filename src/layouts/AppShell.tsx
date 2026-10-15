import React, { useState, useEffect } from 'react';
import { Sidebar, NavRoute } from '../components/layout/Sidebar';
import { MobileBottomNav } from '../components/layout/MobileBottomNav';
import { Header } from '../components/layout/Header';
import { MiniPlayer } from '../components/player/MiniPlayer';
import { FullPlayerModal } from '../components/player/FullPlayerModal';
import { QueueDrawer } from '../components/player/QueueDrawer';
import { AudioProcessingModal } from '../components/audio/AudioProcessingModal';
import { SpatialAudioModal } from '../components/spatial/SpatialAudioModal';
import { FullscreenVisualizerModal } from '../components/visualizer/FullscreenVisualizerModal';
import { NetworkLockModal } from '../components/modals/NetworkLockModal';
import { DebugModal } from '../components/modals/DebugModal';
import { ToastContainer } from '../components/ui/ToastContainer';
import { QueuedOnlineTrackModal } from '../components/youtube/QueuedOnlineTrackModal';
import { AudioOutputModal } from '../components/audio/AudioOutputModal';
import { StoragePermissionModal } from '../components/modals/StoragePermissionModal';
import { WidgetPreviewModal } from '../components/widgets/WidgetPreviewModal';
import { SongIdentifierModal } from '../components/audio/SongIdentifierModal';
import { deepLinkManagerInstance } from '../services/navigation/DeepLinkManager';
import { usePlayer } from '../player/PlayerContext';
import { nativeBridge } from '../services/nativeBridge';
import { FolderRepository, TrackRepository } from '../database/repository';
import { notificationService } from '../services/errorService';
import { FolderScanner } from '../library/folderScanner';
import { useSettings } from '../settings/SettingsContext';
import { appLockServiceInstance } from '../services/security/AppLockService';
import { AppLockModal } from '../components/security/AppLockModal';
import { FirstLaunchModal } from '../components/onboarding/FirstLaunchModal';
import { InstallAppBanner } from '../components/common/InstallAppBanner';

// Pages
import { HomePage } from '../pages/HomePage';
import { LibraryPage } from '../pages/LibraryPage';
import { PlaylistsPage } from '../pages/PlaylistsPage';
import { HistoryPage } from '../pages/HistoryPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { OnlinePage } from '../pages/OnlinePage';
import { DownloadsPage } from '../pages/DownloadsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { GlobalSearchModal } from '../components/search/GlobalSearchModal';

import { backNavigationService } from '../services/navigation/BackNavigationService';

export const AppShell: React.FC = () => {
  const [currentRoute, setCurrentRoute] = useState<NavRoute>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);

  const {
    togglePlayPause,
    seek,
    state: playerState,
    setMute,
    isFullPlayerOpen,
    setIsFullPlayerOpen,
    isQueueOpen,
    setIsQueueOpen,
    isDspModalOpen,
    setIsDspModalOpen,
    isSpatialModalOpen,
    setIsSpatialModalOpen,
    isFullscreenVisualizerOpen,
    setIsFullscreenVisualizerOpen,
    isAudioOutputModalOpen,
    setIsAudioOutputModalOpen,
    isStoragePermissionModalOpen,
    setIsStoragePermissionModalOpen,
    isWidgetPreviewModalOpen,
    setIsWidgetPreviewModalOpen,
  } = usePlayer();

  const { settings } = useSettings();
  const [isAppLocked, setIsAppLocked] = useState(false);

  // App Lock initialization & background relock evaluation (Part 20)
  useEffect(() => {
    if (settings.appLockEnabled && settings.appLockPinHash) {
      appLockServiceInstance.lock();
    }

    const unsubscribe = appLockServiceInstance.subscribe(setIsAppLocked);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        appLockServiceInstance.recordActivity();
      } else {
        if (settings.appLockEnabled && settings.appLockPinHash) {
          appLockServiceInstance.evaluateBackgroundLock(settings.appLockTimeoutMinutes || 0);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.appLockEnabled, settings.appLockPinHash, settings.appLockTimeoutMinutes]);

  // UI Shortcuts (Full player and search focus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsFullPlayerOpen(!isFullPlayerOpen);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullPlayerOpen, setIsFullPlayerOpen]);

  // Handle internal deep links & launcher shortcuts (Part 16)
  useEffect(() => {
    deepLinkManagerInstance.setActionHandler((action) => {
      if (action.type === 'route' && action.route) {
        setCurrentRoute(action.route as NavRoute);
      } else if (action.type === 'search') {
        if (action.query) {
          setSearchQuery(action.query);
        }
        setIsGlobalSearchOpen(true);
      } else if (action.type === 'nowplaying') {
        setIsFullPlayerOpen(true);
      }
    });
  }, [setIsFullPlayerOpen]);

  // Track route history for back button navigation
  useEffect(() => {
    backNavigationService.pushRoute(currentRoute);
  }, [currentRoute]);

  // Register all modal & drawer back handlers in priority order
  useEffect(() => {
    const unregisterIdentify = isIdentifyModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsIdentifyModalOpen(false);
          return true;
        })
      : null;

    const unregisterSearch = isGlobalSearchOpen
      ? backNavigationService.registerHandler(() => {
          setIsGlobalSearchOpen(false);
          return true;
        })
      : null;

    const unregisterNetwork = isNetworkModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsNetworkModalOpen(false);
          return true;
        })
      : null;

    const unregisterDebug = isDebugModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsDebugModalOpen(false);
          return true;
        })
      : null;

    const unregisterAudioOutput = isAudioOutputModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsAudioOutputModalOpen(false);
          return true;
        })
      : null;

    const unregisterStoragePerm = isStoragePermissionModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsStoragePermissionModalOpen(false);
          return true;
        })
      : null;

    const unregisterWidgetPrev = isWidgetPreviewModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsWidgetPreviewModalOpen(false);
          return true;
        })
      : null;

    const unregisterVisualizer = isFullscreenVisualizerOpen
      ? backNavigationService.registerHandler(() => {
          setIsFullscreenVisualizerOpen(false);
          return true;
        })
      : null;

    const unregisterSpatial = isSpatialModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsSpatialModalOpen(false);
          return true;
        })
      : null;

    const unregisterDsp = isDspModalOpen
      ? backNavigationService.registerHandler(() => {
          setIsDspModalOpen(false);
          return true;
        })
      : null;

    const unregisterQueue = isQueueOpen
      ? backNavigationService.registerHandler(() => {
          setIsQueueOpen(false);
          return true;
        })
      : null;

    const unregisterFullPlayer = isFullPlayerOpen
      ? backNavigationService.registerHandler(() => {
          setIsFullPlayerOpen(false);
          return true;
        })
      : null;

    const unregisterPlaylistSelect = selectedPlaylistId
      ? backNavigationService.registerHandler(() => {
          setSelectedPlaylistId(null);
          return true;
        })
      : null;

    return () => {
      unregisterIdentify?.();
      unregisterSearch?.();
      unregisterNetwork?.();
      unregisterDebug?.();
      unregisterAudioOutput?.();
      unregisterStoragePerm?.();
      unregisterWidgetPrev?.();
      unregisterVisualizer?.();
      unregisterSpatial?.();
      unregisterDsp?.();
      unregisterQueue?.();
      unregisterFullPlayer?.();
      unregisterPlaylistSelect?.();
    };
  }, [
    isIdentifyModalOpen,
    isGlobalSearchOpen,
    isNetworkModalOpen,
    isDebugModalOpen,
    isAudioOutputModalOpen,
    isStoragePermissionModalOpen,
    isWidgetPreviewModalOpen,
    isFullscreenVisualizerOpen,
    isSpatialModalOpen,
    isDspModalOpen,
    isQueueOpen,
    isFullPlayerOpen,
    selectedPlaylistId,
    setIsFullPlayerOpen,
    setIsQueueOpen,
    setIsDspModalOpen,
    setIsSpatialModalOpen,
    setIsFullscreenVisualizerOpen,
    setIsAudioOutputModalOpen,
    setIsStoragePermissionModalOpen,
    setIsWidgetPreviewModalOpen,
  ]);

  const handleGoBack = () => {
    backNavigationService.triggerBack((targetRoute) => {
      setCurrentRoute(targetRoute as NavRoute);
    });
  };

  // Handler for adding a music folder directly from Home page
  const handleOpenMusicFolder = async () => {
    const res = await nativeBridge.pickDirectoryFiles();
    if (res) {
      const { folderPath, files } = res;
      await FolderRepository.addFolder(folderPath);
      await FolderScanner.scanFiles(folderPath, files);
      notificationService.success('Folder Indexed', `Indexed ${files.length} files in "${folderPath}"`);
      setCurrentRoute('library');
    }
  };

  // Handler for importing files from Home page
  const handleAddMusicFiles = async () => {
    const files = await nativeBridge.openFileDialog();
    if (files.length > 0) {
      const folderName = 'Direct Imports';
      await FolderRepository.addFolder(folderName);
      await FolderScanner.scanFiles(folderName, files);
      notificationService.success('Files Added', `Imported ${files.length} track(s).`);
      setCurrentRoute('library');
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      {/* Top Application Body (Sidebar + Content) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar
          currentRoute={currentRoute}
          selectedPlaylistId={selectedPlaylistId}
          onNavigate={(r, pId) => {
            setCurrentRoute(r);
            setSelectedPlaylistId(pId || null);
          }}
          onOpenNetworkModal={() => setIsNetworkModalOpen(true)}
          onCreatePlaylist={() => {
            setSelectedPlaylistId(null);
            setCurrentRoute('playlists');
          }}
        />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--background)] overflow-hidden">
          <Header
            title={selectedPlaylistId ? 'Playlist' : currentRoute}
            canGoBack={currentRoute !== 'home' || Boolean(selectedPlaylistId)}
            onBack={handleGoBack}
            onOpenNetworkModal={() => setIsNetworkModalOpen(true)}
            onOpenDebugModal={() => setIsDebugModalOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenSearchModal={() => setIsGlobalSearchOpen(true)}
            onOpenIdentifyModal={() => setIsIdentifyModalOpen(true)}
          />

          <div className="flex-1 flex overflow-hidden">
            {currentRoute === 'home' && (
              <HomePage
                onOpenFolder={handleOpenMusicFolder}
                onAddMusic={handleAddMusicFiles}
                onNavigateToOnline={() => setCurrentRoute('online')}
                onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
                onNavigate={(r, pId) => {
                  setCurrentRoute(r);
                  setSelectedPlaylistId(pId || null);
                }}
                onOpenSearchModal={() => setIsGlobalSearchOpen(true)}
                onOpenIdentifyModal={() => setIsIdentifyModalOpen(true)}
                searchQuery={searchQuery}
              />
            )}
            {currentRoute === 'library' && <LibraryPage />}
            {currentRoute === 'playlists' && (
              <PlaylistsPage
                initialPlaylistId={selectedPlaylistId}
                onClearInitialId={() => setSelectedPlaylistId(null)}
              />
            )}
            {currentRoute === 'history' && <HistoryPage />}
            {currentRoute === 'favorites' && <FavoritesPage />}
            {currentRoute === 'online' && (
              <OnlinePage onOpenNetworkModal={() => setIsNetworkModalOpen(true)} />
            )}
            {currentRoute === 'downloads' && <DownloadsPage />}
            {currentRoute === 'settings' && <SettingsPage />}
          </div>
        </main>
      </div>

      {/* Persistent Mini Player at Bottom */}
      <MiniPlayer />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentRoute={currentRoute}
        onNavigate={(r) => {
          setSelectedPlaylistId(null);
          setCurrentRoute(r);
        }}
        onOpenSearch={() => setIsGlobalSearchOpen(true)}
      />

      {/* Full Player Modal */}
      <FullPlayerModal />

      {/* Queue Drawer */}
      <QueueDrawer />

      {/* Audio Studio & Equalizer DSP Modal */}
      <AudioProcessingModal />

      {/* Spatial Audio & 3D Acoustics Studio Modal */}
      <SpatialAudioModal />

      {/* Fullscreen Audio Visualizer */}
      <FullscreenVisualizerModal />

      {/* Air-Gap Network Lock Modal */}
      <NetworkLockModal
        isOpen={isNetworkModalOpen}
        onClose={() => setIsNetworkModalOpen(false)}
      />

      {/* Developer Debug Telemetry Modal */}
      <DebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
      />

      {/* Queued Online YouTube Track Permission Prompt */}
      <QueuedOnlineTrackModal />

      {/* Global Search Modal (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
      />

      {/* Audio Output Route Modal (Part 15) */}
      <AudioOutputModal
        isOpen={isAudioOutputModalOpen}
        onClose={() => setIsAudioOutputModalOpen(false)}
      />

      {/* Storage Permission Onboarding Modal (Part 16) */}
      <StoragePermissionModal
        isOpen={isStoragePermissionModalOpen}
        onClose={() => setIsStoragePermissionModalOpen(false)}
        onPermissionGranted={() => {}}
      />

      {/* Home Screen Widget Simulator Modal (Part 16) */}
      <WidgetPreviewModal
        isOpen={isWidgetPreviewModalOpen}
        onClose={() => setIsWidgetPreviewModalOpen(false)}
      />

      {/* Shazam Song Identifier Modal */}
      <SongIdentifierModal
        isOpen={isIdentifyModalOpen}
        onClose={() => setIsIdentifyModalOpen(false)}
      />

      {/* App Lock Screen Protection Modal (Part 20) */}
      <AppLockModal
        isOpen={isAppLocked && settings.appLockEnabled && Boolean(settings.appLockPinHash)}
        onUnlocked={() => appLockServiceInstance.unlock()}
      />

      {/* First-Launch Welcome Onboarding Modal (Part 22) */}
      <FirstLaunchModal
        isOpen={!settings.firstLaunchCompleted}
        onComplete={() => {}}
      />

      {/* Standalone PWA Mobile Install Banner */}
      <InstallAppBanner />

      {/* Central Notification Toasts */}
      <ToastContainer />
    </div>
  );
};

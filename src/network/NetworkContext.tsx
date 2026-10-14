import React, { createContext, useContext, useEffect, useState } from 'react';
import { NetworkState } from '../types';
import { NetworkAccessManager } from './NetworkAccessManager';

interface NetworkContextType {
  networkState: NetworkState;
  setLock: (locked: boolean) => void;
  grantTemporaryAccess: (durationMs?: number) => void;
  revokeTemporaryAccess: () => void;
  endOnlineSession: () => void;
  startOnlineSession: (url: string, videoId: string) => string;
  isLocked: boolean;
  isOnlineActive: boolean;
}

const NetworkContext = createContext<NetworkContextType | null>(null);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkState, setNetworkState] = useState<NetworkState>(NetworkAccessManager.getState());

  useEffect(() => {
    const unsubscribe = NetworkAccessManager.subscribe((state) => {
      setNetworkState(state);
    });
    return unsubscribe;
  }, []);

  const setLock = (locked: boolean) => {
    NetworkAccessManager.setLock(locked);
  };

  const grantTemporaryAccess = (durationMs = 5 * 60 * 1000) => {
    NetworkAccessManager.grantTemporaryAccess(durationMs);
  };

  const revokeTemporaryAccess = () => {
    NetworkAccessManager.revokeTemporaryAccess();
  };

  const endOnlineSession = () => {
    NetworkAccessManager.endOnlineSession();
  };

  const startOnlineSession = (url: string, videoId: string) => {
    return NetworkAccessManager.startOnlineSession(url, videoId);
  };

  return (
    <NetworkContext.Provider
      value={{
        networkState,
        setLock,
        grantTemporaryAccess,
        revokeTemporaryAccess,
        endOnlineSession,
        startOnlineSession,
        isLocked: networkState.isAirGapped,
        isOnlineActive: networkState.status === 'ONLINE_PLAYBACK_ACTIVE' || networkState.status === 'RESOLVING',
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

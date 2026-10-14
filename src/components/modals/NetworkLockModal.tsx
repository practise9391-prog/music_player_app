import React from 'react';
import { useNetwork } from '../../network/NetworkContext';
import { Button } from '../ui/Button';
import { ShieldAlert, ShieldCheck, Lock, Unlock, X, Clock, WifiOff } from 'lucide-react';
import { notificationService } from '../../services/errorService';

interface NetworkLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingOperation?: string;
  onAllowOperation?: () => void;
}

export const NetworkLockModal: React.FC<NetworkLockModalProps> = ({
  isOpen,
  onClose,
  pendingOperation,
  onAllowOperation,
}) => {
  const { networkState, setLock, grantTemporaryAccess } = useNetwork();

  if (!isOpen) return null;

  const handleGrantTemporary = () => {
    grantTemporaryAccess(10 * 60 * 1000); // 10 minutes
    notificationService.success(
      'Network Access Granted',
      'Temporary internet access enabled for 10 minutes.'
    );
    if (onAllowOperation) {
      onAllowOperation();
    }
    onClose();
  };

  const handleToggleLock = () => {
    const next = !networkState.isAirGapped;
    setLock(next);
    if (next) {
      notificationService.info('Network Locked', 'Air-Gap barrier re-engaged. All online access is blocked.');
    } else {
      notificationService.warning('Network Unlocked', 'Internet access is currently permitted.');
      if (onAllowOperation) {
        onAllowOperation();
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`p-3 rounded-xl ${
              networkState.isAirGapped
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {networkState.isAirGapped ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">
              {networkState.isAirGapped ? 'Air-Gap Network Locked' : 'Network Unlocked'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">Offline-First Privacy Barrier</p>
          </div>
        </div>

        {pendingOperation && (
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Explicit Online Request:</span> "{pendingOperation}" requires internet
              access to fetch the requested audio source.
            </div>
          </div>
        )}

        <div className="space-y-3 mb-6 text-sm text-[var(--text-secondary)] bg-[var(--surface)] p-3.5 rounded-xl border border-[var(--border-subtle)]">
          <div className="flex justify-between items-center text-xs">
            <span>Air-Gap Protection:</span>
            <span className="font-mono font-semibold text-[var(--text-primary)]">
              {networkState.isAirGapped ? 'ACTIVE (Zero Leak)' : 'INACTIVE'}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span>Current Network Status:</span>
            <span
              className={`font-semibold flex items-center gap-1.5 ${
                networkState.isAirGapped ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  networkState.isAirGapped ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              {networkState.status}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span>Active Connections:</span>
            <span className="font-mono text-[var(--text-primary)]">{networkState.activeConnections}</span>
          </div>
        </div>

        <div className="space-y-2">
          {networkState.isAirGapped ? (
            <>
              <Button
                variant="primary"
                className="w-full"
                icon={<Clock className="w-4 h-4" />}
                onClick={handleGrantTemporary}
              >
                Enable Temporarily (10 mins)
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                icon={<Unlock className="w-4 h-4" />}
                onClick={handleToggleLock}
              >
                Unlock Air-Gap Indefinitely
              </Button>
            </>
          ) : (
            <Button
              variant="danger"
              className="w-full"
              icon={<Lock className="w-4 h-4" />}
              onClick={handleToggleLock}
            >
              Lock Network (Enable Air-Gap)
            </Button>
          )}

          <Button variant="ghost" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

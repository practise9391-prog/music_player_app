import React, { useState, useEffect } from 'react';
import { Lock, Fingerprint, Delete, Play, Pause, AlertCircle, Shield } from 'lucide-react';
import { appLockServiceInstance } from '../../services/security/AppLockService';
import { useSettings } from '../../settings/SettingsContext';
import { usePlayer } from '../../player/PlayerContext';

interface AppLockModalProps {
  isOpen: boolean;
  onUnlocked: () => void;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({ isOpen, onUnlocked }) => {
  const { settings } = useSettings();
  const { currentTrack, state: playerState, togglePlayPause } = usePlayer();
  const isPlaying = playerState.status === 'playing';
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lockoutSecs, setLockoutSecs] = useState<number>(0);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState(false);

  useEffect(() => {
    appLockServiceInstance.isBiometricsAvailable().then(setIsBiometricsAvailable);
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      const remaining = appLockServiceInstance.getLockoutRemainingSeconds();
      setLockoutSecs(remaining);
      if (remaining === 0 && error?.includes('Too many attempts')) {
        setError(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, error]);

  // Reset PIN when modal opens
  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(null);
    }
  }, [isOpen]);

  const handleKeyPress = async (digit: string) => {
    if (lockoutSecs > 0) return;
    if (pin.length >= 6) return;

    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    // Auto verify if 4 or 6 digits
    if (nextPin.length === 4) {
      const success = await appLockServiceInstance.verifyPin(
        nextPin,
        settings.appLockPinHash,
        settings.appLockPinSalt
      );
      if (success) {
        setPin('');
        onUnlocked();
      } else {
        const remaining = appLockServiceInstance.getLockoutRemainingSeconds();
        if (remaining > 0) {
          setError(`Too many attempts. Locked out for ${remaining}s`);
        } else {
          setError('Incorrect PIN. Please try again.');
          setPin('');
        }
      }
    }
  };

  const handleBackspace = () => {
    if (lockoutSecs > 0) return;
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleClear = () => {
    if (lockoutSecs > 0) return;
    setPin('');
    setError(null);
  };

  const handleBiometrics = async () => {
    if (lockoutSecs > 0) return;
    const success = await appLockServiceInstance.authenticateBiometrics();
    if (success) {
      onUnlocked();
    } else {
      setError('Biometric authentication failed.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-between p-6 bg-[var(--background)]/95 backdrop-blur-2xl select-none animate-fade-in text-[var(--text-primary)]">
      {/* Top Branding */}
      <div className="flex flex-col items-center space-y-2 pt-6">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center shadow-lg shadow-[var(--accent)]/10 ring-1 ring-[var(--accent)]/30">
          <Lock className="w-8 h-8 text-[var(--accent)] animate-pulse" />
        </div>
        <h2 className="text-xl font-black tracking-wide text-[var(--text-primary)]">Nova Music</h2>
        <p className="text-xs text-[var(--text-secondary)] font-medium">Application Locked</p>
      </div>

      {/* Center PIN Pad */}
      <div className="w-full max-w-xs flex flex-col items-center space-y-6">
        {/* PIN Indicators */}
        <div className="flex items-center justify-center gap-4 py-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-[var(--accent)] border-[var(--accent)] scale-110 shadow-sm shadow-[var(--accent)]/50'
                  : 'bg-transparent border-[var(--border)]'
              }`}
            />
          ))}
        </div>

        {/* Error / Lockout Feedback */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs text-center animate-shake">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              disabled={lockoutSecs > 0}
              className="h-16 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] active:scale-95 border border-[var(--border)] text-xl font-bold text-[var(--text-primary)] transition-all flex items-center justify-center shadow-sm disabled:opacity-40"
            >
              {digit}
            </button>
          ))}

          {/* Biometrics or Clear */}
          {settings.appLockBiometricsEnabled && isBiometricsAvailable ? (
            <button
              onClick={handleBiometrics}
              disabled={lockoutSecs > 0}
              title="Unlock with Biometrics"
              className="h-16 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] active:scale-95 border border-[var(--border)] text-[var(--accent)] transition-all flex items-center justify-center disabled:opacity-40"
            >
              <Fingerprint className="w-6 h-6" />
            </button>
          ) : (
            <button
              onClick={handleClear}
              disabled={lockoutSecs > 0 || pin.length === 0}
              className="h-16 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] active:scale-95 border border-[var(--border)] text-xs font-semibold text-[var(--text-muted)] transition-all flex items-center justify-center disabled:opacity-30"
            >
              Clear
            </button>
          )}

          <button
            onClick={() => handleKeyPress('0')}
            disabled={lockoutSecs > 0}
            className="h-16 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] active:scale-95 border border-[var(--border)] text-xl font-bold text-[var(--text-primary)] transition-all flex items-center justify-center shadow-sm disabled:opacity-40"
          >
            0
          </button>

          <button
            onClick={handleBackspace}
            disabled={lockoutSecs > 0 || pin.length === 0}
            className="h-16 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] active:scale-95 border border-[var(--border)] text-[var(--text-muted)] transition-all flex items-center justify-center disabled:opacity-30"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Emergency Playback Control (Keeps playback active & controllable without unlocking) */}
      <div className="w-full max-w-sm pt-4">
        {currentTrack ? (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-card)]/80 border border-[var(--border)] backdrop-blur-md shadow-md">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {currentTrack.title}
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] truncate">
                  {currentTrack.artist}
                </div>
              </div>
            </div>
            <button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-xl bg-[var(--accent)] text-black flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-center text-[var(--text-muted)]">
            Single audio engine active &bull; Offline security guarantee
          </p>
        )}
      </div>
    </div>
  );
};

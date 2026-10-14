import React, { useState } from 'react';
import { Shield, Check, X, KeyRound, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { appLockServiceInstance } from '../../services/security/AppLockService';
import { useSettings } from '../../settings/SettingsContext';
import { notificationService } from '../../services/errorService';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'setup' | 'change' | 'disable';
}

export const PinSetupModal: React.FC<PinSetupModalProps> = ({ isOpen, onClose, mode }) => {
  const { settings, updateSettings } = useSettings();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'verify_current' | 'enter_new' | 'confirm_new'>(
    mode === 'setup' ? 'enter_new' : 'verify_current'
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleVerifyCurrent = async () => {
    if (currentPin.length < 4) {
      setError('Please enter your 4-digit current PIN.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const isValid = await appLockServiceInstance.verifyPin(
        currentPin,
        settings.appLockPinHash,
        settings.appLockPinSalt
      );
      if (isValid) {
        if (mode === 'disable') {
          await updateSettings({
            appLockEnabled: false,
            appLockPinHash: '',
            appLockPinSalt: '',
          });
          notificationService.info('App Lock Disabled', 'PIN protection has been removed.');
          onClose();
        } else {
          setStep('enter_new');
        }
      } else {
        setError('Incorrect current PIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEnterNew = () => {
    if (newPin.length !== 4) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    setError(null);
    setStep('confirm_new');
  };

  const handleConfirmNew = async () => {
    if (confirmPin !== newPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { pinHash, pinSalt } = await appLockServiceInstance.setupPin(newPin);
      await updateSettings({
        appLockEnabled: true,
        appLockPinHash: pinHash,
        appLockPinSalt: pinSalt,
      });
      notificationService.success(
        mode === 'change' ? 'PIN Changed' : 'App Lock Enabled',
        'Your 4-digit PIN has been cryptographically secured.'
      );
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save PIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl p-6 space-y-5 text-[var(--text-primary)]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                {mode === 'setup'
                  ? 'Set App Lock PIN'
                  : mode === 'change'
                  ? 'Change App Lock PIN'
                  : 'Disable App Lock'}
              </h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                {step === 'verify_current'
                  ? 'Enter your current PIN to authenticate'
                  : step === 'enter_new'
                  ? 'Enter a new 4-digit PIN'
                  : 'Re-enter your 4-digit PIN to confirm'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content based on step */}
        {step === 'verify_current' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Current PIN
              </label>
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest text-2xl font-mono py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="••••"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={currentPin.length < 4 || loading}
                onClick={handleVerifyCurrent}
              >
                {loading ? 'Verifying...' : mode === 'disable' ? 'Confirm Disable' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {step === 'enter_new' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                New 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest text-2xl font-mono py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="••••"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={newPin.length !== 4}
                onClick={handleEnterNew}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 'confirm_new' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Confirm 4-Digit PIN
              </label>
              <input
                type="password"
                maxLength={4}
                autoFocus
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center tracking-widest text-2xl font-mono py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)]"
                placeholder="••••"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('enter_new')}>
                Back
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={confirmPin.length !== 4 || loading}
                onClick={handleConfirmNew}
              >
                {loading ? 'Saving...' : 'Save PIN'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


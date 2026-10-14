import React, { useState } from 'react';
import { Shield, Music, Check, X, AlertCircle, Settings } from 'lucide-react';
import { androidBridgeInstance, AndroidPermissionStatus } from '../../services/android/AndroidBridge';

interface StoragePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted: () => void;
}

export const StoragePermissionModal: React.FC<StoragePermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
}) => {
  const [status, setStatus] = useState<AndroidPermissionStatus>('denied');
  const [isRequesting, setIsRequesting] = useState(false);

  if (!isOpen) return null;

  const permissionName = androidBridgeInstance.getRequiredAudioPermissionName();
  const isModernAndroid = androidBridgeInstance.getAndroidApiLevel() >= 33;

  const handleRequest = async () => {
    setIsRequesting(true);
    try {
      const res = await androidBridgeInstance.requestStoragePermission();
      setStatus(res);
      if (res === 'granted') {
        onPermissionGranted();
        onClose();
      }
    } catch {
      setStatus('denied');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleOpenSettings = () => {
    androidBridgeInstance.openSystemSettings();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5 text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Music Storage Access</h2>
              <p className="text-xs text-neutral-400">Android MediaStore Integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Explanation */}
        <div className="space-y-3 text-sm">
          <p className="text-neutral-300 leading-relaxed">
            Nova Music Player needs permission to read audio files from your device to discover and play your local music library.
          </p>

          <div className="p-3.5 rounded-xl bg-neutral-800/60 border border-neutral-700/60 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-cyan-400 font-medium">
              <Music className="w-4 h-4 shrink-0" />
              <span>Permission Requested:</span>
            </div>
            <code className="block p-1.5 rounded bg-black/40 text-neutral-300 font-mono text-[11px]">
              {permissionName}
            </code>
            <p className="text-neutral-400 text-[11px]">
              {isModernAndroid
                ? 'Targets audio files exclusively (Android 13+). Does not request photos, videos, or full file management.'
                : 'Targets external storage audio files on Android 12 and older.'}
            </p>
          </div>

          {status === 'permanently_denied' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Access Permanently Denied</p>
                <p className="text-[11px] text-amber-300/80">
                  Please enable Music/Audio permissions manually in Android System Settings for Nova Music.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            Not Now
          </button>

          {status === 'permanently_denied' ? (
            <button
              onClick={handleOpenSettings}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1.5 transition"
            >
              <Settings className="w-3.5 h-3.5" />
              Open App Settings
            </button>
          ) : (
            <button
              onClick={handleRequest}
              disabled={isRequesting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-400 hover:bg-cyan-300 text-neutral-950 flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              {isRequesting ? 'Requesting...' : 'Grant Access'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


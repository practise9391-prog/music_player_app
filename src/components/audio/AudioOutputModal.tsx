import React, { useState, useEffect } from 'react';
import { Volume2, Headphones, Bluetooth, Disc, Check, X, Smartphone } from 'lucide-react';
import { OutputDeviceInfo } from '../../types';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { audioRouteManagerInstance } from '../../services/audio/AudioRouteManager';

interface AudioOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioOutputModal: React.FC<AudioOutputModalProps> = ({ isOpen, onClose }) => {
  const [devices, setDevices] = useState<OutputDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>('default');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadDevices();
    }
  }, [isOpen]);

  const loadDevices = async () => {
    setIsLoading(true);
    try {
      const detailed = await audioEngineInstance.getDetailedOutputDevices();
      setDevices(detailed);
      const active = detailed.find((d) => d.isActive)?.deviceId || audioRouteManagerInstance.getActiveDeviceId();
      setActiveDeviceId(active);
    } catch (err) {
      console.warn('Failed to load output devices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDevice = async (deviceId: string) => {
    try {
      const ok = await audioRouteManagerInstance.switchOutputDevice(deviceId);
      if (ok) {
        setActiveDeviceId(deviceId);
        await loadDevices();
      }
    } catch (err) {
      console.warn('Failed to switch audio route:', err);
    }
  };

  if (!isOpen) return null;

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'bluetooth':
        return <Bluetooth className="w-5 h-5 text-cyan-400" />;
      case 'headphones':
      case 'headphone':
        return <Headphones className="w-5 h-5 text-indigo-400" />;
      case 'usb':
      case 'usb_dac':
        return <Disc className="w-5 h-5 text-purple-400" />;
      case 'speaker':
      default:
        return <Smartphone className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full sm:max-w-md bg-neutral-900 border border-neutral-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Audio Output Route</h2>
              <p className="text-xs text-neutral-400">Select playback destination</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close output route selector"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Device List */}
        <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-neutral-400 animate-pulse">
              Detecting audio devices...
            </div>
          ) : devices.length === 0 ? (
            <div className="py-8 text-center text-neutral-400 text-sm">
              <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Standard Device Audio (Platform Default)
            </div>
          ) : (
            devices.map((device) => {
              const isSelected = device.deviceId === activeDeviceId || device.isActive;
              return (
                <button
                  key={device.deviceId}
                  onClick={() => handleSelectDevice(device.deviceId)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-200'
                      : 'bg-neutral-800/40 border-neutral-800/80 hover:bg-neutral-800 hover:border-neutral-700 text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-neutral-800/80">
                      {getDeviceIcon(device.type)}
                    </div>
                    <div>
                      <div className="text-sm font-medium line-clamp-1">
                        {device.label || 'Audio Device'}
                      </div>
                      <div className="text-xs text-neutral-400 capitalize">
                        {device.type} {device.isDefault ? '• System Default' : ''}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center text-black shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-500">
          <span>Seamless route switching</span>
          <button
            onClick={loadDevices}
            className="text-cyan-400 hover:underline hover:text-cyan-300"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

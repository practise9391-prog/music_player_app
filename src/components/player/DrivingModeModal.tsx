import React from 'react';
import { Play, Pause, SkipBack, SkipForward, RotateCcw, RotateCw, X, Volume2, Car } from 'lucide-react';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { useTranslation } from '../../services/i18n/I18nService';
import { Track } from '../../types';

interface DrivingModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
  isPlaying: boolean;
  onTogglePlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
}

export const DrivingModeModal: React.FC<DrivingModeModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  isPlaying,
  onTogglePlayPause,
  onNext,
  onPrev,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between p-6 select-none animate-fade-in">
      {/* Top Bar with Exit */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold tracking-wider uppercase">
          <Car className="w-4 h-4" />
          <span>{t('player.driving_mode')}</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-base transition-colors"
        >
          <X className="w-5 h-5 text-rose-400" />
          <span>Exit Driving</span>
        </button>
      </div>

      {/* Middle Track Info */}
      <div className="text-center my-auto px-4">
        <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight line-clamp-2 mb-3">
          {currentTrack?.title || 'No Track Selected'}
        </h1>
        <p className="text-xl md:text-2xl font-bold text-amber-400 line-clamp-1">
          {currentTrack?.artist || 'Unknown Artist'}
        </p>
        {currentTrack?.album && (
          <p className="text-sm font-semibold text-slate-500 mt-2">
            {currentTrack.album}
          </p>
        )}
      </div>

      {/* Bottom Mega Playback Controls */}
      <div className="space-y-6 max-w-xl mx-auto w-full">
        {/* Quick 10s Skips */}
        <div className="flex justify-center items-center gap-8 text-slate-400">
          <button
            onClick={() => audioEngineInstance.seek(Math.max(0, audioEngineInstance.getPosition() - 10))}
            className="flex items-center gap-2 p-3 rounded-xl hover:bg-slate-900 active:scale-95 transition-all text-slate-300 font-bold"
          >
            <RotateCcw className="w-6 h-6 text-amber-400" />
            <span className="text-sm">-10s</span>
          </button>
          <button
            onClick={() => audioEngineInstance.seek(audioEngineInstance.getPosition() + 10)}
            className="flex items-center gap-2 p-3 rounded-xl hover:bg-slate-900 active:scale-95 transition-all text-slate-300 font-bold"
          >
            <span className="text-sm">+10s</span>
            <RotateCw className="w-6 h-6 text-amber-400" />
          </button>
        </div>

        {/* Big Buttons */}
        <div className="flex items-center justify-around gap-4">
          <button
            onClick={onPrev}
            aria-label="Previous Track"
            className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-slate-900 active:bg-slate-800 border-2 border-slate-800 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg"
          >
            <SkipBack className="w-10 h-10 md:w-12 md:h-12" />
          </button>

          <button
            onClick={onTogglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 flex items-center justify-center transition-all shadow-2xl shadow-amber-500/40"
          >
            {isPlaying ? (
              <Pause className="w-12 h-12 md:w-16 md:h-16 fill-current" />
            ) : (
              <Play className="w-12 h-12 md:w-16 md:h-16 fill-current ml-2" />
            )}
          </button>

          <button
            onClick={onNext}
            aria-label="Next Track"
            className="w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-slate-900 active:bg-slate-800 border-2 border-slate-800 flex items-center justify-center text-white active:scale-95 transition-all shadow-lg"
          >
            <SkipForward className="w-10 h-10 md:w-12 md:h-12" />
          </button>
        </div>
      </div>
    </div>
  );
};


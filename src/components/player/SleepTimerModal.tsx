import React, { useState, useEffect } from 'react';
import { Clock, X, Moon, Volume2, ListEnd, Music, Check } from 'lucide-react';
import { sleepTimerService, SleepTimerState } from '../../services/playback/SleepTimerService';
import { useTranslation } from '../../services/i18n/I18nService';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [timerState, setTimerState] = useState<SleepTimerState>(sleepTimerService.getState());
  const [customMinutes, setCustomMinutes] = useState<string>('30');
  const [fadeOutSec, setFadeOutSec] = useState<number>(15);

  useEffect(() => {
    const unsub = sleepTimerService.subscribe((s) => setTimerState(s));
    return unsub;
  }, []);

  if (!isOpen) return null;

  const presets = [5, 10, 15, 20, 30, 45, 60, 90];

  const handleStartPreset = (minutes: number) => {
    sleepTimerService.startDurationTimer(minutes, fadeOutSec);
  };

  const handleStartCustom = () => {
    const m = parseInt(customMinutes, 10);
    if (!isNaN(m) && m > 0) {
      sleepTimerService.startDurationTimer(m, fadeOutSec);
    }
  };

  const formatRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('sleep_timer.title')}</h2>
              <p className="text-xs text-slate-400">
                {timerState.isActive
                  ? t('sleep_timer.remaining', {
                      time:
                        timerState.mode === 'duration'
                          ? formatRemaining(timerState.remainingSeconds)
                          : timerState.mode === 'end_of_track'
                          ? t('sleep_timer.end_of_track')
                          : t('sleep_timer.end_of_queue'),
                    })
                  : 'Turn off playback automatically'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Timer Indicator */}
        {timerState.isActive && (
          <div className="mt-4 p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-indigo-400 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-white">
                  {timerState.mode === 'duration'
                    ? formatRemaining(timerState.remainingSeconds)
                    : timerState.mode === 'end_of_track'
                    ? 'At song end'
                    : 'At queue end'}
                </p>
                {timerState.isFadingOut && (
                  <p className="text-xs text-amber-400 font-medium">Fading volume down smoothly...</p>
                )}
              </div>
            </div>
            <button
              onClick={() => sleepTimerService.cancel()}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition-colors"
            >
              {t('sleep_timer.off')}
            </button>
          </div>
        )}

        {/* Duration Presets */}
        <div className="mt-5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Quick Durations
          </label>
          <div className="grid grid-cols-4 gap-2">
            {presets.map((mins) => {
              const isSelected =
                timerState.isActive &&
                timerState.mode === 'duration' &&
                timerState.durationMinutes === mins;
              return (
                <button
                  key={mins}
                  onClick={() => handleStartPreset(mins)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/50'
                  }`}
                >
                  {mins}m
                </button>
              );
            })}
          </div>
        </div>

        {/* Track / Queue End Options */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => sleepTimerService.startEndOfTrackTimer(fadeOutSec)}
            className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
              timerState.isActive && timerState.mode === 'end_of_track'
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Music className="w-4 h-4 text-indigo-400" />
            <span>{t('sleep_timer.end_of_track')}</span>
          </button>
          <button
            onClick={() => sleepTimerService.startEndOfQueueTimer(fadeOutSec)}
            className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
              timerState.isActive && timerState.mode === 'end_of_queue'
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <ListEnd className="w-4 h-4 text-indigo-400" />
            <span>{t('sleep_timer.end_of_queue')}</span>
          </button>
        </div>

        {/* Custom duration */}
        <div className="mt-4 flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="600"
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value)}
            placeholder="Custom mins"
            className="flex-1 px-3 py-2 text-sm bg-slate-800/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleStartCustom}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-colors"
          >
            Set Custom
          </button>
        </div>

        {/* Fade Out Slider */}
        <div className="mt-5 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              {t('sleep_timer.fade_out')}
            </span>
            <span className="font-semibold text-slate-300">{fadeOutSec}s</span>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            step="5"
            value={fadeOutSec}
            onChange={(e) => setFadeOutSec(parseInt(e.target.value, 10))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        {/* Done Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-indigo-600/20"
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    </div>
  );
};


import React from 'react';
import { ShieldCheck, Music2, Sparkles, Languages, ArrowRight } from 'lucide-react';
import { useSettings } from '../../settings/SettingsContext';
import { useTranslation } from '../../services/i18n/I18nService';
import { SupportedLanguage } from '../../services/i18n/translations';

interface FirstLaunchModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const FirstLaunchModal: React.FC<FirstLaunchModalProps> = ({ isOpen, onComplete }) => {
  const { updateSettings } = useSettings();
  const { language, setLanguage, t } = useTranslation();

  if (!isOpen) return null;

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setLanguage(lang);
    updateSettings({ language: lang });
  };

  const handleFinish = () => {
    updateSettings({ firstLaunchCompleted: true });
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 md:p-8 overflow-hidden">
        {/* Top Logo / Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-cyan-500/25 mb-4">
            <Music2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Welcome to Nova Music</h1>
          <p className="text-sm text-slate-400 mt-1 max-w-sm">
            Your studio-grade, offline-first personal music player.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="mt-6 space-y-3">
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">100% Offline & Private</p>
              <p className="text-xs text-slate-400">
                Air-gapped by default. Zero analytics, zero trackers, and zero background telemetry.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-800/50 border border-slate-700/50">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Studio DSP & Spatial Audio</p>
              <p className="text-xs text-slate-400">
                10-band equalizer, bass boost, Dolby sound profiles, and multi-channel room spatializer.
              </p>
            </div>
          </div>
        </div>

        {/* Language Selection */}
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <Languages className="w-4 h-4 text-cyan-400" />
            <span>Select App Language / భాష / भाषा</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { code: 'en', label: 'English' },
              { code: 'te', label: 'తెలుగు' },
              { code: 'hi', label: 'हिन्दी' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => handleLanguageChange(l.code as SupportedLanguage)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  language === l.code
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Get Started Button */}
        <div className="mt-8">
          <button
            onClick={handleFinish}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 text-white font-bold text-base transition-all shadow-xl shadow-cyan-500/25"
          >
            <span>Start Listening</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import { Music2, Play } from 'lucide-react';

interface OpeningSplashProps {
  onFinish?: () => void;
}

export const OpeningSplash: React.FC<OpeningSplashProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);

  useEffect(() => {
    const t2 = setTimeout(() => setPhase(2), 500);
    const t3 = setTimeout(() => setPhase(3), 1000);
    const t4 = setTimeout(() => setPhase(4), 1500);

    // Start fade-out at 2.3s, finish at 2.7s
    const timerFade = setTimeout(() => {
      setIsFading(true);
    }, 2300);

    const timerDismiss = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 2700);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(timerFade);
      clearTimeout(timerDismiss);
    };
  }, [onFinish]);

  if (!isVisible) return null;

  return (
    <div
      onClick={() => {
        setIsFading(true);
        setTimeout(() => {
          setIsVisible(false);
          onFinish?.();
        }, 200);
      }}
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-500 cursor-pointer ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #171C32 0%, #0D1020 50%, #090B14 100%)',
      }}
    >
      {/* PHASE 1: Concentric Neon Ripples (Panels 1-2) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={`w-[520px] h-[520px] rounded-full border border-purple-500/20 transition-all duration-1000 ${
            phase >= 1 ? 'scale-100 opacity-30 animate-pulse' : 'scale-50 opacity-0'
          }`}
        />
        <div
          className={`absolute w-[400px] h-[400px] rounded-full border border-cyan-400/25 transition-all duration-700 ${
            phase >= 2 ? 'scale-100 opacity-40' : 'scale-75 opacity-0'
          }`}
        />
        <div
          className={`absolute w-[280px] h-[280px] rounded-full border border-pink-500/30 transition-all duration-700 ${
            phase >= 3 ? 'scale-100 opacity-50' : 'scale-90 opacity-0'
          }`}
        />
      </div>

      {/* PHASE 2 & 3: Glowing Note & Soundwave Equalizer (Panels 2-3) */}
      <div className="relative z-10 flex flex-col items-center space-y-6">
        <div className="relative flex items-center justify-center">
          {/* Ambient Glow */}
          <div
            className={`absolute w-36 h-36 rounded-full bg-gradient-to-tr from-purple-600 via-pink-600 to-cyan-400 blur-2xl transition-opacity duration-700 ${
              phase >= 2 ? 'opacity-70 animate-pulse' : 'opacity-0'
            }`}
          />

          {/* Central Circular Music Emblem */}
          <div
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-[#101426] via-[#171C32] to-[#101426] border-2 border-purple-400/50 flex items-center justify-center shadow-[0_0_50px_rgba(139,92,246,0.6)] transition-all duration-700 ${
              phase >= 2 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
            }`}
          >
            <Music2 className="w-14 h-14 text-transparent fill-purple-400 stroke-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
          </div>
        </div>

        {/* PHASE 3: Soundwaves Equalizer */}
        <div
          className={`flex items-end gap-1.5 h-8 transition-opacity duration-500 ${
            phase >= 3 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {[35, 75, 100, 60, 90, 50, 85, 100, 70, 45, 80, 55].map((h, i) => (
            <div
              key={i}
              className="w-1.5 bg-gradient-to-t from-purple-500 via-pink-500 to-cyan-400 rounded-full animate-pulse"
              style={{
                height: `${h}%`,
                animationDelay: `${i * 80}ms`,
                animationDuration: '600ms',
              }}
            />
          ))}
        </div>

        {/* PHASE 4: TuneVibe Brand Logo Reveal & Tagline (Panel 4) */}
        <div
          className={`text-center space-y-2 transition-all duration-700 transform ${
            phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <h1 className="text-3xl sm:text-4xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 drop-shadow-[0_0_25px_rgba(168,85,247,0.5)]">
            TuneVibe
          </h1>
          <p className="text-xs sm:text-sm font-bold tracking-widest text-purple-300 uppercase">
            Feel Every Beat
          </p>
        </div>
      </div>
    </div>
  );
};

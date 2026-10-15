import React, { useState, useEffect } from 'react';

interface OpeningSplashProps {
  onFinish?: () => void;
}

export const OpeningSplash: React.FC<OpeningSplashProps> = ({ onFinish }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Start fade-out after 1.4s, completely unmount after 1.8s
    const timerFade = setTimeout(() => {
      setIsFading(true);
    }, 1400);

    const timerDismiss = setTimeout(() => {
      setIsVisible(false);
      onFinish?.();
    }, 1800);

    return () => {
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
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none overflow-hidden transition-opacity duration-500 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{
        background: 'radial-gradient(circle at center, #240b36 0%, #10061d 60%, #06020c 100%)',
      }}
    >
      {/* Radiant Atmospheric Pulse Rings */}
      <div className="absolute w-[450px] h-[450px] rounded-full border border-purple-500/20 animate-ping opacity-25 pointer-events-none" />
      <div className="absolute w-[320px] h-[320px] rounded-full border border-pink-500/25 animate-pulse opacity-40 pointer-events-none" />

      {/* Center 3D Realistic Icon with Elastic Glow Animation */}
      <div className="relative z-10 flex flex-col items-center space-y-6">
        <div className="relative animate-bounce-subtle">
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full shadow-[0_0_50px_rgba(168,85,247,0.5)] border-2 border-purple-500/40 p-1 bg-black/40 backdrop-blur-md">
            <img
              src="/icon.png"
              alt="SoundFlow App Icon"
              className="w-full h-full object-contain drop-shadow-2xl animate-spin-slow"
            />
          </div>

          {/* Glowing Ambient Core */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600/30 via-pink-600/30 to-cyan-500/30 blur-xl -z-10 animate-pulse" />
        </div>

        {/* Brand Title with Gradient Glow */}
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl md:text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400">
            SOUNDFLOW
          </h1>
          <p className="text-xs font-semibold tracking-widest text-purple-300/70 uppercase">
            Pure Music • Zero Telemetry
          </p>
        </div>

        {/* Bouncing Acoustic Visualizer Bars */}
        <div className="flex items-end gap-1.5 h-6 pt-2">
          {[40, 75, 100, 60, 90, 45, 80, 100, 70, 50].map((h, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-full animate-pulse"
              style={{
                height: `${h}%`,
                animationDelay: `${i * 100}ms`,
                animationDuration: '600ms',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};


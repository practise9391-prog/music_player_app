import React, { useState, useEffect } from 'react';
import {
  X,
  Mic,
  Music2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Heart,
  Search,
  ArrowLeft,
} from 'lucide-react';
import {
  songIdentificationService,
  RecognitionState,
  IdentifiedSong,
} from '../../services/audio/SongIdentificationService';
import { usePlayer } from '../../player/PlayerContext';
import { Button } from '../ui/Button';

interface SongIdentifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToOnline?: (query: string) => void;
}

export const SongIdentifierModal: React.FC<SongIdentifierModalProps> = ({
  isOpen,
  onClose,
  onNavigateToOnline,
}) => {
  const { playTrack, toggleFavorite } = usePlayer();
  const [state, setState] = useState<RecognitionState>('idle');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [result, setResult] = useState<IdentifiedSong | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      songIdentificationService.stop();
      setState('idle');
      setResult(null);
      setErrorMessage(null);
      return;
    }

    const unsubscribe = songIdentificationService.subscribe({
      onStateChange: (s) => setState(s),
      onAudioLevel: (lvl) => setAudioLevel(lvl),
      onResult: (res) => setResult(res),
      onError: (err) => setErrorMessage(err),
    });

    return () => {
      unsubscribe();
      songIdentificationService.stop();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartListening = () => {
    setErrorMessage(null);
    songIdentificationService.startListening();
  };

  const handlePlayResult = async () => {
    if (result?.matchedLocalTrack) {
      await playTrack(result.matchedLocalTrack);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden p-6 text-center space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold transition-all active:scale-95 border border-slate-700"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Identify Song</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Central Radar / Button */}
        <div className="py-4 flex flex-col items-center justify-center relative">
          {/* Radar Ripple Waves */}
          {state === 'listening' && (
            <>
              <div
                className="absolute w-44 h-44 rounded-full bg-cyan-500/10 border border-cyan-500/20 animate-ping"
                style={{ animationDuration: '2.5s' }}
              />
              <div
                className="absolute w-36 h-36 rounded-full bg-cyan-500/20 border border-cyan-500/30 transition-transform duration-75"
                style={{ transform: `scale(${1 + audioLevel * 1.5})` }}
              />
            </>
          )}

          {/* Main Action Button */}
          <button
            onClick={state === 'listening' ? () => songIdentificationService.stop() : handleStartListening}
            disabled={state === 'analyzing'}
            className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl ${
              state === 'listening'
                ? 'bg-gradient-to-tr from-cyan-400 to-blue-600 text-white shadow-cyan-500/50 scale-105'
                : state === 'analyzing'
                ? 'bg-slate-800 text-cyan-400 animate-pulse'
                : state === 'success'
                ? 'bg-emerald-500 text-white shadow-emerald-500/40'
                : 'bg-gradient-to-tr from-cyan-500 to-indigo-600 text-white shadow-cyan-500/30 hover:scale-105'
            }`}
          >
            {state === 'listening' ? (
              <Mic className="w-12 h-12 animate-bounce" />
            ) : state === 'analyzing' ? (
              <Sparkles className="w-12 h-12 animate-spin" />
            ) : state === 'success' ? (
              <CheckCircle2 className="w-12 h-12" />
            ) : (
              <Mic className="w-12 h-12" />
            )}
          </button>

          {/* Status Label */}
          <div className="mt-5 space-y-1">
            <h3 className="text-base font-bold text-white">
              {state === 'idle' && 'Tap to Identify Song'}
              {state === 'requesting_permission' && 'Requesting Microphone Access...'}
              {state === 'listening' && 'Listening to Ambient Audio...'}
              {state === 'analyzing' && 'Analyzing Audio Waveform...'}
              {state === 'success' && 'Song Identified!'}
              {state === 'not_found' && 'No Match Found'}
              {state === 'error' && 'Recognition Error'}
            </h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {state === 'idle' && 'Hold your phone near the music source for 4-5 seconds.'}
              {state === 'listening' && 'Capturing acoustic peaks and frequency patterns...'}
              {state === 'analyzing' && 'Matching acoustic fingerprint against library and catalog...'}
              {state === 'success' && 'High-confidence acoustic match detected.'}
              {state === 'not_found' && 'Could not match this track. Try closer to the speaker.'}
              {state === 'error' && (errorMessage || 'Please check microphone permissions in Android Settings.')}
            </p>
          </div>
        </div>

        {/* Result Card */}
        {state === 'success' && result && (
          <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700/80 text-left flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                {result.coverArtUrl ? (
                  <img src={result.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <Music2 className="w-6 h-6 text-cyan-400" />
                )}
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">{result.title}</h4>
                <p className="text-xs text-slate-300 truncate">{result.artist}</p>
                {result.album && <p className="text-[10px] text-slate-400 truncate">{result.album}</p>}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {result.matchedLocalTrack && (
                <button
                  onClick={handlePlayResult}
                  className="p-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center justify-center shadow-lg transition-colors"
                  title="Play Now"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-center gap-3">
          {state === 'success' || state === 'not_found' || state === 'error' ? (
            <Button variant="secondary" size="sm" onClick={handleStartListening} icon={<RotateCcw className="w-3.5 h-3.5" />}>
              Listen Again
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};


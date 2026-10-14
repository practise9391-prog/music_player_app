import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Heart, Maximize2, Smartphone, X, Layers } from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import { WidgetSize } from '../../services/android/AndroidWidgetService';
import { OFFLINE_FALLBACK_ARTWORK_SVG } from '../../services/media/MediaSessionService';

interface WidgetPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WidgetPreviewModal: React.FC<WidgetPreviewModalProps> = ({ isOpen, onClose }) => {
  const { currentTrack, state, togglePlayPause, prevTrack, nextTrack, toggleFavorite, setIsFullPlayerOpen } = usePlayer();
  const [selectedSize, setSelectedSize] = useState<WidgetSize>('medium');

  if (!isOpen) return null;

  const isPlaying = state.status === 'playing';
  const artwork = currentTrack?.coverArtUrl || OFFLINE_FALLBACK_ARTWORK_SVG;
  const title = currentTrack?.title || 'No song playing';
  const artist = currentTrack?.artist || 'Nova Music Player';
  const isFav = Boolean(currentTrack?.isFavorite);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-6 text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Home Screen Widget Simulator</h2>
              <p className="text-xs text-neutral-400">Live native Android widget preview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Size Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 p-1 rounded-xl bg-neutral-800/80 border border-neutral-700/60 text-xs font-semibold">
          {(['small', 'medium', 'large'] as WidgetSize[]).map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`py-2 rounded-lg capitalize transition ${
                selectedSize === size
                  ? 'bg-cyan-500 text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {size} ({size === 'small' ? '2x1' : size === 'medium' ? '4x2' : '4x4'})
            </button>
          ))}
        </div>

        {/* Live Widget Container */}
        <div className="p-6 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-center min-h-[180px]">
          {/* SMALL WIDGET (2x1) */}
          {selectedSize === 'small' && (
            <div className="w-full max-w-sm p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-700/70 shadow-xl flex items-center justify-between gap-3 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={artwork}
                  alt={title}
                  className="w-12 h-12 rounded-xl object-cover border border-neutral-700/50 shrink-0"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white truncate">{title}</div>
                  <div className="text-[11px] text-neutral-400 truncate">{artist}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={prevTrack}
                  className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                  aria-label="Previous track"
                >
                  <SkipBack className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="p-2 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300 transition font-bold"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={nextTrack}
                  className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                  aria-label="Next track"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* MEDIUM WIDGET (4x2) */}
          {selectedSize === 'medium' && (
            <div className="w-full max-w-md p-4 rounded-2xl bg-neutral-900/90 border border-neutral-700/70 shadow-2xl flex items-center gap-4 backdrop-blur-md">
              <img
                src={artwork}
                alt={title}
                className="w-20 h-20 rounded-2xl object-cover border border-neutral-700/60 shadow-lg shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{title}</div>
                    <div className="text-xs text-neutral-400 truncate">{artist}</div>
                  </div>
                  <button
                    onClick={() => toggleFavorite()}
                    className={`p-1.5 rounded-lg transition ${
                      isFav ? 'text-rose-500' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                    aria-label="Favorite"
                  >
                    <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prevTrack}
                    className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                    aria-label="Previous track"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="p-2.5 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300 transition font-bold"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                  </button>
                  <button
                    onClick={nextTrack}
                    className="p-2 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                    aria-label="Next track"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                  <div className="ml-auto text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
                    {state.status}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LARGE WIDGET (4x4) */}
          {selectedSize === 'large' && (
            <div className="w-full max-w-sm p-5 rounded-3xl bg-neutral-900/90 border border-neutral-700/70 shadow-2xl space-y-4 backdrop-blur-md">
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-neutral-700/60 group">
                <img src={artwork} alt={title} className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    setIsFullPlayerOpen(true);
                    onClose();
                  }}
                  className="absolute top-2.5 right-2.5 p-2 rounded-xl bg-black/60 text-white hover:bg-black/80 transition backdrop-blur-sm"
                  aria-label="Open full player"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white truncate">{title}</h3>
                  <button
                    onClick={() => toggleFavorite()}
                    className={`p-1.5 rounded-lg transition ${
                      isFav ? 'text-rose-500' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-neutral-400 truncate">{artist}</p>
              </div>
              <div className="flex items-center justify-between pt-1">
                <button
                  onClick={prevTrack}
                  className="p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                >
                  <SkipBack className="w-5 h-5" />
                </button>
                <button
                  onClick={togglePlayPause}
                  className="p-3.5 rounded-2xl bg-cyan-400 text-black hover:bg-cyan-300 transition font-bold shadow-lg shadow-cyan-500/20"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>
                <button
                  onClick={nextTrack}
                  className="p-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                >
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-neutral-400 space-y-1.5 bg-neutral-800/40 p-3.5 rounded-xl border border-neutral-800">
          <p className="font-semibold text-neutral-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            Android Widget Integration:
          </p>
          <p>
            On Android devices, long-press your home screen, select <strong>Widgets</strong>, find <strong>Nova Music Player</strong>, and drag your desired widget size to your desktop.
          </p>
        </div>
      </div>
    </div>
  );
};


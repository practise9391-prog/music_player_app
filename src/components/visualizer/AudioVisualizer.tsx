import React, { useRef, useEffect } from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { useTheme } from '../../themes/ThemeContext';
import { VisualizerMode } from '../../types';

interface AudioVisualizerProps {
  className?: string;
  mode?: VisualizerMode;
  height?: number;
  width?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  className = '',
  mode,
  height,
  width,
}) => {
  const { visualizerEngine, visualizerSettings, state, currentTrack } = usePlayer();
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (currentTrack) {
      visualizerEngine.setTrackMetadata(currentTrack);
    }
  }, [currentTrack, visualizerEngine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Attach to engine
    visualizerEngine.attach(canvas);

    // Apply colors from theme
    const primary = visualizerSettings.colorMode === 'custom'
      ? visualizerSettings.customColor
      : (theme.colors.accent || '#00e5ff');
    const secondary = visualizerSettings.colorMode === 'custom'
      ? visualizerSettings.customSecondaryColor
      : (theme.button?.backgroundColor || '#8000ff');
    visualizerEngine.setColors(primary, secondary);

    if (mode) {
      visualizerEngine.setMode(mode);
    }

    return () => {
      visualizerEngine.detach();
    };
  }, [visualizerEngine, visualizerSettings, theme, mode]);

  useEffect(() => {
    // Keep colors updated
    const primary = visualizerSettings.colorMode === 'custom'
      ? visualizerSettings.customColor
      : (theme.colors.accent || '#00e5ff');
    const secondary = theme.button?.backgroundColor || '#8000ff';
    visualizerEngine.setColors(primary, secondary);
  }, [theme.colors.accent, theme.button?.backgroundColor, visualizerSettings.colorMode, visualizerSettings.customColor, visualizerEngine]);

  // Adjust canvas size to parent container or props
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (width && height) {
      canvas.width = width;
      canvas.height = height;
    } else {
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          if (w > 0 && h > 0) {
            canvas.width = Math.floor(w);
            canvas.height = Math.floor(h);
          }
        }
      });
      if (canvas.parentElement) {
        resizeObserver.observe(canvas.parentElement);
      }
      return () => resizeObserver.disconnect();
    }
  }, [width, height]);

  if (!visualizerSettings.enabled && !mode) {
    return null;
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
};

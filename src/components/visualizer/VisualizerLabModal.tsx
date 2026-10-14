import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  Activity,
  Layers,
  Palette,
  RotateCcw,
  Plus,
  Trash2,
  Save,
  Check,
  Zap,
  Info,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import {
  AnalysisTapSource,
  FftWindowFunction,
  FrequencyScale,
  PauseBehavior,
  VisualizerColorMode,
  VisualizerFftSize,
  VisualizerFps,
  VisualizerMode,
  VisualizerPreset,
  VisualizerQuality,
  BUILTIN_VISUALIZER_PRESETS,
  DEFAULT_VISUALIZER_SETTINGS,
} from '../../types';
import { db } from '../../database/db';

interface VisualizerLabModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VisualizerLabModal: React.FC<VisualizerLabModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    visualizerSettings,
    updateVisualizerSettings,
    visualizerEngine,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'modes' | 'dsp' | 'colors' | 'presets' | 'diagnostics'>('modes');
  const [customPresets, setCustomPresets] = useState<VisualizerPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [diagnostics, setDiagnostics] = useState(visualizerEngine.getDiagnostics());

  // Load custom presets from database
  useEffect(() => {
    if (!isOpen) return;
    loadCustomPresets();
  }, [isOpen]);

  const loadCustomPresets = async () => {
    try {
      const records = await db.visualizer_presets.toArray();
      setCustomPresets(records);
    } catch {
      // Fallback
    }
  };

  // Poll diagnostics periodically while lab is open
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setDiagnostics(visualizerEngine.getDiagnostics());
    }, 250);
    return () => clearInterval(timer);
  }, [isOpen, visualizerEngine]);

  if (!isOpen) return null;

  const handleSaveCustomPreset = async () => {
    if (!newPresetName.trim()) return;
    const presetId = `preset_custom_${Date.now()}`;
    const newPreset: VisualizerPreset = {
      id: presetId,
      name: newPresetName.trim(),
      isBuiltin: false,
      settings: { ...visualizerSettings },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await db.visualizer_presets.put(newPreset);
      setCustomPresets((prev) => [...prev, newPreset]);
      setNewPresetName('');
      setIsSavingPreset(false);
    } catch (err) {
      console.warn('Failed to save visualizer preset:', err);
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await db.visualizer_presets.delete(id);
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.warn('Failed to delete visualizer preset:', err);
    }
  };

  const handleApplyPreset = (preset: VisualizerPreset) => {
    updateVisualizerSettings(preset.settings);
  };

  const handleResetToDefault = () => {
    updateVisualizerSettings(DEFAULT_VISUALIZER_SETTINGS);
  };

  const MODES: { id: VisualizerMode; label: string }[] = [
    { id: 'spectrum', label: 'Classic Bars Spectrum' },
    { id: 'smooth_spectrum', label: 'Continuous Smooth Curve' },
    { id: 'bars', label: 'Dense FFT Bars' },
    { id: 'waveform', label: 'Time Domain Waveform' },
    { id: 'oscilloscope', label: 'Laboratory Oscilloscope' },
    { id: 'circle', label: 'Circular Polar Spectrum' },
    { id: 'radial_spectrum', label: 'Radial Sunburst Spectrum' },
    { id: 'spectrogram', label: 'Real-Time 2D Spectrogram' },
    { id: 'peak_meter', label: 'Stereo Peak Meter (dBFS)' },
    { id: 'rms_meter', label: 'Stereo RMS Loudness Meter' },
    { id: 'stereo_field', label: 'Stereo Field Goniometer' },
    { id: 'phase_meter', label: 'Stereo Phase Correlation' },
    { id: 'album_art', label: 'Album Art Reactive Aura' },
    { id: 'particles', label: 'Audio-Reactive Particles' },
    { id: 'minimal', label: 'Minimalist Zen Dots' },
    { id: 'off', label: 'Disabled (Off)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
              <Zap className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Audio Visual Lab</h2>
              <p className="text-xs text-slate-400">Real-Time DSP Signal Analysis &amp; Physics Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefault}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Reset all settings to default"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-slate-800 bg-slate-950/20 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('modes')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'modes'
                ? 'bg-cyan-500 text-black font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Modes &amp; Engine</span>
          </button>
          <button
            onClick={() => setActiveTab('dsp')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'dsp'
                ? 'bg-cyan-500 text-black font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>DSP &amp; Tap</span>
          </button>
          <button
            onClick={() => setActiveTab('colors')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'colors'
                ? 'bg-cyan-500 text-black font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Theme &amp; Optics</span>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'bg-cyan-500 text-black font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Presets</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'diagnostics'
                ? 'bg-cyan-500 text-black font-bold'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Diagnostics</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'modes' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Active Visualization Mode</label>
                <select
                  value={visualizerSettings.mode}
                  onChange={(e) => updateVisualizerSettings({ mode: e.target.value as VisualizerMode })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-400"
                >
                  {MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Visual Quality</label>
                  <select
                    value={visualizerSettings.quality}
                    onChange={(e) => updateVisualizerSettings({ quality: e.target.value as VisualizerQuality })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="low">Low (Power Saving)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Recommended)</option>
                    <option value="ultra">Ultra (Studio Precision)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Target Refresh Rate</label>
                  <select
                    value={visualizerSettings.fps}
                    onChange={(e) => updateVisualizerSettings({ fps: e.target.value as VisualizerFps })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="low">30 FPS (Low CPU)</option>
                    <option value="medium">60 FPS (Smooth)</option>
                    <option value="high">120 FPS (High Refresh)</option>
                    <option value="ultra">Uncapped (Auto)</option>
                  </select>
                </div>
              </div>

              {/* Sensitivity & Smoothing */}
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Input Sensitivity</span>
                    <span className="font-mono text-cyan-400">{visualizerSettings.sensitivity}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={visualizerSettings.sensitivity}
                    onChange={(e) => updateVisualizerSettings({ sensitivity: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Temporal Smoothing</span>
                    <span className="font-mono text-cyan-400">{visualizerSettings.smoothing}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="95"
                    value={visualizerSettings.smoothing}
                    onChange={(e) => updateVisualizerSettings({ smoothing: parseInt(e.target.value, 10) })}
                    className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>

              {/* Behavior on Pause & Motion */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Behavior on Pause</label>
                  <select
                    value={visualizerSettings.pauseBehavior}
                    onChange={(e) => updateVisualizerSettings({ pauseBehavior: e.target.value as PauseBehavior })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="freeze">Freeze Frame (Default)</option>
                    <option value="fade">Smooth Fade to Black</option>
                    <option value="stop">Instant Clear</option>
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 py-2">
                    <input
                      type="checkbox"
                      checked={visualizerSettings.reducedMotion}
                      onChange={(e) => updateVisualizerSettings({ reducedMotion: e.target.checked })}
                      className="rounded accent-cyan-400"
                    />
                    <span>Reduced Motion (Accessibility)</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dsp' && (
            <div className="space-y-5">
              <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Non-Invasive High-Impedance Observation Tap</span>
                </div>
                <p className="text-[11px] text-cyan-400/80">
                  The analysis tap inspects PCM samples without altering the audio signal, ensuring bit-perfect output.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Analysis Tap Stage</label>
                <select
                  value={visualizerSettings.analysisTap}
                  onChange={(e) => updateVisualizerSettings({ analysisTap: e.target.value as AnalysisTapSource })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="source">SOURCE — Raw Input Before Any Processing</option>
                  <option value="pre_dsp">PRE-DSP — Preamp Stage Before Equalizer</option>
                  <option value="post_dsp">POST-DSP — After EQ &amp; Dynamics Compression</option>
                  <option value="post_spatial">POST-SPATIAL — After 3D Acoustics &amp; Stereo Matrix (Default)</option>
                  <option value="post_limiter">POST-LIMITER — Final Master Output Before Speaker</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">FFT Resolution</label>
                  <select
                    value={visualizerSettings.fftSize}
                    onChange={(e) => updateVisualizerSettings({ fftSize: parseInt(e.target.value, 10) as VisualizerFftSize })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="512">512 Bins (Fast Transient)</option>
                    <option value="1024">1024 Bins</option>
                    <option value="2048">2048 Bins (Default Studio)</option>
                    <option value="4096">4096 Bins (Deep Low-End)</option>
                    <option value="8192">8192 Bins (Extreme Detail)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">FFT Window Function</label>
                  <select
                    value={visualizerSettings.windowFunction}
                    onChange={(e) => updateVisualizerSettings({ windowFunction: e.target.value as FftWindowFunction })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="hann">Hann (Recommended Standard)</option>
                    <option value="hamming">Hamming (Sharp Band Separation)</option>
                    <option value="blackman">Blackman (High Dynamic Range)</option>
                    <option value="rectangular">Rectangular (Direct Pass)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Frequency Scale Curve</label>
                  <select
                    value={visualizerSettings.frequencyScale}
                    onChange={(e) => updateVisualizerSettings({ frequencyScale: e.target.value as FrequencyScale })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="logarithmic">Logarithmic (Human Hearing Curve)</option>
                    <option value="linear">Linear (Scientific Spectrum)</option>
                    <option value="musical">Musical Notes (12-TET Octaves)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Decibel Dynamic Range</label>
                  <select
                    value={visualizerSettings.dbRange}
                    onChange={(e) => updateVisualizerSettings({ dbRange: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="48">-48 dB (Compact)</option>
                    <option value="72">-72 dB (Standard Studio)</option>
                    <option value="96">-96 dB (Full 16-bit PCM)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={visualizerSettings.peakHold}
                    onChange={(e) => updateVisualizerSettings({ peakHold: e.target.checked })}
                    className="rounded accent-cyan-400"
                  />
                  <span>Peak Hold Markers</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={visualizerSettings.stereoMode}
                    onChange={(e) => updateVisualizerSettings({ stereoMode: e.target.checked })}
                    className="rounded accent-cyan-400"
                  />
                  <span>Dual Stereo Channel Analysis</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={visualizerSettings.mirror}
                    onChange={(e) => updateVisualizerSettings({ mirror: e.target.checked })}
                    className="rounded accent-cyan-400"
                  />
                  <span>Mirror Spectrum Symmetry</span>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'colors' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Optics &amp; Color Scheme</label>
                <select
                  value={visualizerSettings.colorMode}
                  onChange={(e) => updateVisualizerSettings({ colorMode: e.target.value as VisualizerColorMode })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                >
                  <option value="theme">Application Theme Colors</option>
                  <option value="album_art">Album Art Reactive (Dynamic Extracted Palette)</option>
                  <option value="neon">Cyberpunk Neon (Cyan &amp; Magenta)</option>
                  <option value="monochrome">Monochrome Studio Minimalist</option>
                  <option value="custom">Custom Color Palette</option>
                </select>
              </div>

              {visualizerSettings.colorMode === 'custom' && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={visualizerSettings.customColor}
                        onChange={(e) => updateVisualizerSettings({ customColor: e.target.value })}
                        className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={visualizerSettings.customColor}
                        onChange={(e) => updateVisualizerSettings({ customColor: e.target.value })}
                        className="flex-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400">Secondary Accent</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={visualizerSettings.customSecondaryColor}
                        onChange={(e) => updateVisualizerSettings({ customSecondaryColor: e.target.value })}
                        className="w-8 h-8 rounded border border-slate-700 cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={visualizerSettings.customSecondaryColor}
                        onChange={(e) => updateVisualizerSettings({ customSecondaryColor: e.target.value })}
                        className="flex-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Background Stage Opacity</span>
                  <span className="font-mono text-cyan-400">{visualizerSettings.backgroundOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={visualizerSettings.backgroundOpacity}
                  onChange={(e) => updateVisualizerSettings({ backgroundOpacity: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Audio Particles Density</span>
                  <span className="font-mono text-cyan-400">{visualizerSettings.particleCount} particles</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="350"
                  value={visualizerSettings.particleCount}
                  onChange={(e) => updateVisualizerSettings({ particleCount: parseInt(e.target.value, 10) })}
                  className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Built-in Presets</h3>
                <button
                  onClick={() => setIsSavingPreset(!isSavingPreset)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Current as Preset</span>
                </button>
              </div>

              {isSavingPreset && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-700 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter preset name (e.g. My Bass Visualizer)..."
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    onClick={handleSaveCustomPreset}
                    disabled={!newPresetName.trim()}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={() => setIsSavingPreset(false)}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Preset Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {BUILTIN_VISUALIZER_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleApplyPreset(p)}
                    className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {p.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                        {p.settings.mode}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Presets */}
              {customPresets.length > 0 && (
                <div className="space-y-2 pt-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Custom User Presets</h3>
                  <div className="space-y-2">
                    {customPresets.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <div>
                          <span className="text-xs font-bold text-white">{p.name}</span>
                          <span className="ml-2 text-[10px] text-slate-400 font-mono">Mode: {p.settings.mode}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApplyPreset(p)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold"
                          >
                            Apply
                          </button>
                          <button
                            onClick={() => handleDeletePreset(p.id)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete custom preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Rendering Frame Rate:</span>
                  <span className="text-cyan-400 font-bold">{diagnostics.fps} FPS</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Frame Calculation Delta:</span>
                  <span className="text-white">{diagnostics.frameTimeMs.toFixed(1)} ms</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Dropped Visual Frames:</span>
                  <span className="text-white">{diagnostics.droppedFrames}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Active Stage Tap:</span>
                  <span className="text-emerald-400 font-bold uppercase">{diagnostics.tapSource}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">FFT Bins Resolution:</span>
                  <span className="text-white">{diagnostics.fftResolution} samples</span>
                </div>
                <div className="flex justify-between border-b border-slate-800/80 pb-2">
                  <span className="text-slate-400">Signal Activity:</span>
                  <span className={diagnostics.isSilent ? 'text-amber-400' : 'text-emerald-400 font-bold'}>
                    {diagnostics.isSilent ? 'SILENCE DETECTED' : 'AUDIO ACTIVE'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Stereo Peak dBFS:</span>
                  <span className="text-cyan-300">
                    L: {diagnostics.leftPeakDb.toFixed(1)} dB | R: {diagnostics.rightPeakDb.toFixed(1)} dB
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

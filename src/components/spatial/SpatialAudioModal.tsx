import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Compass,
  X,
  Volume2,
  Headphones,
  Sliders,
  Sparkles,
  Info,
  RotateCcw,
  Save,
  Check,
  AlertTriangle,
  Radio,
  Tv,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { usePlayer } from '../../player/PlayerContext';
import {
  SpatialMode,
  RoomSizeType,
  CrossfeedMode,
  SpatialPresetName,
} from '../../types';
import { SPATIAL_PRESET_LIST } from '../../audio/SpatialPresets';

export const SpatialAudioModal: React.FC = () => {
  const {
    isSpatialModalOpen,
    setIsSpatialModalOpen,
    spatialState,
    spatialCapabilities,
    setSpatialMode,
    setSpatialIntensity,
    setSpatialPosition,
    setSpatialAzimuth,
    setSpatialElevation,
    setSpatialDistance,
    setSpatialDepth,
    setSpatialWidth,
    setSpatialCenterLevel,
    setSpatialSurroundBalance,
    setSpatialRoomSize,
    setSpatialRoomMix,
    setSpatialReverbDecay,
    setSpatialCrossfeed,
    setSpatialBypass,
    toggleSpatialAb,
    resetSpatialSettings,
    loadSpatialPreset,
    saveCustomSpatialPreset,
    customSpatialPresets,
    deleteCustomSpatialPreset,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Draw 2D Top-down Radar for Azimuth & Distance (X/Z plane)
  const drawRadar = useCallback(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 16;

    ctx.clearRect(0, 0, width, height);

    // Background circle
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric rings (Near, Medium, Far)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.setLineDash([4, 4]);
    [0.33, 0.66].forEach((fraction) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * fraction, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();

    // Listener Head in center
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Head orientation nose tick (facing Front)
    ctx.fillStyle = '#00e5ff';
    ctx.beginPath();
    ctx.moveTo(centerX - 3, centerY - 6);
    ctx.lineTo(centerX, centerY - 13);
    ctx.lineTo(centerX + 3, centerY - 6);
    ctx.fill();

    // Sound Source Position
    const azRad = (spatialState.position.azimuth * Math.PI) / 180;
    const distNormalized = Math.max(0.08, Math.min(1.0, spatialState.position.distance));
    const sourceR = distNormalized * radius;

    // Azimuth 0 = Front (up), 90 = Right, 180 = Back (down), -90 = Left
    const sourceX = centerX + sourceR * Math.sin(azRad);
    const sourceY = centerY - sourceR * Math.cos(azRad);

    // Connecting dashed line
    ctx.strokeStyle = spatialState.enabled ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(sourceX, sourceY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sound Source Marker
    ctx.fillStyle = spatialState.enabled ? '#00e5ff' : '#64748b';
    ctx.shadowColor = spatialState.enabled ? '#00e5ff' : 'transparent';
    ctx.shadowBlur = spatialState.enabled ? 12 : 0;
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sound source core ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sourceX, sourceY, 9, 0, Math.PI * 2);
    ctx.stroke();
  }, [spatialState.position.azimuth, spatialState.position.distance, spatialState.enabled]);

  useEffect(() => {
    if (isSpatialModalOpen) {
      drawRadar();
    }
  }, [isSpatialModalOpen, drawRadar]);

  // Handle Drag on Radar Canvas
  const handleCanvasInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;

    const maxR = canvas.width / 2 - 16;
    const distPixels = Math.sqrt(x * x + y * y);
    const distanceNorm = Math.min(1.0, distPixels / maxR);

    // Angle: 0 is up (-Y axis), 90 is right (+X), etc.
    let angleRad = Math.atan2(x, -y);
    let angleDeg = Math.round((angleRad * 180) / Math.PI);

    setSpatialPosition(
      angleDeg,
      spatialState.position.elevation,
      distanceNorm,
      spatialState.position.depth
    );
  };

  if (!isSpatialModalOpen) return null;

  const correlationPercent = Math.round(((spatialState.correlation + 1) / 2) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl overflow-hidden text-slate-100"
        style={{ backgroundColor: 'var(--color-bg, #0b0d14)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-inner">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">Spatial Audio Studio</h2>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  BINAURAL & 3D DSP
                </span>
                {spatialState.bypass && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    BYPASSED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Immersive 3D soundstage, virtual surround, and room acoustic simulation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick A/B Comparison */}
            <button
              onClick={toggleSpatialAb}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                spatialState.abState === 'B'
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
              title="A/B Comparison: Toggle between current spatial sound and bypassed reference"
            >
              A/B: State {spatialState.abState}
            </button>

            {/* Bypass Toggle */}
            <button
              onClick={() => setSpatialBypass(!spatialState.bypass)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                spatialState.bypass
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
              }`}
            >
              {spatialState.bypass ? 'Resume Spatial' : 'Bypass'}
            </button>

            <button
              onClick={() => setIsSpatialModalOpen(false)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Header Tabs & Presets */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-black/20 border-b border-white/5 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('simple')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'simple'
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Simple Controls
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                activeTab === 'advanced'
                  ? 'bg-cyan-500 text-black font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Advanced 3D & Acoustics
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Preset:</span>
            <select
              value={spatialState.activePreset}
              onChange={(e) => loadSpatialPreset(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            >
              <optgroup label="Built-in Presets">
                {SPATIAL_PRESET_LIST.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.name}
                  </option>
                ))}
              </optgroup>
              {customSpatialPresets.length > 0 && (
                <optgroup label="Custom Presets">
                  {customSpatialPresets.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            <button
              onClick={() => setIsSavingPreset(true)}
              className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300"
              title="Save current spatial settings as custom preset"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Row: Master Spatial Enable & Mode Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Spatial Processing</span>
                <button
                  onClick={() => setSpatialMode(spatialState.enabled ? 'off' : 'headphone_spatial')}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    spatialState.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      spatialState.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Spatial Intensity</span>
                  <span className="font-semibold text-cyan-400">
                    {Math.round(spatialState.intensity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={spatialState.intensity}
                  onChange={(e) => setSpatialIntensity(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                />
              </div>
            </div>

            {/* Mode Selector */}
            <div className="md:col-span-2 p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">Spatial Listening Mode</span>
                <span className="text-[11px] text-slate-400 capitalize">
                  Active: {spatialState.mode.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'off', label: 'Off', icon: Radio },
                  { id: 'headphone_spatial', label: 'Headphones', icon: Headphones },
                  { id: 'stereo_wide', label: 'Stereo Wide', icon: Volume2 },
                  { id: 'virtual_surround', label: 'Surround', icon: Sparkles },
                  { id: '3d_audio', label: '3D Audio', icon: Compass },
                  { id: 'cinema', label: 'Cinema', icon: Tv },
                  { id: 'live', label: 'Live Stage', icon: Radio },
                  { id: 'room', label: 'Concert Room', icon: Volume2 },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setSpatialMode(id as SpatialMode)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all ${
                      spatialState.mode === id
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm'
                        : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3D Radar Positioning & Spatial Stage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-white/[0.02] border border-white/5">
            {/* Visual 2D Radar Canvas */}
            <div className="flex flex-col items-center">
              <div className="w-full flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Interactive 3D Sound Position
                </span>
                <span className="text-[11px] text-cyan-400">
                  Azimuth: {spatialState.position.azimuth}° • Distance: {Math.round(spatialState.position.distance * 100)}%
                </span>
              </div>

              <div className="relative p-2 rounded-2xl bg-slate-950/80 border border-white/10 shadow-inner">
                {/* Labels on Radar */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                  FRONT
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                  BACK
                </div>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                  LEFT
                </div>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                  RIGHT
                </div>

                <canvas
                  ref={radarCanvasRef}
                  width={250}
                  height={250}
                  onMouseDown={(e) => {
                    setIsDraggingCanvas(true);
                    handleCanvasInteraction(e);
                  }}
                  onMouseMove={(e) => {
                    if (isDraggingCanvas) handleCanvasInteraction(e);
                  }}
                  onMouseUp={() => setIsDraggingCanvas(false)}
                  onMouseLeave={() => setIsDraggingCanvas(false)}
                  className="cursor-crosshair rounded-xl"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2 text-center">
                Click or drag on the radar circle to reposition the virtual sound source in real time
              </p>
            </div>

            {/* Fine Position Sliders */}
            <div className="space-y-4">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                Soundstage Geometry
              </span>

              {/* Stereo Width */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Stereo Width</span>
                  <span className="text-cyan-400 font-medium">
                    {Math.round(spatialState.width * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={spatialState.width}
                  onChange={(e) => setSpatialWidth(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                />
              </div>

              {/* Soundstage Depth */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Perceived Depth</span>
                  <span className="text-cyan-400 font-medium">
                    {Math.round(spatialState.position.depth * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1.0"
                  step="0.05"
                  value={spatialState.position.depth}
                  onChange={(e) => setSpatialDepth(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                />
              </div>

              {/* Center Channel Level (Dialogue / Vocals) */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Center Channel Level (Vocals / Dialogue)</span>
                  <span className="text-cyan-400 font-medium">
                    {spatialState.centerLevel > 0 ? `+${Math.round(spatialState.centerLevel * 100)}%` : `${Math.round(spatialState.centerLevel * 100)}%`}
                  </span>
                </div>
                <input
                  type="range"
                  min="-1.0"
                  max="1.0"
                  step="0.05"
                  value={spatialState.centerLevel}
                  onChange={(e) => setSpatialCenterLevel(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                />
              </div>

              {/* Headphone Crossfeed */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Headphone Crossfeed (Fatigue Reduction)</span>
                  <span className="text-cyan-400 font-medium uppercase">
                    {spatialState.crossfeed}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {(['off', 'low', 'medium', 'high'] as CrossfeedMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSpatialCrossfeed(mode)}
                      className={`py-1 rounded-md text-xs font-medium border capitalize ${
                        spatialState.crossfeed === mode
                          ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                          : 'bg-white/[0.02] border-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Advanced Tab: Room Acoustic Simulation & Reverb */}
          {activeTab === 'advanced' && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-4 animate-fade-in">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Room Acoustic Simulation & Reverberation
                </span>
                <span className="text-[11px] text-slate-400">
                  Convolver-based early reflections & decay
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Room Size Presets */}
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Acoustic Space</label>
                  <select
                    value={spatialState.roomSize}
                    onChange={(e) => setSpatialRoomSize(e.target.value as RoomSizeType)}
                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="small">Small Studio Room (0.6s decay)</option>
                    <option value="studio">Professional Recording Studio (1.0s decay)</option>
                    <option value="concert_hall">Orchestral Concert Hall (2.5s decay)</option>
                    <option value="large_hall">Grand Auditorium (3.5s decay)</option>
                    <option value="cinema">Cinema Theater (1.8s decay)</option>
                    <option value="cathedral">Cathedral Sanctuary (5.0s decay)</option>
                  </select>
                </div>

                {/* Room Mix (Wet/Dry) */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Room Reflections Mix</span>
                    <span className="text-cyan-400 font-medium">
                      {Math.round(spatialState.roomMix * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1.0"
                    step="0.05"
                    value={spatialState.roomMix}
                    onChange={(e) => setSpatialRoomMix(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer mt-2"
                  />
                </div>

                {/* Reverb Decay Time */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Reverb Decay Time</span>
                    <span className="text-cyan-400 font-medium">
                      {spatialState.reverbDecay.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="6.0"
                    step="0.1"
                    value={spatialState.reverbDecay}
                    onChange={(e) => setSpatialReverbDecay(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer mt-2"
                  />
                </div>
              </div>

              {/* Elevation & Surround Balance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Vertical Elevation Angle</span>
                    <span className="text-cyan-400 font-medium">{spatialState.position.elevation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="5"
                    value={spatialState.position.elevation}
                    onChange={(e) => setSpatialElevation(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Surround Left / Right Balance</span>
                    <span className="text-cyan-400 font-medium">
                      {spatialState.surroundBalance === 0
                        ? 'Center'
                        : spatialState.surroundBalance < 0
                        ? `L ${Math.round(Math.abs(spatialState.surroundBalance) * 100)}%`
                        : `R ${Math.round(spatialState.surroundBalance * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1.0"
                    max="1.0"
                    step="0.05"
                    value={spatialState.surroundBalance}
                    onChange={(e) => setSpatialSurroundBalance(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 rounded-lg bg-slate-800 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Phase Correlation & Mono Compatibility Diagnostic */}
          <div className="p-4 rounded-xl bg-black/30 border border-white/5 space-y-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">
                Phase Correlation & Mono Compatibility
              </span>
              <span className="font-mono text-cyan-400">
                Index: {spatialState.correlation >= 0 ? `+${spatialState.correlation.toFixed(2)}` : spatialState.correlation.toFixed(2)}
              </span>
            </div>

            {/* Visual Correlation Bar: -1 to +1 */}
            <div className="relative w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="absolute top-0 bottom-0 transition-all duration-100 rounded-full"
                style={{
                  left: `${Math.min(50, correlationPercent)}%`,
                  width: `${Math.abs(correlationPercent - 50)}%`,
                  backgroundColor: spatialState.correlation < -0.15 ? '#ef4444' : '#00e5ff',
                }}
              />
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white/30" />
            </div>

            <div className="flex justify-between text-[10px] text-slate-500">
              <span>-1.0 (Out of Phase)</span>
              <span>0.0 (Wide Stereo)</span>
              <span>+1.0 (Correlated Mono)</span>
            </div>

            {spatialState.monoWarning && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                  Spatial processing may reduce mono compatibility on single-speaker systems.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Capabilities & Reset */}
        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Info className="w-4 h-4 text-cyan-400" />
            <span>
              {spatialCapabilities.statusText} • {spatialCapabilities.sampleRate} Hz
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={resetSpatialSettings}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Spatial</span>
            </button>

            <button
              onClick={() => setIsSpatialModalOpen(false)}
              className="px-4 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors shadow-sm"
            >
              Done
            </button>
          </div>
        </div>

        {/* Save Preset Dialog */}
        {isSavingPreset && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-20">
            <div className="w-full max-w-sm p-5 rounded-2xl bg-slate-900 border border-white/10 shadow-2xl space-y-4">
              <h3 className="text-sm font-bold text-white">Save Custom Spatial Preset</h3>
              <input
                type="text"
                placeholder="Preset Name (e.g., My Headphones 3D)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full bg-slate-950 border border-white/15 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  onClick={() => setIsSavingPreset(false)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (newPresetName.trim()) {
                      await saveCustomSpatialPreset(newPresetName.trim());
                      setIsSavingPreset(false);
                      setNewPresetName('');
                    }
                  }}
                  disabled={!newPresetName.trim()}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 text-black font-semibold disabled:opacity-50"
                >
                  Save Preset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

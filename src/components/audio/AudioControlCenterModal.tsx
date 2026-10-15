import React, { useState, useRef } from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { useSettings } from '../../settings/SettingsContext';
import { AUDIO_PROFILE_PRESETS } from '../../audio/AudioProfiles';
import {
  AudioProfileName,
  EQ_FREQUENCIES,
  LoudnessMode,
  VocalEnhancementMode,
} from '../../types';
import {
  Sliders,
  Volume2,
  AlertTriangle,
  RotateCcw,
  Save,
  Trash2,
  X,
  ShieldCheck,
  Check,
  Sparkles,
  Info,
  Radio,
  Headphones,
  Speaker,
  Download,
  Upload,
  Moon,
  Mic,
  Copy,
  Edit2,
  FastForward,
  Rewind,
  Clock,
  Compass,
  FileAudio,
  CheckCircle2,
  Shield,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import { AudioFormatInfoModal } from '../modals/AudioFormatInfoModal';

export const AudioControlCenterModal: React.FC = () => {
  const {
    // Modal states
    isAudioControlCenterOpen,
    setIsAudioControlCenterOpen,
    isDspModalOpen,
    setIsDspModalOpen,

    // DSP State & Meters
    dspState,
    levelData,
    setPreamp,
    setEqualizerBand,
    resetEqualizer,
    setBassBoost,
    setTreble,
    setVocalEnhancement,
    setLoudness,
    setCompressor,
    setLimiter,
    setStereoWidth,
    setBalance,
    setMono,
    setAutoHeadroom,
    setMaxOutputLevel,
    setVolumeBoost,
    setDspBypass,
    toggleAbComparison,
    resetAudioProcessing,
    setAudioProfile,

    // Custom presets
    customPresets,
    saveCustomPreset,
    deleteCustomPreset,
    loadPreset,
    renameCustomPreset,
    duplicateCustomPreset,
    resetCustomPresets,

    // Part 13 additions
    currentTrack,
    audioProfileConfig,
    audioProfileSource,
    audioProfileMatchedName,
    customProfilesEnabled,
    setCustomProfilesEnabled,
    isSongProfileRemembered,
    setRememberSongProfile,
    saveCurrentAsSongProfile,
    clearSongProfile,
    setAlbumAudioProfile,
    setArtistAudioProfile,
    setGlobalAudioProfile,
    resetAudioSettings,
    exportAudioProfiles,
    importAudioProfiles,
    setBassBoostPercent,
    resetTreble,
    setReplayGainMode,
    setVolumeNormalization,
    setPreventClipping,
    setVirtualSurround,
    activeDolbyMode,
    setDolbyMode,
    dolbyStatus,
    isDolbyHardwareSupported,
    nightModeEnabled,
    toggleNightMode,
    voiceModeEnabled,
    toggleVoiceMode,
    crossfadeDuration,
    setCrossfadeDuration,
    detailedOutputDevices,
    currentOutputDeviceInfo,
    setOutputDevice,
    refreshOutputDevices,
    activeAudioBadges,
    audioFormatBadge,
    audiobookControls,
    setPlaybackRate,
    state: engineState,
    setIsSpatialModalOpen,
  } = usePlayer();

  const { settings, updateSettings } = useSettings();

  const isOpen = isAudioControlCenterOpen || isDspModalOpen;
  const handleClose = () => {
    setIsAudioControlCenterOpen(false);
    setIsDspModalOpen(false);
  };

  const [activeTab, setActiveTab] = useState<'eq' | 'tone' | 'profiles' | 'effects' | 'output'>('eq');
  const [newPresetName, setNewPresetName] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetName, setEditingPresetName] = useState('');
  const [isAudioFormatModalOpen, setIsAudioFormatModalOpen] = useState(false);
  const [showVolumeWarning, setShowVolumeWarning] = useState(false);
  const [pendingBoostValue, setPendingBoostValue] = useState<number | null>(null);

  const importFileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const BOOST_LEVELS = [
    { label: '100%', val: 1.0 },
    { label: '125%', val: 1.25 },
    { label: '150%', val: 1.5 },
    { label: '175%', val: 1.75 },
    { label: '200%', val: 2.0 },
  ];

  const handleBoostChange = (newBoost: number) => {
    if (newBoost > 1.5 && !settings.highVolumeWarningDismissed) {
      setPendingBoostValue(newBoost);
      setShowVolumeWarning(true);
    } else {
      setVolumeBoost(newBoost);
    }
  };

  const confirmVolumeWarning = (dontShowAgain: boolean) => {
    if (dontShowAgain) {
      updateSettings({ highVolumeWarningDismissed: true });
    }
    if (pendingBoostValue !== null) {
      setVolumeBoost(pendingBoostValue);
      setPendingBoostValue(null);
    }
    setShowVolumeWarning(false);
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    await saveCustomPreset(newPresetName.trim());
    setNewPresetName('');
    setIsSavingPreset(false);
  };

  const handleRenamePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPresetId || !editingPresetName.trim()) return;
    await renameCustomPreset(editingPresetId, editingPresetName.trim());
    setEditingPresetId(null);
    setEditingPresetName('');
  };

  const handleExportProfiles = () => {
    const bundle = exportAudioProfiles();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'audio_profiles.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importAudioProfiles(parsed, 'merge');
      alert('Audio profiles imported successfully!');
    } catch (err: any) {
      alert('Failed to import audio profiles: ' + (err.message || 'Invalid JSON file'));
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-control-center-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none"
      >
        <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
          {/* HEADER BAR */}
          <div className="h-16 px-4 sm:px-6 border-b border-[var(--border)] flex items-center justify-between bg-[var(--surface-secondary)]/60">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-[var(--text-primary)] bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] transition-all active:scale-95 shadow-sm"
                title="Go back"
                aria-label="Go back"
              >
                <ArrowLeft className="w-4 h-4 text-[var(--accent)]" />
                <span className="hidden sm:inline">Back</span>
              </button>
              <div className="p-2 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] hidden sm:block">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="audio-control-center-title"
                    className="text-base font-bold text-[var(--text-primary)]"
                  >
                    Audio Control Center
                  </h2>
                  {dspState.dspBypass && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      DSP BYPASS
                    </span>
                  )}
                  {dspState.abState === 'B' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      A/B (Reference)
                    </span>
                  )}
                  {audioFormatBadge && (
                    <span
                      onClick={() => setIsAudioFormatModalOpen(true)}
                      className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border cursor-pointer hover:brightness-125 transition-all ${
                        audioFormatBadge === 'HI-RES'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : audioFormatBadge === 'LOSSLESS'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)]'
                      }`}
                      title="Click to view full audio stream specifications"
                    >
                      {audioFormatBadge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                  <span>9-Band Equalizer &bull; Dolby Architecture &bull; Audio Profiles &bull; Effects</span>
                </p>
              </div>
            </div>

            {/* Quick Actions & Toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAbComparison}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                  dspState.abState === 'B'
                    ? 'bg-sky-500 text-black border-sky-400'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white border-[var(--border)]'
                }`}
                title="Compare current DSP tuning against flat uncolored reference"
              >
                [A / B]
              </button>

              <button
                onClick={() => setDspBypass(!dspState.dspBypass)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  dspState.dspBypass
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white border-[var(--border)]'
                }`}
              >
                {dspState.dspBypass ? 'DSP Off' : 'DSP On'}
              </button>

              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors ml-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* REAL-TIME LEVEL METERS & PEAK STATUS */}
          <div className="p-3 px-6 bg-[var(--surface)]/60 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[280px] space-y-1">
              <div className="flex justify-between items-center text-[10px] font-mono text-[var(--text-muted)] uppercase">
                <span>Real-Time Output Level (Peak / RMS)</span>
                <span>
                  Peak: <b className="text-[var(--text-primary)]">{levelData.peakDb.toFixed(1)} dBFS</b>
                </span>
              </div>

              {/* Left Channel */}
              <div className="flex items-center gap-2">
                <span className="w-3 text-[10px] font-mono font-bold text-[var(--text-muted)]">L</span>
                <div className="flex-1 h-2 rounded bg-[var(--surface-secondary)] overflow-hidden relative border border-[var(--border-subtle)]">
                  <div
                    className={`h-full transition-all duration-75 ${
                      levelData.leftPeak > 0.95
                        ? 'bg-red-500'
                        : levelData.leftPeak > 0.8
                        ? 'bg-amber-400'
                        : 'bg-[var(--accent)]'
                    }`}
                    style={{ width: `${Math.round(levelData.leftPeak * 100)}%` }}
                  />
                </div>
              </div>

              {/* Right Channel */}
              <div className="flex items-center gap-2">
                <span className="w-3 text-[10px] font-mono font-bold text-[var(--text-muted)]">R</span>
                <div className="flex-1 h-2 rounded bg-[var(--surface-secondary)] overflow-hidden relative border border-[var(--border-subtle)]">
                  <div
                    className={`h-full transition-all duration-75 ${
                      levelData.rightPeak > 0.95
                        ? 'bg-red-500'
                        : levelData.rightPeak > 0.8
                        ? 'bg-amber-400'
                        : 'bg-[var(--accent)]'
                    }`}
                    style={{ width: `${Math.round(levelData.rightPeak * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono transition-colors ${
                  levelData.isClipping
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    levelData.isClipping ? 'bg-red-500' : 'bg-emerald-400'
                  }`}
                />
                <span>{levelData.isClipping ? 'CLIPPING' : 'CLIP SAFE'}</span>
              </div>

              {levelData.gainReductionDb > 0 && (
                <div className="px-2.5 py-1 rounded-lg bg-[var(--surface-card)] border border-amber-500/30 text-xs font-mono text-amber-300">
                  Limiter: -{levelData.gainReductionDb.toFixed(1)} dB
                </div>
              )}

              {dspState.autoHeadroom && dspState.calculatedHeadroomDb > 0 && (
                <div className="px-2.5 py-1 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs font-mono text-[var(--accent)]">
                  Headroom: -{dspState.calculatedHeadroomDb.toFixed(1)} dB
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE PROCESSING BADGE STRIP */}
          <div className="px-6 py-2 bg-[var(--surface-secondary)]/30 border-b border-[var(--border)] flex items-center justify-between text-xs overflow-x-auto gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                Active Processing:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {activeAudioBadges.length > 0 ? (
                  activeAudioBadges.map((badge) => (
                    <span
                      key={badge}
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                    >
                      {badge}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-[var(--text-muted)] italic">
                    Pure Flat Reference (No coloration)
                  </span>
                )}
              </div>
            </div>

            {/* Profile scope source */}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
              <span>Profile Source:</span>
              <b className="text-[var(--accent)] uppercase font-mono">
                {audioProfileSource} {audioProfileMatchedName ? `(${audioProfileMatchedName})` : ''}
              </b>
            </div>
          </div>

          {/* NAVIGATION TABS */}
          <div className="px-6 pt-3 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--surface-card)]">
            <button
              onClick={() => setActiveTab('eq')}
              className={`px-4 py-2 border-b-2 font-bold text-xs transition-colors flex items-center gap-1.5 ${
                activeTab === 'eq'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Equalizer &amp; Presets
            </button>
            <button
              onClick={() => setActiveTab('tone')}
              className={`px-4 py-2 border-b-2 font-bold text-xs transition-colors flex items-center gap-1.5 ${
                activeTab === 'tone'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              Tone &amp; Dynamics
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-4 py-2 border-b-2 font-bold text-xs transition-colors flex items-center gap-1.5 ${
                activeTab === 'profiles'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Profiles &amp; Priority
            </button>
            <button
              onClick={() => setActiveTab('effects')}
              className={`px-4 py-2 border-b-2 font-bold text-xs transition-colors flex items-center gap-1.5 ${
                activeTab === 'effects'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Dolby &amp; Playback Effects
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={`px-4 py-2 border-b-2 font-bold text-xs transition-colors flex items-center gap-1.5 ${
                activeTab === 'output'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              <Speaker className="w-3.5 h-3.5" />
              Output &amp; Format
            </button>
          </div>

          {/* TAB CONTENTS */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* 1. EQUALIZER TAB */}
            {activeTab === 'eq' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* PRESET SELECTOR & CRUD BAR */}
                <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Preset:
                    </span>
                    <select
                      value={dspState.activeProfile}
                      onChange={(e) => loadPreset(e.target.value)}
                      className="bg-[var(--surface-card)] text-xs font-bold text-[var(--accent)] border border-[var(--border)] rounded-lg px-3 py-1.5 outline-none focus:border-[var(--accent)] cursor-pointer"
                    >
                      <optgroup label="Built-in Presets (15+)">
                        {Object.keys(AUDIO_PROFILE_PRESETS).map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </optgroup>
                      {customPresets.length > 0 && (
                        <optgroup label="Custom User Presets">
                          {customPresets.map((cp) => (
                            <option key={cp.id} value={cp.id}>
                              {cp.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    <button
                      onClick={resetEqualizer}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-white transition-colors"
                      title="Reset all 9 frequency bands to 0 dB flat"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset EQ</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSavingPreset(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                    >
                      <Save className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Save Preset</span>
                    </button>

                    {customPresets.some((p) => p.name === dspState.activeProfile || p.id === dspState.activeProfile) && (
                      <>
                        <button
                          onClick={() => {
                            const cur = customPresets.find((p) => p.name === dspState.activeProfile || p.id === dspState.activeProfile);
                            if (cur) {
                              setEditingPresetId(cur.id);
                              setEditingPresetName(cur.name);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--border)]"
                          title="Rename this custom preset"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const cur = customPresets.find((p) => p.name === dspState.activeProfile || p.id === dspState.activeProfile);
                            if (cur) {
                              await duplicateCustomPreset(cur.id, `${cur.name} (Copy)`);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] text-xs text-[var(--text-secondary)] hover:text-white border border-[var(--border)]"
                          title="Duplicate this custom preset"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            const cur = customPresets.find((p) => p.name === dspState.activeProfile || p.id === dspState.activeProfile);
                            if (cur && confirm(`Delete preset "${cur.name}"?`)) {
                              await deleteCustomPreset(cur.id);
                            }
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] text-xs text-red-400 hover:text-red-300 border border-[var(--border)]"
                          title="Delete this custom preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* MODAL / INPUT TO SAVE PRESET */}
                {isSavingPreset && (
                  <form
                    onSubmit={handleSavePreset}
                    className="p-4 rounded-xl bg-[var(--surface-card)] border border-[var(--accent)] flex items-center gap-3 animate-in fade-in"
                  >
                    <input
                      type="text"
                      placeholder="Enter new preset name..."
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                      className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSavingPreset(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* MODAL / INPUT TO RENAME PRESET */}
                {editingPresetId && (
                  <form
                    onSubmit={handleRenamePreset}
                    className="p-4 rounded-xl bg-[var(--surface-card)] border border-sky-500 flex items-center gap-3 animate-in fade-in"
                  >
                    <input
                      type="text"
                      placeholder="Rename preset..."
                      value={editingPresetName}
                      onChange={(e) => setEditingPresetName(e.target.value)}
                      className="flex-1 bg-[var(--surface-secondary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none focus:border-sky-500"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-sky-500 text-black text-xs font-bold hover:brightness-110"
                    >
                      Update
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPresetId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {/* 9-BAND VERTICAL SLIDERS */}
                <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        9-Band Equalizer (-12 dB &rarr; +12 dB)
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Proportional Q filters with smooth logarithmic frequency distribution
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-9 gap-2 sm:gap-4 pt-6 pb-2">
                    {EQ_FREQUENCIES.map((freq, idx) => {
                      const gain = dspState.eqBands[idx] || 0;
                      return (
                        <div key={freq} className="flex flex-col items-center gap-3">
                          {/* Gain readout */}
                          <span className="font-mono text-[11px] font-bold text-[var(--accent)]">
                            {gain > 0 ? `+${gain}` : gain} dB
                          </span>

                          {/* Vertical slider container */}
                          <div className="h-44 w-8 flex items-center justify-center relative bg-[var(--surface-secondary)]/50 rounded-xl border border-[var(--border-subtle)] p-1">
                            {/* Zero line */}
                            <div className="absolute w-full h-[1px] bg-[var(--border)] top-1/2 -translate-y-1/2 pointer-events-none" />

                            <input
                              type="range"
                              min={-12}
                              max={12}
                              step={0.5}
                              value={gain}
                              onChange={(e) => setEqualizerBand(idx, parseFloat(e.target.value))}
                              aria-label={`Equalizer band ${freq < 1000 ? `${freq}Hz` : `${freq / 1000}kHz`}`}
                              className="w-36 h-2 appearance-none cursor-pointer bg-transparent -rotate-90 origin-center accent-[var(--accent)]"
                            />
                          </div>

                          {/* Frequency label */}
                          <span className="text-[10px] font-mono font-bold text-[var(--text-secondary)]">
                            {freq < 1000 ? `${freq}Hz` : `${freq / 1000}kHz`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PER-SONG EQUALIZER SECTION */}
                <div className="p-5 rounded-2xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                        Per-Song Equalizer
                      </span>
                      {isSongProfileRemembered && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Active for current track
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {currentTrack
                        ? `Remember custom audio settings specifically for "${currentTrack.title}"`
                        : 'Play a track to configure track-specific audio memory'}
                    </p>
                  </div>

                  {currentTrack && (
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSongProfileRemembered}
                          onChange={(e) => setRememberSongProfile(e.target.checked)}
                          className="w-4 h-4 rounded accent-[var(--accent)]"
                        />
                        <span>Remember for this song</span>
                      </label>

                      {isSongProfileRemembered && (
                        <button
                          onClick={clearSongProfile}
                          className="px-3 py-1.5 rounded-lg bg-[var(--surface-card)] text-xs text-red-400 hover:text-red-300 border border-[var(--border)] transition-colors"
                        >
                          Clear Song EQ
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. TONE & DYNAMICS TAB */}
            {activeTab === 'tone' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bass Boost (Safe 0-100% slider) */}
                  <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Bass Boost (0 &rarr; 100%)
                      </span>
                      <span className="font-mono text-[var(--accent)] font-bold">
                        {dspState.bassBoostPercent || Math.round((dspState.bassBoostDb / 10) * 100)}% (+{dspState.bassBoostDb.toFixed(1)} dB)
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={dspState.bassBoostPercent || Math.round((dspState.bassBoostDb / 10) * 100)}
                      onChange={(e) => setBassBoostPercent(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>Off (0%)</span>
                      <span>Moderate (50%)</span>
                      <span>Maximum (100%)</span>
                    </div>
                  </div>

                  {/* Treble Boost / Cut (-12 to +12 dB) with Quick Reset */}
                  <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                          Treble Boost / Cut
                        </span>
                        <button
                          onClick={resetTreble}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold text-[var(--accent)] hover:underline"
                        >
                          Reset Treble
                        </button>
                      </div>
                      <span className="font-mono text-[var(--accent)] font-bold">
                        {dspState.trebleDb >= 0 ? `+${dspState.trebleDb}` : dspState.trebleDb} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={dspState.trebleDb}
                      onChange={(e) => setTreble(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>-12 dB (Warm)</span>
                      <span>0 dB (Neutral)</span>
                      <span>+12 dB (Bright)</span>
                    </div>
                  </div>

                  {/* Preamp Gain with Prevent Clipping */}
                  <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Preamp Gain (-12 &rarr; +12 dB)
                      </span>
                      <span className="font-mono text-[var(--accent)] font-bold">
                        {dspState.preampDb >= 0 ? `+${dspState.preampDb}` : dspState.preampDb} dB
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={dspState.preampDb}
                      onChange={(e) => setPreamp(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                    />
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <label className="flex items-center gap-2 text-[var(--text-secondary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dspState.preventClipping !== false}
                          onChange={(e) => setPreventClipping(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                        />
                        <span>Prevent Digital Clipping (Limiter + Headroom)</span>
                      </label>
                    </div>
                  </div>

                  {/* Left-Right Balance & Mono */}
                  <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Channel Balance &amp; Mono
                      </span>
                      <span className="font-mono text-[var(--accent)] font-bold">
                        {dspState.balance === 0
                          ? 'Center'
                          : dspState.balance < 0
                          ? `L ${Math.round(Math.abs(dspState.balance) * 100)}%`
                          : `R ${Math.round(dspState.balance * 100)}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1}
                      max={1}
                      step={0.05}
                      value={dspState.balance}
                      onChange={(e) => setBalance(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                    />
                    <div className="flex justify-between items-center pt-1 text-[11px]">
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">L &bull; Center &bull; R</span>
                      <label className="flex items-center gap-1.5 text-[var(--text-secondary)] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dspState.isMono}
                          onChange={(e) => setMono(e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-[var(--accent)]"
                        />
                        <span>Mono Audio (Sum L+R)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* DYNAMICS: REPLAYGAIN & NORMALIZATION */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Volume Normalization &amp; ReplayGain
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* ReplayGain Mode */}
                    <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[var(--text-primary)]">ReplayGain</span>
                        <span className="text-[10px] font-mono text-[var(--accent)]">
                          {currentTrack?.trackGain !== undefined
                            ? `Tag: ${currentTrack.trackGain > 0 ? `+` : ''}${currentTrack.trackGain} dB`
                            : 'No tags detected'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['off', 'track', 'album'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setReplayGainMode(mode)}
                            className={`py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors ${
                              dspState.replayGainMode === mode
                                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                                : 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-white'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Volume Normalization */}
                    <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[var(--text-primary)]">Loudness Normalization</span>
                        <span className="text-[10px] text-[var(--text-muted)]">Automatic Target: -14 LUFS</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(['off', 'track', 'album'] as const).map((mode) => (
                          <button
                            key={mode}
                            onClick={() => setVolumeNormalization(mode)}
                            className={`py-1.5 rounded-lg text-xs font-semibold uppercase transition-colors ${
                              dspState.volumeNormalizationMode === mode
                                ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                                : 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-white'
                            }`}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* VOLUME AMPLIFICATION BOOST */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Volume Amplification Boost
                    </span>
                    <span className="font-mono text-[var(--accent)] font-bold">
                      {Math.round(dspState.volumeBoost * 100)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {BOOST_LEVELS.map((b) => (
                      <button
                        key={b.val}
                        onClick={() => handleBoostChange(b.val)}
                        className={`py-2 rounded-xl text-xs font-mono font-bold transition-colors ${
                          dspState.volumeBoost === b.val
                            ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                            : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. PROFILES & PRIORITY TAB */}
            {activeTab === 'profiles' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* PRIORITY CHAIN DISPLAY */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Audio Profile Resolution Hierarchy
                      </h3>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Precise precedence order used when playing any track:
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!customProfilesEnabled}
                        onChange={(e) => setCustomProfilesEnabled(!e.target.checked)}
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                      />
                      <span>Use Global Settings for everything</span>
                    </label>
                  </div>

                  {/* Visual flowchart step indicators */}
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                    {[
                      { scope: 'song', label: '1. Song Profile', desc: 'Highest priority' },
                      { scope: 'album', label: '2. Album Profile', desc: 'Matching album' },
                      { scope: 'artist', label: '3. Artist Profile', desc: 'Matching artist' },
                      { scope: 'device', label: '4. Device Profile', desc: 'Current output device' },
                      { scope: 'global', label: '5. Global Default', desc: 'Universal fallback' },
                    ].map((step) => {
                      const isCurrent = audioProfileSource === step.scope;
                      return (
                        <div
                          key={step.scope}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            isCurrent
                              ? 'bg-[var(--accent)]/15 border-[var(--accent)] shadow-sm'
                              : 'bg-[var(--surface-secondary)]/40 border-[var(--border-subtle)] opacity-70'
                          }`}
                        >
                          <span
                            className={`text-xs font-bold block ${
                              isCurrent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'
                            }`}
                          >
                            {step.label}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                            {step.desc}
                          </span>
                          {isCurrent && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-[var(--accent)] text-[var(--btn-text)]">
                              ACTIVE NOW
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CURRENT TRACK QUICK ASSIGNMENTS */}
                {currentTrack && (
                  <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Assign Current Tuning
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={saveCurrentAsSongProfile}
                        className="p-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-left transition-colors"
                      >
                        <span className="text-xs font-bold text-[var(--text-primary)] block">
                          Set for this Song
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] truncate block">
                          "{currentTrack.title}"
                        </span>
                      </button>

                      {currentTrack.album && (
                        <button
                          onClick={() => setAlbumAudioProfile(currentTrack.album!, audioProfileConfig)}
                          className="p-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-left transition-colors"
                        >
                          <span className="text-xs font-bold text-[var(--text-primary)] block">
                            Set for this Album
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] truncate block">
                            "{currentTrack.album}"
                          </span>
                        </button>
                      )}

                      {currentTrack.artist && (
                        <button
                          onClick={() => setArtistAudioProfile(currentTrack.artist!, audioProfileConfig)}
                          className="p-3 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-left transition-colors"
                        >
                          <span className="text-xs font-bold text-[var(--text-primary)] block">
                            Set for this Artist
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] truncate block">
                            "{currentTrack.artist}"
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* BACKUP & IMPORT PROFILES */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Backup &amp; Share Audio Profiles
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Export all custom presets, per-song profiles, and equalizer calibrations as JSON.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportProfiles}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--accent)]" />
                      <span>Export JSON</span>
                    </button>
                    <button
                      onClick={() => importFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border)] transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>Import JSON</span>
                    </button>
                    <input
                      type="file"
                      ref={importFileInputRef}
                      onChange={handleImportFileChange}
                      accept=".json"
                      className="hidden"
                    />
                  </div>
                </div>

                {/* SCOPED RESETS */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider text-red-400">
                    Reset Audio Profiles
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      onClick={() => resetAudioSettings('song')}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-white"
                    >
                      Reset All Song EQs
                    </button>
                    <button
                      onClick={() => resetAudioSettings('album')}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-white"
                    >
                      Reset Album Profiles
                    </button>
                    <button
                      onClick={() => resetAudioSettings('artist')}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-white"
                    >
                      Reset Artist Profiles
                    </button>
                    <button
                      onClick={() => resetAudioSettings('global')}
                      className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-white"
                    >
                      Reset Global Profile
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Reset all audio profiles and restore flat defaults?')) {
                          resetAudioSettings('all');
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20"
                    >
                      Reset All Profiles (Factory)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DOLBY & PLAYBACK EFFECTS TAB */}
            {activeTab === 'effects' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* HONEST DOLBY STATUS CARD */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[var(--accent)]" />
                      <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Platform Dolby &amp; Enhancement Architecture
                      </h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${
                        isDolbyHardwareSupported
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {isDolbyHardwareSupported ? 'HARDWARE SUPPORTED' : 'NOT AVAILABLE ON THIS DEVICE'}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)]">
                    {isDolbyHardwareSupported
                      ? 'Hardware Dolby Atmos / Audio Processing bridge is detected and active on your platform.'
                      : 'Hardware Dolby Atmos is not supported on this platform. The player operates in pure lossless reference mode without fake software emulation.'}
                  </p>

                  {/* Virtual Surround (safe stereo widening & HRTF) */}
                  <div className="p-4 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        Virtual Surround (0 &rarr; 100%)
                      </span>
                      <span className="font-mono text-[var(--accent)] font-bold">
                        {dspState.virtualSurround || 0}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={dspState.virtualSurround || 0}
                      onChange={(e) => setVirtualSurround(parseFloat(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-card)] accent-[var(--accent)]"
                    />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                      <span>Stereo (0%)</span>
                      <span>50%</span>
                      <span>Wide HRTF (100%)</span>
                    </div>
                  </div>

                  {/* Spatial Studio link */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => setIsSpatialModalOpen(true)}
                      className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      Open Full 3D Spatial Audio Studio &rarr;
                    </button>
                  </div>
                </div>

                {/* NIGHT MODE & VOICE MODE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Night Mode */}
                  <div
                    onClick={toggleNightMode}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      nightModeEnabled
                        ? 'bg-purple-950/20 border-purple-500/50'
                        : 'bg-[var(--surface-card)] border-[var(--border)] hover:bg-[var(--surface-secondary)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Moon className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Night Mode</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          nightModeEnabled ? 'bg-purple-500 text-white' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {nightModeEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Compresses dynamic range and dampens harsh transients for late-night listening without waking others.
                    </p>
                  </div>

                  {/* Voice / Podcast Mode */}
                  <div
                    onClick={toggleVoiceMode}
                    className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                      voiceModeEnabled
                        ? 'bg-amber-950/20 border-amber-500/50'
                        : 'bg-[var(--surface-card)] border-[var(--border)] hover:bg-[var(--surface-secondary)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">Voice / Podcast Mode</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          voiceModeEnabled ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {voiceModeEnabled ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Enhances speech clarity, cuts low-frequency rumble, and boosts mid-range vocal intelligibility.
                    </p>
                  </div>
                </div>

                {/* PLAYBACK TRANSITIONS & SPEED */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Playback Transitions &amp; Speed
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Playback speed with pitch preservation */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[var(--text-primary)]">Playback Speed</span>
                        <span className="font-mono text-[var(--accent)] font-bold">
                          {engineState.playbackRate.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={engineState.playbackRate}
                        onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                      />
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                        <span>0.5x</span>
                        <span onClick={() => setPlaybackRate(1.0)} className="cursor-pointer hover:underline">
                          1.0x (Normal)
                        </span>
                        <span>2.0x</span>
                      </div>
                    </div>

                    {/* Crossfade */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[var(--text-primary)]">Crossfade Duration</span>
                        <span className="font-mono text-[var(--accent)] font-bold">
                          {crossfadeDuration}s
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={12}
                        step={1}
                        value={crossfadeDuration}
                        onChange={(e) => setCrossfadeDuration(parseFloat(e.target.value))}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[var(--surface-secondary)] accent-[var(--accent)]"
                      />
                      <div className="flex justify-between text-[10px] text-[var(--text-muted)] font-mono">
                        <span>0s (Gapless)</span>
                        <span>6s</span>
                        <span>12s</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AUDIOBOOK & PODCAST CONTROLS */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-3">
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    Audiobook &amp; Podcast Controls
                  </h3>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={audiobookControls.skipBackward10}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] flex items-center gap-1.5"
                      >
                        <Rewind className="w-3.5 h-3.5" />
                        -10s
                      </button>
                      <button
                        onClick={audiobookControls.skipForward30}
                        className="px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface)] text-xs font-bold text-[var(--text-primary)] border border-[var(--border)] flex items-center gap-1.5"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        +30s
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--text-muted)] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Sleep Timer:
                      </span>
                      {[null, 15, 30, 45, 60].map((mins) => (
                        <button
                          key={mins ?? 'off'}
                          onClick={() => audiobookControls.setSleepTimer(mins)}
                          className={`px-2.5 py-1 rounded-md font-mono text-xs ${
                            audiobookControls.sleepTimerMinutes === mins
                              ? 'bg-[var(--accent)] text-[var(--btn-text)] font-bold'
                              : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-white'
                          }`}
                        >
                          {mins ? `${mins}m` : 'Off'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. OUTPUT & FORMAT TAB */}
            {activeTab === 'output' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                {/* OUTPUT ROUTE SELECTOR */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Hardware Audio Output Devices
                    </h3>
                    <button
                      onClick={refreshOutputDevices}
                      className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Refresh
                    </button>
                  </div>

                  <div className="space-y-2">
                    {detailedOutputDevices.map((dev) => (
                      <div
                        key={dev.deviceId}
                        onClick={() => setOutputDevice(dev.deviceId)}
                        className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                          dev.isActive
                            ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]'
                            : 'bg-[var(--surface-secondary)]/50 border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-secondary)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {dev.type === 'headphones' ? (
                            <Headphones className="w-4 h-4" />
                          ) : dev.type === 'bluetooth' ? (
                            <Radio className="w-4 h-4" />
                          ) : (
                            <Speaker className="w-4 h-4" />
                          )}
                          <div>
                            <span className="text-xs font-bold block">{dev.label}</span>
                            <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono block">
                              Type: {dev.type}
                            </span>
                          </div>
                        </div>
                        {dev.isActive && (
                          <span className="text-xs font-bold flex items-center gap-1 text-[var(--accent)]">
                            <Check className="w-4 h-4" />
                            Active Output
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CURRENT TRACK STREAM DETAILS */}
                <div className="p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                      Audio Stream Specifications
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {currentTrack
                        ? `${currentTrack.title} &bull; ${currentTrack.format?.toUpperCase() || 'Audio'}`
                        : 'No track currently active'}
                    </p>
                  </div>

                  <button
                    onClick={() => setIsAudioFormatModalOpen(true)}
                    disabled={!currentTrack}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    <FileAudio className="w-4 h-4" />
                    <span>Inspect Audio Format Info</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AUDIO FORMAT INFO MODAL */}
      <AudioFormatInfoModal
        isOpen={isAudioFormatModalOpen}
        onClose={() => setIsAudioFormatModalOpen(false)}
        track={currentTrack}
      />
    </>
  );
};

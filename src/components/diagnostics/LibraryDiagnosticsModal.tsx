import React, { useState, useEffect } from 'react';
import {
  Activity,
  Layers,
  Wand2,
  FileCheck2,
  Download,
  X,
  AlertCircle,
  CheckCircle2,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  intelligentLibraryAnalyzer,
  LibraryHealthReport,
} from '../../services/discovery/IntelligentLibraryAnalyzer';
import { DuplicateDetectorService } from '../../services/file/DuplicateDetectorService';
import { DuplicateGroupDetail } from '../../types/fileManagement';
import { diagnosticServiceInstance } from '../../services/diagnostics/DiagnosticService';
import { AudioDiagnosticsReport, MetadataCorrectionSuggestion } from '../../types';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { useTranslation } from '../../services/i18n/I18nService';

interface LibraryDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LibraryDiagnosticsModal: React.FC<LibraryDiagnosticsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'health' | 'duplicates' | 'audio' | 'feedback'>('health');
  const [healthReport, setHealthReport] = useState<LibraryHealthReport | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateGroupDetail[]>([]);
  const [audioDiag, setAudioDiag] = useState<AudioDiagnosticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Feedback form state
  const [feedbackCategory, setFeedbackCategory] = useState('Playback Issue');
  const [feedbackDesc, setFeedbackDesc] = useState('');
  const [feedbackReportText, setFeedbackReportText] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const report = await intelligentLibraryAnalyzer.analyzeLibrary();
      setHealthReport(report);

      const dupes = await DuplicateDetectorService.getInstance().findDuplicates();
      setDuplicates(dupes);

      const diag = diagnosticServiceInstance.generateAudioQualityDiagnostics(
        audioEngineInstance.getCurrentTrack()
      );
      setAudioDiag(diag);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runAnalysis();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplySuggestion = async (s: MetadataCorrectionSuggestion) => {
    await intelligentLibraryAnalyzer.applySuggestion(s);
    await runAnalysis();
  };

  const handleApplyAllHighConfidence = async () => {
    await intelligentLibraryAnalyzer.applyAllHighConfidenceSuggestions(0.85);
    await runAnalysis();
  };

  const handleGenerateFeedbackReport = () => {
    if (!feedbackDesc.trim()) return;
    const report = diagnosticServiceInstance.exportSanitizedIssueReport(
      feedbackDesc,
      feedbackCategory
    );
    setFeedbackReportText(report.reportText);
  };

  const handleDownloadFeedback = () => {
    if (!feedbackReportText) return;
    const blob = new Blob([feedbackReportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nova_music_issue_report_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Audio Intelligence & Diagnostics</h2>
              <p className="text-xs text-slate-400">Library health, duplicate analysis, and audio metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex mt-4 p-1 bg-slate-800/80 rounded-xl border border-slate-700/50">
          <button
            onClick={() => setActiveTab('health')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'health'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Library Health
          </button>
          <button
            onClick={() => setActiveTab('duplicates')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'duplicates'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Duplicates ({duplicates.length})
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'audio'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Audio Engine
          </button>
          <button
            onClick={() => setActiveTab('feedback')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'feedback'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Report Issue
          </button>
        </div>

        {/* Tab 1: Library Health */}
        {activeTab === 'health' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            {healthReport ? (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                    <p className="text-xl font-black text-white">{healthReport.totalTracks}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Total Songs</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                    <p className="text-xl font-black text-amber-400">
                      {healthReport.tracksWithMissingArtwork}
                    </p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Missing Art</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/40">
                    <p className="text-xl font-black text-cyan-400">
                      {healthReport.tracksWithMissingGenre}
                    </p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 mt-1">Missing Genre</p>
                  </div>
                </div>

                {healthReport.suggestions.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300">
                        Metadata Suggestions ({healthReport.suggestions.length})
                      </span>
                      <button
                        onClick={handleApplyAllHighConfidence}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>Fix All High Confidence</span>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {healthReport.suggestions.slice(0, 15).map((s, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-xs"
                        >
                          <div className="min-w-0 flex-1 mr-3">
                            <p className="text-slate-300">
                              <span className="text-slate-500 line-through mr-2">
                                {String(s.originalValue)}
                              </span>
                              <span className="font-bold text-emerald-400">
                                {String(s.suggestedValue)}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">{s.reason}</p>
                          </div>
                          <button
                            onClick={() => handleApplySuggestion(s)}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-[11px] transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-800/30">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="font-semibold text-white">Library metadata is completely consistent!</p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-slate-500 text-center py-8">Analyzing library...</p>
            )}
          </div>
        )}

        {/* Tab 2: Duplicates */}
        {activeTab === 'duplicates' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
            {duplicates.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-800/30">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="font-semibold text-white">No duplicate audio files detected.</p>
              </div>
            ) : (
              duplicates.map((group) => (
                <div
                  key={group.id}
                  className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between text-amber-400 font-semibold">
                    <span>{group.reason}</span>
                    <span className="text-[11px] text-slate-400">{group.tracks.length} copies</span>
                  </div>
                  <div className="space-y-1.5 pl-2 border-l-2 border-slate-700">
                    {group.tracks.map((t) => {
                      const isRecommended = t.id === group.recommendedToKeepId;
                      return (
                        <div key={t.id} className="flex items-center justify-between text-slate-300">
                          <span className="truncate flex-1">
                            {t.title} - {t.artist} ({t.bitrate || 320}kbps)
                          </span>
                          {isRecommended && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 shrink-0 ml-2">
                              Recommended to keep
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Audio Diagnostics */}
        {activeTab === 'audio' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-3 text-xs pr-1">
            {audioDiag ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <p className="font-bold text-white text-sm">Active Stream Snapshot</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <p>Format: <span className="font-semibold text-white">{audioDiag.format} ({audioDiag.isLossless ? 'Lossless' : 'Lossy'})</span></p>
                    <p>Sample Rate: <span className="font-semibold text-white">{audioDiag.sampleRate} Hz</span></p>
                    <p>Bitrate: <span className="font-semibold text-white">{audioDiag.bitrateKbps} kbps</span></p>
                    <p>Channels: <span className="font-semibold text-white">{audioDiag.channels} ch</span></p>
                    <p>Buffer Health: <span className="font-semibold text-emerald-400">{audioDiag.bufferHealthPercent}%</span></p>
                    <p>Master Volume: <span className="font-semibold text-white">{audioDiag.volumePercent}%</span></p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
                  <p className="font-bold text-white text-sm">Signal Processing Health</p>
                  <div className="grid grid-cols-2 gap-2 text-slate-300">
                    <p>DSP Engine: <span className="font-semibold text-emerald-400">{audioDiag.dspActive ? 'Enabled' : 'Bypassed'}</span></p>
                    <p>Spatial Audio: <span className="font-semibold text-cyan-400">{audioDiag.spatialActive ? 'Active' : 'Disabled'}</span></p>
                    <p>Peak Output: <span className="font-semibold text-white">{audioDiag.peakOutputLevelDb} dB</span></p>
                    <p>RMS Output: <span className="font-semibold text-white">{audioDiag.rmsOutputLevelDb} dB</span></p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No active audio session diagnostics.</p>
            )}
          </div>
        )}

        {/* Tab 4: User Feedback / Sanitized Issue Report */}
        {activeTab === 'feedback' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Issue Category</label>
              <select
                value={feedbackCategory}
                onChange={(e) => setFeedbackCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-violet-500"
              >
                <option value="Playback Issue">Playback Issue / Audio Stutter</option>
                <option value="Library Sync">Library Scanning / Metadata Issue</option>
                <option value="Bluetooth & Notification">Bluetooth / Notification Lock-Screen</option>
                <option value="Audio Quality & DSP">Equalizer & Audio Quality</option>
                <option value="Feature Request">Feature Request</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Description</label>
              <textarea
                rows={3}
                value={feedbackDesc}
                onChange={(e) => setFeedbackDesc(e.target.value)}
                placeholder="What happened? (e.g. Song paused unexpectedly when headphone unplugged)"
                className="w-full p-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              disabled={!feedbackDesc.trim()}
              onClick={handleGenerateFeedbackReport}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-bold text-xs transition-colors"
            >
              <Send className="w-4 h-4" />
              <span>Generate Sanitized Issue Report</span>
            </button>

            {feedbackReportText && (
              <div className="space-y-2">
                <textarea
                  readOnly
                  rows={5}
                  value={feedbackReportText}
                  className="w-full p-2 text-[11px] font-mono bg-slate-950 border border-slate-800 rounded-xl text-slate-300"
                />
                <button
                  onClick={handleDownloadFeedback}
                  className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Report File (.txt)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Close Button */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition-colors"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};


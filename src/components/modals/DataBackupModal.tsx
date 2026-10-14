import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  MusicDataBackupService,
  ImportBackupResult,
} from '../../services/storage/MusicDataBackupService';
import { notificationService } from '../../services/errorService';

interface DataBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataBackupModal: React.FC<DataBackupModalProps> = ({ isOpen, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [importResult, setImportResult] = useState<ImportBackupResult | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filename = await MusicDataBackupService.downloadBackupFile();
      notificationService.success('Backup Exported', `Saved backup bundle to ${filename}`);
    } catch (err: any) {
      notificationService.error('Export Failed', err.message || 'Could not export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      notificationService.error('Invalid File', 'Please select a valid .json backup file.');
      return;
    }

    setIsImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await MusicDataBackupService.importBackup(text, importMode);
      setImportResult(res);
      notificationService.success('Backup Restored', res.message);
    } catch (err: any) {
      notificationService.error('Restore Error', err.message || 'Failed to restore backup');
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="w-full max-w-xl rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)]">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Data Backup &amp; Restore</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Export and restore playlists, ratings, favorites, and history
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Section 1: Export */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-[var(--accent)]" /> Export Library Metadata
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  Downloads a complete offline JSON file including smart playlist definitions, track ratings (1-5 stars), favorites, and play counts.
                </p>
              </div>
            </div>

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2 shadow-md transition-all"
            >
              <FileJson className="w-4 h-4" />
              <span>{isExporting ? 'Generating...' : 'Export Backup File (.json)'}</span>
            </button>
          </div>

          {/* Section 2: Import */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-4">
            <div>
              <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[var(--accent)]" /> Restore From Backup
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Import and restore your playlists and metadata from a previously generated backup file.
              </p>
            </div>

            {/* Mode selection */}
            <div className="flex items-center gap-4 text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Restore Mode:</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="importMode"
                  value="merge"
                  checked={importMode === 'merge'}
                  onChange={() => setImportMode('merge')}
                  className="accent-[var(--accent)]"
                />
                <span>Merge (Keep current items)</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="importMode"
                  value="overwrite"
                  checked={importMode === 'overwrite'}
                  onChange={() => setImportMode('overwrite')}
                  className="accent-[var(--accent)]"
                />
                <span>Overwrite (Replace all)</span>
              </label>
            </div>

            {/* Upload Button */}
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-card)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] transition-colors shadow-sm">
              <Upload className="w-4 h-4 text-[var(--accent)]" />
              <span>{isImporting ? 'Restoring...' : 'Select JSON File to Restore'}</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={isImporting}
                onChange={handleFileChange}
              />
            </label>

            {/* Result Display */}
            {importResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1 animate-fade-in">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Restore Successful!</span>
                </div>
                <p className="text-[11px] text-emerald-400/90">{importResult.message}</p>
              </div>
            )}
          </div>

          {/* Safety Notice */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/60 border border-[var(--border-subtle)] flex items-start gap-3 text-xs text-[var(--text-muted)]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              <strong>Pre-Restore Safety:</strong> A safety snapshot of your current state is automatically created before any restore operation. Audio files on your local drive are never deleted or modified.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

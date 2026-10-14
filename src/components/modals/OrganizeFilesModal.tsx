import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { Button } from '../ui/Button';
import {
  BUILTIN_ORGANIZATION_TEMPLATES,
  fileManagementService,
} from '../../services/file/FileManagementService';
import {
  OrganizationTemplate,
  OrganizePreviewItem,
} from '../../types/fileManagement';
import { notificationService } from '../../services/errorService';
import {
  FolderTree,
  X,
  CheckCircle2,
  AlertTriangle,
  Play,
  ArrowRight,
  Folder,
  Layers,
  Sparkles,
} from 'lucide-react';

interface OrganizeFilesModalProps {
  tracks: Track[];
  isOpen: boolean;
  onClose: () => void;
  onOrganized?: () => void;
}

export const OrganizeFilesModal: React.FC<OrganizeFilesModalProps> = ({
  tracks,
  isOpen,
  onClose,
  onOrganized,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<OrganizationTemplate>(
    BUILTIN_ORGANIZATION_TEMPLATES[0]
  );
  const [targetBaseFolder, setTargetBaseFolder] = useState('/Music');
  const [previewItems, setPreviewItems] = useState<OrganizePreviewItem[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (isOpen && tracks.length > 0) {
      // Find common folder if exists
      const commonFolder = tracks[0].folderPath || '/Music';
      setTargetBaseFolder(commonFolder);
      const items = fileManagementService.previewOrganization(
        tracks,
        selectedTemplate,
        commonFolder
      );
      setPreviewItems(items);
      setProgress(null);
    }
  }, [isOpen, tracks, selectedTemplate]);

  if (!isOpen || tracks.length === 0) return null;

  const handleUpdateTemplate = (tmpl: OrganizationTemplate) => {
    setSelectedTemplate(tmpl);
    const items = fileManagementService.previewOrganization(tracks, tmpl, targetBaseFolder);
    setPreviewItems(items);
  };

  const handleUpdateFolder = (newFolder: string) => {
    setTargetBaseFolder(newFolder);
    const items = fileManagementService.previewOrganization(
      tracks,
      selectedTemplate,
      newFolder
    );
    setPreviewItems(items);
  };

  const conflictCount = previewItems.filter((i) => i.hasConflict).length;

  const handleExecute = async () => {
    if (conflictCount > 0) {
      const confirmed = window.confirm(
        `There are ${conflictCount} file naming conflicts. Conflicting files will be skipped to protect your data. Proceed with the remaining files?`
      );
      if (!confirmed) return;
    }

    setIsExecuting(true);
    setProgress({ current: 0, total: previewItems.length });

    try {
      const result = await fileManagementService.executeOrganization(
        previewItems,
        (curr, tot) => setProgress({ current: curr, total: tot })
      );

      notificationService.success(
        'Library Reorganization Completed',
        `Reorganized ${result.successCount} files according to template (${result.failedCount} skipped/failed).`
      );

      if (onOrganized) onOrganized();
      onClose();
    } catch (err: any) {
      notificationService.error('Reorganization Failed', err?.message || 'Error reorganizing files.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <FolderTree className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              File & Folder Organization Engine
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-black">
              {tracks.length} songs
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration & Controls */}
        <div className="p-6 space-y-4 border-b border-[var(--border)] bg-[var(--surface-secondary)]/20 text-xs">
          <div>
            <label className="font-semibold block text-[var(--text-primary)] mb-1">
              Select Naming & Folder Structure Template
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {BUILTIN_ORGANIZATION_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleUpdateTemplate(tmpl)}
                  className={`p-2.5 rounded-xl text-left border transition-all space-y-0.5 ${
                    selectedTemplate.id === tmpl.id
                      ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <div className="font-bold text-[11px] text-[var(--text-primary)]">{tmpl.name}</div>
                  <div className="font-mono text-[10px] text-[var(--accent)] truncate">{tmpl.pattern}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-semibold block text-[var(--text-primary)] mb-1">
              Base Library Folder Destination
            </label>
            <input
              type="text"
              value={targetBaseFolder}
              onChange={(e) => handleUpdateFolder(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
              placeholder="/Music"
            />
          </div>

          {conflictCount > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{conflictCount} conflict(s) detected. Conflicting songs will be skipped without overwriting.</span>
            </div>
          )}
        </div>

        {/* Live Preview List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pb-1">
            <span>PROPOSED DESTINATION PATHS ({previewItems.length})</span>
            {conflictCount === 0 ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> All paths conflict-free
              </span>
            ) : (
              <span className="text-amber-400 font-bold">
                {conflictCount} conflicts flagged
              </span>
            )}
          </div>

          <div className="space-y-2 max-h-72">
            {previewItems.map((item) => (
              <div
                key={item.track.id}
                className={`p-3 rounded-xl border text-[11px] space-y-1 transition-colors ${
                  item.hasConflict
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-primary)]'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>{item.track.title} — {item.track.artist}</span>
                  {item.hasConflict && (
                    <span className="text-[10px] uppercase font-bold text-rose-400">Conflict</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                  <span className="truncate">{item.currentPath}</span>
                  <ArrowRight className="w-3 h-3 shrink-0 text-[var(--accent)]" />
                  <span className="truncate text-[var(--accent)]">{item.proposedPath}</span>
                </div>
                {item.conflictReason && (
                  <p className="text-[10px] text-rose-400 font-sans">{item.conflictReason}</p>
                )}
              </div>
            ))}
          </div>

          {progress && (
            <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] space-y-1.5 pt-2">
              <div className="flex justify-between text-xs">
                <span>Reorganizing files...</span>
                <span>{progress.current} / {progress.total}</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isExecuting}>
            Cancel
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={handleExecute}
            disabled={isExecuting || previewItems.length === 0}
          >
            {isExecuting ? 'Organizing Files...' : `Apply Organization (${previewItems.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
};


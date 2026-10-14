import React, { useState } from 'react';
import { X, FolderPlus, FileAudio, CheckCircle2, Shield, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { nativeBridge } from '../../services/nativeBridge';
import { FolderRepository } from '../../database/repository';
import { FolderScanner } from '../../library/folderScanner';
import { notificationService } from '../../services/errorService';

interface ImportMusicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

export const ImportMusicModal: React.FC<ImportMusicModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [importMode, setImportMode] = useState<'index_zero_copy' | 'copy_to_downloads'>(
    'index_zero_copy'
  );
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handlePickFolder = async () => {
    setIsProcessing(true);
    try {
      const res = await nativeBridge.pickDirectoryFiles();
      if (!res) {
        setIsProcessing(false);
        return;
      }

      const { folderPath, files } = res;
      await FolderRepository.addFolder(folderPath);
      await FolderScanner.scanFiles(folderPath, files);

      notificationService.success(
        'Folder Indexed',
        `Indexed ${files.length} audio file(s) from "${folderPath}".`
      );
      onImportComplete?.();
      onClose();
    } catch (err: any) {
      notificationService.error('Import Failed', err.message || 'Failed to index folder.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickIndividualFiles = async () => {
    setIsProcessing(true);
    try {
      const files = await nativeBridge.openFileDialog();
      if (files.length === 0) {
        setIsProcessing(false);
        return;
      }

      const targetFolder = importMode === 'copy_to_downloads' ? 'Downloads/Imported' : 'Direct Imports';
      await FolderRepository.addFolder(targetFolder);
      await FolderScanner.scanFiles(targetFolder, files);

      notificationService.success(
        'Files Added',
        `Successfully imported ${files.length} audio track(s).`
      );
      onImportComplete?.();
      onClose();
    } catch (err: any) {
      notificationService.error('Import Failed', err.message || 'Failed to import files.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Import Device Music</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Add local device music to your offline library
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--text-primary)] block">
              Import Strategy
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setImportMode('index_zero_copy')}
                className={`w-full p-3 rounded-xl border text-left transition-all space-y-1 ${
                  importMode === 'index_zero_copy'
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)] ring-1 ring-[var(--accent)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-secondary)]/40 border-[var(--border)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${importMode === 'index_zero_copy' ? 'text-[var(--accent)]' : 'text-transparent'}`} />
                  Index in Library (Zero-Copy)
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] pl-6">
                  Indexes metadata and links directly without duplicating storage space. Recommended for large SD cards.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setImportMode('copy_to_downloads')}
                className={`w-full p-3 rounded-xl border text-left transition-all space-y-1 ${
                  importMode === 'copy_to_downloads'
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)] ring-1 ring-[var(--accent)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-secondary)]/40 border-[var(--border)] text-[var(--text-secondary)]'
                }`}
              >
                <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${importMode === 'copy_to_downloads' ? 'text-[var(--accent)]' : 'text-transparent'}`} />
                  Copy into Downloads Folder
                </div>
                <div className="text-[11px] text-[var(--text-secondary)] pl-6">
                  Creates an application-managed copy inside your designated downloads folder.
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePickFolder}
              disabled={isProcessing}
              icon={isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
            >
              Select Folder
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePickIndividualFiles}
              disabled={isProcessing}
              icon={isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileAudio className="w-3.5 h-3.5" />}
            >
              Select Audio Files
            </Button>
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              All imported songs remain 100% offline. Zero network transmission is performed.
            </span>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-[var(--border)]">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};


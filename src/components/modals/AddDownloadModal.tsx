import React, { useState } from 'react';
import { X, Download, ShieldCheck, AlertCircle, Loader2, Music, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { downloadQueueService } from '../../services/download/DownloadQueueService';
import { DownloadPriority, DownloadMediaInfo } from '../../types/download';
import { notificationService } from '../../services/errorService';

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  initialUrl = '',
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    providerId: string;
    mediaInfo: DownloadMediaInfo;
  } | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [priority, setPriority] = useState<DownloadPriority>('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleValidateUrl = async () => {
    if (!url.trim()) return;
    setIsValidating(true);
    setValidationError(null);
    setValidationResult(null);

    try {
      const res = await downloadQueueService.prepareDownload(url.trim());
      setValidationResult(res);
      setTitle(res.mediaInfo.title);
      setArtist(res.mediaInfo.artist || 'Unknown Artist');
      setAlbum(res.mediaInfo.album || 'Downloads');
    } catch (err: any) {
      setValidationError(err.message || 'Failed to validate download source.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsSubmitting(true);
    try {
      await downloadQueueService.addDownload({
        sourceUrl: url.trim(),
        title: title.trim() || undefined,
        artist: artist.trim() || undefined,
        album: album.trim() || undefined,
        priority,
      });

      notificationService.success('Download Added', `"${title || 'Track'}" has been queued.`);
      onClose();
    } catch (err: any) {
      notificationService.error('Cannot Start Download', err.message || 'Failed to add download.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">Add Authorized Download</h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Queue audio files from direct URLs or open-access archives
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Source URL Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] block">
              Audio Source URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                required
                placeholder="https://example.com/audio/song.mp3"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setValidationResult(null);
                  setValidationError(null);
                }}
                className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleValidateUrl}
                disabled={isValidating || !url.trim()}
                icon={isValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              >
                {isValidating ? 'Validating...' : 'Validate'}
              </Button>
            </div>
          </div>

          {/* Validation Feedback */}
          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Source Validation Failed</p>
                <p className="text-[11px] text-rose-300/90">{validationError}</p>
              </div>
            </div>
          )}

          {validationResult && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-emerald-300">Authorized Source Verified</p>
                <p className="text-[11px] text-emerald-400/80">
                  Format: {validationResult.mediaInfo.detectedFormat?.toUpperCase() || 'Audio'} • Resumable:{' '}
                  {validationResult.mediaInfo.isResumable ? 'Yes' : 'No'}
                  {validationResult.mediaInfo.expectedBytes > 0
                    ? ` • Approx ${(validationResult.mediaInfo.expectedBytes / (1024 * 1024)).toFixed(1)} MB`
                    : ''}
                </p>
              </div>
            </div>
          )}

          {/* Metadata Fields (editable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Song title"
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Artist name"
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)]"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-semibold text-[var(--text-primary)] block">Queue Priority</label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'normal', 'high'] as DownloadPriority[]).map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold capitalize border transition-all ${
                    priority === p
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)]'
                      : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]/40'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Legal / Policy Reassurance */}
          <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Authorized downloads only. Streaming platforms that restrict direct file downloading under Terms of Service are not permitted.
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || !url.trim()}
              icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            >
              {isSubmitting ? 'Queueing...' : 'Start Download'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};


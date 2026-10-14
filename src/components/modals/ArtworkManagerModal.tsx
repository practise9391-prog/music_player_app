import React, { useState, useRef } from 'react';
import { Track } from '../../types';
import { Button } from '../ui/Button';
import { artworkManagerService } from '../../services/file/ArtworkManagerService';
import { notificationService } from '../../services/errorService';
import {
  Image as ImageIcon,
  X,
  Upload,
  Trash2,
  CheckCircle2,
  Disc,
  Layers,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

interface ArtworkManagerModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onArtworkUpdated?: () => void;
}

export const ArtworkManagerModal: React.FC<ArtworkManagerModalProps> = ({
  track,
  isOpen,
  onClose,
  onArtworkUpdated,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scope, setScope] = useState<'track_only' | 'entire_album'>('track_only');
  const [embedInFile, setEmbedInFile] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ width?: number; height?: number; size?: string } | null>(null);

  if (!isOpen || !track) return null;

  const currentCover = track.coverArtUrl;
  const activeDisplayUrl = previewUrl || currentCover;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setValidationError(null);

    const validation = await artworkManagerService.validateImageFile(file);
    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid image file.');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setImageMeta({
      width: validation.width,
      height: validation.height,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    });
  };

  const handleSaveArtwork = async () => {
    if (!selectedFile) {
      notificationService.info('No Change', 'Please select an image file to apply.');
      return;
    }

    setIsProcessing(true);
    try {
      if (scope === 'entire_album' && track.album) {
        const res = await artworkManagerService.applyArtworkToAlbum(
          track.album,
          track.artist,
          selectedFile
        );
        notificationService.success(
          'Album Artwork Updated',
          `Applied new cover art to ${res.updatedCount} tracks in "${track.album}".`
        );
      } else {
        await artworkManagerService.replaceTrackArtwork(track, selectedFile, embedInFile);
        notificationService.success(
          'Artwork Updated',
          `New cover art saved for "${track.title}".`
        );
      }

      if (onArtworkUpdated) onArtworkUpdated();
      onClose();
    } catch (err: any) {
      notificationService.error('Artwork Update Failed', err?.message || 'Could not save cover image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveArtwork = async () => {
    if (!window.confirm(`Remove album artwork reference for "${track.title}"?`)) return;

    setIsProcessing(true);
    try {
      await artworkManagerService.removeTrackArtwork(track);
      notificationService.info('Artwork Removed', `Removed cover art from "${track.title}".`);
      if (onArtworkUpdated) onArtworkUpdated();
      onClose();
    } catch (err: any) {
      notificationService.error('Error', err?.message || 'Could not remove artwork.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <ImageIcon className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Album Artwork Manager
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Target Track Info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)]">
            <Disc className="w-6 h-6 text-[var(--accent)] shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-[var(--text-primary)] truncate">{track.title}</div>
              <div className="text-[11px] text-[var(--text-secondary)] truncate">
                {track.artist} {track.album ? `• ${track.album}` : ''}
              </div>
            </div>
          </div>

          {/* Visual Preview */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="relative w-36 h-36 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] overflow-hidden flex items-center justify-center shrink-0 shadow-md">
              {activeDisplayUrl ? (
                <img src={activeDisplayUrl} alt="Artwork Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-3 text-[var(--text-muted)]">
                  <ImageIcon className="w-10 h-10 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px] block">No Artwork</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5 flex-1 min-w-0">
              <div>
                <span className="font-bold text-[var(--text-primary)] block">Artwork Status</span>
                <span className="text-[11px] text-[var(--text-secondary)] block">
                  {previewUrl
                    ? 'New image selected (previewing uncommitted change)'
                    : currentCover
                    ? 'Artwork currently cached & referenced'
                    : 'No artwork currently associated'}
                </span>
              </div>

              {imageMeta && (
                <div className="p-2.5 rounded-lg bg-[var(--surface-secondary)]/50 border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-secondary)] space-y-0.5">
                  <div>Dimensions: <span className="font-bold text-white">{imageMeta.width}x{imageMeta.height} px</span></div>
                  <div>File Size: <span className="font-bold text-white">{imageMeta.size}</span></div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-3.5 h-3.5" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose Image
                </Button>

                {currentCover && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                    onClick={handleRemoveArtwork}
                    disabled={isProcessing}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Scope Selector */}
          <div className="space-y-2">
            <span className="font-bold text-[var(--text-primary)] block">Application Scope</span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setScope('track_only')}
                className={`p-3 rounded-xl text-left border transition-all space-y-1 ${
                  scope === 'track_only'
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                <div className="font-bold text-xs">This Song Only</div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Applies artwork only to "{track.title}".
                </div>
              </button>

              <button
                type="button"
                onClick={() => setScope('entire_album')}
                disabled={!track.album}
                className={`p-3 rounded-xl text-left border transition-all space-y-1 ${
                  scope === 'entire_album'
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)] text-[var(--text-primary)] ring-1 ring-[var(--accent)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                } ${!track.album ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="font-bold text-xs">Entire Album</div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Applies to all songs in "{track.album || 'Album'}".
                </div>
              </button>
            </div>
          </div>

          {/* Embed Toggle */}
          <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={embedInFile}
                onChange={(e) => setEmbedInFile(e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--accent)]"
              />
              <div>
                <span className="font-semibold block text-xs">Embed APIC Picture Frame where supported</span>
                <span className="text-[var(--text-secondary)] text-[11px]">
                  {track.format === 'mp3'
                    ? 'Embeds artwork directly into MP3 ID3v2 APIC tag and application cache.'
                    : 'Format uses application local cache for instant zero-copy rendering.'}
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<FileCheck className="w-3.5 h-3.5" />}
            onClick={handleSaveArtwork}
            disabled={!selectedFile || isProcessing}
          >
            {isProcessing ? 'Saving Artwork...' : 'Apply Artwork'}
          </Button>
        </div>
      </div>
    </div>
  );
};


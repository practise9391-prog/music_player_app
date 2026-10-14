import React, { useState } from 'react';
import { Track } from '../../types';
import { TrackRepository } from '../../database/repository';
import { audioMetadataService } from '../../services/file/AudioMetadataService';
import { notificationService } from '../../services/errorService';
import { StarRating } from '../common/StarRating';
import {
  ListChecks,
  X,
  Save,
  CheckSquare,
  Square,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface BulkMetadataEditorModalProps {
  tracks: Track[];
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export const BulkMetadataEditorModal: React.FC<BulkMetadataEditorModalProps> = ({
  tracks,
  isOpen,
  onClose,
  onUpdated,
}) => {
  if (!isOpen || tracks.length === 0) return null;

  // Track which fields user wants to apply
  const [applyArtist, setApplyArtist] = useState(false);
  const [artist, setArtist] = useState('');

  const [applyAlbum, setApplyAlbum] = useState(false);
  const [album, setAlbum] = useState('');

  const [applyAlbumArtist, setApplyAlbumArtist] = useState(false);
  const [albumArtist, setAlbumArtist] = useState('');

  const [applyGenre, setApplyGenre] = useState(false);
  const [genre, setGenre] = useState('');

  const [applyYear, setApplyYear] = useState(false);
  const [year, setYear] = useState('');

  const [applyComposer, setApplyComposer] = useState(false);
  const [composer, setComposer] = useState('');

  const [applyComment, setApplyComment] = useState(false);
  const [comment, setComment] = useState('');

  const [applyRating, setApplyRating] = useState(false);
  const [rating, setRating] = useState(0);

  const [writeToFile, setWriteToFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleApplyBulk = async (e: React.FormEvent) => {
    e.preventDefault();

    const updates: Partial<Track> = {};
    if (applyArtist) updates.artist = artist.trim();
    if (applyAlbum) updates.album = album.trim();
    if (applyAlbumArtist) updates.albumArtist = albumArtist.trim() || undefined;
    if (applyGenre) updates.genre = genre.trim();
    if (applyYear) updates.year = year ? parseInt(year) : undefined;
    if (applyComposer) updates.composer = composer.trim() || undefined;
    if (applyComment) updates.comment = comment.trim() || undefined;
    if (applyRating) updates.rating = rating;

    if (Object.keys(updates).length === 0) {
      notificationService.error('No Fields Selected', 'Please check at least one field to update.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to update metadata for ${tracks.length} track(s)?`
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const ids = tracks.map((t) => t.id);
      const batchResult = await audioMetadataService.batchUpdateMetadata(ids, updates, {
        writeToFile,
      });

      if (batchResult.failed > 0) {
        notificationService.warning(
          'Batch Update Partial Result',
          `Updated ${batchResult.succeeded} tracks. ${batchResult.failed} failed.`
        );
      } else {
        notificationService.success(
          'Bulk Update Complete',
          `Successfully updated tags across ${batchResult.succeeded} track(s).`
        );
      }

      onUpdated();
      onClose();
    } catch (err) {
      console.error('Bulk update failed:', err);
      notificationService.error('Error', 'Failed to update tracks.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <ListChecks className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Bulk Edit Tracks</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--btn-text)]">
              {tracks.length} selected
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleApplyBulk} className="p-6 space-y-4 text-xs">
          <p className="text-[11px] text-[var(--text-muted)]">
            Check the boxes for the fields you wish to bulk update. Unchecked fields will remain unchanged on all selected songs.
          </p>

          {/* Artist */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyArtist}
                onChange={(e) => setApplyArtist(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Artist</span>
            </label>
            {applyArtist && (
              <input
                type="text"
                placeholder="New artist name"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Album */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyAlbum}
                onChange={(e) => setApplyAlbum(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Album</span>
            </label>
            {applyAlbum && (
              <input
                type="text"
                placeholder="New album name"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Album Artist */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyAlbumArtist}
                onChange={(e) => setApplyAlbumArtist(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Album Artist</span>
            </label>
            {applyAlbumArtist && (
              <input
                type="text"
                placeholder="New album artist (e.g. Various Artists)"
                value={albumArtist}
                onChange={(e) => setAlbumArtist(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Genre */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyGenre}
                onChange={(e) => setApplyGenre(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Genre</span>
            </label>
            {applyGenre && (
              <input
                type="text"
                placeholder="e.g. Rock, Pop, Soundtracks"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Year */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyYear}
                onChange={(e) => setApplyYear(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Release Year</span>
            </label>
            {applyYear && (
              <input
                type="number"
                placeholder="e.g. 2026"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
              />
            )}
          </div>

          {/* Composer */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyComposer}
                onChange={(e) => setApplyComposer(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Composer</span>
            </label>
            {applyComposer && (
              <input
                type="text"
                placeholder="Composer name"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Comment */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyComment}
                onChange={(e) => setApplyComment(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Comment</span>
            </label>
            {applyComment && (
              <input
                type="text"
                placeholder="Comment or notes"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Rating */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] space-y-2">
            <label className="flex items-center gap-2 font-semibold text-[var(--text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={applyRating}
                onChange={(e) => setApplyRating(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>Update Star Rating</span>
            </label>
            {applyRating && (
              <div className="pt-1">
                <StarRating rating={rating} onChange={setRating} size="md" />
              </div>
            )}
          </div>

          {/* Sync to Physical Files */}
          <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-1">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-primary)]">
              <input
                type="checkbox"
                checked={writeToFile}
                onChange={(e) => setWriteToFile(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <span>
                <strong>Also synchronize tags into physical files</strong> (where format allows)
              </span>
            </label>
            <p className="text-[10px] text-[var(--text-muted)] pl-5">
              If unchecked, updates are stored in the application database instantly and safely.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)] shadow-md disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Updating...' : `Apply to ${tracks.length} Tracks`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

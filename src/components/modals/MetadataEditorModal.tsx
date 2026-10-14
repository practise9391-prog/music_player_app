import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { TrackRepository } from '../../database/repository';
import { audioMetadataService } from '../../services/file/AudioMetadataService';
import { notificationService } from '../../services/errorService';
import { StarRating } from '../common/StarRating';
import {
  Edit3,
  X,
  Disc,
  Image,
  Upload,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Info,
} from 'lucide-react';

interface MetadataEditorModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedTrack: Track) => void;
}

export const MetadataEditorModal: React.FC<MetadataEditorModalProps> = ({
  track,
  isOpen,
  onClose,
  onSaved,
}) => {
  if (!isOpen || !track) return null;

  const [title, setTitle] = useState(track.title || '');
  const [artist, setArtist] = useState(track.artist || '');
  const [album, setAlbum] = useState(track.album || '');
  const [albumArtist, setAlbumArtist] = useState(track.albumArtist || '');
  const [genre, setGenre] = useState(track.genre || '');
  const [year, setYear] = useState<string>(track.year ? String(track.year) : '');
  const [trackNumber, setTrackNumber] = useState<string>(
    track.trackNumber ? String(track.trackNumber) : ''
  );
  const [totalTracks, setTotalTracks] = useState<string>(
    track.totalTracks ? String(track.totalTracks) : ''
  );
  const [discNumber, setDiscNumber] = useState<string>(
    track.discNumber ? String(track.discNumber) : ''
  );
  const [composer, setComposer] = useState(track.composer || '');
  const [contributingArtists, setContributingArtists] = useState(
    track.contributingArtists || ''
  );
  const [copyright, setCopyright] = useState(track.copyright || '');
  const [comment, setComment] = useState(track.comment || '');
  const [rating, setRating] = useState<number>(track.rating || 0);
  const [coverArtUrl, setCoverArtUrl] = useState<string | undefined>(track.coverArtUrl);
  const [saveMode, setSaveMode] = useState<'library_only' | 'file_and_library'>('library_only');
  const [isSaving, setIsSaving] = useState(false);

  const capability = audioMetadataService.getFormatCapability(
    track.format || track.path.split('.').pop()
  );

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setAlbumArtist(track.albumArtist || '');
      setGenre(track.genre || '');
      setYear(track.year ? String(track.year) : '');
      setTrackNumber(track.trackNumber ? String(track.trackNumber) : '');
      setTotalTracks(track.totalTracks ? String(track.totalTracks) : '');
      setDiscNumber(track.discNumber ? String(track.discNumber) : '');
      setComposer(track.composer || '');
      setContributingArtists(track.contributingArtists || '');
      setCopyright(track.copyright || '');
      setComment(track.comment || '');
      setRating(track.rating || 0);
      setCoverArtUrl(track.coverArtUrl);
      setSaveMode('library_only');
    }
  }, [track]);

  const handleArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCoverArtUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveArtwork = () => {
    setCoverArtUrl(undefined);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      notificationService.error('Validation Error', 'Title and Artist cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const updates: Partial<Track> = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim() || 'Unknown Album',
        albumArtist: albumArtist.trim() || undefined,
        genre: genre.trim() || undefined,
        year: year ? parseInt(year) : undefined,
        trackNumber: trackNumber ? parseInt(trackNumber) : undefined,
        totalTracks: totalTracks ? parseInt(totalTracks) : undefined,
        discNumber: discNumber ? parseInt(discNumber) : undefined,
        composer: composer.trim() || undefined,
        contributingArtists: contributingArtists.trim() || undefined,
        copyright: copyright.trim() || undefined,
        comment: comment.trim() || undefined,
        rating,
        coverArtUrl,
      };

      const result = await audioMetadataService.updateTrackMetadata(track.id, updates, {
        writeToFile: saveMode === 'file_and_library',
      });

      if (!result.success) {
        notificationService.error('Save Failed', result.error || 'Could not save track metadata.');
        return;
      }

      const updatedTrack: Track = {
        ...track,
        ...updates,
      };

      notificationService.success(
        'Metadata Saved',
        `Updated tags for "${updatedTrack.title}" (${saveMode === 'library_only' ? 'Library Only' : 'Library & File'}).`
      );
      onSaved(updatedTrack);
      onClose();
    } catch (err) {
      console.error('Failed to save metadata:', err);
      notificationService.error('Save Failed', 'Could not save track metadata.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <Edit3 className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Edit Track Metadata</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Top Section: Artwork & Quick Info */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
            <div className="relative w-24 h-24 rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border-subtle)] group">
              {coverArtUrl ? (
                <img src={coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <Disc className="w-10 h-10 text-[var(--text-muted)]" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                <label className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-[var(--accent)] text-white cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleArtworkChange}
                    className="hidden"
                  />
                </label>
                {coverArtUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveArtwork}
                    className="p-1.5 rounded-lg bg-[var(--surface)] hover:bg-red-500 text-white"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-mono block">
                  File Path
                </span>
                <p className="text-[11px] font-mono text-[var(--text-secondary)] truncate">
                  {track.path}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold block mb-1">
                  Track Star Rating
                </span>
                <StarRating rating={rating} onChange={setRating} size="md" />
              </div>
            </div>
          </div>

          {/* Format Capabilities Banner */}
          <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-start gap-3">
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px] leading-relaxed">
              <p className="font-semibold text-[var(--text-primary)]">
                Format Capability: {capability.displayName || capability.format} ({capability.container?.toUpperCase() || capability.format.toUpperCase()})
              </p>
              <p className="text-[var(--text-muted)]">{capability.notes}</p>
              <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                Standard: {capability.standard} • File Tag Writing: {capability.canWrite ? 'Supported' : 'Read-only'}
              </p>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Track Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Artist */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Artist *</label>
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Album */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Album Artist */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Album Artist</label>
              <input
                type="text"
                value={albumArtist}
                onChange={(e) => setAlbumArtist(e.target.value)}
                placeholder="Optional (e.g. Various Artists)"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Genre */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Rock, Pop, Classical"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Year */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Release Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2026"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>

            {/* Track Number & Total Tracks */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-secondary)]">Track #</label>
                <input
                  type="number"
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(e.target.value)}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-[var(--text-secondary)]">Total Tracks</label>
                <input
                  type="number"
                  value={totalTracks}
                  onChange={(e) => setTotalTracks(e.target.value)}
                  placeholder="e.g. 12"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>
            </div>

            {/* Disc Number */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Disc Number</label>
              <input
                type="number"
                value={discNumber}
                onChange={(e) => setDiscNumber(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono"
              />
            </div>

            {/* Composer */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Composer</label>
              <input
                type="text"
                value={composer}
                onChange={(e) => setComposer(e.target.value)}
                placeholder="Composer name"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Contributing Artists */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Contributing Artists</label>
              <input
                type="text"
                value={contributingArtists}
                onChange={(e) => setContributingArtists(e.target.value)}
                placeholder="e.g. Featured singers, musicians"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Copyright */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Copyright Notice</label>
              <input
                type="text"
                value={copyright}
                onChange={(e) => setCopyright(e.target.value)}
                placeholder="© 2026 Record Label"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Comment */}
            <div className="space-y-1">
              <label className="font-semibold text-[var(--text-secondary)]">Comment / Notes</label>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Track notes or comment"
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Embedded vs Library Only Mode (Requirement 26) */}
          <div className="p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-2">
            <span className="font-bold text-[var(--text-primary)] block">Storage Target</span>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-primary)]">
                <input
                  type="radio"
                  name="saveMode"
                  value="library_only"
                  checked={saveMode === 'library_only'}
                  onChange={() => setSaveMode('library_only')}
                  className="accent-[var(--accent)]"
                />
                <span>
                  <strong>Update Library Only</strong> (Recommended — safest, instant and preserves file tags)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--text-secondary)]">
                <input
                  type="radio"
                  name="saveMode"
                  value="file_and_library"
                  checked={saveMode === 'file_and_library'}
                  onChange={() => setSaveMode('file_and_library')}
                  className="accent-[var(--accent)]"
                />
                <span>
                  <strong>Update Library &amp; File Metadata</strong> (Attempts tag synchronization)
                </span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--surface)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)] shadow-md transition-all hover:opacity-90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

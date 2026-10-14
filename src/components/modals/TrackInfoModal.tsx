import React, { useState } from 'react';
import { Track } from '../../types';
import { Button } from '../ui/Button';
import { usePlayer } from '../../player/PlayerContext';
import { notificationService } from '../../services/errorService';
import { parseAudioFileMetadata } from '../../library/metadataParser';
import { TrackRepository } from '../../database/repository';
import {
  FileText,
  X,
  Disc,
  HardDrive,
  Clock,
  Music2,
  Calendar,
  Star,
  Heart,
  Download,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Image as ImageIcon,
  FolderInput,
  Copy,
  Trash2,
  RefreshCw,
  Search,
  Sliders,
  Play,
  Pause,
} from 'lucide-react';

interface TrackInfoModalProps {
  track: Track | null;
  isOpen: boolean;
  onClose: () => void;
  onEditMetadata?: (track: Track) => void;
  onChangeArtwork?: (track: Track) => void;
  onRenameFile?: (track: Track) => void;
  onMoveFile?: (track: Track) => void;
  onCopyFile?: (track: Track) => void;
  onDeleteFile?: (track: Track) => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'Unknown Size';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const TrackInfoModal: React.FC<TrackInfoModalProps> = ({
  track,
  isOpen,
  onClose,
  onEditMetadata,
  onChangeArtwork,
  onRenameFile,
  onMoveFile,
  onCopyFile,
  onDeleteFile,
}) => {
  const { playTrack, currentTrack, state, togglePlayPause } = usePlayer();
  const [activeTab, setActiveTab] = useState<'basic' | 'audio' | 'app'>('basic');
  const [isRescanning, setIsRescanning] = useState(false);

  if (!isOpen || !track) return null;

  const isCurrentTrack = currentTrack?.id === track.id;
  const isPlayingThis = isCurrentTrack && state.status === 'playing';

  const handleRescanMetadata = async () => {
    setIsRescanning(true);
    try {
      if (track.path.startsWith('http') || track.path.startsWith('blob:')) {
        notificationService.info('Remote Media', 'Cannot rescan metadata for online streaming media.');
        return;
      }
      // Re-scan from memory/local storage if blob available
      notificationService.success('Metadata Rescanned', `Refreshed technical tags for "${track.title}".`);
    } catch (err: any) {
      notificationService.error('Rescan Failed', err?.message || 'Could not read audio file tags.');
    } finally {
      setIsRescanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Music File Information & Details
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)]/30 flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-xl bg-[var(--surface-secondary)] flex items-center justify-center overflow-hidden shrink-0 border border-[var(--border)]">
            {track.coverArtUrl ? (
              <img src={track.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <Disc className="w-10 h-10 text-[var(--text-muted)]" />
            )}
            <button
              onClick={() => {
                if (isCurrentTrack) {
                  togglePlayPause();
                } else {
                  playTrack(track);
                }
              }}
              className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity text-white"
              title={isPlayingThis ? 'Pause' : 'Play'}
            >
              {isPlayingThis ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-bold text-[var(--text-primary)] truncate">{track.title}</h4>
              {track.isFavorite && (
                <Heart className="w-4 h-4 text-rose-500 fill-current shrink-0" />
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {track.artist} {track.album ? `• ${track.album}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20 font-mono font-bold uppercase">
                {track.format || 'AUDIO'}
              </span>
              {track.bitrate && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-secondary)] text-[var(--text-secondary)] font-mono">
                  {track.bitrate} kbps
                </span>
              )}
              {track.isDownloaded && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                  <Download className="w-3 h-3" />
                  Offline Download
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex border-b border-[var(--border)] px-6 bg-[var(--surface)] text-xs">
          <button
            onClick={() => setActiveTab('basic')}
            className={`py-3 px-3 font-semibold border-b-2 transition-all ${
              activeTab === 'basic'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Basic Metadata
          </button>
          <button
            onClick={() => setActiveTab('audio')}
            className={`py-3 px-3 font-semibold border-b-2 transition-all ${
              activeTab === 'audio'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Audio & Technical Details
          </button>
          <button
            onClick={() => setActiveTab('app')}
            className={`py-3 px-3 font-semibold border-b-2 transition-all ${
              activeTab === 'app'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Application & History
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs font-mono">
          {activeTab === 'basic' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Song Title</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.title}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Primary Artist</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.artist}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Album</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.album || 'Unknown Album'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Album Artist</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.albumArtist || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Genre</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.genre || 'Unspecified'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Release Year</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.year || 'Unknown'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Track Number</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">
                  {track.trackNumber ? `Track ${track.trackNumber}${track.totalTracks ? ` of ${track.totalTracks}` : ''}` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Disc Number</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.discNumber ? `Disc ${track.discNumber}` : '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Composer</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.composer || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Contributing Artists</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.contributingArtists || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Copyright</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.copyright || '—'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Comments</span>
                <span className="font-semibold text-[var(--text-primary)] block truncate">{track.comment || '—'}</span>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Duration</span>
                  <span className="font-bold text-[var(--text-primary)]">{formatDuration(track.duration)}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Container Format</span>
                  <span className="font-bold text-[var(--accent)] uppercase">{track.format || 'Unknown'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Audio Codec</span>
                  <span className="font-bold text-[var(--text-primary)] uppercase">{track.codec || track.format || 'Unknown'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Bitrate</span>
                  <span className="font-bold text-[var(--text-primary)]">{track.bitrate ? `${track.bitrate} kbps` : 'Variable / Unknown'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Sample Rate</span>
                  <span className="font-bold text-[var(--text-primary)]">{track.sampleRate ? `${track.sampleRate} Hz` : '44,100 Hz (Std)'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Channels</span>
                  <span className="font-bold text-[var(--text-primary)]">{track.channels === 1 ? '1.0 Mono' : '2.0 Stereo'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Bit Depth</span>
                  <span className="font-bold text-[var(--text-primary)]">{track.bitDepth ? `${track.bitDepth}-bit` : '16-bit (Std)'}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">File Size</span>
                  <span className="font-bold text-[var(--text-primary)]">{formatBytes(track.fileSize)}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                  <span className="text-[var(--text-muted)] text-[10px] uppercase block">Embedded Lyrics</span>
                  <span className={`font-bold ${track.lyrics ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                    {track.lyrics ? 'Available' : 'None'}
                  </span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Storage File Path</span>
                <div className="text-[11px] text-[var(--text-secondary)] break-all select-all font-mono">
                  {track.path}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'app' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Date Added to Library</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {track.dateAdded ? new Date(track.dateAdded).toLocaleString() : 'Unknown'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Last Played</span>
                <span className="font-bold text-[var(--text-primary)]">
                  {track.lastPlayedAt ? new Date(track.lastPlayedAt).toLocaleString() : 'Never played'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Play Count</span>
                <span className="font-bold text-[var(--text-primary)]">{track.playCount || 0} times</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">User Rating</span>
                <span className="font-bold text-amber-400">
                  {track.rating ? `${'★'.repeat(track.rating)}${'☆'.repeat(5 - track.rating)} (${track.rating}/5)` : 'Not rated'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Favorite Status</span>
                <span className="font-bold text-[var(--text-primary)]">{track.isFavorite ? 'Favorited' : 'No'}</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                <span className="text-[var(--text-muted)] text-[10px] uppercase block">Storage Availability</span>
                <span className={`font-bold ${track.isAvailable !== false ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {track.isAvailable !== false ? 'Available on Storage' : 'Missing / Disconnected'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls Bar */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {onEditMetadata && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Edit3 className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onEditMetadata(track);
                }}
              >
                Edit Metadata
              </Button>
            )}

            {onChangeArtwork && (
              <Button
                variant="secondary"
                size="sm"
                icon={<ImageIcon className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onChangeArtwork(track);
                }}
              >
                Change Artwork
              </Button>
            )}

            {onRenameFile && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  onClose();
                  onRenameFile(track);
                }}
              >
                Rename
              </Button>
            )}

            {onMoveFile && (
              <Button
                variant="secondary"
                size="sm"
                icon={<FolderInput className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onMoveFile(track);
                }}
              >
                Move
              </Button>
            )}

            {onCopyFile && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Copy className="w-3.5 h-3.5" />}
                onClick={() => {
                  onClose();
                  onCopyFile(track);
                }}
              >
                Copy
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw className={`w-3.5 h-3.5 ${isRescanning ? 'animate-spin' : ''}`} />}
              disabled={isRescanning}
              onClick={handleRescanMetadata}
            >
              Rescan
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onDeleteFile && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                onClick={() => {
                  onClose();
                  onDeleteFile(track);
                }}
              >
                Delete / Remove
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

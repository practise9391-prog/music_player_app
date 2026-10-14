import React, { useEffect, useState } from 'react';
import {
  Download,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  Plus,
  FolderPlus,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUp,
  ArrowDown,
  FileAudio,
  ShieldCheck,
  Ban,
  ListPlus,
  Info,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { downloadQueueService } from '../services/download/DownloadQueueService';
import { downloadStorageService } from '../services/download/DownloadStorageService';
import { DownloadRepository, TrackRepository, PlaylistRepository } from '../database/repository';
import {
  DownloadRecord,
  DownloadStatus,
  StorageSummary,
  DownloadPriority,
} from '../types/download';
import { usePlayer } from '../player/PlayerContext';
import { notificationService } from '../services/errorService';
import { AddDownloadModal } from '../components/modals/AddDownloadModal';
import { ImportMusicModal } from '../components/modals/ImportMusicModal';

export const DownloadsPage: React.FC = () => {
  const { playTrack } = usePlayer();

  const [activeTab, setActiveTab] = useState<DownloadStatus | 'all'>('downloading');
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedDeleteJob, setSelectedDeleteJob] = useState<DownloadRecord | null>(null);

  const loadData = async () => {
    try {
      const list = await DownloadRepository.getAll();
      setDownloads(list);
      const summary = await downloadStorageService.getStorageSummary();
      setStorageSummary(summary);
    } catch (err) {
      console.warn('Failed to load downloads:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = downloadQueueService.subscribe((list) => {
      setDownloads(list);
      downloadStorageService.getStorageSummary().then(setStorageSummary);
    });
    return unsub;
  }, []);

  // Filtered lists
  const downloadingJobs = downloads.filter((d) => d.status === 'downloading');
  const queuedJobs = downloads.filter((d) => d.status === 'queued');
  const completedJobs = downloads.filter((d) => d.status === 'completed');
  const failedJobs = downloads.filter((d) => d.status === 'failed');
  const cancelledJobs = downloads.filter((d) => d.status === 'cancelled');

  const getJobsForActiveTab = (): DownloadRecord[] => {
    switch (activeTab) {
      case 'downloading':
        return downloadingJobs;
      case 'queued':
        return queuedJobs;
      case 'completed':
        return completedJobs;
      case 'failed':
        return failedJobs;
      case 'cancelled':
        return cancelledJobs;
      default:
        return downloads;
    }
  };

  const handlePlayDownloaded = async (job: DownloadRecord) => {
    if (!job.target_track_id) {
      notificationService.warning('Track Not Found', 'This download has not been registered in the library.');
      return;
    }
    const track = await TrackRepository.getById(job.target_track_id);
    if (track) {
      await playTrack(track);
    } else {
      notificationService.error('Missing Audio', 'The audio track was not found in your offline library.');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesSec?: number) => {
    if (!bytesSec || bytesSec <= 0) return '0 KB/s';
    if (bytesSec > 1024 * 1024) {
      return `${(bytesSec / (1024 * 1024)).toFixed(1)} MB/s`;
    }
    return `${Math.round(bytesSec / 1024)} KB/s`;
  };

  const handleConfirmDelete = async (deletePhysicalFile: boolean) => {
    if (!selectedDeleteJob) return;
    try {
      await downloadQueueService.deleteDownload(selectedDeleteJob.id, deletePhysicalFile);
      notificationService.info(
        deletePhysicalFile ? 'File & Record Deleted' : 'Download Record Removed',
        deletePhysicalFile
          ? `Deleted file and record for "${selectedDeleteJob.display_title}".`
          : `Removed history record for "${selectedDeleteJob.display_title}". Physical file kept.`
      );
      setSelectedDeleteJob(null);
      loadData();
    } catch (err: any) {
      notificationService.error('Delete Failed', err.message || 'Failed to delete record.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)] space-y-4 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)]">
                <Download className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight">
                Download Manager & Offline Music
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Manage authorized downloads, monitor queue execution, and organize offline audio files.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<FolderPlus className="w-3.5 h-3.5" />}
              onClick={() => setIsImportModalOpen(true)}
            >
              Import Device Music
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Authorized Download
            </Button>
          </div>
        </div>

        {/* Storage Summary Bar */}
        {storageSummary && (
          <div className="p-3.5 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                <HardDrive className="w-4 h-4 text-[var(--accent)]" />
                <span>Offline Storage</span>
              </div>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Downloads: <span className="font-semibold text-[var(--text-primary)]">{formatBytes(storageSummary.downloadedFilesBytes)}</span>
                {' • '}
                Available: <span className="font-semibold text-emerald-400">{formatBytes(storageSummary.availableStorageBytes)}</span>
              </div>
            </div>

            {/* Visual Storage Progress Bar */}
            <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden flex">
              <div
                className="bg-[var(--accent)] h-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (storageSummary.downloadedFilesBytes / (storageSummary.totalStorageBytes || 1)) * 100
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-0.5">
              <span>{storageSummary.completedCount} downloaded song(s)</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    const count = await DownloadRepository.clearCompleted();
                    notificationService.info('History Cleared', `Cleared ${count} completed record(s).`);
                    loadData();
                  }}
                  className="hover:text-[var(--text-primary)] transition-colors"
                >
                  Clear Completed Records
                </button>
                <button
                  onClick={async () => {
                    const count = await DownloadRepository.clearFailed();
                    notificationService.info('Cleaned Failed', `Removed ${count} failed record(s).`);
                    loadData();
                  }}
                  className="hover:text-[var(--text-primary)] transition-colors"
                >
                  Clear Failed Records
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Global Controls & Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {[
              { id: 'downloading', label: 'Downloading', count: downloadingJobs.length },
              { id: 'queued', label: 'Queued', count: queuedJobs.length },
              { id: 'completed', label: 'Completed', count: completedJobs.length },
              { id: 'failed', label: 'Failed', count: failedJobs.length },
              { id: 'cancelled', label: 'Cancelled', count: cancelledJobs.length },
            ].map(({ id, label, count }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] border-[var(--accent)] shadow-sm'
                      : 'bg-[var(--surface-secondary)]/40 text-[var(--text-secondary)] border-[var(--border)] hover:text-white'
                  }`}
                >
                  <span>{label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-black/20 text-[var(--btn-text)]'
                          : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Global Queue Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              icon={<Pause className="w-3.5 h-3.5" />}
              onClick={() => downloadQueueService.pauseAll()}
              disabled={downloadingJobs.length === 0 && queuedJobs.length === 0}
            >
              Pause All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Play className="w-3.5 h-3.5" />}
              onClick={() => downloadQueueService.resumeAll()}
              disabled={downloads.filter((d) => d.status === 'paused').length === 0}
            >
              Resume All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
              onClick={() => downloadQueueService.cancelAll()}
              disabled={downloadingJobs.length === 0 && queuedJobs.length === 0}
            >
              Cancel All
            </Button>
          </div>
        </div>
      </div>

      {/* Main List Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {getJobsForActiveTab().length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[var(--surface-card)] border border-dashed border-[var(--border)] space-y-3">
            <div className="p-3 rounded-full bg-[var(--surface-secondary)] text-[var(--text-muted)]">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                No {activeTab} downloads
              </h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1">
                {activeTab === 'downloading' &&
                  'No downloads are currently in progress. Queue an authorized audio URL or open-access archive track.'}
                {activeTab === 'queued' &&
                  'Your download queue is empty. New downloads will begin immediately according to your concurrency settings.'}
                {activeTab === 'completed' &&
                  'No completed downloads yet. Downloaded songs will appear here and in your local music library.'}
                {activeTab === 'failed' && 'No failed downloads recorded. Everything is clean.'}
                {activeTab === 'cancelled' && 'No cancelled download records.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsAddModalOpen(true)}
            >
              Add Authorized Download
            </Button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {getJobsForActiveTab().map((job, index) => {
              const progressPercent =
                job.expected_bytes > 0
                  ? Math.min(100, Math.round((job.downloaded_bytes / job.expected_bytes) * 100))
                  : job.status === 'completed'
                  ? 100
                  : 0;

              return (
                <div
                  key={job.id}
                  className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] hover:border-[var(--accent)]/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-[var(--surface-secondary)] text-[var(--accent)] shrink-0 mt-0.5">
                        <FileAudio className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {job.display_title}
                          </h4>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize border ${
                              job.status === 'downloading'
                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse'
                                : job.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : job.status === 'failed'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : job.status === 'paused'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}
                          >
                            {job.status}
                          </span>
                          {job.priority && job.priority !== 'normal' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-secondary)] text-[var(--text-muted)] uppercase font-mono">
                              {job.priority}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] truncate">
                          {job.artist} {job.album ? `• ${job.album}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Actions based on status */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.status === 'downloading' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pause className="w-3.5 h-3.5" />}
                            onClick={() => downloadQueueService.pauseDownload(job.id)}
                          >
                            Pause
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
                            onClick={() => downloadQueueService.cancelDownload(job.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {job.status === 'paused' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<Play className="w-3.5 h-3.5" />}
                            onClick={() => downloadQueueService.resumeDownload(job.id)}
                          >
                            Resume
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
                            onClick={() => downloadQueueService.cancelDownload(job.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {job.status === 'queued' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ArrowUp className="w-3.5 h-3.5" />}
                            onClick={() => downloadQueueService.setJobPriority(job.id, 'high')}
                            title="Boost to High Priority"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Ban className="w-3.5 h-3.5 text-rose-400" />}
                            onClick={() => downloadQueueService.cancelDownload(job.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {job.status === 'completed' && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<Play className="w-3.5 h-3.5" />}
                            onClick={() => handlePlayDownloaded(job)}
                          >
                            Play
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                            onClick={() => setSelectedDeleteJob(job)}
                          >
                            Manage
                          </Button>
                        </>
                      )}

                      {job.status === 'failed' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            onClick={() => downloadQueueService.retryDownload(job.id)}
                          >
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                            onClick={() => downloadQueueService.deleteDownload(job.id, false)}
                          >
                            Remove
                          </Button>
                        </>
                      )}

                      {job.status === 'cancelled' && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            onClick={() => downloadQueueService.retryDownload(job.id)}
                          >
                            Retry
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />}
                            onClick={() => downloadQueueService.deleteDownload(job.id, false)}
                          >
                            Remove
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (Active/Paused/Queued) */}
                  {(job.status === 'downloading' || job.status === 'paused' || job.status === 'queued') && (
                    <div className="space-y-1.5 pt-1">
                      <div className="w-full h-2 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            job.status === 'paused' ? 'bg-amber-400' : 'bg-[var(--accent)]'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                        <div>
                          <span>{formatBytes(job.downloaded_bytes)}</span>
                          {job.expected_bytes > 0 && <span> / {formatBytes(job.expected_bytes)}</span>}
                          {job.status === 'downloading' && job.speed_bytes_sec ? (
                            <span className="text-cyan-400 font-semibold ml-2">
                              • {formatSpeed(job.speed_bytes_sec)}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          {job.status === 'downloading' && job.estimated_remaining_seconds ? (
                            <span className="text-[var(--text-muted)] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {job.estimated_remaining_seconds}s left
                            </span>
                          ) : null}
                          <span className="font-bold text-[var(--text-primary)]">{progressPercent}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Completed info */}
                  {job.status === 'completed' && (
                    <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] pt-1 border-t border-[var(--border-subtle)]">
                      <div className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Ready in Library • {formatBytes(job.downloaded_bytes)}</span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {job.destination_uri}
                      </span>
                    </div>
                  )}

                  {/* Failure message */}
                  {job.status === 'failed' && job.last_error_message && (
                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{job.last_error_message}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Download Modal */}
      <AddDownloadModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          loadData();
        }}
      />

      {/* Import Music Modal */}
      <ImportMusicModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={loadData}
      />

      {/* Delete / Removal Confirmation Modal */}
      {selectedDeleteJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400">
              <Trash2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Manage Downloaded File
              </h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Choose whether to only remove the download manager record, or completely delete the audio file from your device storage:
            </p>

            <div className="p-3 rounded-xl bg-[var(--surface-secondary)]/50 border border-[var(--border)] text-xs text-[var(--text-primary)] space-y-1">
              <div className="font-bold">{selectedDeleteJob.display_title}</div>
              <div className="text-[11px] text-[var(--text-secondary)] font-mono">{selectedDeleteJob.destination_uri}</div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmDelete(false)}
                className="w-full p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)]/50 text-left hover:border-[var(--accent)] transition-all space-y-1"
              >
                <div className="text-xs font-bold text-[var(--text-primary)]">
                  Remove Download Record Only
                </div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  Clears the history record from the manager. Keeps the audio file in your music library for offline playback.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmDelete(true)}
                className="w-full p-3 rounded-xl border border-rose-500/20 bg-rose-500/10 text-left hover:border-rose-500/40 transition-all space-y-1"
              >
                <div className="text-xs font-bold text-rose-400">
                  Delete Physical Audio File
                </div>
                <div className="text-[11px] text-rose-300/80">
                  Deletes the audio file from storage and removes the track from your local music library.
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedDeleteJob(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


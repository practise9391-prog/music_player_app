import React, { useState, useEffect } from 'react';
import { Download, Upload, FileText, CheckCircle2, AlertCircle, X, ListPlus } from 'lucide-react';
import { playlistFileService, PlaylistImportResult } from '../../services/playlists/PlaylistFileService';
import { PlaylistRepository, PlaylistTrackRepository, TrackRepository } from '../../database/repository';
import { PlaylistRecord, Track } from '../../types';
import { useTranslation } from '../../services/i18n/I18nService';

interface PlaylistImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PlaylistImportExportModal: React.FC<PlaylistImportExportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [playlistName, setPlaylistName] = useState('My Imported Playlist');
  const [rawM3UText, setRawM3UText] = useState('');
  const [importResult, setImportResult] = useState<PlaylistImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Export State
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [exportTracks, setExportTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (isOpen) {
      PlaylistRepository.getAll().then((list) => {
        setPlaylists(list);
        if (list.length > 0 && !selectedPlaylistId) {
          setSelectedPlaylistId(list[0].id);
        }
      });
      setImportResult(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedPlaylistId) {
      PlaylistTrackRepository.getTracksForPlaylist(selectedPlaylistId).then(async (records) => {
        const resolved: Track[] = [];
        for (const r of records) {
          if (r.trackData) {
            resolved.push(r.trackData);
          } else {
            const t = await TrackRepository.getById(r.trackId);
            if (t) resolved.push(t);
          }
        }
        setExportTracks(resolved);
      });
    }
  }, [selectedPlaylistId]);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setPlaylistName(baseName);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawM3UText(text || '');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!rawM3UText.trim()) return;
    setIsProcessing(true);
    try {
      const result = await playlistFileService.importM3UToPlaylist(playlistName, rawM3UText);
      setImportResult(result);
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error('Import failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    const pl = playlists.find((p) => p.id === selectedPlaylistId);
    if (!pl || exportTracks.length === 0) return;
    playlistFileService.downloadPlaylistFile(pl.name, exportTracks);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">M3U / M3U8 Playlist Manager</h2>
              <p className="text-xs text-slate-400">Standard portable playlist import and export</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex mt-4 p-1 bg-slate-800/80 rounded-xl border border-slate-700/50">
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'import'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>{t('library.import_playlist')}</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'export'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>{t('library.export_playlist')}</span>
          </button>
        </div>

        {/* Import Tab Content */}
        {activeTab === 'import' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Playlist Name
              </label>
              <input
                type="text"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Upload .m3u / .m3u8 File
              </label>
              <input
                type="file"
                accept=".m3u,.m3u8,audio/x-mpegurl"
                onChange={handleFileUpload}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-cyan-400 hover:file:bg-slate-700 cursor-pointer"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Or Paste M3U Raw Content
              </label>
              <textarea
                rows={4}
                value={rawM3UText}
                onChange={(e) => setRawM3UText(e.target.value)}
                placeholder="#EXTM3U&#10;#EXTINF:180,Artist - Song&#10;/storage/music/song.mp3"
                className="w-full p-2.5 text-xs font-mono bg-slate-800/60 border border-slate-700 rounded-xl text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {importResult && (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs space-y-1">
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Playlist "{importResult.playlistName}" created successfully!</span>
                </div>
                <p className="text-slate-300">
                  Total Entries: <span className="font-semibold text-white">{importResult.totalEntries}</span> | Matched Library Tracks:{' '}
                  <span className="font-semibold text-emerald-400">{importResult.matchedCount}</span>
                </p>
                {importResult.unresolvedCount > 0 && (
                  <p className="text-amber-400/90 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{importResult.unresolvedCount} entries not found in local library.</span>
                  </p>
                )}
              </div>
            )}

            <button
              disabled={isProcessing || !rawM3UText.trim()}
              onClick={handleImport}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-600/20"
            >
              <ListPlus className="w-4 h-4" />
              <span>{isProcessing ? 'Processing...' : 'Import to Playlist'}</span>
            </button>
          </div>
        )}

        {/* Export Tab Content */}
        {activeTab === 'export' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">
                Select Playlist to Export
              </label>
              <select
                value={selectedPlaylistId}
                onChange={(e) => setSelectedPlaylistId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
              >
                {playlists.map((pl) => (
                  <option key={pl.id} value={pl.id}>
                    {pl.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
              <p className="font-semibold text-white mb-1">Export Details</p>
              <p>Format: Standard UTF-8 M3U8 Extended Playlist</p>
              <p>Tracks included: {exportTracks.length}</p>
            </div>

            <button
              disabled={exportTracks.length === 0}
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-cyan-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Download .m3u8 Playlist</span>
            </button>
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

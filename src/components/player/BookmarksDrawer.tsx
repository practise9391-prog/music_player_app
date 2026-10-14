import React, { useState, useEffect } from 'react';
import { Bookmark, BookmarkPlus, Trash2, X, Play, Clock } from 'lucide-react';
import { bookmarkService } from '../../services/playback/BookmarkService';
import { BookmarkRecord, Track } from '../../types';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { useTranslation } from '../../services/i18n/I18nService';

interface BookmarksDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: Track | null;
}

export const BookmarksDrawer: React.FC<BookmarksDrawerProps> = ({ isOpen, onClose, currentTrack }) => {
  const { t } = useTranslation();
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadBookmarks = async () => {
    if (!currentTrack) {
      const all = await bookmarkService.getAllBookmarks();
      setBookmarks(all);
      return;
    }
    const list = await bookmarkService.getBookmarksForTrack(currentTrack.id);
    setBookmarks(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadBookmarks();
    }
  }, [isOpen, currentTrack]);

  if (!isOpen) return null;

  const handleAddBookmark = async () => {
    if (!currentTrack) return;
    setIsLoading(true);
    try {
      const currentPos = audioEngineInstance.getPosition();
      await bookmarkService.addBookmark(currentTrack.id, currentPos, newTitle.trim() || undefined);
      setNewTitle('');
      await loadBookmarks();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id?: number) => {
    if (id === undefined) return;
    await bookmarkService.removeBookmark(id);
    await loadBookmarks();
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t('nav.bookmarks')}</h2>
              <p className="text-xs text-slate-400 line-clamp-1">
                {currentTrack ? currentTrack.title : 'All Saved Audio Bookmarks'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Bookmark Row */}
        {currentTrack && (
          <div className="mt-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Current position: {formatSeconds(audioEngineInstance.getPosition())}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Bookmark note or title (optional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
              <button
                disabled={isLoading}
                onClick={handleAddBookmark}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                <BookmarkPlus className="w-4 h-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        )}

        {/* Bookmarks List */}
        <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
          {bookmarks.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No bookmarks saved yet. Mark chapters, speech sections, or favorite moments!
            </div>
          ) : (
            bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/40 transition-colors group"
              >
                <button
                  onClick={() => {
                    bookmarkService.seekToBookmark(bm);
                    onClose();
                  }}
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs">
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-semibold text-white truncate">{bm.title}</p>
                    <p className="text-xs text-amber-400/90 font-mono">{formatSeconds(bm.position)}</p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(bm.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-700/40 transition-colors"
                  aria-label="Delete bookmark"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

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


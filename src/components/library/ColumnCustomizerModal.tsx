import React from 'react';
import { Columns, X, CheckSquare, Square, RotateCcw } from 'lucide-react';

export interface VisibleColumnsConfig {
  title: boolean;
  artist: boolean;
  album: boolean;
  duration: boolean;
  genre: boolean;
  year: boolean;
  bitrate: boolean;
  format: boolean;
  fileSize: boolean;
  rating: boolean;
}

export const DEFAULT_VISIBLE_COLUMNS: VisibleColumnsConfig = {
  title: true,
  artist: true,
  album: true,
  duration: true,
  genre: false,
  year: false,
  bitrate: false,
  format: false,
  fileSize: false,
  rating: true,
};

interface ColumnCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: VisibleColumnsConfig;
  onChange: (newConfig: VisibleColumnsConfig) => void;
}

export const ColumnCustomizerModal: React.FC<ColumnCustomizerModalProps> = ({
  isOpen,
  onClose,
  config,
  onChange,
}) => {
  if (!isOpen) return null;

  const toggleColumn = (key: keyof VisibleColumnsConfig) => {
    // Title is required
    if (key === 'title') return;
    const next = { ...config, [key]: !config[key] };
    onChange(next);
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_VISIBLE_COLUMNS });
  };

  const columns: { key: keyof VisibleColumnsConfig; label: string; description: string }[] = [
    { key: 'title', label: 'Title', description: 'Song title (Always required)' },
    { key: 'artist', label: 'Artist', description: 'Track artist or performer' },
    { key: 'album', label: 'Album', description: 'Album name' },
    { key: 'duration', label: 'Duration', description: 'Track length formatted' },
    { key: 'genre', label: 'Genre', description: 'Musical category' },
    { key: 'year', label: 'Year', description: 'Original release year' },
    { key: 'bitrate', label: 'Bitrate', description: 'Audio bitrate (kbps)' },
    { key: 'format', label: 'Format', description: 'Audio codec/file format' },
    { key: 'fileSize', label: 'File Size', description: 'Filesystem storage size' },
    { key: 'rating', label: 'Rating', description: '0 to 5 star rating' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <Columns className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Custom Columns</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
          <p className="text-[11px] text-[var(--text-muted)] mb-2">
            Select the metadata columns to display in table view:
          </p>

          {columns.map((col) => {
            const isChecked = config[col.key];
            const isMandatory = col.key === 'title';
            return (
              <div
                key={col.key}
                onClick={() => !isMandatory && toggleColumn(col.key)}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                  isMandatory
                    ? 'bg-[var(--surface-secondary)]/50 border-[var(--border-subtle)] cursor-default'
                    : 'bg-[var(--surface)] hover:bg-[var(--surface-secondary)] border-[var(--border-subtle)] cursor-pointer'
                }`}
              >
                <div>
                  <span className="font-semibold text-[var(--text-primary)] block">{col.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{col.description}</span>
                </div>
                <button
                  type="button"
                  disabled={isMandatory}
                  className={`p-1 text-sm ${
                    isChecked ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4 opacity-50" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

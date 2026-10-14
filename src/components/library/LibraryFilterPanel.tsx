import React from 'react';
import {
  LibraryFilterCriteria,
  DEFAULT_FILTER_CRITERIA,
  FilterSource,
  FilterFavorite,
  FilterDuration,
  FilterQuality,
} from '../../services/filter/FilterEngine';
import {
  X,
  RotateCcw,
  SlidersHorizontal,
  Check,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';

interface LibraryFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  criteria: LibraryFilterCriteria;
  onChange: (newCriteria: LibraryFilterCriteria) => void;
  availableGenres?: string[];
  availableFormats?: string[];
}

export const LibraryFilterPanel: React.FC<LibraryFilterPanelProps> = ({
  isOpen,
  onClose,
  criteria,
  onChange,
  availableGenres = [],
  availableFormats = ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a'],
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    onChange({ ...DEFAULT_FILTER_CRITERIA });
  };

  const handleFormatToggle = (fmt: string) => {
    const lower = fmt.toLowerCase();
    const current = criteria.formats || [];
    const next = current.includes(lower)
      ? current.filter((f) => f !== lower)
      : [...current, lower];
    onChange({ ...criteria, formats: next });
  };

  const activeCount = [
    criteria.source !== 'all',
    criteria.favorite !== 'all',
    criteria.duration !== 'all',
    (criteria.formats && criteria.formats.length > 0),
    criteria.quality !== 'all',
    (criteria.genres && criteria.genres.length > 0),
    criteria.minRating !== undefined && criteria.minRating > 0,
    criteria.yearMin !== undefined || criteria.yearMax !== undefined,
  ].filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Advanced Filter Panel
            </h3>
            {activeCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-[var(--btn-text)]">
                {activeCount} active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-secondary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Logic Mode Toggle (AND vs OR) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
            <div>
              <span className="font-bold text-[var(--text-primary)] block">Condition Matching Logic</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                {criteria.logicMode === 'all'
                  ? 'ALL conditions must match (AND)'
                  : 'ANY condition can match (OR)'}
              </span>
            </div>
            <div className="flex rounded-lg p-1 bg-[var(--surface)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => onChange({ ...criteria, logicMode: 'all' })}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  criteria.logicMode === 'all'
                    ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                ALL (AND)
              </button>
              <button
                type="button"
                onClick={() => onChange({ ...criteria, logicMode: 'any' })}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                  criteria.logicMode === 'any'
                    ? 'bg-[var(--accent)] text-[var(--btn-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                ANY (OR)
              </button>
            </div>
          </div>

          {/* Grid of Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Source */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-secondary)]">Audio Source</label>
              <select
                value={criteria.source}
                onChange={(e) =>
                  onChange({ ...criteria, source: e.target.value as FilterSource })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Sources</option>
                <option value="local">Local Files Only</option>
                <option value="online">Online Only</option>
                <option value="cached">Cached Online Only</option>
              </select>
            </div>

            {/* 2. Favorites */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-secondary)]">Favorite Status</label>
              <select
                value={criteria.favorite}
                onChange={(e) =>
                  onChange({ ...criteria, favorite: e.target.value as FilterFavorite })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Tracks</option>
                <option value="favorites">Favorites Only (★)</option>
                <option value="non_favorites">Non-Favorites</option>
              </select>
            </div>

            {/* 3. Duration */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-secondary)]">Song Duration</label>
              <select
                value={criteria.duration}
                onChange={(e) =>
                  onChange({ ...criteria, duration: e.target.value as FilterDuration })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="all">Any Duration</option>
                <option value="under_3">Short (&lt; 3 minutes)</option>
                <option value="3_to_5">Standard (3 – 5 minutes)</option>
                <option value="5_to_10">Long (5 – 10 minutes)</option>
                <option value="over_10">Extended (&gt; 10 minutes)</option>
              </select>
            </div>

            {/* 4. Audio Quality */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-secondary)]">Audio Quality / Bitrate</label>
              <select
                value={criteria.quality}
                onChange={(e) =>
                  onChange({ ...criteria, quality: e.target.value as FilterQuality })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All Qualities</option>
                <option value="lossless">Lossless / Hi-Res (FLAC, WAV)</option>
                <option value="256_to_320">High Bitrate (256 – 320 kbps)</option>
                <option value="128_to_256">Standard Bitrate (128 – 256 kbps)</option>
                <option value="under_128">Compact (&lt; 128 kbps)</option>
              </select>
            </div>

            {/* 5. Rating */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-secondary)]">Minimum Star Rating</label>
              <select
                value={criteria.minRating || 0}
                onChange={(e) =>
                  onChange({ ...criteria, minRating: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
              >
                <option value={0}>Any Rating (0+)</option>
                <option value={1}>★ 1+ Stars</option>
                <option value={2}>★★ 2+ Stars</option>
                <option value={3}>★★★ 3+ Stars</option>
                <option value={4}>★★★★ 4+ Stars</option>
                <option value={5}>★★★★★ 5 Stars Only</option>
              </select>
            </div>

            {/* 6. Release Year Range */}
            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-secondary)]">Release Year Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min (e.g. 2000)"
                  value={criteria.yearMin || ''}
                  onChange={(e) =>
                    onChange({
                      ...criteria,
                      yearMin: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="w-1/2 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono text-xs"
                />
                <span className="text-[var(--text-muted)]">–</span>
                <input
                  type="number"
                  placeholder="Max (e.g. 2026)"
                  value={criteria.yearMax || ''}
                  onChange={(e) =>
                    onChange({
                      ...criteria,
                      yearMax: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="w-1/2 px-2.5 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Formats Checklist */}
          <div className="space-y-2">
            <label className="font-semibold text-[var(--text-secondary)] block">Audio Formats</label>
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((fmt) => {
                const isSelected = criteria.formats?.includes(fmt.toLowerCase());
                return (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => handleFormatToggle(fmt)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)]'
                        : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-3.5 h-3.5" />
                    ) : (
                      <Square className="w-3.5 h-3.5 opacity-50" />
                    )}
                    <span className="uppercase">{fmt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]">
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {activeCount === 0 ? 'No active filters' : `${activeCount} filter(s) applied`}
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl btn-primary text-xs font-bold text-[var(--btn-text)] shadow-md transition-all hover:opacity-90"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </div>
  );
};

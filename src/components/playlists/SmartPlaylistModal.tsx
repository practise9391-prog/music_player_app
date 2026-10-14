import React, { useState } from 'react';
import { SmartPlaylistRule, SmartPlaylistDefinition, SmartPlaylistField, SmartPlaylistOperator } from '../../types';
import { X, Plus, Trash2, Sparkles, Filter, Sliders } from 'lucide-react';

interface SmartPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, definition: SmartPlaylistDefinition) => Promise<void>;
  initialName?: string;
  initialDescription?: string;
  initialDefinition?: SmartPlaylistDefinition;
}

const FIELD_OPTIONS: { id: SmartPlaylistField; label: string; type: 'string' | 'number' | 'boolean' }[] = [
  { id: 'genre', label: 'Genre', type: 'string' },
  { id: 'artist', label: 'Artist', type: 'string' },
  { id: 'album', label: 'Album', type: 'string' },
  { id: 'title', label: 'Title', type: 'string' },
  { id: 'year', label: 'Release Year', type: 'number' },
  { id: 'duration', label: 'Duration (seconds)', type: 'number' },
  { id: 'play_count', label: 'Play Count', type: 'number' },
  { id: 'rating', label: 'Rating (0–5 Stars)', type: 'number' },
  { id: 'is_favorite', label: 'Is Favorite', type: 'boolean' },
  { id: 'source', label: 'Source (local / online)', type: 'string' },
  { id: 'format', label: 'Audio Format (flac, mp3, opus)', type: 'string' },
  { id: 'bitrate', label: 'Bitrate (kbps)', type: 'number' },
  { id: 'file_size', label: 'File Size (bytes)', type: 'number' },
  { id: 'tags', label: 'User Tags / Comment', type: 'string' },
  { id: 'date_added', label: 'Date Added (timestamp)', type: 'number' },
  { id: 'last_played_at', label: 'Last Played (timestamp)', type: 'number' },
];

const OPERATORS_BY_TYPE: Record<'string' | 'number' | 'boolean', { id: SmartPlaylistOperator; label: string }[]> = {
  string: [
    { id: 'equals', label: 'equals' },
    { id: 'not_equals', label: 'does not equal' },
    { id: 'contains', label: 'contains' },
    { id: 'not_contains', label: 'does not contain' },
    { id: 'starts_with', label: 'starts with' },
    { id: 'ends_with', label: 'ends with' },
  ],
  number: [
    { id: 'equals', label: 'equals' },
    { id: 'not_equals', label: 'does not equal' },
    { id: 'greater_than', label: 'greater than' },
    { id: 'less_than', label: 'less than' },
    { id: 'greater_than_or_equal', label: 'greater than or equal (>=)' },
    { id: 'less_than_or_equal', label: 'less than or equal (<=)' },
    { id: 'between', label: 'is between' },
  ],
  boolean: [
    { id: 'equals', label: 'is' },
    { id: 'not_equals', label: 'is not' },
  ],
};

export const SmartPlaylistModal: React.FC<SmartPlaylistModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialName = '',
  initialDescription = '',
  initialDefinition,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(initialName || 'My Smart Collection');
  const [description, setDescription] = useState(initialDescription || '');
  const [matchMode, setMatchMode] = useState<'all' | 'any'>(initialDefinition?.matchMode || 'all');
  const [limit, setLimit] = useState<number>(initialDefinition?.limit || 50);
  const [sortBy, setSortBy] = useState<SmartPlaylistField>(initialDefinition?.sortBy || 'play_count');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialDefinition?.sortOrder || 'desc');

  const [rules, setRules] = useState<SmartPlaylistRule[]>(
    initialDefinition?.rules || [
      {
        id: 'rule_1',
        field: 'genre',
        operator: 'contains',
        value: 'Rock',
      },
    ]
  );

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        field: 'genre',
        operator: 'equals',
        value: '',
      },
    ]);
  };

  const handleRemoveRule = (id: string) => {
    if (rules.length <= 1) return;
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRule = (id: string, updates: Partial<SmartPlaylistRule>) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        // Reset operator if field type changed
        if (updates.field && updates.field !== r.field) {
          const fieldDef = FIELD_OPTIONS.find((f) => f.id === updates.field);
          const type = fieldDef ? fieldDef.type : 'string';
          updated.operator = OPERATORS_BY_TYPE[type][0].id;
          updated.value = type === 'boolean' ? 'true' : type === 'number' ? 0 : '';
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSave(name, description, {
      matchMode,
      rules,
      limit,
      sortBy,
      sortOrder,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)]">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Smart Playlist Rules</h3>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Dynamically populated collections based on your local library metadata
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-hover)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* Collection Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                Collection Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hi-Res Favorites, 90s Rock"
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {/* Match Mode */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
            <span className="font-semibold text-[var(--text-primary)]">Match Rules:</span>
            <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)]">
              <input
                type="radio"
                name="matchMode"
                value="all"
                checked={matchMode === 'all'}
                onChange={() => setMatchMode('all')}
                className="accent-[var(--accent)]"
              />
              <span>Match ALL rules (AND)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[var(--text-secondary)]">
              <input
                type="radio"
                name="matchMode"
                value="any"
                checked={matchMode === 'any'}
                onChange={() => setMatchMode('any')}
                className="accent-[var(--accent)]"
              />
              <span>Match ANY rule (OR)</span>
            </label>
          </div>

          {/* Rules List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider text-[11px]">
                Rules Definition
              </span>
              <button
                type="button"
                onClick={handleAddRule}
                className="px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-[11px] text-[var(--accent)] font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Add Rule</span>
              </button>
            </div>

            {rules.map((rule) => {
              const fieldDef = FIELD_OPTIONS.find((f) => f.id === rule.field);
              const fieldType = fieldDef ? fieldDef.type : 'string';
              const availableOps = OPERATORS_BY_TYPE[fieldType];

              return (
                <div
                  key={rule.id}
                  className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-2.5 rounded-xl bg-[var(--surface-secondary)]/60 border border-[var(--border-subtle)]"
                >
                  {/* Field */}
                  <select
                    value={rule.field}
                    onChange={(e) => handleUpdateRule(rule.id, { field: e.target.value as SmartPlaylistField })}
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  {/* Operator */}
                  <select
                    value={rule.operator}
                    onChange={(e) =>
                      handleUpdateRule(rule.id, { operator: e.target.value as SmartPlaylistOperator })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    {availableOps.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.label}
                      </option>
                    ))}
                  </select>

                  {/* Value */}
                  {fieldType === 'boolean' ? (
                    <select
                      value={String(rule.value)}
                      onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value === 'true' })}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
                    >
                      <option value="true">True (Yes)</option>
                      <option value="false">False (No)</option>
                    </select>
                  ) : (
                    <input
                      type={fieldType === 'number' ? 'number' : 'text'}
                      value={rule.value as any}
                      onChange={(e) =>
                        handleUpdateRule(rule.id, {
                          value: fieldType === 'number' ? Number(e.target.value) : e.target.value,
                        })
                      }
                      placeholder="Target value..."
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  )}

                  {/* Secondary Value for 'between' */}
                  {rule.operator === 'between' && (
                    <input
                      type="number"
                      value={rule.valueSecondary as any}
                      onChange={(e) => handleUpdateRule(rule.id, { valueSecondary: Number(e.target.value) })}
                      placeholder="Max value..."
                      className="w-24 px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  )}

                  {/* Remove Button */}
                  <button
                    type="button"
                    disabled={rules.length <= 1}
                    onClick={() => handleRemoveRule(rule.id)}
                    className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-400 disabled:opacity-30 disabled:hover:text-[var(--text-muted)] transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Limits & Sorting */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border)]">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Max Tracks</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={limit}
                onChange={(e) => setLimit(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SmartPlaylistField)}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="play_count">Play Count</option>
                <option value="rating">Rating</option>
                <option value="date_added">Date Added</option>
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="duration">Duration</option>
                <option value="year">Release Year</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-primary)] focus:outline-none"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[var(--accent)] text-[var(--btn-text)] text-xs font-bold hover:brightness-110 transition-all flex items-center gap-1.5 shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create Smart Collection</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

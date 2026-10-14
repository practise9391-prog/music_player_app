import React, { useState } from 'react';
import {
  HomeDashboardSettings,
  HomeDashboardSectionId,
  DEFAULT_HOME_SECTIONS_ORDER,
  DEFAULT_HOME_SETTINGS,
} from '../../types/homeDashboard';
import { Button } from '../ui/Button';
import {
  SlidersHorizontal,
  X,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Eye,
  EyeOff,
  Sparkles,
  LayoutGrid,
  Trash2,
  Check,
} from 'lucide-react';
import { musicDiscoveryService } from '../../services/discovery/MusicDiscoveryService';
import { notificationService } from '../../services/errorService';

interface HomeCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: HomeDashboardSettings;
  onSave: (newSettings: HomeDashboardSettings) => void;
}

const SECTION_METADATA: Record<
  HomeDashboardSectionId,
  { name: string; description: string }
> = {
  greeting_quick_access: {
    name: 'Greeting & Quick Access',
    description: 'Welcome banner, time-of-day greeting, and quick navigation shortcuts.',
  },
  continue_listening: {
    name: 'Continue Listening',
    description: 'Resume your last played song and view recently played tracks and albums.',
  },
  daily_mixes: {
    name: 'Daily Mixes & Collections',
    description: 'Dynamic mixes based on your favorites, heavy rotation, and top genres.',
  },
  made_for_you: {
    name: 'Made for You (Recommendations)',
    description: 'Personalized local offline recommendations with explainable reasons.',
  },
  recently_added: {
    name: 'Recently Added Music',
    description: 'The newest tracks added to your local library.',
  },
  most_played: {
    name: 'Most-Played Music',
    description: 'Your heavy rotation and most listened songs ranked by play count.',
  },
  explore_library: {
    name: 'Explore Your Library',
    description: 'Browse artists, albums, genres, and folders in your collection.',
  },
  unplayed_forgotten: {
    name: 'Rediscover & Forgotten Music',
    description: 'Unplayed songs, forgotten favorites, and tracks not heard recently.',
  },
  quick_collections: {
    name: 'Quick Collections & Playlists',
    description: 'Pinned playlists and recently updated user collections.',
  },
  listening_insights: {
    name: 'Listening Insights & Stats',
    description: 'Summary of your listening time, top songs, and favorite artists.',
  },
};

export const HomeCustomizationModal: React.FC<HomeCustomizationModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [currentSettings, setCurrentSettings] = useState<HomeDashboardSettings>({
    ...settings,
    sectionOrder: settings.sectionOrder || DEFAULT_HOME_SECTIONS_ORDER,
  });

  if (!isOpen) return null;

  const handleToggleSection = (id: HomeDashboardSectionId) => {
    setCurrentSettings((prev) => ({
      ...prev,
      enabledSections: {
        ...prev.enabledSections,
        [id]: !prev.enabledSections[id],
      },
    }));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...currentSettings.sectionOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;

    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    setCurrentSettings((prev) => ({
      ...prev,
      sectionOrder: newOrder,
    }));
  };

  const handleResetDefaults = () => {
    setCurrentSettings(DEFAULT_HOME_SETTINGS);
    notificationService.info('Reset', 'Dashboard layout restored to default.');
  };

  const handleClearDismissed = () => {
    musicDiscoveryService.clearDismissedRecommendations();
    notificationService.success(
      'Recommendations Restored',
      'Previously dismissed song recommendations have been cleared.'
    );
  };

  const handleSaveAndApply = () => {
    onSave(currentSettings);
    onClose();
    notificationService.success('Preferences Saved', 'Home dashboard layout updated.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[var(--surface-card)] border border-[var(--border)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[var(--surface-secondary)] text-[var(--accent)] border border-[var(--border)]">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                Customize Home Dashboard
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Choose which sections appear, change their order, and adjust layout density
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card Density */}
            <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-[var(--accent)]" /> Card Density
              </label>
              <div className="flex rounded-lg overflow-hidden border border-[var(--border)] p-1 bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSettings((prev) => ({ ...prev, cardDensity: 'comfortable' }))
                  }
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    currentSettings.cardDensity === 'comfortable'
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Comfortable
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSettings((prev) => ({ ...prev, cardDensity: 'compact' }))
                  }
                  className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                    currentSettings.cardDensity === 'compact'
                      ? 'bg-[var(--accent)] text-[var(--btn-text)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Compact
                </button>
              </div>
            </div>

            {/* Recommendations Toggle */}
            <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] space-y-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent)]" /> Offline Recommendations
              </label>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[var(--text-secondary)]">
                  {currentSettings.recommendationsEnabled ? 'Enabled' : 'Disabled'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentSettings((prev) => ({
                      ...prev,
                      recommendationsEnabled: !prev.recommendationsEnabled,
                    }))
                  }
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                    currentSettings.recommendationsEnabled
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--border)]'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                      currentSettings.recommendationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Section Visibility and Order */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Dashboard Sections &amp; Order
              </h3>
              <span className="text-[11px] text-[var(--text-muted)]">
                Use arrows to reorder
              </span>
            </div>

            <div className="space-y-2">
              {currentSettings.sectionOrder.map((sectionId, index) => {
                const meta = SECTION_METADATA[sectionId] || {
                  name: sectionId,
                  description: '',
                };
                const isEnabled = currentSettings.enabledSections[sectionId] !== false;

                return (
                  <div
                    key={sectionId}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isEnabled
                        ? 'bg-[var(--surface)] border-[var(--border-subtle)]'
                        : 'bg-[var(--surface-secondary)]/50 border-dashed border-[var(--border)] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSection(sectionId)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isEnabled
                            ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                            : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)]'
                        }`}
                        title={isEnabled ? 'Hide Section' : 'Show Section'}
                      >
                        {isEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {meta.name}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate">
                          {meta.description}
                        </div>
                      </div>
                    </div>

                    {/* Order Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveSection(index, 'up')}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === currentSettings.sectionOrder.length - 1}
                        onClick={() => handleMoveSection(index, 'down')}
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-secondary)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dismissed Recommendations Actions */}
          <div className="p-4 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-[var(--text-primary)]">
                Reset Dismissed Recommendations
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                Restore songs you previously dismissed from Made for You.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleClearDismissed}
            >
              Clear Dismissed
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--surface)]">
          <Button
            variant="secondary"
            size="sm"
            icon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleResetDefaults}
          >
            Reset Defaults
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Check className="w-3.5 h-3.5" />}
              onClick={handleSaveAndApply}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};


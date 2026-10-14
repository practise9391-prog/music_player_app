import { Track, MetadataCorrectionSuggestion } from '../../types';
import { TrackRepository } from '../../database/repository';

export interface LibraryHealthReport {
  totalTracks: number;
  tracksWithMissingArtwork: number;
  tracksWithMissingGenre: number;
  tracksWithMissingYear: number;
  suggestions: MetadataCorrectionSuggestion[];
  artistVariants: Array<{ canonical: string; variants: string[] }>;
}

export class IntelligentLibraryAnalyzer {
  private static instance: IntelligentLibraryAnalyzer | null = null;

  public static getInstance(): IntelligentLibraryAnalyzer {
    if (!IntelligentLibraryAnalyzer.instance) {
      IntelligentLibraryAnalyzer.instance = new IntelligentLibraryAnalyzer();
    }
    return IntelligentLibraryAnalyzer.instance;
  }

  /**
   * Title-cases a string nicely (e.g., "hello world" -> "Hello World")
   */
  private toTitleCase(str: string): string {
    return str
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Analyzes the local library for metadata inconsistencies and returns explainable recommendations.
   */
  public async analyzeLibrary(): Promise<LibraryHealthReport> {
    const tracks = await TrackRepository.getAll();
    const suggestions: MetadataCorrectionSuggestion[] = [];
    let tracksWithMissingArtwork = 0;
    let tracksWithMissingGenre = 0;
    let tracksWithMissingYear = 0;

    // Track artist frequencies to identify canonical names
    const artistMap = new Map<string, { canonical: string; count: number; rawNames: Set<string> }>();

    for (const t of tracks) {
      if (!t.coverArtUrl) tracksWithMissingArtwork++;
      if (!t.genre || t.genre.trim() === '' || t.genre.toLowerCase() === 'unknown') {
        tracksWithMissingGenre++;
      }
      if (!t.year || t.year <= 0) tracksWithMissingYear++;

      // Artist normalization check
      if (t.artist) {
        const cleanKey = t.artist.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        if (cleanKey) {
          const entry = artistMap.get(cleanKey) || {
            canonical: t.artist,
            count: 0,
            rawNames: new Set<string>(),
          };
          entry.count++;
          entry.rawNames.add(t.artist);
          // Prefer the variant that has proper capitalization and punctuation
          if (t.artist.length > entry.canonical.length || (t.artist.includes('.') && !entry.canonical.includes('.'))) {
            entry.canonical = t.artist;
          }
          artistMap.set(cleanKey, entry);
        }
      }

      // 1. Whitespace & Underscore Issues in Title
      if (t.title) {
        let suggestedTitle = t.title.trim();
        if (suggestedTitle.includes('_')) {
          suggestedTitle = suggestedTitle.replace(/_+/g, ' ').trim();
        }

        // Casing fix: if entire title is all uppercase (e.g. "FEEL GOOD INC")
        if (suggestedTitle.length > 3 && suggestedTitle === suggestedTitle.toUpperCase() && /[A-Z]/.test(suggestedTitle)) {
          suggestedTitle = this.toTitleCase(suggestedTitle);
        }

        if (suggestedTitle !== t.title) {
          suggestions.push({
            trackId: t.id,
            field: 'title',
            originalValue: t.title,
            suggestedValue: suggestedTitle,
            reason: 'Cleaned trailing symbols and normalized casing',
            confidence: 0.95,
          });
        }
      }

      // 2. Trailing whitespace or uppercase issue in Artist
      if (t.artist) {
        const trimmed = t.artist.trim();
        if (trimmed !== t.artist) {
          suggestions.push({
            trackId: t.id,
            field: 'artist',
            originalValue: t.artist,
            suggestedValue: trimmed,
            reason: 'Removed leading/trailing whitespace',
            confidence: 1.0,
          });
        }
      }
    }

    // Identify artist variants across multiple tracks
    const artistVariants: Array<{ canonical: string; variants: string[] }> = [];
    for (const [, val] of artistMap.entries()) {
      if (val.rawNames.size > 1) {
        artistVariants.push({
          canonical: val.canonical,
          variants: Array.from(val.rawNames).filter((r) => r !== val.canonical),
        });

        // Add suggestions for tracks using the non-canonical variant
        for (const t of tracks) {
          if (t.artist && val.rawNames.has(t.artist) && t.artist !== val.canonical) {
            suggestions.push({
              trackId: t.id,
              field: 'artist',
              originalValue: t.artist,
              suggestedValue: val.canonical,
              reason: `Standardized to majority artist spelling "${val.canonical}"`,
              confidence: 0.85,
            });
          }
        }
      }
    }

    return {
      totalTracks: tracks.length,
      tracksWithMissingArtwork,
      tracksWithMissingGenre,
      tracksWithMissingYear,
      suggestions,
      artistVariants,
    };
  }

  /**
   * Safely applies a metadata correction suggestion without altering user data
   */
  public async applySuggestion(suggestion: MetadataCorrectionSuggestion): Promise<void> {
    const track = await TrackRepository.getById(suggestion.trackId);
    if (!track) return;

    const updates: Partial<Track> = {
      [suggestion.field]: suggestion.suggestedValue,
      modifiedAt: Date.now(),
    };

    await TrackRepository.save({ ...track, ...updates });
  }

  /**
   * Applies all high-confidence suggestions in bulk
   */
  public async applyAllHighConfidenceSuggestions(threshold = 0.9): Promise<number> {
    const report = await this.analyzeLibrary();
    const highConfidence = report.suggestions.filter((s) => s.confidence >= threshold);

    for (const item of highConfidence) {
      await this.applySuggestion(item);
    }

    return highConfidence.length;
  }

  /**
   * Generates dynamic mood & smart collections based on library analysis
   */
  public async getSmartCollections(): Promise<{
    workout: Track[];
    chill: Track[];
    forgottenGems: Track[];
    unplayedTreasures: Track[];
  }> {
    const allTracks = await TrackRepository.getAll();
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    // Workout / High Energy: upbeat genres or high bitrates
    const workoutGenres = ['rock', 'electronic', 'dance', 'metal', 'hip hop', 'pop', 'edm'];
    const workout = allTracks.filter((t) => {
      const g = (t.genre || '').toLowerCase();
      return workoutGenres.some((wg) => g.includes(wg));
    });

    // Chill / Relax: ambient, acoustic, jazz, classical, lo-fi
    const chillGenres = ['acoustic', 'ambient', 'classical', 'jazz', 'soul', 'lo-fi', 'chill', 'piano'];
    const chill = allTracks.filter((t) => {
      const g = (t.genre || '').toLowerCase();
      return chillGenres.some((cg) => g.includes(cg));
    });

    // Forgotten Gems: favorited or rated >= 4, but not played in last 30 days
    const forgottenGems = allTracks.filter((t) => {
      const isFavOrHighRated = t.isFavorite || (t.rating && t.rating >= 4);
      const isOldPlay = !t.lastPlayedAt || now - t.lastPlayedAt > thirtyDaysMs;
      return isFavOrHighRated && isOldPlay;
    });

    // Unplayed Treasures: never played, but present in library
    const unplayedTreasures = allTracks.filter((t) => !t.playCount || t.playCount === 0);

    return {
      workout: workout.slice(0, 30),
      chill: chill.slice(0, 30),
      forgottenGems: forgottenGems.slice(0, 30),
      unplayedTreasures: unplayedTreasures.slice(0, 30),
    };
  }
}

export const intelligentLibraryAnalyzer = IntelligentLibraryAnalyzer.getInstance();

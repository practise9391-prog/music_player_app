import { Track, Album, Artist, Genre } from './track';
import { PlaylistRecord } from './playlist';

export type HomeDashboardSectionId =
  | 'greeting_quick_access'
  | 'continue_listening'
  | 'daily_mixes'
  | 'made_for_you'
  | 'recently_added'
  | 'most_played'
  | 'explore_library'
  | 'unplayed_forgotten'
  | 'quick_collections'
  | 'listening_insights';

export interface HomeDashboardSettings {
  enabledSections: Record<HomeDashboardSectionId, boolean>;
  sectionOrder: HomeDashboardSectionId[];
  cardDensity: 'comfortable' | 'compact';
  itemsPerSection: number;
  pinnedPlaylistIds: string[];
  pinnedArtistIds: string[];
  recommendationsEnabled: boolean;
}

export const DEFAULT_HOME_SECTIONS_ORDER: HomeDashboardSectionId[] = [
  'greeting_quick_access',
  'continue_listening',
  'daily_mixes',
  'made_for_you',
  'recently_added',
  'most_played',
  'explore_library',
  'unplayed_forgotten',
  'quick_collections',
  'listening_insights',
];

export const DEFAULT_HOME_SETTINGS: HomeDashboardSettings = {
  enabledSections: {
    greeting_quick_access: true,
    continue_listening: true,
    daily_mixes: true,
    made_for_you: true,
    recently_added: true,
    most_played: true,
    explore_library: true,
    unplayed_forgotten: true,
    quick_collections: true,
    listening_insights: true,
  },
  sectionOrder: DEFAULT_HOME_SECTIONS_ORDER,
  cardDensity: 'comfortable',
  itemsPerSection: 6,
  pinnedPlaylistIds: [],
  pinnedArtistIds: [],
  recommendationsEnabled: true,
};

export interface ExplainableTrackRecommendation {
  track: Track;
  reason: string;
  category:
    | 'because_you_like'
    | 'similar_music'
    | 'rediscover'
    | 'top_rated'
    | 'recently_discovered';
  sourceEntityName?: string;
}

export interface DailyMixCollection {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  gradient: string;
  tracks: Track[];
  coverArtUrl?: string;
  totalDuration: number;
}

export interface UnplayedAndForgottenBundle {
  neverPlayed: Track[];
  notPlayedRecently: Track[];
  highlyRatedRarelyPlayed: Track[];
  recentlyAddedUnplayed: Track[];
  forgottenFavorites: Track[];
}

export interface ListeningInsightsData {
  timeRange: 'today' | '7days' | '30days' | 'all';
  totalListeningSeconds: number;
  completedSessionsCount: number;
  topSong: Track | null;
  topArtist: { name: string; playCount: number; songCount: number } | null;
  topAlbum: { title: string; artist: string; playCount: number; coverArtUrl?: string } | null;
  topGenre: { name: string; playCount: number } | null;
  librarySummary: {
    totalSongs: number;
    totalAlbums: number;
    totalArtists: number;
    totalGenres: number;
    totalPlaylists: number;
    totalFavorites: number;
  };
  isEstimate: boolean;
}

export interface ContinueListeningData {
  lastTrack?: Track;
  lastPosition?: number;
  recentTracks: Track[];
  recentAlbums: Album[];
  recentPlaylists: PlaylistRecord[];
}


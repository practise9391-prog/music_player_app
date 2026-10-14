import { Track } from './track';

export type PlaylistType =
  | 'normal'
  | 'favorites'
  | 'recently_played'
  | 'recently_added'
  | 'most_played'
  | 'online_history'
  | 'smart';

export type SmartPlaylistField =
  | 'title'
  | 'artist'
  | 'album'
  | 'genre'
  | 'year'
  | 'duration'
  | 'play_count'
  | 'is_favorite'
  | 'rating'
  | 'source'
  | 'format'
  | 'bitrate'
  | 'sample_rate'
  | 'file_size'
  | 'tags'
  | 'date_added'
  | 'last_played_at';

export type SmartPlaylistOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'between'
  | 'before'
  | 'after';

export interface SmartPlaylistRule {
  id: string;
  field: SmartPlaylistField;
  operator: SmartPlaylistOperator;
  value: string | number | boolean;
  valueSecondary?: string | number; // for 'between'
}

export interface SmartPlaylistDefinition {
  matchMode: 'all' | 'any'; // AND vs OR
  rules: SmartPlaylistRule[];
  limit?: number; // max tracks
  sortBy?: SmartPlaylistField;
  sortOrder?: 'asc' | 'desc';
}

export interface PlaylistRecord {
  id: string;
  name: string;
  description?: string;
  coverArtUrl?: string; // custom image or base64 collage
  type: PlaylistType;
  isFavorite: boolean;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
  songCount?: number;
  totalDuration?: number;
  smartDefinition?: SmartPlaylistDefinition; // if type === 'smart'
}

export interface PlaylistTrackRecord {
  id?: number;
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: number;
  trackData?: Track; // snapshot / metadata reference for online or cached tracks
}

export type FavoriteItemType = 'track' | 'album' | 'artist';

export interface EntityFavoriteRecord {
  id: string; // `${type}_${itemId}`
  itemId: string;
  itemType: FavoriteItemType;
  title: string;
  subtitle?: string;
  coverArtUrl?: string;
  addedAt: number;
}

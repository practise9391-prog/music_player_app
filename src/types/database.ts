import { Track } from './track';
import { PlaybackStatePersistence } from './player';
import { AppSettings } from './settings';
import { ThemeConfig } from './theme';

export interface PlayHistoryRecord {
  id?: number;
  trackId: string;
  title: string;
  artist: string;
  playedAt: number; // timestamp
  playDuration: number; // seconds listened
  completed: boolean;
  source: 'local' | 'online';
}

export interface OnlineHistoryRecord {
  id: string; // generated uuid or sanitized url hash
  url: string;
  title: string;
  artist: string;
  thumbnail?: string;
  duration: number; // in seconds
  source: 'youtube' | 'stream' | 'direct';
  createdAt: number;
  lastPlayedAt: number;
  playCount: number;
  cached: boolean;
  cachePath?: string;
}

export type {
  PlaylistType,
  SmartPlaylistField,
  SmartPlaylistOperator,
  SmartPlaylistRule,
  SmartPlaylistDefinition,
  PlaylistRecord,
  PlaylistTrackRecord,
  FavoriteItemType,
  EntityFavoriteRecord,
} from './playlist';

export interface FavoriteRecord {
  id?: number;
  trackId: string;
  addedAt: number;
}

export interface MusicFolderRecord {
  id: string;
  path: string;
  enabled: boolean;
  dateAdded: number;
  lastScanned?: number;
  trackCount: number;
}

export interface ArtworkCacheRecord {
  id: string;
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  createdAt: number;
}

export interface PlayerStateRecord {
  key: string; // 'current_state'
  state: PlaybackStatePersistence;
  updatedAt: number;
}

export interface PlaybackSessionRecord {
  id?: number;
  trackId: string;
  startedAt: number;
  durationListened: number;
  completed: boolean;
  lastPosition: number;
}

export interface SearchHistoryRecord {
  id?: number;
  query: string;
  timestamp: number;
  count: number;
}

export interface LibraryStatistics {
  totalSongs: number;
  totalAlbums: number;
  totalArtists: number;
  totalGenres: number;
  totalDuration: number;
  totalStorageBytes: number;
  favoriteSongsCount: number;
  mostPlayedSong?: { title: string; artist: string; playCount: number };
  mostPlayedArtist?: { artist: string; playCount: number };
  mostPlayedAlbum?: { album: string; artist: string; playCount: number };
  formatCounts: Record<string, number>;
  bitrateDistribution: {
    under128: number;
    standard128to256: number;
    high256to320: number;
    lossless: number;
  };
  averageRating: number;
  ratedSongsCount: number;
}

export interface AudioBlobRecord {
  id: string; // trackId
  blob: Blob;
  size: number;
  mimeType: string;
  updatedAt: number;
}

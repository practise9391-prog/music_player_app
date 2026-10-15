import Dexie, { type Table } from 'dexie';
import {
  Track,
  PlayHistoryRecord,
  OnlineHistoryRecord,
  PlaylistRecord,
  PlaylistTrackRecord,
  FavoriteRecord,
  MusicFolderRecord,
  ArtworkCacheRecord,
  PlayerStateRecord,
  PlaybackSessionRecord,
  AudioPresetRecord,
  YouTubeHistoryRecord,
  EntityFavoriteRecord,
  SearchHistoryRecord,
  LyricsRecord,
  VisualizerPreset,
  DownloadRecord,
  FileOperationRecord,
  BookmarkRecord,
  TrackResumePosition,
  ListeningSessionConfig,
  AudioBlobRecord,
} from '../types';

export class MusicPlayerDatabase extends Dexie {
  tracks!: Table<Track, string>;
  downloads!: Table<DownloadRecord, string>;
  file_operations!: Table<FileOperationRecord, number>;
  play_history!: Table<PlayHistoryRecord, number>;
  online_history!: Table<OnlineHistoryRecord, string>;
  youtube_history!: Table<YouTubeHistoryRecord, string>;
  playlists!: Table<PlaylistRecord, string>;
  playlist_tracks!: Table<PlaylistTrackRecord, number>;
  favorites!: Table<FavoriteRecord, number>;
  folders!: Table<MusicFolderRecord, string>;
  artwork_cache!: Table<ArtworkCacheRecord, string>;
  player_state!: Table<PlayerStateRecord, string>;
  playback_sessions!: Table<PlaybackSessionRecord, number>;
  audio_presets!: Table<AudioPresetRecord, string>;
  entity_favorites!: Table<EntityFavoriteRecord, string>;
  search_history!: Table<SearchHistoryRecord, number>;
  lyrics!: Table<LyricsRecord, string>;
  visualizer_presets!: Table<VisualizerPreset, string>;
  settings_store!: Table<{ key: string; value: unknown }, string>;
  bookmarks!: Table<BookmarkRecord, number>;
  track_resume_positions!: Table<TrackResumePosition, string>;
  listening_sessions!: Table<ListeningSessionConfig, string>;
  audio_blobs!: Table<AudioBlobRecord, string>;

  constructor() {
    super('NovaMusicPlayerDB');

    // Schema v1
    this.version(1).stores({
      tracks: 'id, title, artist, album, format, dateAdded, lastPlayedAt, isFavorite, source',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, createdAt',
      playlist_tracks: '++id, playlistId, trackId, position',
      favorites: '++id, trackId, addedAt',
      folders: 'id, path, dateAdded',
      settings_store: 'key',
    });

    // Schema v2 (Part 2: extended indexes, normalized library queries, artwork cache)
    this.version(2).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, createdAt',
      playlist_tracks: '++id, playlistId, trackId, position',
      favorites: '++id, trackId, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      settings_store: 'key',
    });

    // Schema v3 (Part 3: player_state and playback_sessions persistence)
    this.version(3).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, createdAt',
      playlist_tracks: '++id, playlistId, trackId, position',
      favorites: '++id, trackId, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
    });

    // Schema v4 (Part 4: audio_presets table)
    this.version(4).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, createdAt',
      playlist_tracks: '++id, playlistId, trackId, position',
      favorites: '++id, trackId, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
    });

    // Schema v5 (Part 7: youtube_history table for canonical video ID tracking, caching & offline replay)
    this.version(5).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, createdAt',
      playlist_tracks: '++id, playlistId, trackId, position',
      favorites: '++id, trackId, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
    });

    // Schema v6 (Part 8: Playlists, Smart Collections, and Multi-Entity Favorites)
    this.version(6).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
    });

    // Schema v7 (Part 9: Advanced Search History, Ratings & Fast Metadata Indexes)
    this.version(7).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
    });

    // Schema v8 (Part 9: Lyrics, Synchronized Lyrics & Offline Lyrics Storage)
    this.version(8).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
      lyrics:
        'id, track_source_type, track_source_id, lyrics_type, language, source, is_synced, created_at, updated_at',
    });

    // Schema v9 (Part 10: Advanced Audio Visualizer Lab & Custom Presets)
    this.version(9).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
      lyrics:
        'id, track_source_type, track_source_id, lyrics_type, language, source, is_synced, created_at, updated_at',
      visualizer_presets: 'id, name, isBuiltin, createdAt, updatedAt',
    });

    // Schema v10 (Part 17: Download Manager & Offline Music Management)
    this.version(10).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt, isDownloaded, downloadId',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
      lyrics:
        'id, track_source_type, track_source_id, lyrics_type, language, source, is_synced, created_at, updated_at',
      visualizer_presets: 'id, name, isBuiltin, createdAt, updatedAt',
      downloads:
        'id, source_id, source_type, status, priority, created_at, completed_at, target_track_id',
    });

    // Schema v11 (Part 18: File Operations & Metadata History)
    this.version(11).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt, isDownloaded, downloadId',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
      lyrics:
        'id, track_source_type, track_source_id, lyrics_type, language, source, is_synced, created_at, updated_at',
      visualizer_presets: 'id, name, isBuiltin, createdAt, updatedAt',
      downloads:
        'id, source_id, source_type, status, priority, created_at, completed_at, target_track_id',
      file_operations:
        '++id, track_id, operation_type, timestamp, status',
    });

    // Schema v12 (Part 25: Bookmarks, Track Resume Positions, and Listening Sessions)
    this.version(12).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt, isDownloaded, downloadId',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
      lyrics:
        'id, track_source_type, track_source_id, lyrics_type, language, source, is_synced, created_at, updated_at',
      visualizer_presets: 'id, name, isBuiltin, createdAt, updatedAt',
      downloads:
        'id, source_id, source_type, status, priority, created_at, completed_at, target_track_id',
      file_operations:
        '++id, track_id, operation_type, timestamp, status',
      bookmarks: '++id, trackId, position, createdAt',
      track_resume_positions: 'trackId, position, updatedAt',
      listening_sessions: 'id, name, type, createdAt',
    });

    // Schema v13 (Part 26: Local Audio Blobs Storage & High-Performance Offline Playback)
    this.version(13).stores({
      tracks:
        'id, path, title, artist, album, genre, year, format, dateAdded, lastPlayedAt, isFavorite, rating, playCount, source, folderPath, isAvailable, modifiedAt, isDownloaded, downloadId',
      play_history: '++id, trackId, playedAt, source',
      online_history: 'id, url, title, artist, createdAt, lastPlayedAt, playCount, source, cached',
      playlists: 'id, name, type, isFavorite, createdAt, updatedAt',
      playlist_tracks: '++id, playlistId, trackId, position, addedAt',
      favorites: '++id, trackId, addedAt',
      entity_favorites: 'id, itemId, itemType, title, addedAt',
      folders: 'id, path, enabled, dateAdded, lastScanned',
      artwork_cache: 'id, createdAt',
      player_state: 'key',
      playback_sessions: '++id, trackId, startedAt, completed',
      settings_store: 'key',
      audio_presets: 'id, name, type, createdAt, updatedAt',
      youtube_history:
        'id, youtube_video_id, youtube_url, title, artist, last_played_at, play_count, is_favorite, cache_status, cache_last_used_at',
      search_history: '++id, &query, timestamp, count',
      lyrics:
        'id, track_source_type, track_source_id, lyrics_type, language, source, is_synced, created_at, updated_at',
      visualizer_presets: 'id, name, isBuiltin, createdAt, updatedAt',
      downloads:
        'id, source_id, source_type, status, priority, created_at, completed_at, target_track_id',
      file_operations:
        '++id, track_id, operation_type, timestamp, status',
      bookmarks: '++id, trackId, position, createdAt',
      track_resume_positions: 'trackId, position, updatedAt',
      listening_sessions: 'id, name, type, createdAt',
      audio_blobs: 'id, updatedAt',
    });
  }
}

export const db = new MusicPlayerDatabase();

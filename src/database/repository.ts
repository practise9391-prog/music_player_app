import { db } from './db';
import {
  Track,
  Album,
  Artist,
  Genre,
  FolderNode,
  PlayHistoryRecord,
  OnlineHistoryRecord,
  MusicFolderRecord,
  AppSettings,
  DEFAULT_SETTINGS,
  PlaybackStatePersistence,
  PlaybackSessionRecord,
  AudioPresetRecord,
  YouTubeHistoryRecord,
  PlaylistRecord,
  PlaylistTrackRecord,
  EntityFavoriteRecord,
  FavoriteItemType,
  SearchHistoryRecord,
  LibraryStatistics,
  DownloadRecord,
  DownloadStatus,
  FileOperationRecord,
  BookmarkRecord,
  TrackResumePosition,
  ListeningSessionConfig,
} from '../types';

export const TrackRepository = {
  async getAll(): Promise<Track[]> {
    return await db.tracks.filter((t) => t.isAvailable !== false).toArray();
  },

  async getAllIncludingUnavailable(): Promise<Track[]> {
    return await db.tracks.toArray();
  },

  async getById(id: string): Promise<Track | undefined> {
    return await db.tracks.get(id);
  },

  async save(track: Track): Promise<void> {
    await db.tracks.put(track);
  },

  async saveBatch(tracks: Track[]): Promise<void> {
    await db.tracks.bulkPut(tracks);
  },

  async remove(id: string): Promise<void> {
    await db.tracks.delete(id);
  },

  async setFavorite(id: string, isFavorite: boolean): Promise<void> {
    await db.tracks.update(id, { isFavorite });
  },

  async updatePlayStats(id: string): Promise<void> {
    const track = await db.tracks.get(id);
    if (track) {
      await db.tracks.update(id, {
        lastPlayedAt: Date.now(),
        playCount: (track.playCount || 0) + 1,
      });
    }
  },

  async getFavorites(): Promise<Track[]> {
    return await db.tracks
      .filter((t) => t.isFavorite && t.isAvailable !== false)
      .toArray();
  },

  async getRecentlyPlayed(limit = 20): Promise<Track[]> {
    const history = await db.play_history.orderBy('playedAt').reverse().limit(limit).toArray();
    const trackIds = [...new Set(history.map((h) => h.trackId))];
    const tracks: Track[] = [];
    for (const id of trackIds) {
      const track = await db.tracks.get(id);
      if (track && track.isAvailable !== false) tracks.push(track);
    }
    return tracks;
  },

  async getRecentlyAdded(limit = 24): Promise<Track[]> {
    return await db.tracks
      .filter((t) => t.isAvailable !== false)
      .reverse()
      .sortBy('dateAdded')
      .then((res) => res.slice(0, limit));
  },

  async getMostPlayed(limit = 24): Promise<Track[]> {
    const list = await db.tracks
      .filter((t) => t.isAvailable !== false && (t.playCount || 0) > 0)
      .toArray();
    return list.sort((a, b) => (b.playCount || 0) - (a.playCount || 0)).slice(0, limit);
  },

  async getUnplayed(limit = 50): Promise<Track[]> {
    return await db.tracks
      .filter((t) => t.isAvailable !== false && (!t.playCount || t.playCount === 0))
      .limit(limit)
      .toArray();
  },

  async search(query: string): Promise<Track[]> {
    if (!query || !query.trim()) return this.getAll();
    const clean = query.trim().toLowerCase();

    return await db.tracks
      .filter((t) => {
        if (t.isAvailable === false) return false;
        return Boolean(
          t.title.toLowerCase().includes(clean) ||
          t.artist.toLowerCase().includes(clean) ||
          (t.album && t.album.toLowerCase().includes(clean)) ||
          (t.genre && t.genre.toLowerCase().includes(clean)) ||
          (t.albumArtist && t.albumArtist.toLowerCase().includes(clean)) ||
          (t.filename && t.filename.toLowerCase().includes(clean)) ||
          (t.composer && t.composer.toLowerCase().includes(clean))
        );
      })
      .toArray();
  },

  async getAlbums(): Promise<Album[]> {
    const tracks = await this.getAll();
    const albumMap = new Map<string, Album>();

    for (const track of tracks) {
      const albumTitle = track.album || 'Unknown Album';
      const albumArtist = track.albumArtist || track.artist || 'Unknown Artist';
      const key = `${albumTitle.toLowerCase()}:::${albumArtist.toLowerCase()}`;

      let album = albumMap.get(key);
      if (!album) {
        album = {
          id: key,
          title: albumTitle,
          artist: albumArtist,
          year: track.year,
          genre: track.genre,
          trackCount: 0,
          duration: 0,
          coverArtUrl: track.coverArtUrl,
          tracks: [],
        };
        albumMap.set(key, album);
      }

      album.trackCount++;
      album.duration += track.duration || 0;
      if (!album.coverArtUrl && track.coverArtUrl) {
        album.coverArtUrl = track.coverArtUrl;
      }
      album.tracks.push(track);
    }

    // Sort tracks within each album by trackNumber
    for (const album of albumMap.values()) {
      album.tracks.sort((a, b) => (a.trackNumber || 999) - (b.trackNumber || 999));
    }

    return Array.from(albumMap.values()).sort((a, b) => a.title.localeCompare(b.title));
  },

  async getArtists(): Promise<Artist[]> {
    const tracks = await this.getAll();
    const artistMap = new Map<string, Artist>();

    for (const track of tracks) {
      const name = track.artist || 'Unknown Artist';
      const key = name.toLowerCase();

      let artist = artistMap.get(key);
      if (!artist) {
        artist = {
          id: key,
          name,
          trackCount: 0,
          albumCount: 0,
          duration: 0,
          albums: [],
          tracks: [],
        };
        artistMap.set(key, artist);
      }

      artist.trackCount++;
      artist.duration += track.duration || 0;
      if (track.album && !artist.albums.includes(track.album)) {
        artist.albums.push(track.album);
      }
      artist.tracks.push(track);
    }

    for (const artist of artistMap.values()) {
      artist.albumCount = artist.albums.length;
    }

    return Array.from(artistMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getGenres(): Promise<Genre[]> {
    const tracks = await this.getAll();
    const genreMap = new Map<string, Genre>();

    for (const track of tracks) {
      const g = track.genre?.trim() || 'Unknown Genre';
      const key = g.toLowerCase();

      let genre = genreMap.get(key);
      if (!genre) {
        genre = {
          name: g,
          trackCount: 0,
          duration: 0,
          tracks: [],
        };
        genreMap.set(key, genre);
      }

      genre.trackCount++;
      genre.duration += track.duration || 0;
      genre.tracks.push(track);
    }

    return Array.from(genreMap.values()).sort((a, b) => b.trackCount - a.trackCount);
  },

  async getFolderHierarchy(): Promise<FolderNode[]> {
    const folders = await FolderRepository.getAll();
    const tracks = await this.getAll();

    return folders.map((f) => {
      const folderTracks = tracks.filter((t) => t.folderPath === f.path);
      return {
        path: f.path,
        name: f.path.split('/').pop() || f.path,
        trackCount: folderTracks.length,
        subfolders: [],
        tracks: folderTracks,
      };
    });
  },

  async setRating(id: string, rating: number): Promise<void> {
    await db.tracks.update(id, { rating: Math.max(0, Math.min(5, Math.round(rating))) });
  },

  async updateMetadata(id: string, updates: Partial<Track>): Promise<void> {
    await db.tracks.update(id, { ...updates, modifiedAt: Date.now() });
  },

  async bulkUpdateMetadata(ids: string[], updates: Partial<Track>): Promise<void> {
    const modTime = Date.now();
    await db.transaction('rw', db.tracks, async () => {
      for (const id of ids) {
        await db.tracks.update(id, { ...updates, modifiedAt: modTime });
      }
    });
  },

  async updateTrackPath(
    id: string,
    newPath: string,
    newFilename?: string,
    newFolderPath?: string
  ): Promise<void> {
    const updates: Partial<Track> = {
      path: newPath,
      filename: newFilename || newPath.split('/').pop() || newPath,
      isAvailable: true,
      modifiedAt: Date.now(),
    };
    if (newFolderPath) {
      updates.folderPath = newFolderPath;
    }
    await db.tracks.update(id, updates);
  },

  async markUnavailable(id: string): Promise<void> {
    await db.tracks.update(id, { isAvailable: false });
  },

  async getMissingFiles(): Promise<Track[]> {
    return await db.tracks.filter((t) => t.isAvailable === false).toArray();
  },

  async getDuplicates(): Promise<{ original: Track; duplicates: Track[]; reason: string }[]> {
    const all = await this.getAllIncludingUnavailable();
    const results: { original: Track; duplicates: Track[]; reason: string }[] = [];
    const visited = new Set<string>();

    // 1. Group by file hash if available
    const hashGroups = new Map<string, Track[]>();
    for (const t of all) {
      if (t.fileHash) {
        const group = hashGroups.get(t.fileHash) || [];
        group.push(t);
        hashGroups.set(t.fileHash, group);
      }
    }
    for (const [, group] of hashGroups.entries()) {
      if (group.length > 1) {
        const original = group[0];
        const duplicates = group.slice(1);
        results.push({
          original,
          duplicates,
          reason: 'Identical file content / hash',
        });
        group.forEach((item) => visited.add(item.id));
      }
    }

    // 2. Group by title + artist + duration
    const titleArtistGroups = new Map<string, Track[]>();
    for (const t of all) {
      if (visited.has(t.id)) continue;
      const key = `${t.title.trim().toLowerCase()}:::${t.artist.trim().toLowerCase()}:::${Math.round(t.duration)}`;
      const group = titleArtistGroups.get(key) || [];
      group.push(t);
      titleArtistGroups.set(key, group);
    }
    for (const [, group] of titleArtistGroups.entries()) {
      if (group.length > 1) {
        const original = group[0];
        const duplicates = group.slice(1);
        results.push({
          original,
          duplicates,
          reason: 'Matching title, artist, and duration',
        });
        group.forEach((item) => visited.add(item.id));
      }
    }

    return results;
  },

  async getIncompleteMetadata(): Promise<{ track: Track; issues: string[] }[]> {
    const all = await this.getAll();
    const results: { track: Track; issues: string[] }[] = [];

    for (const t of all) {
      const issues: string[] = [];
      const titleClean = t.title.trim().toLowerCase();
      if (!t.title || titleClean === 'unknown track' || titleClean === 'untitled track') {
        issues.push('Missing or generic title');
      }
      const artistClean = t.artist.trim().toLowerCase();
      if (!t.artist || artistClean === 'unknown artist' || artistClean === 'various artists') {
        issues.push('Missing artist');
      }
      const albumClean = (t.album || '').trim().toLowerCase();
      if (!t.album || albumClean === 'unknown album') {
        issues.push('Missing album');
      }
      if (!t.genre || t.genre.trim().toLowerCase() === 'unclassified') {
        issues.push('Missing genre');
      }
      if (!t.year || t.year < 1900 || t.year > 2099) {
        issues.push('Missing or invalid release year');
      }
      if (!t.coverArtUrl) {
        issues.push('Missing cover artwork');
      }

      if (issues.length > 0) {
        results.push({ track: t, issues });
      }
    }

    return results;
  },

  async getLibraryStatistics(): Promise<LibraryStatistics> {
    const all = await this.getAll();
    const albums = await this.getAlbums();
    const artists = await this.getArtists();
    const genres = await this.getGenres();

    let totalDuration = 0;
    let totalStorageBytes = 0;
    let favoriteSongsCount = 0;
    let ratedSongsCount = 0;
    let ratingSum = 0;

    const formatCounts: Record<string, number> = {};
    const bitrateDistribution = {
      under128: 0,
      standard128to256: 0,
      high256to320: 0,
      lossless: 0,
    };

    let mostPlayedSong: Track | null = null;
    let mostPlayedArtistName = '';
    let maxArtistPlayCount = 0;
    const artistPlayMap = new Map<string, number>();

    let mostPlayedAlbumKey = '';
    let maxAlbumPlayCount = 0;
    const albumPlayMap = new Map<string, { album: string; artist: string; plays: number }>();

    for (const t of all) {
      totalDuration += t.duration || 0;
      totalStorageBytes += t.fileSize || 0;
      if (t.isFavorite) favoriteSongsCount++;

      if (t.rating && t.rating > 0) {
        ratedSongsCount++;
        ratingSum += t.rating;
      }

      const fmt = (t.format || 'unknown').toLowerCase();
      formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;

      const br = t.bitrate || 0;
      if (fmt === 'flac' || fmt === 'wav' || fmt === 'alac' || br >= 500) {
        bitrateDistribution.lossless++;
      } else if (br >= 256) {
        bitrateDistribution.high256to320++;
      } else if (br >= 128) {
        bitrateDistribution.standard128to256++;
      } else {
        bitrateDistribution.under128++;
      }

      if (!mostPlayedSong || (t.playCount || 0) > (mostPlayedSong.playCount || 0)) {
        if ((t.playCount || 0) > 0) mostPlayedSong = t;
      }

      const art = t.artist || 'Unknown';
      const curArtPlays = (artistPlayMap.get(art) || 0) + (t.playCount || 0);
      artistPlayMap.set(art, curArtPlays);
      if (curArtPlays > maxArtistPlayCount) {
        maxArtistPlayCount = curArtPlays;
        mostPlayedArtistName = art;
      }

      const alb = t.album || 'Unknown Album';
      const albKey = `${alb}:::${art}`;
      const albEntry = albumPlayMap.get(albKey) || { album: alb, artist: art, plays: 0 };
      albEntry.plays += t.playCount || 0;
      albumPlayMap.set(albKey, albEntry);
      if (albEntry.plays > maxAlbumPlayCount) {
        maxAlbumPlayCount = albEntry.plays;
        mostPlayedAlbumKey = albKey;
      }
    }

    const bestAlbum = mostPlayedAlbumKey ? albumPlayMap.get(mostPlayedAlbumKey) : null;

    return {
      totalSongs: all.length,
      totalAlbums: albums.length,
      totalArtists: artists.length,
      totalGenres: genres.length,
      totalDuration,
      totalStorageBytes,
      favoriteSongsCount,
      mostPlayedSong: mostPlayedSong
        ? {
            title: mostPlayedSong.title,
            artist: mostPlayedSong.artist,
            playCount: mostPlayedSong.playCount || 0,
          }
        : undefined,
      mostPlayedArtist: mostPlayedArtistName
        ? { artist: mostPlayedArtistName, playCount: maxArtistPlayCount }
        : undefined,
      mostPlayedAlbum: bestAlbum
        ? { album: bestAlbum.album, artist: bestAlbum.artist, playCount: bestAlbum.plays }
        : undefined,
      formatCounts,
      bitrateDistribution,
      averageRating: ratedSongsCount > 0 ? Number((ratingSum / ratedSongsCount).toFixed(1)) : 0,
      ratedSongsCount,
    };
  },
};

export const SearchHistoryRepository = {
  async addSearch(query: string): Promise<void> {
    const q = query.trim();
    if (!q) return;

    const existing = await db.search_history
      .filter((r) => r.query.toLowerCase() === q.toLowerCase())
      .first();

    const now = Date.now();
    if (existing && existing.id !== undefined) {
      await db.search_history.update(existing.id, {
        timestamp: now,
        count: (existing.count || 1) + 1,
      });
    } else {
      await db.search_history.add({
        query: q,
        timestamp: now,
        count: 1,
      });
    }
  },

  async getRecent(limit = 10): Promise<SearchHistoryRecord[]> {
    return await db.search_history.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async remove(id: number): Promise<void> {
    await db.search_history.delete(id);
  },

  async clear(): Promise<void> {
    await db.search_history.clear();
  },
};

export const PlayHistoryRepository = {
  async addRecord(record: Omit<PlayHistoryRecord, 'id'>): Promise<number> {
    return (await db.play_history.add(record as PlayHistoryRecord)) as number;
  },

  async getRecent(limit = 50): Promise<PlayHistoryRecord[]> {
    return await db.play_history.orderBy('playedAt').reverse().limit(limit).toArray();
  },

  async getAll(): Promise<PlayHistoryRecord[]> {
    return await db.play_history.orderBy('playedAt').reverse().toArray();
  },

  async clear(): Promise<void> {
    await db.play_history.clear();
  },
};

export const OnlineHistoryRepository = {
  async getAll(): Promise<OnlineHistoryRecord[]> {
    return await db.online_history.orderBy('lastPlayedAt').reverse().toArray();
  },

  async getById(id: string): Promise<OnlineHistoryRecord | undefined> {
    return await db.online_history.get(id);
  },

  async getByUrl(url: string): Promise<OnlineHistoryRecord | undefined> {
    return await db.online_history.where('url').equals(url).first();
  },

  async save(record: OnlineHistoryRecord): Promise<void> {
    await db.online_history.put(record);
  },

  async recordPlay(url: string, title?: string, artist?: string): Promise<OnlineHistoryRecord> {
    const existing = await this.getByUrl(url);
    const now = Date.now();
    if (existing) {
      const updated: OnlineHistoryRecord = {
        ...existing,
        title: title || existing.title,
        artist: artist || existing.artist,
        lastPlayedAt: now,
        playCount: existing.playCount + 1,
      };
      await db.online_history.put(updated);
      return updated;
    } else {
      const newRecord: OnlineHistoryRecord = {
        id: 'online_' + Math.random().toString(36).substring(2, 11),
        url,
        title: title || 'Online Stream',
        artist: artist || 'Unknown Source',
        duration: 0,
        source: url.includes('youtu') ? 'youtube' : 'stream',
        createdAt: now,
        lastPlayedAt: now,
        playCount: 1,
        cached: false,
      };
      await db.online_history.put(newRecord);
      return newRecord;
    }
  },

  async remove(id: string): Promise<void> {
    await db.online_history.delete(id);
  },

  async clear(): Promise<void> {
    await db.online_history.clear();
  },
};

export const YouTubeHistoryRepository = {
  async getAll(): Promise<YouTubeHistoryRecord[]> {
    return await db.youtube_history.orderBy('last_played_at').reverse().toArray();
  },

  async getByVideoId(videoId: string): Promise<YouTubeHistoryRecord | undefined> {
    return await db.youtube_history.where('youtube_video_id').equals(videoId).first();
  },

  async getById(id: string): Promise<YouTubeHistoryRecord | undefined> {
    return await db.youtube_history.get(id);
  },

  async save(record: YouTubeHistoryRecord): Promise<void> {
    await db.youtube_history.put(record);
  },

  async recordPlay(params: {
    videoId: string;
    canonicalUrl: string;
    title: string;
    artist?: string;
    channel?: string;
    duration?: number;
    thumbnailUrl?: string;
    codec?: string;
    bitrate?: number;
    sampleRate?: number;
  }): Promise<YouTubeHistoryRecord> {
    const existing = await this.getByVideoId(params.videoId);
    const now = Date.now();

    if (existing) {
      const updated: YouTubeHistoryRecord = {
        ...existing,
        title: params.title || existing.title,
        artist: params.artist || params.channel || existing.artist,
        channel: params.channel || existing.channel,
        duration: params.duration || existing.duration,
        thumbnail_url: params.thumbnailUrl || existing.thumbnail_url,
        codec: params.codec || existing.codec,
        bitrate: params.bitrate || existing.bitrate,
        sample_rate: params.sampleRate || existing.sample_rate,
        last_played_at: now,
        play_count: existing.play_count + 1,
      };
      await db.youtube_history.put(updated);
      return updated;
    } else {
      const newRecord: YouTubeHistoryRecord = {
        id: `yt_${params.videoId}`,
        youtube_video_id: params.videoId,
        youtube_url: params.canonicalUrl,
        title: params.title,
        artist: params.artist || params.channel || 'YouTube Audio',
        channel: params.channel,
        duration: params.duration || 0,
        thumbnail_url: params.thumbnailUrl,
        codec: params.codec,
        bitrate: params.bitrate,
        sample_rate: params.sampleRate,
        first_played_at: now,
        last_played_at: now,
        play_count: 1,
        last_position: 0,
        is_favorite: false,
        cache_status: 'NOT_CACHED',
      };
      await db.youtube_history.put(newRecord);
      return newRecord;
    }
  },

  async updatePosition(videoId: string, position: number): Promise<void> {
    const existing = await this.getByVideoId(videoId);
    if (existing) {
      await db.youtube_history.update(existing.id, {
        last_position: Math.max(0, position),
      });
    }
  },

  async toggleFavorite(videoId: string): Promise<boolean> {
    const existing = await this.getByVideoId(videoId);
    if (!existing) return false;
    const nextVal = !existing.is_favorite;
    await db.youtube_history.update(existing.id, {
      is_favorite: nextVal,
    });
    return nextVal;
  },

  async updateCacheStatus(
    videoId: string,
    cacheStatus: YouTubeHistoryRecord['cache_status'],
    details?: {
      cachePath?: string;
      cacheSize?: number;
      cacheCreatedAt?: number;
      cacheLastUsedAt?: number;
    }
  ): Promise<void> {
    const existing = await this.getByVideoId(videoId);
    if (existing) {
      await db.youtube_history.update(existing.id, {
        cache_status: cacheStatus,
        ...(details?.cachePath !== undefined ? { cache_path: details.cachePath } : {}),
        ...(details?.cacheSize !== undefined ? { cache_size: details.cacheSize } : {}),
        ...(details?.cacheCreatedAt !== undefined ? { cache_created_at: details.cacheCreatedAt } : {}),
        ...(details?.cacheLastUsedAt !== undefined ? { cache_last_used_at: details.cacheLastUsedAt } : {}),
      });
    }
  },

  async touchCache(videoId: string): Promise<void> {
    const existing = await this.getByVideoId(videoId);
    if (existing && existing.cache_status === 'CACHED') {
      await db.youtube_history.update(existing.id, {
        cache_last_used_at: Date.now(),
      });
    }
  },

  async remove(idOrVideoId: string): Promise<void> {
    const rec = (await db.youtube_history.get(idOrVideoId)) || (await this.getByVideoId(idOrVideoId));
    if (rec) {
      await db.youtube_history.delete(rec.id);
    }
  },

  async clear(): Promise<void> {
    await db.youtube_history.clear();
  },

  async search(query: string): Promise<YouTubeHistoryRecord[]> {
    if (!query.trim()) return await this.getAll();
    const q = query.toLowerCase().trim();
    return await db.youtube_history
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.artist.toLowerCase().includes(q) ||
          (item.channel && item.channel.toLowerCase().includes(q)) ||
          item.youtube_video_id.toLowerCase().includes(q)
      )
      .toArray();
  },

  async getCachedTracks(): Promise<YouTubeHistoryRecord[]> {
    return await db.youtube_history.where('cache_status').equals('CACHED').toArray();
  },

  async getFavorites(): Promise<YouTubeHistoryRecord[]> {
    return await db.youtube_history.where('is_favorite').equals(1).or('is_favorite').equals(true as any).toArray();
  },
};

export const FolderRepository = {
  async getAll(): Promise<MusicFolderRecord[]> {
    return await db.folders.toArray();
  },

  async addFolder(path: string): Promise<MusicFolderRecord> {
    const existing = await db.folders.get(path);
    if (existing) return existing;
    const folder: MusicFolderRecord = {
      id: path,
      path,
      enabled: true,
      dateAdded: Date.now(),
      trackCount: 0,
    };
    await db.folders.put(folder);
    return folder;
  },

  async removeFolder(path: string): Promise<void> {
    await db.folders.delete(path);
    // Mark tracks associated with this folder as unavailable
    await db.tracks.where('folderPath').equals(path).modify({ isAvailable: false });
  },

  async clearAll(): Promise<void> {
    await db.folders.clear();
  },
};

export const SettingsRepository = {
  async getSettings(): Promise<AppSettings> {
    try {
      const record = await db.settings_store.get('app_settings');
      if (record && record.value) {
        return { ...DEFAULT_SETTINGS, ...(record.value as Partial<AppSettings>) };
      }
    } catch {
      // IndexedDB fallback to localStorage
    }
    const local = localStorage.getItem('nova_app_settings');
    if (local) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    localStorage.setItem('nova_app_settings', JSON.stringify(settings));
    try {
      await db.settings_store.put({ key: 'app_settings', value: settings });
    } catch {
      // localStorage backup preserved
    }
  },
};

export const PlayerStateRepository = {
  async getPlayerState(): Promise<PlaybackStatePersistence | null> {
    try {
      const record = await db.player_state.get('current_state');
      if (record && record.state) {
        return record.state;
      }
    } catch {
      // ignore
    }
    const local = localStorage.getItem('nova_last_playback_state');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        return null;
      }
    }
    return null;
  },

  async savePlayerState(state: PlaybackStatePersistence): Promise<void> {
    try {
      localStorage.setItem('nova_last_playback_state', JSON.stringify(state));
    } catch {
      // ignore
    }
    try {
      await db.player_state.put({
        key: 'current_state',
        state,
        updatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
  },
};

export const PlaybackSessionRepository = {
  async recordSession(session: Omit<PlaybackSessionRecord, 'id'>): Promise<void> {
    try {
      await db.playback_sessions.add(session as PlaybackSessionRecord);
    } catch {
      // ignore
    }
  },

  async getSessions(limit = 100): Promise<PlaybackSessionRecord[]> {
    return await db.playback_sessions.orderBy('startedAt').reverse().limit(limit).toArray();
  },
};

export const AudioPresetRepository = {
  async getAll(): Promise<AudioPresetRecord[]> {
    try {
      return await db.audio_presets.toArray();
    } catch {
      return [];
    }
  },

  async getById(id: string): Promise<AudioPresetRecord | undefined> {
    try {
      return await db.audio_presets.get(id);
    } catch {
      return undefined;
    }
  },

  async save(preset: AudioPresetRecord): Promise<void> {
    try {
      await db.audio_presets.put(preset);
    } catch (err) {
      console.warn('Failed to save audio preset to DB:', err);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await db.audio_presets.delete(id);
    } catch (err) {
      console.warn('Failed to delete audio preset:', err);
    }
  },
};

function notifyPlaylistsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('nova-playlists-updated'));
  }
}

export const PlaylistRepository = {
  async getAll(): Promise<PlaylistRecord[]> {
    return await db.playlists.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id: string): Promise<PlaylistRecord | undefined> {
    return await db.playlists.get(id);
  },

  async save(playlist: PlaylistRecord): Promise<void> {
    await db.playlists.put(playlist);
    notifyPlaylistsChanged();
  },

  async create(name: string, description?: string, type: PlaylistRecord['type'] = 'normal'): Promise<PlaylistRecord> {
    const now = Date.now();
    const newRecord: PlaylistRecord = {
      id: `pl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim() || 'Untitled Playlist',
      description,
      type,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      songCount: 0,
      totalDuration: 0,
    };
    await db.playlists.put(newRecord);
    notifyPlaylistsChanged();
    return newRecord;
  },

  async rename(id: string, newName: string): Promise<void> {
    await db.playlists.update(id, {
      name: newName.trim(),
      updatedAt: Date.now(),
    });
    notifyPlaylistsChanged();
  },

  async updateMetadata(id: string, updates: Partial<PlaylistRecord>): Promise<void> {
    await db.playlists.update(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    notifyPlaylistsChanged();
  },

  async toggleFavorite(id: string): Promise<boolean> {
    const pl = await db.playlists.get(id);
    if (!pl) return false;
    const nextVal = !pl.isFavorite;
    await db.playlists.update(id, {
      isFavorite: nextVal,
      updatedAt: Date.now(),
    });
    notifyPlaylistsChanged();
    return nextVal;
  },

  async togglePinned(id: string): Promise<boolean> {
    const pl = await db.playlists.get(id);
    if (!pl) return false;
    const nextVal = !pl.isPinned;
    await db.playlists.update(id, {
      isPinned: nextVal,
      updatedAt: Date.now(),
    });
    notifyPlaylistsChanged();
    return nextVal;
  },

  async getPinned(): Promise<PlaylistRecord[]> {
    return await db.playlists.filter((p) => Boolean(p.isPinned)).toArray();
  },

  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.playlists, db.playlist_tracks, async () => {
      await db.playlists.delete(id);
      await db.playlist_tracks.where('playlistId').equals(id).delete();
    });
    notifyPlaylistsChanged();
  },

  async duplicate(id: string): Promise<PlaylistRecord | null> {
    const pl = await db.playlists.get(id);
    if (!pl) return null;
    const tracks = await db.playlist_tracks.where('playlistId').equals(id).sortBy('position');

    const now = Date.now();
    const newId = `pl_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const copy: PlaylistRecord = {
      ...pl,
      id: newId,
      name: `${pl.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', db.playlists, db.playlist_tracks, async () => {
      await db.playlists.put(copy);
      for (const t of tracks) {
        await db.playlist_tracks.add({
          playlistId: newId,
          trackId: t.trackId,
          position: t.position,
          addedAt: now,
          trackData: t.trackData,
        });
      }
    });

    notifyPlaylistsChanged();
    return copy;
  },
};

export const PlaylistTrackRepository = {
  async getTracksForPlaylist(playlistId: string): Promise<PlaylistTrackRecord[]> {
    return await db.playlist_tracks
      .where('playlistId')
      .equals(playlistId)
      .sortBy('position');
  },

  async addTracks(playlistId: string, tracks: Track[]): Promise<void> {
    const existing = await this.getTracksForPlaylist(playlistId);
    let nextPos = existing.length;
    const existingIds = new Set(existing.map((e) => e.trackId));
    const now = Date.now();

    await db.transaction('rw', db.playlists, db.playlist_tracks, async () => {
      for (const track of tracks) {
        // Enforce application-wide duplicate avoidance
        if (existingIds.has(track.id)) continue;
        await db.playlist_tracks.add({
          playlistId,
          trackId: track.id,
          position: nextPos++,
          addedAt: now,
          trackData: track,
        });
        existingIds.add(track.id);
      }

      // Update parent playlist songCount & totalDuration
      const updated = await db.playlist_tracks.where('playlistId').equals(playlistId).toArray();
      const totalDur = updated.reduce((acc, t) => acc + (t.trackData?.duration || 0), 0);
      await db.playlists.update(playlistId, {
        songCount: updated.length,
        totalDuration: totalDur,
        updatedAt: now,
      });
    });
    notifyPlaylistsChanged();
  },

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    await db.transaction('rw', db.playlists, db.playlist_tracks, async () => {
      await db.playlist_tracks
        .where('playlistId')
        .equals(playlistId)
        .and((t) => t.trackId === trackId)
        .delete();

      // Normalize positions
      const remaining = await db.playlist_tracks
        .where('playlistId')
        .equals(playlistId)
        .sortBy('position');

      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].id !== undefined) {
          await db.playlist_tracks.update(remaining[i].id!, { position: i });
        }
      }

      const totalDur = remaining.reduce((acc, t) => acc + (t.trackData?.duration || 0), 0);
      await db.playlists.update(playlistId, {
        songCount: remaining.length,
        totalDuration: totalDur,
        updatedAt: Date.now(),
      });
    });
    notifyPlaylistsChanged();
  },

  async reorderTrack(playlistId: string, fromIndex: number, toIndex: number): Promise<void> {
    const tracks = await db.playlist_tracks
      .where('playlistId')
      .equals(playlistId)
      .sortBy('position');

    if (
      fromIndex < 0 ||
      fromIndex >= tracks.length ||
      toIndex < 0 ||
      toIndex >= tracks.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [moved] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, moved);

    await db.transaction('rw', db.playlist_tracks, async () => {
      for (let i = 0; i < tracks.length; i++) {
        if (tracks[i].id !== undefined) {
          await db.playlist_tracks.update(tracks[i].id!, { position: i });
        }
      }
    });
    notifyPlaylistsChanged();
  },

  async clear(playlistId: string): Promise<void> {
    await db.transaction('rw', db.playlists, db.playlist_tracks, async () => {
      await db.playlist_tracks.where('playlistId').equals(playlistId).delete();
      await db.playlists.update(playlistId, {
        songCount: 0,
        totalDuration: 0,
        updatedAt: Date.now(),
      });
    });
    notifyPlaylistsChanged();
  },
};

export const EntityFavoriteRepository = {
  async getAll(): Promise<EntityFavoriteRecord[]> {
    return await db.entity_favorites.orderBy('addedAt').reverse().toArray();
  },

  async getByType(itemType: FavoriteItemType): Promise<EntityFavoriteRecord[]> {
    return await db.entity_favorites.where('itemType').equals(itemType).reverse().sortBy('addedAt');
  },

  async isFavorite(itemId: string, itemType: FavoriteItemType): Promise<boolean> {
    const id = `${itemType}_${itemId}`;
    const rec = await db.entity_favorites.get(id);
    return Boolean(rec);
  },

  async toggleFavorite(
    paramsOrId:
      | string
      | {
          itemId: string;
          itemType: FavoriteItemType;
          title: string;
          subtitle?: string;
          coverArtUrl?: string;
        },
    itemTypeArg?: FavoriteItemType,
    titleArg?: string,
    subtitleArg?: string,
    coverArtUrlArg?: string
  ): Promise<boolean> {
    let itemId: string;
    let itemType: FavoriteItemType;
    let title: string;
    let subtitle: string | undefined;
    let coverArtUrl: string | undefined;

    if (typeof paramsOrId === 'string') {
      itemId = paramsOrId;
      itemType = itemTypeArg || 'track';
      title = titleArg || itemId;
      subtitle = subtitleArg;
      coverArtUrl = coverArtUrlArg;
    } else {
      itemId = paramsOrId.itemId;
      itemType = paramsOrId.itemType;
      title = paramsOrId.title;
      subtitle = paramsOrId.subtitle;
      coverArtUrl = paramsOrId.coverArtUrl;
    }

    const id = `${itemType}_${itemId}`;
    const existing = await db.entity_favorites.get(id);

    if (existing) {
      await db.entity_favorites.delete(id);
      return false;
    } else {
      await db.entity_favorites.put({
        id,
        itemId,
        itemType,
        title,
        subtitle,
        coverArtUrl,
        addedAt: Date.now(),
      });
      return true;
    }
  },
};

export const DownloadRepository = {
  async getAll(): Promise<DownloadRecord[]> {
    return await db.downloads.orderBy('created_at').reverse().toArray();
  },

  async getByStatus(status: DownloadStatus): Promise<DownloadRecord[]> {
    return await db.downloads.where('status').equals(status).toArray();
  },

  async getById(id: string): Promise<DownloadRecord | undefined> {
    return await db.downloads.get(id);
  },

  async getBySourceId(sourceId: string): Promise<DownloadRecord | undefined> {
    return await db.downloads.where('source_id').equals(sourceId).first();
  },

  async save(record: DownloadRecord): Promise<void> {
    await db.downloads.put(record);
  },

  async update(id: string, updates: Partial<DownloadRecord>): Promise<void> {
    await db.downloads.update(id, updates);
  },

  async remove(id: string): Promise<void> {
    await db.downloads.delete(id);
  },

  async clearCompleted(): Promise<number> {
    const completed = await db.downloads.where('status').equals('completed').toArray();
    const ids = completed.map((r) => r.id);
    await db.downloads.bulkDelete(ids);
    return ids.length;
  },

  async clearFailed(): Promise<number> {
    const failed = await db.downloads.where('status').equals('failed').toArray();
    const ids = failed.map((r) => r.id);
    await db.downloads.bulkDelete(ids);
    return ids.length;
  },

  async clearCancelled(): Promise<number> {
    const cancelled = await db.downloads.where('status').equals('cancelled').toArray();
    const ids = cancelled.map((r) => r.id);
    await db.downloads.bulkDelete(ids);
    return ids.length;
  },

  async getCountsByStatus(): Promise<Record<DownloadStatus, number>> {
    const counts: Record<DownloadStatus, number> = {
      queued: 0,
      downloading: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    const all = await db.downloads.toArray();
    for (const item of all) {
      if (counts[item.status] !== undefined) {
        counts[item.status]++;
      }
    }
    return counts;
  },

  async getStorageUsage(): Promise<{ totalBytes: number; completedCount: number }> {
    const completed = await db.downloads.where('status').equals('completed').toArray();
    let totalBytes = 0;
    for (const r of completed) {
      totalBytes += r.downloaded_bytes || 0;
    }
    return {
      totalBytes,
      completedCount: completed.length,
    };
  },

  async getQueuedJobs(): Promise<DownloadRecord[]> {
    const queued = await db.downloads.where('status').equals('queued').toArray();
    // Sort: High priority first, then older created_at
    const priorityWeight: Record<string, number> = { high: 3, normal: 2, low: 1 };
    return queued.sort((a, b) => {
      const pDiff = (priorityWeight[b.priority] || 2) - (priorityWeight[a.priority] || 2);
      if (pDiff !== 0) return pDiff;
      return a.created_at - b.created_at;
    });
  },
};

export const FileOperationRepository = {
  async logOperation(record: Omit<FileOperationRecord, 'id'>): Promise<number> {
    try {
      return (await db.file_operations.add(record as FileOperationRecord)) as number;
    } catch {
      return 0;
    }
  },

  async getHistory(limit = 100): Promise<FileOperationRecord[]> {
    try {
      return await db.file_operations.orderBy('timestamp').reverse().limit(limit).toArray();
    } catch {
      return [];
    }
  },

  async getHistoryForTrack(trackId: string): Promise<FileOperationRecord[]> {
    try {
      return await db.file_operations
        .where('track_id')
        .equals(trackId)
        .reverse()
        .sortBy('timestamp');
    } catch {
      return [];
    }
  },

  async clearHistory(): Promise<void> {
    try {
      await db.file_operations.clear();
    } catch {
      // ignore
    }
  },
};

export const BookmarkRepository = {
  async add(record: Omit<BookmarkRecord, 'id'>): Promise<number> {
    try {
      return (await db.bookmarks.add(record as BookmarkRecord)) as number;
    } catch {
      return 0;
    }
  },

  async getByTrackId(trackId: string): Promise<BookmarkRecord[]> {
    try {
      return await db.bookmarks.where('trackId').equals(trackId).sortBy('position');
    } catch {
      return [];
    }
  },

  async getAll(): Promise<BookmarkRecord[]> {
    try {
      return await db.bookmarks.orderBy('createdAt').reverse().toArray();
    } catch {
      return [];
    }
  },

  async remove(id: number): Promise<void> {
    try {
      await db.bookmarks.delete(id);
    } catch {
      // ignore
    }
  },

  async update(id: number, updates: Partial<BookmarkRecord>): Promise<void> {
    try {
      await db.bookmarks.update(id, updates);
    } catch {
      // ignore
    }
  },
};

export const TrackResumeRepository = {
  async getPosition(trackId: string): Promise<TrackResumePosition | undefined> {
    try {
      return await db.track_resume_positions.get(trackId);
    } catch {
      return undefined;
    }
  },

  async savePosition(trackId: string, position: number, duration: number): Promise<void> {
    try {
      await db.track_resume_positions.put({
        trackId,
        position,
        duration,
        updatedAt: Date.now(),
      });
    } catch {
      // ignore
    }
  },

  async clearPosition(trackId: string): Promise<void> {
    try {
      await db.track_resume_positions.delete(trackId);
    } catch {
      // ignore
    }
  },

  async getAll(): Promise<TrackResumePosition[]> {
    try {
      return await db.track_resume_positions.toArray();
    } catch {
      return [];
    }
  },
};

export const ListeningSessionRepository = {
  async save(session: ListeningSessionConfig): Promise<void> {
    try {
      await db.listening_sessions.put(session);
    } catch {
      // ignore
    }
  },

  async getById(id: string): Promise<ListeningSessionConfig | undefined> {
    try {
      return await db.listening_sessions.get(id);
    } catch {
      return undefined;
    }
  },

  async getAll(): Promise<ListeningSessionConfig[]> {
    try {
      return await db.listening_sessions.orderBy('createdAt').reverse().toArray();
    } catch {
      return [];
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await db.listening_sessions.delete(id);
    } catch {
      // ignore
    }
  },
};




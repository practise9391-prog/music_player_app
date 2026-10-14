import {
  Track,
  Album,
  Artist,
  Genre,
  PlaylistRecord,
  HomeDashboardSettings,
  DEFAULT_HOME_SETTINGS,
  ExplainableTrackRecommendation,
  DailyMixCollection,
  UnplayedAndForgottenBundle,
  ListeningInsightsData,
  ContinueListeningData,
} from '../../types';
import {
  TrackRepository,
  PlaylistRepository,
  PlayHistoryRepository,
  PlaybackSessionRepository,
  PlayerStateRepository,
  SettingsRepository,
} from '../../database/repository';
import { SmartPlaylistEngine } from '../playlists/SmartPlaylistEngine';
import { audioEngineInstance } from '../../audio/AudioEngine';

const DISMISSED_RECOMMENDATIONS_KEY = 'nova_dismissed_recommendations';
const HOME_CUSTOMIZATION_KEY = 'nova_home_dashboard_settings';

export class MusicDiscoveryService {
  private static instance: MusicDiscoveryService | null = null;

  private constructor() {}

  public static getInstance(): MusicDiscoveryService {
    if (!this.instance) {
      this.instance = new MusicDiscoveryService();
    }
    return this.instance;
  }

  // ─────────────────────────────────────────────────────────────
  // 1. Home Dashboard Customization Preferences
  // ─────────────────────────────────────────────────────────────

  public async getDashboardSettings(): Promise<HomeDashboardSettings> {
    try {
      const appSettings = await SettingsRepository.getSettings();
      if (appSettings.homeDashboardSettings) {
        return {
          ...DEFAULT_HOME_SETTINGS,
          ...appSettings.homeDashboardSettings,
          enabledSections: {
            ...DEFAULT_HOME_SETTINGS.enabledSections,
            ...(appSettings.homeDashboardSettings.enabledSections || {}),
          },
        };
      }
    } catch {
      // Fallback to localStorage
    }

    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem(HOME_CUSTOMIZATION_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            ...DEFAULT_HOME_SETTINGS,
            ...parsed,
            enabledSections: {
              ...DEFAULT_HOME_SETTINGS.enabledSections,
              ...(parsed.enabledSections || {}),
            },
          };
        }
      } catch {
        // use default
      }
    }

    return DEFAULT_HOME_SETTINGS;
  }

  public async saveDashboardSettings(settings: HomeDashboardSettings): Promise<void> {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(HOME_CUSTOMIZATION_KEY, JSON.stringify(settings));
      } catch {
        // ignore
      }
    }

    try {
      const current = await SettingsRepository.getSettings();
      await SettingsRepository.saveSettings({
        ...current,
        homeDashboardSettings: settings,
      });
    } catch (err) {
      console.warn('Failed to save dashboard settings to SettingsRepository:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-home-settings-updated'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Track Availability Verification
  // ─────────────────────────────────────────────────────────────

  public verifyTrackPlayback(track: Track): { canPlay: boolean; reason?: string } {
    if (track.isAvailable === false) {
      return {
        canPlay: false,
        reason: `"${track.title}" is marked as unavailable or has been removed from storage.`,
      };
    }

    if (!track.path) {
      return {
        canPlay: false,
        reason: `"${track.title}" has an invalid or missing file path.`,
      };
    }

    return { canPlay: true };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Continue Listening
  // ─────────────────────────────────────────────────────────────

  public async getContinueListeningData(): Promise<ContinueListeningData> {
    const allTracks = await TrackRepository.getAll();
    const availableTracksMap = new Map(allTracks.map((t) => [t.id, t]));

    // 1. Determine last played track & position
    let lastTrack: Track | undefined;
    let lastPosition: number | undefined;

    const savedPlayerState = await PlayerStateRepository.getPlayerState();
    if (savedPlayerState && savedPlayerState.trackId) {
      const match = availableTracksMap.get(savedPlayerState.trackId);
      if (match && match.isAvailable !== false) {
        lastTrack = match;
        lastPosition = savedPlayerState.position;
      }
    }

    // Fallback: active audio engine track
    if (!lastTrack) {
      const active = audioEngineInstance.getCurrentTrack();
      if (active && availableTracksMap.has(active.id)) {
        lastTrack = availableTracksMap.get(active.id);
        lastPosition = audioEngineInstance.getCurrentTime();
      }
    }

    // Fallback: play history
    if (!lastTrack) {
      const recentHistory = await PlayHistoryRepository.getRecent(1);
      if (recentHistory.length > 0) {
        const histMatch = availableTracksMap.get(recentHistory[0].trackId);
        if (histMatch) {
          lastTrack = histMatch;
        }
      }
    }

    // 2. Recently played tracks
    const recentTracks = await TrackRepository.getRecentlyPlayed(12);

    // 3. Recently played albums (derived from recent tracks)
    const recentAlbumsMap = new Map<string, Album>();
    for (const track of recentTracks) {
      if (!track.album) continue;
      const albumKey = `${track.album.toLowerCase()}:::${(track.albumArtist || track.artist || '').toLowerCase()}`;
      if (!recentAlbumsMap.has(albumKey)) {
        recentAlbumsMap.set(albumKey, {
          id: albumKey,
          title: track.album,
          artist: track.albumArtist || track.artist || 'Unknown Artist',
          coverArtUrl: track.coverArtUrl,
          year: track.year,
          genre: track.genre,
          trackCount: 1,
          duration: track.duration || 0,
          tracks: [track],
        });
      }
    }
    const recentAlbums = Array.from(recentAlbumsMap.values()).slice(0, 6);

    // 4. Recently updated playlists
    const allPlaylists = await PlaylistRepository.getAll();
    const recentPlaylists = allPlaylists.slice(0, 6);

    return {
      lastTrack,
      lastPosition,
      recentTracks,
      recentAlbums,
      recentPlaylists,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Recently Added & Most Played
  // ─────────────────────────────────────────────────────────────

  public async getRecentlyAdded(limit = 12): Promise<Track[]> {
    return await TrackRepository.getRecentlyAdded(limit);
  }

  public async getMostPlayed(limit = 12): Promise<Track[]> {
    return await TrackRepository.getMostPlayed(limit);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Dismissible Recommendation State
  // ─────────────────────────────────────────────────────────────

  public getDismissedRecommendationIds(): string[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(DISMISSED_RECOMMENDATIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public dismissRecommendation(trackId: string): void {
    const dismissed = new Set(this.getDismissedRecommendationIds());
    dismissed.add(trackId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_RECOMMENDATIONS_KEY, JSON.stringify(Array.from(dismissed)));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-recommendations-updated'));
    }
  }

  public restoreRecommendation(trackId: string): void {
    const dismissed = new Set(this.getDismissedRecommendationIds());
    dismissed.delete(trackId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DISMISSED_RECOMMENDATIONS_KEY, JSON.stringify(Array.from(dismissed)));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-recommendations-updated'));
    }
  }

  public clearDismissedRecommendations(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DISMISSED_RECOMMENDATIONS_KEY);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-recommendations-updated'));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Explainable Offline Recommendations ("Made for You")
  // ─────────────────────────────────────────────────────────────

  public async getMadeForYouRecommendations(
    limitPerCategory = 6,
    options: { excludeDismissed?: boolean } = { excludeDismissed: true }
  ): Promise<ExplainableTrackRecommendation[]> {
    const settings = await this.getDashboardSettings();
    if (!settings.recommendationsEnabled) {
      return [];
    }

    const allTracks = await TrackRepository.getAll();
    const available = allTracks.filter((t) => t.isAvailable !== false);
    if (available.length === 0) return [];

    const dismissedIds = options.excludeDismissed
      ? new Set(this.getDismissedRecommendationIds())
      : new Set<string>();

    const candidateTracks = available.filter((t) => !dismissedIds.has(t.id));
    const recommendations: ExplainableTrackRecommendation[] = [];
    const recommendedTrackIds = new Set<string>();

    // ── Signal 1: "Because You Frequently Play [Artist]" ──
    const artistScores = new Map<string, number>();
    for (const t of available) {
      const art = t.artist?.trim();
      if (!art || art.toLowerCase() === 'unknown artist') continue;
      const weight = (t.playCount || 0) * 2 + (t.isFavorite ? 5 : 0) + (t.rating || 0);
      artistScores.set(art, (artistScores.get(art) || 0) + weight);
    }

    const sortedArtists = Array.from(artistScores.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedArtists.length > 0 && sortedArtists[0][1] > 2) {
      const topArtist = sortedArtists[0][0];
      const artistTracks = candidateTracks.filter(
        (t) =>
          t.artist?.toLowerCase().trim() === topArtist.toLowerCase() &&
          !recommendedTrackIds.has(t.id)
      );

      // Recommend tracks from top artist with least plays (discovery within favorite artist)
      const topArtistRecs = [...artistTracks]
        .sort((a, b) => (a.playCount || 0) - (b.playCount || 0))
        .slice(0, limitPerCategory);

      for (const t of topArtistRecs) {
        recommendations.push({
          track: t,
          reason: `Because you frequently listen to ${topArtist}`,
          category: 'because_you_like',
          sourceEntityName: topArtist,
        });
        recommendedTrackIds.add(t.id);
      }
    }

    // ── Signal 2: "Because You Love [Genre]" ──
    const genreScores = new Map<string, number>();
    for (const t of available) {
      const gen = t.genre?.trim();
      if (!gen || gen.toLowerCase() === 'unknown genre') continue;
      const weight = (t.playCount || 0) * 1.5 + (t.isFavorite ? 4 : 0) + (t.rating || 0);
      genreScores.set(gen, (genreScores.get(gen) || 0) + weight);
    }

    const sortedGenres = Array.from(genreScores.entries()).sort((a, b) => b[1] - a[1]);
    if (sortedGenres.length > 0 && sortedGenres[0][1] > 1) {
      const topGenre = sortedGenres[0][0];
      const genreTracks = candidateTracks.filter(
        (t) =>
          t.genre?.toLowerCase().trim() === topGenre.toLowerCase() &&
          !recommendedTrackIds.has(t.id)
      );

      const genreRecs = [...genreTracks]
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, limitPerCategory);

      for (const t of genreRecs) {
        recommendations.push({
          track: t,
          reason: `Because you love ${topGenre} music`,
          category: 'similar_music',
          sourceEntityName: topGenre,
        });
        recommendedTrackIds.add(t.id);
      }
    }

    // ── Signal 3: "Rediscover Your Music" ──
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const rediscoverCandidates = candidateTracks.filter(
      (t) =>
        !recommendedTrackIds.has(t.id) &&
        t.lastPlayedAt &&
        t.lastPlayedAt < fourteenDaysAgo &&
        (t.playCount || 0) > 0
    );

    rediscoverCandidates.sort((a, b) => (a.lastPlayedAt || 0) - (b.lastPlayedAt || 0));
    for (const t of rediscoverCandidates.slice(0, limitPerCategory)) {
      recommendations.push({
        track: t,
        reason: "You haven't played this song recently",
        category: 'rediscover',
      });
      recommendedTrackIds.add(t.id);
    }

    // ── Signal 4: "Top Rated Favorites" ──
    const topRatedCandidates = candidateTracks.filter(
      (t) =>
        !recommendedTrackIds.has(t.id) &&
        ((t.rating && t.rating >= 4) || t.isFavorite)
    );

    topRatedCandidates.sort((a, b) => {
      const scoreA = (a.rating || 0) + (a.isFavorite ? 5 : 0);
      const scoreB = (b.rating || 0) + (b.isFavorite ? 5 : 0);
      return scoreB - scoreA;
    });

    for (const t of topRatedCandidates.slice(0, limitPerCategory)) {
      recommendations.push({
        track: t,
        reason: t.rating
          ? `Rated ${t.rating} stars by you`
          : 'From your favorite songs collection',
        category: 'top_rated',
      });
      recommendedTrackIds.add(t.id);
    }

    // ── Signal 5: "Recently Added to Library" ──
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const recentlyAddedCandidates = candidateTracks.filter(
      (t) =>
        !recommendedTrackIds.has(t.id) &&
        t.dateAdded &&
        t.dateAdded > thirtyDaysAgo
    );

    recentlyAddedCandidates.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
    for (const t of recentlyAddedCandidates.slice(0, limitPerCategory)) {
      recommendations.push({
        track: t,
        reason: 'Recently added to your library',
        category: 'recently_discovered',
      });
      recommendedTrackIds.add(t.id);
    }

    return recommendations;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Daily Mixes & Dynamic Collections
  // ─────────────────────────────────────────────────────────────

  public async getDailyMixes(): Promise<DailyMixCollection[]> {
    const allTracks = await TrackRepository.getAll();
    const available = allTracks.filter((t) => t.isAvailable !== false);
    if (available.length === 0) return [];

    const mixes: DailyMixCollection[] = [];

    // 1. Favorite Mix
    const favorites = SmartPlaylistEngine.getFavorites(available);
    if (favorites.length >= 1) {
      const tracks = [...favorites].sort(() => 0.5 - Math.random()).slice(0, 25);
      mixes.push({
        id: 'mix_favorites',
        name: 'Favorite Mix',
        subtitle: `${tracks.length} songs from your favorites`,
        description: 'Curated mix of your personal favorites and top-rated songs.',
        gradient: 'from-purple-600 via-indigo-600 to-blue-700',
        tracks,
        coverArtUrl: tracks[0]?.coverArtUrl,
        totalDuration: tracks.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    // 2. Most Played Mix
    const mostPlayed = SmartPlaylistEngine.getMostPlayed(available, 25);
    if (mostPlayed.length >= 2) {
      mixes.push({
        id: 'mix_most_played',
        name: 'Heavy Rotation Mix',
        subtitle: `${mostPlayed.length} of your most played tracks`,
        description: 'The tracks you have on continuous repeat.',
        gradient: 'from-blue-600 via-cyan-600 to-teal-700',
        tracks: mostPlayed,
        coverArtUrl: mostPlayed[0]?.coverArtUrl,
        totalDuration: mostPlayed.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    // 3. Recently Added Mix
    const recentlyAdded = SmartPlaylistEngine.getRecentlyAdded(available, 25);
    if (recentlyAdded.length >= 2) {
      mixes.push({
        id: 'mix_recent_additions',
        name: 'Fresh Additions Mix',
        subtitle: `${recentlyAdded.length} newly added tracks`,
        description: 'The newest sound files imported into your library.',
        gradient: 'from-emerald-600 via-teal-600 to-cyan-700',
        tracks: recentlyAdded,
        coverArtUrl: recentlyAdded[0]?.coverArtUrl,
        totalDuration: recentlyAdded.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    // 4. Rediscover Mix
    const now = Date.now();
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const rediscoverTracks = available
      .filter((t) => t.lastPlayedAt && t.lastPlayedAt < fourteenDaysAgo && (t.playCount || 0) > 0)
      .sort((a, b) => (a.lastPlayedAt || 0) - (b.lastPlayedAt || 0))
      .slice(0, 25);

    if (rediscoverTracks.length >= 1) {
      mixes.push({
        id: 'mix_rediscover',
        name: 'Time Capsule Mix',
        subtitle: `${rediscoverTracks.length} tracks to revisit`,
        description: 'Rediscover songs you loved that have not been played lately.',
        gradient: 'from-amber-600 via-orange-600 to-rose-700',
        tracks: rediscoverTracks,
        coverArtUrl: rediscoverTracks[0]?.coverArtUrl,
        totalDuration: rediscoverTracks.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    // 5. High-Rating Mix
    const highRated = SmartPlaylistEngine.getTopRated(available, 4, 25);
    if (highRated.length >= 2) {
      mixes.push({
        id: 'mix_top_rated',
        name: '5-Star Mix',
        subtitle: `${highRated.length} top-rated masterpieces`,
        description: 'Highest rated songs in your music collection.',
        gradient: 'from-rose-600 via-pink-600 to-purple-700',
        tracks: highRated,
        coverArtUrl: highRated[0]?.coverArtUrl,
        totalDuration: highRated.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    // 6. Top Artist Mix
    const artistCounts = new Map<string, Track[]>();
    for (const t of available) {
      const art = t.artist?.trim();
      if (!art || art.toLowerCase() === 'unknown artist') continue;
      const list = artistCounts.get(art) || [];
      list.push(t);
      artistCounts.set(art, list);
    }
    const topArtistEntry = Array.from(artistCounts.entries()).sort(
      (a, b) => b[1].length - a[1].length
    )[0];

    if (topArtistEntry && topArtistEntry[1].length >= 3) {
      const artistTracks = topArtistEntry[1].slice(0, 25);
      mixes.push({
        id: `mix_artist_${topArtistEntry[0].toLowerCase().replace(/\s+/g, '_')}`,
        name: `${topArtistEntry[0]} Spotlight`,
        subtitle: `${artistTracks.length} tracks by ${topArtistEntry[0]}`,
        description: `Deep dive into ${topArtistEntry[0]}'s catalog in your collection.`,
        gradient: 'from-violet-600 via-fuchsia-600 to-pink-700',
        tracks: artistTracks,
        coverArtUrl: artistTracks[0]?.coverArtUrl,
        totalDuration: artistTracks.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    // 7. Top Genre Mix
    const genreCounts = new Map<string, Track[]>();
    for (const t of available) {
      const gen = t.genre?.trim();
      if (!gen || gen.toLowerCase() === 'unknown genre') continue;
      const list = genreCounts.get(gen) || [];
      list.push(t);
      genreCounts.set(gen, list);
    }
    const topGenreEntry = Array.from(genreCounts.entries()).sort(
      (a, b) => b[1].length - a[1].length
    )[0];

    if (topGenreEntry && topGenreEntry[1].length >= 3) {
      const genreTracks = topGenreEntry[1].slice(0, 25);
      mixes.push({
        id: `mix_genre_${topGenreEntry[0].toLowerCase().replace(/\s+/g, '_')}`,
        name: `${topGenreEntry[0]} Horizon`,
        subtitle: `${genreTracks.length} ${topGenreEntry[0]} tracks`,
        description: `Handcrafted ${topGenreEntry[0]} journey tailored from local library tracks.`,
        gradient: 'from-sky-600 via-blue-600 to-indigo-700',
        tracks: genreTracks,
        coverArtUrl: genreTracks[0]?.coverArtUrl,
        totalDuration: genreTracks.reduce((acc, t) => acc + (t.duration || 0), 0),
      });
    }

    return mixes;
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Discover Unplayed & Forgotten Music
  // ─────────────────────────────────────────────────────────────

  public async getUnplayedAndForgotten(): Promise<UnplayedAndForgottenBundle> {
    const allTracks = await TrackRepository.getAll();
    const available = allTracks.filter((t) => t.isAvailable !== false);
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

    const neverPlayed: Track[] = [];
    const notPlayedRecently: Track[] = [];
    const highlyRatedRarelyPlayed: Track[] = [];
    const recentlyAddedUnplayed: Track[] = [];
    const forgottenFavorites: Track[] = [];

    for (const track of available) {
      const plays = track.playCount || 0;
      const lastPlayed = track.lastPlayedAt || 0;
      const added = track.dateAdded || 0;
      const rating = track.rating || 0;

      if (plays === 0) {
        neverPlayed.push(track);
        if (added > thirtyDaysAgo) {
          recentlyAddedUnplayed.push(track);
        }
      } else if (lastPlayed && lastPlayed < thirtyDaysAgo) {
        notPlayedRecently.push(track);
      }

      if (rating >= 4 && plays < 3) {
        highlyRatedRarelyPlayed.push(track);
      }

      if (track.isFavorite && (!lastPlayed || lastPlayed < fourteenDaysAgo)) {
        forgottenFavorites.push(track);
      }
    }

    return {
      neverPlayed: neverPlayed.slice(0, 20),
      notPlayedRecently: notPlayedRecently.slice(0, 20),
      highlyRatedRarelyPlayed: highlyRatedRarelyPlayed.slice(0, 20),
      recentlyAddedUnplayed: recentlyAddedUnplayed.slice(0, 20),
      forgottenFavorites: forgottenFavorites.slice(0, 20),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 9. Listening Statistics & Insights
  // ─────────────────────────────────────────────────────────────

  public async getListeningInsights(
    timeRange: 'today' | '7days' | '30days' | 'all' = '30days'
  ): Promise<ListeningInsightsData> {
    const now = Date.now();
    let cutoffTimestamp = 0;

    if (timeRange === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      cutoffTimestamp = today.getTime();
    } else if (timeRange === '7days') {
      cutoffTimestamp = now - 7 * 24 * 60 * 60 * 1000;
    } else if (timeRange === '30days') {
      cutoffTimestamp = now - 30 * 24 * 60 * 60 * 1000;
    }

    // Query sessions and history
    const [allTracks, allAlbums, allArtists, allGenres, allPlaylists, sessions, history] =
      await Promise.all([
        TrackRepository.getAll(),
        TrackRepository.getAlbums(),
        TrackRepository.getArtists(),
        TrackRepository.getGenres(),
        PlaylistRepository.getAll(),
        PlaybackSessionRepository.getSessions(200),
        PlayHistoryRepository.getAll(),
      ]);

    const trackMap = new Map(allTracks.map((t) => [t.id, t]));

    // Filter sessions & history by time cutoff
    const rangeSessions = sessions.filter((s) => s.startedAt >= cutoffTimestamp);
    const rangeHistory = history.filter((h) => h.playedAt >= cutoffTimestamp);

    // Calculate total listening seconds
    let totalListeningSeconds = 0;
    let completedSessionsCount = 0;

    if (rangeSessions.length > 0) {
      for (const s of rangeSessions) {
        totalListeningSeconds += s.durationListened || 0;
        if (s.completed) completedSessionsCount++;
      }
    } else {
      // Estimate from play history records
      for (const h of rangeHistory) {
        const track = trackMap.get(h.trackId);
        if (track && track.duration) {
          totalListeningSeconds += Math.min(track.duration, 240); // reasonable cap
          completedSessionsCount++;
        }
      }
    }

    // Rank songs, artists, albums, genres within time range
    const songPlayCounts = new Map<string, number>();
    const artistPlayCounts = new Map<string, number>();
    const albumPlayCounts = new Map<string, number>();
    const genrePlayCounts = new Map<string, number>();

    if (rangeHistory.length > 0) {
      for (const h of rangeHistory) {
        const track = trackMap.get(h.trackId);
        if (!track) continue;

        songPlayCounts.set(track.id, (songPlayCounts.get(track.id) || 0) + 1);

        if (track.artist) {
          artistPlayCounts.set(
            track.artist,
            (artistPlayCounts.get(track.artist) || 0) + 1
          );
        }

        if (track.album) {
          const albKey = `${track.album}:::${track.artist || ''}`;
          albumPlayCounts.set(albKey, (albumPlayCounts.get(albKey) || 0) + 1);
        }

        if (track.genre) {
          genrePlayCounts.set(track.genre, (genrePlayCounts.get(track.genre) || 0) + 1);
        }
      }
    } else {
      // Fallback to track playCounts if no session/history timestamps
      for (const t of allTracks) {
        if ((t.playCount || 0) > 0) {
          songPlayCounts.set(t.id, t.playCount || 0);
          if (t.artist) {
            artistPlayCounts.set(
              t.artist,
              (artistPlayCounts.get(t.artist) || 0) + (t.playCount || 0)
            );
          }
          if (t.album) {
            const albKey = `${t.album}:::${t.artist || ''}`;
            albumPlayCounts.set(
              albKey,
              (albumPlayCounts.get(albKey) || 0) + (t.playCount || 0)
            );
          }
          if (t.genre) {
            genrePlayCounts.set(
              t.genre,
              (genrePlayCounts.get(t.genre) || 0) + (t.playCount || 0)
            );
          }
        }
      }
    }

    // Top Song
    let topSong: Track | null = null;
    let maxSongPlays = 0;
    for (const [id, count] of songPlayCounts.entries()) {
      if (count > maxSongPlays) {
        maxSongPlays = count;
        topSong = trackMap.get(id) || null;
      }
    }

    // Top Artist
    let topArtist: { name: string; playCount: number; songCount: number } | null = null;
    let maxArtistPlays = 0;
    for (const [name, count] of artistPlayCounts.entries()) {
      if (count > maxArtistPlays) {
        maxArtistPlays = count;
        const artistTracks = allTracks.filter((t) => t.artist === name);
        topArtist = {
          name,
          playCount: count,
          songCount: artistTracks.length,
        };
      }
    }

    // Top Album
    let topAlbum: { title: string; artist: string; playCount: number; coverArtUrl?: string } | null = null;
    let maxAlbumPlays = 0;
    for (const [key, count] of albumPlayCounts.entries()) {
      if (count > maxAlbumPlays) {
        maxAlbumPlays = count;
        const [title, artist] = key.split(':::');
        const match = allTracks.find((t) => t.album === title);
        topAlbum = {
          title,
          artist,
          playCount: count,
          coverArtUrl: match?.coverArtUrl,
        };
      }
    }

    // Top Genre
    let topGenre: { name: string; playCount: number } | null = null;
    let maxGenrePlays = 0;
    for (const [name, count] of genrePlayCounts.entries()) {
      if (count > maxGenrePlays) {
        maxGenrePlays = count;
        topGenre = { name, playCount: count };
      }
    }

    const favoriteCount = allTracks.filter((t) => t.isFavorite).length;

    return {
      timeRange,
      totalListeningSeconds,
      completedSessionsCount,
      topSong,
      topArtist,
      topAlbum,
      topGenre,
      librarySummary: {
        totalSongs: allTracks.length,
        totalAlbums: allAlbums.length,
        totalArtists: allArtists.length,
        totalGenres: allGenres.length,
        totalPlaylists: allPlaylists.length,
        totalFavorites: favoriteCount,
      },
      isEstimate: rangeSessions.length === 0 && rangeHistory.length === 0,
    };
  }
}

export const musicDiscoveryService = MusicDiscoveryService.getInstance();


import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePlayer } from '../../player/PlayerContext';
import { audioEngineInstance } from '../../audio/AudioEngine';
import { YouTubeUrlValidator } from '../../services/youtube/YouTubeUrlValidator';
import { YouTubeHistoryRepository, PlayHistoryRepository } from '../../database/repository';
import { YouTubeHistoryRecord } from '../../types/youtube';
import { Track } from '../../types';
import {
  Play,
  Pause,
  Loader2,
  Trash2,
  Music,
  Tv,
  Search,
  Sparkles,
  X,
  Volume2,
  Radio,
  ExternalLink,
} from 'lucide-react';

interface ActiveYouTubeVideo {
  videoId: string;
  canonicalUrl: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
}

export const YouTubePlayerPanel: React.FC = () => {
  const { setCurrentTrack, currentTrack, state: playerState } = usePlayer();
  const [inputUrl, setInputUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'song' | 'video'>('video');
  const [activeVideo, setActiveVideo] = useState<ActiveYouTubeVideo | null>(null);
  const [historyItems, setHistoryItems] = useState<YouTubeHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const records = await YouTubeHistoryRepository.getAll();
      setHistoryItems(records);
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Listen for local playback events to stop YouTube playback
  useEffect(() => {
    const handleStopYouTube = () => {
      setActiveVideo(null);
    };
    window.addEventListener('nova-stop-youtube', handleStopYouTube);
    return () => window.removeEventListener('nova-stop-youtube', handleStopYouTube);
  }, []);

  // Listen for toggle play/pause commands from mini-player or home
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ isPlaying?: boolean }>;
      const isPlaying = Boolean(customEvent.detail?.isPlaying);
      if (activeVideo) {
        const trk: Track = {
          id: `yt_${activeVideo.videoId}`,
          title: activeVideo.title,
          artist: activeVideo.channel,
          album: 'Online Stream',
          duration: 0,
          format: 'youtube',
          path: activeVideo.canonicalUrl,
          playbackUrl: activeVideo.canonicalUrl,
          coverArtUrl: activeVideo.thumbnailUrl,
          source: 'online',
          dateAdded: Date.now(),
          playCount: 1,
          isFavorite: false,
        };
        audioEngineInstance.setExternalTrack(trk, isPlaying ? 'playing' : 'paused');
      }
      const iframes = document.querySelectorAll('iframe[src*="youtube"]');
      iframes.forEach((iframe) => {
        const cmd = isPlaying ? 'playVideo' : 'pauseVideo';
        (iframe as HTMLIFrameElement).contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: cmd, args: '' }),
          '*'
        );
      });
    };
    window.addEventListener('nova-toggle-youtube-playback', handleToggle);
    return () => window.removeEventListener('nova-toggle-youtube-playback', handleToggle);
  }, [activeVideo]);

  // Listen for external requests to play YouTube (e.g. from History page)
  useEffect(() => {
    const handlePlayExternal = (e: Event) => {
      const customEvent = e as CustomEvent<{ url: string; videoId?: string; title?: string }>;
      if (customEvent.detail?.url) {
        handlePlayUrl(customEvent.detail.url);
      }
    };
    window.addEventListener('play-youtube-video', handlePlayExternal);
    return () => window.removeEventListener('play-youtube-video', handlePlayExternal);
  }, []);

  const fetchVideoMetadata = async (url: string, videoId: string): Promise<{ title: string; channel: string }> => {
    try {
      // Use noembed.com oEmbed proxy for fast, CORS-friendly metadata retrieval
      const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          title: data.title || `YouTube Video (${videoId})`,
          channel: data.author_name || 'YouTube',
        };
      }
    } catch {
      // Fallback
    }
    return {
      title: `YouTube Video (${videoId})`,
      channel: 'YouTube',
    };
  };

  const handlePlayUrl = async (urlToPlay?: string) => {
    const targetUrl = (urlToPlay || inputUrl).trim();
    if (!targetUrl) return;

    const validation = YouTubeUrlValidator.validate(targetUrl);
    if (!validation.isValid || !validation.videoId || !validation.cleanUrl) {
      setErrorMessage(validation.errorMessage || 'Please enter a valid YouTube link.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Pause any active local audio playback so streams do not clash
      audioEngineInstance.pause();

      const { videoId, cleanUrl } = validation;
      const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      // 2. Fetch video title and author/channel
      const metadata = await fetchVideoMetadata(cleanUrl, videoId);

      const videoData: ActiveYouTubeVideo = {
        videoId,
        canonicalUrl: cleanUrl,
        title: metadata.title,
        channel: metadata.channel,
        thumbnailUrl,
      };

      setActiveVideo(videoData);
      if (!urlToPlay) {
        setInputUrl('');
      }

      // Synchronize with global player state
      const onlineTrack: Track = {
        id: `yt_${videoId}`,
        title: metadata.title,
        artist: metadata.channel,
        album: 'YouTube Stream',
        duration: 0,
        format: 'youtube',
        codec: 'aac',
        path: cleanUrl,
        playbackUrl: cleanUrl,
        coverArtUrl: thumbnailUrl,
        source: 'online',
        isFavorite: false,
        dateAdded: Date.now(),
        lastPlayedAt: Date.now(),
        playCount: 1,
        isAvailable: true,
      };
      audioEngineInstance.setExternalTrack(onlineTrack, 'playing');
      setCurrentTrack(onlineTrack);

      // 3. Record playback in local Dexie database for history & replay
      await YouTubeHistoryRepository.recordPlay({
        videoId,
        canonicalUrl: cleanUrl,
        title: metadata.title,
        channel: metadata.channel,
        duration: 0,
        thumbnailUrl,
      });

      await PlayHistoryRepository.addRecord({
        trackId: `yt_${videoId}`,
        title: metadata.title,
        artist: metadata.channel,
        playedAt: Date.now(),
        playDuration: 0,
        completed: false,
        source: 'online',
      });

      window.dispatchEvent(new CustomEvent('nova-library-updated'));
      await loadHistory();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load YouTube stream. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await YouTubeHistoryRepository.remove(id);
      setHistoryItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      // ignore
    }
  };

  const handleClearHistory = async () => {
    try {
      await YouTubeHistoryRepository.clear();
      setHistoryItems([]);
    } catch {
      // ignore
    }
  };

  const quickChips = [
    { label: 'Relaxing Piano', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
    { label: 'Synthwave Radio', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* 1. YouTube URL Input & Search Card */}
      <div className="p-4 sm:p-6 rounded-3xl bg-[var(--surface-card)] border border-[var(--border)] shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)]">
                Online Player
              </h2>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)]">
                Paste any YouTube song or video link to play directly
              </p>
            </div>
          </div>
        </div>

        {/* Input Row */}
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Paste YouTube link here... (e.g. https://www.youtube.com/watch?v=...)"
            value={inputUrl}
            onChange={(e) => {
              setInputUrl(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handlePlayUrl();
            }}
            className="w-full pl-4 pr-28 py-3.5 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
          />

          {inputUrl && (
            <button
              onClick={() => setInputUrl('')}
              className="absolute right-24 p-1 rounded-full text-[var(--text-muted)] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => handlePlayUrl()}
            disabled={isLoading || !inputUrl.trim()}
            className="absolute right-1.5 px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 active:scale-95"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Example Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] text-[var(--text-muted)] font-medium">Quick links:</span>
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handlePlayUrl(chip.url)}
              className="px-2.5 py-1 rounded-full bg-[var(--surface-secondary)] hover:bg-purple-600/20 hover:text-purple-300 border border-[var(--border)] text-[11px] text-[var(--text-secondary)] transition-colors active:scale-95"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Active Now Playing YouTube Card with Song / Video Mode Toggle */}
      {activeVideo && (
        <div className="p-4 sm:p-6 rounded-3xl bg-gradient-to-b from-purple-950/40 via-[var(--surface-card)] to-slate-950/60 border border-purple-500/30 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Now Streaming Online
              </span>
            </div>

            {/* Mode Switch: [ Song ] [ Video ] */}
            <div className="flex items-center bg-[var(--surface-secondary)] p-1 rounded-xl border border-[var(--border)]">
              <button
                onClick={() => setViewMode('song')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'song'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span>Song</span>
              </button>
              <button
                onClick={() => setViewMode('video')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'video'
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                    : 'text-[var(--text-muted)] hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Video</span>
              </button>
            </div>
          </div>

          {/* Video View Mode */}
          {viewMode === 'video' ? (
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-2xl border border-purple-500/30 bg-black">
              <iframe
                id="yt-player-iframe"
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&enablejsapi=1&playsinline=1`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            /* Song View Mode (Audio focus with rich visualizer) */
            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-[var(--surface-secondary)]/50 border border-[var(--border)]">
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden shadow-xl border border-purple-500/40 shrink-0">
                <img
                  src={activeVideo.thumbnailUrl}
                  alt={activeVideo.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                  <div className="flex items-end gap-1 h-4">
                    <span className="w-1 h-3 bg-purple-400 rounded-full animate-pulse" />
                    <span className="w-1 h-4 bg-pink-400 rounded-full animate-pulse delay-75" />
                    <span className="w-1 h-2.5 bg-cyan-400 rounded-full animate-pulse delay-150" />
                    <span className="w-1 h-3.5 bg-indigo-400 rounded-full animate-pulse delay-100" />
                  </div>
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
                  Audio Mode
                </span>
                <h3 className="text-base sm:text-lg font-bold text-white line-clamp-2">
                  {activeVideo.title}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] font-medium">
                  {activeVideo.channel}
                </p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-[var(--text-muted)]">
                  <Volume2 className="w-4 h-4 text-purple-400" />
                  <span>Streaming directly via official YouTube engine</span>
                </div>
              </div>

              {/* Keep iframe embedded in background so audio continues without video layout */}
              <iframe
                id="yt-player-iframe-audio"
                src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?autoplay=1&enablejsapi=1&playsinline=1`}
                title={activeVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                className="absolute w-[1px] h-[1px] opacity-0 pointer-events-none -left-[9999px]"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          )}

          {/* Active Video Footer */}
          <div className="flex items-center justify-between pt-2">
            <div className="min-w-0 flex-1 pr-4">
              <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                {activeVideo.title}
              </h4>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">
                {activeVideo.channel}
              </p>
            </div>
            <button
              onClick={() => setActiveVideo(null)}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-rose-500/20 text-xs text-[var(--text-muted)] hover:text-rose-300 border border-[var(--border)] transition-colors"
            >
              Close Player
            </button>
          </div>
        </div>
      )}

      {/* 3. Recent Online Plays */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs sm:text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Recent Online Plays
            </h3>
          </div>
          {historyItems.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-[11px] text-rose-400 hover:text-rose-300 transition-colors"
            >
              Clear History
            </button>
          )}
        </div>

        {isLoadingHistory ? (
          <div className="p-8 text-center text-xs text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
            Loading online history...
          </div>
        ) : historyItems.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-[var(--surface-card)] border border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1.5">
            <Music className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
            <p className="font-semibold text-[var(--text-secondary)]">No online tracks played yet</p>
            <p className="text-[11px]">Paste a YouTube link above to stream music.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {historyItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handlePlayUrl(item.youtube_url)}
                className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-card)] hover:bg-[var(--surface-secondary)] border border-[var(--border)] hover:border-purple-500/40 cursor-pointer transition-all shadow-md group active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[var(--surface-secondary)] border border-[var(--border-subtle)]">
                    {item.thumbnail_url ? (
                      <img
                        src={item.thumbnail_url}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-purple-400">
                        <Music className="w-6 h-6" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-5 h-5 text-white fill-current" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                      {item.channel || item.artist || 'YouTube'}
                    </p>
                    <span className="inline-block mt-1 text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.2 rounded font-mono">
                      YouTube
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={(e) => handleDeleteHistory(e, item.id)}
                    className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Remove from history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

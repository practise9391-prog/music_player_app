import * as mm from 'music-metadata-browser';
import { Track } from '../types';
import { artworkCache } from './artworkCache';

export interface ExtractedMetadata {
  title: string;
  artist: string;
  album: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  discNumber?: number;
  composer?: string;
  comment?: string;
  duration: number;
  bitrate?: number;
  sampleRate?: number;
  bitDepth?: number;
  channels?: number;
  codec?: string;
  trackGain?: number;
  albumGain?: number;
  trackPeak?: number;
  coverArtId?: string;
  coverArtUrl?: string;
  lyrics?: string;
}

/**
 * Strips track numbers, leading dashes, underscores, and extension from filename
 * e.g., "04 - Midnight Ambient Wave.mp3" -> "Midnight Ambient Wave"
 * "01. Telugu Song.m4a" -> "Telugu Song"
 */
export function cleanFilenameToTitle(filename: string): string {
  if (!filename) return 'Untitled Track';

  // Remove extension
  let name = filename.replace(/\.[a-zA-Z0-9]{2,5}$/, '');

  // Remove leading numbers, track indices e.g. "01 - ", "01. ", "1 - "
  name = name.replace(/^(\d{1,3}[\s._-]+)+/, '');

  // Replace underscores with spaces
  name = name.replace(/_/g, ' ');

  // Trim whitespace
  name = name.trim();

  return name || filename;
}

/**
 * Computes a stable identity hash for duplicate detection across folders and rescans
 */
export function generateTrackIdentity(
  normalizedPath: string,
  fileSize: number,
  modifiedAt: number
): string {
  // Simple deterministic hash based on path, size, and modified time
  const raw = `${normalizedPath.trim().toLowerCase()}::${fileSize}::${modifiedAt}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return 'tr_' + Math.abs(hash).toString(36) + '_' + fileSize.toString(36);
}

/**
 * Parses an audio File or Blob completely offline without any network interaction.
 */
export async function parseAudioFileMetadata(
  file: File | Blob,
  filePath: string,
  fileName: string,
  modifiedAt = Date.now()
): Promise<ExtractedMetadata> {
  const fallbackTitle = cleanFilenameToTitle(fileName);
  const fileSize = file.size;

  let metadata: mm.IAudioMetadata | null = null;

  try {
    // Read tags offline using music-metadata-browser
    metadata = await mm.parseBlob(file, { duration: true, skipCovers: false });
  } catch {
    // File might have non-standard/incomplete ID3 tags, applying graceful fallback
  }

  const common = metadata?.common;
  const format = metadata?.format;

  const title = common?.title?.trim() || fallbackTitle;
  const artist = common?.artist?.trim() || common?.albumartist?.trim() || 'Unknown Artist';
  const album = common?.album?.trim() || 'Unknown Album';
  const albumArtist = common?.albumartist?.trim();
  const genre = common?.genre?.[0]?.trim() || (common?.genre as unknown as string) || undefined;
  const year = common?.year || (common?.date ? parseInt(common.date) : undefined);
  const trackNumber = common?.track?.no || undefined;
  const discNumber = common?.disk?.no || undefined;
  const composer = common?.composer?.[0]?.trim();
  const comment = common?.comment?.[0];

  const duration = format?.duration && !isNaN(format.duration) ? Math.round(format.duration) : 0;
  const bitrate = format?.bitrate ? Math.round(format.bitrate / 1000) : undefined;
  const sampleRate = format?.sampleRate || undefined;
  const bitDepth = format?.bitsPerSample || undefined;
  const channels = format?.numberOfChannels || undefined;
  const codec = format?.codec || undefined;

  // ReplayGain tags
  const trackGain =
    typeof common?.replaygain_track_gain?.dB === 'number'
      ? common.replaygain_track_gain.dB
      : undefined;
  const albumGain =
    typeof common?.replaygain_album_gain?.dB === 'number'
      ? common.replaygain_album_gain.dB
      : undefined;
  const trackPeak =
    typeof common?.replaygain_track_peak?.ratio === 'number'
      ? common.replaygain_track_peak.ratio
      : undefined;

  let coverArtId: string | undefined = undefined;
  let coverArtUrl: string | undefined = undefined;

  // Extract embedded album artwork (ID3 APIC, Vorbis FLAC Picture, MP4 covr)
  const picture = mm.selectCover(common?.picture);
  if (picture && picture.data && picture.data.length > 0) {
    try {
      const artHash = 'art_' + Math.abs(
        picture.data.slice(0, 100).reduce((acc, b) => (acc << 5) - acc + b, 0)
      ).toString(36);

      coverArtId = artHash;
      coverArtUrl = await artworkCache.storeArtwork(
        artHash,
        picture.data,
        picture.format || 'image/jpeg'
      );
    } catch (e) {
      console.warn('Failed to cache embedded album artwork:', e);
    }
  }

  // Extract embedded lyrics from ID3 (USLT), Vorbis comments, or MP4 metadata
  let lyrics: string | undefined = undefined;
  if (common?.lyrics && common.lyrics.length > 0) {
    lyrics = Array.isArray(common.lyrics) ? common.lyrics.join('\n').trim() : String(common.lyrics).trim();
  }

  return {
    title,
    artist,
    album,
    albumArtist,
    genre,
    year,
    trackNumber,
    discNumber,
    composer,
    comment,
    duration,
    bitrate,
    sampleRate,
    bitDepth,
    channels,
    codec,
    trackGain,
    albumGain,
    trackPeak,
    coverArtId,
    coverArtUrl,
    lyrics,
  };
}

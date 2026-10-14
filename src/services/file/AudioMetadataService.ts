import { Track } from '../../types';
import { AudioFormatCapability } from '../../types/fileManagement';
import { TrackRepository, FileOperationRepository } from '../../database/repository';
import { artworkCache } from '../../library/artworkCache';

export class AudioMetadataService {
  private static instance: AudioMetadataService | null = null;

  private constructor() {}

  public static getInstance(): AudioMetadataService {
    if (!this.instance) {
      this.instance = new AudioMetadataService();
    }
    return this.instance;
  }

  /**
   * Returns metadata editing and embedding capabilities for a given audio format.
   */
  public getFormatCapability(format?: string): AudioFormatCapability {
    const norm = (format || 'mp3').toLowerCase().replace(/^\./, '');

    switch (norm) {
      case 'mp3':
        return {
          format: 'mp3',
          displayName: 'MPEG Audio Layer III (MP3)',
          canEditTags: true,
          canEmbedArtwork: true,
          canEmbedLyrics: true,
          canWrite: true,
          standard: 'ID3v2.3 / ID3v2.4',
          container: 'mp3',
          notes: 'Full ID3v2.3 tag standard supported with embedded APIC artwork and USLT lyrics.',
          supportedFields: [
            'title',
            'artist',
            'album',
            'albumArtist',
            'genre',
            'year',
            'trackNumber',
            'totalTracks',
            'discNumber',
            'composer',
            'contributingArtists',
            'copyright',
            'comment',
            'lyrics',
          ],
          limitationsDescription:
            'Full ID3v2.3 tag standard supported with embedded APIC artwork and USLT lyrics.',
        };

      case 'flac':
        return {
          format: 'flac',
          displayName: 'Free Lossless Audio Codec (FLAC)',
          canEditTags: true,
          canEmbedArtwork: true,
          canEmbedLyrics: true,
          canWrite: true,
          standard: 'Vorbis Comment',
          container: 'flac',
          notes: 'Vorbis comments and METADATA_BLOCK_PICTURE supported. Library tags updated immediately.',
          supportedFields: [
            'title',
            'artist',
            'album',
            'albumArtist',
            'genre',
            'year',
            'trackNumber',
            'totalTracks',
            'discNumber',
            'composer',
            'comment',
            'lyrics',
          ],
          limitationsDescription:
            'Vorbis comments and METADATA_BLOCK_PICTURE supported. Library tags updated immediately.',
        };

      case 'm4a':
      case 'aac':
        return {
          format: norm,
          displayName: 'MPEG-4 Audio (M4A / AAC)',
          canEditTags: true,
          canEmbedArtwork: true,
          canEmbedLyrics: true,
          canWrite: true,
          standard: 'MP4 Atoms / ilst',
          container: norm,
          notes: 'MPEG-4 iTunes-style metadata atoms (moov.udta.meta.ilst) supported. Library tags updated immediately.',
          supportedFields: [
            'title',
            'artist',
            'album',
            'albumArtist',
            'genre',
            'year',
            'trackNumber',
            'totalTracks',
            'discNumber',
            'composer',
            'comment',
            'lyrics',
          ],
          limitationsDescription:
            'MPEG-4 iTunes-style metadata atoms (moov.udta.meta.ilst) supported. Library tags updated immediately.',
        };

      case 'ogg':
        return {
          format: 'ogg',
          displayName: 'Ogg Vorbis Audio',
          canEditTags: true,
          canEmbedArtwork: false,
          canEmbedLyrics: true,
          canWrite: true,
          standard: 'Vorbis Comment',
          container: 'ogg',
          notes: 'Vorbis comments supported. Ogg containers do not natively embed binary APIC album art; artwork is safely saved in the application cache.',
          supportedFields: [
            'title',
            'artist',
            'album',
            'genre',
            'year',
            'trackNumber',
            'composer',
            'comment',
            'lyrics',
          ],
          limitationsDescription:
            'Vorbis comments supported. Ogg containers do not natively embed binary APIC album art; artwork is safely saved in the application cache.',
        };

      case 'opus':
      case 'webm':
        return {
          format: norm,
          displayName: 'Opus Audio (Ogg/WebM)',
          canEditTags: true,
          canEmbedArtwork: false,
          canEmbedLyrics: true,
          canWrite: true,
          standard: 'Vorbis Comment',
          container: norm,
          notes: 'Opus Vorbis comment headers supported. Artwork is saved in the application local cache.',
          supportedFields: [
            'title',
            'artist',
            'album',
            'genre',
            'year',
            'trackNumber',
            'composer',
            'comment',
            'lyrics',
          ],
          limitationsDescription:
            'Opus Vorbis comment headers supported. Artwork is saved in the application local cache.',
        };

      case 'wav':
        return {
          format: 'wav',
          displayName: 'Waveform Audio File Format (WAV)',
          canEditTags: false,
          canEmbedArtwork: false,
          canEmbedLyrics: false,
          canWrite: false,
          standard: 'RIFF INFO',
          container: 'wav',
          notes: 'Limited embedded metadata support. Tag writing is restricted to prevent container corruption. All tags and artwork are safely indexed in the application library.',
          supportedFields: [
            'title',
            'artist',
            'album',
            'genre',
            'year',
            'trackNumber',
            'composer',
            'comment',
          ],
          limitationsDescription:
            'Standard PCM WAV format lacks universal embedded ID3 tag support across mobile players. All tags and artwork are safely indexed in the application library.',
        };

      default:
        return {
          format: norm,
          displayName: norm.toUpperCase(),
          canEditTags: false,
          canEmbedArtwork: false,
          canEmbedLyrics: false,
          canWrite: false,
          standard: 'Unknown',
          container: norm,
          notes: 'Tags and artwork are safely saved to the application music library database.',
          supportedFields: ['title', 'artist', 'album', 'genre', 'year', 'trackNumber', 'comment'],
          limitationsDescription:
            'Tags and artwork are safely saved to the application music library database.',
        };
    }
  }

  /**
   * Generates a 4-byte synchsafe integer (7 bits per byte, MSB 0) for ID3v2 headers.
   */
  private encodeSynchsafeInteger(value: number): Uint8Array {
    const bytes = new Uint8Array(4);
    bytes[0] = (value >> 21) & 0x7f;
    bytes[1] = (value >> 14) & 0x7f;
    bytes[2] = (value >> 7) & 0x7f;
    bytes[3] = value & 0x7f;
    return bytes;
  }

  /**
   * Constructs a standard ID3v2.3 text frame (e.g. TIT2, TPE1, TALB).
   */
  private createId3TextFrame(frameId: string, text: string): Uint8Array | null {
    if (!text || !frameId || frameId.length !== 4) return null;

    const encoder = new TextEncoder();
    const encodedText = encoder.encode(text);
    // 1 byte for encoding (0x03 = UTF-8) + text bytes
    const framePayload = new Uint8Array(1 + encodedText.length);
    framePayload[0] = 0x03; // UTF-8
    framePayload.set(encodedText, 1);

    // Frame header: 4 bytes ID + 4 bytes Size (standard big-endian in ID3v2.3) + 2 bytes Flags
    const frameHeader = new Uint8Array(10);
    for (let i = 0; i < 4; i++) {
      frameHeader[i] = frameId.charCodeAt(i);
    }
    const size = framePayload.length;
    frameHeader[4] = (size >> 24) & 0xff;
    frameHeader[5] = (size >> 16) & 0xff;
    frameHeader[6] = (size >> 8) & 0xff;
    frameHeader[7] = size & 0xff;
    frameHeader[8] = 0x00;
    frameHeader[9] = 0x00;

    const fullFrame = new Uint8Array(frameHeader.length + framePayload.length);
    fullFrame.set(frameHeader, 0);
    fullFrame.set(framePayload, frameHeader.length);
    return fullFrame;
  }

  /**
   * Constructs an ID3v2.3 APIC (Attached Picture) frame.
   */
  private createId3PictureFrame(imageBytes: Uint8Array, mimeType = 'image/jpeg'): Uint8Array | null {
    if (!imageBytes || imageBytes.length === 0) return null;

    const mimeAscii = new TextEncoder().encode(mimeType);
    // Encoding (1 byte 0x00) + MIME string + Null byte (1 byte) + Picture Type (0x03 Cover front) + Description (1 null byte 0x00) + image data
    const headerPart = new Uint8Array(1 + mimeAscii.length + 1 + 1 + 1);
    let offset = 0;
    headerPart[offset++] = 0x00; // ISO-8859-1 for MIME and description
    headerPart.set(mimeAscii, offset);
    offset += mimeAscii.length;
    headerPart[offset++] = 0x00; // Null terminator for MIME
    headerPart[offset++] = 0x03; // Front Cover
    headerPart[offset++] = 0x00; // Empty description null terminator

    const framePayload = new Uint8Array(headerPart.length + imageBytes.length);
    framePayload.set(headerPart, 0);
    framePayload.set(imageBytes, headerPart.length);

    const frameHeader = new Uint8Array(10);
    const frameId = 'APIC';
    for (let i = 0; i < 4; i++) {
      frameHeader[i] = frameId.charCodeAt(i);
    }
    const size = framePayload.length;
    frameHeader[4] = (size >> 24) & 0xff;
    frameHeader[5] = (size >> 16) & 0xff;
    frameHeader[6] = (size >> 8) & 0xff;
    frameHeader[7] = size & 0xff;
    frameHeader[8] = 0x00;
    frameHeader[9] = 0x00;

    const fullFrame = new Uint8Array(frameHeader.length + framePayload.length);
    fullFrame.set(frameHeader, 0);
    fullFrame.set(framePayload, frameHeader.length);
    return fullFrame;
  }

  /**
   * Constructs an ID3v2.3 USLT (Unsynchronized lyrics) frame.
   */
  private createId3LyricsFrame(lyrics: string): Uint8Array | null {
    if (!lyrics) return null;

    const encoder = new TextEncoder();
    const encodedLyrics = encoder.encode(lyrics);
    // Encoding (1 byte 0x03 UTF-8) + Language (3 bytes "eng") + Descriptor null (1 byte 0x00) + lyrics
    const framePayload = new Uint8Array(1 + 3 + 1 + encodedLyrics.length);
    let offset = 0;
    framePayload[offset++] = 0x03; // UTF-8
    framePayload[offset++] = 'e'.charCodeAt(0);
    framePayload[offset++] = 'n'.charCodeAt(0);
    framePayload[offset++] = 'g'.charCodeAt(0);
    framePayload[offset++] = 0x00; // Empty description null terminator
    framePayload.set(encodedLyrics, offset);

    const frameHeader = new Uint8Array(10);
    const frameId = 'USLT';
    for (let i = 0; i < 4; i++) {
      frameHeader[i] = frameId.charCodeAt(i);
    }
    const size = framePayload.length;
    frameHeader[4] = (size >> 24) & 0xff;
    frameHeader[5] = (size >> 16) & 0xff;
    frameHeader[6] = (size >> 8) & 0xff;
    frameHeader[7] = size & 0xff;
    frameHeader[8] = 0x00;
    frameHeader[9] = 0x00;

    const fullFrame = new Uint8Array(frameHeader.length + framePayload.length);
    fullFrame.set(frameHeader, 0);
    fullFrame.set(framePayload, frameHeader.length);
    return fullFrame;
  }

  /**
   * Generates a complete ID3v2.3 tag buffer from metadata fields and optional artwork.
   */
  public generateId3v2Tag(
    metadata: {
      title?: string;
      artist?: string;
      album?: string;
      albumArtist?: string;
      genre?: string;
      year?: number;
      trackNumber?: number;
      totalTracks?: number;
      discNumber?: number;
      composer?: string;
      comment?: string;
      lyrics?: string;
    },
    artworkBytes?: Uint8Array,
    artworkMime = 'image/jpeg'
  ): Uint8Array {
    const frames: Uint8Array[] = [];

    // Title (TIT2)
    if (metadata.title) {
      const f = this.createId3TextFrame('TIT2', metadata.title);
      if (f) frames.push(f);
    }
    // Artist (TPE1)
    if (metadata.artist) {
      const f = this.createId3TextFrame('TPE1', metadata.artist);
      if (f) frames.push(f);
    }
    // Album (TALB)
    if (metadata.album) {
      const f = this.createId3TextFrame('TALB', metadata.album);
      if (f) frames.push(f);
    }
    // Album Artist (TPE2)
    if (metadata.albumArtist) {
      const f = this.createId3TextFrame('TPE2', metadata.albumArtist);
      if (f) frames.push(f);
    }
    // Genre (TCON)
    if (metadata.genre) {
      const f = this.createId3TextFrame('TCON', metadata.genre);
      if (f) frames.push(f);
    }
    // Year (TYER)
    if (metadata.year) {
      const f = this.createId3TextFrame('TYER', String(metadata.year));
      if (f) frames.push(f);
    }
    // Track Number (TRCK e.g. "4/12")
    if (metadata.trackNumber) {
      const str = metadata.totalTracks
        ? `${metadata.trackNumber}/${metadata.totalTracks}`
        : String(metadata.trackNumber);
      const f = this.createId3TextFrame('TRCK', str);
      if (f) frames.push(f);
    }
    // Disc Number (TPOS)
    if (metadata.discNumber) {
      const f = this.createId3TextFrame('TPOS', String(metadata.discNumber));
      if (f) frames.push(f);
    }
    // Composer (TCOM)
    if (metadata.composer) {
      const f = this.createId3TextFrame('TCOM', metadata.composer);
      if (f) frames.push(f);
    }
    // Comment (COMM)
    if (metadata.comment) {
      const f = this.createId3TextFrame('COMM', metadata.comment);
      if (f) frames.push(f);
    }
    // Embedded Lyrics (USLT)
    if (metadata.lyrics) {
      const f = this.createId3LyricsFrame(metadata.lyrics);
      if (f) frames.push(f);
    }
    // Embedded Artwork (APIC)
    if (artworkBytes && artworkBytes.length > 0) {
      const f = this.createId3PictureFrame(artworkBytes, artworkMime);
      if (f) frames.push(f);
    }

    // Compute total frames size
    const totalFramesSize = frames.reduce((acc, f) => acc + f.length, 0);

    // ID3v2 header: 10 bytes
    // 'ID3' (3 bytes) + Version (2 bytes: 0x03 0x00) + Flags (1 byte: 0x00) + Synchsafe Size (4 bytes)
    const header = new Uint8Array(10);
    header[0] = 0x49; // 'I'
    header[1] = 0x44; // 'D'
    header[2] = 0x33; // '3'
    header[3] = 0x03; // Version 2.3
    header[4] = 0x00; // Revision 0
    header[5] = 0x00; // Flags

    const synchsafe = this.encodeSynchsafeInteger(totalFramesSize);
    header.set(synchsafe, 6);

    const tagBuffer = new Uint8Array(10 + totalFramesSize);
    tagBuffer.set(header, 0);
    let offset = 10;
    for (const frame of frames) {
      tagBuffer.set(frame, offset);
      offset += frame.length;
    }

    return tagBuffer;
  }

  /**
   * Applies ID3v2 tags directly to an existing MP3 Blob by replacing/prepending tags.
   */
  public async writeMp3Tags(
    audioBlob: Blob,
    metadata: {
      title?: string;
      artist?: string;
      album?: string;
      albumArtist?: string;
      genre?: string;
      year?: number;
      trackNumber?: number;
      totalTracks?: number;
      discNumber?: number;
      composer?: string;
      comment?: string;
      lyrics?: string;
    },
    artworkBytes?: Uint8Array,
    artworkMime?: string
  ): Promise<Blob> {
    const newTagBytes = this.generateId3v2Tag(metadata, artworkBytes, artworkMime);

    // Check if source blob already has an ID3v2 header
    const slice = audioBlob.slice(0, 10);
    const sliceBuf = await slice.arrayBuffer();
    const sliceBytes = new Uint8Array(sliceBuf);

    let audioStartOffset = 0;
    if (sliceBytes[0] === 0x49 && sliceBytes[1] === 0x44 && sliceBytes[2] === 0x33) {
      // Existing ID3 header. Calculate existing tag length to slice off
      const existingSize =
        ((sliceBytes[6] & 0x7f) << 21) |
        ((sliceBytes[7] & 0x7f) << 14) |
        ((sliceBytes[8] & 0x7f) << 7) |
        (sliceBytes[9] & 0x7f);
      audioStartOffset = 10 + existingSize;
    }

    const audioPayload = audioBlob.slice(audioStartOffset);
    return new Blob([newTagBytes as any, audioPayload], { type: 'audio/mpeg' });
  }

  /**
   * Alias for generateId3v2Tag.
   */
  public buildId3v2Tag(
    metadata: {
      title?: string;
      artist?: string;
      album?: string;
      albumArtist?: string;
      genre?: string;
      year?: number;
      trackNumber?: number;
      totalTracks?: number;
      discNumber?: number;
      composer?: string;
      comment?: string;
      lyrics?: string;
    },
    artworkBytes?: Uint8Array,
    artworkMime?: string
  ): ArrayBuffer {
    const uint8 = this.generateId3v2Tag(metadata, artworkBytes, artworkMime);
    return uint8.buffer.slice(
      uint8.byteOffset,
      uint8.byteOffset + uint8.byteLength
    ) as ArrayBuffer;
  }

  /**
   * Updates metadata for a track, persisting changes in the database and optionally embedding
   * into the physical/in-memory file if format permits.
   */
  public async updateTrackMetadata(
    trackOrId: Track | string,
    updates: Partial<Track>,
    optionsOrAudioBlob?: { writeToFile?: boolean } | Blob,
    artworkBlob?: Blob
  ): Promise<{
    success: boolean;
    updatedTrack?: Track;
    track?: Track;
    newBlob?: Blob;
    writtenToFile: boolean;
    message: string;
    error?: string;
  }> {
    const track = typeof trackOrId === 'string'
      ? await TrackRepository.getById(trackOrId)
      : trackOrId;

    if (!track) {
      return {
        success: false,
        writtenToFile: false,
        message: 'Track not found',
        error: `Track with ID "${trackOrId}" not found in database.`,
      };
    }

    const prevValues: Record<string, unknown> = {
      title: track.title,
      artist: track.artist,
      album: track.album,
      albumArtist: track.albumArtist,
      genre: track.genre,
      year: track.year,
      trackNumber: track.trackNumber,
      totalTracks: track.totalTracks,
      discNumber: track.discNumber,
      composer: track.composer,
      comment: track.comment,
    };

    let writtenToFile = false;
    let newBlob: Blob | undefined = undefined;
    const formatCap = this.getFormatCapability(track.format);

    const audioBlob = optionsOrAudioBlob instanceof Blob ? optionsOrAudioBlob : undefined;

    // If artwork blob was supplied, store in cache and set coverArtUrl
    let coverArtUrl = updates.coverArtUrl !== undefined ? updates.coverArtUrl : track.coverArtUrl;
    let coverArtId = track.coverArtId;
    let artworkBytes: Uint8Array | undefined = undefined;

    if (artworkBlob) {
      try {
        const buf = await artworkBlob.arrayBuffer();
        artworkBytes = new Uint8Array(buf);
        const artHash = 'art_' + Math.abs(
          artworkBytes.slice(0, 100).reduce((acc, b) => (acc << 5) - acc + b, 0)
        ).toString(36);
        coverArtId = artHash;
        coverArtUrl = await artworkCache.storeArtwork(artHash, artworkBytes, artworkBlob.type || 'image/jpeg');
      } catch (err) {
        console.warn('Failed to cache artwork during metadata update:', err);
      }
    }

    // If we have an audio blob and format is MP3, embed tags into file
    if (audioBlob && formatCap.canEditTags && (track.format === 'mp3' || audioBlob.type === 'audio/mpeg')) {
      try {
        newBlob = await this.writeMp3Tags(
          audioBlob,
          {
            title: updates.title !== undefined ? updates.title : track.title,
            artist: updates.artist !== undefined ? updates.artist : track.artist,
            album: updates.album !== undefined ? updates.album : track.album,
            albumArtist: updates.albumArtist !== undefined ? updates.albumArtist : track.albumArtist,
            genre: updates.genre !== undefined ? updates.genre : track.genre,
            year: updates.year !== undefined ? updates.year : track.year,
            trackNumber: updates.trackNumber !== undefined ? updates.trackNumber : track.trackNumber,
            totalTracks: updates.totalTracks !== undefined ? updates.totalTracks : track.totalTracks,
            discNumber: updates.discNumber !== undefined ? updates.discNumber : track.discNumber,
            composer: updates.composer !== undefined ? updates.composer : track.composer,
            comment: updates.comment !== undefined ? updates.comment : track.comment,
            lyrics: updates.lyrics !== undefined ? updates.lyrics : track.lyrics,
          },
          artworkBytes,
          artworkBlob?.type || 'image/jpeg'
        );
        writtenToFile = true;
      } catch (e) {
        console.warn('Failed to write ID3 tags into audio blob:', e);
      }
    }

    // Merge clean updates into Track record
    const finalUpdates: Partial<Track> = {
      ...updates,
      coverArtUrl,
      coverArtId,
      modifiedAt: Date.now(),
    };

    // Update in database repository
    await TrackRepository.updateMetadata(track.id, finalUpdates);

    const updatedTrack: Track = {
      ...track,
      ...finalUpdates,
    };

    // Log in operation history
    await FileOperationRepository.logOperation({
      track_id: track.id,
      operation_type: 'METADATA_EDIT',
      timestamp: Date.now(),
      details: `Updated metadata for "${updatedTrack.title}" (${writtenToFile ? 'Embedded in file & library' : 'Library database'})`,
      source_path: track.path,
      previous_values: prevValues,
      new_values: updates,
      status: 'success',
    });

    // Notify UI that library records changed
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('nova-library-updated'));
    }

    const message = writtenToFile
      ? `Updated tags and embedded into audio file for "${updatedTrack.title}".`
      : `Saved metadata for "${updatedTrack.title}" to library. ${formatCap.limitationsDescription || ''}`;

    return {
      success: true,
      updatedTrack,
      track: updatedTrack,
      newBlob,
      writtenToFile,
      message,
    };
  }

  /**
   * Batch updates common metadata fields across multiple tracks.
   */
  public async batchUpdateMetadata(
    tracksOrIds: (Track | string)[],
    commonUpdates: Partial<Track>,
    options?: { writeToFile?: boolean }
  ): Promise<{
    successCount: number;
    succeeded: number;
    failedCount: number;
    failed: number;
    results: { trackId: string; success: boolean; error?: string }[];
    errors: { trackId: string; title: string; error: string }[];
  }> {
    let successCount = 0;
    let failedCount = 0;
    const results: { trackId: string; success: boolean; error?: string }[] = [];
    const errors: { trackId: string; title: string; error: string }[] = [];

    const resolvedTracks: Track[] = [];
    for (const item of tracksOrIds) {
      const trackId = typeof item === 'string' ? item : item.id;
      const track = typeof item === 'string' ? await TrackRepository.getById(item) : item;
      if (track) {
        resolvedTracks.push(track);
      } else {
        failedCount++;
        results.push({ trackId, success: false, error: 'Track not found' });
        errors.push({ trackId, title: trackId, error: 'Track not found in database.' });
      }
    }

    if (resolvedTracks.length > 0) {
      const trackIds = resolvedTracks.map((t) => t.id);
      try {
        await TrackRepository.bulkUpdateMetadata(trackIds, commonUpdates);
        successCount += resolvedTracks.length;
        for (const t of resolvedTracks) {
          results.push({ trackId: t.id, success: true });
        }

        // Log bulk operation
        await FileOperationRepository.logOperation({
          track_id: trackIds.join(','),
          operation_type: 'METADATA_EDIT',
          timestamp: Date.now(),
          details: `Batch updated ${resolvedTracks.length} tracks with fields: ${Object.keys(commonUpdates).join(', ')}`,
          new_values: commonUpdates,
          status: 'success',
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('nova-library-updated'));
        }
      } catch (err: any) {
        failedCount += resolvedTracks.length;
        for (const t of resolvedTracks) {
          results.push({ trackId: t.id, success: false, error: err?.message || 'Database error' });
          errors.push({
            trackId: t.id,
            title: t.title,
            error: err?.message || 'Database error during batch update',
          });
        }
      }
    }

    return {
      successCount,
      succeeded: successCount,
      failedCount,
      failed: failedCount,
      results,
      errors,
    };
  }
}

export const audioMetadataService = AudioMetadataService.getInstance();


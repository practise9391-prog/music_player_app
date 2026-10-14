import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../database/db';
import {
  TrackRepository,
  FileOperationRepository,
  PlaylistRepository,
  PlaylistTrackRepository,
} from '../database/repository';
import { Track } from '../types';
import { audioMetadataService } from '../services/file/AudioMetadataService';
import { artworkManagerService } from '../services/file/ArtworkManagerService';
import {
  fileManagementService,
  BUILTIN_ORGANIZATION_TEMPLATES,
} from '../services/file/FileManagementService';
import { duplicateDetectorService } from '../services/file/DuplicateDetectorService';

describe('Part 18 — Advanced Music File & Metadata Management', () => {
  const sampleTrack: Track = {
    id: 'track-101',
    title: 'Comfortably Numb',
    artist: 'Pink Floyd',
    album: 'The Wall',
    albumArtist: 'Pink Floyd',
    genre: 'Progressive Rock',
    year: 1979,
    trackNumber: 6,
    totalTracks: 12,
    discNumber: 2,
    duration: 382,
    path: '/Music/Rock/Pink Floyd/The Wall/Comfortably Numb.mp3',
    format: 'mp3',
    bitrate: 320,
    sampleRate: 44100,
    channels: 2,
    fileSize: 15280000,
    dateAdded: 1700000000000,
    isFavorite: true,
    rating: 5,
    playCount: 15,
    source: 'local',
    composer: 'David Gilmour, Roger Waters',
    contributingArtists: 'David Gilmour',
    copyright: '© 1979 Pink Floyd Music Ltd.',
    comment: 'Remastered 2011',
  };

  const sampleTrack2: Track = {
    id: 'track-102',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    duration: 425,
    path: '/Music/Rock/Pink Floyd/Dark Side/Time.flac',
    format: 'flac',
    bitrate: 980,
    sampleRate: 96000,
    channels: 2,
    fileSize: 52000000,
    dateAdded: 1700001000000,
    isFavorite: false,
    rating: 4,
    playCount: 8,
    source: 'local',
  };

  beforeEach(async () => {
    (globalThis as any).window = globalThis;
    if (!(globalThis as any).dispatchEvent) {
      (globalThis as any).dispatchEvent = vi.fn();
    }
    if (!(globalThis as any).CustomEvent) {
      (globalThis as any).CustomEvent = class MockCustomEvent {
        constructor(public type: string, public detail?: any) {}
      };
    }
    if (!(globalThis as any).URL.createObjectURL) {
      (globalThis as any).URL.createObjectURL = () => 'blob:mock-audio-url';
    }
    if (!(globalThis as any).URL.revokeObjectURL) {
      (globalThis as any).URL.revokeObjectURL = vi.fn();
    }

    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlist_tracks.clear();
    await db.file_operations.clear();

    await TrackRepository.save(sampleTrack);
    await TrackRepository.save(sampleTrack2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. Audio Metadata Service & Format Capabilities
  // ─────────────────────────────────────────────────────────────
  describe('Audio Metadata Service & Format Capabilities', () => {
    it('returns accurate format capabilities for MP3, FLAC, M4A, OGG, and WAV', () => {
      const mp3Cap = audioMetadataService.getFormatCapability('mp3');
      expect(mp3Cap.canWrite).toBe(true);
      expect(mp3Cap.standard).toBe('ID3v2.3 / ID3v2.4');
      expect(mp3Cap.container).toBe('mp3');

      const flacCap = audioMetadataService.getFormatCapability('flac');
      expect(flacCap.canWrite).toBe(true);
      expect(flacCap.standard).toBe('Vorbis Comment');

      const m4aCap = audioMetadataService.getFormatCapability('m4a');
      expect(m4aCap.canWrite).toBe(true);
      expect(m4aCap.standard).toBe('MP4 Atoms / ilst');

      const wavCap = audioMetadataService.getFormatCapability('wav');
      expect(wavCap.canWrite).toBe(false);
      expect(wavCap.standard).toContain('RIFF INFO');
      expect(wavCap.notes).toContain('Limited embedded metadata support');
    });

    it('builds valid ID3v2.3 binary tag buffers with proper header synchsafe size', () => {
      const tagBuffer = audioMetadataService.buildId3v2Tag({
        title: 'Echoes',
        artist: 'Pink Floyd',
        album: 'Meddle',
        year: 1971,
        trackNumber: 6,
        genre: 'Progressive Rock',
        composer: 'Pink Floyd',
      });

      expect(tagBuffer.byteLength).toBeGreaterThan(10);
      const view = new DataView(tagBuffer);

      // Verify ID3 magic bytes 'ID3' (0x49, 0x44, 0x33)
      expect(view.getUint8(0)).toBe(0x49);
      expect(view.getUint8(1)).toBe(0x44);
      expect(view.getUint8(2)).toBe(0x33);

      // Verify version 2.3.0
      expect(view.getUint8(3)).toBe(3);
      expect(view.getUint8(4)).toBe(0);

      // Check that synchsafe size bits (7-bit) are valid
      const b0 = view.getUint8(6);
      const b1 = view.getUint8(7);
      const b2 = view.getUint8(8);
      const b3 = view.getUint8(9);
      expect(b0 & 0x80).toBe(0);
      expect(b1 & 0x80).toBe(0);
      expect(b2 & 0x80).toBe(0);
      expect(b3 & 0x80).toBe(0);
    });

    it('updates track metadata in repository and logs operation history', async () => {
      const updateResult = await audioMetadataService.updateTrackMetadata(
        sampleTrack.id,
        {
          title: 'Comfortably Numb (Live in Berlin)',
          year: 1990,
          genre: 'Classic Rock',
          contributingArtists: 'Roger Waters, Van Morrison',
          copyright: '© 1990 Mercury Records',
        },
        { writeToFile: false }
      );

      expect(updateResult.success).toBe(true);
      expect(updateResult.track?.title).toBe('Comfortably Numb (Live in Berlin)');
      expect(updateResult.track?.year).toBe(1990);
      expect(updateResult.track?.contributingArtists).toBe('Roger Waters, Van Morrison');

      // Check DB repository
      const fetched = await TrackRepository.getById(sampleTrack.id);
      expect(fetched?.title).toBe('Comfortably Numb (Live in Berlin)');
      expect(fetched?.year).toBe(1990);

      // Check Operation history
      const history = await FileOperationRepository.getHistoryForTrack(sampleTrack.id);
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[0].operation_type).toBe('METADATA_EDIT');
      expect(history[0].status).toBe('success');
    });

    it('batch updates metadata across multiple songs while reporting individual results', async () => {
      const batchRes = await audioMetadataService.batchUpdateMetadata(
        [sampleTrack.id, sampleTrack2.id, 'non-existent-id'],
        { genre: 'Psychedelic Rock' },
        { writeToFile: false }
      );

      expect(batchRes.succeeded).toBe(2);
      expect(batchRes.failed).toBe(1);
      expect(batchRes.results.length).toBe(3);

      const t1 = await TrackRepository.getById(sampleTrack.id);
      const t2 = await TrackRepository.getById(sampleTrack2.id);
      expect(t1?.genre).toBe('Psychedelic Rock');
      expect(t2?.genre).toBe('Psychedelic Rock');
      // Preserved individual fields
      expect(t1?.title).toBe('Comfortably Numb');
      expect(t2?.title).toBe('Time');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 2. Artwork Management Service
  // ─────────────────────────────────────────────────────────────
  describe('Artwork Management Service', () => {
    it('rejects files larger than max size or invalid image types', async () => {
      const oversizedBlob = new Blob([new Uint8Array(25 * 1024 * 1024)], {
        type: 'image/jpeg',
      });
      const invalidTypeBlob = new Blob([new Uint8Array(100)], {
        type: 'audio/mpeg',
      });

      const oversizedRes = await artworkManagerService.validateImage(oversizedBlob as File);
      expect(oversizedRes.valid).toBe(false);
      expect(oversizedRes.error).toContain('maximum allowed size');

      const invalidTypeRes = await artworkManagerService.validateImage(invalidTypeBlob as File);
      expect(invalidTypeRes.valid).toBe(false);
      expect(invalidTypeRes.error).toContain('Supported types');
    });

    it('replaces track artwork and updates repository', async () => {
      const newArtworkDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const res = await artworkManagerService.replaceTrackArtwork(
        sampleTrack.id,
        newArtworkDataUrl,
        { embedInFile: false }
      );

      expect(res.success).toBe(true);
      expect(res.coverArtUrl).toBe(newArtworkDataUrl);

      const updated = await TrackRepository.getById(sampleTrack.id);
      expect(updated?.coverArtUrl).toBe(newArtworkDataUrl);

      // Verify audit trail logged
      const history = await FileOperationRepository.getHistoryForTrack(sampleTrack.id);
      expect(history.some((h) => h.operation_type === 'ARTWORK_UPDATE')).toBe(true);
    });

    it('removes track artwork safely', async () => {
      await artworkManagerService.replaceTrackArtwork(
        sampleTrack.id,
        'data:image/png;base64,mock',
        { embedInFile: false }
      );

      const removeRes = await artworkManagerService.removeTrackArtwork(sampleTrack.id);
      expect(removeRes.success).toBe(true);

      const updated = await TrackRepository.getById(sampleTrack.id);
      expect(updated?.coverArtUrl).toBeUndefined();
    });

    it('propagates artwork across all tracks belonging to an album', async () => {
      // Create a second track with same album
      const albumTrack2: Track = {
        ...sampleTrack,
        id: 'track-103',
        title: 'Hey You',
        trackNumber: 1,
        path: '/Music/Rock/Pink Floyd/The Wall/Hey You.mp3',
        coverArtUrl: undefined,
      };
      await TrackRepository.save(albumTrack2);

      const albumArtUrl = 'data:image/jpeg;base64,mockAlbumArt';
      const result = await artworkManagerService.applyArtworkToAlbum(
        'The Wall',
        albumArtUrl,
        { embedInFile: false }
      );

      expect(result.updatedTracksCount).toBe(2);

      const t1 = await TrackRepository.getById(sampleTrack.id);
      const t3 = await TrackRepository.getById('track-103');
      expect(t1?.coverArtUrl).toBe(albumArtUrl);
      expect(t3?.coverArtUrl).toBe(albumArtUrl);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 3. Safe File Operations & Format Extension Integrity
  // ─────────────────────────────────────────────────────────────
  describe('Safe File Operations & Format Extension Integrity', () => {
    it('sanitizes illegal path segments and protects against directory traversal', () => {
      expect(fileManagementService.sanitizePathSegment('../../../etc/passwd')).toBe(
        'passwd'
      );
      expect(fileManagementService.sanitizePathSegment('Pink: Floyd *? "Song" <>|')).toBe(
        'Pink Floyd Song'
      );
      expect(fileManagementService.sanitizePathSegment('   Spaces   ')).toBe('Spaces');
    });

    it('rejects file renaming that attempts to change audio container format', async () => {
      const res = await fileManagementService.renameFile(
        sampleTrack.id,
        'Comfortably Numb.flac' // Trying to change .mp3 to .flac
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Changing file extension from .mp3 to .flac is not permitted');
    });

    it('successfully renames file while preserving format extension and updating library path', async () => {
      const res = await fileManagementService.renameFile(
        sampleTrack.id,
        '06 - Comfortably Numb' // Omitting extension -> auto appended
      );

      expect(res.success).toBe(true);
      expect(res.newPath).toBe('/Music/Rock/Pink Floyd/The Wall/06 - Comfortably Numb.mp3');

      const updated = await TrackRepository.getById(sampleTrack.id);
      expect(updated?.path).toBe('/Music/Rock/Pink Floyd/The Wall/06 - Comfortably Numb.mp3');
      expect(updated?.filename).toBe('06 - Comfortably Numb.mp3');

      // History logged
      const history = await FileOperationRepository.getHistoryForTrack(sampleTrack.id);
      expect(history.some((h) => h.operation_type === 'RENAME')).toBe(true);
    });

    it('safely moves file to target folder and updates track path', async () => {
      const res = await fileManagementService.moveFile(
        sampleTrack.id,
        '/Music/Pink Floyd/Best Of'
      );

      expect(res.success).toBe(true);
      expect(res.newPath).toBe(
        '/Music/Pink Floyd/Best Of/Comfortably Numb.mp3'
      );

      const updated = await TrackRepository.getById(sampleTrack.id);
      expect(updated?.path).toBe('/Music/Pink Floyd/Best Of/Comfortably Numb.mp3');
    });

    it('safely copies file and preserves original track identity and favorites', async () => {
      const res = await fileManagementService.copyFile(
        sampleTrack.id,
        '/Backup/Rock'
      );

      expect(res.success).toBe(true);
      expect(res.copiedPath).toBe('/Backup/Rock/Comfortably Numb.mp3');

      // Original track remains unchanged and intact
      const orig = await TrackRepository.getById(sampleTrack.id);
      expect(orig?.path).toBe(sampleTrack.path);
      expect(orig?.isFavorite).toBe(true);
      expect(orig?.rating).toBe(5);
    });

    it('distinguishes between Remove from Library and Delete Physical File', async () => {
      // Put track in a playlist
      const pl = await PlaylistRepository.create('My Rock Hits');
      await PlaylistTrackRepository.addTracks(pl.id, [sampleTrack]);

      // 1. Remove from library
      const removeRes = await fileManagementService.removeFromLibrary(sampleTrack.id);
      expect(removeRes.success).toBe(true);

      // Track removed from library repository
      const removed = await TrackRepository.getById(sampleTrack.id);
      expect(removed).toBeUndefined();

      // Playlist membership cleaned up
      const playlistTracks = await PlaylistTrackRepository.getTracksForPlaylist(pl.id);
      expect(playlistTracks.some((t) => t.trackId === sampleTrack.id)).toBe(false);

      // 2. Physical file deletion requires explicit confirmation
      const delWithoutConfirm = await fileManagementService.deletePhysicalFile(
        sampleTrack2.id,
        { confirmDelete: false }
      );
      expect(delWithoutConfirm.success).toBe(false);
      expect(delWithoutConfirm.error).toContain('Explicit confirmation required');

      // Delete with confirmation
      const delRes = await fileManagementService.deletePhysicalFile(
        sampleTrack2.id,
        { confirmDelete: true }
      );
      expect(delRes.success).toBe(true);

      const deleted = await TrackRepository.getById(sampleTrack2.id);
      expect(deleted).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 4. File Organization Engine & Templates
  // ─────────────────────────────────────────────────────────────
  describe('File Organization Engine & Templates', () => {
    it('renders built-in organization templates correctly', () => {
      const template = BUILTIN_ORGANIZATION_TEMPLATES[0]; // {artist}/{album}/{track} - {title}
      const organizedPath = fileManagementService.generateOrganizedPath(
        sampleTrack,
        template.pattern,
        '/Music'
      );

      expect(organizedPath).toBe(
        '/Music/Pink Floyd/The Wall/06 - Comfortably Numb.mp3'
      );
    });

    it('generates organization preview with conflict identification', () => {
      const template = BUILTIN_ORGANIZATION_TEMPLATES[1]; // {artist} - {album}/{track} - {title}
      const preview = fileManagementService.previewOrganization(
        [sampleTrack, sampleTrack2],
        template.pattern,
        '/Storage'
      );

      expect(preview.length).toBe(2);
      expect(preview[0].currentPath).toBe(sampleTrack.path);
      expect(preview[0].proposedPath).toBe(
        '/Storage/Pink Floyd - The Wall/06 - Comfortably Numb.mp3'
      );
      expect(preview[0].hasConflict).toBe(false);

      expect(preview[1].proposedPath).toBe(
        '/Storage/Pink Floyd - The Dark Side of the Moon/Time.flac'
      );
    });

    it('executes organization batch and updates all affected track paths', async () => {
      const template = BUILTIN_ORGANIZATION_TEMPLATES[0];
      const preview = fileManagementService.previewOrganization(
        [sampleTrack],
        template.pattern,
        '/OrganizedMusic'
      );

      const execRes = await fileManagementService.executeOrganization(preview);
      expect(execRes.succeeded).toBe(1);
      expect(execRes.failed).toBe(0);

      const updated = await TrackRepository.getById(sampleTrack.id);
      expect(updated?.path).toBe(
        '/OrganizedMusic/Pink Floyd/The Wall/06 - Comfortably Numb.mp3'
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 5. Intelligent Duplicate Audio Detector
  // ─────────────────────────────────────────────────────────────
  describe('Intelligent Duplicate Audio Detector', () => {
    it('detects exact content hash duplicates and recommends superior version', async () => {
      const duplicateTrack: Track = {
        ...sampleTrack,
        id: 'track-dup-1',
        path: '/Downloads/duplicate_audio.mp3',
        filename: 'duplicate_audio.mp3',
        contentHash: 'hash-abc-123',
        isFavorite: false,
        rating: 1,
      };

      const originalWithHash: Track = {
        ...sampleTrack,
        contentHash: 'hash-abc-123',
      };

      await TrackRepository.save(originalWithHash);
      await TrackRepository.save(duplicateTrack);

      const duplicates = await duplicateDetectorService.findDuplicates();
      expect(duplicates.length).toBeGreaterThanOrEqual(1);

      const hashGroup = duplicates.find((d) => d.reason.includes('Identical content hash'));
      expect(hashGroup).toBeDefined();
      expect(hashGroup?.allTracks.length).toBe(2);
      // It should recommend originalWithHash because it has 5-star rating & favorite
      expect(hashGroup?.recommendedToKeepId).toBe(originalWithHash.id);
    });

    it('detects duplicate songs based on normalized acoustic metadata and duration tolerance', async () => {
      const nearDuplicate: Track = {
        id: 'track-dup-2',
        title: 'comfortably numb ', // extra space, different casing
        artist: 'pink floyd',
        album: 'The Wall (Live)',
        duration: 383, // Within 1 second of 382s
        path: '/Ripped/track06.mp3',
        format: 'mp3',
        bitrate: 192, // Lower bitrate than sampleTrack (320)
        fileSize: 9000000,
        dateAdded: Date.now(),
        playCount: 0,
        isFavorite: false,
        source: 'local',
      };

      await TrackRepository.save(nearDuplicate);

      const duplicates = await duplicateDetectorService.findDuplicates();
      const metaGroup = duplicates.find((d) => d.reason.includes('Matching title, artist and duration'));
      expect(metaGroup).toBeDefined();
      expect(metaGroup?.allTracks.length).toBe(2);

      // Quality scoring should pick 320 kbps sampleTrack over 192 kbps
      expect(metaGroup?.recommendedToKeepId).toBe(sampleTrack.id);
      expect(metaGroup?.recommendationReason).toContain('Higher audio bitrate');
    });

    it('never auto-deletes tracks during detection', async () => {
      const duplicateTrack: Track = {
        ...sampleTrack,
        id: 'track-dup-safety',
        path: '/Other/song.mp3',
        contentHash: 'same-hash',
      };
      await TrackRepository.save({ ...sampleTrack, contentHash: 'same-hash' });
      await TrackRepository.save(duplicateTrack);

      await duplicateDetectorService.findDuplicates();

      // Verify all tracks still exist in DB
      const all = await TrackRepository.getAll();
      expect(all.some((t) => t.id === 'track-dup-safety')).toBe(true);
      expect(all.some((t) => t.id === sampleTrack.id)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 6. File Operation Repository Audit Trail
  // ─────────────────────────────────────────────────────────────
  describe('File Operation Repository Audit Trail', () => {
    it('logs operations with timestamp, parameters, and status', async () => {
      const opId = await FileOperationRepository.logOperation({
        track_id: sampleTrack.id,
        operation_type: 'RENAME',
        source_path: sampleTrack.path,
        destination_path: '/Music/Rock/Pink Floyd/The Wall/06. Comfortably Numb.mp3',
        timestamp: Date.now(),
        status: 'success',
        details: 'User renamed file via context menu',
      });

      expect(opId).toBeGreaterThan(0);

      const history = await FileOperationRepository.getHistory();
      expect(history.length).toBeGreaterThanOrEqual(1);

      const trackHistory = await FileOperationRepository.getHistoryForTrack(sampleTrack.id);
      expect(trackHistory.some((h) => h.id === opId)).toBe(true);
    });
  });
});

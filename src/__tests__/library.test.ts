import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../database/db';
import { TrackRepository, FolderRepository } from '../database/repository';
import { FolderScanner } from '../library/folderScanner';
import { cleanFilenameToTitle, generateTrackIdentity } from '../library/metadataParser';
import { NetworkAccessManager } from '../network/NetworkAccessManager';
import { Track } from '../types';

describe('Part 2 — Local Music Library, Scanner & Metadata', () => {
  beforeEach(async () => {
    await db.tracks.clear();
    await db.folders.clear();
    await db.artwork_cache.clear();
    NetworkAccessManager.setLock(true); // Enforce NETWORK LOCKED
  });

  it('operates completely offline with network locked', () => {
    expect(NetworkAccessManager.getState().isAirGapped).toBe(true);
    expect(NetworkAccessManager.getState().status).toBe('LOCKED');
  });

  it('cleans filenames with leading numbers, dashes, and underscores', () => {
    expect(cleanFilenameToTitle('04 - Midnight Ambient Wave.mp3')).toBe('Midnight Ambient Wave');
    expect(cleanFilenameToTitle('01. Telugu_Melody_Song.m4a')).toBe('Telugu Melody Song');
    expect(cleanFilenameToTitle('10 - 02. Classical Symphony.flac')).toBe('Classical Symphony');
    expect(cleanFilenameToTitle('Hindi_Track_Name.opus')).toBe('Hindi Track Name');
  });

  it('supports international Unicode filenames (Telugu, Hindi, Japanese, etc.)', () => {
    const teluguTitle = cleanFilenameToTitle('01 - ప్రియతమా_పాట.mp3');
    expect(teluguTitle).toContain('ప్రియతమా');

    const hindiTitle = cleanFilenameToTitle('02 - कभी_कभी_मेरे_दिल_में.flac');
    expect(hindiTitle).toContain('कभी कभी मेरे दिल में');

    const japaneseTitle = cleanFilenameToTitle('03 - 夜に駆ける.wav');
    expect(japaneseTitle).toBe('夜に駆ける');
  });

  it('generates stable identity hash for duplicate detection', () => {
    const id1 = generateTrackIdentity('/music/rock/song.mp3', 5000000, 1700000000);
    const id2 = generateTrackIdentity('/music/rock/song.mp3', 5000000, 1700000000);
    const id3 = generateTrackIdentity('/music/pop/song.mp3', 5000000, 1700000000);

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
  });

  it('adds and manages folders in repository', async () => {
    const folder = await FolderRepository.addFolder('/home/user/Music');
    expect(folder).toBeDefined();
    expect(folder.path).toBe('/home/user/Music');
    expect(folder.enabled).toBe(true);

    const all = await FolderRepository.getAll();
    expect(all.length).toBe(1);

    await FolderRepository.removeFolder('/home/user/Music');
    const remaining = await FolderRepository.getAll();
    expect(remaining.length).toBe(0);
  });

  it('scans files incrementally and detects new, updated, and deleted tracks', async () => {
    const folderPath = '/home/user/Music';
    await FolderRepository.addFolder(folderPath);

    // Mock File 1
    const file1 = new File(['audio dummy data 1'], '01 - Midnight Wave.mp3', {
      type: 'audio/mpeg',
      lastModified: 1000,
    });
    // Mock File 2
    const file2 = new File(['audio dummy data 2'], '02 - Telugu Melody.flac', {
      type: 'audio/flac',
      lastModified: 2000,
    });

    // Initial Scan
    const scan1 = await FolderScanner.scanFiles(folderPath, [file1, file2]);
    expect(scan1.added).toBe(2);
    expect(scan1.updated).toBe(0);
    expect(scan1.removed).toBe(0);

    const tracksAfterScan1 = await TrackRepository.getAll();
    expect(tracksAfterScan1.length).toBe(2);

    // Rescan with unchanged files
    const scan2 = await FolderScanner.scanFiles(folderPath, [file1, file2]);
    expect(scan2.added).toBe(0);
    expect(scan2.updated).toBe(0);

    // Rescan with file1 deleted, file3 added
    const file3 = new File(['audio dummy data 3'], '03 - Hindi Song.opus', {
      type: 'audio/ogg',
      lastModified: 3000,
    });
    const scan3 = await FolderScanner.scanFiles(folderPath, [file2, file3]);
    expect(scan3.added).toBe(1);
    expect(scan3.removed).toBe(1); // file1 was detected as removed

    const tracksAfterScan3 = await TrackRepository.getAll();
    expect(tracksAfterScan3.length).toBe(2);
    expect(tracksAfterScan3.some((t) => t.filename === '01 - Midnight Wave.mp3')).toBe(false);
    expect(tracksAfterScan3.some((t) => t.filename === '03 - Hindi Song.opus')).toBe(true);
  });

  it('searches tracks and derives albums and artists from database', async () => {
    const t1: Track = {
      id: 't1',
      title: 'Neon Nights',
      artist: 'CyberSound',
      album: 'Future Horizon',
      genre: 'Electronic',
      duration: 210,
      path: '/music/t1.mp3',
      format: 'mp3',
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      source: 'local',
      isAvailable: true,
    };

    const t2: Track = {
      id: 't2',
      title: 'Ambient Echoes',
      artist: 'CyberSound',
      album: 'Future Horizon',
      genre: 'Ambient',
      duration: 180,
      path: '/music/t2.mp3',
      format: 'mp3',
      dateAdded: Date.now() + 10,
      playCount: 0,
      isFavorite: true,
      source: 'local',
      isAvailable: true,
    };

    await TrackRepository.saveBatch([t1, t2]);

    // Search tests
    const search1 = await TrackRepository.search('neon');
    expect(search1.length).toBe(1);
    expect(search1[0].title).toBe('Neon Nights');

    const search2 = await TrackRepository.search('cybersound');
    expect(search2.length).toBe(2);

    const search3 = await TrackRepository.search('ambient');
    expect(search3.length).toBe(1);

    // Albums aggregation
    const albums = await TrackRepository.getAlbums();
    expect(albums.length).toBe(1);
    expect(albums[0].title).toBe('Future Horizon');
    expect(albums[0].trackCount).toBe(2);

    // Artists aggregation
    const artists = await TrackRepository.getArtists();
    expect(artists.length).toBe(1);
    expect(artists[0].name).toBe('CyberSound');
    expect(artists[0].trackCount).toBe(2);

    // Genres aggregation
    const genres = await TrackRepository.getGenres();
    expect(genres.length).toBe(2);
  });
});

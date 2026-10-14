import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database/db';
import { playlistFileService } from '../services/playlists/PlaylistFileService';
import { Track } from '../types';

describe('Playlist Import & Export (M3U / M3U8)', () => {
  beforeEach(async () => {
    await db.tracks.clear();
    await db.playlists.clear();
    await db.playlist_tracks.clear();
  });

  it('generates standard extended M3U/M3U8 string with EXTINF metadata', () => {
    const tracks: Track[] = [
      {
        id: 'track_1',
        title: 'Song One',
        artist: 'Artist A',
        duration: 195,
        path: '/storage/music/song1.mp3',
        source: 'local',
        format: 'mp3',
        dateAdded: Date.now(),
        isAvailable: true,
        playCount: 0,
        isFavorite: false,
      },
      {
        id: 'track_2',
        title: 'Song Two',
        artist: 'Artist B',
        duration: 240,
        path: '/storage/music/song2.flac',
        source: 'local',
        format: 'flac',
        dateAdded: Date.now(),
        isAvailable: true,
        playCount: 0,
        isFavorite: false,
      },
    ];

    const m3u = playlistFileService.generateM3U('Chill Vibes', tracks);
    expect(m3u).toContain('#EXTM3U');
    expect(m3u).toContain('#PLAYLIST:Chill Vibes');
    expect(m3u).toContain('#EXTINF:195,Artist A - Song One');
    expect(m3u).toContain('/storage/music/song1.mp3');
    expect(m3u).toContain('#EXTINF:240,Artist B - Song Two');
    expect(m3u).toContain('/storage/music/song2.flac');
  });

  it('parses raw M3U/M3U8 content into structured entries', () => {
    const rawContent = `
#EXTM3U
#EXTINF:180,Daft Punk - One More Time
/storage/music/daft_punk.mp3
#EXTINF:210,Queen - Bohemian Rhapsody
/storage/music/queen.mp3
    `;

    const entries = playlistFileService.parseM3U(rawContent);
    expect(entries.length).toBe(2);

    expect(entries[0].duration).toBe(180);
    expect(entries[0].artist).toBe('Daft Punk');
    expect(entries[0].title).toBe('One More Time');
    expect(entries[0].path).toBe('/storage/music/daft_punk.mp3');

    expect(entries[1].duration).toBe(210);
    expect(entries[1].artist).toBe('Queen');
    expect(entries[1].title).toBe('Bohemian Rhapsody');
  });

  it('resolves parsed entries against existing local IndexedDB tracks and creates playlist', async () => {
    const localTrack: Track = {
      id: 'local_daft',
      title: 'One More Time',
      artist: 'Daft Punk',
      duration: 180,
      path: '/device/storage/daft_punk.mp3',
      source: 'local',
      format: 'mp3',
      dateAdded: Date.now(),
      isAvailable: true,
      playCount: 0,
      isFavorite: false,
    };
    await db.tracks.put(localTrack);

    const m3u = `
#EXTM3U
#EXTINF:180,Daft Punk - One More Time
/storage/music/daft_punk.mp3
#EXTINF:120,Unknown - Missing Track
/storage/music/missing.mp3
    `;

    const result = await playlistFileService.importM3UToPlaylist('Electronic Classics', m3u);
    expect(result.playlistName).toBe('Electronic Classics');
    expect(result.totalEntries).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.unresolvedCount).toBe(1);
    expect(result.matchedTracks[0].id).toBe('local_daft');
    expect(result.unresolvedEntries[0].title).toBe('Missing Track');

    const createdPlaylist = await db.playlists.get(result.playlistId!);
    expect(createdPlaylist).toBeDefined();
    expect(createdPlaylist?.name).toBe('Electronic Classics');
  });
});

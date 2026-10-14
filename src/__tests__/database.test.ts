import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../database/db';
import { OnlineHistoryRepository, TrackRepository } from '../database/repository';
import { Track } from '../types';

describe('Database Architecture & Online History', () => {
  beforeEach(async () => {
    await db.online_history.clear();
    await db.tracks.clear();
  });

  it('initializes tables with proper schemas', () => {
    expect(db.tracks).toBeDefined();
    expect(db.play_history).toBeDefined();
    expect(db.online_history).toBeDefined();
    expect(db.playlists).toBeDefined();
    expect(db.settings_store).toBeDefined();
  });

  it('inserts and retrieves online history records', async () => {
    const url = 'https://example.com/audio/track1.mp3';
    const record = await OnlineHistoryRepository.recordPlay(url, 'Ambient Wave', 'Symmetry');

    expect(record).toBeDefined();
    expect(record.url).toBe(url);
    expect(record.title).toBe('Ambient Wave');
    expect(record.playCount).toBe(1);

    const all = await OnlineHistoryRepository.getAll();
    expect(all.length).toBe(1);
    expect(all[0].url).toBe(url);

    // Repeated play should increment count
    const updated = await OnlineHistoryRepository.recordPlay(url);
    expect(updated.playCount).toBe(2);
  });

  it('persists and updates local tracks and favorites', async () => {
    const track: Track = {
      id: 'test_track_1',
      title: 'Neon Nights',
      artist: 'CyberSound',
      duration: 180,
      path: '/music/neon.mp3',
      format: 'mp3',
      dateAdded: Date.now(),
      playCount: 0,
      isFavorite: false,
      source: 'local',
    };

    await TrackRepository.save(track);
    const retrieved = await TrackRepository.getById('test_track_1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('Neon Nights');

    await TrackRepository.setFavorite('test_track_1', true);
    const favs = await TrackRepository.getFavorites();
    expect(favs.length).toBe(1);
    expect(favs[0].id).toBe('test_track_1');
  });
});

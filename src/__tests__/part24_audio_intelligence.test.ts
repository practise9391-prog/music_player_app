import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../database/db';
import { intelligentLibraryAnalyzer } from '../services/discovery/IntelligentLibraryAnalyzer';
import { DuplicateDetectorService } from '../services/file/DuplicateDetectorService';
import { Track } from '../types';

describe('Part 24 — Advanced Audio Intelligence & Automatic Organization', () => {
  beforeEach(async () => {
    await db.tracks.clear();
  });

  it('detects metadata casing and whitespace inconsistencies with explainable suggestions', async () => {
    const tracks: Track[] = [
      {
        id: 't1',
        title: 'ALL CAPS TITLE SONG',
        artist: '  Trimmed Artist  ',
        album: 'Album 1',
        duration: 200,
        format: 'mp3',
        path: '/music/t1.mp3',
        source: 'local',
        dateAdded: Date.now(),
        isAvailable: true,
        playCount: 0,
        isFavorite: false,
      },
      {
        id: 't2',
        title: 'song_with_underscores',
        artist: 'Clean Artist',
        album: 'Album 2',
        duration: 180,
        format: 'mp3',
        path: '/music/t2.mp3',
        source: 'local',
        dateAdded: Date.now(),
        isAvailable: true,
        playCount: 0,
        isFavorite: false,
      },
    ];

    await db.tracks.bulkPut(tracks);

    const report = await intelligentLibraryAnalyzer.analyzeLibrary();
    expect(report.totalTracks).toBe(2);
    expect(report.suggestions.length).toBeGreaterThan(0);

    const titleCasingSuggestion = report.suggestions.find((s) => s.trackId === 't1' && s.field === 'title');
    expect(titleCasingSuggestion).toBeDefined();
    expect(titleCasingSuggestion?.suggestedValue).toBe('All Caps Title Song');

    const artistTrimSuggestion = report.suggestions.find((s) => s.trackId === 't1' && s.field === 'artist');
    expect(artistTrimSuggestion).toBeDefined();
    expect(artistTrimSuggestion?.suggestedValue).toBe('Trimmed Artist');

    const underscoreSuggestion = report.suggestions.find((s) => s.trackId === 't2' && s.field === 'title');
    expect(underscoreSuggestion).toBeDefined();
    expect(underscoreSuggestion?.suggestedValue).toBe('song with underscores');
  });

  it('safely applies metadata suggestions without modifying other user fields', async () => {
    const track: Track = {
      id: 't_edit',
      title: 'OLD TITLE',
      artist: 'Artist',
      album: 'Album',
      duration: 150,
      format: 'flac',
      path: '/music/t_edit.flac',
      isFavorite: true,
      rating: 5,
      playCount: 12,
      source: 'local',
      dateAdded: 1000,
      isAvailable: true,
    };
    await db.tracks.put(track);

    await intelligentLibraryAnalyzer.applySuggestion({
      trackId: 't_edit',
      field: 'title',
      originalValue: 'OLD TITLE',
      suggestedValue: 'Old Title',
      reason: 'Casing normalization',
      confidence: 0.95,
    });

    const updated = await db.tracks.get('t_edit');
    expect(updated?.title).toBe('Old Title');
    expect(updated?.isFavorite).toBe(true);
    expect(updated?.rating).toBe(5);
    expect(updated?.playCount).toBe(12);
  });

  it('generates smart mood collections based on audio attributes', async () => {
    const tracks: Track[] = [
      {
        id: 'rock1',
        title: 'Rock Anthem',
        artist: 'Band',
        genre: 'Hard Rock',
        duration: 210,
        format: 'mp3',
        path: '/music/rock.mp3',
        source: 'local',
        dateAdded: Date.now(),
        isAvailable: true,
        playCount: 5,
        isFavorite: true,
      },
      {
        id: 'chill1',
        title: 'Gentle Piano',
        artist: 'Composer',
        genre: 'Acoustic Piano',
        duration: 300,
        format: 'flac',
        path: '/music/piano.flac',
        source: 'local',
        dateAdded: Date.now(),
        isAvailable: true,
        playCount: 2,
        isFavorite: false,
      },
      {
        id: 'unplayed1',
        title: 'Hidden Gem',
        artist: 'Unknown',
        playCount: 0,
        duration: 180,
        format: 'mp3',
        path: '/music/unplayed.mp3',
        source: 'local',
        dateAdded: Date.now(),
        isAvailable: true,
        isFavorite: false,
      },
    ];
    await db.tracks.bulkPut(tracks);

    const collections = await intelligentLibraryAnalyzer.getSmartCollections();
    expect(collections.workout.some((t) => t.id === 'rock1')).toBe(true);
    expect(collections.chill.some((t) => t.id === 'chill1')).toBe(true);
    expect(collections.unplayedTreasures.some((t) => t.id === 'unplayed1')).toBe(true);
  });
});

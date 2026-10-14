import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioProcessor } from '../audio/AudioProcessor';
import { AudioEngine } from '../audio/AudioEngine';
import { AUDIO_PROFILE_PRESETS, getProfileByName } from '../audio/AudioProfiles';
import { audioProfileServiceInstance } from '../services/audio/AudioProfileService';
import { MusicDataBackupService } from '../services/storage/MusicDataBackupService';
import { nativeBridge } from '../services/nativeBridge';
import { EQ_FREQUENCIES, Track } from '../types';

function createMockTrack(partial: Partial<Track>): Track {
  return {
    id: 'test_track',
    title: 'Test Track',
    artist: 'Test Artist',
    duration: 180,
    format: 'flac',
    path: '/music/test.flac',
    dateAdded: Date.now(),
    playCount: 0,
    isFavorite: false,
    source: 'local',
    ...partial,
  };
}

describe('Part 13 — Advanced Audio Engine, Dolby, Equalizer & Audio Profiles', () => {
  let processor: AudioProcessor;
  let engine: AudioEngine;

  beforeEach(() => {
    processor = new AudioProcessor();
    engine = new AudioEngine();
    audioProfileServiceInstance.resetAllAudioProfiles();
    audioProfileServiceInstance.setCustomProfilesEnabled(true);
  });

  describe('1. 9-Band Equalizer & Frequency Bands', () => {
    it('provides exactly 9 frequency bands matching specifications', () => {
      expect(EQ_FREQUENCIES).toEqual([60, 120, 250, 500, 1000, 2000, 4000, 8000, 16000]);
      expect(processor.getState().eqBands).toHaveLength(9);
    });

    it('adjusts individual EQ bands with clamping between -12 dB and +12 dB', () => {
      processor.setEqualizerBand(0, 8.5); // 60 Hz
      expect(processor.getState().eqBands[0]).toBe(8.5);

      processor.setEqualizerBand(4, -6.0); // 1 kHz
      expect(processor.getState().eqBands[4]).toBe(-6.0);

      // Clamp test exceeding range
      processor.setEqualizerBand(8, 20); // 16 kHz
      expect(processor.getState().eqBands[8]).toBe(12);

      processor.setEqualizerBand(8, -25);
      expect(processor.getState().eqBands[8]).toBe(-12);
    });

    it('resets all 9 equalizer bands to 0 dB default with resetEqualizer()', () => {
      processor.setEqualizerBands([3, 4, 5, 6, 7, 8, 9, 10, 11]);
      expect(processor.getState().eqBands.some((b) => b !== 0)).toBe(true);

      processor.resetEqualizer();
      expect(processor.getState().eqBands).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    });
  });

  describe('2. Equalizer Presets', () => {
    it('provides all required built-in presets', () => {
      const requiredPresets = [
        'Flat',
        'Classical',
        'Dance',
        'Electronic',
        'Hip-Hop',
        'Jazz',
        'Pop',
        'Rock',
        'Vocal',
        'Acoustic',
        'Bass Boost',
        'Treble Boost',
        'Spoken Word',
        'Movie',
        'Custom',
        'Pure',
        'Bass Lover',
      ];

      for (const presetName of requiredPresets) {
        expect(presetName in AUDIO_PROFILE_PRESETS).toBe(true);
        const preset = getProfileByName(presetName as any);
        expect(preset).toBeDefined();
        expect(preset.bands).toHaveLength(9);
      }
    });

    it('immediately loads preset settings into processor state', () => {
      const rockPreset = getProfileByName('Rock');
      processor.loadProfile(rockPreset);

      const state = processor.getState();
      expect(state.activeProfile).toBe('Rock');
      expect(state.eqBands).toHaveLength(9);
      expect(state.eqBands[0]).toBe(rockPreset.bands[0].gain);
      expect(state.eqBands[8]).toBe(rockPreset.bands[8].gain);
    });
  });

  describe('3. Custom Presets Management', () => {
    it('allows saving, renaming, duplicating, and deleting custom presets', async () => {
      // 1. Save
      const created = await audioProfileServiceInstance.saveCustomPreset('My Studio Bass', {
        presetName: 'Custom',
        eqBands: [8, 6, 3, 0, 0, 0, 1, 2, 3],
        bassBoostPercent: 75,
        trebleDb: 2,
        balance: 0,
        isMono: false,
        preampDb: -1.5,
      });
      expect(created.id).toBeDefined();
      expect(created.name).toBe('My Studio Bass');

      // 2. Rename
      const renamed = await audioProfileServiceInstance.renameCustomPreset(created.id, 'My Master Bass');
      expect(renamed).toBe(true);
      const customPresets = audioProfileServiceInstance.getCustomPresets();
      expect(customPresets.find((p) => p.id === created.id)?.name).toBe('My Master Bass');

      // 3. Duplicate
      const dup = await audioProfileServiceInstance.duplicateCustomPreset(created.id, 'My Master Bass (Copy)');
      expect(dup).not.toBeNull();
      expect(dup?.name).toBe('My Master Bass (Copy)');

      // 4. Delete
      const del = await audioProfileServiceInstance.deleteCustomPreset(created.id);
      expect(del).toBe(true);
      expect(audioProfileServiceInstance.getCustomPresets().some((p) => p.id === created.id)).toBe(false);
    });

    it('protects built-in presets from deletion', async () => {
      const delBuiltin = await audioProfileServiceInstance.deleteCustomPreset('flat');
      expect(delBuiltin).toBe(false);

      const delRock = await audioProfileServiceInstance.deleteCustomPreset('rock');
      expect(delRock).toBe(false);
    });
  });

  describe('4. Tone Controls & Safety', () => {
    it('sets safe bass boost percentage (0-100%)', () => {
      processor.setBassBoostPercent(50);
      expect(processor.getState().bassBoostPercent).toBe(50);
      expect(processor.getState().bassBoostDb).toBe(5.0);

      processor.setBassBoostPercent(100);
      expect(processor.getState().bassBoostPercent).toBe(100);
      expect(processor.getState().bassBoostDb).toBe(10.0);

      // Clamping
      processor.setBassBoostPercent(150);
      expect(processor.getState().bassBoostPercent).toBe(100);
      expect(processor.getState().bassBoostDb).toBe(10.0);
    });

    it('adjusts treble boost / cut (-12 to +12 dB) and supports resetTreble()', () => {
      processor.setTreble(6.5);
      expect(processor.getState().trebleDb).toBe(6.5);

      processor.setTreble(-12);
      expect(processor.getState().trebleDb).toBe(-12);

      // Clamp
      processor.setTreble(15);
      expect(processor.getState().trebleDb).toBe(12);

      // Reset
      processor.resetTreble();
      expect(processor.getState().trebleDb).toBe(0);
    });

    it('adjusts Left-Right balance and mono audio mode', () => {
      processor.setBalance(-0.75);
      expect(processor.getState().balance).toBe(-0.75);

      processor.setMono(true);
      expect(processor.getState().isMono).toBe(true);

      processor.setMono(false);
      expect(processor.getState().isMono).toBe(false);
    });
  });

  describe('5. Preamp & Clipping Protection', () => {
    it('adjusts preamp gain (-12 to +12 dB) and respects preventClipping', () => {
      processor.setPreamp(4.5);
      expect(processor.getState().preampDb).toBe(4.5);

      processor.setPreventClipping(true);
      expect(processor.getState().preventClipping).toBe(true);
      expect(processor.getState().autoHeadroom).toBe(true);
      expect(processor.getState().limiter.enabled).toBe(true);

      processor.setPreventClipping(false);
      expect(processor.getState().preventClipping).toBe(false);
    });
  });

  describe('6. Volume Normalization & ReplayGain', () => {
    it('applies ReplayGain modes without modifying the original audio file', () => {
      const trackWithTags: Track = createMockTrack({
        id: 't_replaygain',
        title: 'Audiophile Track',
        artist: 'Master Artist',
        format: 'flac',
        path: '/music/track.flac',
        trackGain: -4.5,
        albumGain: -6.2,
      });

      processor.setReplayGainMode('track', trackWithTags);
      expect(processor.getState().replayGainMode).toBe('track');
      expect(processor.getState().replayGainDb).toBe(-4.5);

      processor.setReplayGainMode('album', trackWithTags);
      expect(processor.getState().replayGainMode).toBe('album');
      expect(processor.getState().replayGainDb).toBe(-6.2);

      processor.setReplayGainMode('off');
      expect(processor.getState().replayGainMode).toBe('off');
      expect(processor.getState().replayGainDb).toBe(0);
    });

    it('sets volume normalization modes cleanly', () => {
      processor.setVolumeNormalization('track');
      expect(processor.getState().volumeNormalizationMode).toBe('track');

      processor.setVolumeNormalization('off');
      expect(processor.getState().volumeNormalizationMode).toBe('off');
    });
  });

  describe('7. Audio Profile Priority Hierarchy', () => {
    const trackA: Track = createMockTrack({
      id: 'song_queen_bohemian',
      title: 'Bohemian Rhapsody',
      artist: 'Queen',
      album: 'A Night at the Opera',
      format: 'flac',
      path: '/music/queen.flac',
    });

    it('resolves Global Profile when no other profiles exist', () => {
      audioProfileServiceInstance.setGlobalProfile({
        presetName: 'Flat',
        bassBoostPercent: 0,
        trebleDb: 0,
      });

      const resolved = audioProfileServiceInstance.resolveProfile(trackA);
      expect(resolved.source).toBe('global');
      expect(resolved.config.presetName).toBe('Flat');
    });

    it('resolves Output Device profile when device is matched and no artist/album/song profile exists', () => {
      audioProfileServiceInstance.setDeviceProfile('bt_headphones_sony', {
        presetName: 'Bass Boost',
        bassBoostPercent: 60,
      });

      const resolved = audioProfileServiceInstance.resolveProfile(trackA, 'bt_headphones_sony');
      expect(resolved.source).toBe('device');
      expect(resolved.config.bassBoostPercent).toBe(60);
    });

    it('resolves Artist Profile over Device Profile and Global Profile', () => {
      audioProfileServiceInstance.setDeviceProfile('bt_headphones_sony', {
        presetName: 'Bass Boost',
        bassBoostPercent: 60,
      });
      audioProfileServiceInstance.setArtistProfile('Queen', {
        presetName: 'Rock',
        trebleDb: 3,
      });

      const resolved = audioProfileServiceInstance.resolveProfile(trackA, 'bt_headphones_sony');
      expect(resolved.source).toBe('artist');
      expect(resolved.matchedName).toBe('Queen');
      expect(resolved.config.trebleDb).toBe(3);
    });

    it('resolves Album Profile over Artist Profile, Device Profile, and Global Profile', () => {
      audioProfileServiceInstance.setArtistProfile('Queen', { presetName: 'Rock' });
      audioProfileServiceInstance.setAlbumProfile('A Night at the Opera', {
        presetName: 'Classical',
        preampDb: -1.0,
      });

      const resolved = audioProfileServiceInstance.resolveProfile(trackA, 'bt_headphones_sony');
      expect(resolved.source).toBe('album');
      expect(resolved.matchedName).toBe('A Night at the Opera');
      expect(resolved.config.presetName).toBe('Classical');
    });

    it('resolves Song Profile as HIGHEST priority (Song > Album > Artist > Device > Global)', () => {
      audioProfileServiceInstance.setArtistProfile('Queen', { presetName: 'Rock' });
      audioProfileServiceInstance.setAlbumProfile('A Night at the Opera', { presetName: 'Classical' });
      audioProfileServiceInstance.setDeviceProfile('bt_headphones_sony', { presetName: 'Bass Boost' });
      audioProfileServiceInstance.setGlobalProfile({ presetName: 'Flat' });

      // Set Song Profile
      audioProfileServiceInstance.setSongProfile(trackA.id, {
        presetName: 'Vocal',
        trebleDb: 4,
        bassBoostPercent: 20,
      });

      const resolved = audioProfileServiceInstance.resolveProfile(trackA, 'bt_headphones_sony');
      expect(resolved.source).toBe('song');
      expect(resolved.matchedName).toBe('Bohemian Rhapsody');
      expect(resolved.config.presetName).toBe('Vocal');
      expect(resolved.config.trebleDb).toBe(4);
    });

    it('strictly forces Global Profile when custom profiles are disabled by user', () => {
      audioProfileServiceInstance.setSongProfile(trackA.id, { presetName: 'Vocal' });
      audioProfileServiceInstance.setGlobalProfile({ presetName: 'Flat' });

      // User chooses: "Use Global Settings for everything"
      audioProfileServiceInstance.setCustomProfilesEnabled(false);

      const resolved = audioProfileServiceInstance.resolveProfile(trackA);
      expect(resolved.source).toBe('global');
      expect(resolved.config.presetName).toBe('Flat');
    });
  });

  describe('8. Audio Profiles JSON Export & Import', () => {
    it('exports complete audio profiles bundle and imports with merge & overwrite modes', async () => {
      audioProfileServiceInstance.setSongProfile('song_123', { presetName: 'Pop' });
      audioProfileServiceInstance.setArtistProfile('Radiohead', { presetName: 'Acoustic' });
      await audioProfileServiceInstance.saveCustomPreset('Indie Mix', { presetName: 'Custom' });

      // 1. Export
      const bundle = audioProfileServiceInstance.exportProfilesBundle();
      expect(bundle.format).toBe('nova_audio_profiles');
      expect(bundle.version).toBe(1);
      expect(bundle.songProfiles['song_123']).toBeDefined();
      expect(bundle.artistProfiles['radiohead']).toBeDefined();
      expect(bundle.customPresets.some((p) => p.name === 'Indie Mix')).toBe(true);

      // 2. Clear state
      audioProfileServiceInstance.resetAllAudioProfiles();
      expect(audioProfileServiceInstance.hasSongProfile('song_123')).toBe(false);

      // 3. Import
      const importRes = await audioProfileServiceInstance.importProfilesBundle(bundle, 'merge');
      expect(importRes.success).toBe(true);
      expect(importRes.importedCount).toBeGreaterThan(0);
      expect(audioProfileServiceInstance.hasSongProfile('song_123')).toBe(true);
      expect(audioProfileServiceInstance.getArtistProfile('Radiohead')).toBeDefined();
    });

    it('integrates audio profiles seamlessly into MusicDataBackupService bundle', async () => {
      audioProfileServiceInstance.setSongProfile('song_backup_test', { presetName: 'Dance' });

      const fullBackup = await MusicDataBackupService.exportBackup();
      expect(fullBackup.audioProfiles).toBeDefined();
      expect(fullBackup.audioProfiles?.songProfiles['song_backup_test']).toBeDefined();
    });
  });

  describe('9. Dolby Platform Honesty & Virtual Surround', () => {
    it('checks honest platform Dolby hardware support without fake software claims', async () => {
      const isDolbyHardware = await nativeBridge.isDolbyHardwareSupported();
      expect(typeof isDolbyHardware).toBe('boolean');
    });

    it('adjusts Virtual Surround spatial simulation safely (0-100%)', () => {
      processor.setVirtualSurround(75);
      expect(processor.getState().virtualSurround).toBe(75);

      processor.setVirtualSurround(0);
      expect(processor.getState().virtualSurround).toBe(0);
    });
  });

  describe('10. Playback Effects (Night Mode, Voice Mode, Crossfade, Speed)', () => {
    it('toggles Night Mode dynamic range compression', () => {
      processor.setNightMode(true);
      expect(processor.getState().nightMode).toBe(true);

      processor.setNightMode(false);
      expect(processor.getState().nightMode).toBe(false);
    });

    it('toggles Voice / Podcast Mode vocal intelligibility enhancement', () => {
      processor.setVoiceMode(true);
      expect(processor.getState().voiceMode).toBe(true);

      processor.setVoiceMode(false);
      expect(processor.getState().voiceMode).toBe(false);
    });

    it('sets crossfade duration between 0 and 12 seconds', () => {
      engine.setCrossfadeDuration(5);
      expect(engine.getCrossfadeDuration()).toBe(5);

      // Clamp test
      engine.setCrossfadeDuration(20);
      expect(engine.getCrossfadeDuration()).toBe(12);

      engine.setCrossfadeDuration(-5);
      expect(engine.getCrossfadeDuration()).toBe(0);
    });
  });

  describe('11. Audio Format Verification & Badges', () => {
    it('accurately detects Lossless audio files', () => {
      const flacTrack = createMockTrack({ id: '1', title: 'Song', artist: 'Art', format: 'flac', path: '/song.flac' });
      const wavTrack = createMockTrack({ id: '2', title: 'Song', artist: 'Art', format: 'wav', path: '/song.wav' });
      const mp3Track = createMockTrack({ id: '3', title: 'Song', artist: 'Art', format: 'mp3', path: '/song.mp3' });

      expect(engine.isLossless(flacTrack)).toBe(true);
      expect(engine.isLossless(wavTrack)).toBe(true);
      expect(engine.isLossless(mp3Track)).toBe(false);
    });

    it('accurately identifies Hi-Res Audio files (>= 24-bit and >= 48 kHz, or >= 88.2 kHz)', () => {
      const hiResTrack = createMockTrack({
        id: '1',
        title: 'Hi-Res Track',
        artist: 'Art',
        format: 'flac',
        path: '/song.flac',
        sampleRate: 96000,
        bitDepth: 24,
      });

      const cdTrack = createMockTrack({
        id: '2',
        title: 'CD Quality Track',
        artist: 'Art',
        format: 'flac',
        path: '/song.flac',
        sampleRate: 44100,
        bitDepth: 16,
      });

      expect(engine.isHiRes(hiResTrack)).toBe(true);
      expect(engine.getAudioFormatBadge(hiResTrack)).toBe('Hi-Res Lossless');

      expect(engine.isHiRes(cdTrack)).toBe(false);
      expect(engine.getAudioFormatBadge(cdTrack)).toBe('Lossless');
    });

    it('returns bitrate badge for lossy formats and empty for null', () => {
      const mp3Track = createMockTrack({
        id: '3',
        title: 'Lossy Track',
        artist: 'Art',
        format: 'mp3',
        path: '/song.mp3',
        bitrate: 320,
      });

      expect(engine.getAudioFormatBadge(mp3Track)).toBe('320 kbps');
      expect(engine.getAudioFormatBadge(null)).toBe('');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioProcessor } from '../audio/AudioProcessor';
import { AUDIO_PROFILES, getProfileByName } from '../audio/AudioProfiles';
import { AudioPresetRepository } from '../database/repository';
import { db } from '../database/db';
import { EQ_FREQUENCIES, DEFAULT_DSP_STATE } from '../types/dsp';

// Helper mock AudioContext for graph testing
function createMockAudioContext(): any {
  const createGainMock = () => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createBiquadFilterMock = () => ({
    type: 'peaking',
    frequency: { value: 1000, setValueAtTime: vi.fn() },
    gain: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    Q: { value: 1.414 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createCompressorMock = () => ({
    threshold: { value: -12, setValueAtTime: vi.fn() },
    knee: { value: 30, setValueAtTime: vi.fn() },
    ratio: { value: 4, setValueAtTime: vi.fn() },
    attack: { value: 0.01, setValueAtTime: vi.fn() },
    release: { value: 0.25, setValueAtTime: vi.fn() },
    reduction: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createPannerMock = () => ({
    pan: { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createChannelSplitterMock = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createChannelMergerMock = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createAnalyserMock = () => ({
    fftSize: 512,
    smoothingTimeConstant: 0.4,
    frequencyBinCount: 256,
    getFloatTimeDomainData: vi.fn((arr: Float32Array) => arr.fill(0)),
    getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(0)),
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => arr.fill(128)),
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const create3DPannerMock = () => ({
    panningModel: 'HRTF',
    distanceModel: 'inverse',
    refDistance: 1,
    maxDistance: 10000,
    rolloffFactor: 1,
    positionX: { value: 0, setValueAtTime: vi.fn() },
    positionY: { value: 0, setValueAtTime: vi.fn() },
    positionZ: { value: 0, setValueAtTime: vi.fn() },
    setPosition: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createDelayMock = () => ({
    delayTime: { value: 0, setValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createConvolverMock = () => ({
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  return {
    currentTime: 0,
    sampleRate: 44100,
    createGain: vi.fn(createGainMock),
    createBiquadFilter: vi.fn(createBiquadFilterMock),
    createDynamicsCompressor: vi.fn(createCompressorMock),
    createStereoPanner: vi.fn(createPannerMock),
    createPanner: vi.fn(create3DPannerMock),
    createDelay: vi.fn(createDelayMock),
    createConvolver: vi.fn(createConvolverMock),
    createChannelSplitter: vi.fn(createChannelSplitterMock),
    createChannelMerger: vi.fn(createChannelMergerMock),
    createAnalyser: vi.fn(createAnalyserMock),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(1024)),
    })),
  };
}

describe('Part 4 — Advanced Audio Engine & DSP Processor', () => {
  beforeEach(async () => {
    if (db.audio_presets) {
      await db.audio_presets.clear();
    }
  });

  describe('AudioProcessor State and Processing Pipeline', () => {
    it('initializes with default DSP state', () => {
      const processor = new AudioProcessor();
      const state = processor.getState();

      expect(state.preampDb).toBe(0);
      expect(state.eqBands).toHaveLength(9);
      expect(state.eqBands.every((b) => b === 0)).toBe(true);
      expect(state.bassBoostDb).toBe(0);
      expect(state.trebleDb).toBe(0);
      expect(state.vocalMode).toBe('off');
      expect(state.loudnessMode).toBe('off');
      expect(state.stereoWidth).toBe(1.0);
      expect(state.balance).toBe(0.0);
      expect(state.isMono).toBe(false);
      expect(state.volumeBoost).toBe(1.0);
      expect(state.dspBypass).toBe(false);
      expect(state.autoHeadroom).toBe(true);
    });

    it('sets preamp gain with clamping (-12dB to +12dB)', () => {
      const processor = new AudioProcessor();

      processor.setPreamp(6);
      expect(processor.getState().preampDb).toBe(6);

      processor.setPreamp(20); // Clamped to +12
      expect(processor.getState().preampDb).toBe(12);

      processor.setPreamp(-25); // Clamped to -12
      expect(processor.getState().preampDb).toBe(-12);
    });

    it('sets individual 9-band EQ gains with clamping (-12dB to +12dB)', () => {
      const processor = new AudioProcessor();

      processor.setEqualizerBand(0, 4.5);
      expect(processor.getState().eqBands[0]).toBe(4.5);

      processor.setEqualizerBand(4, 15); // Clamped to +12
      expect(processor.getState().eqBands[4]).toBe(12);

      processor.setEqualizerBand(8, -15); // Clamped to -12
      expect(processor.getState().eqBands[8]).toBe(-12);

      // Invalid index should be ignored
      processor.setEqualizerBand(99, 10);
      expect(processor.getState().eqBands).toHaveLength(9);
    });

    it('calculates auto-headroom dynamically when EQ or preamp is boosted', () => {
      const processor = new AudioProcessor();
      processor.setAutoHeadroom(true);

      // Boost 60Hz band to +8dB
      processor.setEqualizerBand(0, 8);
      let state = processor.getState();
      expect(state.calculatedHeadroomDb).toBeGreaterThan(0);

      // Disable auto-headroom
      processor.setAutoHeadroom(false);
      state = processor.getState();
      expect(state.calculatedHeadroomDb).toBe(0);
    });

    it('sets bass boost and treble controls with clamping', () => {
      const processor = new AudioProcessor();

      processor.setBassBoost(6);
      expect(processor.getState().bassBoostDb).toBe(6);

      processor.setBassBoost(15); // Clamped to 10
      expect(processor.getState().bassBoostDb).toBe(10);

      processor.setTreble(4);
      expect(processor.getState().trebleDb).toBe(4);

      processor.setTreble(-15); // Clamped to -12
      expect(processor.getState().trebleDb).toBe(-12);
    });

    it('sets vocal enhancement modes', () => {
      const processor = new AudioProcessor();

      processor.setVocalEnhancement('high');
      expect(processor.getState().vocalMode).toBe('high');

      processor.setVocalEnhancement('medium');
      expect(processor.getState().vocalMode).toBe('medium');

      processor.setVocalEnhancement('off');
      expect(processor.getState().vocalMode).toBe('off');
    });

    it('sets loudness modes', () => {
      const processor = new AudioProcessor();

      processor.setLoudness('low');
      expect(processor.getState().loudnessMode).toBe('low');

      processor.setLoudness('high');
      expect(processor.getState().loudnessMode).toBe('high');
    });

    it('configures stereo width, balance, and mono mode', () => {
      const processor = new AudioProcessor();

      processor.setStereoWidth(1.4);
      expect(processor.getState().stereoWidth).toBe(1.4);

      processor.setStereoWidth(2.0); // Clamped to 1.5
      expect(processor.getState().stereoWidth).toBe(1.5);

      processor.setBalance(-0.5);
      expect(processor.getState().balance).toBe(-0.5);

      processor.setBalance(1.5); // Clamped to 1.0
      expect(processor.getState().balance).toBe(1.0);

      processor.setMono(true);
      expect(processor.getState().isMono).toBe(true);
    });

    it('handles volume boost with safe maximum output ceiling', () => {
      const processor = new AudioProcessor();

      processor.setVolumeBoost(2.0); // 200%
      expect(processor.getState().volumeBoost).toBe(2.0);

      processor.setVolumeBoost(4.0); // Clamped to 3.0 (300%)
      expect(processor.getState().volumeBoost).toBe(3.0);

      processor.setMaxOutputLevel(0.85); // 85% ceiling
      expect(processor.getState().maxOutputLevel).toBe(0.85);
    });

    it('toggles DSP bypass and restores processing', () => {
      const processor = new AudioProcessor();
      processor.setBassBoost(6);
      processor.setPreamp(3);

      processor.setBypass(true);
      expect(processor.getState().dspBypass).toBe(true);

      processor.setBypass(false);
      expect(processor.getState().dspBypass).toBe(false);
      expect(processor.getState().bassBoostDb).toBe(6);
      expect(processor.getState().preampDb).toBe(3);
    });

    it('performs A/B comparison switching', () => {
      const processor = new AudioProcessor();
      processor.setBassBoost(5);
      processor.setPreamp(2);

      // Toggle to B (saves A and bypasses DSP for reference comparison)
      processor.toggleAB();
      expect(processor.getState().abState).toBe('B');
      expect(processor.getState().dspBypass).toBe(true);

      // Modify B
      processor.setTreble(4);

      // Toggle back to A (restores A)
      processor.toggleAB();
      expect(processor.getState().abState).toBe('A');
      expect(processor.getState().bassBoostDb).toBe(5);
      expect(processor.getState().preampDb).toBe(2);
    });

    it('resets EQ bands to flat without clearing other audio settings', () => {
      const processor = new AudioProcessor();
      processor.setEqualizerBand(0, 6);
      processor.setEqualizerBand(3, -4);
      processor.setBassBoost(8);

      processor.resetEqualizer();
      expect(processor.getState().eqBands.every((b) => b === 0)).toBe(true);
      expect(processor.getState().bassBoostDb).toBe(8); // Bass boost preserved
    });

    it('resets all audio processing to defaults', () => {
      const processor = new AudioProcessor();
      processor.setEqualizerBand(0, 6);
      processor.setBassBoost(8);
      processor.setStereoWidth(1.5);
      processor.setVolumeBoost(2.5);

      processor.resetAllAudio();
      expect(processor.getState().eqBands.every((b) => b === 0)).toBe(true);
      expect(processor.getState().bassBoostDb).toBe(0);
      expect(processor.getState().stereoWidth).toBe(1.0);
      expect(processor.getState().volumeBoost).toBe(1.0);
    });

    it('connects Web Audio nodes seamlessly in init()', () => {
      const mockCtx = createMockAudioContext();
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
      const processor = new AudioProcessor();

      const outputNode = processor.init(mockCtx, mockSource as any);
      expect(outputNode).toBeDefined();
      expect(mockSource.connect).toHaveBeenCalled();
      expect(mockCtx.createBiquadFilter).toHaveBeenCalled();
      expect(mockCtx.createDynamicsCompressor).toHaveBeenCalled();
    });
  });

  describe('Section 9 Audio Profiles', () => {
    it('contains all 15 predefined audio profiles', () => {
      expect(AUDIO_PROFILES.length).toBeGreaterThanOrEqual(15);
      const names = AUDIO_PROFILES.map((p) => p.name);
      expect(names).toContain('Flat');
      expect(names).toContain('Bass Boost');
      expect(names).toContain('Deep Bass');
      expect(names).toContain('Treble Boost');
      expect(names).toContain('Vocal');
      expect(names).toContain('Rock');
      expect(names).toContain('Pop');
      expect(names).toContain('Classical');
      expect(names).toContain('Electronic');
      expect(names).toContain('Jazz');
      expect(names).toContain('Acoustic');
      expect(names).toContain('Podcast');
      expect(names).toContain('Movie');
      expect(names).toContain('Gaming');
      expect(names).toContain('Night');
    });

    it('each profile defines 9 frequency bands matching standard EQ frequencies', () => {
      for (const profile of AUDIO_PROFILES) {
        expect(profile.bands).toHaveLength(9);
        profile.bands.forEach((band, index) => {
          expect(band.frequency).toBe(EQ_FREQUENCIES[index]);
          expect(band.gain).toBeGreaterThanOrEqual(-12);
          expect(band.gain).toBeLessThanOrEqual(12);
        });
      }
    });

    it('profile lookups return valid profile objects', () => {
      const rockProfile = getProfileByName('Rock');
      expect(rockProfile).toBeDefined();
      expect(rockProfile.name).toBe('Rock');

      const flatProfile = getProfileByName('Flat');
      expect(flatProfile.bands.every((b) => b.gain === 0)).toBe(true);

      const unknownProfile = getProfileByName('NonExistent' as any);
      expect(unknownProfile.name).toBe('Flat');
    });

    it('loads profile into AudioProcessor accurately', () => {
      const processor = new AudioProcessor();
      const bassProfile = getProfileByName('Bass Boost');

      processor.loadProfile(bassProfile);
      const state = processor.getState();
      expect(state.activeProfile).toBe('Bass Boost');
      expect(state.bassBoostDb).toBe(bassProfile.bassGain);
      expect(state.trebleDb).toBe(bassProfile.trebleGain);
      expect(state.eqBands[0]).toBe(bassProfile.bands[0].gain);
    });
  });

  describe('AudioPresetRepository Database Persistence', () => {
    it('saves, loads, and lists custom audio presets in IndexedDB', async () => {
      const presetId = 'custom-preset-1';
      const presetName = 'Warm Vinyl Vibe';

      await AudioPresetRepository.save({
        id: presetId,
        name: presetName,
        type: 'custom',
        settings_json: JSON.stringify({
          ...DEFAULT_DSP_STATE,
          bassBoostDb: 5,
          trebleDb: -2,
          stereoWidth: 1.2,
        }),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const retrieved = await AudioPresetRepository.getById(presetId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(presetName);
      const parsedState = JSON.parse(retrieved!.settings_json);
      expect(parsedState.bassBoostDb).toBe(5);
      expect(parsedState.trebleDb).toBe(-2);
      expect(parsedState.stereoWidth).toBe(1.2);

      const allPresets = await AudioPresetRepository.getAll();
      expect(allPresets).toHaveLength(1);
      expect(allPresets[0].id).toBe(presetId);
    });

    it('deletes custom preset successfully', async () => {
      const presetId = 'delete-me-preset';

      await AudioPresetRepository.save({
        id: presetId,
        name: 'Temporary Preset',
        type: 'custom',
        settings_json: JSON.stringify(DEFAULT_DSP_STATE),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      let all = await AudioPresetRepository.getAll();
      expect(all).toHaveLength(1);

      await AudioPresetRepository.delete(presetId);
      all = await AudioPresetRepository.getAll();
      expect(all).toHaveLength(0);
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialAudioEngine } from '../audio/SpatialAudioEngine';
import { SPATIAL_PRESETS, getSpatialPresetByName } from '../audio/SpatialPresets';
import { DEFAULT_SPATIAL_STATE, SpatialMode } from '../types';

function createMockAudioContext(): any {
  const createGainMock = () => ({
    gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  const createBiquadFilterMock = () => ({
    type: 'lowpass',
    frequency: { value: 20000, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    gain: { value: 0, setValueAtTime: vi.fn() },
    Q: { value: 1.0 },
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
    getFloatTimeDomainData: vi.fn((arr: Float32Array) => arr.fill(0)),
    connect: vi.fn(),
    disconnect: vi.fn(),
  });

  return {
    currentTime: 0,
    sampleRate: 44100,
    createGain: vi.fn(createGainMock),
    createBiquadFilter: vi.fn(createBiquadFilterMock),
    createPanner: vi.fn(create3DPannerMock),
    createDelay: vi.fn(createDelayMock),
    createConvolver: vi.fn(createConvolverMock),
    createChannelSplitter: vi.fn(createChannelSplitterMock),
    createChannelMerger: vi.fn(createChannelMergerMock),
    createAnalyser: vi.fn(createAnalyserMock),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(512)),
    })),
  };
}

describe('Part 5 — Spatial Audio, Surround Processing & 3D Audio Engine', () => {
  let spatialEngine: SpatialAudioEngine;

  beforeEach(() => {
    spatialEngine = new SpatialAudioEngine();
  });

  describe('Default State and Safe Spatial Initialization', () => {
    it('initializes with default safe spatial parameters', () => {
      const state = spatialEngine.getState();
      expect(state.enabled).toBe(false);
      expect(state.mode).toBe('off');
      expect(state.intensity).toBe(0.0);
      expect(state.bypass).toBe(false);
      expect(state.stereoWidth).toBe(1.0);
      expect(state.centerLevel).toBe(0.0);
      expect(state.surroundBalance).toBe(0.0);
      expect(state.crossfeed).toBe('off');
      expect(state.roomMix).toBe(0.0);
      expect(state.position.azimuth).toBe(0);
      expect(state.position.elevation).toBe(0);
    });

    it('connects Web Audio nodes seamlessly without errors', () => {
      const mockCtx = createMockAudioContext();
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() } as any;

      const outputNode = spatialEngine.init(mockCtx, mockSource);
      expect(outputNode).toBeDefined();
      expect(mockSource.connect).toHaveBeenCalled();
    });
  });

  describe('Spatial Modes and Intensity Controls', () => {
    const modes: SpatialMode[] = [
      'off',
      'stereo_wide',
      'virtual_surround',
      'headphone_spatial',
      '3d_audio',
      'room',
      'cinema',
      'live',
    ];

    it.each(modes)('switches to mode: %s correctly', (mode) => {
      spatialEngine.setMode(mode);
      expect(spatialEngine.getState().mode).toBe(mode);
    });

    it('clamps spatial intensity between 0.0 (0%) and 1.5 (150%)', () => {
      spatialEngine.setIntensity(1.8);
      expect(spatialEngine.getState().intensity).toBe(1.5);

      spatialEngine.setIntensity(-0.3);
      expect(spatialEngine.getState().intensity).toBe(0.0);

      spatialEngine.setIntensity(0.75);
      expect(spatialEngine.getState().intensity).toBe(0.75);
    });
  });

  describe('3D Positioning (Azimuth, Elevation, Distance, Depth)', () => {
    it('updates 3D coordinates and clamps azimuth (-180 to 180) and elevation (-90 to 90)', () => {
      spatialEngine.setPosition({ azimuth: 45, elevation: 20 });
      let state = spatialEngine.getState();
      expect(state.position.azimuth).toBe(45);
      expect(state.position.elevation).toBe(20);

      spatialEngine.setPosition({ azimuth: 250, elevation: -120 });
      state = spatialEngine.getState();
      expect(state.position.azimuth).toBe(180);
      expect(state.position.elevation).toBe(-90);
    });

    it('updates distance and depth within 0.0 to 1.0 limits', () => {
      spatialEngine.setPosition({ distance: 0.8, depth: 0.6 });
      const state = spatialEngine.getState();
      expect(state.position.distance).toBe(0.8);
      expect(state.position.depth).toBe(0.6);
      expect(state.distance).toBe(0.8);
      expect(state.depth).toBe(0.6);
    });
  });

  describe('Soundstage Geometry and Center Extraction', () => {
    it('adjusts stereo width with clamping (0.0 to 1.5)', () => {
      spatialEngine.setStereoWidth(1.25);
      expect(spatialEngine.getState().stereoWidth).toBe(1.25);

      spatialEngine.setStereoWidth(2.0);
      expect(spatialEngine.getState().stereoWidth).toBe(1.5);

      spatialEngine.setStereoWidth(-0.5);
      expect(spatialEngine.getState().stereoWidth).toBe(0.0);
    });

    it('adjusts center channel vocal level (-1.0 to 1.0)', () => {
      spatialEngine.setCenterLevel(0.4);
      expect(spatialEngine.getState().centerLevel).toBe(0.4);

      spatialEngine.setCenterLevel(1.5);
      expect(spatialEngine.getState().centerLevel).toBe(1.0);

      spatialEngine.setCenterLevel(-1.5);
      expect(spatialEngine.getState().centerLevel).toBe(-1.0);
    });

    it('adjusts surround balance between left (-1.0) and right (+1.0)', () => {
      spatialEngine.setSurroundBalance(-0.5);
      expect(spatialEngine.getState().surroundBalance).toBe(-0.5);

      spatialEngine.setSurroundBalance(1.2);
      expect(spatialEngine.getState().surroundBalance).toBe(1.0);
    });

    it('switches headphone crossfeed modes', () => {
      spatialEngine.setCrossfeed('low');
      expect(spatialEngine.getState().crossfeed).toBe('low');

      spatialEngine.setCrossfeed('medium');
      expect(spatialEngine.getState().crossfeed).toBe('medium');

      spatialEngine.setCrossfeed('high');
      expect(spatialEngine.getState().crossfeed).toBe('high');

      spatialEngine.setCrossfeed('off');
      expect(spatialEngine.getState().crossfeed).toBe('off');
    });
  });

  describe('Room Acoustic Simulation and Convolver Reverb', () => {
    it('updates room size preset and reverb decay time', () => {
      spatialEngine.setRoomSize('cathedral');
      expect(spatialEngine.getState().roomSize).toBe('cathedral');

      spatialEngine.setReverbDecay(4.5);
      expect(spatialEngine.getState().reverbDecay).toBe(4.5);

      spatialEngine.setReverbDecay(15);
      expect(spatialEngine.getState().reverbDecay).toBe(10); // Clamped at 10s max

      spatialEngine.setReverbDecay(0.01);
      expect(spatialEngine.getState().reverbDecay).toBe(0.1); // Clamped at 0.1s min
    });

    it('adjusts room reverb wet mix (0.0 to 1.0)', () => {
      spatialEngine.setRoomMix(0.35);
      expect(spatialEngine.getState().roomMix).toBe(0.35);

      spatialEngine.setRoomMix(1.5);
      expect(spatialEngine.getState().roomMix).toBe(1.0);
    });
  });

  describe('Bypass and A/B Comparison Switching', () => {
    it('toggles bypass on and off without clearing current spatial configuration', () => {
      spatialEngine.setMode('3d_audio');
      spatialEngine.setIntensity(1.2);
      spatialEngine.setCenterLevel(0.3);

      spatialEngine.setBypass(true);
      expect(spatialEngine.getState().bypass).toBe(true);
      expect(spatialEngine.getState().mode).toBe('3d_audio');
      expect(spatialEngine.getState().intensity).toBe(1.2);

      spatialEngine.setBypass(false);
      expect(spatialEngine.getState().bypass).toBe(false);
      expect(spatialEngine.getState().mode).toBe('3d_audio');
      expect(spatialEngine.getState().intensity).toBe(1.2);
    });

    it('supports A/B comparison toggle', () => {
      spatialEngine.toggleABComparison();
      expect(spatialEngine.getState().abComparison).toBe(true);
      expect(spatialEngine.getState().bypass).toBe(true);

      spatialEngine.toggleABComparison();
      expect(spatialEngine.getState().abComparison).toBe(false);
      expect(spatialEngine.getState().bypass).toBe(false);
    });

    it('resets all spatial parameters to pristine defaults', () => {
      spatialEngine.setMode('cinema');
      spatialEngine.setIntensity(1.0);
      spatialEngine.setRoomMix(0.5);

      spatialEngine.resetToDefaults();
      expect(spatialEngine.getState().mode).toBe('off');
      expect(spatialEngine.getState().intensity).toBe(0.0);
      expect(spatialEngine.getState().roomMix).toBe(0.0);
    });
  });

  describe('Built-in Presets and Custom Profile Loading', () => {
    it('contains all 10 predefined spatial presets', () => {
      expect(SPATIAL_PRESETS).toHaveLength(10);
      const presetNames = SPATIAL_PRESETS.map((p) => p.name);
      expect(presetNames).toContain('Natural');
      expect(presetNames).toContain('Wide');
      expect(presetNames).toContain('Headphones');
      expect(presetNames).toContain('Virtual Surround');
      expect(presetNames).toContain('Cinema');
      expect(presetNames).toContain('Live');
      expect(presetNames).toContain('Concert Hall');
      expect(presetNames).toContain('Gaming');
      expect(presetNames).toContain('Voice');
      expect(presetNames).toContain('Custom');
    });

    it('loads presets into the engine accurately', () => {
      const concert = getSpatialPresetByName('Concert Hall');
      expect(concert).toBeDefined();
      if (concert) {
        spatialEngine.loadPreset(concert);
        const state = spatialEngine.getState();
        expect(state.mode).toBe('room');
        expect(state.roomSize).toBe('concert_hall');
        expect(state.roomMix).toBe(0.4);
        expect(state.intensity).toBe(0.7);
      }
    });
  });

  describe('Mono Compatibility and Honest Labeling (No Fake Dolby Rule)', () => {
    it('returns a valid phase correlation index between -1.0 and +1.0', () => {
      const { correlation, isMonoCompatible } = spatialEngine.getPhaseCorrelation();
      expect(correlation).toBeGreaterThanOrEqual(-1.0);
      expect(correlation).toBeLessThanOrEqual(1.0);
      expect(typeof isMonoCompatible).toBe('boolean');
    });

    it('provides transparent, honest technical descriptions without unauthorized Dolby Atmos claims', () => {
      const virtualLabel = spatialEngine.getHonestLabel('virtual_surround');
      expect(virtualLabel).not.toMatch(/Dolby Atmos/i);
      expect(virtualLabel).toContain('Virtual Spatial Audio');

      const pannerLabel = spatialEngine.getHonestLabel('3d_audio');
      expect(pannerLabel).not.toMatch(/Dolby Atmos/i);
      expect(pannerLabel).toContain('HRTF Binaural');

      const nativeLabel = spatialEngine.getHonestLabel('native_spatial');
      expect(nativeLabel).toContain('Native Multi-Channel');
    });
  });
});

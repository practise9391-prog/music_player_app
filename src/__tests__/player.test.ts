import { describe, it, expect, beforeEach } from 'vitest';
import { AudioEngine } from '../audio/AudioEngine';
import { SpatialAudioEngine } from '../audio/SpatialAudioEngine';

describe('Audio Engine & Safe Pipeline Transitions', () => {
  let engine: AudioEngine;

  beforeEach(() => {
    engine = new AudioEngine();
  });

  it('initializes with default safe parameters', () => {
    const state = engine.getState();
    expect(state.status).toBe('idle');
    expect(state.volume).toBe(0.8);
    expect(state.boostLevel).toBe(1.0);
    expect(state.repeatMode).toBe('off');
    expect(state.activeProfile).toBe('Flat');
    expect(state.spatialMode).toBe('off');
  });

  it('clamps volume safely between 0.0 and 1.0', () => {
    engine.setVolume(1.5);
    expect(engine.getState().volume).toBe(1.0);

    engine.setVolume(-0.5);
    expect(engine.getState().volume).toBe(0.0);

    engine.setVolume(0.65);
    expect(engine.getState().volume).toBe(0.65);
  });

  it('clamps volume boost safely between 1.0 (100%) and 3.0 (300%) with limiter active', () => {
    engine.setVolumeBoost(0.5); // below min
    expect(engine.getState().boostLevel).toBe(1.0);

    engine.setVolumeBoost(4.5); // above max
    expect(engine.getState().boostLevel).toBe(3.0);

    engine.setVolumeBoost(2.0); // 200%
    expect(engine.getState().boostLevel).toBe(2.0);
    expect(engine.getState().isClippingLimiterActive).toBe(true);
  });

  it('toggles repeat modes and shuffle state', () => {
    engine.setRepeatMode('all');
    expect(engine.getState().repeatMode).toBe('all');

    engine.setRepeatMode('one');
    expect(engine.getState().repeatMode).toBe('one');

    engine.setShuffle(true);
    expect(engine.getState().isShuffle).toBe(true);
  });

  it('provides honest virtual labeling in SpatialAudioEngine', () => {
    const spatial = new SpatialAudioEngine();
    expect(spatial.getHonestLabel('stereo')).toContain('Standard 2.0 Stereo');
    expect(spatial.getHonestLabel('virtual_surround')).toContain('Virtual Spatial Audio');
    expect(spatial.getHonestLabel('native_spatial')).toContain('Native');
  });
});

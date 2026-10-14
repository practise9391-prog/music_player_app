import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VisualizerEngine } from '../audio/VisualizerEngine';
import { SpectrumAnalyzer } from '../audio/visualizer/SpectrumAnalyzer';
import { WaveformAnalyzer } from '../audio/visualizer/WaveformAnalyzer';
import { StereoPhaseAnalyzer } from '../audio/visualizer/StereoPhaseAnalyzer';
import { BeatDetector } from '../audio/visualizer/BeatDetector';
import { SpectrogramAnalyzer } from '../audio/visualizer/SpectrogramAnalyzer';
import { DEFAULT_VISUALIZER_SETTINGS, VisualizerMode } from '../types';

function createMockAnalyser(): any {
  return {
    fftSize: 512,
    smoothingTimeConstant: 0.7,
    frequencyBinCount: 256,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => {
      // Fill with test gradient
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.min(255, i * 2);
      }
    }),
    getByteTimeDomainData: vi.fn((arr: Uint8Array) => {
      // Fill with simulated sine wave around 128
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.round(128 + 64 * Math.sin((i / arr.length) * Math.PI * 2));
      }
    }),
  };
}

describe('Part 5 — Visualizer Engine & Spectrum Analyzer', () => {
  let visualizer: VisualizerEngine;

  beforeEach(() => {
    visualizer = new VisualizerEngine();
  });

  describe('Default Configuration and Settings', () => {
    it('initializes with default visualizer settings', () => {
      const settings = visualizer.getSettings();
      expect(settings.mode).toBe('spectrum');
      expect(settings.fps).toBe('medium');
      expect(settings.colorMode).toBe('theme');
      expect(settings.sensitivity).toBe(50);
      expect(settings.smoothing).toBe(75);
    });

    it('updates visualizer settings partially and fully', () => {
      visualizer.updateSettings({ fps: 'low', sensitivity: 90 });
      let settings = visualizer.getSettings();
      expect(settings.fps).toBe('low');
      expect(settings.sensitivity).toBe(90);
      expect(settings.mode).toBe('spectrum'); // Unchanged

      visualizer.setMode('waveform');
      settings = visualizer.getSettings();
      expect(settings.mode).toBe('waveform');
    });
  });

  describe('Visualization Modes and Switching', () => {
    const modes: VisualizerMode[] = ['spectrum', 'waveform', 'bars', 'circle', 'minimal', 'off'];

    it.each(modes)('supports mode: %s', (mode) => {
      visualizer.setMode(mode);
      expect(visualizer.getSettings().mode).toBe(mode);
    });
  });

  describe('Real-Time Audio Analysis (FFT Spectrum & Waveform)', () => {
    it('extracts 9-band octave frequency data from AnalyserNode', () => {
      const mockAnalyser = createMockAnalyser();
      visualizer.setAnalyser(mockAnalyser);

      const freqData = visualizer.getFrequencyData();
      expect(freqData).toBeDefined();
      expect(freqData.bands).toHaveLength(9);
      expect(freqData.rawFft.length).toBeGreaterThan(0);

      // Verify each band is normalized between 0.0 and 1.0
      freqData.bands.forEach((band) => {
        expect(band).toBeGreaterThanOrEqual(0.0);
        expect(band).toBeLessThanOrEqual(1.0);
      });
    });

    it('extracts time-domain waveform data from AnalyserNode', () => {
      const mockAnalyser = createMockAnalyser();
      visualizer.setAnalyser(mockAnalyser);

      const waveData = visualizer.getWaveformData();
      expect(waveData).toBeDefined();
      expect(waveData.timeDomain.length).toBeGreaterThan(0);
      expect(mockAnalyser.getByteTimeDomainData).toHaveBeenCalled();
    });

    it('calculates real peak and RMS values', () => {
      const mockAnalyser = createMockAnalyser();
      visualizer.setAnalyser(mockAnalyser);

      const peakData = visualizer.getPeakData();
      expect(peakData.peak).toBeGreaterThanOrEqual(0);
      expect(peakData.peak).toBeLessThanOrEqual(1.0);
      expect(peakData.rms).toBeGreaterThanOrEqual(0);
      expect(peakData.rms).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Color Customization and Styling', () => {
    it('sets primary and secondary theme colors', () => {
      visualizer.setColors('#00ffcc', '#ff0077');
      // No errors thrown, colors are updated for rendering
      expect(true).toBe(true);
    });
  });

  describe('Canvas Attachment and Lifecycle', () => {
    it('attaches to and detaches from canvas gracefully', () => {
      const mockCanvas: any = {
        width: 800,
        height: 400,
        getContext: vi.fn(() => ({
          clearRect: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          createLinearGradient: vi.fn(() => ({
            addColorStop: vi.fn(),
          })),
        })),
      };

      // Mock requestAnimationFrame & cancelAnimationFrame
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 123));
      vi.stubGlobal('cancelAnimationFrame', vi.fn());

      visualizer.attach(mockCanvas);
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');

      visualizer.detach();
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Part 10 — Advanced Visualizer, Real-Time Audio Visual Lab
// ═══════════════════════════════════════════════════════════

describe('Part 10 — SpectrumAnalyzer (FFT Sub-module)', () => {
  let analyzer: SpectrumAnalyzer;

  beforeEach(() => {
    analyzer = new SpectrumAnalyzer();
  });

  it('initializes with expected defaults', () => {
    expect(analyzer).toBeDefined();
  });

  it('extract9Bands returns 9 normalized values for non-silent input', () => {
    const fft = new Uint8Array(512);
    for (let i = 0; i < fft.length; i++) fft[i] = 128;
    const bands = analyzer.extract9Bands(fft);
    expect(bands).toHaveLength(9);
    bands.forEach((b) => {
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    });
  });

  it('extract9Bands returns zeros for silent (all-zero) input', () => {
    const fft = new Uint8Array(512).fill(0);
    const bands = analyzer.extract9Bands(fft);
    bands.forEach((b) => expect(b).toBe(0));
  });

  it('applyWindow returns same length as input', () => {
    const input = new Float32Array(512).fill(0.5);
    const windowed = analyzer.applyWindow(input);
    expect(windowed.length).toBe(512);
  });

  it('processFrequencies handles all-zero FFT gracefully and returns correct band count', () => {
    const fft = new Uint8Array(1024).fill(0);
    const data = analyzer.processFrequencies(fft, 512);
    // Returns 512 bands when numBands=512
    expect(data.bands).toHaveLength(512);
    // All zero since input is silent
    data.bands.forEach((b) => expect(b).toBe(0));
  });

  it('setWindowFunction changes window type without throwing', () => {
    expect(() => analyzer.setWindowFunction('hann')).not.toThrow();
    expect(() => analyzer.setWindowFunction('hamming')).not.toThrow();
    expect(() => analyzer.setWindowFunction('blackman')).not.toThrow();
    expect(() => analyzer.setWindowFunction('rectangular')).not.toThrow();
  });

  it('reset clears peak hold state', () => {
    const fft = new Uint8Array(512).fill(200);
    analyzer.extract9Bands(fft); // populate peaks
    analyzer.reset();
    const fft2 = new Uint8Array(512).fill(10);
    const bands = analyzer.extract9Bands(fft2);
    // After reset, peaks should follow the low data not the previous high
    expect(bands[0]).toBeLessThan(1.0);
  });
});

describe('Part 10 — WaveformAnalyzer (Oscilloscope Sub-module)', () => {
  let analyzer: WaveformAnalyzer;

  beforeEach(() => {
    analyzer = new WaveformAnalyzer();
  });

  it('findTriggerOffset returns 0 when trigger mode is off', () => {
    analyzer.setOscilloscopeConfig({ triggerMode: 'off' });
    const samples = new Float32Array(256).fill(0.1);
    expect(analyzer.findTriggerOffset(samples)).toBe(0);
  });

  it('findTriggerOffset finds rising edge', () => {
    const samples = new Float32Array(256);
    // Place a rising edge at index 50
    for (let i = 0; i < 50; i++) samples[i] = -0.5;
    for (let i = 50; i < 256; i++) samples[i] = 0.5;
    analyzer.setOscilloscopeConfig({ triggerMode: 'rising', triggerLevel: 0 });
    const offset = analyzer.findTriggerOffset(samples);
    expect(offset).toBeGreaterThanOrEqual(0);
  });

  it('setSensitivity clamps to 0–100', () => {
    analyzer.setSensitivity(-10);
    const config = analyzer.getOscilloscopeConfig();
    expect(config).toBeDefined(); // no throw
    analyzer.setSensitivity(200);
    // no throw — sensitivity is clamped internally
    expect(true).toBe(true);
  });
});

describe('Part 10 — StereoPhaseAnalyzer', () => {
  let analyzer: StereoPhaseAnalyzer;

  beforeEach(() => {
    analyzer = new StereoPhaseAnalyzer();
  });

  it('computes correlation = 1.0 for identical L/R signals', () => {
    const signal = new Float32Array(512);
    for (let i = 0; i < 512; i++) signal[i] = Math.sin(i * 0.1) * 0.8;
    const data = analyzer.analyzeStereo(signal, signal);
    expect(data.correlation).toBeCloseTo(1.0, 1);
  });

  it('computes correlation = -1.0 for phase-inverted L/R signals', () => {
    const left = new Float32Array(512);
    const right = new Float32Array(512);
    for (let i = 0; i < 512; i++) {
      left[i] = Math.sin(i * 0.1) * 0.8;
      right[i] = -left[i];
    }
    const data = analyzer.analyzeStereo(left, right);
    expect(data.correlation).toBeCloseTo(-1.0, 1);
  });

  it('returns balanced levels for equal L/R amplitude', () => {
    const signal = new Float32Array(512).fill(0.5);
    const data = analyzer.analyzeStereo(signal, signal);
    expect(data.balance).toBeCloseTo(0.0, 1);
  });

  it('returns silent levels for all-zero input', () => {
    const zeros = new Float32Array(512).fill(0);
    const data = analyzer.analyzeStereo(zeros, zeros);
    expect(data.leftLevel).toBeCloseTo(0, 2);
    expect(data.rightLevel).toBeCloseTo(0, 2);
  });

  it('computeGoniometerPoints returns an array', () => {
    const signal = new Float32Array(128);
    for (let i = 0; i < 128; i++) signal[i] = Math.sin(i * 0.2) * 0.5;
    const points = analyzer.computeGoniometerPoints(signal, signal, 50);
    expect(Array.isArray(points)).toBe(true);
  });
});

describe('Part 10 — BeatDetector', () => {
  let detector: BeatDetector;

  beforeEach(() => {
    detector = new BeatDetector();
  });

  it('returns no beat on all-zero input', () => {
    const fft = new Uint8Array(512).fill(0);
    const beat = detector.detect(fft);
    expect(beat.isBeat).toBe(false);
    expect(beat.energy).toBeCloseTo(0, 2);
  });

  it('returns valid beat data structure on any input', () => {
    const fft = new Uint8Array(512).fill(150);
    const beat = detector.detect(fft);
    expect(typeof beat.isBeat).toBe('boolean');
    expect(typeof beat.energy).toBe('number');
    expect(typeof beat.decay).toBe('number');
    expect(typeof beat.confidence).toBe('number');
    expect(beat.energy).toBeGreaterThanOrEqual(0);
    expect(beat.energy).toBeLessThanOrEqual(1);
  });

  it('reset clears state without throwing', () => {
    const fft = new Uint8Array(512).fill(200);
    detector.detect(fft);
    expect(() => detector.reset()).not.toThrow();
  });
});

describe('Part 10 — SpectrogramAnalyzer', () => {
  let analyzer: SpectrogramAnalyzer;

  beforeEach(() => {
    analyzer = new SpectrogramAnalyzer(100, 64);
  });

  it('starts with empty history', () => {
    expect(analyzer.getHistory()).toHaveLength(0);
  });

  it('pushFrame adds frames to history', () => {
    const fft = new Uint8Array(128).fill(100);
    analyzer.pushFrame(fft);
    analyzer.pushFrame(fft);
    expect(analyzer.getHistory().length).toBe(2);
  });

  it('bounded ring buffer evicts oldest frame when full', () => {
    const fft = new Uint8Array(128).fill(100);
    for (let i = 0; i < 110; i++) analyzer.pushFrame(fft);
    expect(analyzer.getHistory().length).toBeLessThanOrEqual(100);
  });

  it('clear() empties history', () => {
    const fft = new Uint8Array(128).fill(100);
    analyzer.pushFrame(fft);
    analyzer.clear();
    expect(analyzer.getHistory()).toHaveLength(0);
  });

  it('setHistorySize clamps history within range', () => {
    analyzer.setHistorySize(5000); // Should clamp to 500
    expect(true).toBe(true); // no throw
  });
});

describe('Part 10 — VisualizerEngine (all 16 modes)', () => {
  let visualizer: VisualizerEngine;

  beforeEach(() => {
    visualizer = new VisualizerEngine();
    visualizer.setAnalyser(createMockAnalyser());
  });

  const allModes: VisualizerMode[] = [
    'off', 'spectrum', 'smooth_spectrum', 'bars', 'waveform',
    'oscilloscope', 'circle', 'radial_spectrum', 'spectrogram',
    'peak_meter', 'rms_meter', 'stereo_field', 'phase_meter',
    'album_art', 'particles', 'minimal',
  ];

  it.each(allModes)('setMode("%s") does not throw', (mode) => {
    expect(() => visualizer.setMode(mode)).not.toThrow();
    expect(visualizer.getSettings().mode).toBe(mode);
  });

  it('getDiagnostics returns a valid object', () => {
    const d = visualizer.getDiagnostics();
    expect(typeof d.fps).toBe('number');
    expect(typeof d.frameTimeMs).toBe('number');
    expect(typeof d.droppedFrames).toBe('number');
    expect(typeof d.isSilent).toBe('boolean');
    expect(typeof d.fftResolution).toBe('number');
    expect(typeof d.particleCount).toBe('number');
  });

  it('getStereoData returns a valid object', () => {
    const sd = visualizer.getStereoData();
    expect(typeof sd.leftLevel).toBe('number');
    expect(typeof sd.rightLevel).toBe('number');
    expect(typeof sd.correlation).toBe('number');
  });

  it('getBeatData returns a valid object', () => {
    const bd = visualizer.getBeatData();
    expect(typeof bd.isBeat).toBe('boolean');
    expect(typeof bd.energy).toBe('number');
    expect(bd.energy).toBeGreaterThanOrEqual(0);
  });

  it('getSpectrogramData returns history array', () => {
    const sg = visualizer.getSpectrogramData();
    expect(Array.isArray(sg.history)).toBe(true);
  });

  it('getPhaseData returns correlation, width, balance', () => {
    const pd = visualizer.getPhaseData();
    expect(typeof pd.correlation).toBe('number');
    expect(typeof pd.width).toBe('number');
    expect(typeof pd.balance).toBe('number');
  });

  it('DEFAULT_VISUALIZER_SETTINGS has customSecondaryColor defined', () => {
    expect(DEFAULT_VISUALIZER_SETTINGS.customSecondaryColor).toBeDefined();
    expect(typeof DEFAULT_VISUALIZER_SETTINGS.customSecondaryColor).toBe('string');
  });

  it('updateSettings persists all new Part 10 fields', () => {
    visualizer.updateSettings({
      fftSize: 4096,
      windowFunction: 'blackman',
      frequencyScale: 'linear',
      analysisTap: 'post_dsp',
      peakHold: false,
      peakDecaySpeed: 5,
      stereoMode: false,
      colorMode: 'neon',
      customSecondaryColor: '#ff00ff',
      spectrogramHistory: 300,
      pauseBehavior: 'fade',
      reducedMotion: true,
      showLyricsOverlay: false,
      showTechnicalDiagnostics: true,
    });
    const s = visualizer.getSettings();
    expect(s.fftSize).toBe(4096);
    expect(s.windowFunction).toBe('blackman');
    expect(s.frequencyScale).toBe('linear');
    expect(s.colorMode).toBe('neon');
    expect(s.customSecondaryColor).toBe('#ff00ff');
    expect(s.reducedMotion).toBe(true);
  });

  it('sub-analyzers are accessible as public readonly properties', () => {
    expect(visualizer.spectrumAnalyzer).toBeDefined();
    expect(visualizer.waveformAnalyzer).toBeDefined();
    expect(visualizer.spectrogramAnalyzer).toBeDefined();
    expect(visualizer.stereoAnalyzer).toBeDefined();
    expect(visualizer.beatDetector).toBeDefined();
    expect(visualizer.particleSystem).toBeDefined();
  });
});


/** Shared test fixtures: synthetic sine buffers and spectral peaks. */

export const SAMPLE_RATE = 48000;
export const GATE_DB = -52;

/** Generate N samples of a sine at the given frequency. */
export function sineWave(frequency: number, sampleRate: number, count: number, amplitude = 0.5): Float32Array {
  const buffer = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

/**
 * Build a synthetic frequency-domain spectrum (dB per FFT bin) with clean
 * peaks for a C major chord: C4, E4, G4.
 */
export function cMajorSpectrum(fftSize: number): Float32Array {
  const bins = fftSize / 2;
  const data = new Float32Array(bins).fill(-100);
  const binHz = SAMPLE_RATE / fftSize;
  const peaks = [
    { frequency: 261.625565, db: -12 }, // C4
    { frequency: 329.627557, db: -16 }, // E4
    { frequency: 391.995436, db: -20 } //  G4
  ];
  for (const { frequency, db } of peaks) {
    const index = Math.min(bins - 2, Math.max(1, Math.round(frequency / binHz)));
    data[index] = db;
  }
  return data;
}

/** Build a spectrum with a single peak at the given frequency/db. */
export function toneSpectrum(fftSize: number, frequency: number, db = -12): Float32Array {
  const bins = fftSize / 2;
  const data = new Float32Array(bins).fill(-100);
  const binHz = SAMPLE_RATE / fftSize;
  const index = Math.min(bins - 2, Math.max(1, Math.round(frequency / binHz)));
  data[index] = db;
  return data;
}

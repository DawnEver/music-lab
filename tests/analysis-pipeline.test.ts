import { describe, expect, it } from "vitest";
import { AnalysisPipeline, PITCH_INTERVAL_MS, SPECTRUM_INTERVAL_MS, SILENCE_MS } from "../src/lib/analysis-pipeline.js";

const SAMPLE_RATE = 48000;
const FFT_SIZE = 16384;

/** A loud sine — YIN should lock onto it. */
function sine(hz: number, amplitude = 0.5, length = 4096): Float32Array {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE);
  }
  return buffer;
}

/** A spectrum with a fundamental + harmonics over a quiet floor. */
function spectrum(hz: number | null, peakDb = -12): Float32Array {
  const bins = FFT_SIZE / 2;
  const data = new Float32Array(bins).fill(-120);
  if (hz == null) return data;
  const binHz = SAMPLE_RATE / FFT_SIZE;
  for (let harmonic = 1; harmonic <= 6; harmonic += 1) {
    const bin = Math.round((hz * harmonic) / binHz);
    if (bin < bins) data[bin] = peakDb - (harmonic - 1) * 6;
  }
  return data;
}

function makePipeline(): AnalysisPipeline {
  return new AnalysisPipeline({ sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE });
}

const settings = { tuning: 440, gateDb: -52, stability: 0.72 };

/** Push one frame; the time-domain buffer is only read on demand. */
function push(
  pipeline: AnalysisPipeline,
  now: number,
  time: Float32Array,
  freq: Float32Array,
  counter?: { reads: number }
) {
  return pipeline.push({
    now,
    frequencyData: freq,
    readTimeData: () => {
      if (counter) counter.reads += 1;
      return time;
    },
    ...settings
  });
}

describe("AnalysisPipeline cadence", () => {
  it("runs pitch detection on its own interval, not every frame", () => {
    const pipeline = makePipeline();
    const time = sine(440);
    const freq = spectrum(440);
    const counter = { reads: 0 };

    // 10 frames inside one pitch interval: the buffer is read once.
    for (let frame = 0; frame < 10; frame += 1) {
      push(pipeline, 1000 + frame * 5, time, freq, counter);
    }
    expect(counter.reads).toBe(1);

    push(pipeline, 1000 + PITCH_INTERVAL_MS, time, freq, counter);
    expect(counter.reads).toBe(2);
  });

  it("runs the spectral pass on the slower interval", () => {
    const pipeline = makePipeline();
    const time = sine(440);
    const freq = spectrum(440);

    const first = push(pipeline, 0, time, freq);
    expect(first.chroma).toBeTruthy();

    const early = push(pipeline, SPECTRUM_INTERVAL_MS - 1, time, freq);
    expect(early.spectralRan).toBe(false);

    const due = push(pipeline, SPECTRUM_INTERVAL_MS, time, freq);
    expect(due.spectralRan).toBe(true);
  });
});

describe("AnalysisPipeline pitch tracking", () => {
  it("locks onto a sustained note", () => {
    const pipeline = makePipeline();
    const time = sine(440);
    const freq = spectrum(440);
    let result = push(pipeline, 0, time, freq);
    for (let frame = 1; frame <= 6; frame += 1) {
      result = push(pipeline, frame * PITCH_INTERVAL_MS, time, freq);
    }
    expect(result.pitch).toBeTruthy();
    expect(result.pitch!.frequency).toBeGreaterThan(430);
    expect(result.pitch!.frequency).toBeLessThan(450);
  });

  it("clears the pitch after the silence window and decays the chroma", () => {
    const pipeline = makePipeline();
    const loud = sine(440);
    const quiet = sine(440, 0.000001);
    const freqLoud = spectrum(440);
    const freqQuiet = spectrum(null);

    let now = 0;
    for (let frame = 0; frame < 6; frame += 1) {
      now += PITCH_INTERVAL_MS;
      push(pipeline, now, loud, freqLoud);
    }
    const sounding = push(pipeline, now, loud, freqLoud);
    expect(sounding.pitch).toBeTruthy();
    const chromaEnergy = (c: Float32Array | null) => (c ? c.reduce((sum, v) => sum + v, 0) : 0);
    const energyWhileSounding = chromaEnergy(sounding.chroma);

    // Silence: the pitch survives briefly, then clears.
    now += SILENCE_MS - 1;
    expect(push(pipeline, now, quiet, freqQuiet).pitch).toBeTruthy();

    now += 2;
    const cleared = push(pipeline, now, quiet, freqQuiet);
    expect(cleared.pitch).toBeNull();
    expect(chromaEnergy(cleared.chroma)).toBeLessThan(energyWhileSounding);
  });

  it("reset() drops all smoothing state", () => {
    const pipeline = makePipeline();
    const time = sine(440);
    const freq = spectrum(440);
    for (let frame = 0; frame < 6; frame += 1) push(pipeline, frame * PITCH_INTERVAL_MS, time, freq);
    expect(pipeline.snapshot().pitch).toBeTruthy();

    pipeline.reset();
    const empty = pipeline.snapshot();
    expect(empty.pitch).toBeNull();
    expect(empty.chord).toBeNull();
    expect(empty.chroma).toBeNull();
  });
});

describe("AnalysisPipeline detector range", () => {
  it("a narrow band rejects a note outside it", () => {
    const pipeline = makePipeline();
    // Erhu band (D4..A4-ish) must not report a 110 Hz A2.
    pipeline.setRange({ minHz: 280, maxHz: 470, minMidi: 60, maxMidi: 70 });
    const time = sine(110);
    const freq = spectrum(110);
    let result = push(pipeline, 0, time, freq);
    for (let frame = 1; frame <= 4; frame += 1) {
      result = push(pipeline, frame * PITCH_INTERVAL_MS, time, freq);
    }
    if (result.pitch) expect(result.pitch.frequency).toBeGreaterThan(270);
  });
});

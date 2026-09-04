/**
 * The real-time analysis state machine, with no browser in it.
 *
 * Everything that decides what the tuner shows lives here: the two
 * analysis cadences, the YIN / spectral arbitration, pitch smoothing,
 * chroma smoothing, chord stabilisation, key tracking and the silence
 * decay. The caller supplies frames and a clock, exactly like the
 * metronome scheduler — so all of it is testable without an AudioContext.
 *
 * The rAF / AnalyserNode plumbing is a thin adapter in analysis-loop.ts.
 */

import { clamp, detectPitchYin, analyzeSpectrum, type PitchRange, type PitchResult } from "./dsp.js";
import { detectChord, hasPolyphonicEvidence, type ChordResult } from "./chord.js";
import { KeyTracker, type KeyEstimate } from "./key.js";
import { ChordStabilizer, PitchSmoother, choosePitch } from "./analysis-stabilizers.js";

/** Pitch detection runs at ~11 Hz, the spectral pass slightly slower. */
export const PITCH_INTERVAL_MS = 88;
export const SPECTRUM_INTERVAL_MS = 105;
/** How long a note survives without signal before the display clears. */
export const SILENCE_MS = 420;
/** Chroma decay per frame once silent. */
const SILENT_CHROMA_DECAY = 0.78;
/** A spectral pitch stays usable for this long after its pass. */
const SPECTRAL_PITCH_TTL_MS = 280;

export interface AnalysisFrame {
  now: number;
  /** Spectrum in dB (analyser.getFloatFrequencyData output). */
  frequencyData: Float32Array;
  /** Read lazily — only the pitch cadence needs the time-domain buffer. */
  readTimeData: () => Float32Array;
  tuning: number;
  gateDb: number;
  stability: number;
}

export interface AnalysisSnapshot {
  pitch: PitchResult | null;
  chord: ChordResult | null;
  keyEstimate: KeyEstimate | null;
  chroma: Float32Array | null;
  level: { rmsDb: number } | null;
  /** True on frames where the (slower) spectral pass actually ran. */
  spectralRan: boolean;
}

export interface AnalysisPipelineOptions {
  sampleRate: number;
  fftSize: number;
}

export class AnalysisPipeline {
  private readonly sampleRate: number;
  private readonly fftSize: number;
  private range: PitchRange | null = null;

  // -Infinity so the first frame always runs both passes, whatever the
  // clock's origin is.
  private lastPitchAt = -Infinity;
  private lastSpectrumAt = -Infinity;
  private lastSignalAt = 0;
  private started = false;

  private chromaSmooth = new Float32Array(12);
  private latestChroma = new Float32Array(12);
  private latestPitch: PitchResult | null = null;
  private latestSpectralPitch: PitchResult | null = null;
  private latestSpectralPitchAt = 0;
  private displayedChord: ChordResult | null = null;
  private keyEstimate: KeyEstimate | null = null;
  private level: { rmsDb: number } | null = null;
  private chromaOut: Float32Array | null = null;

  private readonly keyTracker = new KeyTracker();
  private readonly pitchSmoother = new PitchSmoother();
  private readonly chordStabilizer = new ChordStabilizer();

  constructor(options: AnalysisPipelineOptions) {
    this.sampleRate = options.sampleRate;
    this.fftSize = options.fftSize;
  }

  /** Narrow the detector to an instrument's band (bass B0 needs ~26 Hz). */
  setRange(range: PitchRange | null): void {
    this.range = range;
  }

  reset(): void {
    this.lastPitchAt = -Infinity;
    this.lastSpectrumAt = -Infinity;
    this.lastSignalAt = 0;
    this.started = false;
    this.chromaSmooth.fill(0);
    this.latestChroma.fill(0);
    this.latestPitch = null;
    this.latestSpectralPitch = null;
    this.latestSpectralPitchAt = 0;
    this.displayedChord = null;
    this.keyEstimate = null;
    this.level = null;
    this.chromaOut = null;
    this.pitchSmoother.reset();
    this.chordStabilizer.reset();
    this.keyTracker.reset();
  }

  /** The current display state, without advancing the pipeline. */
  snapshot(spectralRan = false): AnalysisSnapshot {
    return {
      pitch: this.latestPitch,
      chord: this.displayedChord,
      keyEstimate: this.keyEstimate,
      chroma: this.chromaOut,
      level: this.level,
      spectralRan
    };
  }

  /** Advance one frame and return what the display should show. */
  push(frame: AnalysisFrame): AnalysisSnapshot {
    const { now } = frame;
    if (!this.started) {
      this.started = true;
      this.lastSignalAt = now;
    }

    const yinResult = this.runPitchPass(frame);
    const spectralResult = this.runSpectralPass(frame);

    if (yinResult || spectralResult) {
      const recentSpectralPitch = spectralResult
        ? spectralResult.dominantPitch
        : now - this.latestSpectralPitchAt < SPECTRAL_PITCH_TTL_MS
          ? this.latestSpectralPitch
          : null;
      const polyphonic = Boolean(this.displayedChord) || hasPolyphonicEvidence(this.latestChroma);
      const selected = choosePitch(yinResult?.pitch ?? null, recentSpectralPitch, polyphonic);

      if (selected) {
        this.lastSignalAt = now;
        this.latestPitch = this.pitchSmoother.smooth(selected, now);
      } else {
        this.clearAfterSilence(now);
      }
    } else {
      this.clearAfterSilence(now);
    }

    return this.snapshot(Boolean(spectralResult));
  }

  private runPitchPass(frame: AnalysisFrame): ReturnType<typeof detectPitchYin> | null {
    if (frame.now - this.lastPitchAt < PITCH_INTERVAL_MS) return null;
    this.lastPitchAt = frame.now;

    const result = detectPitchYin(
      frame.readTimeData(),
      this.sampleRate,
      frame.gateDb,
      this.range ?? undefined
    );
    this.level = { rmsDb: result.rmsDb };
    if (result.rmsDb >= frame.gateDb) this.lastSignalAt = frame.now;
    return result;
  }

  private runSpectralPass(frame: AnalysisFrame): ReturnType<typeof analyzeSpectrum> | null {
    if (frame.now - this.lastSpectrumAt < SPECTRUM_INTERVAL_MS) return null;
    this.lastSpectrumAt = frame.now;

    const result = analyzeSpectrum(frame.frequencyData, this.sampleRate, this.fftSize, {
      tuning: frame.tuning,
      gateDb: frame.gateDb,
      range: this.range ?? undefined
    });
    this.latestSpectralPitch = result.dominantPitch;
    this.latestSpectralPitchAt = frame.now;

    const alpha = clamp(frame.stability, 0.2, 0.92);
    for (let i = 0; i < 12; i += 1) {
      this.chromaSmooth[i] = this.chromaSmooth[i] * alpha + result.chroma[i] * (1 - alpha);
      this.latestChroma[i] = this.chromaSmooth[i];
    }
    this.chromaOut = this.latestChroma.slice();

    this.keyTracker.push(this.latestChroma, frame.now);
    this.keyEstimate = this.keyTracker.estimate();
    this.displayedChord = this.chordStabilizer.stabilize(detectChord(this.latestChroma));
    return result;
  }

  private clearAfterSilence(now: number): void {
    if (now - this.lastSignalAt < SILENCE_MS) return;

    this.latestPitch = null;
    this.latestSpectralPitch = null;
    this.latestSpectralPitchAt = 0;
    this.displayedChord = null;
    this.pitchSmoother.reset();
    this.chordStabilizer.reset();

    for (let i = 0; i < 12; i += 1) {
      this.chromaSmooth[i] *= SILENT_CHROMA_DECAY;
      this.latestChroma[i] = this.chromaSmooth[i];
    }
    this.chromaOut = this.latestChroma.slice();
  }
}

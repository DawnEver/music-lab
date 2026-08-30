import { calculateRms, clamp, PITCH_WINDOW, resolveRange, type PitchRange } from "./dsp-core.js";

export interface PitchResult {
  frequency: number;
  confidence: number;
  method: "yin" | "spectral";
}

export interface YinResult {
  pitch: PitchResult | null;
  rms: number;
  rmsDb: number;
}

// Reused YIN difference buffer, allocated lazily and grown on demand to
// avoid per-frame garbage.
let yinBuffer: Float32Array | null = null;

/**
 * Detect the fundamental pitch of a time-domain buffer using the YIN
 * algorithm. Returns { pitch, rms, rmsDb }; pitch is null below the gate.
 * `range` widens/narrows the search band (e.g. bass B0 needs ~26 Hz).
 */
export function detectPitchYin(
  buffer: Float32Array,
  sampleRate: number,
  gateDb: number,
  range?: PitchRange
): YinResult {
  const { minHz, maxHz } = resolveRange(range, 440);
  const size = Math.min(PITCH_WINDOW, buffer.length);
  const offset = buffer.length - size;
  const rms = calculateRms(buffer);
  const rmsDb = 20 * Math.log10(Math.max(rms, 1e-12));

  if (rmsDb < gateDb) {
    return { pitch: null, rms, rmsDb };
  }

  const minTau = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxTau = Math.min(Math.floor(sampleRate / minHz), Math.floor(size / 2) - 2);
  const sampleCount = size - maxTau - 1;

  if (!yinBuffer || yinBuffer.length < maxTau + 2) {
    yinBuffer = new Float32Array(maxTau + 2);
  }

  const yin = yinBuffer;
  yin.fill(0, 0, maxTau + 2);

  for (let tau = 1; tau <= maxTau; tau += 1) {
    let difference = 0;
    const end = offset + sampleCount;
    for (let i = offset; i < end; i += 1) {
      const delta = buffer[i] - buffer[i + tau];
      difference += delta * delta;
    }
    yin[tau] = difference;
  }

  let runningSum = 0;
  yin[0] = 1;

  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += yin[tau];
    yin[tau] = runningSum > 0 ? (yin[tau] * tau) / runningSum : 1;
  }

  const threshold = 0.14;
  let tauEstimate = -1;

  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (yin[tau] < threshold) {
      while (tau + 1 <= maxTau && yin[tau + 1] < yin[tau]) {
        tau += 1;
      }
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate < 0) {
    let bestValue = 1;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (yin[tau] < bestValue) {
        bestValue = yin[tau];
        tauEstimate = tau;
      }
    }
    if (tauEstimate < 0 || bestValue > 0.34) {
      return { pitch: null, rms, rmsDb };
    }
  }

  let refinedTau = tauEstimate;
  if (tauEstimate > 1 && tauEstimate < maxTau) {
    const left = yin[tauEstimate - 1];
    const center = yin[tauEstimate];
    const right = yin[tauEstimate + 1];
    const denominator = left - 2 * center + right;
    if (Math.abs(denominator) > 1e-9) {
      const shift = (0.5 * (left - right)) / denominator;
      refinedTau += clamp(shift, -1, 1);
    }
  }

  const frequency = sampleRate / refinedTau;
  const confidence = clamp(1 - yin[tauEstimate], 0, 1);

  if (!Number.isFinite(frequency) || frequency < minHz || frequency > maxHz) {
    return { pitch: null, rms, rmsDb };
  }

  return {
    pitch: {
      frequency,
      confidence,
      method: "yin"
    },
    rms,
    rmsDb
  };
}


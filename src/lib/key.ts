/**
 * Key context for chord-degree labeling: a Key is (tonic, mode), modes are
 * data tables, and degree labeling is a pure function of (key, root, quality).
 * Auto estimation (Krumhansl-Schmuckler over accumulated chroma) and manual
 * selection produce the same Key type, so consumers are source-agnostic.
 * Pure functions, safe to import in Node.
 */

export type ModeKey = "major" | "minor";
export type TriadQuality = "major" | "minor" | "dim" | "aug";
export type SeventhQuality = "maj7" | "m7" | "dom7" | "m7b5" | "dim7";

export interface Key {
  tonic: number;
  mode: ModeKey;
}

export interface ModeDegree {
  interval: number;
  triad: TriadQuality;
  seventh: SeventhQuality;
  /** Which minor-key form supplies this degree (major-mode degrees are "natural"). */
  variant: "natural" | "harmonic";
}

export interface Mode {
  key: ModeKey;
  /** Roman-numeral label per semitone offset from the tonic (accidentals included). */
  labels: string[];
  degrees: ModeDegree[];
}

export const MODES: Record<ModeKey, Mode> = {
  major: {
    key: "major",
    labels: ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"],
    degrees: [
      { interval: 0, triad: "major", seventh: "maj7", variant: "natural" },
      { interval: 2, triad: "minor", seventh: "m7", variant: "natural" },
      { interval: 4, triad: "minor", seventh: "m7", variant: "natural" },
      { interval: 5, triad: "major", seventh: "maj7", variant: "natural" },
      { interval: 7, triad: "major", seventh: "dom7", variant: "natural" },
      { interval: 9, triad: "minor", seventh: "m7", variant: "natural" },
      { interval: 11, triad: "dim", seventh: "m7b5", variant: "natural" }
    ]
  },
  minor: {
    key: "minor",
    labels: ["I", "♭II", "II", "III", "♯III", "IV", "♯IV", "V", "VI", "♯VI", "VII", "♯VII"],
    degrees: [
      { interval: 0, triad: "minor", seventh: "m7", variant: "natural" },
      { interval: 2, triad: "dim", seventh: "m7b5", variant: "natural" },
      { interval: 3, triad: "major", seventh: "maj7", variant: "natural" },
      { interval: 5, triad: "minor", seventh: "m7", variant: "natural" },
      { interval: 7, triad: "minor", seventh: "m7", variant: "natural" },
      { interval: 8, triad: "major", seventh: "maj7", variant: "natural" },
      { interval: 10, triad: "major", seventh: "dom7", variant: "natural" },
      { interval: 7, triad: "major", seventh: "dom7", variant: "harmonic" },
      { interval: 11, triad: "dim", seventh: "dim7", variant: "harmonic" }
    ]
  }
};

/** Krumhansl-Kessler key profiles (tonic-first, 12 pitch classes). */
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export interface KeyEstimate {
  key: Key;
  /** 0..1, combining correlation strength and margin over the runner-up. */
  confidence: number;
  correlation: number;
  alternate: Key | null;
}

function pearson(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < 12; i += 1) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / 12;
  const meanB = sumB / 12;
  let covariance = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < 12; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    covariance += da * db;
    varA += da * da;
    varB += db * db;
  }
  const denominator = Math.sqrt(varA * varB);
  return denominator > 1e-9 ? covariance / denominator : 0;
}

/** Correlate chroma against one named key profile. Used by the stateful tracker. */
export function correlationForKey(chroma: ArrayLike<number>, key: Key): number {
  const profile = key.mode === "major" ? MAJOR_PROFILE : MINOR_PROFILE;
  const rotated = profile.map((_, degree) => profile[(degree - key.tonic + 12) % 12]);
  return pearson(chroma, rotated);
}

/** Correlate a chroma vector against all 24 key profiles; best match wins. */
export function estimateKey(chroma: Float32Array | number[]): KeyEstimate | null {
  const energy = Array.from(chroma).reduce((sum, value) => sum + value, 0);
  if (energy < 1e-7) return null;

  const scored: Array<{ key: Key; correlation: number }> = [];
  for (let tonic = 0; tonic < 12; tonic += 1) {
    for (const mode of ["major", "minor"] as const) {
      const profile = mode === "major" ? MAJOR_PROFILE : MINOR_PROFILE;
      const rotated = profile.map((_, degree) => profile[(degree - tonic + 12) % 12]);
      scored.push({ key: { tonic, mode }, correlation: pearson(chroma, rotated) });
    }
  }
  scored.sort((a, b) => b.correlation - a.correlation);

  const best = scored[0];
  const second = scored[1];
  const margin = second ? Math.max(0, best.correlation - second.correlation) : 0;
  const confidence = Math.min(
    1,
    Math.max(0, (best.correlation + 1) / 2) * 0.6 + Math.min(1, margin * 6) * 0.4
  );

  return {
    key: best.key,
    confidence,
    correlation: best.correlation,
    alternate: second ? second.key : null
  };
}

export interface ChordDegree {
  /** Roman numeral with case, accidentals and quality suffix, e.g. "V7", "♭iii7". */
  numeral: string;
  /** True when root and quality match a degree of the mode's scale. */
  diatonic: boolean;
  /** Minor-mode source of the matched degree; null when chromatic or major-mode. */
  variant: "natural" | "harmonic" | null;
  /** "V/x" when this is a dominant-function chord of a non-tonic scale degree. */
  secondary: string | null;
}

const QUALITY_MAP: Record<string, { triad: TriadQuality | null; seventh: SeventhQuality | null; uppercase: boolean; suffix: string }> = {
  major: { triad: "major", seventh: null, uppercase: true, suffix: "" },
  minor: { triad: "minor", seventh: null, uppercase: false, suffix: "" },
  dim: { triad: "dim", seventh: null, uppercase: false, suffix: "°" },
  aug: { triad: "aug", seventh: null, uppercase: true, suffix: "+" },
  sus2: { triad: null, seventh: null, uppercase: true, suffix: "sus2" },
  sus4: { triad: null, seventh: null, uppercase: true, suffix: "sus4" },
  fifth: { triad: null, seventh: null, uppercase: true, suffix: "5" },
  dom7: { triad: "major", seventh: "dom7", uppercase: true, suffix: "7" },
  maj7: { triad: "major", seventh: "maj7", uppercase: true, suffix: "maj7" },
  m7: { triad: "minor", seventh: "m7", uppercase: false, suffix: "7" }
};

function applyCase(label: string, uppercase: boolean): string {
  return uppercase ? label.toUpperCase() : label.toLowerCase();
}

/**
 * Label a chord (root pitch class + chord-type key, as in music-theory.ts)
 * relative to a key. Always returns a numeral; `diatonic` marks whether the
 * chord belongs to the scale.
 */
export function degreeOf(root: number, chordTypeKey: string, key: Key): ChordDegree {
  const mode = MODES[key.mode];
  const interval = (((root - key.tonic) % 12) + 12) % 12;
  const quality = QUALITY_MAP[chordTypeKey] ?? QUALITY_MAP.major;

  const numeral = applyCase(mode.labels[interval], quality.uppercase) + quality.suffix;

  const matches = mode.degrees.filter((degree) => degree.interval === interval);
  let matched: ModeDegree | null = null;
  for (const degree of matches) {
    const triadOk = quality.triad === null
      ? degree.triad === "major" || degree.triad === "minor"
      : degree.triad === quality.triad;
    const seventhOk = quality.seventh === null || degree.seventh === quality.seventh;
    if (triadOk && seventhOk) {
      matched = degree;
      break;
    }
  }

  let secondary: string | null = null;
  const isDominantFunction = chordTypeKey === "major" || chordTypeKey === "dom7";
  if (isDominantFunction) {
    const targetInterval = (((interval - 7) % 12) + 12) % 12;
    if (targetInterval !== 0) {
      const target = mode.degrees.find(
        (degree) => degree.interval === targetInterval && degree.variant === "natural"
      );
      if (target) {
        const targetUppercase = target.triad === "major" || target.triad === "aug";
        secondary = `V/${applyCase(mode.labels[targetInterval], targetUppercase)}`;
      }
    }
  }

  return {
    numeral,
    diatonic: matched !== null,
    variant: matched && key.mode === "minor" ? matched.variant : null,
    secondary
  };
}

export { KeyTracker } from "./key-tracker.js";

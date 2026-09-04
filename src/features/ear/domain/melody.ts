/**
 * Sight-singing material.
 *
 * A melody is a list of notes on a beat grid — the same shape the trace
 * draws as reference segments and the judge compares against, so nothing
 * has to be converted between "what you see", "what you hear" and "what
 * you are scored on".
 */

export interface MelodyNote {
  midi: number;
  /** Seconds from the start of the melody. */
  start: number;
  duration: number;
}

export interface Melody {
  tonicMidi: number;
  bpm: number;
  notes: MelodyNote[];
}

export interface MelodyOptions {
  bars: number;
  tonicMidi: number;
  bpm: number;
  /** Beats per bar. */
  beatsPerBar?: number;
}

/** Major scale degrees; stepwise motion with the occasional leap. */
const SCALE = [0, 2, 4, 5, 7, 9, 11, 12];
const STEPS = [-2, -1, -1, 1, 1, 2];

type Rng = () => number;

export function generateMelody(options: MelodyOptions, rng: Rng): Melody {
  const beatsPerBar = options.beatsPerBar ?? 4;
  const beat = 60 / options.bpm;
  const count = options.bars * beatsPerBar;
  const notes: MelodyNote[] = [];

  // Degree 0 is the tonic: the singer is given the note before being asked
  // to leave it.
  let degree = 0;
  for (let index = 0; index < count; index += 1) {
    notes.push({
      midi: options.tonicMidi + SCALE[clampDegree(degree)],
      start: index * beat,
      duration: beat
    });
    const step = STEPS[Math.min(STEPS.length - 1, Math.floor(rng() * STEPS.length))];
    degree = clampDegree(degree + step);
  }
  return { tonicMidi: options.tonicMidi, bpm: options.bpm, notes };
}

function clampDegree(degree: number): number {
  return Math.max(0, Math.min(SCALE.length - 1, degree));
}

export function melodySeconds(melody: Melody): number {
  return melody.notes.reduce((end, note) => Math.max(end, note.start + note.duration), 0);
}

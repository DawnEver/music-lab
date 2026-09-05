/**
 * Notation layout: a melody, positioned for reading.
 *
 * Sight-singing is reading, so the line has to be written down — a pitch
 * graph shows what came out, not what to sing. Layout is pure geometry in
 * abstract units (staff steps, note index); the renderer turns that into
 * pixels. Nothing here knows about SVG, and all of it runs in Node.
 */

/**
 * What notation needs to know about a line. Defined here because the pure
 * layer may not reach into a feature — and because "notes on a beat grid
 * in a key" is a music idea, not an ear-training one.
 */
export interface NotatedNote {
  midi: number;
  /** Seconds from the start of the line. */
  start: number;
  duration: number;
}

export interface NotatedLine {
  tonicMidi: number;
  bpm: number;
  notes: NotatedNote[];
}

/** Seven letters to an octave: the staff counts letters, not semitones. */
export const STAFF_STEPS_PER_OCTAVE = 7;

/** Diatonic index of the bottom line of the treble staff (E4). */
const BOTTOM_LINE = 4 * STAFF_STEPS_PER_OCTAVE + 2;
/** The middle line (B4) decides stem direction. */
const MIDDLE_STEP = 4;
/** Top line of the five-line staff, in steps from the bottom line. */
const TOP_STEP = 8;

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type Letter = (typeof LETTERS)[number];
/** Semitone above C for each letter. */
const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11];
/** Major scale, in semitones from the tonic. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export type Accidental = "sharp" | "flat" | "natural";

export interface KeySignature {
  kind: "sharp" | "flat";
  count: number;
}

/** Sharps and flats of the major key on this tonic, around the fifths. */
export function keySignature(tonicMidi: number): KeySignature {
  const pitchClass = ((tonicMidi % 12) + 12) % 12;
  const sharps: Record<number, number> = { 0: 0, 7: 1, 2: 2, 9: 3, 4: 4, 11: 5, 6: 6 };
  const flats: Record<number, number> = { 5: 1, 10: 2, 3: 3, 8: 4, 1: 5 };
  if (pitchClass in sharps) return { kind: "sharp", count: sharps[pitchClass] };
  return { kind: "flat", count: flats[pitchClass] ?? 0 };
}

/** Order the accidentals of a key signature appear in. */
export const SHARP_ORDER: Letter[] = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER: Letter[] = ["B", "E", "A", "D", "G", "C", "F"];
/** Where each key-signature accidental sits, in steps from the bottom line. */
export const SHARP_STEPS = [8, 5, 9, 6, 3, 7, 4];
export const FLAT_STEPS = [4, 7, 3, 6, 2, 5, 1];

export interface StaffNote {
  midi: number;
  /** Steps above the bottom line of the treble staff; even numbers are lines. */
  step: number;
  letter: Letter;
  /** Only when the note is outside the key. */
  accidental: Accidental | null;
  /** Ledger line positions, in the same steps. */
  ledgerSteps: number[];
  stem: "up" | "down";
  /** Note index, which is also its horizontal order. */
  index: number;
  bar: number;
  /** Beat position inside the bar, for spacing. */
  beat: number;
  /** Horizontal position in beats from the start of the line. */
  x: number;
  start: number;
  duration: number;
}

export interface StaffLayout {
  notes: StaffNote[];
  keySignature: KeySignature;
  bars: number;
  beatsPerBar: number;
}

export interface NotationOptions {
  beatsPerBar?: number;
}

/** Which letter a note is spelled with, given the key it is written in. */
function spell(midi: number, tonicMidi: number): { letter: Letter; accidental: Accidental | null } {
  const tonicClass = ((tonicMidi % 12) + 12) % 12;
  const tonicLetter = LETTERS.findIndex((_, index) => LETTER_SEMITONES[index] === tonicClass);
  const interval = ((midi - tonicMidi) % 12 + 12) % 12;
  const degree = MAJOR.indexOf(interval);

  if (degree >= 0 && tonicLetter >= 0) {
    // Diatonic: the letter follows the degree, so no accidental is written.
    return { letter: LETTERS[(tonicLetter + degree) % 7], accidental: null };
  }
  // Outside the key: spell it from the letter below and mark it.
  const pitchClass = ((midi % 12) + 12) % 12;
  const below = [...LETTER_SEMITONES].reverse().find((value) => value <= pitchClass) ?? 0;
  const letter = LETTERS[LETTER_SEMITONES.indexOf(below)];
  return { letter, accidental: pitchClass === below ? null : "sharp" };
}

function diatonicIndex(midi: number, letter: Letter): number {
  const octave = Math.floor(midi / 12) - 1;
  const letterIndex = LETTERS.indexOf(letter);
  // A B spelled below the next C still belongs to the lower octave.
  const semitone = ((midi % 12) + 12) % 12;
  const correction = semitone <= 1 && letterIndex === 6 ? -1 : 0;
  return (octave + correction) * STAFF_STEPS_PER_OCTAVE + letterIndex;
}

/** Ledger lines needed to reach a step from the staff. */
function ledgersFor(step: number): number[] {
  const lines: number[] = [];
  for (let line = -2; line >= step; line -= 2) lines.push(line);
  for (let line = TOP_STEP + 2; line <= step; line += 2) lines.push(line);
  return lines;
}

export function staffLayout(melody: NotatedLine, options: NotationOptions = {}): StaffLayout {
  const beatsPerBar = options.beatsPerBar ?? 4;
  const beat = 60 / melody.bpm;

  const notes = melody.notes.map((note, index) => {
    const { letter, accidental } = spell(note.midi, melody.tonicMidi);
    const step = diatonicIndex(note.midi, letter) - BOTTOM_LINE;
    const position = note.start / beat;
    return {
      midi: note.midi,
      step,
      letter,
      accidental,
      ledgerSteps: ledgersFor(step),
      stem: step < MIDDLE_STEP ? ("up" as const) : ("down" as const),
      index,
      bar: Math.floor(position / beatsPerBar),
      beat: position % beatsPerBar,
      x: position,
      start: note.start,
      duration: note.duration
    };
  });

  return {
    notes,
    keySignature: keySignature(melody.tonicMidi),
    bars: Math.max(1, Math.ceil(melody.notes.length / beatsPerBar)),
    beatsPerBar
  };
}

export interface JianpuNote {
  midi: number;
  /** 1–7 in the key. */
  degree: number;
  /** Dots above (+) or below (−) the number. */
  octaveDots: number;
  accidental: Accidental | null;
  index: number;
  bar: number;
  x: number;
  start: number;
  duration: number;
}

export interface JianpuLayout {
  notes: JianpuNote[];
  bars: number;
  beatsPerBar: number;
  tonicMidi: number;
}

/**
 * Numbered notation: the degree of the key, with dots for the octave.
 *
 * It is the notation most Chinese learners read first, and it is also the
 * one that matches what ear training teaches — a degree, not a letter.
 */
export function jianpuLayout(melody: NotatedLine, options: NotationOptions = {}): JianpuLayout {
  const beatsPerBar = options.beatsPerBar ?? 4;
  const beat = 60 / melody.bpm;

  const notes = melody.notes.map((note, index) => {
    const distance = note.midi - melody.tonicMidi;
    const octaveDots = Math.floor(distance / 12);
    const interval = ((distance % 12) + 12) % 12;
    const exact = MAJOR.indexOf(interval);
    const degreeIndex = exact >= 0 ? exact : MAJOR.filter((value) => value < interval).length - 1;
    const position = note.start / beat;
    return {
      midi: note.midi,
      degree: Math.max(1, degreeIndex + 1),
      octaveDots,
      accidental: exact >= 0 ? null : ("sharp" as Accidental),
      index,
      bar: Math.floor(position / beatsPerBar),
      x: position,
      start: note.start,
      duration: note.duration
    };
  });

  return {
    notes,
    bars: Math.max(1, Math.ceil(melody.notes.length / beatsPerBar)),
    beatsPerBar,
    tonicMidi: melody.tonicMidi
  };
}

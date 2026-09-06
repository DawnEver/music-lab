/**
 * The computer keyboard as a piano.
 *
 * Two rows, the way every tracker and DAW lays it out: the ZXCV row is one
 * octave, the QWERTY row the octave above, and the black keys sit on the
 * row above their own white key. The map is written as semitone offsets
 * from a movable base, so shifting octaves is arithmetic rather than a
 * second table.
 */

/** Semitone offset above the base note, per `KeyboardEvent.code`. */
export const KEY_OFFSETS: Readonly<Record<string, number>> = {
  // Lower octave — white keys.
  KeyZ: 0,
  KeyX: 2,
  KeyC: 4,
  KeyV: 5,
  KeyB: 7,
  KeyN: 9,
  KeyM: 11,
  Comma: 12,
  Period: 14,
  Slash: 16,
  // Lower octave — black keys, on the row above.
  KeyS: 1,
  KeyD: 3,
  KeyG: 6,
  KeyH: 8,
  KeyJ: 10,
  KeyL: 13,
  Semicolon: 15,
  // Upper octave — white keys.
  KeyQ: 12,
  KeyW: 14,
  KeyE: 16,
  KeyR: 17,
  KeyT: 19,
  KeyY: 21,
  KeyU: 23,
  KeyI: 24,
  KeyO: 26,
  KeyP: 28,
  BracketLeft: 29,
  BracketRight: 31,
  // Upper octave — black keys, on the number row.
  Digit2: 13,
  Digit3: 15,
  Digit5: 18,
  Digit6: 20,
  Digit7: 22,
  Digit9: 25,
  Digit0: 27,
  Equal: 30
};

/** The lowest and highest offset any key can reach. */
export function keymapSpan(): { low: number; high: number } {
  const offsets = Object.values(KEY_OFFSETS);
  return { low: Math.min(...offsets), high: Math.max(...offsets) };
}

/** The note a physical key sounds, or null if it is not part of the map. */
export function midiForKey(code: string, baseMidi: number): number | null {
  const offset = KEY_OFFSETS[code];
  return offset === undefined ? null : baseMidi + offset;
}

/** Which physical keys sound a note, for labelling the on-screen keyboard. */
export function keysForMidi(midi: number, baseMidi: number): string[] {
  const offset = midi - baseMidi;
  return Object.keys(KEY_OFFSETS).filter((code) => KEY_OFFSETS[code] === offset);
}

/** The lowest base note the keyboard may sit at (C0) and the highest (C7). */
export const MIN_BASE_MIDI = 12;
export const MAX_BASE_MIDI = 96;

/**
 * Move the keyboard by whole octaves, clamped so the mapped span always
 * stays inside audible MIDI.
 */
export function shiftBase(baseMidi: number, octaves: number): number {
  const next = baseMidi + octaves * 12;
  return Math.min(MAX_BASE_MIDI, Math.max(MIN_BASE_MIDI, next));
}

/** C4 under the Q key's octave — the default a player expects. */
export const DEFAULT_BASE_MIDI = 48;

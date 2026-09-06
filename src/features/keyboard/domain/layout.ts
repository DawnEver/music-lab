/**
 * Where the keys sit.
 *
 * A piano is not a uniform grid: seven white keys carry twelve notes, and
 * the black ones sit between them. So the geometry is derived from pitch
 * class — white keys are counted, black keys are placed on the boundary
 * they straddle — and the view only has to multiply by a key width.
 */

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

export interface KeyboardKey {
  midi: number;
  black: boolean;
  /**
   * Position in white-key widths from the left edge. A white key sits at
   * its own index; a black key straddles the gap, so it lands on a half.
   */
  offset: number;
}

export interface KeyboardLayout {
  keys: KeyboardKey[];
  /** How many white keys wide the whole keyboard is. */
  whiteCount: number;
}

export function isBlackKey(midi: number): boolean {
  return BLACK_PITCH_CLASSES.has(((midi % 12) + 12) % 12);
}

/** Lay out every note from `lowMidi` to `highMidi` inclusive. */
export function keyboardLayout(lowMidi: number, highMidi: number): KeyboardLayout {
  const keys: KeyboardKey[] = [];
  let white = 0;

  for (let midi = lowMidi; midi <= highMidi; midi += 1) {
    if (isBlackKey(midi)) {
      // Straddles the boundary between the white key before and after it.
      keys.push({ midi, black: true, offset: white - 0.5 });
    } else {
      keys.push({ midi, black: false, offset: white });
      white += 1;
    }
  }

  return { keys, whiteCount: white };
}

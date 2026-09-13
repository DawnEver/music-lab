/**
 * Where the keys sit.
 *
 * A piano is not a uniform grid: seven white keys carry twelve notes, and
 * the black ones sit between them. So the geometry is derived from pitch
 * class — white keys are counted, black keys are placed on the boundary
 * they straddle — and the view only has to multiply by a key width.
 */

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/**
 * How wide one white key may be drawn, in millimetres.
 *
 * Both ends come from the hand rather than from the window. 23.5mm is the
 * white key of a real piano — past it a key is not more playable, only
 * bigger — and 9mm is a fingertip, which is where hitting the right key
 * stops being likely.
 *
 * They live here rather than in the stylesheet because three things have
 * to agree about them: the slider the player drags, the store that
 * remembers it, and the clamp the board sizes itself with. A stylesheet
 * cannot import a number, so the component hands these to CSS as custom
 * properties — one source, three consumers.
 */
export const MIN_WHITE_MM = 9;
export const MAX_WHITE_MM = 23.5;

/** A width the app is willing to draw, from a width that may be anything. */
export function clampWhiteMm(mm: number): number {
  if (!Number.isFinite(mm)) return mm > 0 ? MAX_WHITE_MM : MIN_WHITE_MM;
  return Math.min(MAX_WHITE_MM, Math.max(MIN_WHITE_MM, mm));
}

/** How wide the whole run of white keys is, which is what the board is sized to. */
export function whiteRunMm(whiteCount: number, mm: number): number {
  return whiteCount * clampWhiteMm(mm);
}

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

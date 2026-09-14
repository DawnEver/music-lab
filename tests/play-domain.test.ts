import { describe, expect, it } from "vitest";
import {
  KEY_OFFSETS,
  DEFAULT_BASE_MIDI,
  MAX_BASE_MIDI,
  MIN_BASE_MIDI,
  keymapSpan,
  keysForMidi,
  midiForKey,
  shiftBase
} from "../src/features/play/domain/keymap.js";
import {
  MAX_WHITE_MM,
  MIN_WHITE_MM,
  clampWhiteMm,
  isBlackKey,
  keyboardLayout,
  whiteRunMm
} from "../src/features/play/domain/layout.js";
import { ringStep } from "../src/features/play/domain/radio.js";

describe("key map", () => {
  it("puts the two rows an octave apart", () => {
    expect(midiForKey("KeyZ", 60)).toBe(60);
    expect(midiForKey("KeyQ", 60)).toBe(72);
  });

  it("walks the lower row up the C major scale", () => {
    const row = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM", "Comma"];
    expect(row.map((code) => midiForKey(code, 60))).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
  });

  it("puts a black key on the row above the white keys it sits between", () => {
    // S is between Z and X, so C♯ between C and D.
    expect(midiForKey("KeyS", 60)).toBe(61);
    expect(midiForKey("KeyS", 60)).toBe(midiForKey("KeyZ", 60)! + 1);
    // There is no key between E and F, so no black key over C/V.
    expect(midiForKey("KeyF", 60)).toBeNull();
  });

  it("maps every black key to a black note and every white key to a white one", () => {
    for (const [code, offset] of Object.entries(KEY_OFFSETS)) {
      const midi = 60 + offset;
      const onNumberOrHomeRow = /^(Digit|Equal)/.test(code) || /^Key[SDGHJL]$|^Semicolon$/.test(code);
      expect(isBlackKey(midi), code).toBe(onNumberOrHomeRow);
    }
  });

  it("ignores keys that are not part of the map", () => {
    expect(midiForKey("Space", 60)).toBeNull();
    expect(midiForKey("ArrowUp", 60)).toBeNull();
  });

  it("names the physical keys that sound a note", () => {
    expect(keysForMidi(60, 60)).toEqual(["KeyZ"]);
    // The rows overlap by an octave, so one note can have two keys.
    expect(keysForMidi(72, 60).sort()).toEqual(["Comma", "KeyQ"]);
    expect(keysForMidi(200, 60)).toEqual([]);
  });

  it("spans the range the on-screen keyboard has to show", () => {
    const span = keymapSpan();
    expect(span.low).toBe(0);
    expect(span.high).toBe(31);
    expect(Math.max(...Object.values(KEY_OFFSETS))).toBe(span.high);
  });
});

describe("octave shift", () => {
  it("moves by whole octaves", () => {
    expect(shiftBase(48, 1)).toBe(60);
    expect(shiftBase(48, -1)).toBe(36);
  });

  it("clamps rather than running off the piano", () => {
    expect(shiftBase(MIN_BASE_MIDI, -1)).toBe(MIN_BASE_MIDI);
    expect(shiftBase(MAX_BASE_MIDI, 1)).toBe(MAX_BASE_MIDI);
  });

  it("starts on a C, so the rows line up with the scale", () => {
    expect(DEFAULT_BASE_MIDI % 12).toBe(0);
    expect(MIN_BASE_MIDI % 12).toBe(0);
    expect(MAX_BASE_MIDI % 12).toBe(0);
  });
});

describe("keyboard layout", () => {
  it("counts seven white keys and five black to the octave", () => {
    const layout = keyboardLayout(60, 71);
    expect(layout.keys).toHaveLength(12);
    expect(layout.whiteCount).toBe(7);
    expect(layout.keys.filter((key) => key.black)).toHaveLength(5);
  });

  it("places white keys one width apart", () => {
    const layout = keyboardLayout(60, 72);
    const white = layout.keys.filter((key) => !key.black);
    expect(white.map((key) => key.offset)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it("straddles each black key over the boundary it belongs to", () => {
    const layout = keyboardLayout(60, 72);
    const black = layout.keys.filter((key) => key.black);
    // C♯ D♯ F♯ G♯ A♯ — never between E/F or B/C, which have no boundary key.
    expect(black.map((key) => key.offset)).toEqual([0.5, 1.5, 3.5, 4.5, 5.5]);
  });

  it("stays inside its own width", () => {
    const layout = keyboardLayout(48, 48 + 31);
    for (const key of layout.keys) {
      expect(key.offset).toBeGreaterThanOrEqual(0);
      expect(key.offset).toBeLessThanOrEqual(layout.whiteCount);
    }
  });
});

/*
 * A key has a size, and both ends of it come from the hand: 23.5mm is a
 * real piano's white key and 9mm is a fingertip. They are the app's, not
 * the player's, which is why they live here rather than in the stylesheet
 * — the slider, the store and the board's own clamp all have to agree, and
 * a stylesheet cannot import a number.
 */
describe("white key size", () => {
  it("keeps a width inside the hand", () => {
    expect(clampWhiteMm(14)).toBe(14);
    expect(clampWhiteMm(MIN_WHITE_MM - 1)).toBe(MIN_WHITE_MM);
    expect(clampWhiteMm(MAX_WHITE_MM + 5)).toBe(MAX_WHITE_MM);
  });

  it("refuses a width that is not a number", () => {
    // A NaN reaches CSS as `calc(19 * NaN mm)`, which is invalid at
    // computed-value time: the declaration is dropped and the board
    // silently collapses to its content width.
    expect(clampWhiteMm(Number.NaN)).toBe(MIN_WHITE_MM);
    expect(clampWhiteMm(Number.POSITIVE_INFINITY)).toBe(MAX_WHITE_MM);
  });

  it("spans the whole keyboard, not one key", () => {
    // The run is what the board is sized to: `--kbd-fit`.
    expect(whiteRunMm(19, 12.5)).toBe(237.5);
  });
});

/*
 * The arrows move through a one-of-N group, and play has two of them: the
 * direction the instrument runs, and how it is sounded. Same key, same
 * rule, so the rule is one function.
 */
describe("radio group keys", () => {
  it("moves one place and wraps", () => {
    expect(ringStep("ArrowRight", 0, 3)).toBe(1);
    expect(ringStep("ArrowRight", 2, 3)).toBe(0);
    expect(ringStep("ArrowLeft", 0, 3)).toBe(2);
    expect(ringStep("ArrowLeft", 2, 3)).toBe(1);
  });

  it("treats up and down as back and forward", () => {
    expect(ringStep("ArrowDown", 0, 2)).toBe(1);
    expect(ringStep("ArrowUp", 1, 2)).toBe(0);
  });

  it("leaves every other key to whoever else wants it", () => {
    expect(ringStep("Tab", 0, 3)).toBeNull();
    expect(ringStep("Enter", 1, 3)).toBeNull();
    expect(ringStep("ArrowRight", 0, 0)).toBeNull();
  });
});

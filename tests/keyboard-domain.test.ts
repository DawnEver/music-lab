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
} from "../src/features/keyboard/domain/keymap.js";
import { isBlackKey, keyboardLayout } from "../src/features/keyboard/domain/layout.js";

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

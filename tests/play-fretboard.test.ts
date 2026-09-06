import { describe, expect, it } from "vitest";
import {
  MARKER_FRETS,
  OCTAVE_FRETS,
  fretRows,
  fretboardRange
} from "../src/features/play/domain/fretboard.js";
import { getPreset, getTunedInstrument } from "../src/instruments/index.js";

const guitar = getTunedInstrument("guitar")!;
const standard = getPreset(guitar, "standard");

describe("fret rows", () => {
  it("puts the highest-sounding string on top, as tablature is written", () => {
    const rows = fretRows(standard, 12, "en");
    expect(rows.map((row) => row.openMidi)).toEqual([64, 59, 55, 50, 45, 40]);
    expect(rows[0].label).toBe("1");
    expect(rows[5].label).toBe("6");
  });

  it("walks a semitone per fret, open string first", () => {
    const rows = fretRows(standard, 5, "en");
    expect(rows[5].notes).toEqual([40, 41, 42, 43, 44, 45]);
    expect(rows[5].notes).toHaveLength(6);
  });

  it("lands the fifth fret of one string on the next string open", () => {
    const rows = fretRows(standard, 12, "en");
    // Standard tuning is fourths except between strings 3 and 2.
    expect(rows[5].notes[5]).toBe(rows[4].openMidi);
    expect(rows[2].notes[4]).toBe(rows[1].openMidi);
  });

  it("keeps the instrument's own string order rather than sorting by pitch", () => {
    const banjo = getTunedInstrument("banjo")!;
    const rows = fretRows(getPreset(banjo, banjo.tuning.defaultPresetId), 5, "en");
    const pitches = rows.map((row) => row.openMidi);
    // The re-entrant fifth string breaks any pitch ordering; that is the point.
    expect([...pitches].sort((a, b) => b - a)).not.toEqual(pitches);
  });

  it("gives each alternate tuning its own board, for free", () => {
    const dropD = fretRows(getPreset(guitar, "dropD"), 3, "en");
    expect(dropD[5].openMidi).toBe(38);
    expect(dropD[4].openMidi).toBe(45);
  });

  it("labels strings in the current language", () => {
    const erhu = getTunedInstrument("erhu")!;
    const preset = getPreset(erhu, erhu.tuning.defaultPresetId);
    expect(fretRows(preset, 2, "zh")[0].label).not.toBe(fretRows(preset, 2, "en")[0].label);
  });
});

describe("fretboard range", () => {
  it("spans the lowest open string to the highest fret", () => {
    expect(fretboardRange(standard, 15)).toEqual({ low: 40, high: 79 });
  });
});

describe("inlays", () => {
  it("marks scale distances, never the octave twice", () => {
    for (const fret of OCTAVE_FRETS) expect(MARKER_FRETS).not.toContain(fret);
    expect(MARKER_FRETS).toContain(5);
    expect(MARKER_FRETS).toContain(7);
  });
});

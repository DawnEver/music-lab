import { describe, expect, it } from "vitest";
import { midiFromName } from "../src/audio/soundfont.js";

/*
 * The bank is a file someone else publishes, so the note names in it are
 * read rather than assumed. It spells every black key with a flat, which
 * is the kind of detail that turns into a bank with no A♯ in it.
 */
describe("soundfont note names", () => {
  it("reads the middle of the keyboard", () => {
    expect(midiFromName("C4")).toBe(60);
    expect(midiFromName("A4")).toBe(69);
    expect(midiFromName("C3")).toBe(48);
  });

  it("reads the ends, which is where off-by-an-octave lives", () => {
    expect(midiFromName("A0")).toBe(21);
    expect(midiFromName("C8")).toBe(108);
    expect(midiFromName("C1")).toBe(24);
    expect(midiFromName("B-1")).toBe(11);
  });

  it("reads both spellings of a black key", () => {
    expect(midiFromName("Bb0")).toBe(22);
    expect(midiFromName("A#0")).toBe(22);
    expect(midiFromName("Db1")).toBe(25);
    expect(midiFromName("C#1")).toBe(25);
    expect(midiFromName("Gb4")).toBe(66);
    expect(midiFromName("F#4")).toBe(66);
  });

  it("refuses what is not a note name", () => {
    for (const nonsense of ["", "H4", "C", "4", "Cx4", "C4#"]) {
      expect(midiFromName(nonsense), nonsense).toBeNull();
    }
  });

  it("spells every one of the bank's eighty-eight notes", () => {
    // A0 up to C8, which is the whole of what the file holds.
    const names: string[] = [];
    const spelling = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    for (let midi = 21; midi <= 108; midi += 1) {
      names.push(`${spelling[midi % 12]}${Math.floor(midi / 12) - 1}`);
    }
    const midis = names.map(midiFromName);
    expect(midis.filter((midi) => midi === null)).toEqual([]);
    // Every one distinct, and 21 through 108 with no gaps.
    expect(new Set(midis).size).toBe(88);
    expect(Math.min(...(midis as number[]))).toBe(21);
    expect(Math.max(...(midis as number[]))).toBe(108);
  });
});

import { describe, expect, it } from "vitest";
import {
  correctOctaveJumps,
  pitchSegments,
  trackSegments,
  vocalRange
} from "../src/lib/pitch-track.js";
import type { SpectrogramColumn } from "../src/lib/spectrogram.js";

function track(values: (number | null)[], step = 0.05): SpectrogramColumn[] {
  return values.map((pitchHz, index) => ({
    time: index * step,
    db: new Float32Array(0),
    pitchHz
  }));
}

describe("pitch segments", () => {
  it("breaks on unvoiced columns instead of interpolating across them", () => {
    // Drawing one polyline through a breath renders the gap as a glissando
    // that the singer never sang.
    const segments = pitchSegments(track([220, 221, null, null, 330, 331]));
    expect(segments.length).toBe(2);
    expect(segments[0].map((column) => column.pitchHz)).toEqual([220, 221]);
    expect(segments[1].map((column) => column.pitchHz)).toEqual([330, 331]);
  });

  it("breaks on a time gap even when both sides are voiced", () => {
    const columns = track([220, 220]);
    columns.push({ time: 5, db: new Float32Array(0), pitchHz: 220 });
    columns.push({ time: 5.05, db: new Float32Array(0), pitchHz: 220 });
    expect(pitchSegments(columns, { maxGapSeconds: 0.2 }).length).toBe(2);
  });

  it("drops single-column specks that are noise, not notes", () => {
    expect(pitchSegments(track([null, 400, null, 220, 220, 220]))).toHaveLength(1);
  });

  it("returns nothing for a silent track", () => {
    expect(pitchSegments(track([null, null]))).toEqual([]);
  });
});

describe("octave correction", () => {
  it("pulls a halved frame back onto the line", () => {
    // YIN halving is the dominant voice artefact; drawn raw it shows as a
    // clean one-octave step that reads as a real leap.
    const corrected = correctOctaveJumps(track([220, 220, 110, 220, 220]));
    expect(corrected.map((column) => column.pitchHz)).toEqual([220, 220, 220, 220, 220]);
  });

  it("pulls a doubled frame back onto the line", () => {
    const corrected = correctOctaveJumps(track([220, 220, 440, 220, 220]));
    expect(corrected[2].pitchHz).toBe(220);
  });

  it("keeps a genuine octave leap that is sustained", () => {
    const corrected = correctOctaveJumps(track([220, 220, 440, 440, 440, 440]));
    expect(corrected.map((column) => column.pitchHz)).toEqual([220, 220, 440, 440, 440, 440]);
  });

  it("keeps ordinary melodic movement untouched", () => {
    const corrected = correctOctaveJumps(track([220, 247, 262, 294]));
    expect(corrected.map((column) => column.pitchHz)).toEqual([220, 247, 262, 294]);
  });

  it("leaves unvoiced columns unvoiced", () => {
    expect(correctOctaveJumps(track([220, null, 220]))[1].pitchHz).toBeNull();
  });
});

describe("vocal range", () => {
  it("is null without enough voiced material", () => {
    expect(vocalRange(track([null, 220, null]))).toBeNull();
  });

  it("reports the sustained extremes, ignoring onset scoops", () => {
    // One stray low frame at the attack must not widen the reported range.
    const values = [80, ...Array(40).fill(220), ...Array(40).fill(440)];
    const range = vocalRange(track(values));
    expect(range).not.toBeNull();
    expect(range!.lowest.name).toBe("A3");
    expect(range!.highest.name).toBe("A4");
    expect(range!.semitones).toBe(12);
  });

  it("counts the span in semitones inclusive of both ends", () => {
    const range = vocalRange(track(Array(40).fill(440)))!;
    expect(range.semitones).toBe(0);
    expect(range.lowest.name).toBe("A4");
  });
});

describe("track segments (what a view actually draws)", () => {
  it("corrects octave artefacts before segmenting, in one call", () => {
    // The two rules always apply together: a view that segments without
    // correcting draws a clean octave step that never happened.
    const segments = trackSegments(track([220, 220, 110, 220, 220]));
    expect(segments).toHaveLength(1);
    expect(segments[0].map((column) => column.pitchHz)).toEqual([220, 220, 220, 220, 220]);
  });

  it("still breaks on silence", () => {
    expect(trackSegments(track([220, 220, null, null, 330, 331]))).toHaveLength(2);
  });

  it("leaves the source columns untouched", () => {
    const columns = track([220, 220, 110, 220]);
    trackSegments(columns);
    expect(columns[2].pitchHz).toBe(110);
  });
});

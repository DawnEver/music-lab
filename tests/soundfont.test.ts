import { describe, expect, it } from "vitest";
import {
  MAX_RESAMPLE_SEMITONES,
  channelsAgree,
  louderChannel,
  loudnessGain,
  midiFromName,
  withinReach
} from "../src/audio/soundfont.js";

/** A buffer of `seconds`, filled by `sample`. */
function bufferOf(seconds: number, sample: (index: number) => number) {
  const rate = 48000;
  const data = new Float32Array(Math.round(seconds * rate));
  for (let index = 0; index < data.length; index += 1) data[index] = sample(index);
  return { sampleRate: rate, length: data.length, getChannelData: () => data } as unknown as AudioBuffer;
}

/*
 * A bank is whatever level somebody encoded it at, and a model is
 * calibrated to a loudness. The hybrid tier plays both at once, so a
 * fifteen decibel gap between them is not a mixing preference — it is an
 * attack layer nobody can hear.
 */
describe("matching a recording to a model's level", () => {
  it("brings a quiet recording up and a loud one down", () => {
    const quiet = loudnessGain(bufferOf(3, (i) => (i % 2 ? 0.008 : -0.008)));
    const loud = loudnessGain(bufferOf(3, (i) => (i % 2 ? 0.5 : -0.5)));
    expect(quiet).toBeGreaterThan(1);
    expect(loud).toBeLessThan(1);
    // Both land on the same loudness.
    expect(0.008 * quiet).toBeCloseTo(0.16, 1);
    expect(0.5 * loud).toBeCloseTo(0.16, 1);
  });

  /*
   * A bank has holes in it, and the closest note to what was asked for
   * can be one of them. FluidR3's contrabass has a C4 that is three
   * seconds of nothing, and taking it would make the double bass a
   * recording down low and a model at middle C — one instrument changing
   * voice at a pitch.
   */
  it("skips a note the bank cannot play, rather than giving up", () => {
    const silent = bufferOf(3, () => 0);
    const good = bufferOf(3, (i) => (i % 2 ? 0.2 : -0.2));
    expect(loudnessGain(silent)).toBe(0);
    expect(loudnessGain(good)).toBeGreaterThan(0);
  });

  it("calls silence what it is rather than scaling it up", () => {
    // FluidR3's contrabass has a C4 that is three seconds of nothing: the
    // note is outside the instrument. A gain would make it louder silence;
    // zero is what tells the caller to use the model instead.
    expect(loudnessGain(bufferOf(3, () => 0))).toBe(0);
    expect(loudnessGain(bufferOf(3, () => 1e-6))).toBe(0);
  });
});

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

/*
 * How far a recording may be stretched before it stops being a recording
 * of the instrument.
 *
 * The ends of a bank are where this is decided, and the double bass is the
 * instrument that shows why: its samples stop where the instrument does,
 * so asking it for a note above that range used to be answered by playing
 * its highest sample several octaves up — which is not a double bass at
 * any speed, and with the old rate it was a wrong pitch as well. Three
 * semitones flat is what the playback-rate clamp makes of a stretch that
 * wanted four and three quarters.
 */
describe("how far a recording may be stretched", () => {
  it("accepts a bank sampled in minor thirds", () => {
    expect(withinReach(0)).toBe(true);
    expect(withinReach(1.5)).toBe(true);
    expect(withinReach(-3)).toBe(true);
  });

  it("refuses a stretch that is a different instrument", () => {
    expect(withinReach(12)).toBe(true);
    expect(withinReach(15)).toBe(false);
    expect(withinReach(-27)).toBe(false);
    expect(MAX_RESAMPLE_SEMITONES).toBe(12);
  });
});

/*
 * A stereo pair that is not two channels of the same signal.
 *
 * The grand piano's channels correlate at 0.04 across the bank and are
 * negative on thirty-six of its eighty-eight notes; the electric piano and
 * the organ correlate at 1.00. That difference is invisible on headphones
 * and decisive on a phone, which sums the two channels in one speaker: the
 * sum of two signals that disagree is a comb, and it takes the fundamental
 * with it — up to ten decibels of it in the top octave.
 */
describe("a bank whose channels disagree", () => {
  const tone = (n: number, phase = 0) =>
    Float32Array.from({ length: n }, (_, i) => Math.sin((i / 8) * Math.PI * 2 + phase));

  it("accepts a pair that is one signal stored twice", () => {
    const signal = tone(512);
    expect(channelsAgree(signal, signal)).toBe(true);
    expect(channelsAgree(signal, Float32Array.from(signal, (v) => v))).toBe(true);
  });

  it("rejects a pair that is a stereo effect", () => {
    // Inverted, and delayed: the two shapes a widening effect takes.
    expect(channelsAgree(tone(512), tone(512, Math.PI))).toBe(false);
    expect(channelsAgree(tone(512), tone(512).slice(0).map((_, i) => Math.sin(((i - 30) / 8) * Math.PI * 2)))).toBe(false);
  });

  it("keeps the louder of the two", () => {
    const quiet = tone(512);
    const loud = Float32Array.from(quiet, (v) => v * 3);
    expect(louderChannel(quiet, loud)).toBe(1);
    expect(louderChannel(loud, quiet)).toBe(0);
  });
});

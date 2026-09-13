import { describe, expect, it } from "vitest";
import { TIMBRES, getTimbre, timbreSpec, DEFAULT_TIMBRE_ID } from "../src/audio/timbre.js";
import { renderVoice } from "../src/audio/render.js";
import { midiToFrequency } from "../src/lib/music-theory.js";
import { detectPitchYin } from "../src/lib/pitch-detection.js";

/**
 * A context that can make a buffer and nothing else. The channel has to be
 * the same array every time it is asked for: a fresh one per call means
 * whatever the renderer wrote is thrown away on the next read, and every
 * voice then measures as silence.
 */
const audioContext = {
  sampleRate: 48000,
  createBuffer: (_channels: number, length: number) => {
    const channel = new Float32Array(length);
    return { duration: length / 48000, getChannelData: () => channel };
  }
} as unknown as BaseAudioContext;

describe("timbre registry", () => {
  it("has unique ids and a valid default", () => {
    const ids = TIMBRES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_TIMBRE_ID);
  });

  it("falls back to the default for an unknown id", () => {
    expect(getTimbre("nope").id).toBe(DEFAULT_TIMBRE_ID);
  });

  it("every timbre keeps its levels in range", () => {
    for (const entry of TIMBRES) {
      expect(entry.gain, entry.id).toBeGreaterThan(0);
      expect(entry.gain, entry.id).toBeLessThanOrEqual(1);
      if (entry.sustain !== undefined) {
        expect(entry.sustain, entry.id).toBeGreaterThan(0);
        expect(entry.sustain, entry.id).toBeLessThanOrEqual(1);
      }
      for (const relative of entry.partials ?? []) {
        expect(relative, entry.id).toBeGreaterThanOrEqual(0);
        expect(relative, entry.id).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("timbreSpec", () => {
  it("puts the note at its tuned frequency", () => {
    const spec = timbreSpec(getTimbre("singable"), 69, 0.5, 442);
    expect(spec.frequency).toBeCloseTo(midiToFrequency(69, 442), 6);
    expect(spec.duration).toBe(0.5);
  });

  it("reproduces the ear trainer's original singable tone", () => {
    const spec = timbreSpec(getTimbre("singable"), 60, 0.4);
    expect(spec.waveform).toBe("sine");
    expect(spec.gain).toBeCloseTo(0.32, 6);
    expect(spec.attack).toBeCloseTo(0.02, 6);
    expect(spec.partials).toEqual([0.34, 0.16, 0.07]);
  });
});

describe("the keyboard family", () => {
  it("gives every instrument its own voice", () => {
    const ids = TIMBRES.map((entry) => entry.id);
    for (const id of ["piano", "epiano", "organ"]) expect(ids, "keys").toContain(id);
    // One apiece. Eight instruments sharing two voices is what "the
    // timbres are wrong" sounds like when a banjo and a guitar are
    // supposed to be different instruments.
    for (const id of ["guitar", "mandolin", "banjo", "ukulele", "pipa", "ruan", "liuqin", "guzheng", "guqin", "bass"]) {
      expect(ids, "plucked").toContain(id);
    }
    for (const id of ["violin", "viola", "cello", "contrabass", "erhu", "zhonghu", "gaohu"]) {
      expect(ids, "bowed").toContain(id);
    }
    for (const id of ["dizi", "xiao", "saxophone", "harmonica"]) expect(ids, "winds").toContain(id);
    for (const id of ["kalimba"]) expect(ids, "other").toContain(id);
    for (const id of ["kick", "snare", "hihat", "tom", "crash", "ride"]) {
      expect(ids, "percussion").toContain(id);
    }
  });

  it("makes percussion out of noise and pitch drop, not out of notes", () => {
    // A membrane's pitch falls as it stops moving; hold it and a kick is a
    // low beep. Metal is noise in a band, which needs no glide at all.
    expect(getTimbre("kick").glide).toBeLessThan(1);
    expect(getTimbre("tom").glide).toBeLessThan(1);
    expect(getTimbre("snare").waveform).toBe("noise");
    expect(getTimbre("hihat").waveform).toBe("noise");
    // Closed and open hi-hat are the same metal; only the ring differs.
    expect(getTimbre("hihatOpen").ring!).toBeGreaterThan(getTimbre("hihat").ring!);
  });

  it("makes struck voices decay and the organ hold", () => {
    // A pluck has no sustain level: the note dies whether or not you let go.
    expect(getTimbre("piano").sustain).toBeUndefined();
    expect(getTimbre("epiano").sustain).toBeUndefined();
    expect(getTimbre("steel").sustain).toBeUndefined();
    expect(getTimbre("bass").sustain).toBeUndefined();
    expect(getTimbre("organ").sustain).toBeGreaterThan(0.5);
  });

  it("rings longer than it takes to hear the attack", () => {
    for (const entry of TIMBRES) {
      expect(entry.ring, entry.id).toBeGreaterThan(entry.attack ?? 0);
    }
  });

  it("keeps a filter cutoff above the fundamental at every pitch", () => {
    for (const entry of TIMBRES) {
      if (!entry.filter) continue;
      expect(entry.filter.harmonic, entry.id).toBeGreaterThan(1);
      // The sweep opens the filter, never closes it below its resting point.
      expect(entry.filter.envelope ?? 1, entry.id).toBeGreaterThanOrEqual(1);
    }
  });

  /*
   * The bar that caught what nothing else did.
   *
   * A model can be perfectly in tune, at the right level, with the right
   * spectrum, and still be unhearable — too much noise on top of the note
   * and the app's own detector cannot find it. That is a tuner that cannot
   * hear the instrument, and it is not visible in a spectrum plot, a level
   * measurement or a pitch check on a clean render. It caught both the
   * harmonica and the xiao, which were breathier than the threshold YIN
   * will accept.
   */
  it("gives every modelled voice a note the app's own detector can hear", () => {
    const hz = midiToFrequency(60, 440);
    for (const timbre of TIMBRES) {
      if (!timbre.model || timbre.model.kind === "drum") continue;
      const data = renderVoice(audioContext, timbre.model, `probe:${timbre.id}`, 60, hz).getChannelData(0);

      // It has to be findable at all. This is the half that caught the
      // harmonica and the xiao, both of which were audible to a listener
      // and invisible to a detector.
      const heard = detectPitchYin(data.subarray(4800, 4800 + 4096), 48000, -120, {
        minHz: 55,
        maxHz: 1400
      });
      expect(heard.pitch, `${timbre.id} is inaudible to the tuner`).not.toBeNull();

      // And that it is roughly where it was asked to be. The tolerance is
      // loose on purpose twice over: a tine is *meant* to be inharmonic, so
      // a detector reading a deliberately stretched spectrum reports the
      // stretch as mistuning; and a stopped pipe's fundamental is weaker
      // than its third harmonic, which makes a spectral peak search
      // unreliable in exactly the case that needs it most. Tuning itself is
      // pinned per model in `voice-model.test.ts`, to within eight cents
      // for a string and ten for a wind.
      const cents = 1200 * Math.log2(heard.pitch!.frequency / hz);
      expect(Math.abs(cents), `${timbre.id} is ${cents.toFixed(1)} cents out`).toBeLessThan(50);
    }
  });

  it("scales the filter with the note, so the bass is not dull", () => {
    const low = timbreSpec(getTimbre("piano"), 36, 1);
    const high = timbreSpec(getTimbre("piano"), 84, 1);
    expect(high.filter!.frequency / low.filter!.frequency).toBeCloseTo(16, 3);
  });

  it("keeps every voice's total level under one, so nothing clips", () => {
    for (const entry of TIMBRES) {
      const total = entry.gain * (1 + (entry.partials ?? []).reduce((sum, p) => sum + p, 0));
      expect(total, entry.id).toBeLessThanOrEqual(1);
    }
  });
});

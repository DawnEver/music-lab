import { describe, expect, it } from "vitest";
import {
  allInstruments,
  getInstrument,
  getPreset,
  nearestString,
  nearestPosition,
  stringStatus,
  buildHarmonicaCells
} from "../src/instruments/index.js";
import { harmonica, HARMONICA_LAYOUT } from "../src/instruments/harmonica.js";
import { midiToFrequency, frequencyToMidi } from "../src/lib/music-theory.js";

describe("registry", () => {
  it("has unique ids and valid default presets", () => {
    const ids = allInstruments.map((instrument) => instrument.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const instrument of allInstruments) {
      const presetIds = instrument.presets.map((preset) => preset.id);
      expect(new Set(presetIds).size).toBe(presetIds.length);
      expect(presetIds).toContain(instrument.defaultPresetId);
      if (instrument.presets[0].noteLabels) {
        expect(instrument.presets[0].noteLabels!.length).toBe(instrument.presets[0].notes.length);
      }
    }
  });

  it("every note of every preset sits inside its instrument range", () => {
    for (const instrument of allInstruments) {
      for (const preset of instrument.presets) {
        for (const midi of preset.notes) {
          const hz = midiToFrequency(midi);
          expect(hz).toBeGreaterThanOrEqual(instrument.range.minHz);
          expect(hz).toBeLessThanOrEqual(instrument.range.maxHz);
          expect(midi).toBeGreaterThanOrEqual(instrument.range.minMidi);
          expect(midi).toBeLessThanOrEqual(instrument.range.maxMidi);
        }
      }
    }
  });
});

describe("guitar", () => {
  const guitar = getInstrument("guitar")!;

  it("standard tuning is E2 A2 D3 G3 B3 E4", () => {
    expect(getPreset(guitar, "standard").notes).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it("Drop D lowers only the 6th string", () => {
    expect(getPreset(guitar, "dropD").notes).toEqual([38, 45, 50, 55, 59, 64]);
  });
});

describe("guzheng", () => {
  const guzheng = getInstrument("guzheng")!;

  it("D 调 has 21 strings D2..D6 pentatonic (ascending)", () => {
    const notes = getPreset(guzheng, "dTune").notes;
    expect(notes).toHaveLength(21);
    expect(notes).toEqual([38, 40, 42, 45, 47, 50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86]);
    expect(notes[0]).toBe(38); // 21弦 D2
    expect(notes[20]).toBe(86); // 1弦 D6
  });

  it("C 调 tops out at C6", () => {
    const notes = getPreset(guzheng, "cTune").notes;
    expect(notes).toHaveLength(21);
    expect(notes[20]).toBe(84);
    expect(notes[0]).toBe(36);
  });
});

describe("guqin", () => {
  const guqin = getInstrument("guqin")!;

  it("the five 调式 tables are exact", () => {
    expect(getPreset(guqin, "zheng").notes).toEqual([36, 38, 41, 43, 45, 48, 50]); // C2 D2 F2 G2 A2 C3 D3
    expect(getPreset(guqin, "man1").notes).toEqual([35, 38, 41, 43, 45, 48, 50]); // B1 …
    expect(getPreset(guqin, "man3").notes).toEqual([36, 38, 40, 43, 45, 48, 50]); // … E2 …
    expect(getPreset(guqin, "jin5").notes).toEqual([36, 38, 41, 43, 46, 48, 50]); // … B♭2 …
    expect(getPreset(guqin, "jin25").notes).toEqual([36, 39, 41, 43, 46, 48, 50]); // E♭2, B♭2
  });
});

describe("harmonica", () => {
  const keyCells = (keyId: string) => {
    const preset = getPreset(harmonica, keyId);
    const root = preset.notes[0] - HARMONICA_LAYOUT.blowOffsets[0];
    return buildHarmonicaCells(HARMONICA_LAYOUT, root);
  };

  it("C key blow/draw standard rows are exact", () => {
    const cells = keyCells("C");
    const blow = cells.filter((cell) => cell.breath === "blow");
    const draw = cells.filter((cell) => cell.breath === "draw");
    expect(blow.map((cell) => cell.positions[0].midi)).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96]);
    expect(draw.map((cell) => cell.positions[0].midi)).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93]);
  });

  it("G key transposes every note by −5", () => {
    const cells = keyCells("G");
    const blow = cells.filter((cell) => cell.breath === "blow");
    const draw = cells.filter((cell) => cell.breath === "draw");
    expect(blow.map((cell) => cell.positions[0].midi)).toEqual([55, 59, 62, 67, 71, 74, 79, 83, 86, 91]);
    expect(draw.map((cell) => cell.positions[0].midi)).toEqual([57, 62, 66, 69, 72, 76, 78, 81, 84, 88]);
  });

  it("bend/overblow/overdraw positions per hole are exact (C key)", () => {
    const cells = keyCells("C");
    const byKey = (hole: number, breath: "blow" | "draw") =>
      cells.find((cell) => cell.hole === hole && cell.breath === breath)!;

    expect(byKey(2, "draw").positions.map((p) => p.midi)).toEqual([67, 66, 65]); // G4 F♯4 F4
    expect(byKey(3, "draw").positions.map((p) => p.midi)).toEqual([71, 70, 69, 68]); // B4 B♭4 A4 G♯4
    expect(byKey(2, "blow").positions.map((p) => p.midi)).toEqual([64, 68]); // E4 + overblow A♭4 (draw G4 + 1)
    expect(byKey(8, "blow").positions.map((p) => p.midi)).toEqual([88, 87, 86]); // E6 E♭6 D6
    expect(byKey(8, "draw").positions.map((p) => p.midi)).toEqual([86, 85, 89]); // D6 C♯6 + overdraw F6 (blow E6 + 1)
    expect(byKey(1, "blow").positions.map((p) => p.midi)).toEqual([60, 63]); // C4 + overblow E♭4 (draw D4 + 1)

    expect(byKey(3, "draw").positions[3]).toMatchObject({ kind: "bend", bendLevel: 3 });
  });

  it("every overblow is the draw reed + 1 and every overdraw the blow reed + 1 (C key)", () => {
    const cells = keyCells("C");
    const overblows = cells
      .filter((cell) => cell.breath === "blow")
      .map((cell) => cell.positions.find((p) => p.kind === "overblow")?.midi ?? null);
    const overdraws = cells
      .filter((cell) => cell.breath === "draw")
      .map((cell) => cell.positions.find((p) => p.kind === "overdraw")?.midi ?? null);
    // holes 1-6 overblow: E♭4 A♭4 C5 E♭5 G♭5 B♭5
    expect(overblows).toEqual([63, 68, 72, 75, 78, 82, null, null, null, null]);
    // holes 7-10 overdraw: C♯6 F6 A♭6 C♯7
    expect(overdraws).toEqual([null, null, null, null, null, null, 85, 89, 92, 97]);
  });

  it("F4 on a C harp resolves to draw-hole-2 bend 2, not the overblow", () => {
    const result = nearestPosition(349.2282, keyCells("C")); // F4
    expect(result).toBeTruthy();
    expect(result!.hole).toBe(2);
    expect(result!.breath).toBe("draw");
    expect(result!.position.kind).toBe("bend");
    expect(result!.position.bendLevel).toBe(2);
    expect(Math.abs(result!.cents)).toBeLessThan(1);
  });

  it("12 keys × 20 cells × positions all sit inside the instrument range", () => {
    for (const preset of harmonica.presets) {
      const root = preset.notes[0];
      const cells = buildHarmonicaCells(HARMONICA_LAYOUT, root);
      expect(cells).toHaveLength(20);
      for (const cell of cells) {
        for (const position of cell.positions) {
          expect(position.midi).toBeGreaterThanOrEqual(harmonica.range.minMidi);
          expect(position.midi).toBeLessThanOrEqual(harmonica.range.maxMidi);
        }
      }
    }
  });
});

describe("nearestString / stringStatus", () => {
  it("maps 330 Hz to the guitar high E string", () => {
    const guitar = getInstrument("guitar")!;
    const result = nearestString(330, getPreset(guitar, "standard").notes);
    expect(result!.index).toBe(5);
    expect(result!.targetMidi).toBe(64); // E4
    expect(Math.abs(result!.cents - 1.94)).toBeLessThan(0.5);
  });

  it("maps 440 Hz to the nearest guitar string with a large sharp offset", () => {
    const guitar = getInstrument("guitar")!;
    const result = nearestString(440, getPreset(guitar, "standard").notes);
    expect(result!.targetMidi).toBe(64);
    expect(result!.cents).toBeGreaterThan(450); // ~+500 cents vs E4
  });

  it("status thresholds", () => {
    expect(stringStatus(0, true, 0.9)).toBe("in-tune");
    expect(stringStatus(-30, true, 0.9)).toBe("flat");
    expect(stringStatus(30, true, 0.9)).toBe("sharp");
    expect(stringStatus(30, false, 0.9)).toBe("idle");
    expect(stringStatus(0, true, 0.1)).toBe("idle");
  });

  it("frequencyToMidi round-trips through every instrument note", () => {
    for (const instrument of allInstruments) {
      for (const preset of instrument.presets) {
        for (const midi of preset.notes) {
          expect(Math.abs(frequencyToMidi(midiToFrequency(midi)) - midi)).toBeLessThan(1e-9);
        }
      }
    }
  });
});

describe("harmonica tuning variants", () => {
  const paddy = () => harmonica.harmonicaVariants!.find((variant) => variant.id === "paddy")!.harmonica;

  it("standard is the first variant and matches the instrument layout", () => {
    expect(harmonica.harmonicaVariants!.map((variant) => variant.id)).toEqual(["standard", "paddy"]);
    expect(harmonica.harmonicaVariants![0].harmonica).toBe(HARMONICA_LAYOUT);
    expect(harmonica.defaultVariantId).toBe("standard");
  });

  it("Paddy Richter raises hole 3 blow a whole tone, leaving every other note alone", () => {
    const cells = buildHarmonicaCells(paddy(), 60);
    const blow = cells.filter((cell) => cell.breath === "blow");
    const draw = cells.filter((cell) => cell.breath === "draw");
    expect(blow.map((cell) => cell.positions[0].midi)).toEqual([60, 64, 69, 72, 76, 79, 84, 88, 91, 96]);
    expect(draw.map((cell) => cell.positions[0].midi)).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93]);
  });

  it("Paddy hole 3 draw keeps only the half-step bend (the blow reed sits at A)", () => {
    const cells = buildHarmonicaCells(paddy(), 60);
    const byKey = (hole: number, breath: "blow" | "draw") =>
      cells.find((cell) => cell.hole === hole && cell.breath === breath)!;
    expect(byKey(3, "draw").positions.map((p) => p.midi)).toEqual([71, 70]); // B4 + half-step bend only
    expect(byKey(3, "blow").positions.map((p) => p.midi)).toEqual([69, 72]); // A4 + overblow C5 (draw B4 + 1)
    expect(byKey(2, "draw").positions.map((p) => p.midi)).toEqual([67, 66, 65]); // untouched
  });
});

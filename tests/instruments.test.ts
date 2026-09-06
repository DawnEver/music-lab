import { describe, expect, it } from "vitest";
import {
  allInstruments,
  getInstrument,
  getTunedInstrument,
  tunedInstruments,
  getPreset,
  nearestTarget,
  stringStatus,
  buildTargets,
  deriveRange,
  instrumentCategories,
  instrumentsByCategory
} from "../src/instruments/index.js";
import { harmonica } from "../src/instruments/harmonica.js";
import { TIMBRES } from "../src/audio/timbre.js";
import { midiToFrequency, frequencyToMidi } from "../src/lib/music-theory.js";

describe("registry", () => {
  it("has unique ids and valid default presets", () => {
    const ids = allInstruments.map((instrument) => instrument.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const instrument of tunedInstruments) {
      const presetIds = instrument.tuning.presets.map((preset) => preset.id);
      expect(new Set(presetIds).size).toBe(presetIds.length);
      expect(presetIds).toContain(instrument.tuning.defaultPresetId);
      if (instrument.tuning.presets[0].noteLabels) {
        expect(instrument.tuning.presets[0].noteLabels!.length).toBe(instrument.tuning.presets[0].notes.length);
      }
    }
  });

  it("the derived detector band covers every pitch the instrument can make", () => {
    for (const instrument of tunedInstruments) {
      const range = deriveRange(instrument);
      const variants = instrument.tuning.variants ?? [null];
      for (const preset of instrument.tuning.presets) {
        for (const variant of variants) {
          for (const target of buildTargets(instrument, preset, variant?.reeds)) {
            for (const position of target.positions) {
              expect(position.midi, `${instrument.id}/${preset.id}`).toBeGreaterThanOrEqual(range.minMidi);
              expect(position.midi, `${instrument.id}/${preset.id}`).toBeLessThanOrEqual(range.maxMidi);
              const hz = midiToFrequency(position.midi);
              expect(hz).toBeGreaterThanOrEqual(range.minHz);
              expect(hz).toBeLessThanOrEqual(range.maxHz);
            }
          }
        }
      }
      // The band is snug: no more than an octave of slack either side.
      expect(range.maxMidi - range.minMidi).toBeLessThan(60);
    }
  });

  it("every preset labels every note, and every instrument sits in a picker group", () => {
    for (const instrument of tunedInstruments) {
      expect(instrumentCategories).toContain(instrument.category);
      for (const preset of instrument.tuning.presets) {
        expect(preset.notes.length).toBeGreaterThan(0);
        if (preset.noteLabels) expect(preset.noteLabels.length).toBe(preset.notes.length);
      }
      if (instrument.tuning.layout === "grid") expect(instrument.tuning.reeds).toBeTruthy();
    }
    // The grouped picker shows each instrument exactly once.
    const grouped = instrumentCategories.flatMap((category) => instrumentsByCategory(category));
    expect(grouped.map((instrument) => instrument.id).sort()).toEqual(
      allInstruments.map((instrument) => instrument.id).sort()
    );
  });
});

describe("capabilities", () => {
  it("every instrument declares at least one thing it can do", () => {
    for (const instrument of allInstruments) {
      const capable = Boolean(instrument.tuning || instrument.surface);
      expect(capable, `${instrument.id} does nothing`).toBe(true);
    }
  });

  it("the tuner list is exactly the instruments that can be tuned", () => {
    expect(tunedInstruments.map((entry) => entry.id)).toEqual(
      allInstruments.filter((entry) => entry.tuning).map((entry) => entry.id)
    );
    for (const instrument of tunedInstruments) {
      expect(getTunedInstrument(instrument.id)).toBe(instrument);
    }
  });

  it("names a voice per instrument when pitched, per piece when not", () => {
    const ids = TIMBRES.map((entry) => entry.id);
    for (const instrument of allInstruments) {
      const surface = instrument.surface;
      if (!surface) continue;
      if (surface.kind === "pads") {
        // A kit's instrument-level timbre would have nothing to name.
        expect(instrument.timbre, `${instrument.id} should not claim one voice`).toBeUndefined();
        expect(surface.pieces.length).toBeGreaterThan(0);
        continue;
      }
      expect(instrument.timbre, `${instrument.id} has a surface but no timbre`).toBeTruthy();
      expect(ids).toContain(instrument.timbre);
    }
  });
});

describe("added instruments (tunings are locked data)", () => {
  const notes = (id: string, presetId: string) => getPreset(getTunedInstrument(id)!, presetId).notes;

  it("bowed family runs in fifths, the double bass in fourths", () => {
    expect(notes("violin", "standard")).toEqual([55, 62, 69, 76]); // G3 D4 A4 E5
    expect(notes("viola", "standard")).toEqual([48, 55, 62, 69]); //  C3 G3 D4 A4
    expect(notes("cello", "standard")).toEqual([36, 43, 50, 57]); //  C2 G2 D3 A3
    expect(notes("double-bass", "standard4")).toEqual([28, 33, 38, 43]); // E1 A1 D2 G2
    expect(notes("double-bass", "standard5")).toEqual([23, 28, 33, 38, 43]); // + B0
    expect(notes("double-bass", "lowC")).toEqual([24, 33, 38, 43]); // C1 extension
  });

  it("huqin family: erhu, zhonghu a fifth below, gaohu a fourth above", () => {
    expect(notes("erhu", "standard")).toEqual([62, 69]); //    D4 A4
    expect(notes("zhonghu", "standard")).toEqual([55, 62]); // G3 D4
    expect(notes("gaohu", "standard")).toEqual([67, 74]); //   G4 D5
    expect(notes("gaohu", "cantonese")).toEqual([69, 76]); //  A4 E5
  });

  it("mandolin matches the violin; the banjo 5th string is re-entrant", () => {
    expect(notes("mandolin", "standard")).toEqual([55, 62, 69, 76]);
    const openG = notes("banjo", "openG"); // g4 D3 G3 B3 D4
    expect(openG).toEqual([67, 50, 55, 59, 62]);
    expect(openG[0]).toBeGreaterThan(openG[1]); // the drone sits above the 4th
    expect(notes("banjo", "doubleC")).toEqual([67, 48, 55, 60, 64]);
    expect(notes("banjo", "openD")).toEqual([69, 50, 57, 62, 66]);
  });

  it("Chinese plucked strings", () => {
    expect(notes("pipa", "standard")).toEqual([45, 50, 52, 57]); // A2 D3 E3 A3
    expect(notes("ruan", "zhong")).toEqual([43, 50, 55, 62]); //    G2 D3 G3 D4
    expect(notes("ruan", "da")).toEqual([36, 43, 48, 55]); //       C2 G2 C3 G3
    expect(notes("ruan", "xiao")).toEqual([55, 62, 67, 74]); //     G3 D4 G4 D5
    expect(notes("liuqin", "standard")).toEqual([55, 62, 67, 74]);
  });

  it("guitar 7-string adds a low B, the baritone ukulele is DGBE", () => {
    expect(notes("guitar", "sevenString")).toEqual([35, 40, 45, 50, 55, 59, 64]);
    expect(notes("ukulele", "baritone")).toEqual([50, 55, 59, 64]);
  });

  it("the 17-key kalimba alternates outward from the centre C4 tine", () => {
    const tines = notes("kalimba", "c17");
    expect(tines).toHaveLength(17);
    expect(tines[8]).toBe(60); // centre tine C4
    // Sorted by pitch it is a plain C major scale from C4 up to E6.
    expect([...tines].sort((a, b) => a - b)).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88
    ]);
    // The scale alternates outward from the centre: pitch falls to the
    // centre tine from the left and rises from it to the right.
    for (let i = 1; i <= 8; i += 1) expect(tines[i]).toBeLessThan(tines[i - 1]);
    for (let i = 9; i < tines.length; i += 1) expect(tines[i]).toBeGreaterThan(tines[i - 1]);
  });
});

describe("guitar", () => {
  const guitar = getTunedInstrument("guitar")!;

  it("standard tuning is E2 A2 D3 G3 B3 E4", () => {
    expect(getPreset(guitar, "standard").notes).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it("Drop D lowers only the 6th string", () => {
    expect(getPreset(guitar, "dropD").notes).toEqual([38, 45, 50, 55, 59, 64]);
  });
});

describe("guzheng", () => {
  const guzheng = getTunedInstrument("guzheng")!;

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
  const guqin = getTunedInstrument("guqin")!;

  it("the five 调式 tables are exact", () => {
    expect(getPreset(guqin, "zheng").notes).toEqual([36, 38, 41, 43, 45, 48, 50]); // C2 D2 F2 G2 A2 C3 D3
    expect(getPreset(guqin, "man1").notes).toEqual([35, 38, 41, 43, 45, 48, 50]); // B1 …
    expect(getPreset(guqin, "man3").notes).toEqual([36, 38, 40, 43, 45, 48, 50]); // … E2 …
    expect(getPreset(guqin, "jin5").notes).toEqual([36, 38, 41, 43, 46, 48, 50]); // … B♭2 …
    expect(getPreset(guqin, "jin25").notes).toEqual([36, 39, 41, 43, 46, 48, 50]); // E♭2, B♭2
  });
});

describe("harmonica", () => {
  const keyCells = (keyId: string) => buildTargets(harmonica, getPreset(harmonica, keyId));
  const column = (targets: ReturnType<typeof keyCells>, name: string) =>
    targets.filter((target) => target.slot?.column === name);

  it("C key blow/draw standard rows are exact", () => {
    const cells = keyCells("C");
    const blow = column(cells, "blow");
    const draw = column(cells, "draw");
    expect(blow.map((target) => target.positions[0].midi)).toEqual([60, 64, 67, 72, 76, 79, 84, 88, 91, 96]);
    expect(draw.map((target) => target.positions[0].midi)).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93]);
  });

  it("G key transposes every note by −5", () => {
    const cells = keyCells("G");
    const blow = column(cells, "blow");
    const draw = column(cells, "draw");
    expect(blow.map((target) => target.positions[0].midi)).toEqual([55, 59, 62, 67, 71, 74, 79, 83, 86, 91]);
    expect(draw.map((target) => target.positions[0].midi)).toEqual([57, 62, 66, 69, 72, 76, 78, 81, 84, 88]);
  });

  it("bend/overblow/overdraw positions per hole are exact (C key)", () => {
    const cells = keyCells("C");
    const byKey = (hole: number, breath: "blow" | "draw") =>
      cells.find((target) => target.slot?.row === hole && target.slot?.column === breath)!;

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
    const overblows = column(cells, "blow").map(
      (target) => target.positions.find((p) => p.kind === "overblow")?.midi ?? null
    );
    const overdraws = column(cells, "draw").map(
      (target) => target.positions.find((p) => p.kind === "overdraw")?.midi ?? null
    );
    // holes 1-6 overblow: E♭4 A♭4 C5 E♭5 G♭5 B♭5
    expect(overblows).toEqual([63, 68, 72, 75, 78, 82, null, null, null, null]);
    // holes 7-10 overdraw: C♯6 F6 A♭6 C♯7
    expect(overdraws).toEqual([null, null, null, null, null, null, 85, 89, 92, 97]);
  });

  it("F4 on a C harp resolves to draw-hole-2 bend 2, not the overblow", () => {
    const result = nearestTarget(349.2282, keyCells("C")); // F4
    expect(result).toBeTruthy();
    expect(result!.target.slot).toEqual({ row: 2, column: "draw" });
    expect(result!.position.kind).toBe("bend");
    expect(result!.position.bendLevel).toBe(2);
    expect(Math.abs(result!.cents)).toBeLessThan(1);
  });

  it("every key builds 20 targets (10 holes × blow/draw)", () => {
    for (const preset of harmonica.tuning.presets) {
      const targets = buildTargets(harmonica, preset);
      expect(targets).toHaveLength(20);
      expect(new Set(targets.map((target) => target.id)).size).toBe(20);
    }
  });
});

describe("nearestTarget / stringStatus", () => {
  const guitarTargets = () => {
    const guitar = getTunedInstrument("guitar")!;
    return buildTargets(guitar, getPreset(guitar, "standard"));
  };

  it("maps 330 Hz to the guitar high E string", () => {
    const result = nearestTarget(330, guitarTargets());
    expect(result!.targetIndex).toBe(5);
    expect(result!.position.midi).toBe(64); // E4
    expect(Math.abs(result!.cents - 1.94)).toBeLessThan(0.5);
  });

  it("maps 440 Hz to the nearest guitar string with a large sharp offset", () => {
    const result = nearestTarget(440, guitarTargets());
    expect(result!.position.midi).toBe(64);
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
    for (const instrument of tunedInstruments) {
      for (const preset of instrument.tuning.presets) {
        for (const midi of preset.notes) {
          expect(Math.abs(frequencyToMidi(midiToFrequency(midi)) - midi)).toBeLessThan(1e-9);
        }
      }
    }
  });
});

describe("harmonica tuning variants", () => {
  const paddyPreset = () => getPreset(harmonica, "C");
  const paddyTargets = () =>
    buildTargets(harmonica, paddyPreset(), harmonica.tuning.variants!.find((variant) => variant.id === "paddy")!.reeds);
  const column = (targets: ReturnType<typeof paddyTargets>, name: string) =>
    targets.filter((target) => target.slot?.column === name);

  it("standard is the first variant and matches the instrument layout", () => {
    expect(harmonica.tuning.variants!.map((variant) => variant.id)).toEqual(["standard", "paddy"]);
    expect(harmonica.tuning.variants![0].reeds).toBe(harmonica.tuning.reeds);
    expect(harmonica.tuning.defaultVariantId).toBe("standard");
  });

  it("Paddy Richter raises hole 3 blow a whole tone, leaving every other note alone", () => {
    const cells = paddyTargets();
    const blow = column(cells, "blow");
    const draw = column(cells, "draw");
    expect(blow.map((target) => target.positions[0].midi)).toEqual([60, 64, 69, 72, 76, 79, 84, 88, 91, 96]);
    expect(draw.map((target) => target.positions[0].midi)).toEqual([62, 67, 71, 74, 77, 81, 83, 86, 89, 93]);
  });

  it("Paddy hole 3 draw keeps only the half-step bend (the blow reed sits at A)", () => {
    const cells = paddyTargets();
    const byKey = (hole: number, breath: "blow" | "draw") =>
      cells.find((target) => target.slot?.row === hole && target.slot?.column === breath)!;
    expect(byKey(3, "draw").positions.map((p) => p.midi)).toEqual([71, 70]); // B4 + half-step bend only
    expect(byKey(3, "blow").positions.map((p) => p.midi)).toEqual([69, 72]); // A4 + overblow C5 (draw B4 + 1)
    expect(byKey(2, "draw").positions.map((p) => p.midi)).toEqual([67, 66, 65]); // untouched
  });
});

describe("wind instruments (fingering charts)", () => {
  const targetsOf = (id: string, presetId: string) => {
    const instrument = getTunedInstrument(id)!;
    return buildTargets(instrument, getPreset(instrument, presetId));
  };
  const closed = (target: { fingering?: { holes: string[] } }) =>
    target.fingering!.holes.filter((hole) => hole === "closed").length;

  it("a six-hole flute walks the scale by lifting fingers from the bottom", () => {
    const targets = targetsOf("dizi", "D");
    // 筒音作5: every hole closed sounds sol (A4 on a D dizi), and each
    // further open hole steps up the scale.
    expect(targets.slice(0, 7).map((target) => target.positions[0].midi)).toEqual([
      69, 71, 73, 74, 76, 78, 80
    ]);
    expect(targets.slice(0, 7).map(closed)).toEqual([6, 5, 4, 3, 2, 1, 0]);
    expect(targets[0].fingering!.holes).toEqual(
      ["closed", "closed", "closed", "closed", "closed", "closed"]
    );
    expect(targets[1].fingering!.holes[5]).toBe("open"); // the bottom hole lifts first
  });

  it("the upper octave repeats the fingerings, overblown", () => {
    const targets = targetsOf("dizi", "D");
    expect(targets).toHaveLength(14);
    for (let index = 0; index < 7; index += 1) {
      const low = targets[index];
      const high = targets[index + 7];
      expect(high.positions[0].midi - low.positions[0].midi).toBe(12);
      expect(high.fingering!.holes).toEqual(low.fingering!.holes);
      expect(high.fingering!.keys).toEqual(["overblow"]);
      expect(low.fingering!.keys).toBeUndefined();
    }
  });

  it("a key is one number: the pitch of 筒音", () => {
    const bottomOf = (presetId: string) => targetsOf("dizi", presetId)[0].positions[0].midi;
    expect(bottomOf("C")).toBe(67); // G4
    expect(bottomOf("D")).toBe(69); // A4
    expect(bottomOf("G")).toBe(74); // D5
    // The xiao is fingered identically, an octave below.
    expect(targetsOf("xiao", "G")[0].positions[0].midi).toBe(62); // D4
    expect(targetsOf("xiao", "G")[0].fingering!.holes).toEqual(targetsOf("dizi", "D")[0].fingering!.holes);
  });

  it("the saxophone targets sounding pitch and labels the written note", () => {
    const alto = targetsOf("saxophone", "alto");
    const tenor = targetsOf("saxophone", "tenor");

    // Written D4 sounds F3 on an alto (a major sixth down) and C3 on a
    // tenor (a major ninth down); both read "D4" on the page.
    expect(alto[0].label.en).toBe("D4");
    expect(alto[0].positions[0].midi).toBe(53);
    expect(tenor[0].label.en).toBe("D4");
    expect(tenor[0].positions[0].midi).toBe(48);

    // Same fingering, whatever the size.
    expect(alto[0].fingering!.holes).toEqual(tenor[0].fingering!.holes);
    // C5 is the second finger alone, not a lifted stack.
    const c5 = alto.find((target) => target.label.en === "C5")!;
    expect(c5.fingering!.holes).toEqual(["open", "closed", "open", "open", "open", "open"]);
    // The upper octave adds the octave key.
    expect(alto.find((target) => target.label.en === "D5")!.fingering!.keys).toEqual(["octave"]);
  });

  it("every wind instrument declares its hole geometry and fingers every note", () => {
    for (const instrument of tunedInstruments.filter((entry) => entry.tuning.layout === "fingering")) {
      expect(instrument.tuning.wind, instrument.id).toBeTruthy();
      for (const preset of instrument.tuning.presets) {
        expect(preset.fingerings?.length, `${instrument.id}/${preset.id}`).toBe(preset.notes.length);
        for (const fingering of preset.fingerings!) {
          expect(fingering.holes).toHaveLength(instrument.tuning.wind!.holeCount);
        }
      }
    }
  });
});

describe("the drum kit", () => {
  const kit = getInstrument("drums")!;

  it("has a surface but no tuning — it is what the split was for", () => {
    expect(kit.surface).toBeTruthy();
    expect(kit.tuning).toBeUndefined();
    expect(tunedInstruments.map((entry) => entry.id)).not.toContain("drums");
  });

  it("names no instrument-level voice, because every piece has its own", () => {
    expect(kit.timbre).toBeUndefined();
    const surface = kit.surface!;
    expect(surface.kind).toBe("pads");
    if (surface.kind !== "pads") return;
    for (const piece of surface.pieces) {
      expect(TIMBRES.map((entry) => entry.id), piece.id).toContain(piece.timbre);
      expect(piece.tone, piece.id).toBeGreaterThan(20);
    }
  });

  it("gives every piece its own pad and its own key", () => {
    const surface = kit.surface!;
    if (surface.kind !== "pads") throw new Error("expected pads");
    const slots = surface.pieces.map((piece) => `${piece.row}:${piece.column}`);
    expect(new Set(slots).size).toBe(slots.length);
    const codes = surface.pieces.map((piece) => piece.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("chokes the two hi-hats against each other and nothing else", () => {
    const surface = kit.surface!;
    if (surface.kind !== "pads") throw new Error("expected pads");
    const choked = surface.pieces.filter((piece) => piece.choke);
    expect(choked.map((piece) => piece.id).sort()).toEqual(["hihatClosed", "hihatOpen"]);
    expect(new Set(choked.map((piece) => piece.choke)).size).toBe(1);
  });
});

describe("playable winds", () => {
  const winds = allInstruments.filter((entry) => entry.surface?.kind === "holes");

  it("covers the flutes and the reed", () => {
    expect(winds.map((entry) => entry.id).sort()).toEqual(["dizi", "saxophone", "xiao"]);
  });

  it("can be played only because it is also tuned — the chart is its data", () => {
    for (const instrument of winds) {
      expect(instrument.tuning, instrument.id).toBeTruthy();
      expect(instrument.tuning!.wind, instrument.id).toBeTruthy();
      for (const preset of instrument.tuning!.presets) {
        expect(preset.fingerings?.length, `${instrument.id}/${preset.id}`).toBe(preset.notes.length);
      }
    }
  });

  it("blows with a breathy, sustaining voice — a wind that decays is a pluck", () => {
    for (const instrument of winds) {
      const voice = TIMBRES.find((entry) => entry.id === instrument.timbre)!;
      expect(voice.sustain, instrument.id).toBeGreaterThan(0);
      expect(voice.breath, instrument.id).toBeGreaterThan(0);
    }
  });
});

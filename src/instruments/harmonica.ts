import type { InstrumentDefinition, HarmonicaLayout, LayoutVariant, TuningPreset } from "./types.js";

/**
 * 10-hole diatonic blues harp, Richter tuning. The blow notes are the key
 * chord tones, the draw notes fill the scale; keys transpose the whole
 * layout. Standard keys G..F♯ (roots midi 55..66) — G is the lowest
 * standard key, F♯ the highest.
 *
 * Blow offsets  (C key):  C4 E4 G4 C5 E5 G5 C6 E6 G6 C7
 * Draw offsets  (C key):  D4 G4 B4 D5 F5 A5 B5 D6 F6 A6
 */
const BLOW_OFFSETS = [0, 4, 7, 12, 16, 19, 24, 28, 31, 36];
const DRAW_OFFSETS = [2, 7, 11, 14, 17, 21, 23, 26, 29, 33];

/**
 * Bend depths per hole (semitones) — the classic Richter capability table:
 * 1 draw bends 1, 2/6/10 draw bend 2, 3 draw bends 3 (deep bend),
 * 7-10 blow bend 1 (hole 8 blows bend 2). Overblows work on blow holes
 * 1-6, overdraws on draw holes 7-10.
 */
const DRAW_BEND_DEPTH: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 1, 5: 1, 6: 2, 7: 1, 8: 1, 9: 1, 10: 2 };
const BLOW_BEND_DEPTH: Record<number, number> = { 7: 1, 8: 2, 9: 1, 10: 1 };

export const HARMONICA_LAYOUT: HarmonicaLayout = {
  holeCount: 10,
  blowOffsets: BLOW_OFFSETS,
  drawOffsets: DRAW_OFFSETS,
  drawBendDepth: DRAW_BEND_DEPTH,
  blowBendDepth: BLOW_BEND_DEPTH,
  overblowHoles: [1, 2, 3, 4, 5, 6],
  overdrawHoles: [7, 8, 9, 10]
};

/**
 * Paddy Richter: hole 3 blow is raised a whole tone (G -> A on a C harp),
 * putting the 6th of the key under the blow reed so Irish/folk melodies
 * need no bend. Everything else is Richter. The raised blow reed also
 * caps hole 3's draw bend at a half step (the bend can only reach down
 * toward the blow reed, now a whole tone higher), and hole 3 no longer
 * blow-bends.
 */
const PADDY_BLOW_OFFSETS = BLOW_OFFSETS.map((offset, index) => (index === 2 ? offset + 2 : offset));
const PADDY_DRAW_BEND_DEPTH: Record<number, number> = { ...DRAW_BEND_DEPTH, 3: 1 };

export const PADDY_LAYOUT: HarmonicaLayout = {
  ...HARMONICA_LAYOUT,
  blowOffsets: PADDY_BLOW_OFFSETS,
  drawBendDepth: PADDY_DRAW_BEND_DEPTH
};

export const HARMONICA_VARIANTS: LayoutVariant[] = [
  { id: "standard", name: { zh: "标准 Richter", en: "Standard Richter" }, reeds: HARMONICA_LAYOUT },
  { id: "paddy", name: { zh: "Paddy Richter", en: "Paddy Richter" }, reeds: PADDY_LAYOUT }
];

/** All 12 standard keys, root note = hole 1 blow (midi 55 G3 … 66 F♯4). */
const KEYS: Array<{ id: string; rootMidi: number }> = [
  { id: "C", rootMidi: 60 },
  { id: "C♯", rootMidi: 61 },
  { id: "D", rootMidi: 62 },
  { id: "E♭", rootMidi: 63 },
  { id: "E", rootMidi: 64 },
  { id: "F", rootMidi: 65 },
  { id: "F♯", rootMidi: 66 },
  { id: "G", rootMidi: 55 },
  { id: "A♭", rootMidi: 56 },
  { id: "A", rootMidi: 57 },
  { id: "B♭", rootMidi: 58 },
  { id: "B", rootMidi: 59 }
];

function makeKeyPreset(key: { id: string; rootMidi: number }): TuningPreset {
  return {
    id: key.id,
    name: { zh: `${key.id} 调`, en: `Key of ${key.id}` },
    // 10 blow notes followed by 10 draw notes; the panel derives the
    // hole/breath structure from HARMONICA_LAYOUT + root.
    notes: [
      ...BLOW_OFFSETS.map((offset) => key.rootMidi + offset),
      ...DRAW_OFFSETS.map((offset) => key.rootMidi + offset)
    ]
  };
}

export const harmonica = {
  id: "harmonica",
  name: { zh: "布鲁斯口琴", en: "Blues Harmonica" },
  category: "winds",
  tuning: {
    layout: "grid",
    defaultPresetId: "C",
    reeds: HARMONICA_LAYOUT,
    variants: HARMONICA_VARIANTS,
    defaultVariantId: "standard",
    presets: KEYS.map(makeKeyPreset)
  }
} satisfies InstrumentDefinition;

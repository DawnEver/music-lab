import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PianoKeys from "../../src/features/play/components/PianoKeys.vue";
import FretBoard from "../../src/features/play/components/FretBoard.vue";
import DrumPads from "../../src/features/play/components/DrumPads.vue";
import HoleChart from "../../src/features/play/components/HoleChart.vue";
import NoteCells from "../../src/features/play/components/NoteCells.vue";
import { getInstrument, getPreset, getTunedInstrument } from "../../src/instruments/index.js";
import { setLang } from "../../src/lib/i18n/index.js";

setLang("en");

function keyboard(props: Partial<Record<string, unknown>> = {}) {
  return mount(PianoKeys, {
    props: {
      lowMidi: 48,
      highMidi: 48 + 31,
      baseMidi: 48,
      sounding: new Set<number>(),
      orientation: "horizontal",
      ...props
    }
  });
}

describe("PianoKeys", () => {
  it("draws every note of the mapped span", () => {
    const keys = keyboard().findAll(".kbd-key");
    expect(keys).toHaveLength(32);
    expect(keys.filter((key) => key.classes("is-black"))).toHaveLength(13);
  });

  it("never lets a key run past the right edge", () => {
    const wrapper = keyboard();
    for (const key of wrapper.findAll(".kbd-key")) {
      const style = key.attributes("style") ?? "";
      const left = Number(/left:\s*([\d.]+)%/.exec(style)?.[1]);
      const width = Number(/width:\s*([\d.]+)%/.exec(style)?.[1]);
      expect(left).toBeGreaterThanOrEqual(0);
      expect(left + width).toBeLessThanOrEqual(100.001);
    }
  });

  it("turns the same keyboard down the page, on the other axis", () => {
    const wrapper = keyboard({ orientation: "vertical" });
    expect(wrapper.find(".kbd-board").classes()).toContain("is-vertical");
    for (const key of wrapper.findAll(".kbd-key")) {
      const style = key.attributes("style") ?? "";
      // Down, a key's extent is top/height. Nothing may still be on the
      // horizontal axis, or the board would be drawn two ways at once.
      expect(style).not.toMatch(/left:/);
      expect(style).not.toMatch(/width:/);
      const top = Number(/top:\s*([\d.]+)%/.exec(style)?.[1]);
      const height = Number(/height:\s*([\d.]+)%/.exec(style)?.[1]);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top + height).toBeLessThanOrEqual(100.001);
    }
  });

  it("keeps every note when it turns, and the same black/white split", () => {
    const across = keyboard();
    const down = keyboard({ orientation: "vertical" });
    expect(down.findAll(".kbd-key")).toHaveLength(across.findAll(".kbd-key").length);
    expect(down.findAll(".kbd-key.is-black")).toHaveLength(13);
  });

  it("stacks the black keys above the white ones", () => {
    const wrapper = keyboard();
    const black = wrapper.findAll(".kbd-key.is-black");
    // A black key is narrower than a white one and sits on a boundary.
    const white = wrapper.findAll(".kbd-key:not(.is-black)")[0];
    const widthOf = (element: (typeof white)) =>
      Number(/width:\s*([\d.]+)%/.exec(element.attributes("style") ?? "")?.[1]);
    expect(widthOf(black[0])).toBeLessThan(widthOf(white));
  });

  it("lights up only the notes that are sounding", () => {
    const wrapper = keyboard({ sounding: new Set([48, 55]) });
    const down = wrapper.findAll(".kbd-key.is-down");
    expect(down).toHaveLength(2);
    expect(down.map((key) => key.attributes("aria-label"))).toEqual(["C3", "G3"]);
  });

  it("emits down on press and up on release", async () => {
    const wrapper = keyboard();
    const first = wrapper.findAll(".kbd-key")[0];
    await first.trigger("pointerdown");
    await first.trigger("pointerup");
    expect(wrapper.emitted("down")?.[0]).toEqual([48]);
    expect(wrapper.emitted("up")?.[0]).toEqual([48]);
  });

  it("glissandos under a held pointer but stays silent under a passing one", async () => {
    const wrapper = keyboard();
    const second = wrapper.findAll(".kbd-key")[2];
    await second.trigger("pointerenter", { buttons: 0 });
    expect(wrapper.emitted("down")).toBeUndefined();
    await second.trigger("pointerenter", { buttons: 1 });
    expect(wrapper.emitted("down")?.[0]).toEqual([50]);
  });

  it("engraves the computer key on the note it plays", () => {
    const wrapper = keyboard();
    const caps = wrapper.findAll(".kbd-key").map((key) => key.find(".kbd-cap").exists());
    // Every note in the span is reachable from the computer keyboard.
    expect(caps.every(Boolean)).toBe(true);
    expect(wrapper.findAll(".kbd-key")[0].find(".kbd-cap").text()).toBe("Z");
  });

  it("labels the Cs and nothing else, so the keys stay readable", () => {
    const wrapper = keyboard();
    const notes = wrapper.findAll(".kbd-note").map((node) => node.text());
    expect(notes).toEqual(["C3", "C4", "C5"]);
  });
});

describe("FretBoard", () => {
  const guitar = getTunedInstrument("guitar")!;

  function board(
    presetId = "standard",
    frets = 5,
    sounding = new Set<number>(),
    orientation: "horizontal" | "vertical" = "horizontal"
  ) {
    return mount(FretBoard, {
      props: { preset: getPreset(guitar, presetId), frets, sounding, orientation }
    });
  }

  it("draws one row per string and one cell per fret, open included", () => {
    const wrapper = board();
    expect(wrapper.findAll(".fret-row")).toHaveLength(7); // 6 strings + the number row
    expect(wrapper.findAll(".fret-cell")).toHaveLength(6 * 6);
  });

  it("puts the first string on top and labels every row", () => {
    const labels = board().findAll(".fret-label").map((node) => node.text());
    expect(labels).toEqual(["", "1", "2", "3", "4", "5", "6"]);
  });

  it("names each cell by the note it sounds, and shows the letter", () => {
    const cells = board().findAll(".fret-cell");
    expect(cells[0].attributes("aria-label")).toBe("E4");
    expect(cells[1].attributes("aria-label")).toBe("F4");
    // An anonymous box is not a fretboard: the letter is on the cell.
    expect(cells[0].find(".fret-note").text()).toBe("E");
    expect(cells[1].find(".fret-note").text()).toBe("F");
  });

  it("draws a stopped neck without a guitar's inlays", () => {
    const wrapper = mount(FretBoard, {
      props: {
        preset: getPreset(getTunedInstrument("violin")!, "standard"),
        frets: 7,
        sounding: new Set<number>(),
        orientation: "horizontal",
        fretless: true
      }
    });
    expect(wrapper.findAll(".fret-cell.is-marked")).toHaveLength(0);
    // The grid is still the grid: four strings, seven stops, the nut.
    expect(wrapper.findAll(".fret-row")).toHaveLength(5);
    expect(wrapper.findAll(".fret-cell")).toHaveLength(4 * 8);
    // And every cell still carries the note it sounds: the first string of
    // a violin is its E5, which is the row on top.
    expect(wrapper.findAll(".fret-cell")[0].attributes("aria-label")).toBe("E5");
  });

  it("marks the inlay frets on the board, not only in the numbers", () => {
    const wrapper = board("standard", 5);
    const marked = wrapper.findAll(".fret-cell.is-marked");
    // Frets 3 and 5 carry inlays, on all six strings.
    expect(marked).toHaveLength(12);
  });

  it("marks the open string as played rather than fretted", () => {
    const wrapper = board();
    expect(wrapper.findAll(".fret-cell.is-open")).toHaveLength(6);
  });

  it("lights every place a sounding note can be played", () => {
    // E4 is the open first string and the fifth fret of the second.
    const wrapper = board("standard", 5, new Set([64]));
    expect(wrapper.findAll(".fret-cell.is-down")).toHaveLength(2);
  });

  it("follows the chosen tuning", () => {
    const dropD = board("dropD");
    const rows = dropD.findAll(".fret-row");
    const lowest = rows[rows.length - 1].findAll(".fret-cell")[0];
    expect(lowest.attributes("aria-label")).toBe("D2");
  });

  it("emits down on press and up on release", async () => {
    const wrapper = board();
    const cell = wrapper.findAll(".fret-cell")[0];
    await cell.trigger("pointerdown");
    await cell.trigger("pointerup");
    expect(wrapper.emitted("down")?.[0]).toEqual([64]);
    expect(wrapper.emitted("up")?.[0]).toEqual([64]);
  });

  it("transposes when the neck runs down the screen", () => {
    const wrapper = board("standard", 5, new Set(), "vertical");
    // One heading row plus one row per fret, open included.
    expect(wrapper.findAll(".fret-row")).toHaveLength(7);
    // Headings are now the strings, lowest on the left as the neck points away.
    const headings = wrapper.findAll(".fret-heading").map((node) => node.text());
    expect(headings).toEqual(["6", "5", "4", "3", "2", "1"]);
    // The first line is the open strings, low to high.
    const open = wrapper.findAll(".fret-row")[1].findAll(".fret-cell");
    expect(open.map((cell) => cell.attributes("aria-label"))).toEqual([
      "E2",
      "A2",
      "D3",
      "G3",
      "B3",
      "E4"
    ]);
    expect(wrapper.findAll(".fret-cell.is-open")).toHaveLength(6);
  });

  it("sounds the same notes whichever way the neck runs", () => {
    const across = board("standard", 5)
      .findAll(".fret-cell")
      .map((cell) => cell.attributes("aria-label"))
      .sort();
    const down = board("standard", 5, new Set(), "vertical")
      .findAll(".fret-cell")
      .map((cell) => cell.attributes("aria-label"))
      .sort();
    expect(down).toEqual(across);
  });

  it("slides under a held pointer only", async () => {
    const wrapper = board();
    const cell = wrapper.findAll(".fret-cell")[1];
    await cell.trigger("pointerenter", { buttons: 0 });
    expect(wrapper.emitted("down")).toBeUndefined();
    await cell.trigger("pointerenter", { buttons: 1 });
    expect(wrapper.emitted("down")?.[0]).toEqual([65]);
  });
});

describe("DrumPads", () => {
  const kit = getInstrument("drums")!;
  const pieces = kit.surface!.kind === "pads" ? kit.surface!.pieces : [];

  function pads(struck = new Set<string>(), orientation: "horizontal" | "vertical" = "horizontal") {
    return mount(DrumPads, { props: { pieces, struck, orientation } });
  }

  it("lays the kit out in rows, metal above drums", () => {
    const wrapper = pads();
    const rows = wrapper.findAll(".pad-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll(".pad")).toHaveLength(4);
    expect(rows[1].findAll(".pad")).toHaveLength(5);
  });

  it("turns the kit onto its other axis without losing a piece", () => {
    const across = pads();
    const down = pads(new Set<string>(), "vertical");
    expect(down.get(".pad-grid").classes()).toContain("is-vertical");
    const count = (wrapper: ReturnType<typeof pads>) =>
      wrapper.findAll(".pad-row").reduce((total, row) => total + row.findAll(".pad").length, 0);
    expect(count(down)).toBe(count(across));
    // Down, a line is a column of the kit: five of them, not two.
    expect(down.findAll(".pad-row")).toHaveLength(5);
    expect(down.findAll(".pad-row")[0].findAll(".pad").map((pad) => pad.attributes("data-piece"))).toEqual(
      ["crash", "kick"]
    );
  });

  it("names every pad in the current language, not with raw keys", () => {
    const names = pads().findAll(".pad-name").map((node) => node.text());
    expect(names).toContain("Kick");
    expect(names.some((name) => name.startsWith("kit."))).toBe(false);
  });

  it("engraves the key that strikes each pad", () => {
    const wrapper = pads();
    const kick = wrapper.find('[data-piece="kick"]');
    expect(kick.find(".pad-cap").text()).toBe("A");
  });

  it("lights only what was just hit", () => {
    const wrapper = pads(new Set(["snare"]));
    const lit = wrapper.findAll(".pad.is-hit");
    expect(lit).toHaveLength(1);
    expect(lit[0].attributes("data-piece")).toBe("snare");
  });

  it("emits the piece that was struck", async () => {
    const wrapper = pads();
    await wrapper.find('[data-piece="crash"]').trigger("pointerdown");
    expect(wrapper.emitted("hit")?.[0]).toEqual(["crash"]);
  });
});

describe("NoteCells", () => {
  const cells = (
    preset: ReturnType<typeof getPreset>,
    surface: "tines" | "reeds",
    sounding = new Set<number>(),
    holes = 10
  ) =>
    mount(NoteCells, {
      props: { preset, surface, holes, sounding, orientation: "horizontal" }
    });

  /*
   * A kalimba's tines are mounted in the order they are played, and that
   * order is not pitch order: the lowest tine is the middle one and the
   * scale alternates outward. Sorting them would be sorting a kalimba
   * into a different instrument.
   */
  it("keeps a kalimba's tines in the order they are mounted", () => {
    const kalimba = getTunedInstrument("kalimba")!;
    const preset = getPreset(kalimba, kalimba.tuning.defaultPresetId);
    const wrapper = cells(preset, "tines");
    const notes = wrapper.findAll(".note-cell").map((cell) => Number(cell.attributes("data-note")));
    expect(notes).toEqual(preset.notes);
    // The centre tine is the lowest of the seventeen.
    expect(notes[Math.floor(notes.length / 2)]).toBe(Math.min(...notes));
    expect(wrapper.findAll(".cells-row")).toHaveLength(1);
  });

  it("draws a harmonica as ten holes, blown above and drawn below", () => {
    const harmonica = getTunedInstrument("harmonica")!;
    const preset = getPreset(harmonica, harmonica.tuning.defaultPresetId);
    const wrapper = cells(preset, "reeds");
    const rows = wrapper.findAll(".cells-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll(".note-cell")).toHaveLength(10);
    expect(rows[1].findAll(".note-cell")).toHaveLength(10);
    // The preset holds ten blow notes then ten draw ones, and hole 1 blows
    // the root.
    const sound = (index: number) =>
      wrapper.findAll(".note-cell").map((cell) => Number(cell.attributes("data-note")))[index];
    expect(sound(0)).toBe(preset.notes[0]);
    expect(sound(10)).toBe(preset.notes[10]);
    // A Richter layout puts one note in two places — 2 draw and 3 blow are
    // the same reed an octave apart on the staff — so nineteen distinct
    // notes across twenty reeds is the instrument, not a mistake.
    expect(new Set(preset.notes).size).toBe(19);
  });

  it("names each cell by the note it sounds and holds while pressed", async () => {
    const harmonica = getTunedInstrument("harmonica")!;
    const preset = getPreset(harmonica, harmonica.tuning.defaultPresetId);
    // Note the two places the layout duplicates: lighting one lights both.
    const wrapper = cells(preset, "reeds", new Set([preset.notes[2]]));
    const lit = wrapper.findAll(".note-cell.is-down");
    expect(lit).toHaveLength(2);
    expect(lit[0].attributes("aria-label")).toBe("G4");
    await wrapper.find(".note-cell").trigger("pointerdown");
    await wrapper.find(".note-cell").trigger("pointerup");
    expect(wrapper.emitted("down")?.[0]).toEqual([preset.notes[0]]);
    expect(wrapper.emitted("up")?.[0]).toEqual([preset.notes[0]]);
  });
});

describe("HoleChart", () => {
  const dizi = getTunedInstrument("dizi")!;

  function chart(sounding = new Set<number>(), orientation: "horizontal" | "vertical" = "horizontal") {
    return mount(HoleChart, {
      props: {
        preset: getPreset(dizi, dizi.tuning.defaultPresetId),
        wind: dizi.tuning.wind!,
        sounding,
        orientation
      }
    });
  }

  it("draws one card per note, with the instrument's own hole count", () => {
    const wrapper = chart();
    const cards = wrapper.findAll(".hole-card");
    expect(cards).toHaveLength(getPreset(dizi, dizi.tuning.defaultPresetId).notes.length);
    expect(cards[0].findAll(".hole-dot")).toHaveLength(6);
  });

  it("runs the scale down the page instead of across it", () => {
    const across = chart();
    const down = chart(new Set<number>(), "vertical");
    expect(down.get(".hole-chart").classes()).toContain("is-vertical");
    // One ascending line either way: the order is the exercise, and
    // folding it into rows would destroy the only order it has.
    const order = (wrapper: ReturnType<typeof chart>) =>
      wrapper.findAll(".hole-card").map((card) => card.attributes("aria-label"));
    expect(order(down)).toEqual(order(across));
  });

  it("fills a closed hole and leaves an open one empty", () => {
    // 筒音: every hole closed. The next note lifts the bottom finger.
    const cards = chart().findAll(".hole-card");
    expect(cards[0].findAll(".hole-dot.is-closed")).toHaveLength(6);
    expect(cards[1].findAll(".hole-dot.is-closed")).toHaveLength(5);
  });

  it("marks the overblown octave with the technique that reaches it", () => {
    const cards = chart().findAll(".hole-card");
    const upper = cards[cards.length - 1];
    expect(upper.find(".hole-key").exists()).toBe(true);
  });

  it("lights the note being blown", () => {
    const preset = getPreset(dizi, dizi.tuning.defaultPresetId);
    const wrapper = chart(new Set([preset.notes[2]]));
    const lit = wrapper.findAll(".hole-card.is-down");
    expect(lit).toHaveLength(1);
  });

  it("sounds while held and stops when let go", async () => {
    const wrapper = chart();
    const card = wrapper.findAll(".hole-card")[0];
    await card.trigger("pointerdown");
    await card.trigger("pointerup");
    const midi = getPreset(dizi, dizi.tuning.defaultPresetId).notes[0];
    expect(wrapper.emitted("down")?.[0]).toEqual([midi]);
    expect(wrapper.emitted("up")?.[0]).toEqual([midi]);
  });
});

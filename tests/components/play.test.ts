import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PianoKeys from "../../src/features/play/components/PianoKeys.vue";
import FretBoard from "../../src/features/play/components/FretBoard.vue";
import DrumPads from "../../src/features/play/components/DrumPads.vue";
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

  function board(presetId = "standard", frets = 5, sounding = new Set<number>()) {
    return mount(FretBoard, { props: { preset: getPreset(guitar, presetId), frets, sounding } });
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

  it("names each cell by the note it sounds", () => {
    const cells = board().findAll(".fret-cell");
    expect(cells[0].attributes("aria-label")).toBe("E4");
    expect(cells[1].attributes("aria-label")).toBe("F4");
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

  function pads(struck = new Set<string>()) {
    return mount(DrumPads, { props: { pieces, struck } });
  }

  it("lays the kit out in rows, metal above drums", () => {
    const wrapper = pads();
    const rows = wrapper.findAll(".pad-row");
    expect(rows).toHaveLength(2);
    expect(rows[0].findAll(".pad")).toHaveLength(4);
    expect(rows[1].findAll(".pad")).toHaveLength(5);
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

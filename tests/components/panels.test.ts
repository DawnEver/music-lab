import { describe, expect, it, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import StringsPanel from "../../src/features/tuning/components/StringsPanel.vue";
import HarmonicaPanel from "../../src/features/tuning/components/HarmonicaPanel.vue";
import SourceBar from "../../src/features/tuning/components/SourceBar.vue";
import { audioStore } from "../../src/features/tuning/stores/audio.js";
import { setLang } from "../../src/lib/i18n/index.js";
import { useTuner } from "../../src/features/tuning/stores/tuner.js";
import { pitchRef, tickRef } from "../../src/lib/analysis-loop.js";
import { midiToFrequency } from "../../src/lib/music-theory.js";

const tuner = useTuner();
setLang("en");

async function selectInstrument(id: string, presetId?: string): Promise<void> {
  tuner.setInstrument(id);
  if (presetId) tuner.setPreset(presetId);
  pitchRef.value = null;
  await nextTick();
}

describe("StringsPanel", () => {
  beforeEach(async () => {
    await selectInstrument("guitar", "standard");
  });

  it("renders one row per target, labelled from the instrument data", () => {
    const wrapper = mount(StringsPanel);
    const rows = wrapper.findAll(".string-row");
    expect(rows).toHaveLength(6);
    expect(rows[0].find(".string-label").text()).toBe("6");
    expect(rows[0].find(".string-note").text()).toBe("E2");
    expect(rows[5].find(".string-note").text()).toBe("E4");
  });

  it("follows the instrument: 21 rows for a guzheng, 17 for a kalimba", async () => {
    const wrapper = mount(StringsPanel);
    await selectInstrument("guzheng");
    expect(wrapper.findAll(".string-row")).toHaveLength(21);

    await selectInstrument("kalimba");
    const rows = wrapper.findAll(".string-row");
    expect(rows).toHaveLength(17);
    // The centre tine is the low C4, not the first one on screen.
    expect(rows[8].find(".string-note").text()).toBe("C4");
  });

  it("clicking a row pins it as the tuner target", async () => {
    const wrapper = mount(StringsPanel);
    await wrapper.findAll(".string-row")[3].trigger("click");
    expect(tuner.selection.value?.targetIndex).toBe(3);
    await nextTick();
    expect(wrapper.findAll(".string-row")[3].classes()).toContain("is-selected");
  });

  it("shows the deviation of the played note against each string", async () => {
    const wrapper = mount(StringsPanel);
    // The panels follow the rAF tick, not the pitch ref — that is what keeps
    // a 21-string panel cheap, so the test drives the same signal.
    pitchRef.value = { frequency: midiToFrequency(64, 440), confidence: 0.9 } as never;
    tickRef.value += 1;
    await nextTick();

    const highE = wrapper.findAll(".string-row")[5];
    expect(highE.classes()).toContain("st-in-tune");
    expect(highE.find(".string-cents").text()).toMatch(/0/);
  });
});

describe("HarmonicaPanel", () => {
  beforeEach(async () => {
    await selectInstrument("harmonica", "C");
  });

  it("derives a 10 x 2 grid from the targets' slots", () => {
    const wrapper = mount(HarmonicaPanel);
    expect(wrapper.findAll(".harmonica-cell")).toHaveLength(20);
    expect(wrapper.findAll(".harmonica-hole-label").map((el) => el.text())).toEqual(
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]
    );
    // First row: hole 1 blow C4, hole 1 draw D4.
    const firstRow = wrapper.findAll(".harmonica-cell").slice(0, 2);
    expect(firstRow.map((cell) => cell.find(".cell-note").text())).toEqual(["C4", "D4"]);
  });

  it("expanding a hole lists its bends and overbends", async () => {
    const wrapper = mount(HarmonicaPanel);
    // Hole 3 draw: B4 plus three bends.
    await wrapper.findAll(".harmonica-cell")[5].trigger("click");
    const chips = wrapper.findAll(".position-chip");
    expect(chips).toHaveLength(4);
    expect(chips.map((chip) => chip.find(".chip-note").text())).toEqual(["B4", "A♯4", "A4", "G♯4"]);
  });

  it("clicking the same hole again releases the target back to auto", async () => {
    const wrapper = mount(HarmonicaPanel);
    const cell = wrapper.findAll(".harmonica-cell")[0];
    await cell.trigger("click");
    expect(tuner.selection.value).not.toBeNull();

    await cell.trigger("click");
    expect(tuner.selection.value).toBeNull();
    expect(wrapper.findAll(".position-chip")).toHaveLength(0);
  });

  it("switching the reed tuning re-renders the grid", async () => {
    const wrapper = mount(HarmonicaPanel);
    const hole3Blow = () => wrapper.findAll(".harmonica-cell")[4].find(".cell-note").text();
    expect(hole3Blow()).toBe("G4");

    tuner.setVariant("paddy");
    await nextTick();
    expect(hole3Blow()).toBe("A4");
    tuner.setVariant("standard");
  });
});

describe("SourceBar", () => {
  beforeEach(() => {
    audioStore.mode = "idle";
    audioStore.isStarting = false;
  });

  it("uses one button for start and stop, stating what it will do next", async () => {
    const wrapper = mount(SourceBar);
    const button = () => wrapper.findAll("button")[0];

    expect(wrapper.findAll("button")).toHaveLength(1);
    expect(button().text()).toContain("Start microphone");
    expect(button().attributes("aria-pressed")).toBe("false");

    audioStore.mode = "mic";
    await nextTick();
    expect(button().text()).toContain("Stop");
    expect(button().attributes("aria-pressed")).toBe("true");
    expect(button().classes()).toContain("is-live");
  });

  it("stops a playing file with the same button", async () => {
    audioStore.mode = "file";
    const wrapper = mount(SourceBar);
    await nextTick();
    expect(wrapper.findAll("button")[0].text()).toContain("Stop");

    await wrapper.findAll("button")[0].trigger("click");
    await nextTick();
    expect(audioStore.mode).toBe("idle");
  });

  it("is disabled only while a source is starting", async () => {
    const wrapper = mount(SourceBar);
    expect(wrapper.findAll("button")[0].attributes("disabled")).toBeUndefined();

    audioStore.isStarting = true;
    await nextTick();
    expect(wrapper.findAll("button")[0].attributes("disabled")).toBeDefined();
  });
});

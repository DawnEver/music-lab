import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import PianoKeys from "../../src/features/keyboard/components/PianoKeys.vue";
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

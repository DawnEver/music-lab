import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import Score from "../../src/features/ear/components/Score.vue";
import type { NotatedLine } from "../../src/lib/notation.js";

const line: NotatedLine = {
  tonicMidi: 62,
  bpm: 60,
  notes: [62, 64, 66, 67, 69].map((midi, index) => ({ midi, start: index, duration: 1 }))
};

describe("Score", () => {
  it("writes the line on a staff: clef, key, meter, notes", () => {
    const wrapper = mount(Score, { props: { melody: line, notation: "staff" } });
    expect(wrapper.findAll(".score-line")).toHaveLength(5);
    expect(wrapper.find(".score-clef").exists()).toBe(true);
    // D major: two sharps.
    expect(wrapper.findAll(".score-accidental")).toHaveLength(2);
    expect(wrapper.findAll(".score-head")).toHaveLength(5);
    expect(wrapper.findAll(".score-stem")).toHaveLength(5);
    expect(wrapper.text()).toContain("4");
  });

  it("writes the same line as numbers, with the key named", () => {
    const wrapper = mount(Score, { props: { melody: line, notation: "jianpu" } });
    expect(wrapper.find(".score-key").text()).toBe("1 = D");
    expect(wrapper.findAll(".score-degree").map((node) => node.text())).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5"
    ]);
    expect(wrapper.findAll(".score-line")).toHaveLength(0);
  });

  it("marks a bar line between bars and not before the first note", () => {
    const twoBars: NotatedLine = {
      tonicMidi: 60,
      bpm: 60,
      notes: Array.from({ length: 8 }, (_, index) => ({
        midi: 60 + index,
        start: index,
        duration: 1
      }))
    };
    expect(mount(Score, { props: { melody: twoBars } }).findAll(".score-bar")).toHaveLength(1);
  });

  it("carries the verdict on the notes themselves", () => {
    const wrapper = mount(Score, {
      props: { melody: line, grades: ["good", "close", "out", "missed", "good"] }
    });
    const classes = wrapper.findAll(".score-note").map((node) => node.classes().join(" "));
    expect(classes[0]).toContain("is-good");
    expect(classes[2]).toContain("is-out");
    expect(classes[3]).toContain("is-missed");
  });

  it("shows where the singer is, while they are singing", () => {
    const wrapper = mount(Score, { props: { melody: line, activeIndex: 2 } });
    const active = wrapper.findAll(".score-note.is-active");
    expect(active).toHaveLength(1);
  });

  it("renders nothing rather than breaking when there is no line yet", () => {
    const wrapper = mount(Score, { props: { melody: null } });
    expect(wrapper.find("svg").exists()).toBe(false);
  });
});

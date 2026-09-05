import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import AnswerPad from "../../src/features/ear/components/AnswerPad.vue";
import { setLang } from "../../src/lib/i18n/index.js";
import {
  answer,
  exercise,
  nextQuestion,
  progress,
  session
} from "../../src/features/ear/stores/ear.js";
import { emptyProgress } from "../../src/features/ear/domain/grade.js";

setLang("en");

// The player needs an AudioContext; the loop under test is the question,
// not the sound.
vi.mock("../../src/features/ear/engine/player.js", () => ({
  createEarPlayer: () => ({ play: async () => undefined, dispose: () => undefined }),
  phraseSeconds: () => 1,
  noteSpec: () => ({ waveform: "sine", frequency: 440, gain: 0.3, duration: 1 })
}));

describe("AnswerPad", () => {
  beforeEach(() => {
    Object.assign(progress, emptyProgress());
    session.kind = "interval";
    session.level = 1;
    session.streak = 0;
    nextQuestion();
  });

  it("renders one button per choice, with the answer among them", () => {
    const wrapper = mount(AnswerPad);
    const buttons = wrapper.findAll(".ear-choice");
    expect(buttons.length).toBe(exercise.value!.choices.length);
    expect(buttons.length).toBeGreaterThan(1);
  });

  it("labels choices in the current language, not with raw keys", () => {
    const wrapper = mount(AnswerPad);
    const labels = wrapper.findAll(".ear-choice").map((button) => button.text());
    expect(labels.some((label) => /^[A-Z]?\d?$/.test(label))).toBe(false);
    expect(labels.join(" ")).toMatch(/Unison|Minor|Major|Perfect|Octave|Tritone/);
  });

  it("marks the right answer and the wrong pick, then locks the pad", async () => {
    const current = exercise.value!;
    const wrong = current.choices.find((choice) => choice !== current.answer)!;
    const wrapper = mount(AnswerPad);
    const index = current.choices.indexOf(wrong);
    await wrapper.findAll(".ear-choice")[index].trigger("click");
    await nextTick();

    expect(wrapper.findAll(".ear-choice.is-right").length).toBe(1);
    expect(wrapper.findAll(".ear-choice.is-wrong").length).toBe(1);
    expect(wrapper.findAll(".ear-choice")[0].attributes("disabled")).toBeDefined();
  });

  it("ignores a second answer to the same question", () => {
    const current = exercise.value!;
    answer(current.answer);
    const before = { ...progress.interval };
    answer(current.choices[0]);
    expect(progress.interval.attempts).toBe(before.attempts);
  });

  it("records the attempt and the streak", () => {
    const current = exercise.value!;
    answer(current.answer);
    expect(progress.interval.attempts).toBe(1);
    expect(progress.interval.correct).toBe(1);
    expect(session.streak).toBe(1);

    nextQuestion();
    const next = exercise.value!;
    answer(next.choices.find((choice) => choice !== next.answer)!);
    expect(session.streak).toBe(0);
    expect(progress.interval.attempts).toBe(2);
  });
});

describe("EarView modes", () => {
  it("shows the pad for the kind it restored, not for a default", async () => {
    // Two copies of "which kind of question" — a local ref and the session
    // — drifted apart on reload: the chips said intervals, the pad offered
    // scales.
    window.localStorage.setItem("ml.ear.kind", JSON.stringify("scale"));
    const { default: EarView } = await import("../../src/features/ear/EarView.vue");
    const wrapper = mount(EarView, { global: { stubs: { SingStage: true } } });
    await nextTick();

    const active = wrapper.findAll(".ear-kinds .metro-chip").filter((chip) =>
      chip.classes().includes("is-active")
    );
    expect(active).toHaveLength(1);
    expect(active[0].attributes("data-ear-kind")).toBe("scale");
    expect(wrapper.find("[data-ear-pad]").text()).toMatch(/Major|minor/);
  });
});

describe("resetting progress", () => {
  it("clears the record, the level and the streak", async () => {
    const { resetProgress } = await import("../../src/features/ear/stores/ear.js");
    resetProgress();
    session.kind = "interval";
    nextQuestion();
    answer(exercise.value!.answer);
    expect(progress.interval.attempts).toBe(1);

    resetProgress();
    expect(progress.interval.attempts).toBe(0);
    expect(progress.interval.recent).toEqual([]);
    expect(session.level).toBe(1);
    expect(session.streak).toBe(0);
    // And a fresh question is waiting, not the answered one.
    expect(session.answered).toBeNull();
  });
});

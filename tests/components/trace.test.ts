import { describe, expect, it, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import TraceControls from "../../src/features/trace/components/TraceControls.vue";
import { setLang } from "../../src/lib/i18n/index.js";
import { hydrateTrace, traceView } from "../../src/features/trace/stores/trace.js";
import { COLORMAP_IDS } from "../../src/lib/colormap.js";

setLang("en");

describe("TraceControls", () => {
  beforeEach(() => {
    window.localStorage.clear();
    hydrateTrace();
  });

  it("keeps every knob reachable in one panel", () => {
    // The point of the flat panel: no knob is a click away behind another.
    const wrapper = mount(TraceControls);
    const text = wrapper.text();
    for (const label of ["Layers", "Window", "Resolution", "Colours", "Floor", "Ceiling", "Reference"]) {
      expect(text, label).toContain(label);
    }
    expect(wrapper.findAll('input[type="range"]').length).toBe(2);
  });

  it("offers every colour ramp, translated, and persists a pick", async () => {
    const wrapper = mount(TraceControls);
    const swatches = wrapper.findAll("[data-trace-colormap]");
    expect(swatches.length).toBe(COLORMAP_IDS.length);
    expect(wrapper.text()).toContain("Magma");

    await swatches[1].trigger("click");
    expect(traceView.colormap).toBe(COLORMAP_IDS[1]);
    expect(window.localStorage.getItem("ml.trace")).toContain(COLORMAP_IDS[1]);
  });

  it("names the resolution trade-off instead of exposing an FFT size", () => {
    const text = mount(TraceControls).text();
    expect(text).toContain("Sharp in time");
    expect(text).toContain("Sharp in frequency");
    expect(text).not.toMatch(/\b(1024|2048|4096)\b/);
  });

  it("never lets both picture layers be switched off", async () => {
    const wrapper = mount(TraceControls);
    await wrapper.find('[data-trace-layer="pitch"]').trigger("click");
    await wrapper.find('[data-trace-layer="spectrogram"]').trigger("click");
    await nextTick();
    expect(traceView.showSpectrogram || traceView.showPitch).toBe(true);
  });

  it("keeps the dB floor below the ceiling", async () => {
    const wrapper = mount(TraceControls);
    const floor = wrapper.find("[data-trace-floor]");
    await floor.setValue("-40");
    expect(traceView.floorDb).toBeLessThanOrEqual(traceView.ceilingDb - 10);
  });

  it("switches the vertical axis between Hz and semitones", async () => {
    const wrapper = mount(TraceControls);
    await wrapper.find('[data-trace-scale="semitone"]').trigger("click");
    expect(traceView.scale).toBe("semitone");
    expect(window.localStorage.getItem("ml.trace")).toContain("semitone");
  });
});

describe("TraceControls: reference", () => {
  beforeEach(() => {
    window.localStorage.clear();
    hydrateTrace();
  });

  it("follows the tuner by default, which is what a player expects", () => {
    expect(traceView.followTuner).toBe(true);
    const wrapper = mount(TraceControls);
    expect(wrapper.find("[data-trace-follow]").classes()).toContain("is-active");
  });

  it("pinning a note stops following", async () => {
    const wrapper = mount(TraceControls);
    const chips = wrapper.findAll(".trace-row").at(-1)!.findAll(".metro-chip");
    // None, Follow, then the twelve pitch classes: A is index 11.
    await chips[11].trigger("click");
    await nextTick();
    expect(traceView.referenceMidi).toBe(69);
    expect(traceView.followTuner).toBe(false);
  });

  it("goes back to following", async () => {
    const wrapper = mount(TraceControls);
    await wrapper.find("[data-trace-follow]").trigger("click");
    expect(traceView.followTuner).toBe(true);
  });
});

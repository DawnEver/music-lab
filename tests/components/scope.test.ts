import { describe, expect, it, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ScopeSettings from "../../src/features/scope/components/ScopeSettings.vue";
import ReferencePicker from "../../src/features/scope/components/ReferencePicker.vue";
import { setLang } from "../../src/lib/i18n/index.js";
import { hydrateScope, scope } from "../../src/features/scope/stores/scope.js";
import { COLORMAP_IDS } from "../../src/lib/colormap.js";

setLang("en");

// The dB sliders are Vuetify's; this suite is about the scope's own
// controls, so they are stubbed rather than given a Vuetify instance.
const global = { stubs: { "v-slider": true } };

describe("ScopeSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    hydrateScope();
  });

  it("offers every colour ramp, translated", () => {
    const wrapper = mount(ScopeSettings, { global });
    const chips = wrapper.findAll(".metro-chips")[0].findAll(".metro-chip");
    expect(chips.length).toBe(COLORMAP_IDS.length);
    expect(chips.map((chip) => chip.text())).toContain("Magma");
  });

  it("selects a ramp and persists it", async () => {
    const wrapper = mount(ScopeSettings, { global });
    const chips = wrapper.findAll(".metro-chips")[0].findAll(".metro-chip");
    await chips[1].trigger("click");
    expect(scope.colormap).toBe(COLORMAP_IDS[1]);
    expect(window.localStorage.getItem("ml.scope")).toContain(COLORMAP_IDS[1]);
  });

  it("names the resolution trade-off instead of exposing an FFT size", () => {
    const wrapper = mount(ScopeSettings, { global });
    const text = wrapper.text();
    expect(text).toContain("Sharp in time");
    expect(text).toContain("Sharp in frequency");
    expect(text).not.toMatch(/\b(1024|2048|4096)\b/);
  });
});

describe("ReferencePicker", () => {
  beforeEach(() => {
    window.localStorage.clear();
    hydrateScope();
  });

  it("starts with no reference", () => {
    expect(scope.referenceMidi).toBeNull();
    const wrapper = mount(ReferencePicker);
    expect(wrapper.find(".metro-chip.is-active").text()).toBe("None");
  });

  it("pins a note and clears it again", async () => {
    const wrapper = mount(ReferencePicker);
    const chips = wrapper.findAll(".metro-chip");
    // "None" then the twelve pitch classes: index 10 is A.
    await chips[10].trigger("click");
    await nextTick();
    expect(scope.referenceMidi).toBe(69);

    await wrapper.findAll(".metro-chip")[0].trigger("click");
    expect(scope.referenceMidi).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { messages, t, getLang, setLang } from "../src/lib/i18n.js";

describe("dictionary", () => {
  it("zh and en define the same set of keys", () => {
    const zh = Object.keys(messages.zh).sort();
    const en = Object.keys(messages.en).sort();
    expect(en).toEqual(zh);
    expect(zh.length).toBeGreaterThan(40);
  });

  it("t returns the localized string for the current language", () => {
    setLang("zh");
    expect(t("appTitle")).toBe("调音实验室");
    expect(t("defaultMic")).toBe("默认麦克风");

    setLang("en");
    expect(t("appTitle")).toBe("Tuning Lab");
    expect(t("statusIdle")).toBe("Idle");
  });

  it("t substitutes {placeholder} parameters", () => {
    setLang("en");
    expect(t("analyzing", { label: "Built-in Microphone" })).toBe("Analyzing: Built-in Microphone");
    expect(t("micNumber", { index: 3 })).toBe("Mic 3");
    expect(t("localFile", { name: "demo.wav" })).toBe("Local file: demo.wav");
  });

  it("t falls back to the key itself when unknown", () => {
    expect(t("this.key.does.not.exist")).toBe("this.key.does.not.exist");
  });

  it("chord type names are localized per language", () => {
    setLang("zh");
    expect(t("chordType.major")).toBe("大三和弦");
    setLang("en");
    expect(t("chordType.major")).toBe("Major triad");
    expect(t("chordType.dom7")).toBe("Dominant seventh");
  });

  it("setLang validates and getLang returns a valid language in Node", () => {
    expect(setLang("en")).toBe("en");
    expect(setLang("fr")).toBe("zh");
    expect(["zh", "en"]).toContain(getLang());
  });
});

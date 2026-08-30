import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
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
    expect(t("appTitle")).toBe("音乐实验室");
    expect(t("defaultMic")).toBe("默认麦克风");

    setLang("en");
    expect(t("appTitle")).toBe("Music Lab");
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

  it("every static t() key used in src exists in the dictionary", () => {
    const srcDir = join(import.meta.dirname, "..", "src");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(vue|ts)$/.test(entry)) files.push(full);
      }
    };
    walk(srcDir);

    const used = new Set<string>();
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // Only fully static keys can be validated: t("key") or t(`key`).
      // Template literals with ${expr} build their key at runtime, so the
      // static prefix alone is not a dictionary key. The lookbehind keeps
      // mount(...)/import(...) from matching their trailing "t(".
      for (const match of source.matchAll(/(?<![A-Za-z])t\(\s*["`]([^"`]*?)["`]\s*\)/g)) {
        const key = match[1].trim();
        if (key && !key.includes("${")) used.add(key);
      }
    }

    const missing = [...used].filter((key) => !(key in messages.zh)).sort();
    expect(missing).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { messages, t, getLang, setLang, type MessageKey } from "../src/lib/i18n/index.js";
import { shell } from "../src/lib/i18n/dictionaries/shell.js";
import { tuning } from "../src/lib/i18n/dictionaries/tuning.js";
import { metronome } from "../src/lib/i18n/dictionaries/metronome.js";
import { trace } from "../src/lib/i18n/dictionaries/trace.js";
import { ear } from "../src/lib/i18n/dictionaries/ear.js";
import { keyboard } from "../src/lib/i18n/dictionaries/keyboard.js";

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
    // Unknown keys are a compile error now; the runtime fallback still
    // guards a dictionary that loses an entry.
    expect(t("this.key.does.not.exist" as MessageKey)).toBe("this.key.does.not.exist");
  });

  it("each dictionary owns its keys, with zh/en parity and no overlap", () => {
    const parts = { shell, tuning, metronome, trace, ear, keyboard };
    const seen = new Map<string, string>();

    for (const [name, part] of Object.entries(parts)) {
      expect(Object.keys(part.en).sort(), name).toEqual(Object.keys(part.zh).sort());
      for (const key of Object.keys(part.zh)) {
        const owner = seen.get(key);
        expect(owner, `${key} is defined in both ${owner} and ${name}`).toBeUndefined();
        seen.set(key, name);
      }
    }

    // Together they are the whole dictionary.
    expect([...seen.keys()].sort()).toEqual(Object.keys(messages.zh).sort());
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

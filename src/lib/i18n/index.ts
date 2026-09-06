/**
 * zh/en internationalization.
 *
 * The dictionary is split by the part of the app that owns the copy, and
 * merged here. Keys are typed: `MessageKey` is derived from the zh
 * dictionary, so a typo is a compile error rather than a string that
 * renders as itself. Keys assembled from a union (`tuner.kind.${kind}`)
 * still type-check, because a template literal over a union of literals is
 * itself a union of literals.
 *
 * No DOM is touched at import time, so the module is importable in Node.
 */

import { storedString } from "../persist.js";
import { shell } from "./dictionaries/shell.js";
import { tuning } from "./dictionaries/tuning.js";
import { metronome } from "./dictionaries/metronome.js";
import { trace } from "./dictionaries/trace.js";
import { ear } from "./dictionaries/ear.js";
import { keyboard } from "./dictionaries/keyboard.js";

export type Lang = "zh" | "en";

const zh = { ...shell.zh, ...tuning.zh, ...metronome.zh, ...trace.zh, ...ear.zh, ...keyboard.zh };
const en = { ...shell.en, ...tuning.en, ...metronome.en, ...trace.en, ...ear.en, ...keyboard.en };

export type MessageKey = keyof typeof zh;

export const messages: Record<Lang, Record<string, string>> = { zh, en };

let currentLang: Lang | null = null;

const storedLang = storedString("lang", "", "tcl-lang");

export function getLang(): Lang {
  const stored = storedLang.read();
  if (stored === "zh" || stored === "en") return stored;
  try {
    if (typeof navigator !== "undefined" && navigator.language) {
      return /^zh/i.test(navigator.language) ? "zh" : "en";
    }
  } catch (_) {
    // No navigator in Node.
  }
  return "zh";
}

export function setLang(lang: string): Lang {
  const next: Lang = lang === "en" ? "en" : "zh";
  currentLang = next;
  storedLang.write(next);
  return next;
}

/** Translate a key, substituting {placeholder} params. Falls back to zh. */
if (currentLang === null) {
  currentLang = getLang();
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const dict = messages[currentLang ?? "zh"] ?? messages.zh;
  let text = dict[key] ?? messages.zh[key] ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{${name}}`, String(value));
  }
  return text;
}

/**
 * Reactive i18n wrapper: keeps a `lang` ref in sync with the dictionary
 * module and exposes a `t()` that touches the ref so Vue tracks the
 * dependency and re-renders on language switch.
 */

import { ref } from "vue";
import { t as libT, getLang, setLang as libSetLang, messages } from "../lib/i18n.js";

const lang = ref<"zh" | "en">(getLang());

/** Translate a key; reads lang.value so dependents re-run on switch. */
export function t(key: string, params?: Record<string, string | number>): string {
  lang.value; // reactive dependency
  return libT(key, params);
}

export function setLang(language: string): void {
  libSetLang(language);
  lang.value = getLang();
  document.documentElement.lang = lang.value === "zh" ? "zh-CN" : "en";
  document.title = libT("appTitle");
}

export function useI18n() {
  return { t, lang, setLang, messages };
}

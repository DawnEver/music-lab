/**
 * Theme (dark/light) state: persisted in localStorage, applied as
 * `data-theme` on <html> (tokens.css reacts) and mirrored onto the Vuetify
 * theme. Module-level ref so every component shares one source of truth.
 */

import { ref } from "vue";
import vuetify from "../plugins/vuetify.js";

export type ThemeName = "dark" | "light";

const STORAGE_KEY = "tcl-theme";
const theme = ref<ThemeName>(readStored());

function readStored(): ThemeName {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function apply(name: ThemeName): void {
  document.documentElement.dataset.theme = name;
  vuetify.theme.global.name.value = name === "light" ? "labLight" : "labDark";
}

export function setTheme(name: ThemeName): void {
  theme.value = name;
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    /* private mode: theme just won't persist */
  }
  apply(name);
}

/** Apply the stored theme; call once at app startup (index.html pre-applies data-theme). */
export function initTheme(): void {
  apply(theme.value);
}

export function useTheme() {
  return {
    theme,
    toggleTheme: () => setTheme(theme.value === "dark" ? "light" : "dark")
  };
}

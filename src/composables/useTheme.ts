/**
 * Theme (dark/light) state: persisted in localStorage, applied as
 * `data-theme` on <html> (tokens.css reacts) and mirrored onto the Vuetify
 * theme. Module-level ref so every component shares one source of truth.
 */

import { ref } from "vue";
import vuetify from "../plugins/vuetify.js";
import { storedString } from "../lib/persist.js";

export type ThemeName = "dark" | "light";

const stored = storedString("theme", "dark", "tcl-theme");
const theme = ref<ThemeName>(stored.read() === "light" ? "light" : "dark");

function apply(name: ThemeName): void {
  document.documentElement.dataset.theme = name;
  vuetify.theme.global.name.value = name === "light" ? "labLight" : "labDark";
}

export function setTheme(name: ThemeName): void {
  theme.value = name;
  stored.write(name);
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

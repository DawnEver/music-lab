/**
 * 调音实验室 (Tuning Lab) — application entry.
 *
 * Wires Vue + Vuetify + the router, keeps the document title in sync with
 * the active language, and re-exports the legacy window.ToneChordLab API.
 */

import { createApp } from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify.js";
import { router } from "./router/index.js";
import { getLang } from "./lib/i18n.js";
import { initTheme } from "./composables/useTheme.js";
import { detectPitchYin, analyzeSpectrum } from "./lib/dsp.js";
import { detectChord } from "./lib/chord.js";
import { frequencyToNote } from "./lib/music-theory.js";
import { cleanup, populateDevices } from "./features/tuning/stores/audio.js";
import "./styles/tokens.css";
import "./styles/style.css";

const app = createApp(App);
app.use(router);
app.use(vuetify);

document.title = "调音实验室";
document.documentElement.lang = getLang() === "zh" ? "zh-CN" : "en";
initTheme();

window.addEventListener("beforeunload", () => {
  cleanup();
});

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  // Refresh the device list on hot-plug while the page is open.
  navigator.mediaDevices.addEventListener("devicechange", () => {
    populateDevices();
  });
}

app.mount("#app");

// Legacy public API (documented in the README).
window.ToneChordLab = Object.freeze({
  detectPitchYin,
  analyzeSpectrum,
  detectChord,
  frequencyToNote
});

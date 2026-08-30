/**
 * 音乐实验室 (Music Lab) — application entry.
 *
 * Wires Vue + Vuetify + the router, keeps the document title in sync with
 * the active language, and exposes the framework-agnostic MusicLab API.
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

document.title = getLang() === "zh" ? "音乐实验室" : "Music Lab";
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

const publicApi = Object.freeze({
  detectPitchYin,
  analyzeSpectrum,
  detectChord,
  frequencyToNote
});
window.MusicLab = publicApi;
// Compatibility for consumers of releases before the project rename.
window.ToneChordLab = publicApi;

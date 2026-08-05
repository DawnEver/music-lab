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
import { t, getLang } from "./lib/i18n.js";
import "./styles/tokens.css";
import "./styles/style.css";

const app = createApp(App);
app.use(router);
app.use(vuetify);

document.title = t("appTitle");
document.documentElement.lang = getLang() === "zh" ? "zh-CN" : "en";

app.mount("#app");

export { app };

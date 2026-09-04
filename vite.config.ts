/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { readFileSync } from "node:fs";
import { VitePWA } from "vite-plugin-pwa";

// Single source of truth for the version: package.json, which is also what
// the pre-push hook tags.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    // A tuner and a metronome are used in practice rooms, backstage and on
    // trains: everything is client-side already, so the app should not need
    // the network at all after the first visit.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "favicon.png"],
      manifest: {
        name: "Music Lab",
        short_name: "Music Lab",
        description: "Instrument tuning, pitch and chord analysis, and a practice metronome.",
        theme_color: "#0b1020",
        background_color: "#0b1020",
        display: "standalone",
        start_url: "/tune",
        icons: [
          { src: "favicon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,woff,woff2}"],
        navigateFallback: "/index.html"
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue", "vue-router"],
          vuetify: ["vuetify"]
        }
      }
    }
  },
  test: {
    // Two suites: pure logic in Node, component behaviour in a DOM. Both
    // are unit-level — the Playwright smoke test stays for the things only
    // a real browser can answer.
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/components/**"]
        }
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "happy-dom",
          include: ["tests/components/**/*.test.ts"]
        }
      }
    ]
  }
});

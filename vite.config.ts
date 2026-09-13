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
        description: "Instrument tuning, a time-frequency trace, a practice metronome, and ear training with sight-singing.",
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
        navigateFallback: "/index.html",
        // The sampled tier fetches its banks from where they are published
        // rather than from this bundle, and a practice room has no signal.
        // Everything is cached on first use, so the second visit is offline
        // like the rest of the app.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/gleitz\.github\.io\/midi-js-soundfonts\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "soundfonts",
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // The kit's own nine files. A bank has no percussion, so this
            // is a second source and a second cache entry.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@teropa\/drumkit\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "drumkit",
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
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
          include: ["tests/components/**/*.test.ts"],
          // Vuetify components auto-imported into an SFC pull their own
          // CSS; inlining lets Vite handle it instead of Node's loader.
          server: { deps: { inline: ["vuetify"] } }
        }
      }
    ]
  }
});

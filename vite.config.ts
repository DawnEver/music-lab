/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import { readFileSync } from "node:fs";

// Single source of truth for the version: package.json, which is also what
// the pre-push hook tags.
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

export default defineConfig({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [vue(), vuetify({ autoImport: true })],
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

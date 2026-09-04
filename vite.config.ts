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
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});

/**
 * Tool-level routes, named for what the player is doing rather than for
 * the gadget: tune a note, look at a sound, follow a beat. Each tool owns
 * its own page and its own audio needs; the shell only provides
 * navigation.
 *
 * Clean history URLs are backed by the host's SPA fallback. Old links keep
 * working through redirects; the hash-route migration is legacy support
 * for bookmarks made before the router changed, and retires in v3.
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import type { MessageKey } from "../lib/i18n/index.js";

const LEGACY_HASH_ROUTES: Record<string, string> = {
  "/metronome": "/rhythm",
  "/tuner": "/tune",
  "/analyzer": "/tune"
};

/**
 * Convert bookmarks created by the former hash router before Vue reads the
 * URL. Retires in v3.0: compatibility code without an expiry only grows.
 */
export function migrateLegacyHashRoute(location: Location, history: History): void {
  const legacyPath = location.hash.slice(1).split(/[?#]/, 1)[0];
  const cleanPath = LEGACY_HASH_ROUTES[legacyPath];
  if (location.pathname === "/" && cleanPath) {
    history.replaceState(history.state, "", cleanPath);
  }
}

if (typeof window !== "undefined") {
  migrateLegacyHashRoute(window.location, window.history);
}

export interface ToolRoute {
  name: string;
  path: string;
  /** i18n key for the nav label. */
  labelKey: MessageKey;
  icon: string;
}

export const TOOLS: ToolRoute[] = [
  { name: "tune", path: "/tune", labelKey: "navTuning", icon: "♪" },
  { name: "trace", path: "/trace", labelKey: "navTrace", icon: "▚" },
  { name: "rhythm", path: "/rhythm", labelKey: "navMetronome", icon: "▮▯" },
  { name: "ear", path: "/ear", labelKey: "navEar", icon: "◉" }
];

const routes: RouteRecordRaw[] = [
  {
    path: "/tune",
    name: "tune",
    component: () => import("../features/tuning/TuningView.vue")
  },
  {
    path: "/trace",
    name: "trace",
    component: () => import("../features/trace/TraceView.vue")
  },
  {
    path: "/rhythm",
    name: "rhythm",
    component: () => import("../features/metronome/MetronomeView.vue")
  },
  {
    path: "/ear",
    name: "ear",
    component: () => import("../features/ear/EarView.vue")
  },
  { path: "/", redirect: "/tune" },
  { path: "/tuning", redirect: "/tune" },
  { path: "/tuner", redirect: "/tune" },
  { path: "/analyzer", redirect: "/tune" },
  { path: "/metronome", redirect: "/rhythm" },
  { path: "/scope", redirect: "/trace" },
  { path: "/:pathMatch(.*)*", redirect: "/tune" }
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.afterEach((route) => {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = new URL(route.path, "https://music.mingyangbao.site").href;
});

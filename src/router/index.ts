/**
 * Tool-level routes. Each tool owns its own page and its own audio needs;
 * the shell only provides navigation. Clean history URLs are backed by the
 * host's SPA fallback; old tuner/analyzer links remain compatible.
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const LEGACY_HASH_ROUTES: Record<string, string> = {
  "/metronome": "/metronome",
  "/tuner": "/tuning",
  "/analyzer": "/tuning"
};

/** Convert bookmarks created by the former hash router before Vue reads the URL. */
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
  labelKey: string;
  icon: string;
}

export const TOOLS: ToolRoute[] = [
  { name: "tuning", path: "/tuning", labelKey: "navTuning", icon: "♪" },
  { name: "metronome", path: "/metronome", labelKey: "navMetronome", icon: "▮▯" }
];

const routes: RouteRecordRaw[] = [
  {
    path: "/tuning",
    name: "tuning",
    component: () => import("../features/tuning/TuningView.vue")
  },
  {
    path: "/metronome",
    name: "metronome",
    component: () => import("../features/metronome/MetronomeView.vue")
  },
  { path: "/", redirect: "/tuning" },
  { path: "/tuner", redirect: "/tuning" },
  { path: "/analyzer", redirect: "/tuning" },
  { path: "/:pathMatch(.*)*", redirect: "/tuning" }
];

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
});

router.afterEach((route) => {
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical) canonical.href = new URL(route.path, "https://music.mingyangbao.site").href;
});

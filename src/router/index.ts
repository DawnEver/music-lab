/**
 * Tool-level routes. Each tool owns its own page and its own audio needs;
 * the shell only provides navigation. Hash history suits static hosting,
 * and the legacy "/" and "/analyzer" links land on the tuner.
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

export interface ToolRoute {
  name: string;
  path: string;
  /** i18n key for the nav label. */
  labelKey: string;
  icon: string;
}

export const TOOLS: ToolRoute[] = [
  { name: "tuning", path: "/tuner", labelKey: "navTuning", icon: "♪" },
  { name: "metronome", path: "/metronome", labelKey: "navMetronome", icon: "▮▯" }
];

const routes: RouteRecordRaw[] = [
  {
    path: "/tuner",
    name: "tuning",
    component: () => import("../features/tuning/TuningView.vue")
  },
  {
    path: "/metronome",
    name: "metronome",
    component: () => import("../features/metronome/MetronomeView.vue")
  },
  { path: "/", redirect: "/tuner" },
  { path: "/analyzer", redirect: "/tuner" },
  { path: "/:pathMatch(.*)*", redirect: "/tuner" }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});

/**
 * App routes. Hash history keeps static hosting (Vercel, Pages) free of
 * rewrite rules. The tuner is the landing tool of the lab; the analyzer
 * view carries the original pitch/chord/spectrum dashboard.
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const Placeholder = { template: "<div class='shell'><p>…</p></div>" };

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/tuner" },
  {
    path: "/tuner",
    name: "tuner",
    component: Placeholder
  },
  {
    path: "/analyzer",
    name: "analyzer",
    component: () => import("../views/AnalyzerView.vue")
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});

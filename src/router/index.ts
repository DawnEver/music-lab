/**
 * App routes. A single workbench page hosts every tool as a collapsible
 * panel; the legacy #/tuner and #/analyzer links redirect here so old
 * bookmarks keep working. Hash history suits static hosting.
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "workbench",
    component: () => import("../views/Dashboard.vue")
  },
  { path: "/tuner", redirect: "/" },
  { path: "/analyzer", redirect: "/" }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});

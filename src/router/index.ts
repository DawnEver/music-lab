/**
 * App routes. All three paths render the same workbench dashboard; the
 * legacy #/tuner and #/analyzer links become focus modes that show only
 * that tool. Hash history keeps static hosting free of rewrite rules.
 */

import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "workbench",
    component: () => import("../views/Dashboard.vue")
  },
  {
    path: "/tuner",
    name: "tuner",
    component: () => import("../views/Dashboard.vue"),
    props: { focus: "tuner" }
  },
  {
    path: "/analyzer",
    name: "analyzer",
    component: () => import("../views/Dashboard.vue"),
    props: { focus: "analyzer" }
  }
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes
});

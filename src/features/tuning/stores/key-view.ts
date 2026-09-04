/**
 * How the tuning tool displays key: detected automatically, or pinned by
 * the player. Purely a display choice, so it stays with the feature rather
 * than with the analysis.
 */

import { reactive } from "vue";
import type { ModeKey } from "../../../lib/key.js";

export const keyView = reactive({
  mode: "auto" as "auto" | "manual",
  tonic: 0,
  scale: "major" as ModeKey
});

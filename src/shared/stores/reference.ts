/**
 * The pitch the player is currently working towards.
 *
 * The tuner knows it (the string or hole being tuned) and the trace wants
 * to draw it, but features may not import each other — and rightly so.
 * A reference pitch is not a tuning concept anyway; it is a shared idea
 * with a publisher and a subscriber, so it lives here.
 */

import { reactive } from "vue";

export interface ReferencePitch {
  midi: number;
  /** Localized name of what produces it, e.g. a string or a hole. */
  label: { zh: string; en: string };
}

export const reference = reactive({
  /** Null when nothing is selected, or when the publisher went away. */
  current: null as ReferencePitch | null
});

export function publishReference(value: ReferencePitch | null): void {
  reference.current = value;
}

/** A publisher clears its own contribution when it unmounts. */
export function clearReference(): void {
  reference.current = null;
}

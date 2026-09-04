/**
 * Declare that this view needs the app's audio input while it is mounted.
 *
 * The input session outlives any one tool — the player chose a microphone
 * once — but it must not outlive every tool that has a use for it.
 */

import { onBeforeUnmount, onMounted } from "vue";
import { inputRetention } from "../audio/session.js";

export function useAudioInput(): void {
  onMounted(() => inputRetention.retain());
  onBeforeUnmount(() => inputRetention.release());
}

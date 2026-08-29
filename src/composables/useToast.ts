/**
 * Toast surface backed by the audio store (single snackbar instance).
 */

import { toastMessage, toastVisible, showToast } from "../features/tuning/stores/audio.js";

export function useToast() {
  return { toastMessage, toastVisible, showToast };
}

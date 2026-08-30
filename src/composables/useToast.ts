/** Shared application toast surface (single snackbar instance). */

import { toastMessage, toastVisible, showToast } from "../shared/stores/toast.js";

export function useToast() {
  return { toastMessage, toastVisible, showToast };
}

import { ref } from "vue";

export const toastMessage = ref("");
export const toastVisible = ref(false);

let toastTimer = 0;

export function showToast(message: string): void {
  window.clearTimeout(toastTimer);
  toastMessage.value = message;
  toastVisible.value = true;
  toastTimer = window.setTimeout(() => {
    toastVisible.value = false;
  }, 4200);
}

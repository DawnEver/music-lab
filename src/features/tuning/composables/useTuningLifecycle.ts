import { onBeforeUnmount, onMounted } from "vue";
import { cleanup, populateDevices } from "../../../audio/session.js";
import { useAudioInput } from "../../../composables/useAudioInput.js";

/**
 * Browser lifecycle the tuning tool needs. The input session is not torn
 * down here: it belongs to the app, and `useAudioInput` stops it only once
 * no tool that uses input is left on screen.
 */
export function useTuningLifecycle(): void {
  const mediaDevices = navigator.mediaDevices;
  const handleDeviceChange = (): void => {
    void populateDevices();
  };

  useAudioInput();

  onMounted(() => {
    window.addEventListener("beforeunload", cleanup);
    mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", cleanup);
    mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
  });
}

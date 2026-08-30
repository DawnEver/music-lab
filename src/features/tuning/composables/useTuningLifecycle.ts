import { onBeforeUnmount, onMounted } from "vue";
import { cleanup, populateDevices, stop } from "../stores/audio.js";

/** Own browser lifecycle wiring that only the tuning tool needs. */
export function useTuningLifecycle(): void {
  const mediaDevices = navigator.mediaDevices;
  const handleDeviceChange = (): void => {
    void populateDevices();
  };

  onMounted(() => {
    window.addEventListener("beforeunload", cleanup);
    mediaDevices?.addEventListener?.("devicechange", handleDeviceChange);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("beforeunload", cleanup);
    mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
    void stop();
  });
}

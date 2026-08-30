import { t } from "../../../composables/useI18n.js";
import { audioStore } from "./audio-state.js";

export async function populateDevices(): Promise<void> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  try {
    const previousValue = audioStore.deviceId;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter((device) => device.kind === "audioinput");

    audioStore.devices = microphones.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || t("micNumber", { index: index + 1 })
    }));

    if (
      previousValue &&
      microphones.some((device) => device.deviceId === previousValue)
    ) {
      audioStore.deviceId = previousValue;
    } else {
      audioStore.deviceId = "";
    }
  } catch (error) {
    console.warn(t("cannotEnumerate"), error);
  }
}


import { t } from "../composables/useI18n.js";
import { sourceStore } from "./source.js";

export async function populateDevices(): Promise<void> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

  try {
    const previousValue = sourceStore.deviceId;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const microphones = devices.filter((device) => device.kind === "audioinput");

    sourceStore.devices = microphones.map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || t("micNumber", { index: index + 1 })
    }));

    if (
      previousValue &&
      microphones.some((device) => device.deviceId === previousValue)
    ) {
      sourceStore.deviceId = previousValue;
    } else {
      sourceStore.deviceId = "";
    }
  } catch (error) {
    console.warn(t("cannotEnumerate"), error);
  }
}


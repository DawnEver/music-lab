<script setup lang="ts">
/**
 * The input, as one control.
 *
 * This used to be three: a button row, a device picker with a label, a
 * status pill that restated the button, a sentence about privacy, and a
 * separate level meter. All of them answered one question — is the app
 * listening, and to what — and answering it five times is what made the
 * top of every page a wall.
 *
 * So: one button that says what it will do next, the live level inside it,
 * and the device picker only when there is a choice to make. The session
 * is application-level, so once it is running every tool shows it running;
 * nobody is asked for a microphone twice.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useAudioSource } from "../../composables/useAudioSource.js";
import { useAnalysis } from "../../composables/useAnalysis.js";
import { useI18n } from "../../composables/useI18n.js";
import { setAudioHostContainer } from "../../audio/session.js";
import { clamp } from "../../lib/dsp.js";

const { sourceStore: store, startMic, startFile, stop, populateDevices } = useAudioSource();
const { level } = useAnalysis();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const hostEl = ref<HTMLElement | null>(null);

const live = computed(() => store.mode !== "idle");

/** Fills the button while sound is coming in — the meter is the control. */
const levelPercent = computed(() => {
  const rmsDb = level.value?.rmsDb;
  if (!live.value || rmsDb == null || !Number.isFinite(rmsDb)) return 0;
  return clamp((rmsDb + 72) / 72, 0, 1) * 100;
});

const detail = computed(() =>
  store.sourceInfoOverride || t(store.sourceInfoKey, store.sourceInfoParams)
);

function toggle(): void {
  if (live.value) void stop();
  else void startMic();
}

function onFileChange(event: Event): void {
  startFile((event.target as HTMLInputElement).files?.[0]);
}

function onDeviceChange(): void {
  if (store.mode === "mic") startMic();
}

onMounted(() => {
  setAudioHostContainer(hostEl.value);
  populateDevices();
});

onBeforeUnmount(() => {
  setAudioHostContainer(null);
});
</script>

<template>
  <div class="audio-source" :data-state="store.statusMode">
    <button
      class="audio-toggle"
      :class="{ 'is-live': live }"
      type="button"
      :disabled="store.isStarting"
      :aria-pressed="live"
      data-source-toggle
      @click="toggle"
    >
      <span class="audio-level" :style="{ width: `${levelPercent}%` }" aria-hidden="true"></span>
      <span class="audio-dot" aria-hidden="true"></span>
      <span class="audio-label">{{ live ? t("stop") : t("micButton") }}</span>
    </button>

    <label
      class="audio-file"
      for="fileInput"
      tabindex="0"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
    >
      <span aria-hidden="true">↗</span>
      <span>{{ t("openAudio") }}</span>
    </label>
    <input id="fileInput" ref="fileInput" type="file" accept="audio/*" hidden @change="onFileChange" />

    <select
      v-if="store.devices.length > 1"
      v-model="store.deviceId"
      class="audio-device"
      :aria-label="t('selectMic')"
      @change="onDeviceChange"
    >
      <option value="">{{ t("defaultMic") }}</option>
      <option v-for="device in store.devices" :key="device.deviceId" :value="device.deviceId">
        {{ device.label }}
      </option>
    </select>

    <span class="audio-detail" data-source-detail>{{ detail }}</span>

    <div ref="hostEl" class="audio-host"></div>
  </div>
</template>

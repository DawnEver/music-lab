<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useAudio } from "../../../composables/useAudio.js";
import { useI18n } from "../../../composables/useI18n.js";
import { setAudioHostContainer } from "../stores/audio.js";

const { audioStore: store, startMic, startFile, stop, populateDevices } = useAudio();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const hostEl = ref<HTMLElement | null>(null);

const active = computed(() => store.mode !== "idle");

const micButtonText = computed(() =>
  store.mode === "file" ? t("switchMic") : store.mode === "mic" ? t("micRunning") : t("micButton")
);

const sourceInfoText = computed(() =>
  store.sourceInfoOverride || t(store.sourceInfoKey, store.sourceInfoParams)
);

function onFileChange(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0];
  startFile(file);
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
  <div class="button-row source-actions">
    <button
      class="btn primary"
      type="button"
      :disabled="store.isStarting || store.mode === 'mic'"
      @click="startMic()"
    >
      <span class="btn-icon" aria-hidden="true">●</span>
      <span>{{ micButtonText }}</span>
    </button>

    <label
      class="file-btn"
      for="fileInput"
      tabindex="0"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
    >
      <span class="btn-icon" aria-hidden="true">↗</span>
      <span>{{ t("openAudio") }}</span>
    </label>
    <input id="fileInput" ref="fileInput" type="file" accept="audio/*" hidden @change="onFileChange" />

    <button
      class="btn ghost"
      type="button"
      :disabled="!active && !store.isStarting"
      @click="stop()"
    >
      <span class="btn-icon" aria-hidden="true">■</span>
      <span>{{ t("stop") }}</span>
    </button>
  </div>

  <div class="source-device">
    <span class="source-device-label">{{ t("micDevice") }}</span>
    <select
      v-model="store.deviceId"
      :disabled="store.devices.length === 0"
      :aria-label="t('selectMic')"
      @change="onDeviceChange"
    >
      <option value="">{{ t("defaultMic") }}</option>
      <option v-for="device in store.devices" :key="device.deviceId" :value="device.deviceId">
        {{ device.label }}
      </option>
    </select>
  </div>

  <div class="source-info">{{ sourceInfoText }}</div>

  <div ref="hostEl" class="audio-host"></div>
</template>

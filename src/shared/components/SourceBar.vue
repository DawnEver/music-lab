<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useAudioSource } from "../../composables/useAudioSource.js";
import { useI18n } from "../../composables/useI18n.js";
import { setAudioHostContainer } from "../../audio/session.js";

const { sourceStore: store, startMic, startFile, stop, populateDevices } = useAudioSource();
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const hostEl = ref<HTMLElement | null>(null);

const active = computed(() => store.mode !== "idle");

// One control for one thing: is a source live or not. Pressing it starts
// the microphone when nothing is running and stops whatever is running
// otherwise, so the button always states what it will do next.
const sourceButtonText = computed(() => (active.value ? t("stop") : t("micButton")));

function toggleSource(): void {
  if (active.value) void stop();
  else void startMic();
}

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
      class="btn"
      :class="active ? 'ghost is-live' : 'primary'"
      type="button"
      :disabled="store.isStarting"
      :aria-pressed="active"
      @click="toggleSource()"
    >
      <span class="btn-icon" aria-hidden="true">{{ active ? "■" : "●" }}</span>
      <span>{{ sourceButtonText }}</span>
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

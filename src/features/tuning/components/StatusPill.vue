<script setup lang="ts">
import { audioStore } from "../stores/audio.js";
import { useI18n } from "../../../composables/useI18n.js";

const { t } = useI18n();
</script>

<template>
  <div class="status-pill" :data-state="audioStore.statusMode" role="status" aria-live="polite">
    <span class="status-dot" aria-hidden="true"></span>
    <span>{{ t(audioStore.statusKey) }}</span>
  </div>
</template>

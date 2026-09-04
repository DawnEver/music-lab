<script setup lang="ts">
import { sourceStore } from "../../audio/source.js";
import { useI18n } from "../../composables/useI18n.js";

const { t } = useI18n();
</script>

<template>
  <div class="status-pill" :data-state="sourceStore.statusMode" role="status" aria-live="polite">
    <span class="status-dot" aria-hidden="true"></span>
    <span>{{ t(sourceStore.statusKey) }}</span>
  </div>
</template>

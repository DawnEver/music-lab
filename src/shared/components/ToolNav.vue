<script setup lang="ts">
/** Top-level tool switcher — one Shell, many music tools. */
import { useI18n } from "../../composables/useI18n.js";
import { TOOLS } from "../../router/index.js";

const { t } = useI18n();
</script>

<template>
  <nav class="tool-nav" :aria-label="t('navLabel')">
    <RouterLink
      v-for="tool in TOOLS"
      :key="tool.name"
      class="tool-nav-link"
      :to="tool.path"
      :data-tool-link="tool.name"
    >
      <span class="tool-nav-icon" aria-hidden="true">{{ tool.icon }}</span>
      <span>{{ t(tool.labelKey) }}</span>
    </RouterLink>
  </nav>
</template>

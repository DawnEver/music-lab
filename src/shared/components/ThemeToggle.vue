<script setup lang="ts">
import { useTheme } from "../../composables/useTheme.js";
import { useI18n } from "../../composables/useI18n.js";

const { theme, toggleTheme } = useTheme();
const { t } = useI18n();
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="t('themeToggleAria')"
    :title="t(theme === 'dark' ? 'themeToLight' : 'themeToDark')"
    @click="toggleTheme"
  >
    <svg
      v-if="theme === 'dark'"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m13.4 13.4 1.4 1.4m0-16.2-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </svg>
    <svg v-else viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
      />
    </svg>
  </button>
</template>

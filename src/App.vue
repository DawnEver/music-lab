<script setup lang="ts">
import { useI18n } from "./composables/useI18n.js";

const { t } = useI18n();
</script>

<template>
  <div class="shell">
    <h1>{{ t("appTitle") }}</h1>
    <p>{{ t("sourceInfoDefault") }}</p>
    <router-view />
  </div>
</template>

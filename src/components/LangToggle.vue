<script setup lang="ts">
import { useI18n } from "../composables/useI18n.js";

const { lang, setLang, t } = useI18n();
</script>

<template>
  <div class="lang-toggle" role="group" :aria-label="t('languageAria')">
    <button type="button" :class="{ 'is-active': lang === 'zh' }" @click="setLang('zh')">中</button>
    <button type="button" :class="{ 'is-active': lang === 'en' }" @click="setLang('en')">EN</button>
  </div>
</template>

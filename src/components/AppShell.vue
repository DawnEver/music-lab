<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "../composables/useI18n.js";
import SourceBar from "./SourceBar.vue";
import LangToggle from "./LangToggle.vue";
import StatusPill from "./StatusPill.vue";
import Toaster from "./Toaster.vue";

const { t } = useI18n();

const showSecureNotice = computed(
  () =>
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
);
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">♫</div>
        <div>
          <p class="eyebrow">{{ t("eyebrow") }}</p>
          <h1>{{ t("appTitle") }}</h1>
        </div>
      </div>

      <div class="topbar-tools">
        <SourceBar />
        <LangToggle />
        <StatusPill />
      </div>
    </header>

    <div v-if="showSecureNotice" class="notice">
      <span aria-hidden="true">⚠</span>
      <div>
        <strong>{{ t("secureNoticeTitle") }}</strong>
        <span>{{ t("secureNoticeBody") }}</span>
      </div>
    </div>

    <main class="dashboard">
      <RouterView />
    </main>

    <p class="footnote">
      <strong>{{ t("footnoteLabel") }}：</strong><span>{{ t("footnoteText") }}</span>
    </p>

    <footer class="footer text-center">
      <span>{{ t("copyrights") }}</span>
      <br />
      <a href="mailto:mingyangbob@gmail.com" rel="noreferrer" target="_blank">mingyangbob@gmail.com</a>
      <br />
      <a href="https://github.com/DawnEver/tone-chord-lab" rel="noreferrer" target="_blank">GitHub</a>
    </footer>

    <Toaster />
  </div>
</template>

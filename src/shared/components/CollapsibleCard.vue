<script setup lang="ts">
import { computed } from "vue";
import { isOpen, toggle, type PanelId } from "../stores/panels.js";
import { useI18n } from "../../composables/useI18n.js";

const props = defineProps<{
  panelId: PanelId;
  title: string;
  /** Card variant classes (card--wide / card--tall / card--stack / card--glow*). */
  panelClass?: string;
}>();

const open = computed(() => isOpen(props.panelId));
const { t } = useI18n();

function onToggle(): void {
  toggle(props.panelId);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onToggle();
  }
}
</script>

<template>
  <section class="card" :class="[panelClass, { 'is-collapsed': !open }]" :data-panel="panelId" :aria-labelledby="`${panelId}Title`">
    <div
      class="card-toggle"
      role="button"
      tabindex="0"
      :aria-expanded="open"
      :aria-controls="`panel-${panelId}`"
      @click="onToggle"
      @keydown="onKeydown"
    >
      <div class="card-head">
        <h2 class="section-title" :id="`${panelId}Title`">{{ title }}</h2>
        <!-- The badge is content state (waiting/0% match/FFT meta), so it
             collapses with the body instead of lingering in the header. -->
        <slot v-if="open" name="badge" />
        <span v-if="!open" class="card-expand-hint">{{ t("panelExpandHint") }}</span>
        <span class="card-chevron" :class="{ 'is-open': open }" aria-hidden="true">▾</span>
      </div>
    </div>

    <div v-if="open" :id="`panel-${panelId}`" class="panel-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { isOpen, toggle, type PanelId } from "../stores/panels.js";

const props = defineProps<{
  panelId: PanelId;
  label: string;
  title: string;
  /** Extra section class for the legacy card styling hooks (e.g. "metric-card pitch"). */
  panelClass?: string;
}>();

const open = computed(() => isOpen(props.panelId));

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
  <section class="card" :class="[panelClass, { 'is-collapsed': !open }]" :aria-labelledby="`${panelId}Title`">
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
        <div>
          <p class="section-label">{{ label }}</p>
          <h2 class="section-title" :id="`${panelId}Title`">{{ title }}</h2>
        </div>
        <slot name="badge" />
        <span class="card-chevron" :class="{ 'is-open': open }" aria-hidden="true">▾</span>
      </div>
    </div>

    <div v-if="open" :id="`panel-${panelId}`" class="panel-body">
      <slot />
    </div>
  </section>
</template>

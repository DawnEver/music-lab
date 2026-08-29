<script lang="ts">
import { ref } from "vue";

/**
 * Module scope, not component scope: only one sheet may be open at a
 * time, and opening one closes the rest without any store.
 */
const openSheet = ref("");

export function closeAllSheets(): void {
  openSheet.value = "";
}
</script>

<script setup lang="ts">
/**
 * A value chip that opens its own editor.
 *
 * The chip shows the current value; tapping it reveals exactly the
 * controls that change that value — anchored to the chip on desktop, a
 * bottom sheet on small screens. Settings live where they are displayed
 * instead of in a separate panel the user has to go find.
 */
import { computed, onBeforeUnmount, watch } from "vue";
import { useI18n } from "../../composables/useI18n.js";

const props = defineProps<{
  /** Unique id; opening one sheet closes the others. */
  name: string;
  label: string;
  /** Current value, shown on the default chip trigger. */
  value?: string;
  /** Anchor edge of the popover on desktop. */
  align?: "start" | "center" | "end";
}>();

const { t } = useI18n();

const anchor = ref<HTMLElement | null>(null);
const open = computed(() => openSheet.value === props.name);

function toggle(): void {
  openSheet.value = open.value ? "" : props.name;
}

function close(): void {
  if (open.value) openSheet.value = "";
}

function onDocumentPointer(event: Event): void {
  if (!anchor.value?.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener("pointerdown", onDocumentPointer);
    document.addEventListener("keydown", onKeydown);
  } else {
    document.removeEventListener("pointerdown", onDocumentPointer);
    document.removeEventListener("keydown", onKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", onDocumentPointer);
  document.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div ref="anchor" class="sheet-anchor" :data-sheet="name">
    <!-- The trigger defaults to a labelled value chip, but any readout
         can act as its own control (the BPM number does). -->
    <slot name="trigger" :open="open" :toggle="toggle">
      <button
        type="button"
        class="value-chip"
        :class="{ 'is-open': open }"
        :aria-expanded="open"
        aria-haspopup="dialog"
        @click="toggle"
      >
        <span class="value-chip-label">{{ label }}</span>
        <span class="value-chip-value">{{ value }}</span>
        <span class="value-chip-caret" aria-hidden="true">▾</span>
      </button>
    </slot>

    <div v-if="open" class="sheet-backdrop" @click="close" />

    <div
      v-if="open"
      class="sheet"
      :class="`is-${align ?? 'start'}`"
      role="dialog"
      :aria-label="label"
    >
      <div class="sheet-head">
        <span class="sheet-title">{{ label }}</span>
        <button type="button" class="sheet-close" :aria-label="t('metroClose')" @click="close">✕</button>
      </div>
      <div class="sheet-body">
        <slot />
      </div>
    </div>
  </div>
</template>

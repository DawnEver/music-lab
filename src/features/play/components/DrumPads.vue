<script setup lang="ts">
/**
 * The kit, as pads.
 *
 * A pad is not a key: there is nothing to hold, so it lights for a moment
 * and the sound finishes on its own. Placement is data — the metal on top
 * where a right hand lives, the drums below — so adding a piece is a row.
 */
import { computed } from "vue";
import { useI18n } from "../../../composables/useI18n.js";
import type { KitPiece } from "../../../instruments/index.js";

const props = defineProps<{
  pieces: KitPiece[];
  struck: Set<string>;
}>();

const emit = defineEmits<{ (event: "hit", pieceId: string): void }>();

const { t } = useI18n();

const rows = computed(() => {
  const byRow = new Map<number, KitPiece[]>();
  for (const piece of props.pieces) {
    const row = byRow.get(piece.row) ?? [];
    row.push(piece);
    byRow.set(piece.row, row);
  }
  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, items]) => ({ row, items: items.sort((a, b) => a.column - b.column) }));
});

/** The letter engraved on the pad — the key that strikes it. */
function keyCap(code: string): string {
  return code.replace(/^Key/, "");
}
</script>

<template>
  <div class="pad-grid">
    <div v-for="row in rows" :key="row.row" class="pad-row">
      <button
        v-for="piece in row.items"
        :key="piece.id"
        type="button"
        class="pad"
        :class="{ 'is-hit': struck.has(piece.id) }"
        :data-piece="piece.id"
        @pointerdown.prevent="emit('hit', piece.id)"
      >
        <span class="pad-name">{{ t(`kit.${piece.id}`) }}</span>
        <span class="pad-cap">{{ keyCap(piece.code) }}</span>
      </button>
    </div>
  </div>
</template>

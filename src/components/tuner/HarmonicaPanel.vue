<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { midiToFrequency, NOTE_NAMES } from "../../lib/music-theory.js";
import { formatCents } from "../../lib/format.js";
import { useAnalysis } from "../../composables/useAnalysis.js";
import { useI18n } from "../../composables/useI18n.js";
import { useTuner } from "../../composables/useTuner.js";
import { stringStatus, type Breath, type HarmonicaCell, type StringStatus } from "../../instruments/index.js";
import { audioStore } from "../../stores/audio.js";

const { t } = useI18n();
const tuner = useTuner();
const { pitch, tick } = useAnalysis();

const { harmonicaCells, activeCell, autoMatch, autoMode, selectPosition, clearSelection } = tuner;

const expanded = ref<{ hole: number; breath: Breath } | null>(null);

interface CellDisplay {
  status: StringStatus;
  centsText: string;
  activeIndex: number | null;
  isAuto: boolean;
}

const display = reactive<Record<string, CellDisplay>>({});
const positionDisplays = reactive<Array<{ status: StringStatus; centsText: string }>>([]);

function cellBy(hole: number, breath: Breath): HarmonicaCell | undefined {
  return harmonicaCells.value.find((cell) => cell.hole === hole && cell.breath === breath);
}

function cellKey(hole: number, breath: Breath): string {
  return `${hole}-${breath}`;
}

function syncDisplays(): void {
  const p = pitch.value;
  const hasSignal = Boolean(p && p.confidence >= 0.35);
  const confidence = p?.confidence ?? 0;

  for (const cell of harmonicaCells.value) {
    const key = cellKey(cell.hole, cell.breath);
    const auto =
      autoMatch.value && autoMatch.value.hole === cell.hole && autoMatch.value.breath === cell.breath
        ? { index: autoMatch.value.positionIndex, cents: autoMatch.value.cents }
        : null;
    const manual =
      activeCell.value && activeCell.value.hole === cell.hole && activeCell.value.breath === cell.breath
        ? { index: activeCell.value.positionIndex, midi: activeCell.value.midi }
        : null;

    const activeIndex = auto?.index ?? manual?.index ?? null;
    let cents = 0;
    if (auto) {
      cents = auto.cents;
    } else if (manual && p) {
      cents = 1200 * Math.log2(p.frequency / midiToFrequency(manual.midi, audioStore.tuning));
    }
    const status = activeIndex == null ? "idle" : stringStatus(cents, hasSignal, confidence);
    const text = status === "idle" ? "" : formatCents(cents);

    const current = display[key] ?? (display[key] = { status: "idle", centsText: "", activeIndex: null, isAuto: false });
    if (
      current.status !== status ||
      current.centsText !== text ||
      current.activeIndex !== activeIndex ||
      current.isAuto !== Boolean(auto)
    ) {
      current.status = status;
      current.centsText = text;
      current.activeIndex = activeIndex;
      current.isAuto = Boolean(auto);
    }
  }

  const cell = expanded.value ? cellBy(expanded.value.hole, expanded.value.breath) : null;
  if (cell) {
    while (positionDisplays.length < cell.positions.length) {
      positionDisplays.push({ status: "idle", centsText: "" });
    }
    cell.positions.forEach((position, index) => {
      const target = midiToFrequency(position.midi, audioStore.tuning);
      const cents = p ? 1200 * Math.log2(p.frequency / target) : 0;
      const status = stringStatus(cents, hasSignal, confidence);
      const text = status === "idle" ? "" : formatCents(cents);
      if (positionDisplays[index].status !== status || positionDisplays[index].centsText !== text) {
        positionDisplays[index].status = status;
        positionDisplays[index].centsText = text;
      }
    });
  }
}

// Clicking a cell both expands its positions and pins it as the tuner
// target (the plain note, position 0); clicking it again releases the
// target back to auto-follow.
function toggleCell(hole: number, breath: Breath): void {
  const current = expanded.value;
  if (current && current.hole === hole && current.breath === breath) {
    expanded.value = null;
    clearSelection();
  } else {
    expanded.value = { hole, breath };
    selectPosition(hole, breath, 0);
  }
  syncDisplays();
}

function positionKindText(kind: string, bendLevel?: number): string {
  if (kind === "bend") {
    return t((bendLevel ?? 0) >= 3 ? "tuner.kind.deepBend" : "tuner.kind.bend", { level: bendLevel ?? 0 });
  }
  return t(`tuner.kind.${kind}`);
}

function noteName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

watch(
  () => tuner.preset.value?.id,
  () => {
    expanded.value = null;
    syncDisplays();
  },
  { immediate: true }
);

watch(tick, syncDisplays);
</script>

<template>
  <div class="harmonica">
    <div class="harmonica-grid" :aria-label="t('tunerSelectTuning')">
      <div class="harmonica-grid-head">#</div>
      <div class="harmonica-grid-head">{{ t("tunerBlow") }}</div>
      <div class="harmonica-grid-head">{{ t("tunerDraw") }}</div>

      <template v-for="hole in 10" :key="hole">
        <div class="harmonica-hole-label">{{ hole }}</div>
        <div
          v-for="breath in (['blow', 'draw'] as const)"
          :key="breath"
          class="harmonica-cell"
          role="button"
          :tabindex="0"
          :class="[
            `st-${display[cellKey(hole, breath)]?.status ?? 'idle'}`,
            {
              'is-auto': autoMode && display[cellKey(hole, breath)]?.isAuto,
              'is-expanded':
                expanded &&
                expanded.hole === hole &&
                expanded.breath === breath
            }
          ]"
          @click="toggleCell(hole, breath)"
          @keydown.enter.prevent="toggleCell(hole, breath)"
          @keydown.space.prevent="toggleCell(hole, breath)"
        >
          <span class="cell-note">
            {{ noteName(cellBy(hole, breath)?.positions[0]?.midi ?? 0) }}
          </span>
          <span
            v-if="(display[cellKey(hole, breath)]?.activeIndex ?? 0) > 0"
            class="cell-badge"
          >
            {{
              positionKindText(
                cellBy(hole, breath)?.positions[display[cellKey(hole, breath)].activeIndex ?? 0]?.kind ?? '',
                cellBy(hole, breath)?.positions[display[cellKey(hole, breath)].activeIndex ?? 0]?.bendLevel
              )
            }}
          </span>
          <span v-if="display[cellKey(hole, breath)]?.centsText" class="cell-cents">
            {{ display[cellKey(hole, breath)]?.centsText }}
          </span>
        </div>
      </template>
    </div>

    <div v-if="expanded" class="harmonica-expand">
      <p class="expand-title">
        {{ t("tunerHole", { hole: expanded.hole }) }} ·
        {{ expanded.breath === "blow" ? t("tunerBlow") : t("tunerDraw") }} ·
        {{ t("tunerExpand") }}
      </p>
      <div class="position-chips">
        <button
          v-for="(position, index) in cellBy(expanded.hole, expanded.breath)?.positions ?? []"
          :key="index"
          class="position-chip"
          :class="[
            `st-${positionDisplays[index]?.status ?? 'idle'}`,
            { 'is-selected': activeCell?.hole === expanded.hole && activeCell?.breath === expanded.breath && activeCell?.positionIndex === index }
          ]"
          @click="selectPosition(expanded.hole, expanded.breath, index)"
        >
          <span class="chip-kind">{{ positionKindText(position.kind, position.bendLevel) }}</span>
          <span class="chip-note">{{ noteName(position.midi) }}</span>
          <span class="chip-cents">{{ positionDisplays[index]?.centsText ?? "" }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

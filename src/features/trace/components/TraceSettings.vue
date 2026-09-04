<script setup lang="ts">
/**
 * How the trace looks. Reached from the chip that shows the value it
 * changes, so the trace stays one canvas rather than a canvas plus a
 * settings panel.
 */
import { useI18n } from "../../../composables/useI18n.js";
import { COLORMAP_IDS, type ColormapId } from "../../../lib/colormap.js";
import { setHistoryResolution, type ResolutionId } from "../../../audio/history.js";
import { persistTrace, traceView } from "../stores/trace.js";

const { t } = useI18n();
const RESOLUTIONS: ResolutionId[] = ["time", "balanced", "frequency"];

function setResolution(id: ResolutionId): void {
  traceView.resolution = id;
  setHistoryResolution(id);
  persistTrace();
}

function setColormap(id: ColormapId): void {
  traceView.colormap = id;
  persistTrace();
}

function setFloor(value: number): void {
  // The floor may not cross the ceiling, or the ramp inverts.
  traceView.floorDb = Math.min(value, traceView.ceilingDb - 10);
  persistTrace();
}

function setCeiling(value: number): void {
  traceView.ceilingDb = Math.max(value, traceView.floorDb + 10);
  persistTrace();
}
</script>

<template>
  <div class="control-group">
    <div class="metro-field">
      <span class="slider-label">{{ t("traceColormap") }}</span>
      <div class="metro-chips">
        <button
          v-for="id in COLORMAP_IDS"
          :key="id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': traceView.colormap === id }"
          @click="setColormap(id)"
        >
          {{ t(`colormap.${id}`) }}
        </button>
      </div>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("traceResolution") }}</span>
      <div class="metro-chips">
        <button
          v-for="id in RESOLUTIONS"
          :key="id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': traceView.resolution === id }"
          @click="setResolution(id)"
        >
          {{ t(`traceResolution.${id}`) }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("traceFloor") }}</span>
        <output class="slider-output">{{ String(traceView.floorDb).replace("-", "−") }} dB</output>
      </div>
      <v-slider
        :min="-120"
        :max="-40"
        :step="5"
        :model-value="traceView.floorDb"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setFloor(value)"
      />
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("traceCeiling") }}</span>
        <output class="slider-output">{{ String(traceView.ceilingDb).replace("-", "−") }} dB</output>
      </div>
      <v-slider
        :min="-60"
        :max="0"
        :step="5"
        :model-value="traceView.ceilingDb"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setCeiling(value)"
      />
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("traceHarmonics") }}</span>
      <div class="metro-chips">
        <button
          type="button"
          class="metro-chip"
          :class="{ 'is-active': traceView.showHarmonics }"
          @click="traceView.showHarmonics = !traceView.showHarmonics; persistTrace()"
        >
          2× 3× 4×
        </button>
      </div>
    </div>
  </div>
</template>

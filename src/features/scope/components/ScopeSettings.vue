<script setup lang="ts">
/**
 * How the scope looks. Reached from the chip that shows the value it
 * changes, so the scope stays one canvas rather than a canvas plus a
 * settings panel.
 */
import { useI18n } from "../../../composables/useI18n.js";
import { COLORMAP_IDS, type ColormapId } from "../../../lib/colormap.js";
import { setHistoryResolution, type ResolutionId } from "../../../audio/history.js";
import { persistScope, scope } from "../stores/scope.js";

const { t } = useI18n();
const RESOLUTIONS: ResolutionId[] = ["time", "balanced", "frequency"];

function setResolution(id: ResolutionId): void {
  scope.resolution = id;
  setHistoryResolution(id);
  persistScope();
}

function setColormap(id: ColormapId): void {
  scope.colormap = id;
  persistScope();
}

function setFloor(value: number): void {
  // The floor may not cross the ceiling, or the ramp inverts.
  scope.floorDb = Math.min(value, scope.ceilingDb - 10);
  persistScope();
}

function setCeiling(value: number): void {
  scope.ceilingDb = Math.max(value, scope.floorDb + 10);
  persistScope();
}
</script>

<template>
  <div class="control-group">
    <div class="metro-field">
      <span class="slider-label">{{ t("scopeColormap") }}</span>
      <div class="metro-chips">
        <button
          v-for="id in COLORMAP_IDS"
          :key="id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': scope.colormap === id }"
          @click="setColormap(id)"
        >
          {{ t(`colormap.${id}`) }}
        </button>
      </div>
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("scopeResolution") }}</span>
      <div class="metro-chips">
        <button
          v-for="id in RESOLUTIONS"
          :key="id"
          type="button"
          class="metro-chip"
          :class="{ 'is-active': scope.resolution === id }"
          @click="setResolution(id)"
        >
          {{ t(`scopeResolution.${id}`) }}
        </button>
      </div>
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("scopeFloor") }}</span>
        <output class="slider-output">{{ String(scope.floorDb).replace("-", "−") }} dB</output>
      </div>
      <v-slider
        :min="-120"
        :max="-40"
        :step="5"
        :model-value="scope.floorDb"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setFloor(value)"
      />
    </div>

    <div class="slider-field">
      <div class="slider-head">
        <span class="slider-label">{{ t("scopeCeiling") }}</span>
        <output class="slider-output">{{ String(scope.ceilingDb).replace("-", "−") }} dB</output>
      </div>
      <v-slider
        :min="-60"
        :max="0"
        :step="5"
        :model-value="scope.ceilingDb"
        hide-details
        density="compact"
        @update:model-value="(value: number) => setCeiling(value)"
      />
    </div>

    <div class="metro-field">
      <span class="slider-label">{{ t("scopeHarmonics") }}</span>
      <div class="metro-chips">
        <button
          type="button"
          class="metro-chip"
          :class="{ 'is-active': scope.showHarmonics }"
          @click="scope.showHarmonics = !scope.showHarmonics; persistScope()"
        >
          2× 3× 4×
        </button>
      </div>
    </div>
  </div>
</template>

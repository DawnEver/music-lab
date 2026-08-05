<script setup lang="ts">
import { computed } from "vue";

/** Centered needle gauge for cents deviation (expects cents in −50..+50). */
const props = defineProps<{ cents: number }>();

const needleLeft = computed(() => `${50 + props.cents}%`);
</script>

<template>
  <div class="tuner" aria-hidden="true">
    <div class="tuner-track">
      <span class="tuner-needle" :style="{ left: needleLeft }"></span>
    </div>
    <div class="tuner-labels">
      <span>−50</span><span>−25</span><span>0</span><span>+25</span><span>+50</span>
    </div>
  </div>
</template>

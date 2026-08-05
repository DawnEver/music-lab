<script setup lang="ts">
import { useToast } from "../composables/useToast.js";

const { toastMessage, toastVisible } = useToast();
</script>

<template>
  <v-snackbar v-model="toastVisible" :timeout="4200" color="surface-variant" location="bottom">
    {{ toastMessage }}
  </v-snackbar>
</template>

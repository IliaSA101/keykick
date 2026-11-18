<script setup lang="ts">
/**
 * Точки ступеней стадиона на ярлыке места (048 §3): построено — `ok`, следующая — `nx`, остальные — пустые.
 * Вид точек — `styles/kit/places.css` (`.kb-place .dots`).
 */
defineProps<{ built: number; of: number }>();
</script>

<template>
  <span class="sub dots"><i
    v-for="k in of"
    :key="k"
    :class="k <= built ? 'ok' : k === built + 1 ? 'nx' : ''"
  /></span>
</template>

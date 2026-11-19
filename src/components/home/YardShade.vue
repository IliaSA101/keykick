<script setup lang="ts">
/**
 * Затемнение сцены Двора (066 Т6, 067 Т10): на Карте — верх и края, как `.homeshade.map` кадра (лист Э2, map.css); на Пути (`path`) —
 * верх и низ, как `.sc-shade` макета (tools/mock-path/scale/parts.mjs). Лежит поверх картинки и не двигается вместе с ней.
 */
defineProps<{ kind: 'map' | 'path' }>();
</script>

<template>
  <div
    class="shade"
    :class="kind"
  />
</template>

<style scoped>
.shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(rgb(21 20 58 / 0.85), rgb(21 20 58 / 0.3) 14%, transparent 20%),
    radial-gradient(ellipse at 50% 55%, transparent 55%, rgb(21 20 58 / 0.4));
}
.shade.path {
  background:
    linear-gradient(rgb(21 20 58 / 0.88), rgb(21 20 58 / 0.35) 14%, transparent 22%),
    linear-gradient(transparent 72%, rgb(8 20 14 / 0.6));
}
</style>

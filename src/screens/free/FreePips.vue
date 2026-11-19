<script setup lang="ts">
/** Ряд ударов серии (Штрафной, Э4.35–36): гол — зелёная точка, мяч в стенку — красная, текущий удар — с белой каймой; `big` — крупнее (итог). */
defineProps<{ pips: string[]; big?: boolean }>();
</script>

<template>
  <div
    class="pips"
    :class="{ big }"
  >
    <i
      v-for="(c, i) in pips"
      :key="i"
      :class="c"
    />
  </div>
</template>

<style scoped>
.pips { align-self: flex-start; display: flex; gap: 8px; margin: 2px 0 4px; }
.pips i { width: 22px; height: 22px; border-radius: 50%; box-sizing: border-box; border: 2px solid #8d8cd6; }
.pips.big i { width: 32px; height: 32px; }
.pips i.goal { background: #6fd89c; border-color: #fff; }
.pips i.miss { background: #ff6b6b; border-color: #fff; }
.pips i.now { border-color: #fff; border-width: 3px; }
</style>

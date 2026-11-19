<script setup lang="ts">
/** «Твои клавиши:» и ряд плашек-клавиш: буквы, из которых набираются слова-мишени (панель Штрафного, Э4.34–35). Вид плашки — общий `kbd.big` (kit). */
import { ru } from '../../i18n/ru';

defineProps<{ keys: string[] }>();
</script>

<template>
  <p class="keys">
    {{ ru.base.keepy.keys }}
    <span class="caps"><kbd
      v-for="k in keys"
      :key="k"
      class="big"
    >{{ k }}</kbd></span>
  </p>
</template>

<style scoped>
.keys { margin: 0; font-size: 14px; }
.caps { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
.caps kbd { min-width: 32px; height: 32px; }
</style>

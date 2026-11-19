<script setup lang="ts">
/**
 * Общий фон звеньев цепочки после матча (067-Р133): затемнённая сцена итога, шапка в состоянии «матч» (меню погашено),
 * затемнение сверху. Пак (Э2К.05–10) и «Тур «Школы» ждёт» (Э3.16) — на одной сцене. Слот — то, что лежит под затемнением
 * (у пака — заголовок экрана); окно звена кладут сверху.
 */
import { artUrl } from '../../art/assets';
import ShellHeader from './ShellHeader.vue';
</script>

<template>
  <img
    class="scene"
    :src="artUrl('matchBg')"
    alt=""
  >
  <ShellHeader
    match
    :pause="false"
  />
  <slot />
  <div class="dim" />
</template>

<style scoped>
.scene { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(9px) brightness(0.52) saturate(0.85); transform: scale(1.06); }
.dim { position: absolute; inset: 0; background: rgb(8 9 28 / 0.62); }
</style>

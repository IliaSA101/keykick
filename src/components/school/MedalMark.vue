<script setup lang="ts">
/**
 * Медаль «Школы» (Э3.09, Э3.20): картинка медали без ленты-хвоста, обрезка как в макете (диск на всю ширину). 1 — бронза, 2 — серебро,
 * 3 — золото. Плашки нет: награда на синем — как есть (067-Р107).
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';

const props = defineProps<{ medal: 1 | 2 | 3; size?: number; /** Целая картинка с лентой, `size` — высота (итог тура). */ full?: boolean }>();
const KEYS = { 1: 'schoolMedalB', 2: 'schoolMedalS', 3: 'schoolMedalG' } as const;
/** Кадр картинки 27,8 × 50,15: нижние 30 из 50 — диск медали. */
const w = computed(() => props.size ?? 28);
</script>

<template>
  <span
    role="img"
    :aria-label="ru.school.medal[medal]"
    class="mm"
    :style="full ? { width: `${w * 0.554}px`, height: `${w}px` } : { width: `${w}px`, height: `${w * 1.079}px` }"
  >
    <img
      :src="artUrl(KEYS[medal])"
      alt=""
      :style="full ? { width: `${w * 0.554}px`, height: `${w}px`, top: 0 } : { width: `${w}px`, height: `${w * 1.804}px`, top: `${-w * 0.725}px` }"
    >
  </span>
</template>

<style scoped>
.mm { display: block; flex: none; overflow: hidden; position: relative; }
.mm img { position: absolute; left: 0; }
</style>

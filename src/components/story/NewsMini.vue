<script setup lang="ts">
/**
 * Миниатюра выпуска газеты (068 Т11, Э2К.28; 049-Р42, 050-Р24: у газеты один вид): тот же лист `NewsSheet`, уменьшенный до ширины ячейки полки Музея.
 * Лист рисуется в натуральную ширину широкой сцены и сжимается `transform` — вёрстка и картинки те же, что в окне выпуска; кликов внутри нет.
 */
import { computed } from 'vue';
import type { PaperView } from '../../app/story/paperView';
import NewsSheet from './NewsSheet.vue';

/** Лист на широкой сцене (1138 px): ширина — 85,03 % стенда, высота — 75,26 % его высоты (`news.css`). */
const SHEET_W = 967.5;
const SHEET_H = 478;
const props = defineProps<{ view: PaperView; color: string; width: number }>();
const scale = computed(() => props.width / SHEET_W);
</script>

<template>
  <span
    class="nm"
    aria-hidden="true"
    :style="{ width: `${width}px`, height: `${SHEET_H * scale}px` }"
  >
    <span
      class="nw wide nm-in"
      :style="{ width: `${SHEET_W}px`, height: `${SHEET_H}px`, transform: `scale(${scale})` }"
    >
      <NewsSheet
        :view="view"
        :wide="true"
        :color="color"
      />
    </span>
  </span>
</template>

<style scoped>
.nm {
  position: relative;
  display: block;
  overflow: clip;
  background: #f0e9d6; /* бумага листа: в окне выпуска её даёт картинка стенда */
  box-shadow: 0 2px 5px rgb(0 0 0 / 0.45);
  pointer-events: none;
}
.nm-in.nw {
  top: 0;
  right: auto;
  bottom: auto;
  z-index: auto;
  overflow: visible;
  background: none;
  transform-origin: 0 0;
}
.nm-in :deep(.nw-sheet) {
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.nm-in :deep(figcaption) {
  font-size: 12px; /* на миниатюре текст не читается, замер «мельче 12» (--min-text) считает номинал листа: подпись «Фото» — 11,5 */
}
</style>

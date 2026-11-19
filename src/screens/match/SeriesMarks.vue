<script setup lang="ts">
/**
 * Отметки серии ударов в правой ячейке табло (068 Т6-2, Э5.30–.35): две строки — эмблема команды и три отметки (гол, вратарь взял, бьём сейчас).
 * Только показ: отметки приходят готовыми из `seriesView`. Вынесено из `MatchScene.vue` (разрез 068 Т6-3).
 */
import { storyArtUrl, type StoryArtKey } from '../../app/art/storyArt';
import type { Mark } from './seriesView';

defineProps<{ rows: { em: StoryArtKey; list: Mark[] }[] }>();
const MARK: Record<Mark, string> = { goal: '✓', miss: '✕', now: '', '': '' };
</script>

<template>
  <span class="cap r marks">
    <span
      v-for="(row, k) in rows"
      :key="k"
    ><img
      class="em"
      :src="storyArtUrl(row.em)"
      alt=""
    ><i
      v-for="(m, i) in row.list"
      :key="i"
      class="mk"
      :class="m"
    >{{ MARK[m] }}</i></span>
  </span>
</template>

<style scoped>
.cap.marks { display: flex; flex-direction: column; gap: 0; justify-self: end; padding-right: 2px; font-size: 15px; color: var(--text-muted); }
.cap.marks > span { display: flex; align-items: center; gap: 5px; }
.cap.marks .em { width: 21px; }
.mk { display: inline-grid; place-items: center; box-sizing: border-box; width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgb(255 255 255 / 0.7); font-size: 11px; font-style: normal; font-weight: 900; line-height: 1; color: #fff; }
.mk.goal { background: #2e9e4c; border-color: #2e9e4c; }
.mk.miss { background: #e07b39; border-color: #e07b39; }
.mk.now { border-color: #fff; box-shadow: 0 0 0 2px rgb(255 255 255 / 0.35); }
</style>

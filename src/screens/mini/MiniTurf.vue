<script setup lang="ts">
/**
 * Газон поля Мини-футбола внутри `<svg>` (кадры Э4.21–25, 42, 43, 50, 51): растр по ступени «Коробки», вещи кольца и золотые ворота (Р184).
 * Общий слой поля игры (`MiniField`) и схем тактик (`TacticScheme`); фишки, мяч и стрелки рисует хозяин поверх.
 */
import { artUrl } from '../../art/assets';
import { IH, IW, KERBS, RING, turfOf } from './miniGeo';

defineProps<{ built: number; gold: boolean }>();
</script>

<template>
  <image
    :href="artUrl(turfOf(built))"
    :width="IW"
    :height="IH"
  />
  <image
    v-for="r in RING.filter((x) => built >= x.step)"
    :key="r.art"
    :href="artUrl(r.art)"
    :x="r.at[0]"
    :y="r.at[1]"
    :width="r.at[2]"
    :height="r.at[3]"
  />
  <template v-if="gold">
    <rect
      v-for="k in KERBS"
      :key="k[0]"
      :x="k[0]"
      y="174"
      :width="k[1] - k[0]"
      height="728"
      fill="#808080"
      style="mix-blend-mode: saturation"
    />
    <image
      :href="artUrl('baseFieldGoalsGold')"
      :width="IW"
      :height="IH"
    />
  </template>
</template>

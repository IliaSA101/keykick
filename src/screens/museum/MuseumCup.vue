<script setup lang="ts">
/**
 * Кубок двора на тумбе Музея (068 Т11, Э2К.26/.28): золотой после титула, до него — силуэт (SVG-фильтр: тонкая белая линия по контуру и
 * лёгкая заливка), тень-пятно на столешнице и табличка под тумбой. Места — в пикселях сцены 1920×1072
 * через `geometry` Дома; ширину сцены (`width`) даёт экран.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { K, sxOf, syOf } from '../../components/home/geometry';
import { ru } from '../../i18n/ru';

const props = defineProps<{ won: boolean; stage: string; width: number }>();
const t = ru.museum;
const sx = (x: number): number => sxOf(props.width, x);
/** Центр x 960, высота 124 px, тень-пятно на столешнице; табличка — под подножием тумбы (y 872). */
const box = computed(() => ({ left: `${sx(960) - 47}px`, top: `${syOf(590) - 124}px` }));
const shadow = computed(() => ({ left: `${sx(960) - 55 * K}px`, top: `${syOf(599) - 5 * K}px`, width: `${110 * K}px`, height: `${Math.max(4, 10 * K)}px` }));
const plate = computed(() => ({ left: `${sx(960)}px`, top: `${syOf(872)}px` }));
</script>

<template>
  <svg
    class="defs"
    width="0"
    height="0"
    aria-hidden="true"
  >
    <filter
      id="mu-cup-line"
      color-interpolation-filters="sRGB"
    >
      <feMorphology
        in="SourceAlpha"
        operator="dilate"
        radius="2"
        result="d"
      />
      <feComposite
        in="d"
        in2="SourceAlpha"
        operator="out"
        result="ring"
      />
      <feFlood
        flood-color="#fff"
        flood-opacity="0.9"
      />
      <feComposite
        in2="ring"
        operator="in"
        result="rc"
      />
      <feFlood
        flood-color="#fff"
        flood-opacity="0.1"
      />
      <feComposite
        in2="SourceAlpha"
        operator="in"
        result="fl"
      />
      <feMerge>
        <feMergeNode in="fl" />
        <feMergeNode in="rc" />
      </feMerge>
    </filter>
  </svg>
  <i
    class="cupsh"
    :style="shadow"
  />
  <img
    class="cupimg"
    :class="{ sil: !won }"
    :style="box"
    :src="artUrl('albumCupYardGold')"
    alt=""
  >
  <div
    class="cupcap"
    :style="plate"
  >
    <template v-if="won">
      <b>{{ ru.home.cup.name }}</b><span>{{ t.cupWon }}</span>
    </template>
    <template v-else>
      <b>{{ t.cupWaits }}</b><span>{{ stage }}</span>
    </template>
  </div>
</template>

<style scoped>
.defs {
  position: absolute;
}
.cupimg {
  position: absolute;
  z-index: 3;
  height: 124px;
  width: auto;
  filter: drop-shadow(0 6px 8px #0007);
}
.cupimg.sil {
  filter: url(#mu-cup-line);
}
.cupsh {
  position: absolute;
  z-index: 2;
  border-radius: 50%;
  background: rgb(40 20 8 / 0.6);
  filter: blur(1.5px);
}
.cupcap {
  position: absolute;
  z-index: 6;
  width: 134px;
  box-sizing: border-box;
  padding: 4px 6px;
  border-radius: 10px;
  background: var(--surface);
  transform: translateX(-50%);
  text-align: center;
  white-space: normal;
}
.cupcap b,
.cupcap span {
  display: block;
}
.cupcap b {
  font-size: 12px;
}
.cupcap span {
  font-size: 12px;
  color: var(--text-muted);
}
</style>

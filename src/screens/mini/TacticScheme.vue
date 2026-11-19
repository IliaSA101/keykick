<script setup lang="ts">
/**
 * Схема тактики на карточке выбора (067-Р22, кадры Э4.50, 51): газон ступени ребёнка, стрелки пасов (пунктир) и бега, фишки без букв, мяч у первого.
 * Фишки крупнее, чем в игре: на карточке поле ≈ 0,15 натуральной величины. Только рисунок — расстановку даёт `tacticGeo`.
 */
import { computed } from 'vue';
import { RIVAL_TRIM } from '../../engine/club/rival';
import { at } from './miniGeo';
import MiniTurf from './MiniTurf.vue';
import { endOf, headOf, SCHEMES, TURF_VIEW } from './tacticGeo';

const props = defineProps<{ id: string; built: number; gold: boolean; ours: string; rival: string }>();

const scheme = computed(() => SCHEMES[props.id] ?? SCHEMES.wing!);
const our = computed(() => scheme.value.our.map(at));
const foes = computed(() => scheme.value.rv.map(at));
const arrows = computed(() =>
  scheme.value.arrows.map((a) => {
    const from = our.value[a.from] ?? { x: 0, y: 0 };
    const to = endOf(our.value, a.to);
    return { from, to, pass: a.kind === 'pass', head: headOf(from, to) };
  }),
);
const ball = computed(() => ({ x: (our.value[0]?.x ?? 0) + 52, y: (our.value[0]?.y ?? 0) + 30 }));
const chip = (p: { x: number; y: number }): string => `translate(${p.x} ${p.y}) scale(2.3)`;
</script>

<template>
  <svg
    class="scheme"
    :viewBox="TURF_VIEW"
    preserveAspectRatio="xMidYMid meet"
    aria-hidden="true"
  >
    <MiniTurf
      :built="built"
      :gold="gold"
    />
    <template
      v-for="(a, i) in arrows"
      :key="`a${i}`"
    >
      <path
        :d="`M${a.from.x} ${a.from.y}L${a.to.x} ${a.to.y}`"
        stroke="#ffffff"
        :stroke-width="a.pass ? 13 : 17"
        stroke-linecap="round"
        :stroke-dasharray="a.pass ? '30 20' : undefined"
        opacity=".95"
      />
      <polygon
        :points="a.head"
        fill="#ffffff"
      />
    </template>
    <g
      v-for="(p, i) in foes"
      :key="`r${i}`"
      :transform="chip(p)"
    >
      <circle
        r="25"
        :fill="rival"
        :stroke="RIVAL_TRIM"
        stroke-width="5"
      />
      <path
        d="M-9 -23V23M9 -23V23"
        :stroke="RIVAL_TRIM"
        stroke-width="7"
      />
    </g>
    <circle
      v-for="(p, i) in our"
      :key="`o${i}`"
      :transform="chip(p)"
      r="25"
      :fill="ours"
      stroke="#ffffff"
      stroke-width="3"
    />
    <g :transform="`translate(${ball.x} ${ball.y})`">
      <circle
        r="24"
        fill="#ffffff"
        stroke="#15181f"
        stroke-width="2"
      />
      <polygon
        points="0,-10 9.6,-3.1 5.9,8.1 -5.9,8.1 -9.6,-3.1"
        fill="#15181f"
      />
    </g>
  </svg>
</template>

<style scoped>
.scheme { display: block; width: 100%; height: 100%; }
</style>

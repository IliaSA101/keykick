<script setup lang="ts">
/** Арена «Tab по защитникам» (Э8.07–09): шесть фишек с номерами по кругу фокуса, фокус — белое кольцо; щелчок мышью — промах (клавиши — окно). */
import { computed } from 'vue';
import { artUrl } from '../../../art/assets';
import type { TabState } from '../../../engine/learn/games/tab';
import type { Miss } from '../../../app/learn/view';
import Piece from './Piece.vue';

const props = defineProps<{ s: TabState; miss: Miss | null; body: string }>();
const emit = defineEmits<{ click: [] }>();
const pts = computed(() => props.s.numbers.map((n, i) => ({ n, x: 64 + i * 87, y: 150 + (i % 2 ? 34 : -34) })));
const K = 562 / 1160;
</script>

<template>
  <svg
    class="art"
    viewBox="0 0 562 320"
    aria-hidden="true"
    @click="(e) => e.detail <= 1 && emit('click')"
  >
    <image
      :href="artUrl('baseFieldGoals')"
      :x="-380 * K"
      :y="-215 * K"
      :width="1920 * K"
      :height="1072 * K"
    />
    <g
      v-for="(p, i) in pts"
      :key="i"
    >
      <circle
        v-if="i === s.focus && miss"
        :cx="p.x"
        :cy="p.y"
        r="34"
        fill="#e5484d"
        fill-opacity=".45"
        stroke="#ff4d4f"
        stroke-width="3"
      />
      <Piece
        :x="p.x"
        :y="p.y"
        :s="0.86"
        :label="p.n"
        :body="body"
        :ring="i === s.focus ? 'solid' : ''"
      />
    </g>
  </svg>
</template>

<style scoped>
.art { display: block; width: 100%; height: 100%; }
</style>

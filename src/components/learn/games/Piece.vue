<script setup lang="ts">
/**
 * Фишка игрока на арене (вид сверху, `piece` макета): наши — цвет формы клуба с белой каймой и буквой или номером, соперник —
 * цвет соперника матча (`rival`, по умолчанию оранжевый; `engine/club/rival.ts`) с полосами `RIVAL_TRIM`. Рисуется внутри SVG арены. `ring`: мяч у игрока или фокус (сплошное кольцо), цель (пунктир).
 */
import { RIVAL_ORANGE, RIVAL_TRIM } from '../../../engine/club/rival';

withDefaults(defineProps<{ x: number; y: number; s?: number; foe?: boolean; label?: string | number; ring?: '' | 'solid' | 'dash'; body?: string; rival?: string | undefined }>(), { s: 0.7, foe: false, label: '', ring: '', body: '#2f9a27', rival: RIVAL_ORANGE });
</script>

<template>
  <g :transform="`translate(${x} ${y}) scale(${s})`">
    <circle
      v-if="ring"
      r="34"
      fill="none"
      stroke="#fff"
      :stroke-width="ring === 'solid' ? 4 : 3"
      :stroke-dasharray="ring === 'dash' ? '6 5' : undefined"
    />
    <template v-if="foe">
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
    </template>
    <template v-else>
      <circle
        r="25"
        :fill="body"
        stroke="#fff"
        stroke-width="3"
      />
      <text
        y="10"
        text-anchor="middle"
        font-size="28"
        font-weight="800"
        fill="#fff"
      >
        {{ label }}
      </text>
    </template>
  </g>
</template>

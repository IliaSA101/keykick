<script setup lang="ts">
/**
 * Знак рекорда игр на интерес (Р37): белая звезда в зелёном круге и белая табличка «РЕКОРД · N» — белое с зелёным, без кубка и медали.
 * Общий у Чеканки (над гаражом) и Мемори (в окне итога); место и размер — снаружи (`class`/`style`), внутри только рисунок.
 */
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';

defineProps<{ n: number }>();
</script>

<template>
  <svg
    width="244"
    height="222"
    viewBox="-122 -86 244 222"
  >
    <circle
      r="78"
      fill="#2fb360"
      stroke="#ffffff"
      stroke-width="8"
    />
    <circle
      r="62"
      fill="none"
      stroke="#ffffff"
      stroke-width="3"
      opacity=".6"
    />
    <polygon
      points="0,-48 11.8,-16.2 45.7,-14.8 19,6.2 28.2,38.8 0,20 -28.2,38.8 -19,6.2 -45.7,-14.8 -11.8,-16.2"
      fill="#ffffff"
    />
    <g transform="translate(0 104)">
      <rect
        x="-120"
        y="-26"
        width="240"
        height="52"
        rx="26"
        fill="#ffffff"
      />
      <text
        y="11"
        text-anchor="middle"
        font-size="30"
        font-weight="800"
        fill="#1d7a43"
      >{{ fill(ru.base.keepy.sign, { n }) }}</text>
    </g>
  </svg>
</template>

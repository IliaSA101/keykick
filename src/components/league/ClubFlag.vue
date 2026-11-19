<script setup lang="ts">
/**
 * Флаг клуба (052-Р15 б, макет `tools/mock-path/scale/marks.mjs`): полотно цвета формы клуба с белой каймой, на нём герб клуба в белом круге,
 * древко белое, без навершия (ТАБУ: ни жёлтого, ни золотого). Две меры: полный (на картинке Двора, 56×80 единиц, с тенью у основания)
 * и малый (флажок на шкале Пути, 20×18, короткое древко). Размер — `scale` (px сцены на единицу полотна).
 */
import { artFiles } from '../../art/assets';

const props = withDefaults(defineProps<{ fill: string; mini?: boolean; scale?: number }>(), { mini: false, scale: 1 });
const base = import.meta.env.BASE_URL;
const crest = `${base}${artFiles.iconCrest}`;
</script>

<template>
  <svg
    v-if="!mini"
    :width="56 * props.scale"
    :height="80 * props.scale"
    viewBox="0 0 56 80"
    aria-hidden="true"
  >
    <ellipse
      cx="6"
      cy="78"
      rx="11"
      ry="3"
      fill="rgb(0 0 0 / 0.5)"
    />
    <rect
      x="4.5"
      y="5"
      width="3"
      height="73"
      rx="1.5"
      fill="#fff"
    />
    <path
      d="M7.5 9C20 5.5 33 13.5 52 9V38C33 42.5 20 34.5 7.5 38Z"
      :fill="fill"
      stroke="#fff"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <circle
      cx="29.75"
      cy="23.5"
      r="8.8"
      fill="#fff"
    />
    <image
      :href="crest"
      x="24.75"
      y="17.4"
      width="10"
      height="11.8"
      preserveAspectRatio="xMidYMid meet"
    />
  </svg>
  <svg
    v-else
    :width="20 * props.scale"
    :height="18 * props.scale"
    viewBox="0 0 20 18"
    aria-hidden="true"
  >
    <rect
      width="2.4"
      height="18"
      rx="1.2"
      fill="#fff"
    />
    <path
      d="M2.4 .6C7 -.4 12 2 19.4 .6V12.4C12 13.8 7 11.4 2.4 12.4Z"
      :fill="fill"
      stroke="#fff"
      stroke-width="1"
      stroke-linejoin="round"
    />
    <circle
      cx="10.9"
      cy="6.5"
      r="3.9"
      fill="#fff"
    />
    <image
      :href="crest"
      x="8.6"
      y="3.8"
      width="4.6"
      height="5.4"
      preserveAspectRatio="xMidYMid meet"
    />
  </svg>
</template>

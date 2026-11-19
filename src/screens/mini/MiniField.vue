<script setup lang="ts">
/**
 * Поле Мини-футбола сверху (кадры Э4.21–25, 42, 43): растр по ступени «Коробки» и вещи кольца, золото ворот, фишки с буквами, пунктир пасов, мяч, зона удара.
 * Фишки наших — цвет формы клуба, соперников — цвет команды урока (`rival`, 067-Р239). Состояние матча приходит снаружи; здесь только рисунок.
 */
import { computed } from 'vue';
import { RIVAL_TRIM } from '../../engine/club/rival';
import { ru } from '../../i18n/ru';
import { at, ballAt, PIECE_SCALE, SPOTS, VIEW, ZONE } from './miniGeo';
import MiniTurf from './MiniTurf.vue';

const props = defineProps<{
  built: number;
  gold: boolean;
  team: readonly string[];
  holder: number;
  zone: boolean;
  ours: string;
  ink: string;
  rival: string;
  /** Поле целиком в блоке любого отношения сторон (превью на старте), иначе — с обрезкой краёв. */
  meet?: boolean;
}>();

const spots = computed(() => SPOTS[props.team.length] ?? SPOTS[2]!);
const our = computed(() => spots.value.our.map(at));
const foes = computed(() => spots.value.rv.map(at));
const carrier = computed(() => our.value[props.holder] ?? { x: 0, y: 0 });
const ball = computed(() => ballAt(carrier.value));
const pieceStyle = (p: { x: number; y: number }): { transform: string } => ({ transform: `translate(${p.x}px, ${p.y}px) scale(${PIECE_SCALE})` });
const ballStyle = computed(() => ({ transform: `translate(${ball.value.x}px, ${ball.value.y}px)` }));
</script>

<template>
  <svg
    class="fsvg"
    :viewBox="VIEW"
    :preserveAspectRatio="`xMidYMid ${meet ? 'meet' : 'slice'}`"
    aria-hidden="true"
  >
    <MiniTurf
      :built="built"
      :gold="gold"
    />
    <template v-if="zone">
      <rect
        :x="ZONE.x"
        :y="ZONE.y"
        :width="ZONE.w"
        :height="ZONE.h"
        fill="#6fd89c"
        opacity=".3"
      />
      <text
        :x="ZONE.x + ZONE.w / 2"
        :y="ZONE.y - 16"
        text-anchor="middle"
        font-size="28"
        font-weight="800"
        fill="#ffffff"
      >{{ ru.base.keepy.zone }}</text>
    </template>
    <template
      v-for="(p, i) in our"
      :key="`l${i}`"
    >
      <path
        v-if="i !== holder"
        :d="`M${carrier.x} ${carrier.y}L${p.x} ${p.y}`"
        stroke="#ffffff"
        stroke-width="5"
        stroke-dasharray="13 11"
        opacity=".85"
      />
    </template>
    <g
      v-for="(p, i) in foes"
      :key="`r${i}`"
      class="pc"
      :style="pieceStyle(p)"
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
    <g
      v-for="(p, i) in our"
      :key="`o${i}`"
      class="pc"
      :style="pieceStyle(p)"
    >
      <circle
        r="34"
        fill="none"
        stroke="#ffffff"
        :stroke-width="i === holder ? 4 : 3"
        :stroke-dasharray="i === holder ? undefined : '6 5'"
      />
      <circle
        r="25"
        :fill="ours"
        stroke="#ffffff"
        stroke-width="3"
      />
      <text
        y="10"
        text-anchor="middle"
        font-size="28"
        font-weight="800"
        :fill="ink"
      >{{ (team[i] ?? '').toUpperCase() }}</text>
    </g>
    <g
      class="ball"
      :style="ballStyle"
    >
      <circle
        r="15"
        fill="#ffffff"
        stroke="#15181f"
        stroke-width="2"
      />
      <polygon
        points="0,-6.3 6,-1.9 3.7,5.1 -3.7,5.1 -6,-1.9"
        fill="#15181f"
      />
    </g>
  </svg>
</template>

<style scoped>
.fsvg { display: block; width: 100%; height: 100%; }
.pc { transition: transform 0.2s; }
.ball { transition: transform 0.18s ease-out; }
</style>

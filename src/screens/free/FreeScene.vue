<script setup lang="ts">
/**
 * Арена Штрафного (кадры Э4.34–36, 44, 46): фон арены матча, три мишени-слова над стенкой, стенка из четырёх игроков соперника (форма его цвета по маске),
 * Саша со спиной «САША 7», мяч над стенкой по набранным буквам, знак рекорда. Ничего не считает: слова, поза, доля полёта и цвета приходят снаружи.
 * Один SVG 816 × 480 в единицах макета: арена тянется по ширине места, спрайты стоят внутри (`KitSprite` с `inSvg`).
 */
import { computed, useId } from 'vue';
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';
import KitSprite from '../fun/KitSprite.vue';
import RecordSign from '../fun/RecordSign.vue';
import { ARC, ARENA_H, ARENA_W, BG, BOARD, BOARD_X, KICK_BALL_CLIP, NET, SASHA, SASHA_FEET, SASHA_H, SASHA_LEFT, SIGN, WALL, WALL_H, arcAt, ballRadius, type SashaPose } from './freeGeo';

const props = defineProps<{
  /** Мишени слева направо: слово текущего удара (с набранными буквами) и следующие. */
  boards: string[];
  typed: number;
  pose: SashaPose;
  /** Доля пути мяча по дуге (0 — у ноги); `null` — мяча в воздухе нет. */
  flight: number | null;
  /** Отсчёт слова под текущей мишенью: доля оставшегося (1 → 0) и тревога последних секунд; `null` — полоски нет. */
  bar: { left: number; hot: boolean } | null;
  /** Мяч в сетке (итог серии с голами). */
  net: boolean;
  /** Цвет формы стенки — соперник урока. */
  rival: string;
  /** Надпись на спине: имя и номер. */
  back: { name: string; num: string };
  /** Знак рекорда над Сашей: число; `null` — нет. */
  sign: number | null;
  /** Подпись внизу: подсказка на старте и в игре. */
  caption: boolean;
}>();

const uid = useId();
const sasha = computed(() => SASHA[props.pose]);
const w = computed(() => (SASHA_H * sasha.value.w) / sasha.value.h);
const left = computed(() => SASHA_LEFT[props.pose]);
const clip = computed(() => `M0 0H${sasha.value.w}V${sasha.value.h}H0Z M${KICK_BALL_CLIP.x} ${KICK_BALL_CLIP.y}h${KICK_BALL_CLIP.w}v${KICK_BALL_CLIP.h}h${-KICK_BALL_CLIP.w}Z`);
const ball = computed(() => (props.net ? NET : props.flight === null ? null : { ...arcAt(props.flight), r: ballRadius(props.flight) }));
const arc = `M${ARC[0][0]} ${ARC[0][1]}C${ARC[1][0]} ${ARC[1][1]} ${ARC[2][0]} ${ARC[2][1]} ${ARC[3][0]} ${ARC[3][1]}`;
const BALL = { w: 204, h: 427, cx: 34, cy: 183, r: 28.5 };
const signW = (244 * SIGN.d) / 164;
</script>

<template>
  <svg
    class="arena"
    :viewBox="`0 0 ${ARENA_W} ${ARENA_H}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <radialGradient :id="`${uid}s`">
        <stop
          offset="0"
          stop-color="#000"
          stop-opacity=".85"
        />
        <stop
          offset=".55"
          stop-color="#000"
          stop-opacity=".5"
        />
        <stop
          offset="1"
          stop-color="#000"
          stop-opacity="0"
        />
      </radialGradient>
      <clipPath :id="`${uid}k`"><path
        clip-rule="evenodd"
        :d="clip"
      /></clipPath>
      <clipPath :id="`${uid}b`"><circle
        :cx="BALL.cx"
        :cy="BALL.cy"
        :r="BALL.r"
      /></clipPath>
    </defs>
    <image
      :href="artUrl('matchBgB')"
      :width="BG.w"
      :height="BG.h"
      :transform="`translate(${BG.ox} ${BG.oy}) scale(${BG.k})`"
    />

    <g
      v-for="(word, i) in boards"
      :key="i"
      :opacity="i === 0 ? 1 : 0.62"
    >
      <rect
        :x="BOARD_X[i]"
        :y="BOARD.y"
        :width="BOARD.w"
        :height="BOARD.h"
        rx="8"
        fill="#f2f4f8"
        :stroke="i === 0 ? '#6fd89c' : '#8d8cd6'"
        :stroke-width="i === 0 ? 4 : 2"
      />
      <text
        :x="(BOARD_X[i] ?? 0) + BOARD.w / 2"
        :y="BOARD.y + 21"
        text-anchor="middle"
        font-size="19"
        font-weight="800"
        letter-spacing="1.5"
      ><tspan
        fill="#0e9f4e"
        text-decoration="underline"
      >{{ word.slice(0, i === 0 ? typed : 0) }}</tspan><tspan fill="#0d1530">{{ word.slice(i === 0 ? typed : 0) }}</tspan></text>
    </g>

    <g v-if="bar !== null">
      <!-- полоска отсчёта: 11 ед. (на 1024 ≈ 9–10 px), тёмная подложка — читается и на белой сетке ворот, и над головами стенки (067 Т22) -->
      <rect
        :x="BOARD_X[0]"
        :y="BOARD.y + BOARD.h + 7"
        :width="BOARD.w"
        height="11"
        rx="5.5"
        fill="#0d1530"
        opacity=".6"
      />
      <rect
        :x="BOARD_X[0]"
        :y="BOARD.y + BOARD.h + 7"
        :width="BOARD.w * bar.left"
        height="11"
        rx="5.5"
        :fill="bar.hot ? '#ff8a3d' : '#6fd89c'"
      />
    </g>

    <template
      v-for="k in WALL"
      :key="k.art"
    >
      <ellipse
        :cx="k.x"
        :cy="k.feet - 1"
        :rx="((WALL_H * k.w) / k.h) * 0.62"
        ry="5"
        :fill="`url(#${uid}s)`"
      />
      <KitSprite
        in-svg
        :art="k.art"
        :kit="k.kit"
        :w="k.w"
        :h="k.h"
        :color="rival"
        :height="WALL_H"
        :x="k.x"
        :bottom="k.feet"
      />
    </template>

    <path
      v-if="flight !== null && !net"
      :d="arc"
      fill="none"
      stroke="#fff"
      stroke-width="3"
      stroke-dasharray="9 8"
      opacity=".8"
    />
    <template v-if="ball !== null">
      <ellipse
        :cx="ball.x + ball.r * 0.25"
        :cy="ball.y + ball.r * 1.55"
        :rx="ball.r * 0.95"
        :ry="ball.r * 0.26"
        fill="#000"
        opacity=".32"
      />
      <g :transform="`translate(${ball.x} ${ball.y}) scale(${ball.r / BALL.r}) translate(${-BALL.cx} ${-BALL.cy})`">
        <image
          :href="artUrl('baseSashaKnee2')"
          :width="BALL.w"
          :height="BALL.h"
          :clip-path="`url(#${uid}b)`"
        />
      </g>
      <circle
        :cx="ball.x"
        :cy="ball.y"
        :r="ball.r + 1"
        fill="none"
        stroke="#fff"
        stroke-width="2"
      />
    </template>

    <ellipse
      :cx="left + w * sasha.shadow[0]"
      :cy="SASHA_FEET - 3"
      :rx="w * sasha.shadow[1]"
      ry="11"
      :fill="`url(#${uid}s)`"
    />
    <svg
      :x="left"
      :y="SASHA_FEET - SASHA_H"
      :width="w"
      :height="SASHA_H"
      :viewBox="`0 0 ${sasha.w} ${sasha.h}`"
    >
      <image
        :href="artUrl(sasha.art)"
        :width="sasha.w"
        :height="sasha.h"
        :clip-path="pose === 'kick' ? `url(#${uid}k)` : undefined"
      />
      <g
        :transform="`rotate(${sasha.back.rot} ${sasha.back.x} ${sasha.back.name})`"
        fill="#ffffff"
        text-anchor="middle"
        font-weight="800"
      >
        <text
          :x="sasha.back.x"
          :y="sasha.back.name"
          font-size="19"
          letter-spacing="1"
        >{{ back.name }}</text>
        <text
          :x="sasha.back.x"
          :y="sasha.back.num"
          font-size="70"
        >{{ back.num }}</text>
      </g>
    </svg>

    <RecordSign
      v-if="sign !== null"
      class="sign"
      :n="sign"
      :x="SIGN.x - (122 * SIGN.d) / 164"
      :y="SIGN.y - (86 * SIGN.d) / 164"
      :width="signW"
      :height="(222 * SIGN.d) / 164"
    />
    <g v-if="caption">
      <rect
        x="496"
        y="450"
        width="304"
        height="24"
        rx="12"
        fill="#0a0e24"
        opacity=".62"
      />
      <text
        x="648"
        y="467"
        text-anchor="middle"
        font-size="15"
        font-weight="800"
        fill="#ffffff"
      >{{ ru.base.free.caption }}</text>
    </g>
  </svg>
</template>

<style scoped>
.arena { display: block; width: 100%; height: 100%; }
.sign { overflow: visible; filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.45)); }
</style>

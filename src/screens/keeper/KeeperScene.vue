<script setup lang="ts">
/**
 * Арена Вратаря (кадры Э4.37–40): фон `bg-keeper`, 8 секторов в проёме ворот с клавишами на траве под линией ворот, вратарь Саша (стоит · прыжок · радость)
 * и бьющий — в цветах по маске формы, мяч в полёте, знак рекорда. Ничего не считает: сектор удара, доля полёта и поза приходят снаружи.
 * Слой в px арены (`keeperGeo`), сдвинут так, чтобы ворота стояли по центру места левее панели.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { shirtInk } from '../../engine/club/paint';
import { ru } from '../../i18n/ru';
import KitSprite from '../fun/KitSprite.vue';
import RecordSign from '../fun/RecordSign.vue';
import {
  ARENA_H, ARENA_LEFT, ARENA_W, FEET, GATE_CX, GATE_MID_Y, GATE_PX, KEEPER_H, KEEPER_SPRITES, KICK_BALL_CLIP, KICK_FROM, RIVAL_BOTTOM_Y, RIVAL_H, RIVAL_SPRITES, RIVAL_X, ballAt, sectorX,
} from './keeperGeo';

type Pose = 'ready' | 'dive' | 'joy';
const props = defineProps<{
  /** Сектора слева направо: клавиша (строчная) и открыт ли. */
  sectors: { key: string; open: boolean }[];
  /** Номер сектора удара; `null` — мяча нет (старт, итог). */
  target: number | null;
  /** Доля полёта мяча 0…1. */
  flight: number;
  /** Сектор прыжка вратаря (после сейва — сектор отбитого удара); `null` — не прыгает. */
  diveTo: number | null;
  pose: Pose;
  /** Цвет формы вратаря (наш клуб) и бьющего (соперник). */
  ours: string;
  rival: string;
  /** Надпись на плашке над вратарём («САША 7»). */
  who: string;
  /** Показать бьющего и подпись «бьёт…». */
  striker: boolean;
  /** Подпись бьющего: «бьёт двор на <улица>» (соперник урока, 067-Р232). */
  strikerText: string;
  /** Знак рекорда над вратарём: число; `null` — нет. */
  sign: number | null;
}>();

const t = ru.base.keeper;
const bg = computed(() => `url('${artUrl('baseBgKeeper')}')`);
/** Цвет надписи на плашке цвета формы: по светлой форме — тёмный (белое не читается), по тёмной — белый (`shirtInk`). */
const tagInk = computed(() => shirtInk({ pattern: 'plain', body: props.ours, sleeves: props.ours, trim: props.ours }).fill);
const sw = (GATE_PX.x1 - GATE_PX.x0) / 8;
const gh = GATE_PX.y1 - GATE_PX.y0;
const keeperH = computed(() => (props.pose === 'joy' ? Math.round(KEEPER_H * 0.95) : props.pose === 'dive' ? Math.round(KEEPER_H * 0.9) : KEEPER_H));
const diving = computed(() => props.pose === 'dive' && props.diveTo !== null);
/** Центр и низ вратаря: стоит по центру ворот, в прыжке — у сектора удара (чуть левее центра сектора, как в макете). */
const spot = computed(() => (diving.value ? { x: sectorX(props.diveTo ?? 0) - 28, bottom: GATE_MID_Y + keeperH.value * 0.42 } : { x: GATE_CX, bottom: FEET }));
const tag = computed(() => ({ x: spot.value.x, y: diving.value ? GATE_MID_Y - keeperH.value * 0.55 - 6 : FEET - keeperH.value - 16 }));
const kd = computed(() => KEEPER_SPRITES[props.pose]);
const ball = computed(() => (props.target === null ? null : ballAt(props.flight, props.target)));
const SIGN_D = 130 / 1.6875;
const signK = SIGN_D / 164;
const signAt = computed(() => ({ left: GATE_CX - 122 * signK, top: FEET - keeperH.value - 6 - 130 * signK - 86 * signK }));
const handY = GATE_PX.y0 - 34;
</script>

<template>
  <div class="ar">
    <div
      class="field"
      :style="{ left: ARENA_LEFT, width: `${ARENA_W}px`, height: `${ARENA_H}px`, top: `${640 - ARENA_H}px`, backgroundImage: bg }"
    >
      <template v-if="pose !== 'joy'">
        <template
          v-for="(s, i) in sectors"
          :key="s.key"
        >
          <div
            class="sec"
            :class="{ closed: !s.open, target: i === target, first: i === 0 }"
            :style="{ left: `${GATE_PX.x0 + i * sw}px`, top: `${GATE_PX.y0}px`, width: `${sw}px`, height: `${gh}px` }"
          />
          <span
            class="key"
            :class="{ closed: !s.open, target: i === target }"
            :style="{ left: `${GATE_PX.x0 + i * sw + 3}px`, top: `${GATE_PX.y1 + 7}px`, width: `${sw - 6}px` }"
          >{{ s.open ? s.key.toUpperCase() : t.closed }}</span>
        </template>
        <span
          class="hand"
          :style="{ left: `${(GATE_PX.x0 + GATE_CX) / 2}px`, top: `${handY}px` }"
        >{{ t.left }}</span>
        <span
          class="hand"
          :style="{ left: `${(GATE_CX + GATE_PX.x1) / 2}px`, top: `${handY}px` }"
        >{{ t.right }}</span>
      </template>

      <i
        class="sh"
        :style="{ left: `${(diving ? sectorX(diveTo ?? 0) - 10 : GATE_CX) - KEEPER_H * (diving ? 0.45 : 0.4)}px`, top: `${FEET + 2 - 6}px`, width: `${KEEPER_H * (diving ? 0.9 : 0.8)}px`, height: '12px', opacity: diving ? 0.35 : 0.45 }"
      />
      <KitSprite
        v-bind="kd"
        :color="ours"
        :height="keeperH"
        :x="spot.x"
        :bottom="spot.bottom"
      />
      <span
        v-if="pose !== 'joy'"
        class="tag"
        :style="{ left: `${tag.x}px`, top: `${tag.y}px`, background: ours, color: tagInk }"
      >{{ who }}</span>
      <RecordSign
        v-if="sign !== null"
        class="sign"
        :n="sign"
        :style="{ left: `${signAt.left}px`, top: `${signAt.top}px`, width: `${244 * signK}px`, height: `${222 * signK}px` }"
      />

      <template v-if="striker">
        <i
          class="sh"
          :style="{ left: `${RIVAL_X + 8 - RIVAL_H * 0.34}px`, top: `${RIVAL_BOTTOM_Y - 2 - 8}px`, width: `${RIVAL_H * 0.68}px`, height: '16px', opacity: 0.45 }"
        />
        <KitSprite
          v-bind="RIVAL_SPRITES[target === null ? 'run' : 'kick']"
          :color="rival"
          :height="RIVAL_H"
          :x="RIVAL_X"
          :bottom="RIVAL_BOTTOM_Y"
          :clip="target === null ? undefined : KICK_BALL_CLIP"
        />
        <span
          class="who"
          :style="{ left: `${RIVAL_X + RIVAL_H * 0.5 + 118}px`, top: `${RIVAL_BOTTOM_Y - 36}px` }"
        >{{ strikerText }}</span>
      </template>

      <svg
        v-if="ball !== null && target !== null"
        class="fx"
        :width="ARENA_W"
        :height="ARENA_H"
        :viewBox="`0 0 ${ARENA_W} ${ARENA_H}`"
        aria-hidden="true"
      >
        <path
          :d="`M${KICK_FROM.x} ${KICK_FROM.y}L${sectorX(target)} ${GATE_MID_Y}`"
          stroke="rgb(255 255 255 / .7)"
          stroke-width="3"
          stroke-dasharray="3 9"
          stroke-linecap="round"
        />
        <ellipse
          :cx="ball.x + ball.r * 0.25"
          :cy="ball.y + ball.r * 1.55"
          :rx="ball.r * 0.95"
          :ry="ball.r * 0.26"
          fill="#000"
          opacity=".32"
        />
        <g :transform="`translate(${ball.x} ${ball.y}) scale(${ball.r / 28.5}) translate(-34 -183)`">
          <clipPath id="kb-clip"><circle
            cx="34"
            cy="183"
            r="28.5"
          /></clipPath>
          <image
            :href="artUrl('baseSashaKnee2')"
            width="204"
            height="427"
            clip-path="url(#kb-clip)"
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
      </svg>
    </div>
    <div class="top" />
  </div>
</template>

<style scoped>
.ar { position: absolute; inset: 0; overflow: hidden; background: #101733; }
.field { position: absolute; background-size: 100% 100%; background-repeat: no-repeat; }
.top { position: absolute; left: 0; right: 0; top: 0; height: 92px; background: linear-gradient(rgb(14 14 44 / 0.92) 0 55%, rgb(14 14 44 / 0)); }
.sh { position: absolute; border-radius: 50%; background: radial-gradient(#000 0, rgb(0 0 0 / 0) 72%); }
.sec { position: absolute; box-sizing: border-box; border-left: 2px dashed rgb(255 255 255 / 0.5); }
.sec.first { border-left: 0; }
.sec.closed { background: rgb(0 0 0 / 0.5); }
.sec.target { background: rgb(111 216 156 / 0.32); box-shadow: inset 0 0 0 3px #6fd89c; }
.key { position: absolute; box-sizing: border-box; display: block; height: 32px; line-height: 32px; text-align: center; font-size: 24px; font-weight: 800; color: #fff; border-radius: 9px; background: rgb(14 14 44 / 0.72); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.4); }
.key.closed { font-size: 13px; font-weight: 700; color: #c9c9e4; background: rgb(14 14 44 / 0.55); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.2); }
.key.target { color: #10301c; background: #6fd89c; box-shadow: 0 0 0 3px #fff; font-size: 28px; }
.tag { position: absolute; transform: translateX(-50%); padding: 1px 9px; border-radius: 8px; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; color: #fff; box-shadow: 0 0 0 2px #fff; white-space: nowrap; }
.who { position: absolute; transform: translateX(-50%); padding: 2px 10px; border-radius: 9px; font-size: 13px; font-weight: 800; color: #fff; background: rgb(14 14 44 / 0.75); white-space: nowrap; }
.hand { position: absolute; transform: translateX(-50%); padding: 1px 10px; border-radius: 8px; font-size: 14px; font-weight: 700; color: #fff; background: rgb(14 14 44 / 0.72); white-space: nowrap; }
.fx { position: absolute; left: 0; top: 0; pointer-events: none; }
.sign { position: absolute; display: block; overflow: visible; filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.45)); }
</style>

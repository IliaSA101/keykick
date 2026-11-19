<script setup lang="ts">
/**
 * Сцена Чеканки (кадры Э4.27–29, 45): фон Базы со сдвигом, Саша со спины («САША 7» кодом), зона удара, буква на плашке над мячом, знак рекорда.
 * Слой 1920×1080 масштабируется в базовые px экрана. Мяч нарисован в спрайте Саши (у колена), по зоне падает буква-плашка; ничего не считает.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { ru } from '../../i18n/ru';
import RecordSign from '../fun/RecordSign.vue';
import { BALL_R, FEET, K, OPENING, SHIFT, SPRITES, SX, Z, letterUp, place, type Pose } from './keepyGeo';

const props = defineProps<{
  pose: Pose;
  /** Буква над мячом; `null` — без буквы. */
  letter?: string | null;
  /** Доля падения 0…1 (для плашки буквы). */
  progress?: number;
  /** Мяч в зоне удара: плашка яркая, зона подсвечена. */
  inZone?: boolean;
  /** Показать зону удара (идёт игра). */
  zone?: boolean;
  /** Знак рекорда над гаражом: число; `null` — нет. */
  sign?: number | null;
}>();

const t = ru.base.keepy;
const spot = computed(() => place(props.pose));
const bg = computed(() => `url('${artUrl('baseBgBase')}')`);
const plate = computed(() => {
  const ball = spot.value.ball;
  if (ball === null || props.letter === undefined || props.letter === null) return null;
  const dx = props.pose === 'knee2' ? -70 : props.pose === 'stand' ? 40 : 70;
  return { x: ball[0] + dx, y: ball[1] - letterUp(props.progress ?? 0), bx: ball[0], by: ball[1] };
});
const open = { left: SHIFT + OPENING.x * 1920, top: OPENING.y * 1080, width: OPENING.w * 1920, height: OPENING.h * 1080 };
</script>

<template>
  <div
    class="scene"
    :style="{ transform: `scale(${1 / Z})` }"
    aria-hidden="true"
  >
    <div
      class="bg"
      :style="{ left: `${SHIFT}px`, backgroundImage: bg }"
    />
    <div
      class="bg mir"
      :style="{ left: `${SHIFT - 1920}px`, backgroundImage: bg }"
    />
    <div
      class="open"
      :style="{ left: `${open.left}px`, top: `${open.top}px`, width: `${open.width}px`, height: `${open.height}px` }"
    />
    <div
      v-if="zone && spot.ball"
      class="zone"
      :class="{ hot: inZone }"
      :style="{ left: `${SX - 330}px`, top: `${spot.ball[1] - 100}px` }"
    >
      <span>{{ t.zone }}</span>
    </div>
    <div
      class="shadow"
      :style="{ left: `${SX - 125}px`, top: `${FEET - 20}px` }"
    />
    <img
      class="sasha"
      :src="artUrl(SPRITES[pose].art)"
      alt=""
      :style="{ left: `${spot.left}px`, top: `${spot.top}px`, width: `${spot.width}px`, height: `${spot.height}px` }"
    >
    <div
      class="name"
      :style="{ left: `${spot.back[0] - 60}px`, top: `${spot.back[1] - 18}px` }"
    >
      <b>{{ t.back.name }}</b><i>{{ t.back.num }}</i>
    </div>
    <svg
      v-if="spot.ball"
      class="svg"
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
    >
      <circle
        :cx="spot.ball[0]"
        :cy="spot.ball[1]"
        :r="Math.round(BALL_R * K) + 1"
        fill="none"
        stroke="#ffffff"
        stroke-width="2"
      />
      <template v-if="plate">
        <path
          :d="`M${plate.x} ${plate.y + 40}L${plate.bx} ${plate.by - 34}`"
          stroke="#ffffff"
          stroke-width="3"
          stroke-dasharray="8 8"
          opacity=".75"
        />
        <path
          :d="`M${plate.bx - 11} ${plate.by - 46}l11 15 11-15z`"
          fill="#ffffff"
          opacity=".8"
        />
      </template>
    </svg>
    <div
      v-if="plate && letter"
      class="plate"
      :class="{ faint: !zone, hot: inZone }"
      :style="{ left: `${plate.x}px`, top: `${plate.y}px` }"
    >
      {{ letter.toUpperCase() }}
    </div>
    <RecordSign
      v-if="sign !== null && sign !== undefined"
      class="sign"
      :n="sign"
      :style="{ left: `${SX - 122}px`, top: `${420 - 86}px` }"
    />
  </div>
</template>

<style scoped>
.scene { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; transform-origin: 0 0; overflow: hidden; background: #1a1f2a; }
.bg { position: absolute; top: 0; width: 1920px; height: 1080px; background-size: 100% 100%; background-repeat: no-repeat; }
.bg.mir { transform: scaleX(-1); }
.open { position: absolute; background: rgb(21 20 58 / 0.35); border-radius: 6px; }
.svg, .sign { position: absolute; left: 0; top: 0; pointer-events: none; }
.sign { filter: drop-shadow(0 4px 5px rgb(0 0 0 / 0.45)); overflow: visible; }
.shadow { position: absolute; width: 250px; height: 40px; border-radius: 50%; background: #000; opacity: 0.35; filter: blur(6px); }
.sasha { position: absolute; display: block; }
.name { position: absolute; width: 120px; display: flex; flex-direction: column; align-items: center; color: #fff; transform: scaleX(0.88); line-height: 1; }
.name b { font-size: 16px; font-weight: 800; letter-spacing: 0.03em; }
.name i { font-style: normal; font-size: 56px; font-weight: 800; margin-top: 2px; }
.zone { position: absolute; box-sizing: border-box; width: 660px; height: 200px; border-radius: 20px; background: rgb(47 179 96 / 0.13); border: 4px dashed #8ff0b4; }
.zone.hot { background: rgb(47 179 96 / 0.3); border-style: solid; }
.zone span { position: absolute; left: 16px; top: 10px; font-size: 26px; font-weight: 800; color: #fff; text-shadow: 0 2px 6px #000; }
.plate { position: absolute; transform: translate(-50%, -50%) scale(1.7); box-sizing: border-box; width: 44px; height: 44px; display: grid; place-items: center; border-radius: 9px; background: #f4f1e3; color: #1d3a2a; font-size: 24px; font-weight: 800; box-shadow: 0 3px 0 #b9b59a; }
.plate.faint { opacity: 0.55; }
.plate.hot { background: #fff; box-shadow: 0 0 0 4px #6fd89c, 0 3px 0 #b9b59a; }
</style>

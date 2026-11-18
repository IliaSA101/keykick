<script setup lang="ts">
/**
 * Клавиатура с руками (065 Т9; кадры Э1.03–Э1.05, 012-РГ1): клавиши в цветах пальцев, цель подсвечена, поверх — руки
 * `public/art/hands.webp` (кончики на ФЫВА ОЛДЖ, полупрозрачные). Метка на ногте — только когда цель не на основном ряду и
 * на большом пальце у пробела (`nailMark`). Общая для «Матча», «Школы» и «Базы»: экранов не знает, размер задаёт родитель
 * (ширина 100 %), нижнюю часть рук обрезает родитель. Геометрия — `engine/typing/keyboardLayout`.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import { HAND_TIPS, HANDS_SIZE, HANDS_SPLIT, THUMB_TIPS } from '../../art/hands';
import { VIEW_PAD, fingerHomes, fitHands, layoutKeys, type ImagePoint } from '../../engine/typing/keyboardLayout';
import type { Finger, KeyDef, Layout, Thumb } from '../../engine/typing/keymap';
import { keymap } from '../../engine/typing/layouts';
import { nailMark } from './marks';
import { TYPING_SIZE, frameHomes, matrixOf, typingFit, typingNail } from './typingHands';

const props = withDefaults(
  defineProps<{
    /** Код клавиши-цели (`KeyboardEvent.code`); null — цели нет. */
    target?: string | null;
    /** Пробел: какой половиной бить (большой палец этой руки). */
    thumb?: Thumb | null;
    /** Подсвеченные клавиши (новые клавиши урока), коды. */
    lit?: readonly string[];
    layout: Layout;
    /** Руки поверх клавиш; false — только клавиатура. */
    hands?: boolean;
    handsOpacity?: number;
    /** Руки «как в кадре матча» (065-Р73): согнутые пальцы `hands-typing`, подгонка по четырём кончикам; без — `hands.webp` (Школа, База). */
    typing?: boolean;
  }>(),
  { target: null, thumb: null, lit: () => [], hands: true, handsOpacity: 0.5, typing: false },
);

const geo = layoutKeys(keymap);
const fit = fitHands(geo, HAND_TIPS);
const { width: W, height: H } = HANDS_SIZE;
const bottom = props.typing ? geo.height : Math.max(geo.height, H * fit.scale + Math.min(fit.left.y, fit.right.y));
const tFit = typingFit(frameHomes(fingerHomes(geo)), geo.keys.find((b) => b.key.bump)?.y ?? 2);
const viewBox = `${-VIEW_PAD} ${-VIEW_PAD} ${geo.width + 2 * VIEW_PAD} ${bottom + VIEW_PAD}`;
const halves: { side: Thumb; x: number; y: number; w: number; h: number; box: string }[] = [
  { side: 'left', x: fit.left.x, y: fit.left.y, w: HANDS_SPLIT * fit.scale, h: H * fit.scale, box: `0 0 ${HANDS_SPLIT} ${H}` },
  { side: 'right', x: fit.right.x + HANDS_SPLIT * fit.scale, y: fit.right.y, w: (W - HANDS_SPLIT) * fit.scale, h: H * fit.scale, box: `${HANDS_SPLIT} 0 ${W - HANDS_SPLIT} ${H}` },
];

const targetKey = computed<KeyDef | null>(() => (props.target === null ? null : (keymap.byCode.get(props.target) ?? null)));
const label = (k: KeyDef): string => (k.chars === null ? k.label : (k.chars[props.layout]?.[0] ?? '').toUpperCase().trim());
const place = (side: Thumb, p: ImagePoint): { x: number; y: number } => ({ x: fit[side].x + p.x * fit.scale, y: fit[side].y + p.y * fit.scale });

/** Центр метки: ноготь пальца цели (большой — ноготь большого пальца нужной руки). */
const mark = computed<{ x: number; y: number; finger: Finger } | null>(() => {
  const m = props.hands ? nailMark(targetKey.value, props.thumb) : null;
  if (m === null) return null;
  if (props.typing) return { ...typingNail(tFit, m), finger: m.finger };
  if (m.finger === 'th') return { ...place(m.thumb, THUMB_TIPS[m.thumb]), finger: 'th' };
  return { ...place(m.finger.startsWith('l') ? 'left' : 'right', HAND_TIPS[m.finger]), finger: m.finger };
});
/** Половина пробела под большим пальцем. */
const half = computed(() => {
  const b = geo.keys.find((x) => x.key === targetKey.value);
  if (!b || b.key.finger !== 'th' || props.thumb === null) return null;
  const w = b.w / 2;
  return { x: props.thumb === 'left' ? b.x : b.x + w, y: b.y, w, h: b.h };
});
/**
 * Рамка клавиши. В режиме `typing` — как в кадрах матча (Э1.01–Э1.03): зазор 0,08 вместо 0,12 (`KEY_GAP` движка не трогаем),
 * скругление 0,16; центр подписи — середина шага клавиши (+0,06 к середине рамки движка).
 */
const FRAME_INSET = 0.04;
const FRAME_GROW = 0.04;
const rectOf = (b: { x: number; y: number; w: number; h: number }): { x: number; y: number; width: number; height: number; rx: number } =>
  props.typing
    ? { x: b.x + FRAME_INSET, y: b.y + FRAME_INSET, width: b.w + FRAME_GROW, height: b.h + FRAME_GROW, rx: 0.16 }
    : { x: b.x, y: b.y, width: b.w, height: b.h, rx: 0.14 };
const centerOf = (b: { x: number; y: number; w: number; h: number }): { x: number; y: number } =>
  props.typing ? { x: b.x + b.w / 2 + 0.06, y: b.y + b.h / 2 + 0.06 } : { x: b.x + b.w / 2, y: b.y + b.h / 2 };
/** Служебная клавиша — тёмная, без цвета пальца. В кадрах матча «\» тоже служебная (на ней никто не учится). */
const isService = (k: KeyDef): boolean => k.chars === null || (props.typing && k.code === 'Backslash');
const zone = (k: KeyDef): string => (isService(k) ? 'var(--surface)' : `var(--finger-${k.finger})`);
const targetBox = computed(() => geo.keys.find((x) => x.key === targetKey.value && x.key.chars !== null && x.key.finger !== 'th') ?? null);
</script>

<template>
  <svg
    class="kbh"
    :class="{ typing }"
    :viewBox="viewBox"
    aria-hidden="true"
  >
    <g
      v-for="b in geo.keys"
      :key="b.key.code"
      class="key"
      :class="{ service: isService(b.key), lit: lit.includes(b.key.code) }"
      :style="{ '--zone': zone(b.key) }"
    >
      <rect v-bind="rectOf(b)" />
      <text
        v-if="b.key.finger !== 'th'"
        :x="centerOf(b).x"
        :y="centerOf(b).y"
      >{{ label(b.key) }}</text>
      <line
        v-if="b.key.bump"
        class="bump"
        :x1="b.x + b.w / 2 - 0.16"
        :x2="b.x + b.w / 2 + 0.16"
        :y1="b.y + b.h - 0.16"
        :y2="b.y + b.h - 0.16"
      />
    </g>
    <template v-if="hands && typing">
      <image
        v-for="side in (['left', 'right'] as const)"
        :key="side"
        :href="artUrl(side === 'left' ? 'handsTypingL' : 'handsTypingR')"
        x="0"
        y="0"
        :width="TYPING_SIZE"
        :height="TYPING_SIZE"
        :opacity="handsOpacity"
        :transform="matrixOf(tFit[side])"
      />
    </template>
    <template v-else-if="hands">
      <svg
        v-for="h in halves"
        :key="h.side"
        :x="h.x"
        :y="h.y"
        :width="h.w"
        :height="h.h"
        :viewBox="h.box"
      >
        <image
          :href="artUrl('hands')"
          x="0"
          y="0"
          :width="W"
          :height="H"
          :opacity="handsOpacity"
        />
      </svg>
    </template>
    <rect
      v-if="half"
      class="half"
      :x="half.x"
      :y="half.y"
      :width="half.w"
      :height="half.h"
      rx="0.14"
    />
    <!-- цель поверх рук: подсветка клавиши не гаснет под ладонью -->
    <g
      v-if="targetBox"
      class="key target"
      :style="{ '--zone': zone(targetBox.key) }"
    >
      <rect v-bind="rectOf(targetBox)" />
      <text
        :x="centerOf(targetBox).x"
        :y="centerOf(targetBox).y"
      >{{ label(targetBox.key) }}</text>
    </g>
    <g
      v-if="mark"
      class="nail"
      :style="{ '--zone': `var(--finger-${mark.finger})` }"
    >
      <circle
        class="dot"
        :cx="mark.x"
        :cy="mark.y"
        r="0.16"
      />
      <circle
        class="ring"
        :cx="mark.x"
        :cy="mark.y"
        r="0.2"
      />
    </g>
  </svg>
</template>

<style scoped>
.kbh {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
  user-select: none;
}
/* руки «как в кадре матча» шире и ниже поля клавиатуры: без кромки обрезки (065-Р150), края сцены режет сама сцена */
.kbh.typing {
  overflow: visible;
}
.key rect {
  fill: color-mix(in srgb, var(--zone) 36%, var(--surface));
  stroke: color-mix(in srgb, var(--zone) 55%, var(--border));
  stroke-width: 0.03;
}
.key text {
  fill: var(--text);
  font-family: var(--font);
  font-size: 0.44px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.key.service text {
  fill: var(--text-muted);
  font-size: 0.36px;
  font-weight: 600;
}
.key.lit rect {
  fill: var(--zone);
}
.key.lit text {
  fill: var(--on-zone);
}
.key.target rect {
  fill: var(--zone);
  stroke: #fff;
  stroke-width: 0.06;
}
.key.target text {
  fill: var(--on-zone);
  font-size: 0.56px;
  font-weight: 900;
}
.bump {
  stroke: var(--text);
  stroke-width: 0.05;
  stroke-linecap: round;
  opacity: 0.75;
}
.half {
  fill: var(--finger-th);
  stroke: #fff;
  stroke-width: 0.05;
}
.dot {
  fill: var(--zone);
  stroke: #14123a;
  stroke-width: 0.1;
}
.ring {
  fill: none;
  stroke: #fff;
  stroke-width: 0.07;
}
</style>

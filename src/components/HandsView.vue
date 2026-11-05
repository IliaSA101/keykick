<script setup lang="ts">
/*
 * Две руки над клавиатурой — картинка (art/hands.webp): вид сверху, ладони вниз, пальцы
 * тянутся к клавишам. Связь «палец ↔ цвет клавиш» держат метки на ногтях: кружок в цвете
 * зоны пальца. Нужный палец — метка крупнее, светится и мягко пульсирует.
 *
 * Рисунок — в единицах клавиатуры и с тем же верхом (VIEW_PAD), что у KeyboardView: при одной
 * ширине указательные и средние стоят над своими клавишами основного ряда (engine/keyboardLayout.
 * fitHands — единый масштаб, без растяжения). Метки — на кончиках картинки (art/hands), не на клавишах.
 * Что ниже клавиатуры, обрезает родитель. Прозрачность картинки задаёт родитель через
 * --hands-opacity, метки всегда непрозрачны.
 */
import { computed } from 'vue';
import { keymap } from '../app/keymap';
import { artUrl } from '../art/assets';
import { HAND_TIPS, HANDS_SIZE, THUMB_TIPS } from '../art/hands';
import { VIEW_PAD, fitHands, layoutKeys, type ImagePoint } from '../engine/keyboardLayout';
import type { Finger, Thumb } from '../engine/keymap';
import { ru } from '../i18n/ru';

const props = withDefaults(
  defineProps<{
    /** Палец для нужной клавиши; th — оба больших. */
    finger: Finger | null;
    /** Палец на Shift, если символ набирается с Shift. */
    shiftFinger: Finger | null;
    /** Ещё пальцы, которые горят: показ в справке «Как держать руки». */
    fingers?: readonly Finger[];
    /** Пробел: каким большим бить — горит только он; null — оба. */
    thumb?: Thumb | null;
  }>(),
  { fingers: () => [], thumb: null },
);

const geo = layoutKeys(keymap);
/*
 * Подъём над подгонкой, в шагах клавиши. Подгонка ставит ногти на середину основного ряда, но там
 * метка закрывает букву, а большие пальцы картинки уходят на 0,9 клавиши ниже пробела и в окно
 * 1024×640 не влезают. С подъёмом в полклавиши ногти указательных — у верхнего края своих клавиш
 * (буква видна), средние — на зазоре над рядом, большие — сразу под пробелом.
 */
const LIFT = 0.5;
const fitted = fitHands(geo, HAND_TIPS);
const fit = { ...fitted, y: fitted.y - LIFT };

const picture = {
  href: artUrl('hands'),
  x: fit.x,
  y: fit.y,
  width: HANDS_SIZE.width * fit.scale,
  height: HANDS_SIZE.height * fit.scale,
};

/** Метка: радиус обычной и горящей, кольцо вокруг горящей — в единицах клавиатуры (шаг клавиши = 1). */
const MARK_R = 0.11;
const LIT_R = 0.17;
const HALO_R = 0.27;

const viewBox = `${-VIEW_PAD} ${-VIEW_PAD} ${geo.width + 2 * VIEW_PAD} ${picture.y + picture.height + VIEW_PAD}`;

interface Mark {
  id: string;
  finger: Finger;
  x: number;
  y: number;
}

interface Hand {
  side: Thumb;
  title: string;
  marks: Mark[];
}

const place = (id: string, finger: Finger, p: ImagePoint): Mark => ({
  id,
  finger,
  x: fit.x + p.x * fit.scale,
  y: fit.y + p.y * fit.scale,
});

function hand(side: Thumb): Hand {
  const own = side === 'left' ? (['lp', 'lr', 'lm', 'li'] as const) : (['ri', 'rm', 'rr', 'rp'] as const);
  return {
    side,
    title: side === 'left' ? ru.keyboard.leftHand : ru.keyboard.rightHand,
    marks: [...own.map((f) => place(f, f, HAND_TIPS[f])), place(`th-${side}`, 'th', THUMB_TIPS[side])],
  };
}

const hands = [hand('left'), hand('right')];

const lit = computed(
  () => new Set([props.finger, props.shiftFinger, ...props.fingers].filter((f) => f !== null)),
);

/** Большой для пробела — один, другой руки (кроме показа в справке, где горят оба). */
const oneThumb = computed(() => (props.fingers.includes('th') ? null : props.thumb));

function isLit(m: Mark): boolean {
  if (m.finger === 'th' && oneThumb.value) return lit.value.has('th') && m.id === `th-${oneThumb.value}`;
  return lit.value.has(m.finger);
}

const ariaLabel = computed(() => {
  const names = [...lit.value].map((f) =>
    f === 'th' && oneThumb.value ? ru.keyboard.thumbs[oneThumb.value] : ru.keyboard.fingers[f],
  );
  return names.length ? `${ru.keyboard.hands}: ${names.join(', ')}` : ru.keyboard.hands;
});
</script>

<template>
  <svg
    class="hands"
    :viewBox="viewBox"
    role="img"
    :aria-label="ariaLabel"
  >
    <image
      class="picture"
      :href="picture.href"
      :x="picture.x"
      :y="picture.y"
      :width="picture.width"
      :height="picture.height"
    />
    <g
      v-for="h in hands"
      :key="h.side"
      class="hand"
    >
      <title>{{ h.title }}</title>
      <g
        v-for="m in h.marks"
        :key="m.id"
        class="mark"
        :class="{ lit: isLit(m) }"
        :style="{ '--zone': `var(--finger-${m.finger})` }"
      >
        <circle
          v-if="isLit(m)"
          class="halo"
          :cx="m.x"
          :cy="m.y"
          :r="HALO_R"
        />
        <circle
          class="dot"
          :cx="m.x"
          :cy="m.y"
          :r="isLit(m) ? LIT_R : MARK_R"
        />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.hands {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
}

.picture {
  opacity: var(--hands-opacity, 1);
}

.dot {
  fill: var(--zone);
  stroke: #1b1640;
  stroke-width: 0.035;
}

/* Нужный палец: метка крупнее, светлая обводка, вокруг — светящееся кольцо цвета зоны. */
.mark.lit .dot {
  stroke: #ffffff;
  stroke-width: 0.045;
}

.halo {
  fill: color-mix(in srgb, var(--zone) 25%, transparent);
  stroke: var(--zone);
  stroke-width: 0.06;
  transform-box: fill-box;
  transform-origin: center;
  animation: pulse 1.1s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .halo {
    animation: none;
  }
}
</style>

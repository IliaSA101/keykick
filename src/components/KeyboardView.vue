<script setup lang="ts">
/*
 * Экранная клавиатура: клавиши в цветах зон пальцев (приглушённо), нужная — ярко, с обводкой.
 * Если для символа нужен Shift — горит и Shift другой руки. Ошибка — короткая красная вспышка.
 * Геометрия — в движке (engine/keyboardLayout), здесь только рисунок.
 */
import { computed, ref, watch } from 'vue';
import { keymap } from '../app/keymap';
import { VIEW_PAD, layoutKeys, type KeyBox } from '../engine/keyboardLayout';
import { shiftFor, type KeyDef, type Layout, type Thumb } from '../engine/keymap';
import { ru } from '../i18n/ru';

const props = withDefaults(
  defineProps<{
    /** Клавиша, которую ждём; null — ничего не подсвечиваем. */
    target: KeyDef | null;
    /** Символ набирается с Shift — подсветить и Shift другой руки. */
    shift: boolean;
    /** Последнее нажатие — ошибка: нужная клавиша мигает красным. */
    error: boolean;
    /**
     * Счётчик ошибок (например, stats.errors). Необязателен: нужен, чтобы вспышка
     * повторялась на ошибке подряд, когда error и так уже true.
     */
    errors?: number;
    layout: Layout;
    /** false — режим «Слепой форвард»: подписей нет, остаются цвета зон и засечки. */
    showLabels?: boolean;
    /** Ещё клавиши, которые горят как нужная (коды): показ в справке «Как держать руки». */
    marks?: readonly string[];
    /** Нужен пробел — каким большим его бить: горит только эта половина клавиши */
    thumb?: Thumb | null;
  }>(),
  { errors: 0, showLabels: true, marks: () => [], thumb: null },
);

const geo = layoutKeys(keymap);
const viewBox = `${-VIEW_PAD} ${-VIEW_PAD} ${geo.width + 2 * VIEW_PAD} ${geo.height + 2 * VIEW_PAD}`;

const shiftCode = computed(() => (props.target && props.shift ? shiftFor(props.target.finger) : null));
const targetBox = computed(() => geo.keys.find((b) => b.key === props.target) ?? null);
/** Половина пробела под нужным большим пальцем; null — горит клавиша целиком. */
const half = computed<KeyBox | null>(() => {
  const b = targetBox.value;
  if (!b || !props.thumb || b.key.finger !== 'th') return null;
  const w = b.w / 2;
  return { ...b, x: props.thumb === 'left' ? b.x : b.x + w, w };
});
const lit = computed(() =>
  geo.keys.filter(
    (b) =>
      (b.key === props.target && !half.value) ||
      b.key.code === shiftCode.value ||
      props.marks.includes(b.key.code),
  ),
);
/** Обводки: горящие клавиши и половина пробела. */
const rings = computed(() => (half.value ? [...lit.value, half.value] : lit.value));

/** Подпись символа: как на клавише — заглавной; у пробела подписи нет. */
function charLabel(key: KeyDef): string {
  return key.chars ? key.chars[props.layout][0].toLocaleUpperCase().trim() : '';
}

function labelOf(box: KeyBox): string {
  if (!box.key.chars) return box.key.label;
  return props.showLabels ? charLabel(box.key) : '';
}

const ariaLabel = computed(() => {
  const k = ru.keyboard;
  const key = props.target;
  if (!key) return k.label;
  const name = key.chars ? charLabel(key) || k.space : key.label;
  const shift = shiftCode.value ? `, ${k.withShift}` : '';
  const finger = half.value && props.thumb ? k.thumbs[props.thumb] : k.fingers[key.finger];
  return `${k.label}. ${k.next}: ${name}${shift} — ${finger}`;
});

// Вспышка: элемент с новым key монтируется заново, и анимация начинается сначала;
// к концу анимации он прозрачен, поэтому таймеры не нужны.
const flashId = ref(0);

watch(
  () => [props.error, props.errors] as const,
  ([error, errors], [wasError, wasErrors]) => {
    if (error && (!wasError || errors > wasErrors)) flashId.value++;
  },
);
</script>

<template>
  <svg
    class="keyboard"
    :viewBox="viewBox"
    role="img"
    :aria-label="ariaLabel"
  >
    <g
      v-for="b in geo.keys"
      :key="b.key.code"
      class="key"
      :class="{ lit: lit.includes(b), service: !b.key.chars }"
      :style="{ '--zone': `var(--finger-${b.key.finger})` }"
    >
      <rect
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        rx="0.14"
      />
      <text
        v-if="labelOf(b)"
        :x="b.x + b.w / 2"
        :y="b.y + b.h / 2"
      >{{ labelOf(b) }}</text>
      <line
        v-if="b.key.bump"
        class="bump"
        :x1="b.x + b.w / 2 - 0.14"
        :x2="b.x + b.w / 2 + 0.14"
        :y1="b.y + b.h - 0.14"
        :y2="b.y + b.h - 0.14"
      />
    </g>

    <rect
      v-if="half"
      class="half"
      :x="half.x"
      :y="half.y"
      :width="half.w"
      :height="half.h"
      rx="0.14"
    />
    <!-- Обводка поверх всех клавиш: так её не перекрывают соседи. -->
    <rect
      v-for="b in rings"
      :key="`ring-${b.key.code}-${b.x}`"
      class="ring"
      :x="b.x - 0.04"
      :y="b.y - 0.04"
      :width="b.w + 0.08"
      :height="b.h + 0.08"
      rx="0.17"
    />
    <rect
      v-if="flashId > 0 && targetBox"
      :key="flashId"
      class="flash"
      :x="targetBox.x"
      :y="targetBox.y"
      :width="targetBox.w"
      :height="targetBox.h"
      rx="0.14"
    />
  </svg>
</template>

<style scoped>
.keyboard {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
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
  font-size: 0.3px;
  font-weight: 600;
}

.key.lit rect {
  fill: var(--zone);
}

.half {
  fill: var(--finger-th);
  pointer-events: none;
}

.key.lit text {
  fill: var(--on-zone);
}

.bump {
  stroke: var(--text);
  stroke-width: 0.05;
  stroke-linecap: round;
  opacity: 0.75;
}

.key.lit .bump {
  stroke: var(--on-zone);
}

.ring {
  fill: none;
  stroke: var(--text);
  stroke-width: 0.07;
  animation: pulse 1.1s ease-in-out infinite;
}

.flash {
  fill: var(--error);
  pointer-events: none;
  animation: flash 450ms ease-out forwards;
}

@keyframes pulse {
  50% {
    stroke-opacity: 0.35;
    stroke-width: 0.12;
  }
}

@keyframes flash {
  from {
    opacity: 0.9;
  }

  to {
    opacity: 0;
  }
}

/* Без движения: обводка стоит ровно, вспышка не гаснет плавно — держится и разом пропадает. */
@media (prefers-reduced-motion: reduce) {
  .ring {
    animation: none;
  }

  .flash {
    animation-timing-function: step-end;
  }
}
</style>

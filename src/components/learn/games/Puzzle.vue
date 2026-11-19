<script setup lang="ts">
/**
 * Арена «Собери клавиатуру» (Э8.10–12): клавиатура набора в «чемодане», гнёзда — клавиши выученных букв в цвете пальца (`--finger-*`, 35 %),
 * лоток внизу. Буква — переносом на клавишу (pointer) или кликом по букве, затем по клавише. Геометрия — `layoutKeys(keymap)`; на экране буквы заглавные.
 */
import { computed, ref } from 'vue';
import type { Miss } from '../../../app/learn/view';
import type { PuzzleState } from '../../../engine/learn/games/puzzle';
import { ru } from '../../../i18n/ru';
import { layoutKeys } from '../../../engine/typing/keyboardLayout';
import { keymap } from '../../../engine/typing/layouts';

const props = defineProps<{ s: PuzzleState; layout: string; miss: Miss | null }>();
const emit = defineEmits<{ place: [letter: string, socket: string] }>();
const geo = layoutKeys(keymap);
const PAD = 22;
const FX = 17;
const FW = 528;
const U = (FW - 2 * PAD) / geo.width;
const KY = 16 + PAD;
const keys = computed(() =>
  geo.keys.map((b) => {
    const ch = b.key.chars === null ? '' : (b.key.chars[props.layout]?.[0] ?? '');
    const tray = props.s.tray.includes(ch);
    const placed = props.s.placed.includes(ch);
    return { code: b.key.code, ch, service: b.key.chars === null, tray, placed, finger: b.key.finger, label: b.key.chars === null ? b.key.label : ch.toUpperCase(), x: FX + PAD + b.x * U, y: KY + b.y * U, w: b.w * U, h: b.h * U };
  }),
);
const rest = computed(() => props.s.tray.filter((l) => !props.s.placed.includes(l)));
/** Выбранная кликом буква и буква, что несут сейчас (px лотка). */
const sel = ref('');
const drag = ref<{ letter: string; x: number; y: number; fx: number; fy: number } | null>(null);

function down(e: PointerEvent, letter: string): void {
  sel.value = letter;
  drag.value = { letter, x: e.clientX, y: e.clientY, fx: e.clientX, fy: e.clientY };
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
}
function move(e: PointerEvent): void {
  if (drag.value !== null) drag.value = { ...drag.value, x: e.clientX, y: e.clientY };
}
function up(e: PointerEvent): void {
  const d = drag.value;
  drag.value = null;
  if (d === null || Math.hypot(d.x - d.fx, d.y - d.fy) < 6) return;
  const hit = globalThis.document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-socket]');
  sel.value = '';
  const socket = hit?.getAttribute('data-socket');
  if (socket) emit('place', d.letter, socket);
}
function onKey(e: MouseEvent, ch: string): void {
  if (e.detail > 1 || sel.value === '' || ch === '') return;
  emit('place', sel.value, ch);
  sel.value = '';
}
</script>

<template>
  <svg
    class="art"
    viewBox="0 0 562 320"
    @pointermove="move"
    @pointerup="up"
  >
    <rect
      :x="FX"
      y="16"
      :width="FW"
      height="200"
      rx="16"
      fill="#171a3d"
      stroke="#4b5086"
      stroke-width="2"
    />
    <g
      v-for="k in keys"
      :key="k.code"
      :data-socket="k.ch || undefined"
      @click="onKey($event, k.ch)"
    >
      <rect
        :x="k.x"
        :y="k.y"
        :width="k.w"
        :height="k.h"
        rx="5"
        :style="k.service ? undefined : k.placed ? `fill: var(--finger-${k.finger}); stroke: #fff` : `fill: color-mix(in srgb, var(--finger-${k.finger}) 35%, var(--surface)); stroke: ${k.tray ? `var(--finger-${k.finger})` : 'rgb(255 255 255 / .3)'}`"
        :fill="k.service ? 'rgb(255 255 255 / .1)' : undefined"
        :stroke="k.service ? 'rgb(255 255 255 / .3)' : undefined"
        :stroke-width="k.placed ? 2.5 : 1.5"
        :stroke-dasharray="k.tray && !k.placed ? '5 4' : undefined"
      />
      <text
        v-if="k.service || k.placed"
        :x="k.x + k.w / 2"
        :y="k.y + k.h / 2 + 5"
        text-anchor="middle"
        :font-size="k.service ? 9 : 18"
        font-weight="800"
        :style="k.service ? 'fill: var(--text-muted)' : 'fill: var(--on-zone)'"
      >{{ k.label }}</text>
    </g>
    <rect
      :x="FX"
      y="224"
      :width="FW"
      height="52"
      rx="12"
      fill="rgb(255 255 255 / .08)"
    />
    <text
      :x="FX + 18"
      y="256"
      font-size="13"
      font-weight="700"
      class="lab"
    >{{ ru.learn.games.keyboard.tray.toLowerCase() }}</text>
    <g
      v-for="(l, i) in rest"
      :key="l"
      class="tile"
      @pointerdown="down($event, l)"
    >
      <rect
        :x="FX + 84 + i * 48"
        y="230"
        width="40"
        height="40"
        rx="9"
        fill="#fff"
        :stroke="sel === l ? '#2f8f46' : '#c9ced6'"
        :stroke-width="sel === l ? 4 : 2"
      />
      <text
        :x="FX + 104 + i * 48"
        y="257"
        text-anchor="middle"
        font-size="23"
        font-weight="800"
        fill="#1d2330"
      >{{ l.toUpperCase() }}</text>
    </g>
  </svg>
  <span
    v-if="drag && Math.hypot(drag.x - drag.fx, drag.y - drag.fy) >= 6"
    class="ghost"
    :style="{ left: `${drag.x}px`, top: `${drag.y}px` }"
  >{{ drag.letter.toUpperCase() }}</span>
</template>

<style scoped>
.art { display: block; width: 100%; height: 100%; touch-action: none; }
.tile { cursor: grab; }
.lab { fill: var(--text-muted); }
.ghost { position: fixed; z-index: 30; transform: translate(-50%, -50%); pointer-events: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 9px; background: #fff; color: #1d2330; font-size: 23px; font-weight: 800; }
</style>

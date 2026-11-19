<script setup lang="ts">
/**
 * Арена «Точный пас мышью» (Э8.04–06): щелчок по партнёру, затем перенос мяча к нему (pointer-события; сдвиг меньше 6 px переносом
 * не считается; второй щелчок двойного — `detail > 1` — игнорируется). Координаты уходят в процентах арены; расстановка — `mouseView`.
 */
import { computed, ref } from 'vue';
import { artUrl } from '../../../art/assets';
import { mouseView, type Miss } from '../../../app/learn/view';
import type { MouseInput, MouseState } from '../../../engine/learn/games/mouse';
import Piece from './Piece.vue';

const props = defineProps<{ s: MouseState; seed: number; miss: Miss | null; body: string; rival?: string | undefined }>();
const emit = defineEmits<{ input: [MouseInput] }>();
const W = 562;
const H = 320;
const K = W / 1160;
const view = computed(() => mouseView(props.seed, props.s));
const step = computed(() => props.s.steps[props.s.at]);
const svg = ref<SVGSVGElement | null>(null);
/** Где мяч тащат сейчас (px арены); `null` — не тащат. */
const drag = ref<{ x: number; y: number; from: { x: number; y: number } } | null>(null);

function pct(e: PointerEvent | MouseEvent): { x: number; y: number; px: number; py: number } {
  const r = svg.value?.getBoundingClientRect();
  const w = r?.width || W;
  const h = r?.height || H;
  const px = (e.clientX - (r?.left ?? 0)) / w;
  const py = (e.clientY - (r?.top ?? 0)) / h;
  return { x: px * 100, y: py * 100, px: px * W, py: py * H };
}
function onClick(e: MouseEvent): void {
  if (e.detail > 1 || step.value?.kind !== 'click') return;
  const p = pct(e);
  emit('input', { type: 'click', at: { x: p.x, y: p.y } });
}
function down(e: PointerEvent): void {
  if (step.value?.kind !== 'carry' || view.value.ball === null) return;
  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  const p = pct(e);
  drag.value = { x: p.px, y: p.py, from: { x: p.px, y: p.py } };
}
function move(e: PointerEvent): void {
  if (drag.value === null) return;
  const p = pct(e);
  drag.value = { ...drag.value, x: p.px, y: p.py };
}
function up(e: PointerEvent): void {
  const d = drag.value;
  drag.value = null;
  if (d === null || Math.hypot(d.x - d.from.x, d.y - d.from.y) < 6) return;
  const p = pct(e);
  emit('input', { type: 'drop', at: { x: p.x, y: p.y } });
}
const ballAt = computed(() => (view.value.ball === null ? null : { x: (view.value.ball.x * W) / 100, y: (view.value.ball.y * H) / 100 }));
const px = (p: { x: number; y: number }): { x: number; y: number } => ({ x: (p.x * W) / 100, y: (p.y * H) / 100 });
</script>

<template>
  <svg
    ref="svg"
    class="art"
    :viewBox="`0 0 ${W} ${H}`"
    aria-hidden="true"
    @click="onClick"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="drag = null"
  >
    <image
      :href="artUrl('baseFieldGoals')"
      :x="-380 * K"
      :y="-215 * K"
      :width="1920 * K"
      :height="1072 * K"
    />
    <circle
      v-if="miss?.at"
      :cx="px(miss.at).x"
      :cy="px(miss.at).y"
      r="26"
      fill="#e5484d"
      fill-opacity=".45"
      stroke="#ff4d4f"
      stroke-width="3"
    />
    <Piece
      v-for="(d, i) in view.decoys"
      :key="i"
      :x="px(d).x"
      :y="px(d).y"
      :s="0.66"
      :foe="d.foe"
      :rival="rival"
      :label="d.num"
      :body="body"
    />
    <Piece
      :x="px(view.target).x"
      :y="px(view.target).y"
      :s="0.66"
      :label="view.target.num"
      :body="body"
      :ring="step?.kind === 'click' ? 'solid' : 'dash'"
    />
    <circle
      v-if="ballAt"
      :cx="drag?.x ?? ballAt.x"
      :cy="drag?.y ?? ballAt.y"
      r="12"
      fill="#fff"
      stroke="#2b2438"
      stroke-width="2"
    />
  </svg>
</template>

<style scoped>
.art { display: block; width: 100%; height: 100%; touch-action: none; }
</style>

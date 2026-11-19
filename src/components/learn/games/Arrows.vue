<script setup lang="ts">
/** Арена «Пас стрелками» (Э8.01–02): поле 8×5 на всю арену, ворота и зона цели — кодом, защитники — соперник, мяч — у нашего игрока; ввод — стрелки (окно). */
import { computed } from 'vue';
import cfg from '../../../content/learn.json';
import type { ArrowsState } from '../../../engine/learn/games/arrows';
import type { Miss } from '../../../app/learn/view';
import Piece from './Piece.vue';

const props = defineProps<{ s: ArrowsState; miss: Miss | null; body: string; letter: string; rival?: string | undefined }>();
const W = 562;
const H = 320;
const COLS = cfg.play.arrows.cols;
const ROWS = cfg.play.arrows.rows;
const GX = 27;
const CW = (W - 2 * GX) / COLS;
const CH = H / ROWS;
const cx = (c: number): number => GX + c * CW + CW / 2;
const cy = (r: number): number => r * CH + CH / 2;
const cells = Array.from({ length: COLS * ROWS }, (_, i) => ({ c: i % COLS, r: Math.floor(i / COLS) }));
const zoneTop = computed(() => (props.s.zone[0]?.y ?? 1) * CH);
const mark = computed(() => {
  const at = props.miss?.at;
  return at && at.x >= 0 && at.y >= 0 && at.x < COLS && at.y < ROWS ? at : null;
});
const f1 = (n: number): string => n.toFixed(1);
/** Ворота (как в макете): сетка-рамка 22 × 56 по центру ряда мяча; слева задняя стенка — слева, справа — справа. */
const gates = computed(() =>
  [true, false].map((left) => {
    const x = left ? GX - 22 : W - GX;
    const y = cy(props.s.ball.y) - 28;
    const front = left ? x + 22 : x;
    const back = left ? x : x + 22;
    const net = Array.from({ length: 6 }, (_, i) => `M${f1(x + ((i + 1) * 22) / 7)} ${f1(y)}v56`).join('') + Array.from({ length: 7 }, (_, i) => `M${f1(x)} ${f1(y + ((i + 1) * 56) / 8)}h22`).join('');
    return { x, y, net, frame: `M${f1(front)} ${f1(y)}H${f1(back)}V${f1(y + 56)}H${f1(front)}`, post: `M${f1(front)} ${f1(y - 1)}v58` };
  }),
);
</script>

<template>
  <svg
    class="art"
    :viewBox="`0 0 ${W} ${H}`"
    aria-hidden="true"
  >
    <rect
      :width="W"
      :height="H"
      fill="#587a39"
    />
    <rect
      v-for="q in cells"
      :key="`${q.c}-${q.r}`"
      :x="GX + q.c * CW"
      :y="q.r * CH"
      :width="CW"
      :height="CH"
      :fill="(q.c + q.r) % 2 ? '#000' : '#fff'"
      fill-opacity=".06"
    />
    <path
      :d="`M${GX + 4 * CW} 0V${H}`"
      stroke="#fff"
      stroke-opacity=".35"
      stroke-width="2"
      fill="none"
    />
    <circle
      :cx="GX + 4 * CW"
      :cy="cy(2)"
      :r="CH * 0.8"
      stroke="#fff"
      stroke-opacity=".35"
      stroke-width="2"
      fill="none"
    />
    <rect
      :x="GX + 7 * CW"
      :y="zoneTop"
      :width="CW"
      :height="3 * CH"
      fill="#fff"
      fill-opacity=".1"
      stroke="#fff"
      stroke-opacity=".35"
      stroke-width="2"
    />
    <rect
      :x="GX + 7 * CW"
      :y="zoneTop"
      :width="CW"
      :height="3 * CH"
      fill="none"
      stroke="#fff"
      stroke-width="3"
      stroke-dasharray="8 6"
    />
    <g
      v-for="g in gates"
      :key="g.x"
    >
      <rect
        :x="g.x"
        :y="g.y"
        width="22"
        height="56"
        fill="#fff"
        fill-opacity=".1"
      />
      <path
        :d="g.net"
        stroke="#fff"
        stroke-opacity=".45"
        stroke-width="1"
        fill="none"
      />
      <path
        :d="g.frame"
        stroke="#fff"
        stroke-width="3"
        fill="none"
        stroke-linejoin="round"
      />
      <path
        :d="g.post"
        stroke="#fff"
        stroke-width="4"
        stroke-linecap="round"
      />
    </g>
    <rect
      v-if="mark"
      :x="GX + mark.x * CW + 1.5"
      :y="mark.y * CH + 1.5"
      :width="CW - 3"
      :height="CH - 3"
      fill="#e5484d"
      fill-opacity=".45"
      stroke="#ff4d4f"
      stroke-width="3"
    />
    <Piece
      v-for="d in s.defenders"
      :key="`${d.x},${d.y}`"
      :x="cx(d.x)"
      :y="cy(d.y)"
      foe
      :rival="rival"
    />
    <Piece
      :x="cx(s.ball.x)"
      :y="cy(s.ball.y)"
      :body="body"
      :label="letter"
      ring="solid"
    />
    <circle
      :cx="cx(s.ball.x) + 15"
      :cy="cy(s.ball.y) + 11"
      r="8"
      fill="#fff"
      stroke="#2b2438"
      stroke-width="2"
    />
  </svg>
</template>

<style scoped>
.art { display: block; width: 100%; height: 100%; }
</style>

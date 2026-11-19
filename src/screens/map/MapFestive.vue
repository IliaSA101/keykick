<script setup lang="ts">
/**
 * Праздничный свет Карты в день титула (068 Т9, кадр Э2.104, макет `festLight` в `tools/mock-map/league.mjs`):
 * тёплый тон поверх карты, гирлянда из девяти дуг по три огонька под шапкой экрана и белые четырёхлучевые искры.
 * Только украшение: не ловит мышь. ТАБУ (068-Р65): огоньки и тон — тёплый белый, не жёлтые вещи на синих стенах; провод тёмный, золота на синем нет.
 */
const props = defineProps<{ width: number }>();
const ARCS = 9;
const SAG = 16;
const Y0 = 92;
/** Огонёк: центр на дуге провода, радиус сердцевины 4,2 и ореол 9 (как в макете). */
const arc = (i: number, f: number): { x: number; y: number } => ({ x: ((i + f) * props.width) / ARCS, y: Y0 + SAG * 4 * f * (1 - f) + 4 });
const bulbs = Array.from({ length: ARCS * 3 }, (_, k) => arc(Math.floor(k / 3), [0.25, 0.5, 0.75][k % 3]!));
const wire = Array.from({ length: ARCS }, (_, i) => `Q${((i + 0.5) * props.width) / ARCS} ${Y0 + SAG * 2} ${((i + 1) * props.width) / ARCS} ${Y0}`).join(' ');
/** Искры — доли ширины карты и высота в px (места, свободные от ярлыков, как на принятом кадре); r — луч. */
const SPARKS = [[0.12, 251, 9], [0.28, 143, 7], [0.44, 208, 11], [0.58, 123, 8], [0.67, 298, 10], [0.86, 165, 8], [0.93, 380, 7]] as const;
const star = (x: number, y: number, r: number): string => {
  const q = r * 0.28;
  return `M${x} ${y - r}L${x + q} ${y - q}L${x + r} ${y}L${x + q} ${y + q}L${x} ${y + r}L${x - q} ${y + q}L${x - r} ${y}L${x - q} ${y - q}Z`;
};
const sparks = SPARKS.map(([fx, y, r]) => star(Math.round(fx * props.width), y, r));
</script>

<template>
  <div
    class="fest"
    aria-hidden="true"
  >
    <div class="tone" />
    <svg
      class="lights"
      :width="width"
      height="640"
    >
      <path
        :d="`M0 ${Y0} ${wire}`"
        class="wire"
      />
      <g
        v-for="(b, k) in bulbs"
        :key="`b${k}`"
        class="bulb"
        :style="{ animationDelay: `${(k % 7) * 0.3}s` }"
      >
        <circle
          :cx="b.x"
          :cy="b.y"
          r="9"
          class="halo"
        />
        <circle
          :cx="b.x"
          :cy="b.y"
          r="4.2"
          class="core"
        />
      </g>
      <path
        v-for="(d, k) in sparks"
        :key="`s${k}`"
        :d="d"
        class="spark"
        :style="{ animationDelay: `${k * 0.4}s` }"
      />
    </svg>
  </div>
</template>

<style scoped>
.fest { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.tone { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 45%, rgb(255 238 212 / 0.2), rgb(255 238 212 / 0.08) 60%, transparent 85%); }
.lights { position: absolute; left: 0; top: 0; }
.wire { fill: none; stroke: rgb(20 18 40); stroke-width: 1.6; }
.halo { fill: rgb(255 244 222 / 0.22); }
.core { fill: #fff6e4; }
.spark { fill: #fff6e0; }
.bulb, .spark { animation: tw 2.6s ease-in-out infinite; }
@keyframes tw { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .bulb, .spark { animation: none; } }
</style>

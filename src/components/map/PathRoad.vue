<script setup lang="ts">
// Дорога «Пути клуба» (спека 019-Т9, design §6, ТЗ-1.3): шесть мест лиг на одной извилистой дороге. Только показ:
// состояния мест приходят готовыми из модели (`engine/map/path`), решения здесь нет. Единственная кнопка — у текущего
// (строящегося) места, остальные — подписи. Позиции — в % от поля; подписи чередуются сверху и снизу, чтобы не слипаться.
import { computed } from 'vue';
import { ru } from '../../i18n/ru';
import { openLabel, placeLabel, type PathItem } from './pathLabels';

const props = defineProps<{ items: PathItem[] }>();
const emit = defineEmits<{ open: [] }>();

const X_FROM = 11;
const X_TO = 89;
const Y_UP = 38;
const Y_DOWN = 62;

/** Значок в метке места. */
const GLYPH = { done: '✓', current: '▶', building: '…', next: '·', fog: '?' } as const;

const nodes = computed(() =>
  props.items.map((item, i) => {
    const x = props.items.length > 1 ? X_FROM + (i * (X_TO - X_FROM)) / (props.items.length - 1) : 50;
    const up = i % 2 === 1;
    const label = placeLabel(item);
    return {
      item,
      label,
      x,
      y: up ? Y_UP : Y_DOWN,
      up,
      glyph: item.place.alwaysVisible && item.place.state === 'fog' ? '★' : GLYPH[item.place.state],
      aria: openLabel(item),
    };
  }),
);

/** Звено дороги к месту: пройденное и текущее — «прошли», следующее и туман — пунктиром. */
const segments = computed(() =>
  nodes.value.slice(1).map((n, i) => {
    const from = nodes.value[i]!;
    const s = n.item.place.state;
    return { x1: from.x, y1: from.y, x2: n.x, y2: n.y, kind: s === 'next' || s === 'fog' ? s : 'walk' };
  }),
);

/** «Отъезд камеры» начинается с текущего места. */
const origin = computed(() => {
  const n = nodes.value.find((x) => x.item.actionable) ?? nodes.value[0];
  return n ? `${n.x}% ${n.y}%` : '50% 50%';
});
</script>

<template>
  <div
    class="scene"
    :style="{ transformOrigin: origin }"
  >
    <svg
      class="line"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        v-for="(s, i) in segments"
        :key="i"
        :class="s.kind"
        :x1="s.x1"
        :y1="s.y1"
        :x2="s.x2"
        :y2="s.y2"
      />
    </svg>

    <ol
      class="places"
      :aria-label="ru.clubPath.region"
    >
      <li
        v-for="n in nodes"
        :key="n.item.place.league"
        class="place"
        :class="[n.item.place.state, n.up ? 'up' : 'down', { cup: n.item.place.alwaysVisible, edge: n.item === props.items[props.items.length - 1] }]"
        :style="{ left: `${n.x}%`, top: `${n.y}%` }"
      >
        <component
          :is="n.item.actionable ? 'button' : 'div'"
          class="node"
          :type="n.item.actionable ? 'button' : undefined"
          :aria-label="n.item.actionable ? n.aria : undefined"
          :data-focus="n.item.actionable ? 'open' : undefined"
          @click="n.item.actionable && emit('open')"
        >
          <span
            class="marker"
            aria-hidden="true"
          >{{ n.glyph }}</span>
          <span
            class="card"
            :aria-hidden="n.item.actionable ? true : undefined"
          >
            <b
              v-if="n.label.name"
              class="name"
            >{{ n.label.name }}</b>
            <span class="state">{{ n.label.state }}</span>
            <span
              v-for="line in n.label.lines"
              :key="line"
              class="line-text"
            >{{ line }}</span>
          </span>
        </component>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.scene {
  position: absolute;
  inset: 0;
  animation: pull-out 500ms ease-out;
}

/* «Отъезд камеры»: сцена чуть крупнее и откатывается к своему размеру; ≤ 600 мс. */
@keyframes pull-out {
  from {
    transform: scale(1.15);
  }

  to {
    transform: scale(1);
  }
}

.line {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.line line {
  stroke-width: 10px;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.line .walk {
  stroke: var(--map-point-done);
}

.line .next {
  stroke: var(--map-path);
  stroke-dasharray: 2 18;
}

.line .fog {
  stroke: var(--map-path);
  stroke-dasharray: 2 26;
  opacity: 0.3;
}

.places {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.place {
  --marker: max(44px, 5.5cqw);

  position: absolute;
  width: 0;
  height: 0;
}

.node {
  position: absolute;
  top: calc(var(--marker) / -2);
  left: calc(var(--marker) / -2);
  display: block;
  width: var(--marker);
  height: var(--marker);
  padding: 0;
  border: 0;
  background: none;
  color: var(--map-label);
  font: inherit;
  text-align: center;
}

button.node {
  cursor: pointer;
}

.marker {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border: 3px solid var(--map-point);
  border-radius: 50%;
  background: var(--map-ground);
  font-size: calc(var(--marker) * 0.45);
  font-weight: 800;
  line-height: 1;
}

.done .marker {
  border-color: var(--map-point-done);
  background: var(--map-point-done);
  color: var(--bg);
}

.current .marker {
  border-color: var(--map-current);
  background: var(--map-current);
  color: var(--bg);
  animation: pulse 1.8s ease-in-out infinite;
}

.building .marker {
  border: 3px dashed var(--map-current);
  color: var(--map-current);
}

.next .marker {
  opacity: 0.7;
}

.fog .marker {
  border-style: dashed;
  border-color: var(--map-path);
  opacity: 0.4;
}

/* Кубок мира виден всегда, даже в тумане (ТЗ-1.3). */
.cup .marker {
  border-color: var(--map-cup);
  color: var(--map-cup);
  opacity: 1;
}

@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(244 194 74 / 0.55);
  }

  50% {
    box-shadow: 0 0 0 10px rgb(244 194 74 / 0);
  }
}

button.node:focus-visible {
  outline: none;
}

button.node:focus-visible .marker {
  outline: 3px solid var(--text);
  outline-offset: 4px;
}

.card {
  position: absolute;
  left: 50%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max(190px, 24cqw);
  transform: translateX(-50%);
  color: var(--map-label);
  font-size: max(1rem, 1.7cqw);
  line-height: 1.25;
}

.down .card {
  top: calc(100% + 8px);
}

/* Место у правого края (кубок мира): подпись не по центру, а к краю — иначе обрезается полем (браузер 1024, 08.11). */
.edge .card {
  left: auto;
  right: 50%;
  transform: none;
  align-items: flex-end;
  text-align: right;
}

.up .card {
  bottom: calc(100% + 8px);
  justify-content: flex-end;
}

.name {
  font-size: max(1.25rem, 2.3cqw);
  line-height: 1.1;
}

.state {
  color: var(--map-point);
  font-weight: 700;
}

.current .state {
  color: var(--map-current);
}

.done .state {
  color: var(--map-point-done);
}

.fog .state {
  color: var(--text-muted);
}

.fog.cup .state {
  color: var(--map-label);
}

.line-text {
  color: var(--map-label);
}

@media (prefers-reduced-motion: reduce) {
  .scene,
  .current .marker {
    animation: none;
  }
}
</style>

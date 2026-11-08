<script setup lang="ts">
// Дорога и места ступеней (спека 019, design §4.1, §5.1): звенья пути кодом (SVG) и подписи мест Двора.
// Только показ; точки, флажки, здания и ворота кладёт поверх `YardMap`. Позиции — в % от поля `view`.
import { computed } from 'vue';
import type { MapModel } from '../../engine/map/model';

const props = defineProps<{ model: MapModel; view: [number, number] }>();

const pct = (at: readonly [number, number]) => ({ left: `${(at[0] / props.view[0]) * 100}%`, top: `${(at[1] / props.view[1]) * 100}%` });

/** Звено пути до точки: цвет по состоянию точки, куда оно ведёт. */
const segments = computed(() =>
  props.model.points.slice(1).map((p, i) => ({
    from: props.model.points[i]!.at,
    to: p.at,
    kind: p.state === 'passed' || p.state === 'current' ? 'walk' : p.state,
  })),
);

/** Подпись места: слева от пути — вправо от метки, у правого края — влево, чтобы не лечь на точки. */
const side = (x: number): string => (x < props.view[0] / 2 ? 'right' : 'left');
</script>

<template>
  <svg
    class="road"
    :viewBox="`0 0 ${view[0]} ${view[1]}`"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <line
      v-for="(s, i) in segments"
      :key="i"
      :class="s.kind"
      :x1="s.from[0]"
      :y1="s.from[1]"
      :x2="s.to[0]"
      :y2="s.to[1]"
    />
  </svg>

  <span
    v-for="pl in model.places"
    :key="pl.stage"
    class="place"
    :class="[pl.state, side(pl.at[0])]"
    :style="pct(pl.at)"
  >
    <i aria-hidden="true" />
    <b>{{ pl.state === 'fog' ? '' : pl.name }}</b>
  </span>
</template>

<style scoped>
.road {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.road line {
  stroke-width: 12;
  stroke-linecap: round;
}

.road .walk {
  stroke: var(--map-point-done);
}

.road .ahead {
  stroke: var(--map-path);
  stroke-dasharray: 2 22;
}

.road .fog {
  stroke: var(--map-path);
  stroke-dasharray: 2 30;
  opacity: 0.3;
}

.place {
  --label: max(12px, 1.3cqw);

  position: absolute;
  display: flex;
  gap: 4px;
  align-items: center;
  transform: translate(-50%, -50%);
  color: var(--map-label);
  font-size: var(--label);
  line-height: 1;
  pointer-events: none;
}

.place i {
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  background: var(--map-path);
}

.place.left {
  flex-direction: row-reverse;
  transform: translate(-100%, -50%);
}

.place.right {
  transform: translate(0, -50%);
}

.place.next {
  opacity: 0.6;
}

.place.fog {
  opacity: 0.3;
}
</style>

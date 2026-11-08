<script setup lang="ts">
// Точка урока на карте (спека 019, design §5; 019-Р41, Р45): кнопка для пройденного и текущего урока, подпись-«картинка»
// для «впереди» и тумана. Цель нажатия — круг 44 px (`clip-path`, соседние круги не налезают друг на друга), видимая точка
// внутри неё меньше. Звёзды лежат рядом с кнопкой, а не в ней, чтобы круглая область их не обрезала. Позицию на поле
// задаёт родитель (`style` падает на корень); что в фокусе — знает экран (`active`), сюда приходит только `select`.
import { isPlayablePoint, type MapPoint } from '../../engine/map/model';
import { ru } from '../../i18n/ru';
import { fill, starsGlyphs } from './labels';

const props = defineProps<{
  point: MapPoint;
  /** Название урока (контент курса) — в подписи для диктора. */
  name: string;
  active: boolean;
  /** Где звёзды, чтобы не лечь на круг соседа по колонке: под точкой или сбоку от неё. */
  stars: 'below' | 'above' | 'right' | 'beside' | 'aside';
}>();
const emit = defineEmits<{ select: [id: string] }>();

const t = ru.map;

function label(p: MapPoint): string {
  const parts = [`${fill(t.point.lesson, { n: p.n })}: ${props.name}`];
  parts.push(t.point[p.state === 'fog' ? 'ahead' : p.state]);
  if (p.state === 'passed') parts.push(fill(t.point.starsOf, { n: p.stars }));
  if (p.badge) parts.push(t.point[p.badge]);
  return parts.join(', ');
}
</script>

<template>
  <span
    class="pt-wrap"
    :data-pt="point.id"
  >
    <button
      v-if="isPlayablePoint(point)"
      type="button"
      class="pt"
      :class="[point.state, point.badge, { back: point.back, active }]"
      :data-focus="point.id"
      :tabindex="active ? 0 : -1"
      :aria-label="label(point)"
      :aria-current="point.state === 'current' ? 'step' : undefined"
      :aria-describedby="active ? 'lesson-card-name lesson-card-play' : undefined"
      @click="emit('select', point.id)"
    >
      <span
        class="dot"
        aria-hidden="true"
      />
      <span class="n">{{ point.n }}</span>
    </button>
    <span
      v-else
      class="pt"
      :class="[point.state, point.badge]"
      :role="point.state === 'ahead' ? 'img' : undefined"
      :aria-label="point.state === 'ahead' ? label(point) : undefined"
      :aria-hidden="point.state === 'fog' ? 'true' : undefined"
      :title="point.state === 'ahead' ? name : undefined"
    >
      <span
        class="dot"
        aria-hidden="true"
      /><span class="n">{{ point.state === 'ahead' ? point.n : '' }}</span>
    </span>
    <span
      v-if="point.state === 'passed'"
      class="st"
      :class="stars"
      aria-hidden="true"
    >{{ starsGlyphs(point.stars) }}</span>
  </span>
</template>

<style scoped>
.pt-wrap {
  position: absolute;
  transform: translate(-50%, -50%);

  /* Квадрат обёртки соседа не должен перехватывать нажатие у круга: ловят только кнопка и точка «впереди». */
  pointer-events: none;
}

/* Цель нажатия — не меньше 44×44, по форме круг (ребёнок-критик, 019-Р41, Р45); видимая точка внутри неё меньше. */
.pt {
  display: grid;
  place-items: center;
  width: var(--pt);
  height: var(--pt);
  padding: 0;
  border: 0;
  background: none;
  color: var(--map-label);
  font-size: max(12px, 1.2cqw);
  font-weight: 800;
  line-height: 1;
}

button.pt {
  clip-path: circle(50%);
  cursor: pointer;
  pointer-events: auto;
}

/* Подпись «впереди» и подсказка с названием урока — только на самом круге: углы поля вокруг не ловят мышь. */
span.pt {
  pointer-events: none;
}

span.pt .dot {
  pointer-events: auto;
}

.pt .dot {
  grid-area: 1 / 1;
  box-sizing: border-box;
  width: var(--dot);
  height: var(--dot);
  border: 3px solid var(--map-point);
  border-radius: 50%;
  background: var(--map-ground);
}

.pt .n {
  grid-area: 1 / 1;
  position: relative;
}

.pt.passed {
  color: #10231b;
}

.pt.passed .dot {
  border-color: var(--map-point-done);
  background: var(--map-point-done);
}

.pt.current {
  color: #1b1b1f;
}

.pt.current .dot {
  width: calc(var(--dot) * 1.1);
  height: calc(var(--dot) * 1.1);
  border-color: var(--map-current);
  background: var(--map-current);
  box-shadow: 0 0 0 2px rgb(244 194 74 / 0.35);
}

.pt.ahead {
  color: var(--map-path);
}

.pt.ahead .dot {
  border-style: dashed;
  border-color: var(--map-path);
}

.pt.fog .dot {
  width: calc(var(--dot) * 0.5);
  height: calc(var(--dot) * 0.5);
  border-width: 2px;
  border-color: var(--map-path);
  opacity: 0.35;
}

/* Значки: товарищеский — скруглённый квадрат, контрольный — двойная рамка внутри круга (не кольцо: кольцо — это фокус). */
.pt.friendly .dot {
  border-radius: 30%;
}

.pt.control .dot {
  border: 5px double var(--map-label);
}

/* Кольцо «вернуться за звёздами»: внутри круга нажатия, иначе его обрежет. */
.pt.back::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--dot) + 10px);
  height: calc(var(--dot) + 10px);
  border: 2px dashed var(--accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

/* Звёзды под кругом: крупнее прежних 8 px (ребёнок-критик); рядом с кнопкой, не нажимаются. */
.st {
  position: absolute;
  top: calc(50% + var(--dot) / 2 + 2px);
  left: 50%;
  transform: translateX(-50%);
  color: var(--accent);
  font-size: max(12px, 1.3cqw);
  letter-spacing: -1px;
  white-space: nowrap;
  pointer-events: none;
}

/* Правый край поля: сбоку звёзды не помещаются — под точкой и правее центра (сосед по колонке — ниже слева). */
.st.right {
  transform: translateX(0);
}

/* Угол пути: ряд уходит вправо, а под точкой — круг соседа по колонке: звёзды над точкой. */
.st.above {
  top: auto;
  bottom: calc(50% + var(--dot) / 2 + 2px);
}

/* Сосед по колонке стоит ниже справа — звёзды слева от точки, на её уровне. */
.st.aside {
  top: 50%;
  right: calc(50% + var(--dot) / 2 + 3px);
  left: auto;
  transform: translateY(-50%);
}

/* Точка в колонке пути: звёзды справа от неё, на её уровне — там нет ни соседа, ни его звёзд. */
.st.beside {
  top: 50%;
  left: calc(50% + var(--dot) / 2 + 3px);
  transform: translateY(-50%);
}

/* Фокус и выбор — жёлтое кольцо с зазором на видимой точке (сама кнопка обрезана кругом; кольцо помещается в 44 px). */
button.pt:focus-visible {
  outline: none;
}

button.pt:focus-visible .dot,
button.pt.active .dot {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: no-preference) {
  .pt.current .dot {
    animation: pulse 2s ease-in-out infinite;
  }
}

@keyframes pulse {
  50% {
    box-shadow: 0 0 0 4px rgb(244 194 74 / 0.15);
  }
}
</style>

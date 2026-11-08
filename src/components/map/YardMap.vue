<script setup lang="ts">
// Карта лиги (спека 019, design §4–§5): путь кодом (SVG), точки уроков, места ступеней, флажки кубка, здания, ворота
// и туман маской. Точки, флажки, здания и ворота — HTML-кнопки поверх пути (позиция в % от поля `view`), поэтому
// их берёт клавиатура и диктор. Компонент ничего не решает: что в фокусе — знает экран (`active`), сюда приходит `select`.
// Размеры — в `cqw` поля: карта растёт с окном, подписи не мельче читаемого (`max(…px, …cqw)`).
import { computed } from 'vue';
import { buildingFocus, flagFocus } from '../../engine/map/focus';
import type { MapModel } from '../../engine/map/model';
import { ru } from '../../i18n/ru';
import { fill, isCupLater } from './labels';
import MapPoint from './MapPoint.vue';
import MapRoad from './MapRoad.vue';

const props = defineProps<{
  model: MapModel;
  view: [number, number];
  /** id урока → название урока (контент курса). */
  names: Readonly<Record<string, string>>;
  leagueName: string;
  /** id элемента в фокусе (`yard-05`, `flag:9`, `building:stadium`, `gate`). */
  active: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();

const t = ru.map;
const pct = (at: readonly [number, number]) => ({ left: `${(at[0] / props.view[0]) * 100}%`, top: `${(at[1] / props.view[1]) * 100}%` });

const tab = (id: string): number => (props.active === id ? 0 : -1);

/** Пары соседей по колонке пути ближе этого (единицы поля по x) считаются «друг под другом»: у них звёзды расходятся. */
const COLUMN_DX = 70;
/** Сдвиг по x меньше этого — сосед почти прямо под точкой, звёзды остаются по центру. */
const COLUMN_MIN_DX = 25;

/**
 * Где звёзды точки, чтобы не лечь на круг соседа по колонке: у точки в колонке — сбоку, в сторону от соседа (сосед ниже
 * слева — звёзды справа, и наоборот); в углу пути (ряд уходит вправо) — над точкой, ряд влево — под ней правее центра;
 * иначе под точкой по центру.
 */
const starSpots = computed<('below' | 'above' | 'right' | 'beside' | 'aside')[]>(() =>
  props.model.points.map((p, i) => {
    const near = [props.model.points[i - 1], props.model.points[i + 1]].filter((q) => q !== undefined);
    const lower = near.find((q) => q.at[1] > p.at[1] && Math.abs(q.at[0] - p.at[0]) < COLUMN_DX && Math.abs(q.at[0] - p.at[0]) > COLUMN_MIN_DX);
    if (lower === undefined) return 'below';
    // Угол пути: второй сосед далеко по x — там ряд, сбоку со стороны ряда звёзды нельзя.
    const row = near.find((q) => q !== lower && Math.abs(q.at[0] - p.at[0]) >= COLUMN_DX);
    if (row) return row.at[0] > p.at[0] ? 'above' : 'right';
    return lower.at[0] > p.at[0] ? 'beside' : 'aside';
  }),
);
</script>

<template>
  <div
    class="field"
    role="group"
    :aria-label="fill(t.region, { league: leagueName })"
  >
    <MapRoad
      :model="model"
      :view="view"
    />

    <MapPoint
      v-for="(p, i) in model.points"
      :key="p.id"
      :point="p"
      :name="names[p.id] ?? ''"
      :active="active === p.id"
      :stars="starSpots[i] ?? 'below'"
      :style="pct(p.at)"
      @select="(id: string) => emit('select', id)"
    />

    <button
      v-for="f in model.flags"
      :key="f.after"
      type="button"
      class="flag"
      :class="[f.side, { big: f.big, locked: f.lock !== null, later: isCupLater(f), active: active === flagFocus(f.after) }]"
      :style="pct(f.at)"
      :data-focus="flagFocus(f.after)"
      :tabindex="tab(flagFocus(f.after))"
      :aria-label="`${fill(t.flag.after, { n: f.after })}${f.big ? `, ${t.flag.big}` : ''}`"
      @click="emit('select', flagFocus(f.after))"
    >
      <span
        class="glyph"
        aria-hidden="true"
      >⚑</span>
      <span
        class="fn"
        aria-hidden="true"
      >{{ f.after }}</span>
    </button>

    <button
      v-for="b in model.buildings"
      :key="b.id"
      type="button"
      class="bld"
      :class="[b.id, { locked: b.lock !== null, active: active === buildingFocus(b.id) }]"
      :style="pct(b.at)"
      :data-focus="buildingFocus(b.id)"
      :tabindex="tab(buildingFocus(b.id))"
      @click="emit('select', buildingFocus(b.id))"
    >
      <span>{{ t.building[b.id] }}</span>
      <i
        v-if="b.mark === 'new'"
        class="new"
        role="img"
        :aria-label="t.building.fresh"
      />
    </button>

    <button
      v-if="model.gate.state !== 'fog'"
      type="button"
      class="gate"
      :class="[model.gate.state, { active: active === 'gate' }]"
      :style="pct(model.gate.at)"
      data-focus="gate"
      :tabindex="tab('gate')"
      @click="emit('select', 'gate')"
    >
      {{ t.gate.name }}
    </button>
    <span
      v-else
      class="gate fog"
      :style="pct(model.gate.at)"
      aria-hidden="true"
    >{{ t.gate.name }}</span>

    <div
      class="fog-mask"
      aria-hidden="true"
    />
    <!-- Нижняя часть поля — для карточки урока и пузыря тренера (экран кладёт их сюда). -->
    <slot />
  </div>
</template>

<style scoped>
.field {
  --dot: max(30px, 2.8cqw);
  --pt: max(44px, calc(var(--dot) + 14px));
  --label: max(12px, 1.3cqw);

  position: relative;
  width: min(100cqw, 100cqh * 16 / 9);
  aspect-ratio: 16 / 9;
  container-type: size;
  overflow: hidden;
  border-radius: 14px;
  background: var(--map-ground);
  color: var(--map-label);
}

/* Всё, что на поле, ставится центром в точку: позиции приходят в % от поля. */
.flag,
.bld,
.gate {
  position: absolute;
  transform: translate(-50%, -50%);
}

.flag,
.bld,
.gate {
  display: flex;
  gap: 2px;
  align-items: center;
  min-width: 44px;
  min-height: 44px;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--map-label);
  font-size: var(--label);
  font-weight: 700;
  cursor: pointer;
}

/* Флажок стоит над точкой: низ его кнопки — на отметке, чтобы не перекрывать кнопку точки. */
.flag {
  transform: translate(-50%, -100%);
}

.flag .glyph {
  color: var(--map-flag);
  font-size: calc(var(--label) * 1.8);
  line-height: 1;
}

.flag.big .glyph {
  font-size: calc(var(--label) * 2.6);
}

/* Правый край пути: флажок слева от точки на её уровне, чтобы не лечь на точку-соседа сверху. */
.flag.left {
  margin-left: calc(var(--pt) / -2 - 14px);
  transform: translate(-100%, -50%);
}

.flag.locked,
.flag.later {
  opacity: 0.75;
}

/* Кубка ещё нет (чемпионат — Э5): серый флажок — будущее, а не достигнутое (019-Р36, Р46). */

.flag.later .glyph {
  color: var(--map-label);
}

.bld {
  border: 2px solid var(--map-path);
  border-radius: 8px;
  background: rgb(23 52 47 / 0.85);
  padding: 0 var(--space-2);
}

.bld.locked {
  opacity: 0.7;
}

.bld .new {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
}

.gate {
  border: 2px dashed var(--map-path);
  border-radius: 8px;
  padding: 0 var(--space-2);
}

.gate.open {
  border-style: solid;
  border-color: var(--map-point-done);
}

span.gate {
  min-width: 0;
  min-height: 0;
  padding: 2px var(--space-2);
  opacity: 0.35;
  cursor: default;
}

.flag:focus-visible,
.bld:focus-visible,
.gate:focus-visible,
.flag.active,
.bld.active,
.gate.active {
  outline: 4px solid var(--text);
  outline-offset: 2px;
  border-radius: 8px;
}

/* Туман по краям поля — маской из токена; путь идёт у самого края, поэтому маска неполная. Кликов не берёт. */
.fog-mask {
  position: absolute;
  inset: 0;
  background: var(--map-fog);
  opacity: 0.4;
  pointer-events: none;
}
</style>

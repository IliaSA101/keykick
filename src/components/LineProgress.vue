<script setup lang="ts">
/*
 * Полоска хода «сколько впереди» (решение 04.11): отрезок на строку — в разминке
 * все её строки по ударам, в тайме — 6 атак. Пройденные залиты, текущая заливается по мере
 * набора. Рядом подпись «Строка N из M». Отрезки решающей серии во втором тайме — золотые (008-Р11).
 * Высота — одна строка текста: на окне 1024×640 клавиатура остаётся целиком.
 */
import { computed } from 'vue';
import type { TypingState } from '../engine/typing';
import { ru } from '../i18n/ru';

const props = withDefaults(
  defineProps<{
    /** Сколько всего строк (отрезков). */
    total: number;
    /** Сколько строк уже набрано целиком. */
    done: number;
    /** Текущая строка печати: по ней заливается текущий отрезок. */
    state: TypingState;
    /** С какого отрезка (с 0) решающая серия: эти отрезки золотые; null — золотых нет. */
    goldFrom?: number | null;
  }>(),
  { goldFrom: null },
);

/** Доля набранного в текущей строке, 0…1. */
const fill = computed(() => {
  const len = props.state.text.length;
  return len > 0 ? Math.min(1, props.state.pos / len) : 0;
});

const segments = computed(() =>
  Array.from({ length: props.total }, (_, i) => (i < props.done ? 1 : i === props.done ? fill.value : 0)),
);

const label = computed(() => {
  const p = ru.match.progress;
  return `${p.row} ${Math.min(props.done + 1, props.total)} ${p.of} ${props.total}`;
});
</script>

<template>
  <div
    class="progress"
    role="progressbar"
    :aria-label="ru.match.progress.label"
    aria-valuemin="0"
    :aria-valuemax="total"
    :aria-valuenow="done"
    :aria-valuetext="label"
  >
    <span
      class="label"
      aria-hidden="true"
    >{{ label }}</span>
    <span
      class="bar"
      aria-hidden="true"
    >
      <span
        v-for="(f, i) in segments"
        :key="i"
        class="seg"
        :class="{ now: i === done, gold: goldFrom !== null && i >= goldFrom }"
      >
        <span
          class="fill"
          :style="{ width: `${f * 100}%` }"
        />
      </span>
    </span>
  </div>
</template>

<style scoped>
.progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.label {
  flex: none;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bar {
  display: flex;
  gap: 3px;
  flex: 1;
  min-width: 90px;
}

.seg {
  position: relative;
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--text-muted) 22%, transparent);
  overflow: hidden;
}

/* Текущий отрезок обведён: видно, где ты сейчас. */
.seg.now {
  box-shadow: inset 0 0 0 1.5px var(--accent);
}

/*
 * Отрезки серии — золото штрихом: заметно издалека, но не путаются с пройденными (они залиты
 * сплошь, ярче). Текущий отрезок серии обведён белым: золотая обводка на золоте не видна.
 */
.seg.gold {
  background: repeating-linear-gradient(
    -45deg,
    color-mix(in srgb, var(--accent) 75%, transparent) 0 3px,
    color-mix(in srgb, var(--accent) 30%, transparent) 3px 6px
  );
}

.seg.gold.now {
  box-shadow: inset 0 0 0 1.5px #ffffff;
}

.seg.gold .fill {
  background: #ffd84a;
}

.fill {
  position: absolute;
  inset: 0 auto 0 0;
  background: var(--accent);
  transition: width 0.12s linear;
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
</style>

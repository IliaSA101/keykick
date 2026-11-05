<script setup lang="ts">
/*
 * Строка печати: набранное — бледно, текущая буква — в рамке, дальше — обычным цветом.
 * На ошибке рамка краснеет и вздрагивает (перезапуск анимации — сменой :key по счётчику ошибок).
 * След: знак, на котором ошиблись, остаётся красным с чертой снизу, пока строка на экране (спека 003).
 * Вокруг — блок, как в «Соло»: пройденные строки сверху (с галочкой), следующие снизу, тусклые.
 * Экранный диктор читает только текущую строку: соседние скрыты от него (aria-hidden).
 */
import { computed } from 'vue';
import type { TypingState } from '../engine/typing';

const props = withDefaults(
  defineProps<{
    state: TypingState;
    /** Уже набранные строки блока — над текущей. */
    before?: readonly string[];
    /** Следующие строки — под текущей, тусклые: ребёнок видит, что дальше. */
    after?: readonly string[];
  }>(),
  { before: () => [], after: () => [] },
);

interface Cell {
  ch: string;
  kind: 'done' | 'now' | 'todo';
  space: boolean;
  missed: boolean;
}

const missed = computed(() => new Set(props.state.missed));

const cells = computed<Cell[]>(() =>
  [...props.state.text].map((ch, i) => ({
    // Неразрывный пробел: обычный схлопнулся бы и рамке не на чем стоять.
    ch: ch === ' ' ? String.fromCharCode(0xa0) : ch,
    kind: i < props.state.pos ? 'done' : i === props.state.pos ? 'now' : 'todo',
    space: ch === ' ',
    missed: missed.value.has(i),
  })),
);

const wrong = computed(() => props.state.last === 'error');
</script>

<template>
  <div class="typing">
    <p
      v-for="(row, i) in before"
      :key="`before-${i}`"
      class="row passed"
      aria-hidden="true"
    >
      {{ row }}
    </p>
    <p
      class="line"
      :aria-label="state.text"
    >
      <span
        v-for="(c, i) in cells"
        :key="c.kind === 'now' ? `now-${i}-${state.stats.errors}` : i"
        class="cell"
        :class="[c.kind, { space: c.space, missed: c.missed, wrong: c.kind === 'now' && wrong }]"
        aria-hidden="true"
      >{{ c.ch }}</span>
    </p>
    <p
      v-for="(row, i) in after"
      :key="`after-${i}`"
      class="row next"
      aria-hidden="true"
    >
      {{ row }}
    </p>
  </div>
</template>

<style scoped>
.typing {
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace;
  letter-spacing: 0.04em;
  text-align: center;
  box-shadow: 0 6px 18px rgb(0 0 0 / 0.25);
}

.line {
  margin: 0;
  font-size: 2rem;
  line-height: 1.3;
  white-space: pre-wrap;
}

/* Соседние строки мельче текущей: блок из трёх строк умещается в поле без роста (окно 1024×640). */
.row {
  margin: 0;
  font-size: 1.15rem;
  line-height: 1.2;
}

.row.next {
  color: var(--text-muted);
  opacity: 0.6;
}

.row.passed {
  color: var(--text-muted);
  opacity: 0.45;
}

/* Галочка пройденной строки — вне потока текста, чтобы строка не съезжала с центра. */
.row.passed::after {
  content: '\2713';
  margin-right: -1.2em;
  padding-left: 0.4em;
  color: var(--accent);
}

.cell {
  display: inline-block;
  min-width: 0.6em;
  border-radius: 6px;
}

.done {
  color: var(--text-muted);
  opacity: 0.55;
}

/*
 * След ошибки — как текущая клетка, но тише: красный знак и черта снизу (тенью — видна и под пробелом).
 * Черта в em — растёт вместе со строкой на крупном экране.
 */
.done.missed {
  border-radius: 0;
  color: var(--error);
  opacity: 1;
  box-shadow: inset 0 -0.1em 0 var(--error);
}

.now.missed {
  box-shadow: inset 0 -0.1em 0 var(--error);
}

.now {
  background: var(--accent-soft);
  outline: 3px solid var(--accent);
  outline-offset: -1px;
}

.now.space {
  background: var(--accent-soft);
}

.now.wrong {
  outline-color: var(--error);
  background: color-mix(in srgb, var(--error) 22%, var(--surface));
  animation: shake 0.25s;
}

@keyframes shake {
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .now.wrong {
    animation: none;
  }
}
</style>

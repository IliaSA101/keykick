<script setup lang="ts">
/*
 * «Пас стрелками»: стрелками провести мяч по клеткам к воротам, обходя защитников.
 * Три поля подряд, защитников всё больше. Стрелки ловим со всего окна — кликать никуда не нужно.
 * Поле и ходы — в движке (engine/minigames), здесь рисунок и ввод.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { artUrl } from '../../art/assets';
import {
  ARROW_ROUNDS,
  arrowDir,
  atGoal,
  bumpInto,
  makeArrowField,
  moveBall,
  shortestPath,
  type Cell,
  type Dir,
} from '../../engine/minigames';
import { ru } from '../../i18n/ru';

const props = defineProps<{ seed: number }>();
const emit = defineEmits<{ finished: [summary: string] }>();

/** Сколько горит «Гол!» перед следующим полем. */
const GOAL_MS = 700;

const t = ru.halftime.arrows;
const ballUrl = artUrl('ball');

const round = ref(0);
const field = shallowRef(makeArrowField(props.seed, ARROW_ROUNDS[0]));
// shallowRef: moveBall возвращает ту же клетку, если мяч упёрся, — сравниваем по ссылке.
const ball = shallowRef<Cell>(field.value.start);
const moves = ref(0);
const best = ref(shortestPath(field.value));
const scored = ref(false);
/** Счётчик упоров: новый ключ у мяча — покачивание заново, даже если упёрся тот же раз подряд. */
const bumped = ref(0);
const bumpDir = ref<Dir>('right');
/** Подсказка, когда мяч упёрся в защитника; пропадает со следующим ходом. */
const hint = ref<string | null>(null);

/** Куда качнуть мяч при упоре: на несколько пикселей в сторону шага и обратно. */
const NUDGE: Readonly<Record<Dir, string>> = { up: '0, -6px', down: '0, 6px', left: '-6px, 0', right: '6px, 0' };

const cells = computed(() => {
  const f = field.value;
  const out: { x: number; y: number; kind: 'ball' | 'defender' | 'goal' | 'grass' }[] = [];
  for (let y = 0; y < f.height; y++) {
    for (let x = 0; x < f.width; x++) {
      const kind =
        ball.value.x === x && ball.value.y === y
          ? 'ball'
          : f.defenders.some((d) => d.x === x && d.y === y)
            ? 'defender'
            : f.goal.x === x && f.goal.y === y
              ? 'goal'
              : 'grass';
      out.push({ x, y, kind });
    }
  }
  return out;
});

let timer: ReturnType<typeof globalThis.setTimeout> | undefined;

function nextField(): void {
  if (round.value + 1 >= ARROW_ROUNDS.length) {
    emit('finished', `${t.result} ${t.moves} ${moves.value}. ${t.best} ${best.value}.`);
    return;
  }
  round.value += 1;
  field.value = makeArrowField(props.seed + round.value, ARROW_ROUNDS[round.value] ?? 5);
  ball.value = field.value.start;
  best.value += shortestPath(field.value);
  scored.value = false;
}

function onKey(e: KeyboardEvent): void {
  const dir = arrowDir(e.code);
  if (dir === null) return;
  // Стрелки не должны листать страницу.
  e.preventDefault();
  if (scored.value) return;
  const next = moveBall(field.value, ball.value, dir);
  if (next === ball.value) {
    // Без звука ошибки: это не промах, а «туда нельзя» — мяч качнулся, у защитника — подсказка.
    bumpDir.value = dir;
    bumped.value += 1;
    if (bumpInto(field.value, ball.value, dir) === 'defender') hint.value = t.defender;
    return;
  }
  hint.value = null;
  ball.value = next;
  moves.value += 1;
  if (atGoal(field.value, next)) {
    scored.value = true;
    timer = globalThis.setTimeout(nextField, GOAL_MS);
  }
}

onMounted(() => globalThis.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey);
  globalThis.clearTimeout(timer);
});
</script>

<template>
  <div class="arrows">
    <p
      class="status"
      aria-live="polite"
    >
      {{ t.field }} {{ round + 1 }} {{ ru.halftime.of }} {{ ARROW_ROUNDS.length }} · {{ t.moves }} {{ moves }}
      <b
        v-if="scored"
        class="goal-text"
      >{{ t.goal }}</b>
      <!-- Подсказка — в той же строке: лишняя строка дала бы прокрутку в окне 1024×640. -->
      <b
        v-else-if="hint"
        class="goal-text"
      >{{ hint }}</b>
    </p>
    <div
      class="field"
      role="img"
      :aria-label="t.label"
      :style="{ '--cols': field.width, '--rows': field.height }"
    >
      <span
        v-for="c in cells"
        :key="`${c.x}-${c.y}`"
        class="cell"
        :class="c.kind"
      >
        <img
          v-if="c.kind === 'ball'"
          :key="bumped"
          :class="{ bump: bumped > 0 }"
          :style="{ '--nudge': NUDGE[bumpDir] }"
          :src="ballUrl"
          alt=""
          width="256"
          height="256"
        >
      </span>
    </div>
  </div>
</template>

<style scoped>
.arrows {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

.status {
  margin: 0;
  font-weight: 700;
  min-height: 1.5em;
}

.goal-text {
  margin-left: var(--space-3);
  color: #ffd84a;
}

.field {
  display: grid;
  grid-template-columns: repeat(var(--cols), 44px);
  grid-template-rows: repeat(var(--rows), 44px);
  gap: 3px;
  padding: 8px;
  border-radius: 12px;
  background: #2f7d32;
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 0.5);
}

/* Мяч в защитника или в край — мяч качается в сторону шага и обратно: понятно, что туда нельзя. */
.cell img.bump {
  animation: nudge 0.24s ease-out;
}

@keyframes nudge {
  40% {
    transform: translate(var(--nudge));
  }
}

.cell {
  display: grid;
  place-items: center;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.08);
}

.cell img {
  width: 36px;
  height: 36px;
}

.cell.defender {
  background: radial-gradient(circle, #d8352b 0 14px, transparent 15px), rgb(255 255 255 / 0.08);
}

.cell.defender::after {
  content: '';
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid #ffffff;
}

.cell.goal {
  background:
    repeating-linear-gradient(45deg, rgb(255 255 255 / 0.7) 0 2px, transparent 2px 8px),
    repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.7) 0 2px, transparent 2px 8px);
  box-shadow: inset -4px 0 0 #ffffff;
}

@media (prefers-reduced-motion: reduce) {
  .cell img.bump {
    animation: none;
  }
}
</style>

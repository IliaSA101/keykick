<script setup lang="ts">
/*
 * Пенальти по ходу матча (спека 005): слой на месте строки и клавиатуры, табло матча видно.
 * Сверху плашка: до ответа — повод и «Не бить» (только кнопкой, 005-Р25), после — итог удара
 * и «Пробел — играем дальше». Ниже — тот же лист «как на олимпиаде», что в серии (PenaltyTask, плотный вид):
 * условие и разбор слева, поле ответа справа — всё помещается в окно 1024×640.
 * Пробел после ответа слушает экран матча: там же решается, что буквы в печать не идут.
 * Без таймера (005-Р6); при «меньше движения» слой появляется без анимации.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PenaltyTask from './PenaltyTask.vue';
import { MID_GOAL_COINS, MISS_COINS, type PenaltyTurn } from '../engine/midPenalty';
import type { Task } from '../engine/tasks';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const props = defineProps<{
  task: Task;
  turn: PenaltyTurn;
  /** «Новое!» у повода: первый урок после вехи (app/unlocks, featureFresh). */
  fresh?: boolean;
  /** Монеты начислены; в быстрой проверке родителя — нет, и «+N» не показываем. */
  paid?: boolean;
}>();
const emit = defineEmits<{ answered: [correct: boolean]; skip: []; resume: [] }>();

const t = ru.midPenalty;
const after = ref<HTMLElement | null>(null);

/**
 * Слой появляется посреди печати, фокус сразу в поле ответа — а ребёнок ещё допечатывает строку.
 * Первые HOLD_MS клавиши слоя не принимаются (кроме Tab): «ыд5ва» не ляжет в «Ответ».
 */
const HOLD_MS = 800;
const holding = ref(true);
let holdTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
onMounted(() => (holdTimer = globalThis.setTimeout(() => (holding.value = false), HOLD_MS)));
onBeforeUnmount(() => globalThis.clearTimeout(holdTimer));

function hold(e: KeyboardEvent): void {
  if (!holding.value || e.key === 'Tab') return;
  e.preventDefault();
  e.stopPropagation();
}

const verdict = computed(() => {
  const r = props.turn.result;
  if (r === 'scored') return t.goal;
  if (r === 'missed') return t.saved;
  return t.skipped;
});
const coins = computed(() => {
  const r = props.turn.result;
  return r === 'scored' ? MID_GOAL_COINS : r === 'missed' ? MISS_COINS : 0;
});

/*
 * После ответа фокус — на итог, а не на кнопку: лишний Enter не уводит дальше, и разбор
 * ребёнок увидит. Пробел (экран матча) или кнопка — играем дальше.
 */
watch(
  () => props.turn.result,
  (r) => {
    if (r !== null) void nextTick(() => after.value?.focus());
  },
);
</script>

<template>
  <section
    class="mid"
    aria-labelledby="mid-penalty-title"
    @keydown.capture="hold"
  >
    <header
      v-if="turn.result === null"
      class="bar"
    >
      <span
        v-if="fresh"
        class="fresh"
      >{{ ru.unlocks.fresh }}</span>
      <h2
        id="mid-penalty-title"
        class="reason"
      >
        {{ turn.reason === 'foul' ? t.foul : t.earned }}
      </h2>
      <button
        type="button"
        class="skip"
        @click="emit('skip')"
      >
        {{ t.skip }}
      </button>
    </header>
    <div
      v-else
      ref="after"
      class="bar after"
      role="status"
      tabindex="-1"
    >
      <h2
        id="mid-penalty-title"
        class="verdict"
        :class="turn.result"
      >
        {{ verdict }}
        <span
          v-if="coins > 0 && paid !== false"
          class="coins"
        >+{{ coins }} {{ plural(coins, ru.pack.coinWords) }}</span>
      </h2>
      <p class="back">
        {{ t.back }}
      </p>
      <button
        type="button"
        class="play"
        @click="emit('resume')"
      >
        {{ t.play }}
      </button>
    </div>

    <PenaltyTask
      v-if="turn.result !== 'skipped'"
      :task="task"
      :title="t.lead"
      compact
      @answered="emit('answered', $event.correct)"
    />
  </section>
</template>

<style scoped>
/*
 * Плашка — как табло: свои цвета, а не темы, — на фоне стадиона читается и в светлой,
 * и в тёмной теме. Лист задачи всегда светлый (PenaltyTask).
 */
.mid {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0 var(--space-3) var(--space-1);
}

.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--space-2);
  min-height: 52px;
  box-sizing: border-box;
  padding: 4px var(--space-2) 4px var(--space-3);
  border-radius: 12px;
  background: rgb(10 20 40 / 0.86);
  color: #ffffff;
}

.reason,
.verdict {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 900;
  color: #ffd84a;
}

.verdict.missed,
.verdict.skipped {
  color: #ffffff;
}

.coins {
  margin-left: var(--space-2);
  color: #ffd84a;
}

.fresh {
  padding: 2px 10px;
  border-radius: 999px;
  background: #ffd84a;
  color: #1a1a1a;
  font-size: 0.85rem;
  font-weight: 800;
}

.after:focus {
  outline: none;
}

.after:focus-visible {
  outline: 3px solid #f4c24a;
  outline-offset: 2px;
}

/* Итог — всегда одной плашкой: подсказка «Руки на ФЫВА» сжимается в две строки, кнопка — нет. */
.after {
  flex-wrap: nowrap;
}

.after .verdict,
.after .play {
  flex: none;
}

.back {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  text-align: right;
}

.skip,
.play {
  min-height: 44px;
  padding: 6px 14px;
  border-radius: 999px;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.skip {
  margin-left: auto;
  border: 1px solid rgb(255 255 255 / 0.6);
  background: transparent;
  color: #ffffff;
}

.play {
  border: 0;
  background: #ffd84a;
  color: #1a1a1a;
}

.skip:hover,
.play:hover {
  filter: brightness(1.1);
}

.skip:focus-visible,
.play:focus-visible {
  outline: 3px solid #f4c24a;
  outline-offset: 2px;
}

/* Появление — мягко и без тряски; при «меньше движения» — сразу. */
@media (prefers-reduced-motion: no-preference) {
  .mid {
    animation: appear 0.25s ease-out both;
  }
}

@keyframes appear {
  from {
    opacity: 0;
  }
}
</style>

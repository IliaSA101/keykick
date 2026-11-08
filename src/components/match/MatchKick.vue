<script setup lang="ts">
/*
 * Пенальти матча v2 (спека 017, design §14): слой на месте строки, табло матча видно. Сверху плашка:
 * до ответа — повод («все мячи целы — пенальти!») и «Не бить» (только кнопкой, 005-Р25); после — итог удара
 * и «Пробел — играем дальше». Ниже — лист «как на олимпиаде» (PenaltyTask, плотный вид).
 * Движку ответ уходит только по «играем дальше»: пока ребёнок читает разбор, слой на месте, а табло уже показывает гол (`shown`).
 * Без таймера; первые HOLD_MS клавиши слоя не принимаются — допечатанные буквы не лягут в «Ответ».
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import PenaltyTask from '../PenaltyTask.vue';
import type { Task } from '../../engine/tasks';
import { ru } from '../../i18n/ru';

defineProps<{ task: Task }>();
// `shown` — удар сыгран и итог на листе: табло матча растёт сразу, а не после «Пробел — играем дальше» (017-Р32).
const emit = defineEmits<{ answer: [result: 'scored' | 'missed']; skip: []; shown: [result: 'scored' | 'missed'] }>();

const t = ru.match2.kick;
const result = ref<'scored' | 'missed' | null>(null);
const after = ref<HTMLElement | null>(null);

const HOLD_MS = 800;
const holding = ref(true);
let holdTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

function hold(e: KeyboardEvent): void {
  if (!holding.value || e.key === 'Tab' || e.key === 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
}

/** Дальше играем: Пробел (кнопка с фокусом сработает сама) или кнопка. Один раз. */
let sent = false;
function resume(): void {
  if (result.value === null || sent) return;
  sent = true;
  emit('answer', result.value);
}

function onKey(e: KeyboardEvent): void {
  if (result.value === null || e.code !== 'Space' || e.repeat) return;
  if (e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  resume();
}

function onAnswered(correct: boolean): void {
  result.value = correct ? 'scored' : 'missed';
  emit('shown', result.value);
}

onMounted(() => {
  holdTimer = globalThis.setTimeout(() => (holding.value = false), HOLD_MS);
  globalThis.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  globalThis.clearTimeout(holdTimer);
  globalThis.removeEventListener('keydown', onKey);
});

// После ответа фокус — на итог, а не на кнопку: лишний Enter не уводит дальше, разбор будет прочитан.
watch(result, (r) => {
  if (r !== null) void nextTick(() => after.value?.focus());
});
</script>

<template>
  <section
    class="kick"
    aria-labelledby="kick-title"
    @keydown.capture="hold"
  >
    <header
      v-if="result === null"
      class="bar"
    >
      <h2
        id="kick-title"
        class="reason"
      >
        {{ t.reason }}
      </h2>
      <p class="enter">
        {{ t.answerHint }}
      </p>
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
        id="kick-title"
        class="verdict"
        :class="result"
      >
        {{ result === 'scored' ? t.goal : t.saved }}
      </h2>
      <p class="back">
        {{ t.back }}
      </p>
      <button
        type="button"
        class="play"
        @click="resume"
      >
        {{ t.play }}
      </button>
    </div>

    <PenaltyTask
      :task="task"
      :title="t.lead"
      compact
      @answered="onAnswered($event.correct)"
    />
  </section>
</template>

<style scoped>
/* Плашка — как табло: свои цвета, а не темы, — читается на фоне стадиона в любой теме. */
.kick {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0 var(--space-3) var(--space-1);
}

.bar {
  display: flex;
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

.enter {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 700;
  color: #ffffff;
}

.verdict.missed {
  color: #ffffff;
}

.after:focus {
  outline: none;
}

.after:focus-visible {
  outline: 3px solid #f4c24a;
  outline-offset: 2px;
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

@media (prefers-reduced-motion: no-preference) {
  .kick {
    animation: appear 0.25s ease-out both;
  }
}

@keyframes appear {
  from {
    opacity: 0;
  }
}
</style>

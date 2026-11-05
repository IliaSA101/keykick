<script setup lang="ts">
/*
 * Перерыв между таймами: счёт первого тайма и мини-игра (engine/minigames) на полминуты.
 * Перерыв не тюрьма: «Пропустить перерыв» видна всегда. Сделал задание — «Начать второй тайм»
 * получает фокус, Enter ведёт дальше. Это не перерыв режима (BreakOverlay, «отдых 15/5»):
 * тот закрывает игру, этот — часть матча.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import KeyButton from './KeyButton.vue';
import MiniArrows from './minigames/MiniArrows.vue';
import MiniCapitals from './minigames/MiniCapitals.vue';
import MiniMouse from './minigames/MiniMouse.vue';
import MiniPuzzle from './minigames/MiniPuzzle.vue';
import MiniTab from './minigames/MiniTab.vue';
import { keymap } from '../app/keymap';
import { progress, recordMinigame, type PuzzleTime } from '../app/progress';
import { puzzleKey, puzzleSeconds } from '../engine/keyboardPuzzle';
import type { MinigameId } from '../engine/minigames';
import { MINIGAME_COINS } from '../engine/rewards';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const props = defineProps<{
  game: MinigameId;
  seed: number;
  /** Буквы урока — для «Заглавной» и «Собери клавиатуру». */
  known: string;
  us: string;
  rival: string;
  goals: number;
  conceded: number;
  /** Монеты за задание; ложно в быстрой проверке (app/matchJump) — она не пишет в сохранение. */
  paid: boolean;
}>();
const emit = defineEmits<{ done: [] }>();

/**
 * Сразу после конца задания Enter не принимаем: тот же зажатый Enter (пас в «Tab по защитникам»)
 * иначе тут же начал бы второй тайм, и «Готово!» ребёнок бы не увидел.
 */
const READY_GUARD_MS = 500;

const t = ru.halftime;
const summary = ref<string | null>(null);
const box = ref<HTMLElement | null>(null);
let readyAt = 0;
let left = false;

/** Инструкция; у «Собери клавиатуру» — с рекордом заранее (001-Р3), первый раз — без него. */
const lead = computed(() => {
  if (props.game !== 'puzzle') return t[props.game].lead;
  const best = progress.puzzleBest[puzzleKey(keymap, props.known)];
  return best === undefined ? t.puzzle.lead : `${t.puzzle.lead} ${t.puzzle.best.replace('{s}', String(puzzleSeconds(best)))}`;
});

/** Задание сделано: монеты и (у «Собери клавиатуру») рекорд — одной записью и только при paid. */
function onFinished(text: string, time?: PuzzleTime): void {
  if (summary.value !== null) return;
  summary.value = text;
  if (props.paid) recordMinigame(time);
  readyAt = globalThis.performance.now() + READY_GUARD_MS;
  void nextTick(() => box.value?.querySelector<HTMLElement>('.next .primary')?.focus());
}

/** Уйти один раз: двойной щелчок и Enter вместе с кнопкой второй тайм дважды не начнут. */
function leave(): void {
  if (left) return;
  left = true;
  emit('done');
}

function onNext(): void {
  if (globalThis.performance.now() < readyAt) return;
  leave();
}

/** Esc в «Tab по защитникам» — выйти из шеренги на кнопку перерыва (внутри фокус ходит по кругу). */
function onLeaveGame(): void {
  box.value?.querySelector<HTMLElement>('.actions button')?.focus();
}

function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || summary.value === null || e.repeat) return;
  // На кнопке Enter сработает и сам — не уходим дважды.
  if (e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  onNext();
}

onMounted(() => globalThis.addEventListener('keydown', onKey));
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <section
    ref="box"
    class="halftime panel"
    aria-labelledby="halftime-title"
  >
    <header class="head">
      <h1 id="halftime-title">
        {{ t.title }}: {{ t[game].title }}
      </h1>
      <p class="score">
        {{ t.halfOver }} · {{ us }} <b>{{ goals }} : {{ conceded }}</b> {{ rival }}
      </p>
      <!-- Сделал задание — на месте инструкции итог: высота не меняется, окно 1024×640 без прокрутки. -->
      <p
        class="lead"
        :class="{ summary: summary !== null }"
        aria-live="polite"
      >
        <template v-if="summary !== null">
          <b>{{ t.done }}</b> {{ summary }}
          <b
            v-if="paid"
            class="coins"
          >+{{ MINIGAME_COINS }}&nbsp;{{ plural(MINIGAME_COINS, t.coinWords) }}</b>
        </template>
        <template v-else>
          {{ lead }}
          <!-- Награду видно заранее: иначе задание проще пропустить (вопрос владельца 04.11).
               Число и слово — неразрывным пробелом: «+10 / монет» на 1024 не рвётся. -->
          <b
            v-if="paid"
            class="coins"
          >{{ t.prize }} +{{ MINIGAME_COINS }}&nbsp;{{ plural(MINIGAME_COINS, t.coinWords) }}</b>
        </template>
      </p>
    </header>

    <div class="game">
      <MiniArrows
        v-if="game === 'arrows'"
        :seed="seed"
        @finished="onFinished"
      />
      <MiniMouse
        v-else-if="game === 'mouse'"
        :seed="seed"
        @finished="onFinished"
      />
      <MiniTab
        v-else-if="game === 'tab'"
        :seed="seed"
        @finished="onFinished"
        @leave="onLeaveGame"
      />
      <MiniPuzzle
        v-else-if="game === 'puzzle'"
        :seed="seed"
        :known="known"
        @finished="onFinished"
      />
      <MiniCapitals
        v-else
        :seed="seed"
        :known="known"
        @finished="onFinished"
      />
    </div>

    <div
      class="actions"
      :class="{ next: summary !== null }"
    >
      <KeyButton
        v-if="summary !== null"
        primary
        @click="onNext"
      >
        {{ t.next }}
      </KeyButton>
      <span
        v-if="summary !== null"
        class="key-hint"
      >{{ t.nextKey }}</span>
      <KeyButton
        v-else
        @click="leave"
      >
        {{ t.skip }}
      </KeyButton>
    </div>
  </section>
</template>

<style scoped>
.halftime {
  max-width: 820px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  text-align: center;
}

.head h1 {
  margin: 0;
  font-size: 1.5rem;
}

.score,
.lead {
  margin: var(--space-1) 0 0;
}

.score b {
  font-size: 1.2rem;
  color: #ffd84a;
  font-variant-numeric: tabular-nums;
}

.lead {
  max-width: 760px;
  margin-inline: auto;
}

.lead.summary {
  font-weight: 700;
}

.summary b,
.coins {
  color: #ffd84a;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--space-3);
}

.key-hint {
  font-size: 0.9rem;
  opacity: 0.8;
}
</style>

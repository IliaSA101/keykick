<script setup lang="ts">
/*
 * Минута тренера (спека 017, design §5): без счёта и голов, строки на самых ошибочных клавишах урока.
 * Сверху — клавиши и сколько осталось (полоска и секунды); пока ребёнок не начал печатать, время не идёт.
 * Строки — `AttackText`; облик тренера придёт со спекой 020, пока — подпись.
 */
import { computed } from 'vue';
import AttackText from './AttackText.vue';
import type { TypingState } from '../../engine/typing';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  /** Клавиши фокуса: «ыв». */
  keys: string;
  /** Сколько осталось, мс; null — ещё не начали печатать. */
  leftMs: number | null;
  /** Вся минута, мс (`rules.coach.ms`). */
  totalMs: number;
  typing: TypingState;
  rows: readonly string[];
  row: number;
}>();

const t = ru.match2.coach;
const share = computed(() => (props.leftMs === null ? 1 : Math.max(0, Math.min(1, props.leftMs / props.totalMs))));
const seconds = computed(() => Math.ceil((props.leftMs ?? props.totalMs) / 1000));
</script>

<template>
  <div class="coach">
    <header class="bar">
      <h2 class="title">
        {{ t.title }}
      </h2>
      <p class="keys">
        {{ t.lead }}
        <b
          v-for="ch in [...keys]"
          :key="ch"
          class="letter"
        >{{ ch.toUpperCase() }}</b>
      </p>
      <p
        v-if="leftMs === null"
        class="wait"
      >
        {{ t.waiting }}
      </p>
      <p
        v-else
        class="left"
        role="timer"
        :aria-label="t.label"
      >
        {{ t.left }} {{ seconds }} {{ t.seconds }}
      </p>
      <span
        class="track"
        aria-hidden="true"
      ><span
        class="fill"
        :style="{ width: `${share * 100}%` }"
      /></span>
    </header>
    <AttackText
      :typing="typing"
      :rows="rows"
      :row="row"
    />
  </div>
</template>

<style scoped>
.coach {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: 0 var(--space-3) var(--space-1);
}

/* «Минута тренера» уже на табло: заголовок остался для экранного диктора (017-Р31, дубль убран). */
.title {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Плашка — как у пенальти: свои цвета, читается на фоне стадиона в любой теме. */
.bar {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--space-3);
  padding: 4px var(--space-3) 6px;
  border-radius: 12px;
  background: rgb(10 20 40 / 0.86);
  color: #ffffff;
  overflow: hidden;
}

.keys,
.wait,
.left {
  margin: 0;
  font-weight: 700;
}

.left {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.wait {
  margin-left: auto;
  font-size: 0.9rem;
}

.letter {
  display: inline-block;
  min-width: 1.6em;
  margin: 0 2px;
  padding: 0 4px;
  border-radius: 6px;
  background: rgb(255 255 255 / 0.18);
  text-align: center;
}

/* Полоска оставшегося времени — отдельной строкой во всю ширину плашки (017-Р31): видно, сколько ещё осталось. */
.track {
  flex: 1 0 100%;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  background: rgb(255 255 255 / 0.18);
}

.fill {
  display: block;
  height: 100%;
  background: #ffd84a;
  transition: width 0.3s linear;
}

@media (prefers-reduced-motion: reduce) {
  .fill {
    transition: none;
  }
}
</style>

<script setup lang="ts">
/*
 * Справка-показ «Как держать руки» (решение 04.11): окно поверх экрана, 5 шагов — посадка
 * и мягкий удар; пупочки на А и О; домашняя позиция ФЫВА ОЛДЖ и большие на пробеле;
 * цвет клавиши = палец (с легендой); ударил — палец домой. Картинка — наша же клавиатура
 * с руками, на каждом шаге горит своё.
 * Управление: «Дальше»/«Назад», стрелки, Enter — дальше, Esc — закрыть. Фокус живёт внутри
 * окна (Tab ходит по кругу), после закрытия возвращается туда, где был.
 */
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import HandsView from './HandsView.vue';
import KeyboardView from './KeyboardView.vue';
import type { Finger } from '../engine/keymap';
import { ru } from '../i18n/ru';

const emit = defineEmits<{ close: [] }>();

/** Что горит на картинке шага: клавиши (коды) и пальцы. */
interface Show {
  keys: readonly string[];
  fingers: readonly Finger[];
}

const HOME_LEFT = ['KeyA', 'KeyS', 'KeyD', 'KeyF'];
const HOME_RIGHT = ['KeyJ', 'KeyK', 'KeyL', 'Semicolon'];
const ALL_FINGERS: readonly Finger[] = ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp', 'th'];
/** Колонка левого указательного: К Е А П М И. */
const LEFT_INDEX = ['KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB'];

/** Картинки шагов — по порядку текстов в ru.handsHelp.steps. */
const SHOWS: readonly Show[] = [
  { keys: [], fingers: [] },
  { keys: ['KeyF', 'KeyJ'], fingers: ['li', 'ri'] },
  { keys: [...HOME_LEFT, ...HOME_RIGHT, 'Space'], fingers: ALL_FINGERS },
  { keys: LEFT_INDEX, fingers: ['li'] },
  { keys: ['KeyG'], fingers: ['li'] },
];

/** Легенда цветов пальцев (шаг «цвет клавиши — это палец»). */
const ZONES = ['pinky', 'ring', 'middle', 'index', 'thumb'] as const;
const LEGEND_STEP = 3;

const steps = ru.handsHelp.steps;
const step = ref(0);
const last = computed(() => step.value === steps.length - 1);
const text = computed(() => steps[step.value] ?? steps[0]);
const show = computed(() => SHOWS[step.value] ?? { keys: [], fingers: [] });

const titleId = useId();
const textId = useId();
const root = ref<HTMLElement | null>(null);
const nextButton = ref<HTMLButtonElement | null>(null);
/** Куда вернуть фокус после закрытия: кнопка, которой открыли, или что было в фокусе. */
let returnTo: HTMLElement | null = null;

function next(): void {
  if (last.value) emit('close');
  else step.value += 1;
}

function back(): void {
  if (step.value > 0) step.value -= 1;
}

function focusables(): HTMLElement[] {
  return [...(root.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
    return;
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    if (!last.value) next();
    return;
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    back();
    return;
  }
  // Enter и пробел на кнопке нажимают её саму — второй раз не листаем.
  if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    next();
    return;
  }
  if (e.key === 'Tab') {
    const list = focusables();
    const first = list[0];
    const end = list.at(-1);
    if (!first || !end) return;
    const active = globalThis.document.activeElement;
    if (e.shiftKey && (active === first || !root.value?.contains(active))) {
      e.preventDefault();
      end.focus();
    } else if (!e.shiftKey && (active === end || !root.value?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }
}

// Окно модальное: клавиши ловим на всём окне, пока оно открыто (экран матча их в это время не берёт).
onMounted(() => {
  const active = globalThis.document.activeElement;
  returnTo = active instanceof HTMLElement && active !== globalThis.document.body ? active : null;
  nextButton.value?.focus();
  globalThis.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey);
  returnTo?.focus();
});
</script>

<template>
  <div
    class="backdrop"
    @click.self="emit('close')"
  >
    <section
      ref="root"
      class="help panel"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
      :aria-describedby="textId"
    >
      <header class="head">
        <h2 :id="titleId">
          {{ ru.handsHelp.title }}
        </h2>
        <span class="count">{{ ru.handsHelp.step }} {{ step + 1 }} {{ ru.handsHelp.of }} {{ steps.length }}</span>
        <button
          type="button"
          class="close"
          :aria-label="ru.handsHelp.close"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <div
        :id="textId"
        class="text"
        aria-live="polite"
      >
        <h3>{{ text?.title }}</h3>
        <p>{{ text?.text }}</p>
      </div>

      <ul
        v-if="step === LEGEND_STEP"
        class="legend"
        :aria-label="ru.handsHelp.legend"
      >
        <li
          v-for="z in ZONES"
          :key="z"
        >
          <span
            class="swatch"
            :style="{ background: `var(--zone-${z})` }"
          />
          {{ ru.handsHelp.zones[z] }}
        </li>
      </ul>

      <div
        class="picture"
        aria-hidden="true"
      >
        <KeyboardView
          :target="null"
          :shift="false"
          :error="false"
          layout="ru"
          :marks="show.keys"
        />
        <div class="hands">
          <HandsView
            :finger="null"
            :shift-finger="null"
            :fingers="show.fingers"
          />
        </div>
      </div>

      <footer class="foot">
        <span class="keys">{{ ru.handsHelp.keys }}</span>
        <button
          type="button"
          class="btn"
          :disabled="step === 0"
          @click="back"
        >
          {{ ru.handsHelp.back }}
        </button>
        <button
          ref="nextButton"
          type="button"
          class="btn primary"
          @click="next"
        >
          {{ last ? ru.handsHelp.done : ru.handsHelp.next }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: var(--space-3);
  background: rgb(5 8 25 / 0.7);
}

.help {
  width: min(720px, 100%);
  max-height: calc(100vh / var(--ui-scale) - 2 * var(--space-3));
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.head {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.head h2 {
  margin: 0;
  font-size: 1.3rem;
  color: var(--accent);
}

.count {
  color: var(--text-muted);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.close {
  margin-left: auto;
  border: 0;
  border-radius: 8px;
  padding: 2px 10px;
  background: transparent;
  color: var(--text-muted);
  font-size: 1.1rem;
  cursor: pointer;
}

.close:hover {
  color: var(--text);
}

.text h3 {
  margin: 0;
  font-size: 1.1rem;
}

.text p {
  margin: 2px 0 0;
  min-height: 3em;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 16px;
  height: 16px;
  border-radius: 4px;
}

/* Руки поверх клавиатуры, как на экране матча: кончики пальцев — на основном ряду. */
.picture {
  position: relative;
  width: min(560px, 100%);
  margin: 0 auto;
  /* Ниже клавиатуры видны ладони: в справке место есть, руки должны читаться. */
  padding-bottom: 48px;
  overflow: hidden;
}

/* Та же ширина и верх, что у клавиатуры (HandsView). Картинка полупрозрачная: под ладонями
   читается нижний ряд (тестировщик: при 0.8 ладони его закрывали); метки пальцев — яркие. */
.hands {
  position: absolute;
  inset: 0 0 auto;
  --hands-opacity: 0.5;
  pointer-events: none;
}

.foot {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.keys {
  margin-right: auto;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.btn {
  min-width: 7em;
  padding: 6px 16px;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-weight: 700;
  cursor: pointer;
}

.btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: #1b1640;
}
</style>

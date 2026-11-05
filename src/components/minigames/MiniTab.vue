<script setup lang="ts">
/*
 * «Tab по защитникам»: игроки — настоящие кнопки. Tab и Shift+Tab водят фокус по кругу внутри
 * шеренги (engine tabWrap), Enter — пас. Из шеренги выводит Esc (событие leave — перерыв ставит
 * фокус на свою кнопку) или конец задания. Засчитываем только пас с клавиатуры: щелчок мышью —
 * подсказка, и Enter после щелчка — тоже подсказка, пока фокус не придёт Tab-ом (игра учит
 * обходиться без мыши). Задание — в движке (engine/minigames), здесь кнопки и проверка нажатия.
 */
import { computed, nextTick, onMounted, ref } from 'vue';
import { TAB_ROUNDS, makeTabGame, tabWrap } from '../../engine/minigames';
import { ru } from '../../i18n/ru';

const props = defineProps<{ seed: number }>();
const emit = defineEmits<{ finished: [summary: string]; leave: [] }>();

const t = ru.halftime.tab;
const game = makeTabGame(props.seed);
const round = ref(0);
const message = ref<string | null>(null);
const passed = ref<number | null>(null);
const over = ref(false);
const row = ref<HTMLElement | null>(null);
/**
 * Фокус на игрока поставила мышь. Порядок событий щелчка: pointerdown → focusin → click, так что
 * focusin между pointerdown и click — от мыши; любой другой focusin (Tab, Shift+Tab, наш focus()) —
 * с клавиатуры. Щелчок по игроку, на котором фокус уже стоит, focusin не даёт — флаг ставит pointerdown.
 */
const mouseFocus = ref(false);
let pointerPending = false;

const players = (): HTMLElement[] => [...(row.value?.querySelectorAll<HTMLElement>('.player') ?? [])];

function onPointerDown(): void {
  pointerPending = true;
  mouseFocus.value = true;
}

function onFocusIn(): void {
  mouseFocus.value = pointerPending;
}

function onRowKey(e: KeyboardEvent): void {
  // Нажали клавишу — щелчок кончился (даже если мышь отпустили мимо игрока и click не пришёл).
  pointerPending = false;
  if (e.key === 'Escape') {
    emit('leave');
    return;
  }
  if (e.key !== 'Tab' || over.value) return;
  const list = players();
  const to = tabWrap(list.indexOf(e.target as HTMLElement), list.length, e.shiftKey);
  // Не крайний игрок — фокус двигает сам браузер (focusin отметит, что с клавиатуры).
  if (to === null) return;
  e.preventDefault();
  list[to]?.focus();
}

const targetNumber = computed(() => game.numbers[game.targets[round.value] ?? 0] ?? 0);

/** Нажатие Enter или пробела на кнопке приходит щелчком с detail 0, мыши — с detail ≥ 1. */
function onPass(e: MouseEvent, index: number): void {
  pointerPending = false;
  if (over.value) return;
  // Щелчок мышью — или Enter на игроке, к которому фокус привела мышь: тоже не засчитываем.
  if (e.detail > 0 || mouseFocus.value) {
    message.value = t.mouse;
    return;
  }
  if (index !== game.targets[round.value]) {
    message.value = t.wrong.replace('{n}', String(game.numbers[index] ?? ''));
    return;
  }
  message.value = null;
  passed.value = index;
  if (round.value + 1 >= TAB_ROUNDS) {
    over.value = true;
    emit('finished', t.result);
    return;
  }
  round.value += 1;
}

onMounted(() => void nextTick(() => row.value?.querySelector<HTMLElement>('button')?.focus()));
</script>

<template>
  <div class="tab">
    <p
      class="task"
      aria-live="polite"
    >
      <template v-if="!over">
        {{ t.pass }} <b class="number">№ {{ targetNumber }}</b>{{ ' ' }}
        <span class="count">({{ round + 1 }} {{ ru.halftime.of }} {{ TAB_ROUNDS }})</span>
      </template>
    </p>
    <div
      ref="row"
      class="row"
      @keydown="onRowKey"
      @focusin="onFocusIn"
    >
      <button
        v-for="(n, i) in game.numbers"
        :key="n"
        type="button"
        class="player"
        :class="{ got: passed === i }"
        :aria-label="`${t.player} № ${n}`"
        @pointerdown="onPointerDown"
        @click="onPass($event, i)"
      >
        <span
          class="shirt"
          aria-hidden="true"
        >{{ n }}</span>
      </button>
    </div>
    <p
      class="message"
      role="status"
    >
      {{ message ?? '' }}
    </p>
  </div>
</template>

<style scoped>
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}

.task {
  margin: 0;
  min-height: 1.6em;
  font-size: 1.3rem;
  font-weight: 800;
}

.number {
  color: #ffd84a;
}

.count {
  font-size: 0.95rem;
  font-weight: 600;
  opacity: 0.8;
}

.row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: 14px;
  background: #2f7d32;
}

.player {
  width: 76px;
  height: 84px;
  padding: 0;
  border: 0;
  border-radius: 12px;
  background: rgb(255 255 255 / 0.12);
  /* Не рука: мышь здесь не засчитывается, кнопка не зовёт по ней щёлкать. */
  cursor: default;
  display: grid;
  place-items: center;
}

/* Футболка кодом: номер крупно, чтобы его было видно издалека. */
.shirt {
  display: grid;
  place-items: center;
  width: 56px;
  height: 60px;
  border-radius: 14px 14px 8px 8px;
  background: linear-gradient(#3d6fd8, #244aa0);
  color: #ffffff;
  font-size: 1.5rem;
  font-weight: 900;
  box-shadow: inset 0 -4px 0 rgb(0 0 0 / 0.2);
}

.player.got .shirt {
  background: linear-gradient(#ffd84a, #e0a800);
  color: #1b2a4a;
}

/* Фокус — главное в этой игре: рамка видна всегда, даже после щелчка мышью. */
.player:focus {
  outline: 5px solid #ffd84a;
  outline-offset: 3px;
  transform: translateY(-4px);
}

.message {
  margin: 0;
  min-height: 1.5em;
  font-weight: 700;
  color: #ffd84a;
}
</style>

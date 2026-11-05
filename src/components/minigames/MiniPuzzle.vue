<script setup lang="ts">
/*
 * «Собери клавиатуру» (спека 001): в одном ряду знакомые клавиши пустые, их буквы — фишки в лотке.
 * Фишку тащат на клавишу или ставят щелчками: фишка, потом клавиша (Tab и Enter — так же).
 * Чужая клавиша — фишка плавно возвращается, подсказка, без штрафа. Время — только в итоге.
 * Клавиатура — та же KeyboardView; поверх неё — пустые клавиши-кнопки по той же геометрии
 * (engine/keyboardLayout). Задание и проверка хода — в движке (engine/keyboardPuzzle).
 *
 * Весь экран масштабируется CSS zoom: поэтому точки считаем долями прямоугольников
 * (getBoundingClientRect даёт их в тех же координатах, что и указатель), а ставим — в процентах
 * и в единицах клавиатуры (--u — ширина шага клавиши от ширины поля).
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import KeyboardView from '../KeyboardView.vue';
import { keymap } from '../../app/keymap';
import { progress, type PuzzleTime } from '../../app/progress';
import { sound } from '../../app/sound';
import { KEY_GAP, VIEW_PAD, layoutKeys, type KeyBox } from '../../engine/keyboardLayout';
import {
  isSolved,
  keyUnder,
  makePuzzle,
  placeTile,
  puzzleOutcome,
  trayOf,
  type PuzzleTile,
} from '../../engine/keyboardPuzzle';
import { ru } from '../../i18n/ru';

const props = defineProps<{
  seed: number;
  /** Буквы урока: они и становятся фишками. */
  known: string;
}>();
const emit = defineEmits<{ finished: [summary: string, time: PuzzleTime] }>();

const t = ru.halftime.puzzle;
const geo = layoutKeys(keymap);
/** Рисунок клавиатуры в единицах: ширина и высота с полем, как viewBox у KeyboardView. */
const viewW = geo.width + 2 * VIEW_PAD;
const viewH = geo.height + 2 * VIEW_PAD;
/** Сдвиг указателя, после которого нажатие — уже перетаскивание, а не щелчок (px окна). */
const DRAG_PX = 6;
/** Полёт фишки назад в лоток, мс (без движения — сразу). */
const RETURN_MS = 250;
/** Кнопка пустой клавиши шире самой клавиши: по вертикали — на этот запас (единицы клавиатуры). */
const SLOT_PAD_Y = 0.22;
/** Второй щелчок по только что выбранной фишке раньше этого (мс) — часть двойного: выбор не снимаем. */
const DOUBLE_MS = 500;

const puzzle = shallowRef(makePuzzle(keymap, props.known, props.seed));
/** Рекорд до этой игры: читаем один раз, запись — у перерыва вместе с монетами. */
const bestBefore = progress.puzzleBest[puzzle.value.key];

const root = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
const selected = ref<string | null>(null);
const message = ref<string | null>(null);
const over = ref(false);
/** Последняя поставленная клавиша — короткая вспышка. */
const fresh = ref<string | null>(null);

/** Фишка в руке: где она (в процентах поля игры) и летит ли назад в лоток. */
interface Ghost {
  code: string;
  x: number;
  y: number;
  back: boolean;
}
const ghost = shallowRef<Ghost | null>(null);
let press: { code: string; id: number; x: number; y: number; moved: boolean } | null = null;
let backTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
let startedAt: number | null = null;
/** Когда последний раз щёлкнули фишку мышью (timeStamp события). */
let pickedAt = -Infinity;

const tray = computed(() => trayOf(puzzle.value));
const tileOf = (code: string): PuzzleTile | undefined => puzzle.value.tiles.find((x) => x.code === code);
const upper = (ch: string) => ch.toLocaleUpperCase();
/** Пустые клавиши — по порядку ряда (слева направо): так ходит Tab. */
const slots = computed(() =>
  geo.keys
    .filter((b) => puzzle.value.tiles.some((x) => x.code === b.key.code))
    .sort((a, b) => a.x - b.x)
    .map((b) => ({ box: b, tile: tileOf(b.key.code) as PuzzleTile, placed: puzzle.value.placed.includes(b.key.code) })),
);
const rowTop = puzzle.value.rowIndex + VIEW_PAD - KEY_GAP / 2;
const holding = computed(() => selected.value !== null || (ghost.value !== null && !ghost.value.back));

const u = (n: number) => `calc(${n} * var(--u))`;
function slotStyle(b: KeyBox): Record<string, string> {
  return {
    left: u(b.x + VIEW_PAD - KEY_GAP / 2),
    top: u(b.y + VIEW_PAD - SLOT_PAD_Y),
    width: u(b.w + KEY_GAP),
    height: u(b.h + 2 * SLOT_PAD_Y),
    '--zone': `var(--finger-${b.key.finger})`,
  };
}

const reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

function startClock(): void {
  startedAt ??= globalThis.performance.now();
}

/** Точка указателя в процентах поля игры (для фишки в руке). */
function pctOf(clientX: number, clientY: number): { x: number; y: number } | null {
  const r = root.value?.getBoundingClientRect();
  if (!r || r.width === 0 || r.height === 0) return null;
  return { x: ((clientX - r.left) / r.width) * 100, y: ((clientY - r.top) / r.height) * 100 };
}

/** Клавиша под указателем: доли прямоугольника клавиатуры → единицы клавиатуры. */
function boxAt(clientX: number, clientY: number): KeyBox | null {
  const r = board.value?.getBoundingClientRect();
  if (!r || r.width === 0 || r.height === 0) return null;
  const x = ((clientX - r.left) / r.width) * viewW - VIEW_PAD;
  const y = ((clientY - r.top) / r.height) * viewH - VIEW_PAD;
  return keyUnder(geo.keys, x, y);
}

const tileEl = (code: string) => root.value?.querySelector<HTMLElement>(`[data-tile="${code}"]`) ?? null;

function focusLater(get: () => HTMLElement | null | undefined): void {
  void nextTick(() => get()?.focus());
}

/** Фишка не встала — летит обратно на своё место в лотке (без движения — сразу там). */
function flyBack(): void {
  const g = ghost.value;
  globalThis.clearTimeout(backTimer);
  const home = g && tileEl(g.code)?.getBoundingClientRect();
  const at = home ? pctOf(home.left + home.width / 2, home.top + home.height / 2) : null;
  if (!g || !at || reducedMotion()) {
    ghost.value = null;
    return;
  }
  ghost.value = { ...g, ...at, back: true };
  backTimer = globalThis.setTimeout(() => (ghost.value = null), RETURN_MS);
}

function finish(): void {
  over.value = true;
  const ms = globalThis.performance.now() - (startedAt ?? globalThis.performance.now());
  const o = puzzleOutcome(ms, bestBefore);
  // Десятые — через запятую, как пишут по-русски.
  const sec = (n: number) => (o.tenths ? n.toFixed(1).replace('.', ',') : String(n));
  const time = t.time.replace('{s}', sec(o.seconds));
  const tail = { none: '', first: t.firstBest, new: t.newBest, near: t.nearBest, old: t.oldBest }[o.verdict].replace(
    '{s}',
    sec(o.best ?? 0),
  );
  emit('finished', tail ? `${time} ${tail}` : time, { key: puzzle.value.key, ms });
}

/** Ход: фишка tile на клавишу code. keyboard — ход с клавиатуры: фокус ведём дальше сами. */
function place(tile: string, code: string, keyboard: boolean): void {
  if (over.value) return;
  const r = placeTile(puzzle.value, tile, code);
  if (r.result === 'again') return;
  selected.value = null;
  if (r.result === 'wrong') {
    message.value = t.wrong;
    flyBack();
    if (keyboard) focusLater(() => tileEl(tile));
    return;
  }
  globalThis.clearTimeout(backTimer);
  ghost.value = null;
  puzzle.value = r.puzzle;
  message.value = null;
  fresh.value = code;
  sound.key();
  if (isSolved(r.puzzle)) finish();
  else if (keyboard) focusLater(() => root.value?.querySelector<HTMLElement>('.tile'));
}

/** Щелчок по фишке (или Enter): выбрать её, второй раз — снять выбор. */
function toggle(code: string, keyboard: boolean): void {
  if (over.value) return;
  startClock();
  if (selected.value === code) {
    selected.value = null;
    message.value = null;
    return;
  }
  selected.value = code;
  message.value = t.picked.replace('{c}', upper(tileOf(code)?.char ?? ''));
  if (keyboard) focusLater(() => root.value?.querySelector<HTMLElement>('.slot:not(:disabled)'));
}

function onTileDown(e: PointerEvent, code: string): void {
  if (over.value || e.button !== 0) return;
  // Без этого мышь выделяет текст и уводит фокус; щелчок без сдвига разберём в onTileUp.
  e.preventDefault();
  startClock();
  globalThis.clearTimeout(backTimer);
  ghost.value = null;
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    // Указатель уже отпущен или фишку убрали из лотка — тащить нечего.
    return;
  }
  press ={ code, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
}

function onTileMove(e: PointerEvent): void {
  if (!press || e.pointerId !== press.id) return;
  if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < DRAG_PX) return;
  if (!press.moved) {
    press.moved = true;
    selected.value = null;
    message.value = null;
  }
  const at = pctOf(e.clientX, e.clientY);
  if (at) ghost.value = { code: press.code, ...at, back: false };
}

function onTileUp(e: PointerEvent): void {
  if (!press || e.pointerId !== press.id) return;
  const p = press;
  press = null;
  if (!p.moved) {
    if (selected.value === p.code && e.timeStamp - pickedAt < DOUBLE_MS) return;
    toggle(p.code, false);
    pickedAt = e.timeStamp;
    return;
  }
  const box = boxAt(e.clientX, e.clientY);
  if (box) {
    place(p.code, box.key.code, false);
    return;
  }
  message.value = t.miss;
  flyBack();
}

function onTileCancel(e: PointerEvent): void {
  if (!press || e.pointerId !== press.id) return;
  press = null;
  flyBack();
}

/** Щелчок мышью разобран в onTileUp; здесь — только Enter и пробел (detail 0). */
function onTileClick(e: MouseEvent, code: string): void {
  if (e.detail === 0) toggle(code, true);
}

function onSlot(e: MouseEvent, code: string): void {
  if (over.value) return;
  if (selected.value === null) {
    message.value = t.pickFirst;
    return;
  }
  place(selected.value, code, e.detail === 0);
}

/** Esc — на окне: после щелчка мышью фокус не в игре (onTileDown гасит его переход). */
function onKey(e: KeyboardEvent): void {
  if (e.key !== 'Escape' || selected.value === null) return;
  e.preventDefault();
  const code = selected.value;
  selected.value = null;
  message.value = null;
  focusLater(() => tileEl(code));
}

onMounted(() => globalThis.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey);
  globalThis.clearTimeout(backTimer);
});

const count = computed(() => `${t.placed} ${puzzle.value.placed.length} ${ru.halftime.of} ${puzzle.value.tiles.length}`);
const ghostChar = computed(() => (ghost.value ? upper(tileOf(ghost.value.code)?.char ?? '') : ''));
const keySize = u(1 - KEY_GAP);
</script>

<template>
  <div
    ref="root"
    class="puzzle"
    :style="{ '--u': `calc(100cqw / ${viewW})` }"
  >
    <!-- Лоток в разметке раньше клавиатуры: Tab сначала по фишкам (выбрать), потом по клавишам.
         На экране клавиатура выше — .board { order: -1 }. -->
    <div class="bar">
      <div
        class="tray"
        role="group"
        :aria-label="t.tray"
      >
        <button
          v-for="tile in tray"
          :key="tile.code"
          type="button"
          class="tile"
          :class="{ chosen: selected === tile.code, lifted: ghost?.code === tile.code }"
          :data-tile="tile.code"
          :aria-label="t.tile.replace('{c}', upper(tile.char))"
          :aria-pressed="selected === tile.code"
          :disabled="over"
          @pointerdown="onTileDown($event, tile.code)"
          @pointermove="onTileMove"
          @pointerup="onTileUp"
          @pointercancel="onTileCancel"
          @click="onTileClick($event, tile.code)"
        >
          {{ upper(tile.char) }}
        </button>
      </div>
    </div>

    <div
      ref="board"
      class="board"
    >
      <KeyboardView
        :target="null"
        :shift="false"
        :error="false"
        layout="ru"
      />
      <div
        class="layer"
        role="group"
        :aria-label="t.label"
      >
        <!-- Другие ряды — тусклые: смотрим на свой. -->
        <div
          class="veil"
          :style="{ top: 0, height: u(rowTop) }"
        />
        <div
          class="veil"
          :style="{ top: u(rowTop + 1), bottom: 0 }"
        />
        <button
          v-for="s in slots"
          :key="s.box.key.code"
          type="button"
          class="slot"
          :class="{ placed: s.placed, fresh: fresh === s.box.key.code, awaiting: holding && !s.placed }"
          :style="slotStyle(s.box)"
          :disabled="s.placed || over"
          :aria-label="s.placed ? t.placedKey.replace('{c}', upper(s.tile.char)) : `${t.slot}: ${ru.keyboard.fingers[s.box.key.finger]}`"
          @click="onSlot($event, s.box.key.code)"
        >
          <span
            class="cap"
            :style="{ inset: `${u(SLOT_PAD_Y)} ${u(KEY_GAP / 2)}` }"
          >{{ s.placed ? upper(s.tile.char) : '' }}</span>
        </button>
      </div>
    </div>
    <!-- Счёт и подсказка — одной строкой: лоток из 11 фишек тогда не переносится, окно 1024×640 без прокрутки. -->
    <p class="status">
      <span class="count">{{ count }}</span>
      <span
        class="message"
        role="status"
      >{{ message ?? '' }}</span>
    </p>

    <div
      v-if="ghost"
      class="ghost"
      :class="{ back: ghost.back }"
      :style="{ left: `${ghost.x}%`, top: `${ghost.y}%`, width: keySize, height: keySize }"
      aria-hidden="true"
    >
      {{ ghostChar }}
    </div>
  </div>
</template>

<style scoped>
.puzzle {
  position: relative;
  container-type: inline-size;
  width: min(100%, 660px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  /* Протяжка мышью мимо фишки не выделяет буквы клавиатуры и подсказки. */
  user-select: none;
}

.board {
  order: -1;
  position: relative;
}

.layer {
  position: absolute;
  inset: 0;
}

.veil {
  position: absolute;
  left: 0;
  right: 0;
  background: color-mix(in srgb, var(--surface) 62%, transparent);
  pointer-events: none;
}

.slot {
  position: absolute;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
}

.slot:disabled {
  cursor: default;
}

/* Сама клавиша внутри кнопки: закрывает букву рисунка, пустая — только цвет пальца. */
.cap {
  position: absolute;
  display: grid;
  place-items: center;
  border-radius: calc(0.14 * var(--u));
  background: color-mix(in srgb, var(--zone) 30%, var(--surface));
  box-shadow: inset 0 0 0 calc(0.05 * var(--u)) color-mix(in srgb, var(--zone) 75%, var(--surface));
  outline: calc(0.035 * var(--u)) dashed color-mix(in srgb, var(--zone) 90%, var(--text));
  outline-offset: calc(-0.12 * var(--u));
  color: var(--on-zone);
  font-size: calc(0.44 * var(--u));
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
}

.slot.awaiting .cap {
  animation: wait 1.1s ease-in-out infinite;
}

.slot.placed .cap {
  background: var(--zone);
  box-shadow: none;
  outline: 0;
}

.slot.fresh .cap {
  animation: pop 0.3s ease-out;
}

.slot:focus-visible .cap {
  outline: 3px solid var(--text);
  outline-offset: 2px;
}

.bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: max(46px, calc(1.1 * var(--u)));
}

.tray {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.tile {
  width: max(44px, calc(1.05 * var(--u)));
  height: max(44px, calc(1.05 * var(--u)));
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: var(--text);
  color: var(--surface);
  font: inherit;
  font-size: max(1.2rem, calc(0.5 * var(--u)));
  font-weight: 800;
  cursor: grab;
  touch-action: none;
  user-select: none;
  box-shadow: 0 3px 0 rgb(0 0 0 / 0.35);
}

.tile.chosen {
  background: #ffd84a;
  color: #10231b;
  transform: translateY(-4px);
  box-shadow:
    0 0 0 3px var(--text),
    0 7px 0 rgb(0 0 0 / 0.35);
}

.tile.lifted {
  opacity: 0.25;
}

.tile:focus-visible {
  outline: 3px solid #ffd84a;
  outline-offset: 3px;
}

.status {
  margin: 0;
  min-height: 1.5em;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0 var(--space-3);
}

.count {
  opacity: 0.85;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.message {
  font-weight: 700;
  color: #ffd84a;
}

.ghost {
  position: absolute;
  z-index: 2;
  display: grid;
  place-items: center;
  transform: translate(-50%, -50%);
  border-radius: calc(0.14 * var(--u));
  background: var(--text);
  color: var(--surface);
  font-size: calc(0.5 * var(--u));
  font-weight: 800;
  box-shadow: 0 6px 14px rgb(0 0 0 / 0.45);
  pointer-events: none;
}

.ghost.back {
  transition:
    left 0.25s ease-in,
    top 0.25s ease-in;
}

@keyframes wait {
  50% {
    background: color-mix(in srgb, var(--zone) 55%, var(--surface));
  }
}

@keyframes pop {
  from {
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .slot.awaiting .cap,
  .slot.fresh .cap {
    animation: none;
  }

  .ghost.back {
    transition: none;
  }

  .tile.chosen {
    transform: none;
  }
}
</style>

<script setup lang="ts">
/*
 * Расставить по порядку: пункты перетаскиваются мышью (нативные pointer-события, без библиотек),
 * а с клавиатуры — кнопками ↑/↓ у каждого пункта. Стартовый порядок перемешан по id задачи
 * и никогда не совпадает с ответом. Пункт ставится на место, пока его тащат.
 */
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { initialOrder, moveItem, seedFromText, unquote, type OrderAnswer } from '../../engine/answers';
import { createRandom } from '../../engine/random';
import { ru } from '../../i18n/ru';
import type { AnswerControl, AnswerProps } from './control';

const props = defineProps<AnswerProps & { answer: OrderAnswer }>();

const order = ref<number[]>(initialOrder(props.answer.items.length, createRandom(seedFromText(props.idBase))));
const list = ref<HTMLOListElement | null>(null);
const dragged = ref<number | null>(null);
const announce = ref('');

const itemText = (item: number): string => props.answer.items[item] ?? '';
const buttonId = (item: number, dir: 'up' | 'down'): string => `${props.idBase}-order-${item}-${dir}`;

function say(item: number): void {
  const place = order.value.indexOf(item) + 1;
  // Шаблон сам ставит кавычки: у пунктов-названий («Заря») снимаем свои, чтобы не было двойных.
  announce.value = ru.penalty.order.moved
    .replace('{item}', unquote(itemText(item)))
    .replace('{place}', String(place))
    .replace('{total}', String(order.value.length));
}

/** Кнопка ↑/↓: фокус остаётся на том же пункте; упёрлись в край — на соседнюю кнопку. */
function step(place: number, dir: 'up' | 'down'): void {
  if (props.disabled) return;
  const item = order.value[place];
  if (item === undefined) return;
  order.value = moveItem(order.value, place, dir === 'up' ? place - 1 : place + 1);
  say(item);
  void nextTick(() => {
    const now = order.value.indexOf(item);
    const atEdge = dir === 'up' ? now === 0 : now === order.value.length - 1;
    const other = dir === 'up' ? 'down' : 'up';
    globalThis.document.getElementById(buttonId(item, atEdge ? other : dir))?.focus();
  });
}

/*
 * Перетаскивание. Слушаем окно, а не сам пункт: Vue переставляет узлы списка, и захват
 * указателя на переставленном узле браузер может сбросить. Место считаем по живому DOM:
 * пункт встаёт после всех, чья середина выше указателя.
 */
function onMove(e: PointerEvent): void {
  const item = dragged.value;
  if (item === null || !list.value) return;
  const rows = [...list.value.children] as HTMLElement[];
  const dom = rows.map((r) => Number(r.dataset.item));
  const from = dom.indexOf(item);
  let to = 0;
  rows.forEach((row, i) => {
    if (i === from) return;
    const r = row.getBoundingClientRect();
    if (e.clientY > r.top + r.height / 2) to++;
  });
  if (from >= 0 && to !== from) order.value = moveItem(dom, from, to);
}

function stopDrag(): void {
  globalThis.removeEventListener('pointermove', onMove);
  globalThis.removeEventListener('pointerup', stopDrag);
  globalThis.removeEventListener('pointercancel', stopDrag);
  if (dragged.value !== null) say(dragged.value);
  dragged.value = null;
}

function startDrag(e: PointerEvent, item: number): void {
  if (props.disabled || e.button !== 0) return;
  // Нажатие на ↑/↓ — это кнопка, а не начало перетаскивания.
  if (e.target instanceof Element && e.target.closest('button')) return;
  e.preventDefault();
  dragged.value = item;
  globalThis.addEventListener('pointermove', onMove);
  globalThis.addEventListener('pointerup', stopDrag);
  globalThis.addEventListener('pointercancel', stopDrag);
}

onBeforeUnmount(stopDrag);

defineExpose({
  read: () => ({ kind: 'order' as const, value: [...order.value] }),
  focus: () => {
    const first = order.value[0];
    if (first !== undefined) globalThis.document.getElementById(buttonId(first, 'down'))?.focus();
  },
} satisfies AnswerControl);
</script>

<template>
  <fieldset
    class="group"
    :aria-describedby="describedby"
  >
    <legend class="label">
      {{ ru.penalty.answerLabel }}
    </legend>
    <p class="note">
      {{ ru.penalty.order.note }}
    </p>
    <ol
      ref="list"
      class="order"
      :class="{ locked: disabled, dragging: dragged !== null }"
    >
      <li
        v-for="(item, place) in order"
        :key="item"
        class="item"
        :class="{ lifted: dragged === item }"
        :data-item="item"
        @pointerdown="startDrag($event, item)"
      >
        <span
          class="grip"
          aria-hidden="true"
        >≡</span>
        <span class="place">{{ place + 1 }}.</span>
        <span class="text">{{ itemText(item) }}</span>
        <button
          :id="buttonId(item, 'up')"
          type="button"
          class="move"
          :disabled="disabled || place === 0"
          :aria-label="`${ru.penalty.order.up}: ${itemText(item)}`"
          @click="step(place, 'up')"
        >
          ↑
        </button>
        <button
          :id="buttonId(item, 'down')"
          type="button"
          class="move"
          :disabled="disabled || place === order.length - 1"
          :aria-label="`${ru.penalty.order.down}: ${itemText(item)}`"
          @click="step(place, 'down')"
        >
          ↓
        </button>
      </li>
    </ol>
    <p
      class="visually-hidden"
      aria-live="polite"
    >
      {{ announce }}
    </p>
  </fieldset>
</template>

<style scoped src="./answer.css"></style>

<style scoped>
.order {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
  touch-action: none;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 52px;
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  background: var(--paper-field);
  border: 1px solid var(--paper-border);
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.item:hover {
  background: var(--paper-note);
}

.dragging,
.dragging .item {
  cursor: grabbing;
}

.item.lifted {
  border-color: var(--paper-button);
  background: #eaf0fb;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.18);
}

.locked .item {
  cursor: default;
}

.locked .item:hover {
  background: var(--paper-field);
}

.grip {
  flex: none;
  color: #6a6a6a;
  font-size: 1.3rem;
  line-height: 1;
}

.place {
  flex: none;
  min-width: 1.6em;
  font-weight: 600;
}

.text {
  flex: 1;
}

.move {
  flex: none;
  width: 44px;
  height: 44px;
  padding: 0;
  background: var(--paper-field);
  color: var(--paper-text);
  border: 1px solid var(--paper-border);
  border-radius: 4px;
  font: inherit;
  font-size: 1.2rem;
  cursor: pointer;
}

.move:hover:not(:disabled) {
  background: var(--paper-note);
}

.move:disabled {
  opacity: 0.35;
  cursor: default;
}

.move:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>

<script setup lang="ts">
/**
 * Списки в строке (Э3.34): «6 [+ − ×] 4 = [19 22 24]». Свой список: закрытый — плашка «+» без стрелки ОС, открытый — меню с подсвеченной
 * строкой. ↑↓ — подсветка, Enter — выбрать, Esc — закрыть меню (в паузу матча не уходит), Tab — дальше; Enter на закрытом списке уходит
 * наверх — ответить. Шаги — чистые функции `menuStep` (paper.ts). После ответа (`locked` и `reveal`) каждый список зелёный или красный.
 */
import { ref } from 'vue';
import type { AnswerInput, SelectAnswer } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import { menuStep, setAt } from './paper';

const props = defineProps<{ answer: SelectAnswer; modelValue: AnswerInput; locked?: boolean; reveal?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [AnswerInput] }>();
const t = ru.paper;
const ROW = 34; // высота строки меню, px

const chosen = (): readonly (number | null)[] => (props.modelValue.kind === 'select' ? props.modelValue.value : []);
/** Номер списка среди списков строки (части-текст не считаются). */
const listNo = (partIndex: number): number => props.answer.row.slice(0, partIndex).filter((p) => typeof p !== 'string').length;

const openNo = ref<number | null>(null);
const hl = ref(0);
const idOf = (n: number, i: number): string => `sel-${n}-${i}`;

function set(n: number, i: number): void {
  if (props.locked === true) return;
  emit('update:modelValue', { kind: 'select', value: setAt(chosen(), n, i) });
}
function state(n: number): string {
  const v = chosen()[n] ?? null;
  if (props.locked === true && props.reveal === true) return v === props.answer.correct[n] ? 'ok' : 'bad';
  return v === null ? '' : 'filled';
}
function onKey(e: KeyboardEvent, n: number, list: readonly string[]): void {
  if (props.locked === true) return;
  const isOpen = openNo.value === n;
  const start = isOpen ? hl.value : (chosen()[n] ?? 0);
  const step = menuStep({ open: isOpen, hl: start }, e.key, list.length);
  if (!step.handled && e.key !== 'Tab') return;
  if (step.handled) {
    e.preventDefault();
    e.stopPropagation(); // Esc закрывает только меню, паузу матча не зовёт
  }
  openNo.value = step.state.open ? n : null;
  hl.value = step.state.hl;
  if (step.pick !== null) set(n, step.pick);
}
function toggle(n: number): void {
  if (props.locked === true) return;
  openNo.value = openNo.value !== n ? n : null;
  hl.value = chosen()[n] ?? 0;
}
const close = (n: number): void => {
  if (openNo.value === n) openNo.value = null;
};
function pick(n: number, i: number): void {
  set(n, i);
  openNo.value = null;
}
/** Место под открытое меню: лист прокручивается внутри, меню не должно обрезаться (как в кадре Э3.34). */
const room = (): string => {
  const lists = props.answer.row.filter((p): p is string[] => typeof p !== 'string');
  const open = openNo.value === null ? undefined : lists[openNo.value];
  return open === undefined ? '0' : `${open.length * ROW + 8}px`;
};
</script>

<template>
  <div
    class="expr"
    :data-kind="answer.kind"
  >
    <template
      v-for="(p, pi) in answer.row"
      :key="pi"
    >
      <span
        v-if="typeof p === 'string'"
        class="txt"
      >{{ p }}</span>
      <span
        v-else
        class="wrap"
      >
        <button
          type="button"
          role="combobox"
          class="pf-fld sel"
          :class="[state(listNo(pi)), { empty: chosen()[listNo(pi)] == null, open: openNo === listNo(pi) }]"
          :aria-label="t.select.label.replace('{n}', String(listNo(pi) + 1))"
          aria-haspopup="listbox"
          :aria-expanded="openNo === listNo(pi)"
          :aria-controls="`sel-menu-${listNo(pi)}`"
          :aria-activedescendant="openNo === listNo(pi) ? idOf(listNo(pi), hl) : undefined"
          :disabled="locked"
          @click="toggle(listNo(pi))"
          @keydown="onKey($event, listNo(pi), p)"
          @blur="close(listNo(pi))"
        >
          {{ chosen()[listNo(pi)] == null ? t.select.empty : p[chosen()[listNo(pi)] ?? 0] }}
        </button>
        <ul
          v-if="openNo === listNo(pi)"
          :id="`sel-menu-${listNo(pi)}`"
          class="menu"
          role="listbox"
          :aria-label="t.select.label.replace('{n}', String(listNo(pi) + 1))"
        >
          <li
            v-for="(o, oi) in p"
            :id="idOf(listNo(pi), oi)"
            :key="oi"
            role="option"
            :class="{ on: hl === oi }"
            :aria-selected="chosen()[listNo(pi)] === oi"
            :style="{ height: `${ROW}px` }"
            @mousedown.prevent
            @click="pick(listNo(pi), oi)"
          >
            {{ o }}
          </li>
        </ul>
      </span>
    </template>
    <span
      class="room"
      :style="{ height: room() }"
    />
  </div>
</template>

<style scoped>
.expr { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 26px; font-weight: 700; }
.txt { white-space: nowrap; line-height: 44px; }
.wrap { position: relative; display: inline-block; }
.sel { height: 44px; min-width: 64px; font-size: 26px; cursor: pointer; }
.sel.empty { color: var(--paper-muted); }
.sel:disabled { cursor: default; opacity: 1; }
.menu { position: absolute; z-index: 5; top: 48px; left: 0; min-width: 100%; margin: 0; padding: 4px; list-style: none; border: 2px solid var(--paper-border); border-radius: 10px; background: var(--paper-field); box-shadow: 0 6px 16px rgb(0 0 0 / 0.18); }
.menu li { box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 0 14px; border-radius: 6px; font-size: 22px; white-space: nowrap; cursor: pointer; }
.menu li.on { background: var(--paper-focus); color: var(--paper-button-text); }
.room { flex-basis: 100%; }
</style>

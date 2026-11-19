<script setup lang="ts">
/**
 * Поля в строке выражения (Э3.32): «[ ] × ( [ ] + 2 ) = [ ]», под окошком — «(1 цифра)». Tab идёт по окошкам, Enter — ответить
 * (уходит наверх). После ответа (`locked` и `reveal`) каждое окошко зелёное или красное.
 */
import { parseInteger, type AnswerInput, type ExprAnswer } from '../../engine/school/answers';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { setAt } from './paper';

const props = defineProps<{ answer: ExprAnswer; modelValue: AnswerInput; locked?: boolean; reveal?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [AnswerInput] }>();
const t = ru.paper;

const values = (): readonly string[] => (props.modelValue.kind === 'expr' ? props.modelValue.value : []);
/** Номер окошка среди окошек строки. */
const boxNo = (partIndex: number): number => props.answer.parts.slice(0, partIndex).filter((p) => p === null).length;
const digitsText = (n: number): string => {
  const count = String(props.answer.values[n] ?? '').replace('-', '').length;
  return `(${plural(count, t.digits).replace('{n}', String(count))})`;
};
function set(n: number, e: Event): void {
  if (props.locked !== true) emit('update:modelValue', { kind: 'expr', value: setAt(values(), n, (e.target as HTMLInputElement).value) });
}
function state(n: number): string {
  const v = values()[n] ?? '';
  if (props.locked === true && props.reveal === true) return parseInteger(v) === props.answer.values[n] ? 'ok' : 'bad';
  return v.trim() === '' ? '' : 'filled';
}
</script>

<template>
  <div
    class="expr"
    :data-kind="answer.kind"
  >
    <template
      v-for="(p, pi) in answer.parts"
      :key="pi"
    >
      <span
        v-if="p !== null"
        class="txt"
      >{{ p }}</span>
      <span
        v-else
        class="box"
      >
        <input
          class="pf-fld"
          :class="state(boxNo(pi))"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-label="digitsText(boxNo(pi))"
          :value="values()[boxNo(pi)] ?? ''"
          :readonly="locked"
          @input="set(boxNo(pi), $event)"
        >
        <span class="sub">{{ digitsText(boxNo(pi)) }}</span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.expr { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 8px; font-size: 28px; font-weight: 700; }
.txt { white-space: nowrap; line-height: 36px; }
.box { display: inline-flex; flex-direction: column; align-items: center; }
.box .pf-fld { width: 76px; padding: 0 6px; }
.sub { margin-top: 4px; font-size: 13px; font-weight: 400; line-height: 1.25; color: var(--paper-muted); white-space: nowrap; }
</style>

<script setup lang="ts">
/**
 * Поле ответа листа задачи (ЭБ.21, 065 Т10б, 067 Т15): по виду ответа — число, дробь, поля, выбор одного и нескольких, порядок, слово;
 * список, соединялка, выбор рисунков и окошки выражения — свои компоненты (`FIELD_OF` в paper.ts: какому виду какое поле).
 * Только показ и ввод: значение живёт у вызывающего (`v-model`), проверку делает движок (`engine/school/answers.ts`).
 * После ответа (`locked`) поле не меняется; `reveal` — подсветить верные варианты (эталонный ответ).
 */
import { computed, type Component } from 'vue';
import { moveItem, type AnswerInput, type TaskAnswer } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import ExprField from './ExprField.vue';
import MatchField from './MatchField.vue';
import { FIELD_OF, isComponentField, setAt, toggleIndex, type ComponentField } from './paper';
import PictureField from './PictureField.vue';
import SelectField from './SelectField.vue';

/** Свои компоненты полей (виды `FIELD_HOME` = component); тип `Record` — поле без компонента не соберётся. */
const FIELD_COMPONENT: Record<ComponentField, Component> = { select: SelectField, match: MatchField, expr: ExprField };

/** digits — выбор одного и галочки с цифрами-клавишами (Школа, 067-Р7); без него — буквы А, Б, В (пенальти, не трогаем). */
const props = defineProps<{ answer: TaskAnswer; modelValue: AnswerInput; locked?: boolean; reveal?: boolean; digits?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [AnswerInput] }>();
const t = ru.paper;

/** Поле по виду ответа — одна таблица `FIELD_OF`: ветки шаблона идут по ней, а не по виду напрямую. */
const field = computed(() => FIELD_OF[props.answer.kind]);
const own = computed<Component | null>(() => (isComponentField(field.value) ? FIELD_COMPONENT[field.value] : null));
/** Цифры-клавиши: у «картинок» — всегда нужен PictureField (без `digits` — с буквами), у выбора одного и галочек — когда `digits`. */
const pictureField = computed(() => props.answer.kind === 'pictures' || (props.digits === true && field.value === 'options'));

const input = computed(() => props.modelValue);
const set = (v: AnswerInput): void => {
  if (!props.locked) emit('update:modelValue', v);
};
const text = (e: Event): string => (e.target as HTMLInputElement).value;

const setFraction = (part: 'whole' | 'num' | 'den', e: Event): void => {
  if (input.value.kind === 'fraction') set({ kind: 'fraction', value: { ...input.value.value, [part]: text(e) } });
};
const setField = (i: number, e: Event): void => {
  if (input.value.kind !== 'fields') return;
  set({ kind: 'fields', value: setAt(input.value.value, i, text(e)) });
};
/** Выбор: у «одного» — нажатый вариант; у «нескольких» — галочка включается и снимается. */
const pickOption = (i: number): void => {
  if (input.value.kind === 'choice') set({ kind: 'choice', value: i });
  else if (input.value.kind === 'multi') set({ kind: 'multi', value: toggleIndex(input.value.value, i) });
};
const chosen = (i: number): boolean => (input.value.kind === 'choice' ? input.value.value === i : input.value.kind === 'multi' && input.value.value.includes(i));
const isRight = (i: number): boolean => {
  const a = props.answer;
  return props.reveal === true && ((a.kind === 'choice' && a.correct === i) || (a.kind === 'multi' && a.correct.includes(i)));
};
const move = (from: number, to: number): void => {
  if (input.value.kind === 'order') set({ kind: 'order', value: moveItem(input.value.value, from, to) });
};
const setWord = (e: Event): void => {
  if (input.value.kind === 'integer' || input.value.kind === 'text') set({ kind: input.value.kind, value: text(e) });
};
</script>

<template>
  <div
    class="field"
    :data-kind="answer.kind"
  >
    <input
      v-if="field === 'text' && (answer.kind === 'integer' || answer.kind === 'text') && (input.kind === 'integer' || input.kind === 'text')"
      class="fld wide"
      type="text"
      autocomplete="off"
      :inputmode="answer.kind === 'integer' ? 'numeric' : 'text'"
      :aria-label="t.field.answer"
      :placeholder="t.field.answer"
      :value="input.value"
      :readonly="locked"
      @input="setWord"
    >

    <div
      v-else-if="field === 'fraction' && answer.kind === 'fraction' && input.kind === 'fraction'"
      class="frac"
    >
      <input
        v-if="answer.mixed"
        class="fld"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        :aria-label="t.field.whole"
        :placeholder="t.field.whole"
        :value="input.value.whole"
        :readonly="locked"
        @input="setFraction('whole', $event)"
      >
      <span class="bar">
        <input
          class="fld"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-label="t.field.num"
          :placeholder="t.field.num"
          :value="input.value.num"
          :readonly="locked"
          @input="setFraction('num', $event)"
        >
        <input
          class="fld"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-label="t.field.den"
          :placeholder="t.field.den"
          :value="input.value.den"
          :readonly="locked"
          @input="setFraction('den', $event)"
        >
      </span>
    </div>

    <div
      v-else-if="field === 'fields' && answer.kind === 'fields' && input.kind === 'fields'"
      class="rows"
    >
      <label
        v-for="(f, i) in answer.fields"
        :key="f.label"
        class="row"
      >
        <span>{{ f.label }}</span>
        <input
          class="fld"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :value="input.value[i]"
          :readonly="locked"
          @input="setField(i, $event)"
        >
      </label>
    </div>

    <PictureField
      v-else-if="field === 'options' && pictureField && (answer.kind === 'pictures' || answer.kind === 'choice' || answer.kind === 'multi')"
      :answer="answer"
      :model-value="modelValue"
      :locked="locked"
      :reveal="reveal"
      :digits="digits"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <template #card="{ index }">
        <slot
          name="card"
          :index="index"
        />
      </template>
    </PictureField>
    <component
      :is="own"
      v-else-if="own !== null"
      :answer="answer"
      :model-value="modelValue"
      :locked="locked"
      :reveal="reveal"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <div
      v-else-if="field === 'options' && (answer.kind === 'choice' || answer.kind === 'multi')"
      class="opts list"
    >
      <button
        v-for="(o, i) in answer.options"
        :key="o"
        type="button"
        class="opt"
        :class="{ sel: chosen(i), ref: isRight(i) }"
        :aria-pressed="chosen(i)"
        :disabled="locked"
        @click="pickOption(i)"
      >
        <span class="lab"><i />{{ t.letters[i] }}<b
          v-if="isRight(i)"
          class="ok-mark"
        >✓</b></span>
        <span class="txt">{{ o }}</span>
      </button>
    </div>

    <ol
      v-else-if="field === 'order' && answer.kind === 'order' && input.kind === 'order'"
      class="order"
    >
      <li
        v-for="(item, place) in input.value"
        :key="item"
      >
        <span class="no">{{ place + 1 }}</span>
        <span class="txt">{{ answer.items[item] }}</span>
        <button
          type="button"
          class="mv"
          :aria-label="t.up"
          :disabled="locked || place === 0"
          @click="move(place, place - 1)"
        >
          ↑
        </button>
        <button
          type="button"
          class="mv"
          :aria-label="t.down"
          :disabled="locked || place === input.value.length - 1"
          @click="move(place, place + 1)"
        >
          ↓
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.field { margin-top: 6px; }
.fld { box-sizing: border-box; width: 120px; padding: 8px 10px; border: 1.5px solid var(--paper-border); border-radius: 8px; background: var(--paper-field); color: var(--paper-text); font: inherit; font-size: 18px; }
.fld.wide { width: 320px; }
.fld:focus { outline: none; border-color: var(--paper-focus); box-shadow: 0 0 0 2px rgb(26 79 176 / 0.25); }
.frac { display: flex; align-items: center; gap: 14px; }
.bar { display: flex; flex-direction: column; gap: 6px; }
.rows { display: flex; flex-direction: column; gap: 8px; }
.row { display: flex; align-items: center; gap: 12px; }
.row span { min-width: 120px; }
.opts.list { flex-direction: column; gap: 8px; }
.opts.list .opt { flex-direction: row; justify-content: flex-start; padding: 8px 14px; font: inherit; color: inherit; text-align: left; cursor: pointer; }
.opts.list .opt:disabled { cursor: default; }
.opt:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
.txt { flex: 1; }
.order { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.order li { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border: 1.5px solid var(--paper-border); border-radius: 8px; background: var(--paper-field); }
.no { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: var(--paper-note); font-weight: 700; font-size: 14px; }
.mv { width: 34px; height: 30px; border: 1.5px solid var(--paper-border); border-radius: 6px; background: var(--paper-field); color: var(--paper-focus); font-size: 18px; font-weight: 700; cursor: pointer; }
.mv:disabled { opacity: 0.35; cursor: default; }
.mv:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
</style>

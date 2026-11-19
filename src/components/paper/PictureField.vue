<script setup lang="ts">
/**
 * Варианты с цифрой-клавишей (Э3.29, Э3.30): выбор одного (кружок), галочки (квадрат), выбор рисунков (квадрат с картинкой).
 * Цифры 1–6 отмечают вариант с клавиатуры (067-Р7, 025-Р20); у отмеченного вместо цифры «✓». Рисунок контента — только
 * `<img src="data:image/svg+xml,…">`, не разметка страницы. После ответа (`locked`): верный отмеченный — зелёный, лишний — красный,
 * пропущенный верный — красный пунктиром (`reveal`).
 */
import { computed, onBeforeUnmount, onMounted } from 'vue';
import type { AnswerInput, ChoiceAnswer, MultiAnswer, PicturesAnswer } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import { digitIndex, svgSrc, toggleIndex } from './paper';

/** digits — цифры на вариантах и клавиши 1–6 (Школа); без него — буквы А, Б, В (пенальти, 067-Р7) и без слушателя клавиш. */
const props = defineProps<{ answer: ChoiceAnswer | MultiAnswer | PicturesAnswer; modelValue: AnswerInput; locked?: boolean; reveal?: boolean; digits?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [AnswerInput] }>();
const t = ru.paper;

const count = computed(() => (props.answer.kind === 'pictures' ? props.answer.pictures.length : props.answer.options.length));
const picked = computed<readonly number[]>(() => {
  const v = props.modelValue;
  if (v.kind === 'choice') return v.value === null ? [] : [v.value];
  return v.kind === 'multi' || v.kind === 'pictures' ? v.value : [];
});
const right = (i: number): boolean => (props.answer.kind === 'choice' ? props.answer.correct === i : props.answer.correct.includes(i));

function pick(i: number): void {
  if (props.locked === true) return;
  const a = props.answer;
  if (a.kind === 'choice') emit('update:modelValue', { kind: 'choice', value: i });
  else emit('update:modelValue', { kind: a.kind, value: toggleIndex(picked.value, i) });
}
/** Состояние варианта: до ответа — выбран; после — верно, лишний, пропущен. */
function state(i: number): string {
  const on = picked.value.includes(i);
  if (props.locked !== true || props.reveal !== true) return on ? 'sel' : '';
  if (on) return right(i) ? 'ok' : 'bad';
  return right(i) ? 'bad miss' : '';
}
function onKey(e: KeyboardEvent): void {
  if (e.repeat) return;
  const target = e.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) return;
  const i = digitIndex(e, count.value);
  if (i === null) return;
  e.preventDefault();
  pick(i);
}
onMounted(() => {
  if (props.digits === true) globalThis.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <div
    class="pf-opts"
    role="group"
    :data-kind="answer.kind"
  >
    <button
      v-for="i in count"
      :key="i"
      type="button"
      class="pf-opt"
      :class="[state(i - 1), { sq: answer.kind !== 'choice', pic: answer.kind === 'pictures' }]"
      :aria-pressed="picked.includes(i - 1)"
      :disabled="locked"
      @click="pick(i - 1)"
    >
      <span class="k">{{ picked.includes(i - 1) ? '✓' : digits === true ? i : (t.letters[i - 1] ?? i) }}</span>
      <!-- слот `card` — своё содержимое карточки (арена игр 5–8: фигура игрока, форма Альбома); по умолчанию — рисунок или текст варианта -->
      <slot
        name="card"
        :index="i - 1"
      >
        <img
          v-if="answer.kind === 'pictures'"
          :src="svgSrc(answer.pictures[i - 1] ?? '')"
          :alt="t.picture.replace('{n}', String(i))"
        >
        <span v-else>{{ answer.options[i - 1] }}</span>
      </slot>
    </button>
  </div>
</template>

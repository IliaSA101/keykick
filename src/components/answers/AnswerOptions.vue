<script setup lang="ts">
/*
 * Варианты ответа с буквами А–Е: выбор одного (choice — радиокнопки) или нескольких
 * (multi — галочки). Вся строка варианта — цель для клика, высота не меньше 44 px.
 */
import { ref } from 'vue';
import type { ChoiceAnswer, MultiAnswer } from '../../engine/answers';
import { ru } from '../../i18n/ru';
import type { AnswerControl, AnswerProps } from './control';

const props = defineProps<AnswerProps & { answer: ChoiceAnswer | MultiAnswer }>();

const multi = props.answer.kind === 'multi';
const one = ref<number | null>(null);
const many = ref<number[]>([]);

const checked = (i: number): boolean => (multi ? many.value.includes(i) : one.value === i);
const optionId = (i: number): string => `${props.idBase}-option-${i}`;

defineExpose({
  read: () =>
    multi
      ? { kind: 'multi' as const, value: [...many.value] }
      : { kind: 'choice' as const, value: one.value },
  // Фокус — на выбранный вариант, если он есть, иначе на первый.
  focus: () => {
    const first = multi ? many.value[0] : one.value;
    globalThis.document.getElementById(optionId(first ?? 0))?.focus();
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
      {{ multi ? ru.penalty.multiNote : ru.penalty.choiceNote }}
    </p>
    <ul class="options">
      <li
        v-for="(text, i) in answer.options"
        :key="text"
      >
        <label
          class="option"
          :class="{ checked: checked(i), locked: disabled }"
          :for="optionId(i)"
        >
          <input
            v-if="multi"
            :id="optionId(i)"
            v-model="many"
            type="checkbox"
            :value="i"
            :disabled="disabled"
          >
          <input
            v-else
            :id="optionId(i)"
            v-model="one"
            type="radio"
            :name="`${idBase}-choice`"
            :value="i"
            :disabled="disabled"
          >
          <span class="letter">{{ ru.penalty.letters[i] }})</span>
          <span>{{ text }}</span>
        </label>
      </li>
    </ul>
  </fieldset>
</template>

<style scoped src="./answer.css"></style>

<script setup lang="ts">
/*
 * Одна строка ответа: целое число (integer) или слово (text). Разметка у них одна и та же,
 * разница — в клавиатуре на планшете и в том, как движок проверяет набранное.
 */
import { ref } from 'vue';
import { ru } from '../../i18n/ru';
import type { AnswerControl, AnswerProps } from './control';

const props = defineProps<AnswerProps & { kind: 'integer' | 'text' }>();

const value = ref('');
const field = ref<HTMLInputElement | null>(null);

defineExpose({
  read: () => ({ kind: props.kind, value: value.value }),
  focus: () => field.value?.focus(),
} satisfies AnswerControl);
</script>

<template>
  <div>
    <label
      class="label"
      :for="`${idBase}-line`"
    >{{ ru.penalty.answerLabel }}</label>
    <input
      :id="`${idBase}-line`"
      ref="field"
      v-model="value"
      class="paper-input line"
      :class="kind"
      type="text"
      :inputmode="kind === 'integer' ? 'numeric' : 'text'"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      :disabled="disabled"
      :aria-invalid="invalid"
      :aria-describedby="describedby"
    >
  </div>
</template>

<style scoped src="./answer.css"></style>

<style scoped>
.line {
  width: 12em;
  max-width: 100%;
}

.line.text {
  width: 16em;
}
</style>

<script setup lang="ts">
/*
 * Несколько подписанных полей («a = __», «Петя: __»), в каждом — целое число.
 * Подпись берётся из задачи как есть; порядок полей важен, если задача не сказала иного.
 */
import { ref } from 'vue';
import { parseInteger, type FieldsAnswer } from '../../engine/answers';
import { ru } from '../../i18n/ru';
import { isBlank, type AnswerControl, type AnswerProps } from './control';

const props = defineProps<AnswerProps & { answer: FieldsAnswer }>();

const values = ref<string[]>(props.answer.fields.map(() => ''));
// Массив ref в v-for не обещает порядок полей — ищем поле по id.
const input = (i: number): HTMLElement | null => globalThis.document.getElementById(`${props.idBase}-field-${i}`);

/** Подсвечиваем только виноватые поля: пустые и не целые. */
const bad = (s: string): boolean => props.invalid && (isBlank(s) || parseInteger(s) === null);

defineExpose({
  read: () => ({ kind: 'fields' as const, value: [...values.value] }),
  // Фокус — в первое пустое или неверное поле: туда ребёнку и надо.
  focus: () => {
    const i = values.value.findIndex((s) => isBlank(s) || parseInteger(s) === null);
    input(Math.max(i, 0))?.focus();
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
    <p
      v-if="answer.unordered"
      class="note"
    >
      {{ ru.penalty.fieldsAnyOrder }}
    </p>
    <div class="rows">
      <template
        v-for="(f, i) in answer.fields"
        :key="f.label"
      >
        <label
          class="field-label"
          :for="`${idBase}-field-${i}`"
        >{{ f.label }}</label>
        <input
          :id="`${idBase}-field-${i}`"
          v-model="values[i]"
          class="paper-input field"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          :disabled="disabled"
          :aria-invalid="bad(values[i] ?? '')"
          :aria-describedby="describedby"
        >
      </template>
    </div>
  </fieldset>
</template>

<style scoped src="./answer.css"></style>

<style scoped>
.rows {
  display: grid;
  grid-template-columns: max-content 9em;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.field-label {
  text-align: right;
}

.field {
  width: 100%;
}
</style>

<script setup lang="ts">
/*
 * Обыкновенная дробь, как на олимпиаде: числитель над чертой, знаменатель под ней,
 * слева — целая часть, если задача просит смешанное число. «/» в числителе переводит
 * в знаменатель, пробел в целой части — в числитель: так быстрее, чем мышью.
 * На русской раскладке клавиша «/» (у правого Shift) печатает «.» или «,», поэтому переход —
 * и по ним, и по самой клавише (e.code), а символ в поле не попадает.
 */
import { ref } from 'vue';
import { parseNatural, type FractionAnswer } from '../../engine/answers';
import { ru } from '../../i18n/ru';
import { isBlank, type AnswerControl, type AnswerProps } from './control';

const props = defineProps<AnswerProps & { answer: FractionAnswer }>();

const whole = ref('');
const num = ref('');
const den = ref('');
const wholeField = ref<HTMLInputElement | null>(null);
const numField = ref<HTMLInputElement | null>(null);
const denField = ref<HTMLInputElement | null>(null);

/** Подсвечиваем только виноватое поле: пустое обязательное или не целое без знака. */
function bad(s: string, required: boolean): boolean {
  if (!props.invalid) return false;
  if (isBlank(s)) return required;
  return parseNatural(s) === null;
}

// Из числителя в знаменатель: «/» на любой раскладке, а также точка и запятая.
const TO_DEN_KEYS = ['/', '.', ','];

function jump(e: KeyboardEvent, keys: readonly string[], code: string | null, next: HTMLInputElement | null): void {
  if (!keys.includes(e.key) && (code === null || e.code !== code)) return;
  e.preventDefault();
  next?.focus();
}

defineExpose({
  read: () => ({ kind: 'fraction' as const, value: { whole: whole.value, num: num.value, den: den.value } }),
  focus: () => (props.answer.mixed ? wholeField.value : numField.value)?.focus(),
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
      {{ answer.mixed ? ru.penalty.fraction.mixedNote : ru.penalty.fraction.note }}
    </p>
    <div class="fraction">
      <input
        v-if="answer.mixed"
        ref="wholeField"
        v-model="whole"
        class="paper-input part whole"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        spellcheck="false"
        :aria-label="ru.penalty.fraction.whole"
        :disabled="disabled"
        :aria-invalid="bad(whole, false)"
        :aria-describedby="describedby"
        @keydown="jump($event, [' '], null, numField)"
      >
      <div class="stack">
        <input
          ref="numField"
          v-model="num"
          class="paper-input part"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          :aria-label="ru.penalty.fraction.num"
          :disabled="disabled"
          :aria-invalid="bad(num, true)"
          :aria-describedby="describedby"
          @keydown="jump($event, TO_DEN_KEYS, 'Slash', denField)"
        >
        <div
          class="bar"
          aria-hidden="true"
        />
        <input
          ref="denField"
          v-model="den"
          class="paper-input part"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          :aria-label="ru.penalty.fraction.den"
          :disabled="disabled"
          :aria-invalid="bad(den, true)"
          :aria-describedby="describedby"
        >
      </div>
    </div>
  </fieldset>
</template>

<style scoped src="./answer.css"></style>

<style scoped>
.fraction {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.stack {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
  width: 6em;
}

.part {
  width: 100%;
  text-align: center;
}

.whole {
  width: 5em;
}

.bar {
  height: 2px;
  background: var(--paper-text);
}
</style>

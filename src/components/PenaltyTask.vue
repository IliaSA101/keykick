<script setup lang="ts">
/*
 * Пенальти — одна задача в строгом облике «как на олимпиаде»: белый лист, поле «Ответ»,
 * кнопка «Отправить», без футбольных украшений (docs/design.md, «Пенальти»).
 * Бьёшь один раз: после отправки ответ закрыт. Неверный формат и неполный ответ попытку не тратят.
 * Поля ответа — свой компонент на каждый вид (components/answers), проверка — в движке.
 * compact — пенальти по ходу матча (MatchPenalty, спека 005): тот же лист в две колонки —
 * слева заголовок (title вместо «Задача», после ответа скрыт), условие и разбор, справа поле ответа.
 */
import { nextTick, onMounted, ref, watch } from 'vue';
import { answerText, checkAnswer, wrongReason, type AnswerKind, type CheckResult, type WrongReason } from '../engine/answers';
import type { Task } from '../engine/tasks';
import { ru } from '../i18n/ru';
import AnswerFields from './answers/AnswerFields.vue';
import AnswerFraction from './answers/AnswerFraction.vue';
import AnswerLine from './answers/AnswerLine.vue';
import AnswerOptions from './answers/AnswerOptions.vue';
import AnswerOrder from './answers/AnswerOrder.vue';
import type { AnswerControl } from './answers/control';

const props = defineProps<{ task: Task; compact?: boolean; title?: string }>();
const emit = defineEmits<{ answered: [result: { correct: boolean }] }>();

const hint = ref<string | null>(null);
// Красная рамка — только у формата и неполного ответа; «сначала выбери» — просто подсказка.
const invalid = ref(false);
const verdict = ref<'correct' | 'wrong' | null>(null);
// Неверно, но значение совпало (дробь не сокращена и т. п.) — пояснение под вердиктом.
const reason = ref<WrongReason | null>(null);
let control: AnswerControl | null = null;

// Компоненты ответа отдают себя через defineExpose; ref-функция одна на все виды.
function setControl(el: unknown): void {
  control = (el as AnswerControl | null) ?? null;
}

function hintFor(result: Exclude<CheckResult, 'correct' | 'wrong'>, kind: AnswerKind): string {
  const h = ru.penalty.hints;
  if (result === 'empty') return kind === 'choice' ? h.emptyChoice : kind === 'multi' ? h.emptyMulti : h.empty;
  if (result === 'incomplete') return kind === 'fraction' ? h.fractionIncomplete : h.incomplete;
  if (kind === 'fraction') return h.fractionFormat;
  if (kind === 'fields') return h.fieldsFormat;
  if (kind === 'text') return h.textFormat;
  return ru.penalty.formatHint;
}

/**
 * fromButton — нажата кнопка «Отправить». Пустое поле ввода по Enter молча не отправляется:
 * лишний Enter с прошлого экрана не должен зажигать подсказку. По кнопке — подсказка, что сделать.
 * У вариантов (choice, multi) Enter без выбора — та же подсказка, что и по кнопке: там Enter
 * жмут осознанно, на выбранном варианте, а молчание выглядит как поломка.
 */
function submit(fromButton: boolean): void {
  if (verdict.value !== null || control === null) return;
  const input = control.read();
  const result = checkAnswer(props.task.answer, input);
  if (result === 'correct' || result === 'wrong') {
    hint.value = null;
    invalid.value = false;
    reason.value = result === 'wrong' ? wrongReason(props.task.answer, input) : null;
    verdict.value = result;
    emit('answered', { correct: result === 'correct' });
    return;
  }
  const kind = props.task.answer.kind;
  if (result === 'empty' && !fromButton && kind !== 'choice' && kind !== 'multi') return;
  hint.value = hintFor(result, props.task.answer.kind);
  invalid.value = result !== 'empty';
  control.focus();
}

/** Enter в поле, на варианте или галочке отправляет ответ; на кнопке (↑/↓, «Отправить») — жмёт её. */
function onEnter(e: KeyboardEvent): void {
  if (e.target instanceof HTMLButtonElement) return;
  e.preventDefault();
  submit(false);
}

// Новая задача в том же компоненте — чистый лист (поля ответа пересоздаются по :key).
watch(
  () => props.task.id,
  () => {
    hint.value = null;
    invalid.value = false;
    verdict.value = null;
    reason.value = null;
    void nextTick(() => control?.focus());
  },
);

onMounted(() => control?.focus());
</script>

<template>
  <article
    class="sheet"
    :class="{ compact, answered: verdict !== null }"
    :aria-labelledby="`penalty-title-${task.id}`"
  >
    <h2
      :id="`penalty-title-${task.id}`"
      class="title"
    >
      {{ title ?? ru.penalty.title }}
    </h2>
    <p class="text">
      {{ task.text }}
    </p>

    <form
      class="answer"
      novalidate
      @submit.prevent="submit(true)"
      @keydown.enter="onEnter"
    >
      <AnswerLine
        v-if="task.answer.kind === 'integer' || task.answer.kind === 'text'"
        :key="task.id"
        :ref="setControl"
        :kind="task.answer.kind"
        :id-base="`penalty-${task.id}`"
        :disabled="verdict !== null"
        :invalid="invalid"
        :describedby="`penalty-hint-${task.id}`"
      />
      <AnswerFraction
        v-else-if="task.answer.kind === 'fraction'"
        :key="`${task.id}-fraction`"
        :ref="setControl"
        :answer="task.answer"
        :id-base="`penalty-${task.id}`"
        :disabled="verdict !== null"
        :invalid="invalid"
        :describedby="`penalty-hint-${task.id}`"
      />
      <AnswerFields
        v-else-if="task.answer.kind === 'fields'"
        :key="`${task.id}-fields`"
        :ref="setControl"
        :answer="task.answer"
        :id-base="`penalty-${task.id}`"
        :disabled="verdict !== null"
        :invalid="invalid"
        :describedby="`penalty-hint-${task.id}`"
      />
      <AnswerOptions
        v-else-if="task.answer.kind === 'choice' || task.answer.kind === 'multi'"
        :key="`${task.id}-options`"
        :ref="setControl"
        :answer="task.answer"
        :id-base="`penalty-${task.id}`"
        :disabled="verdict !== null"
        :invalid="invalid"
        :describedby="`penalty-hint-${task.id}`"
      />
      <AnswerOrder
        v-else
        :key="`${task.id}-order`"
        :ref="setControl"
        :answer="task.answer"
        :id-base="`penalty-${task.id}`"
        :disabled="verdict !== null"
        :invalid="invalid"
        :describedby="`penalty-hint-${task.id}`"
      />

      <p
        :id="`penalty-hint-${task.id}`"
        class="hint"
        :class="{ soft: !invalid }"
        aria-live="polite"
      >
        <template v-if="hint !== null">
          {{ hint }}
        </template>
      </p>
      <button
        class="submit"
        type="submit"
        :disabled="verdict !== null"
      >
        {{ ru.penalty.submit }}
      </button>
    </form>

    <div
      class="outcome"
      aria-live="polite"
    >
      <template v-if="verdict !== null">
        <p
          class="verdict"
          :class="verdict"
        >
          <template v-if="verdict === 'correct'">
            {{ ru.penalty.correct }}
          </template>
          <template v-else>
            {{ ru.penalty.wrong }} {{ ru.penalty.rightAnswer }} {{ answerText(task.answer, ru.penalty.letters) }}
          </template>
        </p>
        <p
          v-if="verdict === 'wrong' && reason !== null"
          class="reason"
        >
          {{ ru.penalty.wrongReason[reason] }}
        </p>
        <section class="solution">
          <h3 class="solution-title">
            {{ ru.penalty.solution }}
          </h3>
          <p class="solution-text">
            {{ task.solution }}
          </p>
        </section>
      </template>
    </div>
  </article>
</template>

<style scoped>
/* Лист всегда светлый: и поля ввода, и кнопки рисуются в светлой схеме даже в тёмной теме. */
.sheet {
  color-scheme: light;
  box-sizing: border-box;
  max-width: 760px;
  margin: 0 auto;
  padding: var(--space-5) calc(var(--space-5) + var(--space-2));
  background: var(--paper);
  color: var(--paper-text);
  border: 1px solid var(--paper-border);
  border-radius: 6px;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);
  font-family: var(--font);
  font-size: 1rem;
  line-height: 1.6;
}

.title {
  margin: 0 0 var(--space-3);
  font-size: 1.1rem;
  font-weight: 600;
}

/*
 * Плотный лист — посреди матча: слой с ним помещается в окно 1024×640 вместо строки и клавиатуры.
 * Две колонки: слева заголовок, условие и разбор после ответа, справа поле ответа — лист
 * от ответа не растёт, а длинные варианты и порядок не уходят за край окна.
 */
.sheet.compact {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto auto 1fr;
  column-gap: var(--space-5);
  align-content: start;
  max-width: none;
  margin: 0;
  padding: var(--space-3) var(--space-5);
  line-height: 1.45;
}

.compact .title {
  grid-column: 1;
  grid-row: 1;
  margin: 0 0 var(--space-1);
  font-size: 1rem;
  font-weight: 700;
}

.compact .text {
  grid-column: 1;
  grid-row: 2;
  margin: 0 0 var(--space-3);
}

.compact .outcome {
  grid-column: 1;
  grid-row: 3;
}

/* Поле ответа — справа; «Отправить» и подсказка — одной строкой под ним. */
.compact .answer {
  grid-column: 2;
  grid-row: 1 / span 3;
  align-self: start;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  align-content: start;
  column-gap: var(--space-3);
}

.compact .answer > :first-child {
  flex: 1 0 100%;
  min-width: 0;
}

.compact .submit {
  order: 1;
  margin-top: var(--space-2);
}

.compact .hint {
  order: 2;
  flex: 1;
  min-width: 0;
  margin: var(--space-2) 0 0;
  line-height: 1.3;
}

.compact .verdict {
  margin: 0 0 var(--space-2);
}

.compact .solution {
  padding: var(--space-2) var(--space-3);
}

/* «Решение — …» одной строкой с текстом: разбор на строку короче. */
.compact .solution-title,
.compact .solution-text {
  display: inline;
}

.compact .solution-title::after {
  content: ' \2014  ';
}

/*
 * Варианты — в две колонки, порядок — плотнее; цели те же 44 px. Подпись «Ответ» — только
 * для экранного диктора: поле и так справа от условия. Заголовок после ответа — тоже: рядом
 * уже итог удара и разбор, «Реши — и гол в счёт матча» был бы дублем.
 */
.compact.answered .title,
.compact :deep(.label) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.compact :deep(.note) {
  margin-bottom: var(--space-1);
  line-height: 1.3;
}

.compact :deep(.options) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-1);
}

.compact :deep(.option) {
  padding-block: 0;
}

.compact :deep(.order) {
  gap: 2px;
}

.compact :deep(.item) {
  min-height: 0;
  padding-block: 1px;
}

.text {
  margin: 0 0 var(--space-5);
  white-space: pre-line;
}

.submit {
  min-height: 44px;
  padding: var(--space-2) var(--space-5);
  background: var(--paper-button);
  color: var(--paper-button-text);
  border: 1px solid var(--paper-button);
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.55;
  cursor: default;
}

.submit:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}

.hint {
  min-height: 1.6em;
  margin: var(--space-2) 0;
  color: var(--paper-wrong);
}

.hint.soft {
  color: var(--paper-text);
}

.verdict {
  margin: var(--space-3) 0;
  font-weight: 600;
}

.verdict.correct {
  color: var(--paper-correct);
}

.verdict.wrong {
  color: var(--paper-wrong);
}

.reason {
  margin: calc(-1 * var(--space-2)) 0 var(--space-3);
}

.solution {
  padding: var(--space-3) var(--space-4);
  background: var(--paper-note);
  border-radius: 4px;
}

.solution-title {
  margin: 0 0 var(--space-1);
  font-size: 1rem;
  font-weight: 600;
}

.solution-text {
  margin: 0;
  color: var(--paper-text);
  white-space: pre-line;
}
</style>

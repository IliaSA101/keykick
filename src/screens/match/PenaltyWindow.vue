<script setup lang="ts">
/**
 * Окно пенальти (065 Т10б, кадры Э1.18–Э1.21, Э1.31): слова над листом и лист задачи. Только показ: ход ответа — в `app/match/penaltyFlow.ts`,
 * клавиши (Enter, Esc, Пробел) ловит экран матча. Верно — «Верно — гол! Счёт матча 4 : 1» и «+1 к Знатоку»; неверно — полоса с верным ответом.
 */
import { computed } from 'vue';
import type { PenaltyFlow } from '../../app/match/penaltyFlow';
import type { PaperVerdict } from '../../components/paper/paper';
import TaskPaper from '../../components/paper/TaskPaper.vue';
import { answerText, type AnswerInput } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';

const props = defineProps<{ flow: PenaltyFlow; total: { me: number; opp: number }; scrollEnd?: boolean | undefined }>();
const emit = defineEmits<{ 'update:input': [AnswerInput]; submit: []; skip: []; next: [] }>();
const t = ru.paper;

const verdict = computed<PaperVerdict | null>(() => {
  const f = props.flow;
  if (f.stage !== 'done' || f.answer === null || f.answer === 'skip') return null;
  if (f.answer === 'hit') {
    return { kind: 'goal', text: t.penalty.goal.replace('{me}', String(props.total.me)).replace('{opp}', String(props.total.opp)), badge: t.penalty.knower, next: t.penalty.next };
  }
  return { kind: 'miss', text: t.penalty.miss.replace('{answer}', answerText(f.task.answer, t.letters)), next: t.penalty.next };
});
const hint = computed(() => (props.flow.hint === null ? null : t.hint[props.flow.hint]));
</script>

<template>
  <div class="penalty">
    <p class="lead">
      {{ t.penalty.lead }} <span>{{ t.penalty.sub }}</span>
    </p>
    <TaskPaper
      :task="flow.task"
      :input="flow.input"
      :hint="hint"
      :verdict="verdict"
      :scroll-end="scrollEnd"
      @update:input="emit('update:input', $event)"
      @submit="emit('submit')"
      @skip="emit('skip')"
      @next="emit('next')"
    />
  </div>
</template>

<style scoped>
.lead { position: absolute; top: 100px; left: 50%; margin: 0 0 0 -370px; width: 740px; font-size: 22px; font-weight: 800; color: var(--text); z-index: 3; }
.lead span { color: var(--text-muted); font-weight: 700; }
.penalty { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.penalty :deep(.sheet) { pointer-events: auto; }
</style>

<script setup lang="ts">
/**
 * Лист задачи (ЭБ.21, 065 Т10б): строгий белый лист олимпиады — шапка, условие, поле ответа по виду задачи, «Ответить» и
 * «Не бить» (или полоса итога после ответа). Длинный лист листается внутри: шапка и низ закреплены (Э1.20/Э1.21).
 * Компонент не знает экранов: задача, ввод, подсказка и вердикт приходят снаружи, наружу уходят `update:input`, `submit`, `skip`, `next`.
 * Стили листа — `styles/kit/task.css` (`.sheet`, `.kind`, `.q`, `.ans`, `.verdict`), здесь только компоновка прокрутки.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { AnswerInput } from '../../engine/school/answers';
import type { Task } from '../../engine/school/tasks';
import { ru } from '../../i18n/ru';
import AnswerField from './AnswerField.vue';
import type { PaperVerdict } from './paper';

const props = defineProps<{
  task: Task;
  input: AnswerInput;
  /** Подсказка «ответ не принят»; null — нет. */
  hint?: string | null;
  verdict?: PaperVerdict | null;
  /** Кадр стенда: лист уже прокручен до конца (Э1.21). */
  scrollEnd?: boolean | undefined;
}>();
const emit = defineEmits<{ 'update:input': [AnswerInput]; submit: []; skip: []; next: [] }>();
const t = ru.paper;

const kindText = computed(() => {
  const a = props.task.answer;
  return a.kind === 'fraction' && a.mixed ? t.kind.mixed : t.kind[a.kind];
});
const locked = computed(() => props.verdict != null);

// прокрутка: «листай вниз» и затухание — пока под листом есть что читать
const scroller = ref<HTMLElement | null>(null);
const more = ref(false);
function measure(): void {
  const e = scroller.value;
  more.value = e !== null && e.scrollHeight - e.clientHeight - e.scrollTop > 4;
}
onMounted(() => {
  void nextTick(() => {
    if (props.scrollEnd && scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight;
    measure();
  });
});
watch(() => props.task.id, () => void nextTick(measure));
</script>

<template>
  <div
    class="sheet paper"
    role="group"
    :aria-label="t.title"
    data-paper
  >
    <div class="zad">
      {{ t.title }}
    </div>
    <div class="kind">
      {{ kindText }}
    </div>
    <div class="scroll">
      <div
        ref="scroller"
        class="body"
        tabindex="-1"
        @scroll="measure"
      >
        <p class="q">
          {{ task.text }}
        </p>
        <AnswerField
          :answer="task.answer"
          :model-value="input"
          :locked="locked"
          :reveal="locked"
          @update:model-value="emit('update:input', $event)"
        />
      </div>
      <template v-if="more">
        <div class="fade" />
        <div class="more">
          {{ t.scrollMore }}
        </div>
      </template>
    </div>

    <div
      v-if="verdict"
      class="verdict"
      :class="{ bad: verdict.kind === 'miss' }"
      role="status"
    >
      <span>{{ verdict.text }}</span>
      <span
        v-if="verdict.badge"
        class="badge"
      >{{ verdict.badge }}</span>
      <button
        type="button"
        class="hint next"
        data-act="next"
        @click="emit('next')"
      >
        {{ verdict.next }}
      </button>
    </div>
    <template v-else>
      <p
        v-if="hint"
        class="warn"
        role="status"
      >
        {{ hint }}
      </p>
      <div class="ans">
        <button
          type="button"
          class="go"
          data-act="submit"
          @click="emit('submit')"
        >
          {{ t.go }}
        </button>
        <span class="note">{{ task.answer.kind === 'choice' || task.answer.kind === 'multi' ? t.keysChoice : t.keys }}</span>
        <button
          type="button"
          class="skip"
          data-act="skip"
          @click="emit('skip')"
        >
          {{ t.skip }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* лист по высоте содержимого, но не выше места на сцене: дальше листается тело (шапка и низ стоят) */
.paper { display: flex; flex-direction: column; left: 50%; margin-left: -380px; width: 760px; top: 136px; max-height: 476px; padding-bottom: 12px; }
.scroll { position: relative; flex: 1 1 auto; min-height: 0; margin-top: 6px; border-top: 1px solid #ecebf2; border-bottom: 1px solid #ecebf2; display: flex; }
.body { flex: 1; min-height: 0; overflow-y: auto; padding: 8px 6px 10px 0; scrollbar-width: thin; }
.q { margin: 0 0 8px; font-size: 18px; white-space: pre-line; }
.fade { position: absolute; left: 0; right: 14px; bottom: 0; height: 56px; background: linear-gradient(rgb(255 255 255 / 0), #fff 85%); pointer-events: none; }
.more { position: absolute; left: 50%; transform: translateX(-50%); bottom: 8px; padding: 6px 14px; border-radius: 999px; background: #2a2840; color: #fff; font-size: 14px; font-weight: 700; white-space: nowrap; box-shadow: 0 4px 12px rgb(0 0 0 / 0.25); pointer-events: none; }
.warn { margin: 8px 0 0; color: var(--paper-wrong); font-size: 15px; font-weight: 700; }
.ans { flex: none; }
.ans button { border: 0; font-family: inherit; cursor: pointer; }
.ans .skip { background: none; padding: 4px 2px; }
.ans button:focus-visible, .verdict button:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
.verdict { flex: none; }
.verdict .next { border: 0; background: none; font: inherit; font-weight: 700; color: #2a2840; cursor: pointer; padding: 2px 4px; }
</style>

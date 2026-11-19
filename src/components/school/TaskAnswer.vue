<script setup lang="ts">
/**
 * Ответ на задачу в листе Школы (067 Т14/Т16): пока решают — поле `AnswerField` (`v-model`), после неверного — две колонки
 * «Твой ответ» и «Эталонный ответ» (`missed`). Общий для тура и «штрафных»; только показ — шаги и проверка у экрана и движка.
 */
import { computed } from 'vue';
import { typeInto, type TourRun } from '../../app/school/tour';
import type { Task } from '../../engine/school/tasks';
import { ru } from '../../i18n/ru';
import AnswerField from '../paper/AnswerField.vue';
import { svgSrc } from '../paper/paper';

/** `task` — задача шага (после неверного — та, что с эталоном); `digits` — выбор с цифрами-клавишами. */
const props = defineProps<{ run: TourRun; task: Task; digits: boolean }>();
const emit = defineEmits<{ 'update:run': [TourRun] }>();
const missed = computed(() => (props.run.stage === 'etalon' ? props.run.missed : null));
</script>

<template>
  <div class="row">
    <p class="q">
      {{ task.text }}
    </p>
    <img
      v-if="task.figure"
      class="fig"
      alt=""
      :src="svgSrc(task.figure)"
    >
  </div>
  <div
    v-if="missed"
    class="two"
  >
    <div>
      <h3>{{ ru.school.tour.mine }}</h3>
      <AnswerField
        :key="`m${run.tour.i}`"
        :answer="task.answer"
        :model-value="missed.mine"
        locked
      />
    </div>
    <div class="good">
      <h3>{{ ru.school.tour.etalon }}</h3>
      <AnswerField
        :key="`e${run.tour.i}`"
        :answer="task.answer"
        :model-value="missed.etalon.input"
        locked
        reveal
      />
    </div>
  </div>
  <AnswerField
    v-else
    :key="task.id"
    :answer="task.answer"
    :model-value="run.input"
    :digits="digits"
    @update:model-value="emit('update:run', typeInto(run, $event))"
  />
</template>

<style scoped>
.row { display: flex; gap: 22px; align-items: flex-start; }
.row .q { flex: 1; }
.fig { flex: none; width: 180px; height: 126px; }
.q { font-size: 18px; white-space: pre-line; margin: 8px 0; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.two > div { padding: 10px; border: 2px solid var(--paper-border); border-radius: 10px; }
.two .good { border-color: var(--paper-correct); }
.two h3 { margin: 0; font-size: 12px; text-transform: uppercase; }
.two :deep(.expr) { font-size: 22px; gap: 6px; }
.two :deep(.box .pf-fld) { width: 52px; }
</style>

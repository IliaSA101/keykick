<script setup lang="ts">
/*
 * Страница родителя: поставить игроку любой урок — проверить урок, лигу или кубок, не проходя всё
 * заново (просьба владельца 04.11). Уроки — курса v2 (`courseLessons`); уроки до выбранного засчитываются пройденными.
 */
import { ref, watch } from 'vue';
import { courseLessons } from '../app/course/load';
import { updatePlayer } from '../app/save/sections';
import { section as courseSection, type CourseSave } from '../engine/course/save';
import { firstOpenIndex, lessonIndexOf, setLesson } from '../engine/parent/view';
import { ru } from '../i18n/ru';

const props = defineProps<{
  /** Чей прогресс открыт на странице. */
  playerId: string;
  /** id текущего урока игрока ('' — первый). */
  current: string;
  /** Пройденные уроки игрока: раньше первого не пройденного поставить нельзя (018-Р31). */
  passed: readonly string[];
}>();
const emit = defineEmits<{ changed: [] }>();

const t = ru.parent;
const ids = courseLessons.map((l) => l.id);
const floor = (): number => firstOpenIndex(props.passed, ids);
const index = (): number => Math.max(lessonIndexOf(props.current, ids), floor());
const picked = ref(index());
const done = ref<number | null>(null);

// Выбран другой игрок или урок сменился в игре — список показывает его текущий урок.
watch(
  () => [props.playerId, props.current, props.passed.length] as const,
  () => {
    picked.value = index();
  },
);
watch(
  () => props.playerId,
  () => {
    done.value = null;
  },
);

function apply(): void {
  updatePlayer((tx) => tx.set(courseSection, setLesson(tx.get(courseSection) as CourseSave, picked.value, ids)), { player: props.playerId });
  done.value = picked.value;
  emit('changed');
}
</script>

<template>
  <section class="block">
    <h2>{{ t.setLesson }}</h2>
    <p class="muted">
      {{ t.setLessonHint }}
    </p>
    <div class="line">
      <label class="word">
        {{ t.setLessonPick }}
        <select v-model.number="picked">
          <option
            v-for="(l, i) in courseLessons"
            :key="l.id"
            :value="i"
            :disabled="i < floor()"
          >
            {{ i + 1 }}. {{ l.name }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="btn"
        :disabled="picked === index()"
        @click="apply"
      >
        {{ t.setLesson }}
      </button>
    </div>
    <p
      v-if="done !== null"
      class="note"
      role="status"
    >
      {{ t.setLessonDone }} {{ done + 1 }}.
    </p>
  </section>
</template>

<style scoped>
/* Облик — как у остальной страницы родителя (ParentScreen.vue, ParentPlayers.vue). */
.block {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--paper-border);
}

h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.2rem;
}

.muted {
  margin: var(--space-2) 0 0;
  color: #555;
}

.line {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.word {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  max-width: 100%;
}

select {
  min-height: 44px;
  max-width: 100%;
  padding: 0 var(--space-2);
  border: 1px solid var(--paper-border);
  border-radius: 8px;
  background: var(--paper-field);
  color: var(--paper-text);
  font: inherit;
}

.btn {
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
  background: var(--paper-field);
  color: var(--paper-text);
  font: inherit;
  cursor: pointer;
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.btn:focus-visible,
select:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}

.note {
  margin: var(--space-3) 0 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--paper-note);
  font-weight: 700;
}
</style>

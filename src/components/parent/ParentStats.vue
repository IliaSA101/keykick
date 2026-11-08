<script setup lang="ts">
/*
 * Страница родителя: прогресс выбранного игрока и трудные клавиши. Только показ: подсчёты — в движке (stats, parent/view).
 * Блок «Время игры» скрыт до раздела дня (040, 018-Р28): дни в сохранении v2 не пишутся.
 */
import { computed } from 'vue';
import { courseLessons } from '../../app/course/load';
import { keymap } from '../../app/keymap';
import { lessonIndexOf, type ParentView } from '../../engine/parent/view';
import { weakKeys } from '../../engine/stats';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const props = defineProps<{ viewed: Readonly<ParentView>; name: string }>();

const t = ru.parent;

const lesson = computed(() => courseLessons[lessonIndexOf(props.viewed.lessonId, courseLessons.map((l) => l.id))]);
const lessonNumber = computed(() => lessonIndexOf(props.viewed.lessonId, courseLessons.map((l) => l.id)) + 1);

const facts = computed(() => [
  { label: t.club, value: props.viewed.clubName === '' ? ru.players.noClub : props.viewed.clubName },
  { label: t.coins, value: String(props.viewed.coins) },
]);

const weak = computed(() =>
  weakKeys(props.viewed.keyErrors, keymap, lesson.value?.layout ?? 'ru').map((w) => ({
    ...w,
    label: w.label.trim() === '' ? t.space : w.label,
    // Знак — с именем: «. точка» (009-Р22).
    name: ru.keyboard.marks[w.label] ?? '',
    count: `${w.errors} ${plural(w.errors, t.errors)}`,
  })),
);
</script>

<template>
  <section class="block">
    <h2>{{ t.progress }}: {{ name }}</h2>
    <p class="lesson">
      {{ t.lesson }} {{ lessonNumber }} {{ t.of }} {{ courseLessons.length }}: <b>{{ lesson?.name }}</b>
    </p>
    <dl class="facts">
      <div
        v-for="f in facts"
        :key="f.label"
      >
        <dt>{{ f.label }}</dt>
        <dd>{{ f.value }}</dd>
      </div>
    </dl>
  </section>

  <!-- Между прогрессом и трудными клавишами стоят блоки урока и проверки матча (их кладёт экран). -->
  <slot />

  <section class="block">
    <h2>{{ t.weak }}</h2>
    <template v-if="weak.length > 0">
      <ul class="keys">
        <li
          v-for="w in weak"
          :key="w.code"
        >
          <span class="cap">{{ w.label }}</span> {{ w.name }} {{ w.count }}
        </li>
      </ul>
      <p class="muted">
        {{ t.weakHint }}
      </p>
    </template>
    <p
      v-else
      class="muted"
    >
      {{ t.noWeak }}
    </p>
  </section>
</template>

<style scoped src="./paper.css"></style>
<style scoped>
.lesson {
  margin: 0 0 var(--space-3);
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--space-3);
  margin: 0;
}

.facts div {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--paper-note);
}

.facts dt {
  color: #555;
  font-size: 0.9rem;
}

.facts dd {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.keys {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
}

.cap {
  display: inline-grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  border: 1px solid var(--paper-border);
  border-radius: 8px;
  background: var(--paper-note);
  font-weight: 700;
}
</style>

<script setup lang="ts">
/*
 * Страница родителя: ссылки быстрой проверки матча (app/matchJump) — разминка, тайм, решающая
 * атака, пенальти посреди матча, перерыв с каждой мини-игрой, итог на 1–3 звезды, раунды кубков (просьба владельца 04.11).
 * Такой матч в сохранение ничего не пишет. С экранов игры этих ссылок нет (tests/guards.test.ts).
 */
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { stageName } from '../app/cup';
import { lessons } from '../app/lessons';
import { checkQuery, type CheckTarget } from '../app/matchJump';
import { playerName } from '../app/players';
import { CUP_STAGES, LEAGUES } from '../engine/cup';
import { minigames } from '../engine/minigames';
import { ru } from '../i18n/ru';

const props = defineProps<{
  /** Урок выбранного игрока (индекс с 0): с него список начинается. */
  current: number;
}>();

const t = ru.parent;
const picked = ref(props.current);
watch(
  () => props.current,
  (current) => {
    picked.value = current;
  },
);
// Пустой id — без урока в адресе: матч возьмёт урок игрока вкладки.
const lessonId = computed(() => lessons[picked.value]?.id ?? '');

interface CheckLink {
  label: string;
  target: CheckTarget;
}

const places = computed<CheckLink[]>(() => [
  ...(['warmup', 'half1', 'penalty', 'decisive'] as const).map((at) => ({
    label: t.checkPlaces[at],
    target: { at, lessonId: lessonId.value },
  })),
  ...([1, 2, 3] as const).map((stars) => ({
    label: t.checkResult[stars - 1] ?? '',
    target: { at: 'result' as const, stars, lessonId: lessonId.value },
  })),
]);

const breaks = computed<CheckLink[]>(() =>
  minigames.map((game) => ({
    label: ru.halftime[game].title,
    target: { at: 'halftime', game, lessonId: lessonId.value },
  })),
);

// Урок матча кубка — свой у раунда (engine/cup), выбранный выше урок его не меняет.
const cups = LEAGUES.map((league) => ({
  title: ru.cup.titles[league],
  links: CUP_STAGES.map((round) => ({ label: stageName(round), target: { cup: { league, round } } })),
}));

const to = (target: CheckTarget) => ({ path: '/match', query: checkQuery(target) });
</script>

<template>
  <section class="block">
    <h2>{{ t.check }}</h2>
    <p class="muted">
      {{ t.checkHint }}
    </p>
    <p class="muted">
      <template v-if="playerName !== null">
        {{ t.checkWho }} <b>{{ playerName }}</b>.
      </template>
      <template v-else>
        {{ t.checkNoWho }}
      </template>
    </p>
    <label class="word">
      {{ t.checkLesson }}
      <select v-model.number="picked">
        <option
          v-for="(l, i) in lessons"
          :key="l.id"
          :value="i"
        >
          {{ i + 1 }}. {{ l.name }}
        </option>
      </select>
    </label>

    <h3>{{ t.checkMatch }}</h3>
    <ul class="links">
      <li
        v-for="l in places"
        :key="l.label"
      >
        <RouterLink :to="to(l.target)">
          {{ l.label }}
        </RouterLink>
      </li>
    </ul>

    <h3>{{ t.checkHalftime }}</h3>
    <ul class="links">
      <li
        v-for="l in breaks"
        :key="l.label"
      >
        <RouterLink :to="to(l.target)">
          {{ l.label }}
        </RouterLink>
      </li>
    </ul>

    <h3>{{ t.checkCups }}</h3>
    <div
      v-for="c in cups"
      :key="c.title"
      class="cup"
    >
      <span class="cup-title">{{ c.title }}</span>
      <ul class="links">
        <li
          v-for="l in c.links"
          :key="l.label"
        >
          <RouterLink :to="to(l.target)">
            {{ l.label }}
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* Облик — как у остальной страницы родителя (ParentLesson.vue, ParentScreen.vue). */
.block {
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--paper-border);
}

h2 {
  margin: 0 0 var(--space-3);
  font-size: 1.2rem;
}

h3 {
  margin: var(--space-4) 0 var(--space-2);
  font-size: 1rem;
}

.muted {
  margin: var(--space-2) 0 0;
  color: #555;
}

.word {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-width: 100%;
  margin-top: var(--space-3);
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

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Ссылка — плашкой 44 px, как кнопки страницы: нажимается целиком. */
.links a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 var(--space-4);
  border: 1px solid var(--paper-border);
  border-radius: var(--radius);
  background: var(--paper-field);
  color: var(--paper-button);
  font-weight: 700;
  text-decoration: none;
}

.links a:hover {
  border-color: var(--paper-button);
}

.links a:focus-visible,
select:focus-visible {
  outline: 3px solid var(--paper-focus);
  outline-offset: 2px;
}

.cup {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  margin-top: var(--space-2);
}

.cup-title {
  min-width: 12em;
}
</style>

<script setup lang="ts">
/*
 * Витрина экрана матча v2 (#/dev/match?scene=<сцена>&lesson=yard-05, только dev-сборка): MatchScreen с видом из движка
 * (`matchView`) в нужной фазе. Сцена живая: клавиши, Enter, Пробел, Esc ведут машину дальше. В сохранение ничего не пишется.
 * Подписи здесь латиницей — это не интерфейс ребёнка.
 */
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { MatchContext } from '../../components/match/context';
import { tasks } from '../../app/tasks';
import { next } from '../../engine/match/machine';
import { matchView, type Action } from '../../engine/match/view';
import MatchResult from '../../components/matchResult/MatchResult.vue';
import MatchScreen from '../../screens/match/MatchScreen.vue';
import { lessonById, rules, SEED } from './driver';
import { extrasOf } from './extras';
import { sceneIds, scenes } from './scenes';

const route = useRoute();
const q = (key: string): string | null => {
  const v = route.query[key];
  return typeof v === 'string' ? v : null;
};

const lesson = computed(() => lessonById(q('lesson')));
const at = computed(() => (sceneIds.includes(q('scene') ?? '') ? (q('scene') as string) : 'intro'));
const state = ref(scenes[at.value]!(lesson.value));
watch([at, lesson], () => (state.value = scenes[at.value]!(lesson.value)));

const view = computed(() => matchView(state.value));
const ctx = computed<MatchContext>(() => ({
  lessonName: lesson.value.name,
  newKeys: lesson.value.newKeys,
  tip: lesson.value.tips[0] ?? null,
  layout: lesson.value.layout,
  g: lesson.value.g,
  c: lesson.value.c,
  usName: 'Us',
  rivalName: 'Rival',
  usKit: null,
  rivalKit: null,
  kickTask: tasks.find((t) => t.id === state.value.kick?.taskId) ?? null,
  coachMs: rules.coach.ms,
  comeback: at.value === 'comeback',
}));
const extras = computed(() => extrasOf(state.value, at.value));

let now = 5000;
function send(a: Action): void {
  state.value = next(state.value, a).state;
}
const tick = (): number => (now += 100);
</script>

<template>
  <section class="showcase">
    <nav class="scenes">
      <a
        v-for="id in sceneIds"
        :key="id"
        :href="`#/dev/match?scene=${id}&lesson=${lesson.id}`"
        :data-scene="id"
        :class="{ on: id === at }"
      >{{ id }}</a>
    </nav>
    <MatchScreen
      :view="view"
      :ctx="ctx"
      @start="send({ type: 'start', now: tick() })"
      @press="(p) => send({ type: 'press', press: p })"
      @kick-answer="(r) => send({ type: 'kickAnswer', result: r })"
      @skip-kick="send({ type: 'skipKick' })"
      @to-second-half="send({ type: 'toSecondHalf', now: tick(), seed: SEED + 1 })"
      @pause="send({ type: 'pause' })"
      @resume="send({ type: 'resume' })"
      @quit="send({ type: 'quit', now: tick() })"
    >
      <template #result="{ view: v }">
        <MatchResult
          v-if="v.result"
          :info="v.result"
          :extras="extras"
          :us="ctx.usName"
          :rival="ctx.rivalName"
          @choose="(offer) => send({ type: 'choose', offer, seed: SEED + 3, now: tick() })"
          @next="state = scenes[at]!(lesson)"
        />
      </template>
    </MatchScreen>
  </section>
</template>

<style scoped>
.scenes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: var(--space-2);
  font-size: 0.75rem;
}

.scenes a.on {
  font-weight: 800;
  text-decoration: none;
}
</style>

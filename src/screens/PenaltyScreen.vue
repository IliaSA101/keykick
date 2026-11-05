<script setup lang="ts">
/*
 * Серия пенальти после матча: три олимпиадные задачи подряд в строгом облике, по одной попытке.
 * Задачи серии выбираются один раз и лежат в сохранении (save.ts, PenaltySeries), итог удара
 * пишется сразу: перезагрузка показывает ту же непробитую задачу и не даёт перебить пробитую.
 * Паки уже начислены за таймы, пенальти их не отнимает.
 */
import { computed, nextTick, ref, shallowRef } from 'vue';
import { useRoute } from 'vue-router';
import KeyButton from '../components/KeyButton.vue';
import PenaltyTask from '../components/PenaltyTask.vue';
import { fillPenaltySeries, progress, recordPenalty } from '../app/progress';
import { sound } from '../app/sound';
import { tasks } from '../app/tasks';
import { MISS_COINS } from '../engine/midPenalty';
import { PENALTY_COINS } from '../engine/rewards';
import { kicksLeft, nextKick } from '../engine/save';
import { pickTask, type Task } from '../engine/tasks';
import { plural } from '../i18n/plural';
import { ru } from '../i18n/ru';

const seed = Date.now() % 2147483647;
const route = useRoute();
const t = ru.penaltyScreen;

/*
 * Только при разработке (npm run dev): #/penalty?task=<id> или #/penalty?kind=<вид ответа>
 * открывает нужную задачу без матча и не пишет результат в сохранение — для проверки глазами.
 * В сборке для ребёнка import.meta.env.DEV ложно, и ветка вырезается.
 */
function devTask(): Task | undefined {
  if (!import.meta.env.DEV) return undefined;
  const { task: id, kind } = route.query;
  if (typeof id === 'string') return tasks.find((x) => x.id === id);
  if (typeof kind !== 'string') return undefined;
  const pool = tasks.filter((x) => x.answer.kind === kind && x.verified);
  return pool.length > 0 ? pickTask(pool, seed, []) : undefined;
}

const preview = devTask();
// Серия только что заработана (или из старого сохранения) — выбрать задачи и сразу сохранить.
// Зерно — от часов: серия каждый раз новая; нерешённые и разные виды ответа — раньше (pickSeries).
if (preview === undefined) fillPenaltySeries(seed);

function kickTask(): Task | null {
  const id = nextKick(progress.penalty);
  return tasks.find((x) => x.id === id) ?? null;
}

/**
 * Задача на экране. Не вычисляется из прогресса: после ответа прогресс уже на следующем ударе,
 * а ребёнок ещё читает решение. Следующая задача — по кнопке «Следующий удар».
 */
const shown = shallowRef<Task | null>(preview ?? kickTask());
const verdict = ref<boolean | null>(null);
const after = ref<HTMLElement | null>(null);

const series = computed(() => (preview === undefined ? progress.penalty : null));
const scored = computed(() => series.value?.results.filter(Boolean).length ?? 0);
const left = computed(() => kicksLeft(series.value));
const kickNo = computed(() => (series.value?.results.length ?? 0) + (verdict.value === null ? 1 : 0));
const finished = computed(() => series.value !== null && left.value === 0);
const kickCoins = computed(() => (verdict.value ? PENALTY_COINS : MISS_COINS));

/** Кружки на табло: гол, мимо, ещё не бит — по ударам серии. */
const dots = computed(() =>
  Array.from({ length: series.value?.kicks ?? 0 }, (_, i) => {
    const r = series.value?.results[i];
    return r === undefined ? 'wait' : r ? 'goal' : 'miss';
  }),
);

function onAnswered(r: { correct: boolean }): void {
  if (verdict.value !== null || shown.value === null) return;
  verdict.value = r.correct;
  if (preview === undefined) recordPenalty(shown.value.id, r.correct);
  if (r.correct) sound.goal();
  else sound.save();
  // Решение длинное — итог уходит вниз: прокручиваем к нему. Фокус — на сам итог, а не на кнопку:
  // второй Enter не уводит дальше, и «Гол!» с решением ребёнок увидит; Tab — сразу к кнопке.
  void nextTick(revealAfter);
}

function nextShot(): void {
  if (verdict.value === null) return;
  const next = kickTask();
  if (next === null) return;
  shown.value = next;
  verdict.value = null;
  // Новая задача — с начала листа: табло серии и условие сверху. Поле ответа задача
  // сама сфокусирует (и при нужде докрутит до него).
  globalThis.scrollTo({ top: 0 });
}

const outOfView = (el: HTMLElement): boolean => {
  const r = el.getBoundingClientRect();
  return r.top < 0 || r.bottom > globalThis.innerHeight;
};

/*
 * Итог с кнопкой «дальше» — целиком в окне. Плавная прокрутка не гарантирована: в фоновой
 * вкладке она стоит на месте (так и вышло при проверке на 1024×640), её сбивает перерисовка.
 * Поэтому через миг проверяем ещё раз и, если итог всё ещё не виден, прыгаем без анимации.
 */
function revealAfter(): void {
  const el = after.value;
  if (!el) return;
  el.focus({ preventScroll: true });
  if (!outOfView(el)) return;
  const still = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
  globalThis.setTimeout(() => {
    if (el.isConnected && outOfView(el)) el.scrollIntoView({ block: 'nearest' });
  }, 700);
}
</script>

<template>
  <section class="penalty">
    <header class="head panel">
      <h1>{{ t.title }}</h1>
      <p>{{ t.lead }}</p>
      <div
        v-if="series"
        class="board"
      >
        <span class="board-score">{{ t.board }} {{ scored }} {{ t.of }} {{ series.kicks }}</span>
        <span
          class="dots"
          role="list"
        >
          <span
            v-for="(d, i) in dots"
            :key="i"
            class="dot"
            :class="d"
            role="listitem"
            :aria-label="`${t.kick} ${i + 1}: ${t.kickResult[d]}`"
          />
        </span>
        <span
          v-if="!finished || verdict !== null"
          class="kick"
        >{{ t.kick }} {{ Math.min(kickNo, series.kicks) }} {{ t.of }} {{ series.kicks }}</span>
      </div>
    </header>

    <div
      v-if="shown === null"
      class="after panel"
    >
      <p
        class="verdict"
        :class="{ goal: finished }"
      >
        <template v-if="finished && series">
          {{ t.done }} {{ t.board }} {{ scored }} {{ t.of }} {{ series.kicks }}
        </template>
        <template v-else>
          {{ t.notReady }}
        </template>
      </p>
      <div class="actions">
        <KeyButton
          v-if="progress.pendingPacks > 0"
          to="/pack"
          primary
        >
          {{ t.toPack }}
        </KeyButton>
        <KeyButton
          to="/match"
          :primary="progress.pendingPacks === 0"
        >
          {{ t.toMatch }}
        </KeyButton>
      </div>
    </div>

    <PenaltyTask
      v-else
      :task="shown"
      @answered="onAnswered"
    />

    <div
      v-if="verdict !== null"
      ref="after"
      class="after panel"
      role="status"
      tabindex="-1"
    >
      <p
        class="verdict"
        :class="{ goal: verdict }"
      >
        {{ verdict ? t.goal : t.saved }}
        <!-- Монеты и за промах с ответом (005-Р9): начислены в applyPenalty, здесь — сколько. -->
        <template v-if="preview === undefined">
          +{{ kickCoins }} {{ plural(kickCoins, ru.pack.coinWords) }}
        </template>
      </p>
      <p
        v-if="finished && series"
        class="verdict goal"
      >
        {{ t.done }} {{ t.board }} {{ scored }} {{ t.of }} {{ series.kicks }}
      </p>
      <div class="actions">
        <KeyButton
          v-if="left > 0"
          primary
          @click="nextShot"
        >
          {{ t.next }}
        </KeyButton>
        <!-- Те же кнопки, что после перезагрузки итога (выше): пак, если есть, и «На матч!». -->
        <template v-else>
          <KeyButton
            v-if="progress.pendingPacks > 0"
            to="/pack"
            primary
          >
            {{ t.toPack }}
          </KeyButton>
          <KeyButton
            to="/match"
            :primary="progress.pendingPacks === 0"
          >
            {{ t.toMatch }}
          </KeyButton>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.penalty {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head h1 {
  margin: 0;
}

.head p {
  margin: var(--space-1) 0 0;
  color: var(--text-muted);
}

/* Табло серии: счёт, кружки ударов, номер удара. */
.board {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
  margin-top: var(--space-3);
  font-weight: 800;
}

.board-score {
  font-size: 1.2rem;
  color: var(--accent);
}

.dots {
  display: inline-flex;
  gap: 8px;
}

.dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--text-muted);
}

.dot.goal {
  border-color: #2f9a27;
  background: #6fd34a;
}

.dot.miss {
  border-color: #b3261e;
  background: #e06055;
}

.kick {
  color: var(--text-muted);
}

.after {
  text-align: center;
}

.after:focus {
  outline: none;
}

.after:focus-visible {
  outline: 3px solid #f4c24a;
  outline-offset: 3px;
}

.verdict {
  margin: 0 0 var(--space-4);
  font-size: 1.3rem;
  font-weight: 800;
}

.verdict.goal {
  color: var(--accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-4);
}
</style>

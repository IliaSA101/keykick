<script setup lang="ts">
/**
 * Чеканка (067 Т19, кадры Э4.27–29, 45): старт · игра · итог на фоне Базы. Ход — движок `engine/base/games/keepy` (мяч падает, буква над ним, три промаха),
 * часы — requestAnimationFrame здесь, снаружи движка; итог — `finishKeepy` (рекорд, счётчик дня). Esc — на Базу: игра не засчитана, попытка дня цела (036-Р5).
 * Первый вход на экран снимает метку «новое» (`markSeen`). Enter — «Играть» и «Ещё раз» (пока есть игры дня).
 */
import { computed, inject, ref, shallowRef } from 'vue';
import { finishKeepy, keepyChar, keepyInZone, keepyIsRecord, keepyKeys, keepyLeft, keepyLives, keepyOver, keepyProgress, keepyRules, type KeepyStand } from '../../app/base/keepy';
import { unitOf, whenText } from '../../app/base/run';
import { fill } from '../../app/home/texts';
import KitPanel from '../../components/kit/KitPanel.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import { fallMs, scoreKeepy, startKeepy, stepKeepy, type KeepyState } from '../../engine/base/games/keepy';
import { ru } from '../../i18n/ru';
import FunEndButtons from '../fun/FunEndButtons.vue';
import FunHead from '../fun/FunHead.vue';
import FunRecord from '../fun/FunRecord.vue';
import { useFunRun } from '../fun/useFunRun';
import KeepyKeys from './KeepyKeys.vue';
import KeepyLives from './KeepyLives.vue';
import KeepyScene from './KeepyScene.vue';
import type { Pose } from './keepyGeo';

const props = defineProps<{ keys: string }>();
const t = ru.base.keepy;
const stand = inject<() => { keepy?: KeepyStand }>('kk-base-stand', () => ({}))().keepy;

const game = shallowRef<KeepyState | null>(null);
const now = ref(0);

function advance(input: { kind: 'tick' } | { kind: 'key'; key: string }): void {
  const s = game.value;
  if (s === null || run.phase.value !== 'play') return;
  const next = stepKeepy(s, input, now.value);
  game.value = next;
  if (next.over) run.finish(scoreKeepy(next));
}
const run = useFunRun({
  id: 'keepy',
  stand,
  charOf: keepyChar,
  deal: (seed, at) => {
    const s = startKeepy({ keys: pool.value }, seed, at);
    game.value = s;
    now.value = at;
    return s.over ? scoreKeepy(s) : null; // выученных букв нет — играть нечем: сразу итог
  },
  tick: (at) => {
    now.value = at;
    advance({ kind: 'tick' });
  },
  press: (ch, at) => {
    now.value = at;
    advance({ kind: 'key', key: ch });
  },
  record: finishKeepy,
});
const { today, phase, end, best, day, bestText, endText, toBase } = run;
const pool = computed(() => keepyKeys(props.keys));

// кадр стенда: партия «замерзла» на нужном ходе
if (stand?.phase === 'play') {
  const s = startKeepy({ keys: keepyKeys(props.keys) }, 7);
  const letter = stand.letter ?? s.letter;
  game.value = { ...s, letter: letter ?? null, touches: stand.touches ?? 0, misses: stand.misses ?? 0, since: -(stand.progress ?? 0.5) * fallMs(stand.touches ?? 0) };
  now.value = 0;
}

const progress = computed(() => (game.value === null ? 0 : keepyProgress(game.value, now.value)));
const inZone = computed(() => game.value !== null && keepyInZone(game.value, now.value));
const pose = computed<Pose>(() => (phase.value === 'start' ? 'stand' : phase.value === 'end' ? (end.value !== null && keepyIsRecord(end.value) ? 'joy' : 'joy1') : (game.value?.touches ?? 0) % 2 === 1 ? 'knee' : 'knee2'));
const misses = computed(() => game.value?.misses ?? 0);

</script>

<template>
  <main class="keepy">
    <KeepyScene
      :pose="pose"
      :letter="phase === 'end' ? null : (game?.letter ?? pool[0] ?? null)"
      :progress="phase === 'start' ? 0 : progress"
      :in-zone="phase === 'play' && inZone"
      :zone="phase === 'play'"
      :sign="phase === 'end' && end !== null && keepyIsRecord(end) ? end.score : null"
    />
    <FunHead
      :name="ru.base.fun.keepy.name"
      :playing="phase === 'play'"
      :ended="phase === 'end'"
      @out="toBase"
    />
    <KitPanel class="side">
      <template v-if="phase === 'start'">
        <h2>{{ ru.base.fun.keepy.name }}</h2>
        <p class="lead">
          {{ t.lead }}
        </p>
        <ul>
          <li
            v-for="r in keepyRules()"
            :key="r"
          >
            {{ r }}
          </li>
        </ul>
        <p class="k">
          {{ t.keys }}
        </p>
        <KeepyKeys :keys="pool" />
        <FunRecord
          :text="bestText"
          :day="day"
        />
        <KeyButton
          primary
          md
          :sub="ru.kit.enter"
          @click="run.begin"
        >
          {{ ru.learn.start.play }}
        </KeyButton>
      </template>
      <template v-else-if="phase === 'play'">
        <p class="k">
          {{ t.score }}
        </p>
        <b class="big">{{ game?.touches ?? 0 }}</b>
        <p class="k">
          {{ t.misses }}
        </p>
        <KeepyLives
          :misses="misses"
          :lives="keepyLives"
        />
        <small>{{ fill(t.missesLeft, { n: keepyLeft(misses) }) }}</small>
        <p class="k">
          {{ ru.learn.end.record }}
        </p>
        <p class="recline">
          {{ best === null ? t.noBestShort : `${best.n} · ${whenText(best.day, today())}` }}
        </p>
        <p class="k">
          {{ t.keys }}
        </p>
        <KeepyKeys :keys="pool" />
      </template>
      <template v-else-if="end">
        <h2>{{ keepyOver() }}</h2>
        <p class="res">
          {{ end.score }} {{ unitOf('keepy', end.score) }}
        </p>
        <p
          v-if="keepyIsRecord(end)"
          class="new"
        >
          {{ ru.result.record.badge }}
        </p>
        <small>{{ endText }}</small>
        <FunEndButtons
          :left="end.left"
          @again="run.begin"
          @out="toBase"
        />
      </template>
    </KitPanel>
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640, как кадры Э4.27–29, 45 */
.keepy { position: absolute; inset: 0; overflow: hidden; }
.side { position: absolute; left: 16px; top: 96px; bottom: 42px; width: 250px; box-sizing: border-box; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.side > .k:first-child { margin-top: 0; }
h2 { margin: 0 0 4px; font-size: 22px; line-height: 1.2; }
p { margin: 0; }
.lead { font-size: 15px; line-height: 1.35; }
ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.35; }
.k { font-size: 15px; color: var(--text-muted); margin-top: 6px; }
small { font-size: 12px; color: var(--text-muted); }
.big { font-size: 56px; line-height: 1; margin-bottom: -4px; }
.recline { font-size: 22px; font-weight: 800; margin-top: 4px; }
.res { font-size: 24px; font-weight: 800; white-space: nowrap; }
.new { font-size: 18px; font-weight: 800; color: #8ff0b4; }
</style>

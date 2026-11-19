<script setup lang="ts">
/**
 * Вратарь ФЫВА ОЛДЖ (067 Т20, кадры Э4.37–40): старт · игра · итог. Ход — движок `engine/base/games/keeper` (8 секторов = клавиши ряда, мяч в открытый сектор,
 * серия из 20 ударов, счёт — сейвы); часы — requestAnimationFrame в обвязке `useFunRun`, итог — `finishKeeper` (рекорд — больше сейвов, счётчик дня).
 * Esc — на Базу: серия не засчитана, попытка дня цела (036-Р5). Enter — «Играть» и «Ещё раз» (пока есть игры дня). Первый вход снимает метку «новое».
 */
import { computed, inject, ref, shallowRef } from 'vue';
import { finishKeeper, keeperChar, keeperDemo, keeperFlight, keeperResults, keeperShots, type KeeperStand } from '../../app/base/keeper';
import { clubOf, isRecord, lessonLetters, seriesPips, strikerText as strikerOf } from '../../app/base/play';
import { fill } from '../../app/home/texts';
import KeyCap from '../../components/kit/KeyCap.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import { rivalBodyOf } from '../../engine/club/rival';
import { rivalOf } from '../../engine/cup/teams';
import { scoreKeeper, sectors, startKeeper, stepKeeper, type KeeperState } from '../../engine/base/games/keeper';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import FunEndTail from '../fun/FunEndTail.vue';
import FunHead from '../fun/FunHead.vue';
import FunStart from '../fun/FunStart.vue';
import { useFunRun } from '../fun/useFunRun';
import KeeperScene from './KeeperScene.vue';
import { PANEL_W } from './keeperGeo';

const props = defineProps<{ keys: string; lesson: number }>();
const t = ru.base.keeper;
const stand = inject<() => { keeper?: KeeperStand }>('kk-base-stand', () => ({}))().keeper;

const pool = computed(() => lessonLetters(props.keys));
const game = shallowRef<KeeperState | null>(null);
const results = ref<boolean[]>(stand?.results ?? []);
const now = ref(0);
/** Прыжок вратаря: сектор отбитого удара, пока длится прыжок (мс часов страницы, `DIVE_MS` после сейва). */
const dive = ref<{ sector: number; until: number } | null>(null);
const DIVE_MS = 450;

function advance(input: { kind: 'tick' } | { kind: 'key'; key: string }, at: number): void {
  const s = game.value;
  if (s === null || run.phase.value !== 'play') return;
  now.value = at;
  const next = stepKeeper(s, input, at);
  results.value = keeperResults(results.value, s, next);
  if (next.saves > s.saves) dive.value = { sector: secs.value.findIndex((x) => x.key === s.cur), until: at + DIVE_MS };
  game.value = next;
  if (next.over) run.finish(scoreKeeper(next));
}
const run = useFunRun({
  id: 'keeper',
  stand,
  charOf: keeperChar,
  deal: (seed, at) => {
    const s = startKeeper({ keys: pool.value }, seed, at);
    game.value = s;
    results.value = [];
    dive.value = null;
    now.value = at;
    return s.over ? scoreKeeper(s) : null; // выученных клавиш ряда нет — играть нечем: сразу итог
  },
  tick: (at) => advance({ kind: 'tick' }, at),
  press: (ch, at) => advance({ kind: 'key', key: ch }, at),
  record: finishKeeper,
  endUnit: true,
});
const { sections, phase, end, day, bestText, endText, toBase } = run;
const secs = computed(() => sectors(pool.value));

// кадр стенда: серия «замерзла» на нужном ударе
if (stand?.phase === 'play') {
  const s = startKeeper({ keys: pool.value }, 7);
  const done = stand.results ?? [];
  game.value = { ...s, cur: stand.target ?? s.cur, shot: done.length + 1, saves: done.filter(Boolean).length, since: 0 };
  if (stand.dive === true) dive.value = { sector: secs.value.findIndex((x) => x.key === (stand.target ?? s.cur)), until: Infinity };
}

const target = computed(() => (phase.value === 'play' && game.value?.cur != null ? secs.value.findIndex((x) => x.key === game.value?.cur) : null));
const flight = computed(() => (game.value === null || phase.value !== 'play' ? 0 : stand === undefined ? keeperFlight(game.value, now.value) : stand.flight ?? 0.5));
const diveTo = computed(() => (phase.value === 'play' && dive.value !== null && now.value < dive.value.until ? dive.value.sector : null));
const saves = computed(() => results.value.filter(Boolean).length);
const club = computed(() => clubOf(sections.value));
const aim = computed(() => (target.value === null ? '' : (secs.value[target.value]?.key ?? '').toUpperCase()));
const unitShots = plural(keeperShots, t.shotsUnit);
/** Соперник урока: цвет формы бьющего и подпись «бьёт двор на …» (067-Р231, Р232). */
const rival = computed(() => rivalOf(props.lesson));
const strikerText = computed(() => strikerOf(props.lesson));
const who = computed(() => `${club.value.backName} ${club.value.backNumber}`.toUpperCase());
const pips = computed(() => seriesPips(results.value, keeperShots, phase.value === 'play', 'save'));
const rowText = (from: number, to: number): string => secs.value.slice(from, to).map((x) => x.key.toUpperCase()).join(' ');
const half = secs.value.length / 2;
</script>

<template>
  <main
    class="keeper"
    :style="{ '--pw': PANEL_W }"
  >
    <KeeperScene
      :sectors="secs"
      :target="target"
      :flight="flight"
      :dive-to="diveTo"
      :pose="phase === 'end' ? 'joy' : diveTo !== null ? 'dive' : 'ready'"
      :ours="club.kit.body"
      :rival="rivalBodyOf(rival, club.kit)"
      :who="who"
      :striker="phase !== 'end'"
      :striker-text="strikerText"
      :sign="phase === 'end' && end !== null && isRecord(end) ? end.score : null"
    />
    <FunHead
      :name="ru.base.fun.keeper.name"
      :playing="phase === 'play'"
      :ended="phase === 'end'"
      @out="toBase"
    />
    <div
      v-if="phase === 'start'"
      class="demo"
    >
      <b>{{ t.demo }}</b>
      <span><i
        v-for="s in keeperDemo"
        :key="s.key"
        :class="{ c: !s.open }"
      >{{ s.open ? s.key.toUpperCase() : '×' }}</i></span>
      <small>{{ t.demoTail }}</small>
    </div>

    <KitPanel
      soft
      class="side"
    >
      <FunStart
        v-if="phase === 'start'"
        :title="t.title"
        :best="bestText"
        :day="day"
        @begin="run.begin"
      >
        <p class="lead">
          {{ t.lead }} <b>{{ rowText(0, half) }}</b> {{ t.and }} <b>{{ rowText(half, secs.length) }}</b>.
        </p>
        <p class="lead">
          {{ t.rule }} <b>{{ fill(t.shots, { n: keeperShots, unit: unitShots }) }}</b>{{ t.shotsTail }}
        </p>
      </FunStart>
      <template v-else-if="phase === 'play'">
        <p class="lead">
          {{ fill(t.shot, { n: Math.min(keeperShots, results.length + 1), of: keeperShots }) }}
        </p>
        <b class="big">{{ fill(t.saves, { n: saves }) }}</b>
        <div class="pips">
          <i
            v-for="(c, i) in pips"
            :key="i"
            :class="c"
          />
        </div>
        <p class="lead warn">
          {{ t.aim }} <span class="nw"><KeyCap>{{ aim }}</KeyCap> {{ t.aimTail }}</span>
        </p>
        <small>{{ t.miss }}</small>
      </template>
      <template v-else-if="end">
        <h2>{{ t.over }}</h2>
        <b class="res">{{ fill(t.result, { n: end.score, of: keeperShots }) }}</b>
        <div class="pips">
          <i
            v-for="(c, i) in pips"
            :key="i"
            :class="c"
          />
        </div>
        <FunEndTail
          :end="end"
          :note="endText"
          @again="run.begin"
          @out="toBase"
        />
      </template>
    </KitPanel>
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640, как кадры Э4.37–40; панель — как у Мемори (gamePanel макета) */
.keeper { position: absolute; inset: 0; overflow: hidden; }
.side { position: absolute; right: 16px; top: 96px; bottom: 42px; width: var(--pw); box-sizing: border-box; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; opacity: 0.95; overflow: hidden; }
h2 { margin: 0; font-size: 20px; font-weight: 800; }
p { margin: 0; }
.lead { font-size: 14px; line-height: 1.3; }
.big { font-size: 26px; line-height: 1.1; }
.res { font-size: 22px; }
small { font-size: 12px; color: var(--text-muted); }
.warn { color: #fff; background: rgb(111 216 156 / 0.18); border-radius: 8px; padding: 5px 8px; }
.nw { white-space: nowrap; }
.pips { display: grid; grid-template-columns: repeat(10, 1fr); gap: 4px; }
.pips i { height: 12px; border-radius: 50%; border: 2px solid rgb(255 255 255 / 0.35); }
.pips i.save { background: #6fd89c; border-color: #fff; }
.pips i.miss { background: rgb(255 255 255 / 0.25); border-color: rgb(255 255 255 / 0.5); }
.pips i.now { border-color: #fff; }
.demo { position: absolute; left: 12px; bottom: 46px; width: 210px; box-sizing: border-box; padding: 8px 10px; border-radius: 10px; background: rgb(8 8 20 / 0.7); box-shadow: inset 0 0 0 1px var(--border); display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.demo span { display: flex; gap: 3px; }
.demo i { flex: 1; text-align: center; font-style: normal; font-weight: 800; font-size: 13px; padding: 2px 0; border-radius: 4px; background: #fff; color: #1b3a12; }
.demo i.c { background: #2a2a3a; color: #9a9ac0; }
</style>

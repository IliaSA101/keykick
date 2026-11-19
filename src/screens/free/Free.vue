<script setup lang="ts">
/**
 * Штрафной через стенку (067 Т21, кадры Э4.34–36, 44, 46): старт · игра · итог. Ход — движок `engine/base/games/free` (5 ударов, над воротами слово-мишень из выученных букв,
 * набрал — гол, ошибся или 10 с — мяч в стенку); часы — requestAnimationFrame в обвязке `useFunRun`, итог — `finishFree` (рекорд — голы, при равных меньше время; счётчик дня).
 * Esc — на Базу: серия не засчитана, попытка дня цела (036-Р5). Enter — «Играть» и «Ещё раз» (пока есть игры дня). Первый вход снимает метку «новое».
 * Слова — из словаря курса (`dictionaryOf`); стенка — игроки соперника урока в его цвете (067-Р216).
 */
import { computed, inject, ref, shallowRef } from 'vue';
import { finishFree, freeBestText, freeBoards, freeChar, freeEndNote, freeFlight, freeKeyList, freeResultText, freeResults, freeShots, freeWordBar, freeWordSeconds, type FreeStand } from '../../app/base/free';
import { clubOf, isRecord, lessonLetters, seriesPips } from '../../app/base/play';
import { fill } from '../../app/home/texts';
import { mmss } from '../../app/learn/view';
import { dictionaryOf } from '../../app/match/run';
import KitPanel from '../../components/kit/KitPanel.vue';
import { rivalBodyOf } from '../../engine/club/rival';
import { rivalOf } from '../../engine/cup/teams';
import { scoreFree, startFree, stepFree, timeFree, wordsFor, type FreeState } from '../../engine/base/games/free';
import { ru } from '../../i18n/ru';
import FunEndTail from '../fun/FunEndTail.vue';
import FunHead from '../fun/FunHead.vue';
import FunStart from '../fun/FunStart.vue';
import { useFunRun } from '../fun/useFunRun';
import FreeKeys from './FreeKeys.vue';
import FreePips from './FreePips.vue';
import FreeScene from './FreeScene.vue';
import type { SashaPose } from './freeGeo';

const props = defineProps<{ keys: string; lesson: number }>();
const t = ru.base.free;
const stand = inject<() => { free?: FreeStand }>('kk-base-stand', () => ({}))().free;

const pool = computed(() => lessonLetters(props.keys));
const words = dictionaryOf().words;
const game = shallowRef<FreeState | null>(null);
const results = ref<boolean[]>(stand?.results ?? []);
const now = ref(0);

function advance(input: { kind: 'tick' } | { kind: 'key'; key: string }, at: number): void {
  const s = game.value;
  if (s === null || run.phase.value !== 'play') return;
  const next = stepFree(s, input, at);
  results.value = freeResults(results.value, s, next);
  now.value = at;
  game.value = next;
  if (next.over) run.finish(scoreFree(next));
}
/** Новая серия: слова из курса по зерну. Выученных букв нет — играть нечем: сразу итог. */
function deal(seed: number, at: number): number | null {
  const s = startFree({ keys: pool.value, words }, seed, at);
  game.value = s;
  results.value = [];
  now.value = at;
  return s.over ? scoreFree(s) : null;
}
/** Время серии — целые секунды по часам партии; к записи итога `game` уже конечное состояние. */
const seconds = (): number => (game.value === null ? 0 : timeFree(game.value, now.value));
const run = useFunRun({
  id: 'free',
  stand,
  charOf: freeChar,
  deal,
  tick: (at) => advance({ kind: 'tick' }, at),
  press: (ch, at) => advance({ kind: 'key', key: ch }, at),
  record: (sections, save, score, runId, day) => finishFree(sections, save, score, seconds(), runId, day),
  texts: { best: freeBestText, end: freeEndNote },
});
const { sections, phase, end, best, day, bestText, endText, toBase } = run;

// кадр стенда: серия «замерзла» на нужном ударе (слова и время — из фикстуры, кадр не зависит от зерна)
if (stand?.phase === 'play') {
  const done = stand.results ?? [];
  game.value = { words: stand.words ?? [], shot: done.length, typed: stand.typed ?? 0, goals: done.filter(Boolean).length, startedAt: 0, since: 0, endedAt: null, over: false };
}

/** Мишени на старте: первые слова той серии, что пойдёт в игре (зерно разыграно до старта — `run.nextSeed`, слова раздаст то же зерно; кадр стенда несёт зерно в фикстуре). */
const preview = computed(() => wordsFor(pool.value, run.nextSeed.value, words).slice(0, 3));
const boards = computed(() => (phase.value === 'start' ? preview.value : phase.value === 'play' && game.value !== null ? freeBoards(game.value.words, game.value.shot) : []).map((w) => w.toUpperCase()));
/** Поза Саши: радуется только серия с голами (`score > 0`); без голов на итоге остаётся в позе удара. */
const pose = computed<SashaPose>(() => (phase.value === 'start' ? 'run' : phase.value === 'end' && end.value !== null && end.value.score > 0 ? 'joy' : 'kick'));
/** Отсчёт слова: тонкая полоска под текущей мишенью (067-Р268), только в игре. */
const bar = computed(() => (phase.value === 'play' ? freeWordBar(game.value, now.value) : null));
const typed = computed(() => game.value?.typed ?? 0);
const flight = computed(() => (phase.value === 'play' && game.value !== null ? freeFlight(game.value.typed, game.value.words[game.value.shot]?.length ?? 0) : null));
const goals = computed(() => results.value.filter(Boolean).length);
const club = computed(() => clubOf(sections.value));
const rival = computed(() => rivalBodyOf(rivalOf(props.lesson), club.value.kit));
// табло времени — те же целые секунды, что в итоге (`timeFree`); на кадре стенда время — из фикстуры
const timeText = computed(() => mmss((stand?.time ?? (game.value === null ? 0 : timeFree(game.value, now.value))) * 1000));
const endTime = computed(() => end.value?.t ?? 0);
const pips = computed(() => seriesPips(results.value, freeShots, phase.value === 'play', 'goal'));
const keyList = computed(() => freeKeyList(pool.value));
</script>

<template>
  <main class="free">
    <FunHead
      :name="ru.base.fun.free.name"
      :playing="phase === 'play'"
      :ended="phase === 'end'"
      @out="toBase"
    />
    <div class="row">
      <div class="arena">
        <FreeScene
          :boards="boards"
          :typed="typed"
          :pose="pose"
          :flight="flight"
          :bar="bar"
          :net="phase === 'end' && end !== null && end.score > 0"
          :rival="rival"
          :back="{ name: club.backName.toUpperCase(), num: String(club.backNumber) }"
          :sign="phase === 'end' && end !== null && isRecord(end) ? end.score : null"
          :caption="phase !== 'end'"
        />
      </div>
      <div class="slot">
        <KitPanel
          soft
          class="side"
        >
          <FunStart
            v-if="phase === 'start'"
            :title="ru.base.fun.free.name"
            :best="bestText"
            :day="day"
            @begin="run.begin"
          >
            <p class="lead">
              {{ t.lead }}
            </p>
            <ul>
              <li
                v-for="r in t.rules"
                :key="r"
              >
                {{ fill(r, { n: freeWordSeconds }) }}
              </li>
            </ul>
            <FreeKeys :keys="keyList" />
          </FunStart>
          <template v-else-if="phase === 'play'">
            <p class="k">
              {{ t.shot }}
            </p>
            <b class="big">{{ fill(t.shotOf, { n: Math.min(freeShots, results.length + 1), of: freeShots }) }}</b>
            <FreePips :pips="pips" />
            <p class="k">
              {{ t.goals }}
            </p>
            <p class="num">
              {{ goals }}
            </p>
            <p class="k">
              {{ t.time }}
            </p>
            <p class="num">
              {{ timeText }}
            </p>
            <small>{{ fill(ru.base.memo.record, { v: best === null ? ru.base.keepy.noBestShort : bestText }) }}</small>
            <FreeKeys :keys="keyList" />
          </template>
          <template v-else-if="end">
            <h2>{{ t.over }}</h2>
            <b class="res">{{ freeResultText(end.score, endTime) }}</b>
            <FreePips
              big
              :pips="pips"
            />
            <FunEndTail
              :end="end"
              :note="endText"
              @again="run.begin"
              @out="toBase"
            />
          </template>
        </KitPanel>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640, как кадры Э4.34–36, 44, 46: арена 816 × 480 (на 1024 — 714 × 420), панель справа 262 (на 1920 — 273) и той же высоты */
.free { position: absolute; inset: 0; overflow: hidden; container-type: inline-size; --pw: clamp(262px, calc(262px + (100% - 1024px) * 0.0967), 273px); }
.row { position: absolute; left: 16px; right: 16px; top: 98px; display: flex; gap: 16px; align-items: stretch; }
.arena { flex: 1; min-width: 0; align-self: flex-start; aspect-ratio: 816 / 480; overflow: hidden; border-radius: 18px; box-shadow: inset 0 0 0 1.5px var(--border), 0 10px 22px rgb(0 0 0 / 0.35); }
.slot { position: relative; flex: none; width: var(--pw); }
/* высота панели — не меньше арены (слот растянут по строке); длинный старт (правила, клавиши, рекорд, «Играть») вытягивает панель вниз, арену не трогает — кнопка видна целиком (067 Т22); корень KitPanel — `.card` (absolute) */
.side { inset: 0 0 auto; min-height: 100%; box-sizing: border-box; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; opacity: 0.95; overflow: hidden; }
/* заголовок панели — и свой (итог), и из FunStart (старт): 19 px в одну строку, как в макете */
.side :deep(h2) { margin: 0; font-size: 19px; line-height: 1.15; font-weight: 800; white-space: nowrap; }
/* блок рекорда на старте — без лишнего отступа над подписью (плотнее общего, как на кадре Э4.34) */
.side :deep(.rec .k) { margin-top: 0; }
p { margin: 0; }
.lead { font-size: 14px; line-height: 1.3; }
ul { margin: 0; padding-left: 18px; font-size: 13px; line-height: 1.35; }
.k { font-size: 14px; color: var(--text-muted); }
.big { font-size: 56px; line-height: 1; font-weight: 800; }
.num { font-size: 26px; font-weight: 800; }
.res { font-size: 24px; white-space: nowrap; }
small { font-size: 12px; color: var(--text-muted); }
/* на 1024 панель плотнее (gamePanel макета: `.w1024 .panel.gp`) */
@container (max-width: 1100px) { .side { padding: 12px 14px; gap: 6px; } }
</style>

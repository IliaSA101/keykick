<script setup lang="ts">
/**
 * Мемори формы (067 Т20, кадры Э4.31–33, 49): старт (все карты рубашкой) · игра (нажми клавишу на карте) · итог (окно на фоне Базы). Ход — движок
 * `engine/base/games/memo`, часы — requestAnimationFrame здесь (закрытие несовпавших по времени), итог — `finishMemo` (рекорд = меньше ходов, счётчик дня).
 * Esc — на Базу: игра не засчитана, попытка дня цела (036-Р5). Первый вход снимает метку «новое». Enter — «Играть» и «Ещё раз» (пока есть игры дня).
 */
import { computed, inject, shallowRef } from 'vue';
import { artUrl } from '../../art/assets';
import { finishMemo, memoChar, memoFound, memoKits, memoLook, memoMismatch, memoPairs, type MemoStand } from '../../app/base/memo';
import { clubOf, isRecord, lessonLetters } from '../../app/base/play';
import { unitOf, whenText } from '../../app/base/run';
import { fill } from '../../app/home/texts';
import ShirtView from '../../components/club/ShirtView.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import { scoreMemo, startMemo, stepMemo, type MemoState } from '../../engine/base/games/memo';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import FunEndButtons from '../fun/FunEndButtons.vue';
import FunHead from '../fun/FunHead.vue';
import FunStart from '../fun/FunStart.vue';
import { useFunRun } from '../fun/useFunRun';
import MemoEmblem from './MemoEmblem.vue';
import RecordSign from '../fun/RecordSign.vue';

const props = defineProps<{ keys: string }>();
const t = ru.base.memo;
const k = ru.base.keepy; // общие строки игр на интерес: «рекорда нет», знак, итог
const stand = inject<() => { memo?: MemoStand }>('kk-base-stand', () => ({}))().memo;

const game = shallowRef<MemoState | null>(stand?.state ?? null);

/** Карты старта — рубашкой вверх: раскладка показывается сразу (ни одной формы не видно). */
const deal = (seed: number): MemoState => startMemo({ keys: lessonLetters(props.keys), kits: memoKits(sections.value) }, seed);
const run = useFunRun({
  id: 'memo',
  stand,
  charOf: memoChar,
  deal: (seed) => {
    game.value = deal(seed);
    return null;
  },
  tick: (at) => advance({ kind: 'tick' }, at),
  press: (ch, at) => advance({ kind: 'key', key: ch }, at),
  record: finishMemo,
  endUnit: true,
});
const { sections, today, phase, end, best, day, bestText, endText, toBase } = run;
const club = computed(() => clubOf(sections.value));
if (game.value === null) game.value = deal(stand === undefined ? Date.now() % 2147483647 : 0);

const view = computed(() => game.value as MemoState);
const pairs = computed(() => memoPairs(view.value));
const unit = computed(() => plural(pairs.value.total, t.pairUnit));
const looks = computed(() => Object.fromEntries(view.value.cards.map((c) => [c.kit, memoLook(c.kit, club.value)])));
const found = computed(() => memoFound(view.value, memoKits(sections.value)));

function advance(input: { kind: 'tick' } | { kind: 'key'; key: string }, at: number): void {
  if (phase.value !== 'play') return;
  const next = stepMemo(view.value, input, at);
  game.value = next;
  if (next.done) run.finish(scoreMemo(next));
}

const bg = `url('${artUrl('baseBgBase')}')`;
const recordText = computed(() => fill(t.record, { v: best.value === null ? k.noBestShort : `${best.value.n} · ${whenText(best.value.day, today())}` }));
</script>

<template>
  <main
    class="memo"
    :style="{ backgroundImage: bg }"
  >
    <div class="shade" />
    <FunHead
      :name="ru.base.fun.memo.name"
      :playing="phase === 'play'"
      :ended="phase === 'end'"
      @out="toBase"
    />

    <template v-if="phase !== 'end'">
      <KitPanel
        soft
        class="you"
      >
        <span class="k">{{ ru.match.sides.us }}</span>
        <b>{{ club.name }}</b>
        <span class="back">
          <ShirtView
            :kit="club.kit"
            :back="{ name: club.backName, number: club.backNumber }"
            :label="club.name"
            crop
          />
        </span>
        <span class="k">{{ club.backName }} {{ club.backNumber }}</span>
        <span class="k">{{ fill(t.found, { n: pairs.found }) }}</span>
        <span class="mini">
          <span
            v-for="id in found"
            :key="id"
            class="m"
          >
            <span class="ms"><ShirtView
              :kit="looks[id]?.kit ?? club.kit"
              crop
            /></span>
            <small>{{ looks[id]?.name }}</small>
          </span>
        </span>
      </KitPanel>

      <KitPanel
        soft
        class="board"
      >
        <div
          class="grid"
          :style="{ gridTemplateColumns: `repeat(${Math.ceil(view.cards.length / 2)}, 1fr)` }"
        >
          <div
            v-for="c in view.cards"
            :key="c.key"
            class="mc"
            :class="c.face"
          >
            <template v-if="c.face === 'down'">
              <MemoEmblem class="em" />
              <span class="key">{{ c.key.toUpperCase() }}</span>
            </template>
            <template v-else>
              <i class="ck">{{ c.key.toUpperCase() }}</i>
              <em
                v-if="c.face === 'done'"
                class="ok"
              >{{ t.pair }}</em>
              <span class="sh"><ShirtView
                :kit="looks[c.kit]?.kit ?? club.kit"
                crop
              /></span>
              <span class="nm">{{ looks[c.kit]?.name }}</span>
            </template>
          </div>
        </div>
      </KitPanel>

      <KitPanel
        soft
        class="side"
      >
        <FunStart
          v-if="phase === 'start'"
          :title="t.title"
          :best="bestText"
          :day="day"
          :hint="t.hint"
          @begin="run.begin"
        >
          <p class="lead">
            {{ t.lead }}
          </p>
          <p class="lead">
            <b>{{ fill(t.pairs, { n: pairs.total, unit }) }}</b> {{ t.pairsTail }}
          </p>
        </FunStart>
        <template v-else>
          <b class="big">{{ fill(t.moves, { n: view.moves }) }}</b>
          <p class="lead">
            {{ fill(t.pairsOf, { n: pairs.found, of: pairs.total }) }}
          </p>
          <p
            v-if="memoMismatch(view)"
            class="miss"
          >
            {{ t.miss }}
          </p>
          <small>{{ recordText }}</small>
        </template>
      </KitPanel>
    </template>

    <KitPanel
      v-else-if="end"
      soft
      class="over"
    >
      <h2>{{ t.over }}</h2>
      <p class="res">
        {{ end.score }} {{ unitOf('memo', end.score) }}
      </p>
      <div class="row">
        <span
          v-for="id in found"
          :key="id"
          class="m"
        >
          <span class="ms"><ShirtView
            :kit="looks[id]?.kit ?? club.kit"
            crop
          /></span>
          <small>{{ looks[id]?.name }}</small>
        </span>
      </div>
      <div
        v-if="isRecord(end)"
        class="rr"
      >
        <RecordSign
          class="sg"
          :n="end.score"
        />
        <b class="new">{{ ru.result.record.badge }}</b>
      </div>
      <small>{{ endText }}</small>
      <div class="btns">
        <FunEndButtons
          :left="end.left"
          @again="run.begin"
          @out="toBase"
        />
      </div>
    </KitPanel>
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640, как кадры Э4.31–33, 49; фон Базы под затемнением 65 % (Р40), панели 85 % (Р39) */
.memo { position: absolute; inset: 0; overflow: hidden; background: #1a1f2a center bottom / auto 125% no-repeat; }
.shade { position: absolute; inset: 0; background: linear-gradient(rgb(12 12 32 / 0.65), rgb(12 12 32 / 0.65)), linear-gradient(rgb(21 20 58 / 0.94) 0 80%, rgb(21 20 58 / 0)) top / 100% 86px no-repeat; }
.you, .board, .side, .over { position: absolute; top: 96px; bottom: 42px; box-sizing: border-box; opacity: 0.95; }
.you { left: 16px; width: 150px; padding: 12px 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; overflow: hidden; }
.you > b { font-size: 16px; }
.back { display: block; width: 113px; margin-top: 2px; }
.mini .ms { width: 39px; }
.k { font-size: 13px; color: var(--text-muted); font-weight: 700; }
.mini { display: flex; flex-wrap: wrap; justify-content: flex-start; align-self: flex-start; margin-left: 12px; gap: 4px; }
.m { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.ms { display: block; width: 48px; }
small { font-size: 11px; color: var(--text-muted); }
.board { left: 180px; right: 244px; padding: 14px; container: memo-board / inline-size; }
.grid { display: grid; grid-template-rows: 1fr 1fr; gap: 12px; height: 100%; }
.mc { position: relative; min-height: 0; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; }
.mc.down { justify-content: flex-end; padding-bottom: 26px; background: repeating-linear-gradient(135deg, rgb(255 255 255 / 0.07) 0 9px, transparent 9px 18px), linear-gradient(160deg, #2c7a45, #1b5a31); box-shadow: inset 0 0 0 3px #ffffff, inset 0 0 0 8px rgb(255 255 255 / 0.18), 0 4px 0 #0f3a1e; }
.em { position: absolute; top: 14px; left: 50%; height: 56px; transform: translateX(-50%); filter: drop-shadow(0 2px 3px #0006); }
.key { font-size: 58px; line-height: 1.2; font-weight: 800; color: #fff; text-shadow: 0 3px 0 #0f3a1e; }
.mc.up, .mc.done { background: #f3f6f0; color: #16301f; box-shadow: inset 0 0 0 3px #6fd89c, 0 4px 0 #1b5a31; }
.mc.up { box-shadow: inset 0 0 0 3px #fff, 0 0 0 3px #6fd89c, 0 4px 0 #1b5a31; }
.ck { position: absolute; left: 7px; top: 6px; font-style: normal; font-size: 13px; font-weight: 800; padding: 0 7px; border-radius: 5px; background: #1b5a31; color: #fff; }
.ok { position: absolute; right: 7px; top: 6px; font-style: normal; font-size: 11px; font-weight: 800; padding: 0 6px; border-radius: 5px; background: #6fd89c; color: #0f3a1e; }
.sh { display: block; width: 76px; }
@container memo-board (min-width: 660px) { .sh { width: 109px; } }
.nm { font-size: 13px; font-weight: 700; }
.side { right: 16px; width: 214px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
h2 { margin: 0; font-size: 20px; font-weight: 800; }
p { margin: 0; }
.lead { font-size: 14px; line-height: 1.3; }
.big { font-size: 26px; line-height: 1.1; }
.miss { font-size: 15px; line-height: 1.3; padding: 8px 10px; border-radius: 10px; background: rgb(255 255 255 / 0.1); }
.over { left: 50%; right: auto; top: 100px; bottom: auto; width: 640px; transform: translateX(-50%); padding: 22px 28px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.over h2 { font-size: 26px; line-height: 1.2; }
.res { font-size: 36px; font-weight: 800; color: #fff; }
.btns { align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 6px; }
.btns > :first-child { align-self: stretch; }
.row { display: flex; gap: 10px; justify-content: center; }
.row .ms { width: 43px; }
.rr { display: flex; align-items: center; gap: 16px; }
.sg { width: 97px; height: auto; flex: none; }
.new { font-size: 26px; font-weight: 800; color: #6fd89c; }
</style>

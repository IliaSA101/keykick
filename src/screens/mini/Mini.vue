<script setup lang="ts">
/**
 * Мини-футбол (067 Т21, кадры Э4.21–25, 42, 43): старт · матч · итог. Ход — движок `engine/base/games/mini` (пас — буква партнёра, удар — Пробел у ворот,
 * отбор мяча по неверной клавише и по часам соперника), часы — requestAnimationFrame в обвязке `useFunRun`; на гол часы стоят `GOAL_PAUSE_MS` (067-Р52).
 * Состав — игроки выученных клавиш, сила — ранг клавиши; соперник — команда урока с её цветами (067-Р239). Старт ставит серию на кон (`beginMini`, 067-Р50);
 * итог — `finishMini` (рекорд — победы подряд, монет нет). Esc — на Базу: матч не засчитан, попытка дня цела (036-Р5). Enter — «Играть» и «Ещё раз».
 */
import { computed, inject, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { clubOf, isRecord, lessonLetters } from '../../app/base/play';
import { clockAt, finishMini, freezeClock, freshClock, lineupOf, matchLeft, matchLength, miniChar, miniEvent, miniRanks, miniResult, pauseOf, scoreMini, startMatch, tacticKey, tacticsOf, type MiniEvent, type MiniStand } from '../../app/base/mini';
import { fill, rivalName } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { ENTER_DELAY } from '../../components/panel/focusCycle';
import KeyCap from '../../components/kit/KeyCap.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import { shooter, startMini, stepMini, teamSize, type MiniState } from '../../engine/base/games/mini';
import { rivalBodyOf } from '../../engine/club/rival';
import { shirtInk } from '../../engine/club/paint';
import { rivalOf } from '../../engine/cup/teams';
import { stadiumView } from '../../engine/home/stadium';
import { ru } from '../../i18n/ru';
import FunEndButtons from '../fun/FunEndButtons.vue';
import FunHead from '../fun/FunHead.vue';
import FunStart from '../fun/FunStart.vue';
import RecordSign from '../fun/RecordSign.vue';
import { useFunRun } from '../fun/useFunRun';
import MiniField from './MiniField.vue';
import MiniScore from './MiniScore.vue';
import TacticPick from './TacticPick.vue';

const props = defineProps<{ keys: string; lesson: number }>();
const t = ru.base.mini;
const k = ru.base.keepy;
const stand = inject<() => { mini?: MiniStand }>('kk-base-stand', () => ({}))().mini;
const { input } = useHomeInput();

const letters = computed(() => lessonLetters(props.keys));
const game = shallowRef<MiniState | null>(stand?.state ?? null);
const now = ref(stand?.now ?? 0);
const event = ref<MiniEvent | null>(null);
/** Часы матча с заморозкой на гол (067-Р52): арифметика — в `app/base/mini`. */
let clock = freshClock();
/** Выбор тактики перед матчем (067-Р22): открыт, пока ребёнок выбирает; выбор помним до выхода с экрана (в сохранение не пишем). Зерно и время открытия — для «На матч». */
const picking = ref(stand?.pick ?? false);
const picked = ref<string | null>(null);
let pendingSeed = 0;
let pickedAt = 0;

function advance(inp: { kind: 'tick' } | { kind: 'key'; key: string }, real: number): void {
  const s = game.value;
  if (s === null || run.phase.value !== 'play') return;
  const { at, frozen } = clockAt(clock, real);
  if (frozen) return;
  now.value = at;
  const next = stepMini(s, inp, at);
  const ev = miniEvent(s, next);
  if (ev !== null) event.value = ev;
  else if (inp.kind === 'key') event.value = null;
  clock = freezeClock(clock, real, pauseOf(ev));
  game.value = next;
  if (next.over) run.finish(scoreMini(next));
}
const run = useFunRun({
  id: 'mini',
  stand,
  charOf: miniChar,
  deal: (seed, at) => {
    if (openIds.value.length === 0 || new Set(letters.value).size < 2) return launch(seed, at); // тактик нет — обычный старт
    pendingSeed = seed;
    pickedAt = at;
    game.value = null;
    event.value = null;
    picking.value = true;
    return null;
  },
  tick: (at) => advance({ kind: 'tick' }, at),
  press: (ch, at) => advance({ kind: 'key', key: ch }, at),
  record: finishMini,
});
const { session, sections, phase, end, best, day, bestText, endText, toBase } = run;

/** Тактики, открытые турами «Школы»; выбранная — ребёнка, а если её нет среди открытых, первая открытая. */
const openIds = computed(() => tacticsOf(sections.value));
const selected = computed(() => (picked.value !== null && openIds.value.includes(picked.value) ? picked.value : (openIds.value[0] ?? '')));

/** Начало матча: серия ставится на кон (067-Р50), состав и тактика — в движок; `number` — партия кончилась, не начавшись. */
function launch(seed: number, at: number): number | null {
  const streak = startMatch(sections.value, (patch) => (session.status.value === 'ok' ? session.save(patch) : { ok: false }));
  const tactic = selected.value === '' ? null : selected.value;
  game.value = startMini({ keys: letters.value, cur: props.lesson, ranks: miniRanks(sections.value, letters.value), streak, tactic }, seed, at);
  now.value = at;
  event.value = null;
  clock = freshClock();
  return game.value.over ? 0 : null; // выученных клавиш на команду нет — играть нечем: сразу итог без серии
}
/** «На матч»: выбор закрыт, матч начинается на часах страницы сейчас; повторное нажатие ничего не делает. */
function goMatch(): void {
  if (!picking.value) return;
  picking.value = false;
  const over = launch(pendingSeed, run.clock());
  if (over !== null) run.finish(over);
}
/** Клавиши выбора: стрелки и цифры — тактика, Enter — «На матч» (не раньше `ENTER_DELAY` после открытия: тот же Enter, что начал игру, не в счёт), Esc — у обвязки. */
function onPickKey(e: KeyboardEvent): void {
  if (!picking.value || e.defaultPrevented) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!e.repeat && e.timeStamp - pickedAt >= ENTER_DELAY) goMatch();
    return;
  }
  const next = tacticKey(openIds.value, selected.value, e.key);
  if (next === null) return;
  e.preventDefault();
  picked.value = next;
}
onMounted(() => globalThis.addEventListener('keydown', onPickKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onPickKey));

const club = computed(() => clubOf(sections.value));
const size = computed(() => teamSize(props.lesson));
/** Превью старта: состав «как будет» — тот же, что получит матч по зерну `nextSeed` (буквы перемешаны, не первые по списку), мяч у первого. */
const team = computed(() => game.value?.team ?? lineupOf(letters.value, props.lesson, run.nextSeed.value));
const holder = computed(() => game.value?.holder ?? 0);
const atGoal = computed(() => phase.value === 'play' && game.value !== null && shooter(game.value) !== null);
const stadium = computed(() => (input.value ? stadiumView(input.value) : null));
const built = computed(() => stadium.value?.built ?? 0);
const gold = computed(() => stadium.value?.golds.includes(1) ?? false);
const rival = computed(() => rivalOf(props.lesson));
const rivalColor = computed(() => rivalBodyOf(rival.value, club.value.kit));
const ink = computed(() => shirtInk({ pattern: 'plain', body: club.value.kit.body, sleeves: club.value.kit.body, trim: club.value.kit.body }).fill);
/** Идёт матч — размер из состава матча, иначе по уроку (на старте и итоге они совпадают). */
const sizeNow = computed(() => game.value?.team.length ?? size.value);
const sizeText = computed(() => `${sizeNow.value}×${sizeNow.value}`);
const title = computed(() => `${ru.base.fun.mini.name} ${sizeText.value}`);
const foeName = computed(() => rivalName(rival.value.street));
const score = computed(() => `${game.value?.us ?? 0} : ${game.value?.them ?? 0}`);
const partners = computed(() => team.value.filter((_, i) => i !== holder.value));
const hint = computed(() => (event.value !== null ? t.events[event.value] : atGoal.value ? t.atGoal : t.hint));
const carrierKey = computed(() => (team.value[holder.value] ?? '').toUpperCase());
const recordText = computed(() => fill(ru.base.memo.record, { v: best.value === null ? k.noBestShort : bestText.value }));
const result = computed(() => (game.value === null ? 'lose' : miniResult(game.value)));
/** Заголовок итога: победа и ничья — общие слова результата, «Не повезло» — из макета (Э4.24). */
const resultTitle = computed(() => (result.value === 'win' ? ru.result.title.win : result.value === 'draw' ? ru.result.title.draw : t.result.lose));
const streakNow = computed(() => end.value?.score ?? 0);
</script>

<template>
  <main class="mini">
    <FunHead
      :name="title"
      :playing="phase === 'play' && !picking"
      :ended="phase === 'end'"
      @out="toBase"
    />

    <TacticPick
      v-if="picking"
      :open="openIds"
      :selected="selected"
      :built="built"
      :gold="gold"
      :ours="club.kit.body"
      :rival="rivalColor"
      @select="picked = $event"
      @go="goMatch"
    />

    <div
      v-else-if="phase === 'start'"
      class="row start"
    >
      <div class="field">
        <MiniField
          meet
          :built="built"
          :gold="gold"
          :team="team"
          :holder="0"
          :zone="false"
          :ours="club.kit.body"
          :ink="ink"
          :rival="rivalColor"
        />
      </div>
      <KitPanel
        soft
        class="side"
      >
        <FunStart
          :title="title"
          :best="bestText"
          :day="day"
          quiet
          @begin="run.begin"
        >
          <p class="lead">
            {{ fill(t.lead, { club: club.name }) }}
          </p>
          <ul class="list">
            <li>
              <KeyCap class="big">
                {{ (team[1] ?? '').toUpperCase() }}
              </KeyCap> — {{ t.pass }}
            </li>
            <li>
              <KeyCap class="big">
                {{ t.space }}
              </KeyCap> — {{ t.shootStart }}
            </li>
            <li>{{ fill(t.rule, { time: matchLength() }) }}</li>
          </ul>
          <p class="keys">
            {{ t.letters }} <KeyCap
              v-for="c in team"
              :key="c"
              class="big"
            >
              {{ c.toUpperCase() }}
            </KeyCap>
          </p>
          <small>{{ fill(t.foe, { rival: foeName }) }}</small>
        </FunStart>
      </KitPanel>
    </div>

    <div
      v-else-if="phase === 'play' && game"
      class="row play"
    >
      <div class="field">
        <MiniField
          :built="built"
          :gold="gold"
          :team="team"
          :holder="holder"
          :zone="atGoal"
          :ours="club.kit.body"
          :ink="ink"
          :rival="rivalColor"
        />
      </div>
      <KitPanel
        soft
        class="side"
      >
        <span class="time">{{ fill(t.time, { time: matchLeft(game, now) }) }}</span>
        <MiniScore
          :ours="club.kit.body"
          :us="club.name"
          :rival="rivalColor"
          :them="foeName"
          :score="score"
        />
        <p class="how">
          {{ t.ballAt[0] }}<b>{{ carrierKey }}</b>{{ t.ballAt[1] }} {{ hint }}
        </p>
        <ul class="list">
          <li>
            <KeyCap
              v-for="c in partners"
              :key="c"
              class="big"
            >
              {{ c.toUpperCase() }}
            </KeyCap> — {{ t.pass }}
          </li>
          <li>
            <KeyCap class="big">
              {{ t.space }}
            </KeyCap> — {{ t.shoot }}
          </li>
        </ul>
        <p class="read">
          <template
            v-for="(line, i) in t.read"
            :key="i"
          >
            {{ line }}<br>
          </template>
        </p>
        <small>{{ recordText }}</small>
      </KitPanel>
    </div>

    <KitPanel
      v-else-if="phase === 'end' && end"
      soft
      class="over"
    >
      <h2>{{ resultTitle }}</h2>
      <MiniScore
        big
        :ours="club.kit.body"
        :us="club.name"
        :rival="rivalColor"
        :them="foeName"
        :score="score"
      />
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
      <p
        v-else
        class="how"
      >
        {{ fill(t.streak, { n: streakNow }) }}
      </p>
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
/* числа — базовые px сцены 1024×640, как кадры Э4.21–25: поле 800×476 слева, панель 289 справа (на 1024 — 262); 100% в --pw — ширина ряда (сцена минус поля 2 × 16 или 2 × 12) */
.mini { position: absolute; inset: 0; overflow: hidden; --pw: clamp(262px, calc(262px + (100% - 1000px) * 0.2552), 289px); }
.row { position: absolute; left: 16px; right: 16px; top: 98px; display: grid; gap: 16px; align-items: stretch; }
.row.play { grid-template-columns: 1fr var(--pw); }
.row.start { grid-template-columns: 524px 1fr; height: 476px; }
.field { aspect-ratio: 800 / 476; overflow: hidden; border-radius: 18px; background: #1f2242; box-shadow: inset 0 0 0 1.5px var(--border), 0 10px 22px rgb(0 0 0 / 0.35); }
.start .field { aspect-ratio: auto; }
.side { position: relative; box-sizing: border-box; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; opacity: 0.95; overflow: hidden; }
h2 { margin: 0; font-size: 20px; font-weight: 800; }
p { margin: 0; }
.lead { font-size: 18px; line-height: 1.35; }
.start .side :deep(h2) { font-size: 26px; }
.start .list { gap: 3px; font-size: 16px; }
.list li { display: flex; align-items: center; gap: 6px; }
.keys { display: flex; align-items: center; gap: 8px; font-size: 17px; }
.keys { margin-top: 4px; }
.keys :deep(kbd) { font-size: 24px; }
.time { font-size: 14px; color: var(--text-muted); }
.how { font-size: 16px; line-height: 1.35; }
.list { margin: 0; padding: 0; list-style: none; display: grid; gap: 8px; font-size: 15px; }
.read { font-size: 13px; line-height: 1.5; color: var(--text-muted); }
small { font-size: 12px; color: var(--text-muted); }
.over { position: absolute; left: 50%; top: 100px; width: 640px; transform: translateX(-50%); box-sizing: border-box; padding: 22px 28px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; opacity: 0.95; }
.over h2 { font-size: 26px; line-height: 1.2; }
.rr { display: flex; align-items: center; gap: 16px; }
.sg { width: 97px; height: auto; flex: none; }
.new { font-size: 26px; font-weight: 800; color: #6fd89c; }
.btns { align-self: stretch; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 6px; }
.btns > :first-child { align-self: stretch; }
@media (max-width: 1100px) { .row { left: 12px; right: 12px; top: 94px; gap: 10px; } .how { font-size: 14px; } .list { font-size: 13px; gap: 6px; } .read { font-size: 12px; } }
</style>

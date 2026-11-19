<script setup lang="ts">
/**
 * Журнал «Школы» (067 Т14, кадры Э3.08–Э3.14): слева эмблема, тактики и «Знаток», справа таблица туров, внизу главная кнопка
 * «Тур N · вид». Класс спрашиваем один раз (`needsGrade`, Э3.08). Esc — Дом, Enter — тур, П — тур-повтор; клик по строке с медалью — пересдача.
 * Данные — раздел `school`, что показывать — `app/school/journal.ts`; запись только класса (`session.save`).
 */
import { computed, inject, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { blockText, matchPlayed, tourGate } from '../../app/school/gate';
import { journalView, needsGrade } from '../../app/school/journal';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import { useStageWidth } from '../../components/home/useStageWidth';
import { isNarrowStage } from '../../components/shell/stageScale';
import ScreenHead from '../../components/league/ScreenHead.vue';
import MedalMark from '../../components/school/MedalMark.vue';
import { emptyDay, type Day } from '../../engine/day/section';
import { homeView } from '../../engine/home';
import { dreamText } from '../../app/home/texts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { emptySchool, type School } from '../../engine/school/section';
import { setGrade } from '../../engine/school/level';
import type { SchoolStand } from '../../app/school/frame';
import GradeAsk from './GradeAsk.vue';
import JournalSide from './JournalSide.vue';

const t = ru.school;
const TABLE_TOP = 96;
const ROW_H = 40;
const asMedal = (m: number): 1 | 2 | 3 => (m === 2 ? 2 : m === 3 ? 3 : 1);
const router = useRouter();
/** Узкая сцена (окно 1024): панель и главная кнопка уже, кнопка двустрочная — кадр Э3.10 (раскладка 316 + 662, не 372 + 720). */
const stageW = useStageWidth();
const narrow = computed(() => isNarrowStage(stageW.value));
const { session, input, data, today } = useHomeInput();
const school = computed<School | null>(() => data<School | null>('school', null));
const view = computed(() => journalView(school.value ?? emptySchool()));
const home = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (home.value ? dreamText(home.value) : null));
const ask = computed(() => needsGrade(school.value));
/** Сеанс не `ok` (вторая вкладка, сбой записи): тур не начинаем — итог некуда записать; причина — в нижней строке. */
const blocked = computed(() => blockText(session.status.value));
/** Тур открывается после первого матча дня (ТЗ-6.1, Ш-З4) и только при записи сеанса — тем же путём, что и экран тура (`tourGate` по разделу `day`). */
const open = computed(() => tourGate(session.status.value, matchPlayed(data<Day>('day', emptyDay()), today())).kind === 'open');
/** Пустой журнал (Э3.13): десять строк и «ещё 2 тура ниже»; дальше — как есть, после сыгранных туров журнал листается. */
const shown = computed(() => view.value.rows.slice(0, view.value.shown));
const below = computed(() => view.value.below);
const belowText = computed(() => fill(t.below, { n: String(below.value), tours: plural(below.value, t.knower.tours) }));
const kindName = (k: string): string => (k === 'repeat' ? t.repeat.row : (t.kinds[k] ?? k));
const medalWord = (m: number): string => t.medal[m] ?? '';
const medalColor = ['#566170', '#8a4a22', '#566170', '#8a6410'];

function saveGrade(g: number): void {
  const cur = school.value ?? emptySchool();
  if (session.status.value === 'ok') session.save({ school: setGrade(cur, g) });
}
function startTour(extra = ''): void {
  if (open.value && !ask.value) void router.push(`/school/tour${extra}`);
}
/** «Реванш» из журнала (Р95): матча дня не ждёт, но запись нужна. */
function startFix(n: number): void {
  if (blocked.value === null && !ask.value) void router.push(`/school/tour?fix=${n}`);
}
/** Нижняя полоса — только когда есть что сказать (Э3.09, Э3.12): повтор ждёт, журнал пуст или тур закрыт; иначе таблица тянется до кнопки. */
const showFoot = computed(() => view.value.due || blocked.value !== null || (school.value?.tours.length ?? 0) === 0);
/** Эмблема собрана — «Ещё тур» вместо «Тур N» (Э3.12); на узкой сцене заголовок короткий, вид уходит в подпись (Э3.10). */
const more = computed(() => view.value.done);
const mainText = computed(() => (narrow.value ? (more.value ? t.mainNarrow : fill(t.pop.tour, { n: String(view.value.nowN) })) : fill(more.value ? t.mainMore : t.main, { n: String(view.value.nowN), kind: kindName(view.value.nowKind) })));
const mainSub = computed(() => (!open.value ? ru.home.afterMatch : narrow.value ? `${kindName(view.value.nowKind)} · ${ru.kit.enter}` : ru.kit.enter));
const aheadText = computed(() => fill(t.ahead, { n: String(view.value.ahead), kinds: plural(view.value.ahead, t.kindsWords) }));

const scroller = ref<HTMLElement | null>(null);
// кадр стенда (только в разработке): над какой строкой стоит карточка; в игре поставщика нет
const stand = inject<() => SchoolStand>('kk-school-stand', () => ({}));
/** Карточка у строки с медалью (Э3.11): номер тура, медаль и верх карточки (px сцены) — стрелка слева на уровне середины строки. */
const pop = ref<{ n: number; medal: number; top: number } | null>(null);
function showPop(e: Event, n: number, medal: number): void {
  const el = e.currentTarget as HTMLElement;
  pop.value = { n, medal, top: TABLE_TOP + el.offsetTop - (scroller.value?.scrollTop ?? 0) + el.offsetHeight / 2 - 50 };
}
function standPop(): void {
  const n = stand().hover;
  const row = n === undefined ? null : view.value.rows.find((r) => r.type === 'tour' && r.n === n && r.medal > 0);
  const el = n === undefined ? null : scroller.value?.querySelector<HTMLElement>(`[data-n="${n}"]`);
  if (row && el) pop.value = { n: row.n, medal: row.medal, top: TABLE_TOP + el.offsetTop - (scroller.value?.scrollTop ?? 0) + el.offsetHeight / 2 - 50 };
}
/**
 * Журнал прокручен так, чтобы строка «сейчас» и две за ней были в окне, а верх окна лёг на границу строки (Э3.09–12, 14):
 * докрутка вниз до целой строки — внизу остаётся пустой хвост (`tail`), как в макете.
 */
const tail = ref(0);
function toNow(): void {
  const e = scroller.value;
  if (e === null || (school.value?.tours.length ?? 0) === 0) return;
  const max = e.scrollHeight - e.clientHeight - tail.value;
  const target = Math.ceil(max / ROW_H) * ROW_H;
  tail.value = Math.max(0, target - max);
  void nextTick(() => {
    e.scrollTop = target;
    standPop(); // карточка стенда считает верх строки уже по докрученной таблице
  });
}
function onKey(e: KeyboardEvent): void {
  if (ask.value) return;
  if (e.key === 'Escape') void router.push('/home');
  else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) startTour();
  else if (e.code === 'KeyG' && view.value.due) startTour('?repeat=1');
}
onMounted(() => {
  globalThis.addEventListener('keydown', onKey);
  void nextTick(toNow);
});
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <main
    class="school"
    :class="{ narrow }"
  >
    <div class="bg" />
    <ScreenHead
      v-if="home && head"
      :title="`${ru.frame.menu.home} › ${ru.home.houses.school}`"
      :city="`«${data('club', { name: '' }).name}»`"
      :stars="`${home.stars.n}/${home.stars.of}`"
      :fans="home.fans.n"
      :coins="home.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[`${ru.frame.menu.home} · ${ru.kit.esc}`]"
      @chip="router.push('/home')"
    />
    <JournalSide
      :view="view"
      :knower="school?.knower ?? 0"
      :narrow="narrow"
    />

    <div
      class="table"
      :class="{ tall: !showFoot }"
    >
      <div class="th">
        <span>{{ t.table.tour }}</span><span>{{ t.table.kind }}</span><span>{{ t.table.medal }}</span><span>{{ t.table.fixed }}</span><span />
      </div>
      <div
        ref="scroller"
        class="rows"
        :style="{ paddingBottom: `${tail}px` }"
      >
        <div
          v-for="(r, i) in shown"
          :key="i"
          class="tr"
          :data-n="r.n"
          :class="{ rep: r.type === 'repeat', now: r.type === 'now', next: r.type === 'next', link: r.type === 'tour' && r.medal > 0 }"
          @click="r.type === 'tour' && r.medal > 0 && startTour(`?retake=${r.n}`)"
          @mouseenter="r.type === 'tour' && r.medal > 0 && showPop($event, r.n, r.medal)"
          @mouseleave="pop = null"
        >
          <b>{{ r.type === 'repeat' ? '↻' : r.n }}</b>
          <span class="nm">
            {{ kindName(r.kind) }}
            <em v-if="r.type === 'now'">{{ open ? ru.paper.strip.cur : ru.home.afterMatch }}</em>
          </span>
          <span
            v-if="r.type === 'tour' && r.medal > 0"
            class="md"
            :style="{ color: medalColor[r.medal] }"
          ><MedalMark
            :medal="asMedal(r.medal)"
            :size="22"
          />{{ medalWord(r.medal) }}</span>
          <span
            v-else-if="r.type === 'tour'"
            class="md none"
          ><svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            aria-hidden="true"
          ><rect
            x="1.4"
            y="1.4"
            width="17.2"
            height="17.2"
            rx="3.4"
            fill="none"
            stroke="#8a8a94"
            stroke-width="1.6"
          /><path
            d="M5.6 10.4l3 3 5.8-6.4"
            fill="none"
            stroke="#8a8a94"
            stroke-width="1.9"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg>{{ t.played }}</span>
          <span
            v-else-if="r.type === 'repeat'"
            class="md none"
          >{{ medalWord(0) }}</span>
          <span v-else />
          <button
            v-if="r.fixN !== null"
            type="button"
            class="rv todo"
            @click.stop="startFix(r.fixN)"
          >
            {{ t.fixedTodo }}
          </button>
          <span
            v-else
            class="rv"
          ><em
            v-if="r.waits"
            class="badge"
          >{{ t.repeat.waits }}</em>{{ r.fixed === 'done' ? t.fixedDone : '' }}</span>
          <span class="end">
            <i v-if="r.tactic">{{ t.tactic }}</i>
          </span>
        </div>
        <div
          v-if="below > 0"
          class="more first"
        >
          {{ belowText }}
        </div>
        <div
          v-else-if="view.ahead > 0"
          class="more"
        >
          {{ aheadText }}
        </div>
      </div>
    </div>

    <KitPanel
      v-if="pop"
      soft
      class="pop tail pop-l"
      :style="{ top: `${pop.top}px` }"
    >
      <p class="lk">
        {{ fill(t.pop.tour, { n: String(pop.n) }) }}
      </p>
      <b class="nm">{{ medalWord(pop.medal) }}</b>
      <p class="where">
        {{ fill(t.pop.same, { medal: t.medalOf[pop.medal] ?? '' }) }}
      </p>
      <p class="arch">
        {{ t.pop.click }}
      </p>
    </KitPanel>
    <KeyButton
      primary
      class="main"
      :state="open ? undefined : 'off'"
      :sub="mainSub"
      @click="startTour()"
    >
      {{ mainText }}
    </KeyButton>
    <div
      v-if="showFoot"
      class="foot"
    >
      <template v-if="view.due">
        <div>
          <b>{{ t.repeat.title }}</b><br>{{ t.repeat.sub }}
        </div>
        <KeyButton
          md
          :sub="t.repeat.key"
          @click="startTour('?repeat=1')"
        >
          {{ t.repeat.button }}
        </KeyButton>
      </template>
      <template v-else>
        {{ blocked ?? t.footer }}
      </template>
    </div>
    <GradeAsk
      v-if="ask"
      @pick="saveGrade"
      @close="router.push('/home')"
    />
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640 (1920 ÷ 1,6875), как кадры Э3.09–Э3.14 */
.school { position: absolute; inset: 0; overflow: hidden; }
.bg { position: absolute; inset: 0; background: linear-gradient(rgb(21 20 58 / 0.6) 0, rgb(21 20 58 / 0.6) 42px, rgb(21 20 58 / 0.4) 110px), url('/art/school/class.webp') center / cover no-repeat; }
.table { position: absolute; left: 402px; right: 16px; top: 96px; height: 452px; display: flex; flex-direction: column; box-sizing: border-box; background: var(--paper); color: var(--paper-text); border: 1px solid var(--paper-border); border-radius: 8px; box-shadow: 0 10px 30px rgb(0 0 0 / 0.5); overflow: hidden; font-size: 16px; }
.table.tall { height: 520px; }
.th, .tr { display: grid; grid-template-columns: 48px minmax(0, 1fr) 140px 112px 76px; align-items: center; box-sizing: border-box; height: 40px; padding: 0 14px 0 10px; border-bottom: 1px solid #ecebf2; flex: none; }
.th { height: 28px; background: var(--paper-note); font-size: 12px; font-weight: 800; letter-spacing: 0.4px; text-transform: uppercase; color: #6b6b76; }
.rows { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.tr b { font-weight: 700; }
.tr .md { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 800; }
.tr .md.none { font-size: 14px; font-weight: 600; color: #6b6b76; }
.rv { font-size: 14px; color: var(--paper-correct); font-weight: 700; }
.rv.todo { justify-self: start; padding: 0; border: 0; background: none; font: inherit; font-weight: 700; color: var(--paper-button); text-decoration: underline; cursor: pointer; }
.tr.rep { background: var(--paper-note); color: #4a4a55; font-size: 15px; }
.tr.now { background: #f4f8ff; box-shadow: inset 4px 0 0 var(--paper-focus); }
.tr.next { color: #7d7d88; }
.tr .nm { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tr .md.none svg { flex: none; }
.rv .badge { margin: 0; }
.tr.link { cursor: pointer; }
.tr.link:hover { background: #eef2fa; }
.tr em { margin-left: 8px; padding: 1px 9px; letter-spacing: 0.3px; border: 1px solid var(--paper-border); border-radius: 999px; background: #fff; font-size: 12px; font-style: normal; font-weight: 800; text-transform: uppercase; color: #4a4a55; }
.end { justify-self: end; }
.end i { padding: 1px 7px; border: 1px solid var(--paper-border); border-radius: 999px; background: #fff; font-size: 11px; font-style: normal; font-weight: 800; color: #4a4a55; }
.more.first { height: 24px; line-height: 24px; }
.more { height: 30px; line-height: 30px; padding-left: 56px; color: #6b6b76; font-size: 14px; }
.pop-l { right: 16px; width: 217px; box-sizing: border-box; }
.pop-l.tail::after { left: -10px; top: 40px; bottom: auto; margin-left: 0; border: 10px solid transparent; border-left: 0; border-right-color: rgb(31 33 82); }
.main { position: absolute; left: 19px; top: 563px; width: 366px; height: 50px; white-space: nowrap; }
.narrow .table, .narrow .foot { left: 346px; }
.narrow .main.primary { width: 310px; padding: 2px 8px; font-size: 26px; line-height: 1.08; }
.narrow .main :deep(small) { font-size: 15px; line-height: 1.1; }
.foot { position: absolute; left: 402px; right: 16px; top: 560px; height: 56px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; border-radius: 12px; background: rgb(31 33 82 / 0.9); box-shadow: inset 0 0 0 1.5px var(--border); font-size: 14px; color: var(--text-muted); }
.foot b { font-size: 16px; color: var(--text); }
</style>

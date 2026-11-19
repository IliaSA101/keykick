<script setup lang="ts">
/**
 * Экран матча (065 Т9, окна — `MatchWindows.vue`, 065-Р78; спека 065 §4 «Матч», кадры Э1.01–Э1.14): вступление → разминка → два тайма с перерывом → свисток.
 * Часы, семя, `matchId` и игровой день — только здесь (движок чистый). Печать идёт через `feed`, окна — через `ui`/`sync`
 * (`app/match/run.ts`), запись — только после свистка (`finishRun`, запрет М3), итог уходит экрану Т10 через `handoff`.
 * Пенальти (065 Т10б): окно с листом задачи (`PenaltyWindow.vue`), ход ответа — `app/match/penaltyFlow.ts`; заплатка Р75 (перерыв — одна кнопка «Второй тайм») осталась до перерыва Т10в.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { comebackLesson, dictionaryOf, buildStart, feed, hold, isWhistle, release, keyEventOf, lessonsOf, startRun, sync, ui, type Run, type UiAction } from '../../app/match/run';
import { quiet, shownOf, type Shown } from '../../app/match/effects';
import { frameRun, type FrameMatch } from '../../app/match/frame';
import { finishRun, matchRead } from '../../app/match/finish';
import { stageOf } from '../../engine/home/yard';
import { emptyStory, storyDef, type Story } from '../../engine/story/section';
import { openPenalty, skipPenalty, submitPenalty, typeInto, type PenaltyFlow } from '../../app/match/penaltyFlow';
import { rivalName } from '../../app/home/texts';
import { tasks } from '../../app/school/tasks';
import { putFinished } from '../../app/match/handoff';
import { matchJournal } from '../../app/journal/app';
import { useMatchBreak } from '../../app/match/breakFlow';
import { usePack } from '../../app/packs/usePack';
import { useSession } from '../../app/save/session';
import RightsCard from '../../components/break/RightsCard.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { soundOn } from '../../components/shell/sound';
import { stageScale } from '../../components/shell/stageScale';
import { rivalKitOf } from '../../engine/club/rival';
import { rivalOf } from '../../engine/cup/teams';
import { emblemKey } from '../../app/cup/groupView';
import { roundOf } from '../../app/cup/run';
import { useCupMatch } from '../../app/cup/useCupMatch';
import CupIntro from '../../components/cup/CupIntro.vue';
import type { RoundKey } from '../../engine/cup';
import { clubDef, type Club } from '../../engine/club/section';
import { ruCourseDef } from '../../engine/course/section';
import { dayDef } from '../../engine/day/section';
import { typedMs } from '../../engine/typing/typing';
import { useMatchWarmup } from '../../app/day/useMatchWarmup';
import Warmup from '../../components/day/Warmup.vue';
import { matchIdOf } from '../../engine/journal';
import { isComeback, type MatchSave, type RunningMatch } from '../../engine/match';
import { pickPenaltyTask, parseTasks, type Task } from '../../engine/school/tasks';
import { correctInput, type AnswerInput } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import BreakLearn from './BreakLearn.vue';
import ComebackBanner from './ComebackBanner.vue';
import MatchScene from './MatchScene.vue';
import MatchWindows from './MatchWindows.vue';
import PenaltyWindow from './PenaltyWindow.vue';
import { seriesView } from './seriesView';
import { litCodes, viewOf, withPenaltySheet, withShow } from './view';
import leagues from '../../content/courses/ru/leagues.json';

/** Кадр стенда (065 К-Г): матч доигран до места по фикстуре, без клавиш, таймеров и записи. */
const props = defineProps<{ frame?: FrameMatch }>();
const t = ru.match;
const router = useRouter();
const session = useSession();
const pack = usePack('ru.yard');
const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
const onResize = (): void => void (win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight });
const width = computed(() => stageScale(win.value.w, win.value.h).width);

const now = (): number => Date.now();
const today = (): string => new Date().toLocaleDateString('sv-SE');

const player = computed(() => (session.player.value.kind === 'ok' ? session.player.value : null));
const sec = <T,>(def: { name: string; empty(): T }): T => (player.value?.env.sections[def.name]?.data as T | undefined) ?? def.empty();
const club = computed<Club>(() => sec(clubDef));

// --- ход матча
const shown = ref<Shown>(quiet());
const run = shallowRef<Run | null>(null);
const started = ref(false);
const newKeys = ref('');
/** Буквы, выученные к уроку матча (`keys` урока): от них зависит, собирается ли учебная игра. */
const lessonKeys = ref('');
const lessonNo = ref(1);
const matchId = ref('');
const finished = ref(false);
/** Возврат после паузы (ТЗ-2.11): в игре — по дню последнего матча, в кадре стенда — из фикстуры. */
const comeback = ref(false);
let timer: ReturnType<typeof globalThis.setInterval> | undefined;

function begin(): void {
  const p = pack.pack.value;
  if (!p || !player.value || run.value) return;
  const count = leagues.find((l) => l.id === 'yard')?.lessons ?? 32;
  const lessons = lessonsOf(p, 'yard', count);
  const cur = sec(ruCourseDef).current;
  const want = router.currentRoute.value.query.lesson; // Карта передаёт выбранный урок (065-Р90); без него — текущий
  const frameLesson = props.frame ? lessons.find((l) => l.n === props.frame?.lesson) : undefined;
  if (props.frame && !frameLesson) throw new Error(`frame: no lesson ${props.frame.lesson}`); // кадр не берёт молча урок 1 (как `frameRun`)
  const picked = frameLesson ?? lessons.find((l) => l.id === want) ?? lessons.find((l) => l.id === cur) ?? lessons[0];
  if (!picked) return;
  const t0 = now();
  const round = props.frame?.cup?.round ?? roundOf(router.currentRoute.value.query.cup);
  if (round !== null) return void beginCup(round, lessons, t0);
  comeback.value = props.frame ? props.frame.banner === 'comeback' : isComeback(sec(dayDef).last, t0);
  const lesson = comeback.value && !props.frame ? comebackLesson(lessons, picked) : picked; // ТЗ-2.11: не строже пройденного
  lessonNo.value = lesson.n;
  newKeys.value = lesson.newKeys;
  lessonKeys.value = lesson.keys;
  matchId.value = matchIdOf(player.value.pid, t0);
  if (props.frame) {
    run.value = frameRun(buildStart(lesson, props.frame.seed, dictionaryOf()), props.frame.spec);
    started.value = props.frame.started;
    shown.value = { ...quiet(), shout: props.frame.shout ?? null };
    if (props.frame.show?.task !== undefined) flow.value = frameFlow(props.frame.show);
  } else run.value = startRun(buildStart(lesson, t0 % 2147483647, dictionaryOf())).run;
  lessonId = lesson.id;
}
let lessonId = '';

/** Матч Кубка (068 Т6): подготовка и свисток — `app/cup/useCupMatch.ts`; здесь только перенос готового в состояние экрана. */
const cup = useCupMatch({ session, router, player, frame: props.frame, today });
const cupInfo = cup.info;
/** Серия ударов после ничьей в плей-офф (Э5.30–.35): сцена показывает её, пока серия не кончилась. */
const seriesUi = cup.series;
function beginCup(round: RoundKey, lessons: ReturnType<typeof lessonsOf>, t0: number): void {
  const prepared = cup.prepare(round, lessons, t0);
  if (prepared === null) return;
  lessonNo.value = prepared.lesson.n;
  newKeys.value = '';
  lessonKeys.value = prepared.lesson.keys;
  matchId.value = prepared.matchId;
  run.value = prepared.run;
  if (props.frame) started.value = props.frame.started;
  lessonId = prepared.lesson.id;
}
/** Лист пенальти на экране: пока он открыт, печати нет, а Enter, Esc и Пробел — его. */
const flow = ref<PenaltyFlow | null>(null);
/** Кадр стенда: лист из фикстуры (задача — id или своя целиком); `verdict` — лист уже после ответа. */
function frameFlow(show: NonNullable<FrameMatch['show']>): PenaltyFlow {
  const raw = show.task;
  const task: Task | undefined = typeof raw === 'string' ? tasks.find((x) => x.id === raw) : parseTasks([raw])[0];
  if (task === undefined) throw new Error(`frame: no task ${typeof raw === 'string' ? raw : 'inline'}`);
  const open = openPenalty(task);
  if (show.verdict === undefined) return open;
  return { ...open, stage: 'done', answer: show.verdict === 'goal' ? 'hit' : 'miss', input: show.verdict === 'goal' ? correctInput(task.answer) : open.input };
}
watch([pack.state, player], begin, { immediate: true });

const state = computed<RunningMatch | null>(() => (run.value && run.value.state.phase !== 'idle' ? run.value.state : null));
const sv = computed(() => (seriesUi.value === null || state.value === null ? null : seriesView(seriesUi.value, viewOf(state.value).score)));
const view = computed(() => {
  if (!state.value) return null;
  const base = withShow(viewOf(state.value), props.frame?.show, state.value.keymap);
  if (sv.value !== null) return { ...sv.value.view, score: base.score };
  // табло матча Кубка: во вступлении справа — чей матч (Э5.23), в доп. времени — раунд (Э5.29)
  const info = cupInfo.value;
  // окно микроразминки перед матчем: табло «Микроразминка · перед матчем» (Э6.43), а не «Разминка · без счёта» матча
  if (!started.value && (warm.open.value || props.frame?.warm !== undefined)) return { ...base, phase: ru.day.act.warmup, detail: ru.day.warm.boardWhen };
  const v = info === null ? base : !started.value ? { ...base, detail: info.board } : state.value.phase === 'extra' ? { ...base, detail: info.boardExtra } : base;
  return flow.value === null ? v : withPenaltySheet(v);
});
const phase = computed(() => state.value?.phase ?? 'idle');

// --- возгласы и звук
let hide: ReturnType<typeof globalThis.setTimeout> | undefined;
function show(s: Shown): void {
  if (s.shout === null && s.bump === null) return;
  shown.value = s;
  globalThis.clearTimeout(hide);
  hide = globalThis.setTimeout(() => void (shown.value = { shout: null, bump: null, sounds: [], penalty: false }), 1600);
}
const play = (files: readonly string[]): void => {
  for (const f of files) void new globalThis.Audio(`${import.meta.env.BASE_URL}art/sfx/${f}`).play().catch(() => undefined);
};

/** Результат шага движка → состояние, звук, авто-пенальти и свисток. */
function apply(out: { run: Run; effects: Parameters<typeof shownOf>[0] }, kicked = false): void {
  run.value = out.run;
  const s = shownOf(out.effects, { warmupEnd: kicked, mute: !soundOn.value });
  show(s);
  play(s.sounds);
  if (out.run.state.phase === 'penalty') {
    // пенальти — одно на матч (М2): задача по зерну матча; лист открывается один раз
    if (flow.value === null) flow.value = openPenalty(pickPenaltyTask(tasks, out.run.start.seed, lessonNo.value));
    return;
  }
  if (isWhistle(out.run) && !finished.value && !holding) finish(out.run);
}

/** Матч стоит на вердикте пенальти (ответ уже ушёл движку): свисток после него ждёт «играем дальше». */
let holding = false;

/** «Ответить» и «Не бить»: движку уходит ровно один ответ (двойной Enter и клик — холостые, `penaltyFlow`). */
function sendPenalty(out: { flow: PenaltyFlow; sent: 'hit' | 'miss' | 'skip' | null }): void {
  const r = run.value;
  flow.value = out.flow;
  if (out.sent === null || !r) return;
  holding = out.sent !== 'skip';
  apply(feed(r, { type: 'penalty', t: now(), answer: out.sent }));
  if (out.sent === 'skip') flow.value = null;
  else if (run.value) run.value = hold(run.value);
}
const answerPenalty = (): void => void (flow.value && sendPenalty(submitPenalty(flow.value)));
const skipShot = (): void => void (flow.value && sendPenalty(skipPenalty(flow.value)));
/** «Играем дальше» (Пробел, Enter, клик) после вердикта: лист закрывается, время идёт, свисток — если пенальти было последним. */
function afterPenalty(): void {
  const f = flow.value;
  if (!f || f.stage !== 'done' || !run.value) return;
  flow.value = null;
  holding = false;
  run.value = release(run.value);
  if (isWhistle(run.value) && !finished.value) finish(run.value);
}
const typeAnswer = (v: AnswerInput): void => void (flow.value && (flow.value = typeInto(flow.value, v)));

function finish(r: Run): void {
  finished.value = true;
  if (cup.whistle(r, { now: now(), matchId: matchId.value, lessonId, lessonNo: lessonNo.value })) return;
  const done = finishRun(r, { now: now(), day: today(), lessonId, matchId: matchId.value, stage: stageOf(lessonNo.value) }, {
    read: (): MatchSave => matchRead(player.value?.env.sections),
    readStory: (): Story => (player.value?.env.sections[storyDef.name]?.data as Story | undefined) ?? emptyStory(),
    save: (patch) => session.save(patch),
    journal: matchJournal(),
  });
  putFinished(done, { lesson: lessonId, no: lessonNo.value, letters: newKeys.value });
  void router.push('/result');
}

function act(action: UiAction): void {
  const before = run.value;
  if (!before) return;
  run.value = sync(before, ui(before, action), now());
}
function closeAll(): void {
  let r = run.value;
  if (!r) return;
  const before = r;
  for (let i = 0; i < 3 && r.overlay !== 'none'; i++) r = ui(r, 'esc');
  run.value = sync(before, r, now());
}
const secondHalf = (): void => {
  if (run.value) apply(feed(run.value, { type: 'half2', t: now() }));
};
/** Перерыв с учебной игрой и «Права на компьютер» (067 Т17, Т18): состояние и «Второй тайм» — `app/match/breakFlow.ts`. */
const { learn, learnOpen, learnSecond, rightsClosed, ownerLine } = useMatchBreak(session, { frame: props.frame, phase, lessonNo, lessonKeys, club, now, day: today, secondHalf });
/** Микроразминка (068-Р69): после «На матч» и в перерыве, если набралось ≈ 20 мин печати; пока окно открыто, матч стоит и клавиши молчат. */
const warm = useMatchWarmup(
  { day: () => sec(dayDef), today, saveDay: (d) => void session.save({ day: d }), halfMs: () => (state.value ? typedMs(state.value.stats) : 0) },
  (spot) => void (spot === 'start' && (started.value = true)),
);
/** «На матч»: пора размяться — окно разминки, матч начнётся после него. */
const start = (): void => void (!warm.offerStart() && (started.value = true));
watch(phase, (p) => void (p === 'break' && !props.frame && warm.offerBreak()));

/** Клавиши листа: Enter — ответить (после ответа — дальше), Пробел после ответа — дальше, Esc — пауза, как во всём матче (065-Р122 «а», ТЗ-2.21); «Не бить» — кнопкой; печать не идёт. */
function penaltyKey(e: KeyboardEvent, f: PenaltyFlow): void {
  const onButton = e.target instanceof HTMLButtonElement && e.target.dataset.act !== undefined;
  if (e.key === 'Escape') {
    e.preventDefault();
    act('esc');
    return;
  }
  if (f.stage === 'done') {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      afterPenalty();
    }
    return;
  }
  if (e.key === 'Enter' && !onButton) {
    e.preventDefault();
    answerPenalty();
  }
}

/** Клавиши серии: печать слова удара идёт в машину серии; Esc — пауза, как во всём матче; запись и выход на итог — в `useCupMatch`. */
function seriesKeyDown(e: KeyboardEvent, r: Run): void {
  if (e.defaultPrevented) return;
  if (e.key === 'Escape') {
    if (r.overlay === 'none') {
      e.preventDefault();
      act('esc');
    }
    return;
  }
  if (r.overlay !== 'none') return;
  const ev = keyEventOf({ code: e.code, key: e.key, repeat: e.repeat, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, caps: e.getModifierState('CapsLock') }, now());
  if (!ev || ev.type !== 'key') return;
  e.preventDefault();
  play(cup.seriesPress(ev, !soundOn.value));
}

function onKey(e: KeyboardEvent): void {
  const r = run.value;
  if (r && seriesUi.value !== null) return seriesKeyDown(e, r);
  if (e.defaultPrevented || !r || finished.value || warm.open.value || learn.entry.value !== null || learn.rights.value !== null) return; // клавиши окна учебной игры и «Прав» — их собственные
  if (flow.value !== null && r.overlay === 'none') {
    penaltyKey(e, flow.value);
    return;
  }
  if (e.key === 'Escape') {
    if (r.overlay === 'none') {
      e.preventDefault();
      act('esc');
    }
    return;
  }
  if (r.overlay !== 'none') return; // у окон свои клавиши (KitModal)
  if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return;
  if (!started.value) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      start();
    }
    return;
  }
  if (phase.value === 'break') {
    if (e.key === 'Enter') secondHalf();
    return;
  }
  const ev = keyEventOf({ code: e.code, key: e.key, repeat: e.repeat, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, caps: e.getModifierState('CapsLock') }, now());
  if (!ev) return;
  e.preventDefault();
  const before = r.state;
  const out = feed(r, ev);
  const kicked = before.phase === 'warmup' && out.run.state.phase !== 'idle' && (out.run.state.phase !== 'warmup' || out.run.state.at !== before.at);
  apply(out, kicked);
}

function tick(): void {
  const r = run.value;
  if (!r || !started.value || warm.open.value || r.overlay !== 'none' || finished.value || phase.value === 'break' || flow.value !== null) return;
  apply(feed(r, { type: 'tick', t: now() }));
}

onMounted(() => {
  globalThis.addEventListener('resize', onResize);
  if (props.frame) return;
  globalThis.addEventListener('keydown', onKey);
  timer = globalThis.setInterval(tick, 250);
});
onUnmounted(() => {
  globalThis.removeEventListener('resize', onResize);
  globalThis.removeEventListener('keydown', onKey);
  globalThis.clearInterval(timer);
  globalThis.clearTimeout(hide);
});

// --- вступление (окна — MatchWindows.vue)
const lessonInfo = computed(() => {
  const s = state.value;
  const text = pack.pack.value?.text.ru?.lessons[s?.lessonId ?? ''];
  return { name: text?.name ?? '', keys: newKeys.value, tip: (text as { tip?: string[] } | undefined)?.tip?.[0] ?? '' };
});
const rival = computed(() => cupInfo.value?.team ?? rivalOf(lessonNo.value));
const rivalTitle = computed(() => {
  const s = rivalName(props.frame?.show?.street ?? rival.value.street);
  return s.charAt(0).toUpperCase() + s.slice(1);
});
/** «двор на Заречной» под именем соперника Кубка (как на макете Э5.25). */
const cupCity = computed(() => rivalName(rival.value.street));
const overlay = computed(() => run.value?.overlay ?? 'none');
</script>

<template>
  <main class="match">
    <template v-if="view && state && run">
      <MatchScene
        :view="view"
        :kit="club.kit"
        :rival-kit="rivalKitOf(rival, club.kit)"
        :us="{ name: club.name || t.sides.us, backName: club.backName, backNumber: club.backNumber }"
        :rival="cupInfo ? { name: cupInfo.team.name, city: cupCity } : { name: rivalTitle, city: club.city }"
        :cup="cupInfo ? { ours: emblemKey('our'), rival: emblemKey(cupInfo.team.id), rivalShort: cupInfo.team.name } : undefined"
        :series="sv?.board"
        :night="cupInfo?.round === 'f'"
        :width="width"
        :layout="flow || learnOpen || (cupInfo && !started) || (!started && (warm.open.value || frame?.warm !== undefined)) ? undefined : state.layout"
        :shout="seriesUi ? seriesUi.shout : shown.shout"
        :bump="shown.bump"
        :lit="started ? [] : litCodes(newKeys, state.keymap, state.layout)"
        :ball="shown.shout === null && !flow"
        :intro="!started"
        @help="act('help')"
      />
      <ShellHeader
        match
        :pause="overlay === 'none' && !learnOpen && !warm.open.value && frame?.warm === undefined"
        @pause="act('pause')"
      />

      <PenaltyWindow
        v-if="flow && overlay === 'none'"
        :flow="flow"
        :total="view.score"
        :scroll-end="frame?.show?.scrollEnd"
        @update:input="typeAnswer"
        @submit="answerPenalty"
        @skip="skipShot"
        @next="afterPenalty"
      />
      <ComebackBanner v-if="comeback && !started && overlay === 'none'" />
      <CupIntro
        v-if="cupInfo && !started && overlay === 'none'"
        :info="cupInfo"
        :club="club.name || t.sides.us"
        @start="start"
        @help="act('help')"
        @home="router.push('/home')"
      />
      <p
        v-if="cupInfo && started"
        class="cupban"
      >
        <template v-if="sv">
          {{ cupInfo.title }}<small>{{ sv.board.ban }}</small>
        </template>
        <template v-else-if="state.phase === 'extra'">
          {{ ru.match.banner.extra }}<small>{{ ru.cup.match.extraNote }}</small>
        </template>
        <template v-else>
          {{ cupInfo.title }}
        </template>
      </p>
      <MatchWindows
        :state="state"
        :overlay="overlay"
        :started="started || cupInfo !== null || warm.open.value || frame?.warm !== undefined"
        :info="lessonInfo"
        :plan="learn.plan.value"
        :after="learn.after.value"
        :covered="warm.open.value || frame?.warm !== undefined"
        @act="act"
        @start="start"
        @second="secondHalf"
        @learn="(id) => void learn.open(id)"
        @close-all="closeAll"
        @home="router.push('/home')"
        @leave="router.push('/map')"
      />
      <BreakLearn
        v-if="learn.entry.value"
        :entry="learn.entry.value"
        :deps="learn.deps"
        :fail="learn.fail.value"
        :kit-body="club.kit.body"
        :rival-body="rivalKitOf(rival, club.kit).body"
        :layout="state.layout"
        @close="learn.close()"
        @second="learnSecond"
        @next="(id) => void learn.open(id)"
        @again="void learn.again()"
        @done="learn.done"
      />
      <Warmup
        v-if="warm.open.value || frame?.warm !== undefined"
        :step="frame?.warm"
        :frozen="frame !== undefined"
        @done="warm.close()"
        @skip="warm.close()"
      />
      <RightsCard
        v-if="learn.rights.value && learn.entry.value === null"
        :card="learn.rights.value.card"
        :fresh="learn.rights.value.fresh"
        :owner="ownerLine"
        @close="rightsClosed"
      />
    </template>
    <p
      v-else-if="pack.state.value === 'loading'"
      class="msg"
    >
      {{ t.loading }}
    </p>
    <div
      v-else-if="pack.state.value !== 'ok'"
      class="msg"
    >
      {{ t.failed }}
      <KeyButton
        primary
        @click="pack.retry()"
      >
        {{ t.again }}
      </KeyButton>
    </div>
  </main>
</template>

<style scoped>
.match { position: absolute; inset: 0; color: var(--text); }
.cupban { position: absolute; left: 50%; transform: translateX(-50%); top: 92px; margin: 0; font-size: 24px; font-weight: 800; white-space: nowrap; color: #fff; text-shadow: 0 2px 6px rgb(0 0 0 / 0.85); pointer-events: none; }
.cupban small { margin-left: 12px; font-size: 18px; font-weight: 700; }
.msg { position: absolute; inset: 0; display: grid; place-content: center; gap: 12px; text-align: center; font-size: 20px; }
</style>

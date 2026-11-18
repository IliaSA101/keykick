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
import { openPenalty, skipPenalty, submitPenalty, typeInto, type PenaltyFlow } from '../../app/match/penaltyFlow';
import { tasks } from '../../app/school/tasks';
import { putFinished } from '../../app/match/handoff';
import { matchJournal } from '../../app/journal/app';
import { usePack } from '../../app/packs/usePack';
import { useSession } from '../../app/save/session';
import KeyButton from '../../components/kit/KeyButton.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { soundOn } from '../../components/shell/sound';
import { stageScale } from '../../components/shell/stageScale';
import { clubDef, type Club, type ClubKit } from '../../engine/club/section';
import { ruCourseDef } from '../../engine/course/section';
import { dayDef } from '../../engine/day/section';
import { streetName, streetOf } from '../../engine/home';
import { isComeback, type MatchSave, type RunningMatch } from '../../engine/match';
import { pickPenaltyTask, parseTasks, type Task } from '../../engine/school/tasks';
import { correctInput, type AnswerInput } from '../../engine/school/answers';
import { ru } from '../../i18n/ru';
import ComebackBanner from './ComebackBanner.vue';
import MatchScene from './MatchScene.vue';
import MatchWindows from './MatchWindows.vue';
import PenaltyWindow from './PenaltyWindow.vue';
import { litCodes, viewOf, withShow } from './view';
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
const rivalKit = (k: ClubKit): ClubKit => ({ pattern: k.pattern, body: '#f28a1c', sleeves: 'split', trim: '#1f1f1f' });

// --- ход матча
const shown = ref<Shown>(quiet());
const run = shallowRef<Run | null>(null);
const started = ref(false);
const newKeys = ref('');
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
  const picked = (props.frame ? lessons.find((l) => l.n === props.frame?.lesson) : (lessons.find((l) => l.id === want) ?? lessons.find((l) => l.id === cur))) ?? lessons[0];
  if (!picked) return;
  const t0 = now();
  comeback.value = props.frame ? props.frame.banner === 'comeback' : isComeback(sec(dayDef).last, t0);
  const lesson = comeback.value && !props.frame ? comebackLesson(lessons, picked) : picked; // ТЗ-2.11: не строже пройденного
  lessonNo.value = lesson.n;
  newKeys.value = lesson.newKeys;
  matchId.value = `m-${player.value.pid}-${t0}`;
  if (props.frame) {
    run.value = frameRun(buildStart(lesson, props.frame.seed, dictionaryOf()), props.frame.spec);
    started.value = props.frame.started;
    shown.value = { ...quiet(), shout: props.frame.shout ?? null };
    if (props.frame.show?.task !== undefined) flow.value = frameFlow(props.frame.show);
  } else run.value = startRun(buildStart(lesson, t0 % 2147483647, dictionaryOf())).run;
  lessonId = lesson.id;
}
let lessonId = '';
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
const view = computed(() => (state.value ? withShow(viewOf(state.value), props.frame?.show, state.value.keymap) : null));
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
  const done = finishRun(r, { now: now(), day: today(), lessonId, matchId: matchId.value }, {
    read: (): MatchSave => matchRead(player.value?.env.sections),
    save: (patch) => session.save(patch),
    journal: matchJournal(),
  });
  putFinished(done, { lesson: lessonId, no: lessonNo.value });
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
const start = (): void => void (started.value = true);

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

function onKey(e: KeyboardEvent): void {
  const r = run.value;
  if (!r || finished.value) return;
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
  if (!r || !started.value || r.overlay !== 'none' || finished.value || phase.value === 'break' || flow.value !== null) return;
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
const NB = ' ';
const lessonInfo = computed(() => {
  const s = state.value;
  const text = pack.pack.value?.text.ru?.lessons[s?.lessonId ?? ''];
  return { name: text?.name ?? '', keys: newKeys.value, tip: (text as { tip?: string[] } | undefined)?.tip?.[0] ?? '' };
});
const rivalName = computed(() => {
  const s = ru.home.rival.replace('{street}', props.frame?.show?.street ?? streetName(streetOf(lessonNo.value))).replace(' ', NB);
  return s.charAt(0).toUpperCase() + s.slice(1);
});
const overlay = computed(() => run.value?.overlay ?? 'none');
</script>

<template>
  <main class="match">
    <template v-if="view && state && run">
      <MatchScene
        :view="view"
        :kit="club.kit"
        :rival-kit="rivalKit(club.kit)"
        :us="{ name: club.name || t.sides.us, backName: club.backName, backNumber: club.backNumber }"
        :rival="{ name: rivalName, city: club.city }"
        :width="width"
        :layout="flow ? undefined : state.layout"
        :shout="shown.shout"
        :bump="shown.bump"
        :lit="started ? [] : litCodes(newKeys, state.keymap, state.layout)"
        :ball="shown.shout === null && !flow"
        :intro="!started"
        @help="act('help')"
      />
      <ShellHeader
        match
        :pause="overlay === 'none'"
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
      <MatchWindows
        :state="state"
        :overlay="overlay"
        :started="started"
        :info="lessonInfo"
        @act="act"
        @start="start"
        @second="secondHalf"
        @close-all="closeAll"
        @home="router.push('/home')"
        @leave="router.push('/map')"
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
.msg { position: absolute; inset: 0; display: grid; place-content: center; gap: 12px; text-align: center; font-size: 20px; }
</style>

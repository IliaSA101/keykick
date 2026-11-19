<script setup lang="ts">
/**
 * Тур «Школы» (067 Т14, Э3.39–Э3.42, Э3.19): лист слева, колонка заданий справа. Ответ — `AnswerField` (`digits` у выбора),
 * Enter — «Ответить» и «Дальше», Esc — выйти из тура (тур не засчитан, перезагрузка начинает его заново). Шаги — `app/school/tour.ts`.
 * Банк пуст (`tourPlan` → null) — экран без тура. Тур начинается только при `session.status === 'ok'` и после матча дня (`tourGate`);
 * `?fix=n` — «Реванш» из журнала по `miss` записи (067-Р95): без матча дня, тур не пишется, в конце — назад в журнал.
 * Сбой записи не молчит (`saveFail`). Enter после эталона — не раньше чем через 300 мс (двойной Enter не пролетает «Дальше»).
 */
import { computed, inject, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { frameRun, type SchoolStand } from '../../app/school/frame';
import { matchPlayed, saveFail, tourGate } from '../../app/school/gate';
import { tasks } from '../../app/school/tasks';
import { useTourKeys } from '../../app/school/useTourKeys';
import { artUrl } from '../../art/assets';
import { canRetake, coachHint, journalFixRun, settleRun, nextRun, openRun, startFix, submitFix, submitRun, trainerPath, type TourRun } from '../../app/school/tour';
import KitChip from '../../components/kit/KitChip.vue';
import MedalSteps from '../../components/school/MedalSteps.vue';
import { enterAllowed } from '../../components/panel/focusCycle';
import TaskAnswer from '../../components/school/TaskAnswer.vue';
import NumberStrip, { type StripMark } from '../../components/paper/NumberStrip.vue';
import { keysOf } from '../../components/paper/paper';
import { seedFromText } from '../../engine/school/answers';
import { emptyDay, type Day } from '../../engine/day/section';
import type { Wallet } from '../../engine/rewards/section';
import { emptyStadium, type Stadium } from '../../engine/home/section';
import { emptySchool, type School } from '../../engine/school/section';
import { stageOf } from '../../engine/home';
import { lettersLearned } from '../../engine/school/level';
import { REPEAT_KIND, skipTrainer } from '../../engine/school/order';
import { tourPlan } from '../../engine/school/tour';
import { ru } from '../../i18n/ru';
import EmblemFest from './EmblemFest.vue';
import TourResult from './TourResult.vue';
import TrainerCard from './TrainerCard.vue';

const t = ru.school.tour;
const route = useRoute();
const router = useRouter();
const { session, data, pack, input, today, trainers } = useHomeInput();
// кадр стенда (только в разработке): на каком шаге открыт тур; в игре поставщика нет
const stand = inject<() => SchoolStand>('kk-school-stand', () => ({}));
const day = (): Day => data<Day>('day', emptyDay());
const school = (): School => data<School>('school', emptySchool());
/** Номер тура для «Реванша» из журнала (`?fix=n`); обычный тур — null. */
const fixN = route.query.fix === undefined ? null : Number(route.query.fix);
/** Вход в тур: матч дня — по разделу `day` (не по входу Дома: без пакета он null); «Реванш» из журнала и кадры стенда матча не ждут. */
const gate = computed(() => tourGate(session.status.value, fixN !== null || stand().tour !== undefined || matchPlayed(day(), today())));
/** Отказ записи: что сказать ребёнку; null — запись легла. */
const fail = ref<string | null>(null);
const persist = (patch: Record<string, unknown>): void => void (fail.value = saveFail(session.save(patch)));

/** Выученные буквы: ступени пакета до ступени текущего урока. Пакета нет (сеть) — пусто: слов-ответов в туре не будет (Ш-З6). */
const letters = (): string => {
  const stages = pack.pack.value?.lessons.stages ?? [];
  return lettersLearned(stages, stageOf(input.value?.cur ?? 1));
};

/** Тур дня одним семенем: перезагрузка даёт тот же тур, пока запись не легла (`sid` меняется после итога). */
function plan(): TourRun | null {
  if (gate.value.kind !== 'open') return null;
  const s = school();
  if (fixN !== null) {
    const entry = s.tours.find((e) => e.n === fixN && e.kind !== REPEAT_KIND);
    return entry === undefined ? null : journalFixRun(entry, tasks);
  }
  const retake = route.query.retake === undefined ? undefined : Number(route.query.retake);
  const repeat = route.query.repeat !== undefined;
  const seed = seedFromText(`${today()}:${retake ?? ''}${repeat ? 'r' : ''}`);
  const tour = tourPlan(s, tasks, s.grade, seed, { ...(retake === undefined ? {} : { retake }), repeat, letters: letters(), trainerDone: trainers() });
  if (tour === null) return null;
  const frame = stand().tour;
  return frame === undefined ? openRun(tour) : frameRun(tour, frame, tasks);
}
// тур строим, когда пакет ответил (буквы нужны плану): «загрузка» — пустой экран, «нет пакета» — тур без слов
const ready = ref(false);
const run = ref<TourRun | null>(null);
watch(() => pack.state.value, (st) => {
  if (st === 'loading' || ready.value) return;
  ready.value = true;
  run.value = plan();
  if (run.value === null && fixN !== null && gate.value.kind === 'open') void router.replace('/school'); // записи или задач для «Реванша» нет
  if (run.value?.stage === 'result') settle(); // кадр итога (стенд): запись и вид итога — как после последней задачи
}, { immediate: true });
const task = computed(() => (run.value?.stage === 'etalon' ? run.value.missed?.task : run.value?.tour.tasks[run.value.stage === 'fix' ? (run.value.fixIdx ?? 0) : run.value.tour.i]));
const retakeOk = computed(() => run.value !== null && canRetake(school(), run.value.tour));
const kindName = computed(() => ru.school.kinds[run.value?.tour.kind === 'repeat' ? 'mixed' : (run.value?.tour.kind ?? '')] ?? '');
const marks = computed<StripMark[]>(() => (run.value?.tour.tasks ?? []).map((_, i) => (i < (run.value?.tour.i ?? 0) ? (run.value?.tour.firsts[i] ? 'ok' : 'bad') : '')));
const cur = computed(() => (run.value === null ? 0 : run.value.stage === 'ask' ? run.value.tour.i + 1 : run.value.stage === 'etalon' ? run.value.tour.i : 0));
/** Лист по центру с полосой номеров и порогами: после неверного ответа (эталон) и под окном итога. */
const wide = computed(() => run.value?.stage === 'etalon' || run.value?.stage === 'result' || run.value?.stage === 'trainer');
const digits = computed(() => ['choice', 'multi', 'pictures'].includes(task.value?.answer.kind ?? ''));
const coach = computed(() => (run.value ? coachHint(run.value) : null));
const hintText = computed(() => (run.value?.hint ? ru.paper.hint[run.value.hint] : ''));
const rightCount = computed(() => (run.value?.tour.firsts ?? []).filter(Boolean).length);

/** Тур кончился: итог пишем один раз (кассу зовёт `app/school/tour.ts`); вторая вкладка и отказ записи — итог только на экране. */
function settle(): void {
  if (run.value === null || run.value.stage !== 'result') return;
  const out = settleRun(run.value, { wallet: data<Wallet>('wallet', { coins: 0, rest: 0, paid: [] }), school: school(), stadium: data<Stadium>('stadium', emptyStadium()) }, today());
  run.value = out.run;
  if (out.school !== null) persist({ school: out.school });
}
/** Эталон показан в этот момент (часы страницы): «Дальше» не раньше чем через `NEXT_DELAY`. */
let etalonAt = globalThis.performance.now();
const NEXT_DELAY = 300;
function act(): void {
  const r = run.value;
  if (r === null) return;
  if (r.stage === 'etalon' && !enterAllowed({ repeat: false, openedAt: etalonAt, now: globalThis.performance.now(), delay: NEXT_DELAY })) return;
  if (r.stage === 'ask') run.value = submitRun(r);
  else if (r.stage === 'etalon') run.value = nextRun(r);
  else if (r.stage === 'fix') fix();
  else if (r.stage === 'trainer') startTrainer(); // Enter — главная кнопка карточки «Тренажёр» (Э3.18); «Пропустить» — мышью или Tab
  if (run.value?.stage === 'etalon' && r.stage !== 'etalon') etalonAt = globalThis.performance.now();
  settle();
  if (run.value?.journal && run.value.stage === 'result') void router.push('/school'); // «Реванш» из журнала кончился
}
function fix(): void {
  if (run.value === null) return;
  const out = submitFix(run.value, school());
  run.value = out.run;
  if (out.school !== school()) persist({ school: out.school });
}
function skip(): void {
  const r = run.value;
  if (r === null || r.tour.trainer === null) return;
  persist({ school: skipTrainer(school(), r.tour.trainer) });
  run.value = plan();
}
/** «Тренажёр»: игра вида — окно учебной игры над Базой (`trainerPath`, Р202). */
function startTrainer(): void {
  const path = run.value?.tour.trainer == null ? null : trainerPath(run.value.tour.trainer);
  if (path !== null) void router.push(path);
}
/** Праздник эмблемы (Э3.24): итог с десятой частью — «Дальше» ведёт сперва на праздник, потом в журнал (Р79). */
const fest = ref(stand().fest === true);
function afterResult(): void {
  if (run.value?.view?.emblemDone === true && !fest.value) fest.value = true;
  else void router.push('/school');
}
function again(): void {
  const r = run.value;
  if (r === null || !canRetake(school(), r.tour)) return; // пересдать можно только тур из журнала
  void router.replace(`/school/tour?retake=${r.tour.n}&t=${Date.now()}`).then(() => (run.value = plan()));
}
useTourKeys({
  esc: () => void router.push('/school'),
  active: () => run.value !== null && run.value.stage !== 'result',
  act,
});
</script>

<template>
  <main class="tour">
    <div class="bg" />
    <div class="kb-head">
      <h1>{{ run ? fill(t.head, { n: String(run.tour.n), kind: kindName }) : ru.home.houses.school }}</h1>
      <div class="kb-stats">
        <KitChip
          data-act="exit"
          @click="router.push('/school')"
        >
          {{ t.exit }} <kbd>{{ ru.kit.esc }}</kbd>
        </KitChip>
      </div>
    </div>
    <p
      v-if="ready && run === null"
      class="none"
      role="status"
    >
      {{ gate.kind === 'blocked' ? gate.text : gate.kind === 'afterMatch' ? t.afterMatch : t.none }}
    </p>
    <template v-else-if="run">
      <section
        v-if="!fest"
        class="sheet"
        :class="wide ? 'mid' : 'left'"
      >
        <div
          v-if="wide && run.stage !== 'trainer'"
          class="strip"
        >
          <NumberStrip
            :marks="marks"
            :cur="0"
          />
          <MedalSteps :size="run.tour.tasks.length" />
        </div>
        <TrainerCard
          v-if="run.stage === 'trainer'"
          :kind="run.tour.trainer ?? ''"
          :n="run.tour.n"
          @start="startTrainer"
          @skip="skip"
        />
        <template v-else-if="task && run.stage !== 'result'">
          <div class="zad">
            {{ fill(t.task, { n: String(run.stage === 'etalon' ? run.tour.i : run.stage === 'fix' ? (run.fixIdx ?? 0) + 1 : run.tour.i + 1) }) }}
          </div>
          <div class="kind">
            {{ ru.paper.kind[task.answer.kind === 'fraction' && task.answer.mixed ? 'mixed' : task.answer.kind] }}
          </div>
          <TaskAnswer
            :run="run"
            :task="task"
            :digits="digits"
            @update:run="run = $event"
          />
          <p
            v-if="fail"
            class="warn"
            role="alert"
          >
            {{ fail }}
          </p>
          <p
            v-if="hintText"
            class="warn"
            role="status"
          >
            {{ hintText }}
          </p>
          <p
            v-if="run.stage === 'etalon'"
            class="miss"
          >
            {{ t.miss }}
          </p>
        </template>
        <div
          v-if="run.stage !== 'trainer' && run.stage !== 'result'"
          class="ans"
        >
          <button
            type="button"
            class="go"
            data-act="act"
            @click="act"
          >
            {{ run.stage === 'etalon' ? ru.result.next : ru.paper.go }} <kbd>{{ ru.kit.enter }}</kbd>
          </button>
          <span
            v-if="task && run.stage === 'ask'"
            class="note"
          >{{ keysOf(task.answer.kind, digits) }}</span>
        </div>
      </section>
      <aside
        v-if="!wide && !fest"
        class="card panel soft col"
      >
        <h2>{{ fill(t.side, { n: String(run.tour.n) }) }}</h2>
        <div class="coach">
          <template v-if="coach">
            <img
              :src="artUrl('coachFace')"
              :alt="ru.kit.coachName"
            >
            <span>{{ coach }}</span>
          </template>
        </div>
        <p>{{ fill(t.right, { n: String(rightCount), of: String(run.tour.tasks.length) }) }}</p>
        <MedalSteps
          bar
          :size="run.tour.tasks.length"
          :right="rightCount"
        />
        <NumberStrip
          :marks="marks"
          :cur="cur"
        />
      </aside>
      <TourResult
        v-if="run.stage === 'result' && run.view && !fest"
        :view="run.view"
        :emblem="school().emblem"
        :n="run.tour.n"
        :kind="run.tour.kind === 'repeat' ? 'mixed' : run.tour.kind"
        :marks="run.tour.firsts"
        :can-fix="run.view.missed.length > 0 && run.tour.fixed.length < run.view.missed.length"
        :can-retake="retakeOk"
        :repeat="run.tour.repeat"
        :last="run.last"
        :fail="fail ?? ''"
        @next="afterResult"
        @retake="again"
        @fix="run = startFix(run as TourRun)"
      />
      <EmblemFest
        v-if="fest"
        @home="router.push('/home')"
        @close="router.push('/school')"
      />
    </template>
  </main>
</template>

<style scoped>
.tour { position: absolute; inset: 0; overflow: hidden; container-type: inline-size; }
.bg { position: absolute; inset: 0; background: linear-gradient(rgb(21 20 58 / 0.6) 0, rgb(21 20 58 / 0.6) 42px, rgb(21 20 58 / 0.4) 110px), url('/art/school/class.webp') center / cover no-repeat; }
.none { position: absolute; left: 16px; top: 120px; }
/* лист: пока решают — слева с колонкой справа (Э3.39–42), после неверного — по центру, номера и пороги над ним (Э3.19) */
.sheet { display: flex; flex-direction: column; overflow-y: auto; padding: 14px 24px 16px; }
/* колонка справа — 340 px на 1920 (ширина сцены 1138), 270 на 1024 (Э3.39/Э3.40): лист занимает остаток, ничто не выходит за край */
.sheet.left { left: 16px; top: 96px; width: calc(100% - 386px); height: 472px; }
.sheet.mid { left: 159px; top: 100px; width: 820px; height: 472px; }
.sheet.mid:has(.card-trainer) { height: auto; align-self: flex-start; }
.strip { display: flex; align-items: center; justify-content: space-between; }
.ans { margin-top: auto; padding-top: 14px; }
.ans button { border: 0; font-family: inherit; cursor: pointer; }
.ans button:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
.zad { font-size: 13px; font-weight: 800; }
.kind { color: #6b6b76; font-size: 14px; }
.warn { color: var(--paper-wrong); font-weight: 700; }
.miss { padding: 10px 14px; border-radius: 8px; background: #fdeaea; color: var(--paper-wrong); font-weight: 800; }
.col { position: absolute; right: 16px; top: 96px; width: 340px; height: 520px; box-sizing: border-box; }
@container (max-width: 1100px) {
  .sheet.left { width: calc(100% - 316px); }
  .col { width: 270px; }
}
.col h2 { margin: 0 0 8px; font-size: 13px; color: var(--text-muted); }
.col p { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
.col :deep(.nums) { flex-direction: column; }
/* реплика тренера у задачи с `hint` (Э3.39, 067-Р109 пересмотр): место 64 px занято всегда, чтобы колонка не прыгала */
.coach { display: flex; gap: 10px; align-items: center; height: 64px; flex: none; margin-bottom: 12px; text-align: left; }
.coach img { flex: none; width: 64px; height: 64px; border-radius: 50%; border: 2px solid #fff; box-sizing: border-box; object-fit: cover; }
.coach span { font-size: 14px; font-weight: 700; line-height: 1.3; }
</style>

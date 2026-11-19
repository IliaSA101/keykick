<script setup lang="ts">
/**
 * «Штрафные» (067 Т16, Э3.17, ТЗ-6.14, К-Б): звено цепочки после остальных матчей дня — 3 задачи знакомых видов, верные с первой
 * попытки идут в «Знатока», монет и журнала нет. Enter — «Ответить» и «Дальше после эталона»; кнопка «Дальше» пропускает звено
 * (ничего не пишется), Esc — Дом (звено вернётся в следующий заход). Задач нет или тур уже сдан — звено пропускается.
 * Шаги ответа — `app/school/tour.ts`, итог — `app/school/kicks.ts` (касса). Сбой записи не молчит (`saveFail`).
 */
import { computed, inject, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { chainNext, chainSave, endChain, escChain, schoolOpenOf } from '../../app/result/chain';
import { frameRun, type SchoolStand } from '../../app/school/frame';
import { saveFail } from '../../app/school/gate';
import { kicksEntry, kicksRun, settleKicks } from '../../app/school/kicks';
import { tasks } from '../../app/school/tasks';
import { useTourKeys } from '../../app/school/useTourKeys';
import { nextRun, submitRun, type TourRun } from '../../app/school/tour';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitChip from '../../components/kit/KitChip.vue';
import KitModal from '../../components/panel/KitModal.vue';
import { enterAllowed } from '../../components/panel/focusCycle';
import TaskAnswer from '../../components/school/TaskAnswer.vue';
import NumberStrip, { type StripMark } from '../../components/paper/NumberStrip.vue';
import { keysOf } from '../../components/paper/paper';
import { albumDef, type Album } from '../../engine/album/section';
import { dayDef, type Day } from '../../engine/day/section';
import { stageOf } from '../../engine/home';
import { emptyStadium, type Stadium } from '../../engine/home/section';
import type { Wallet } from '../../engine/rewards/section';
import { lettersLearned } from '../../engine/school/level';
import { schoolDef, type School } from '../../engine/school/section';
import { ru } from '../../i18n/ru';

const t = ru.school.kicks;
const router = useRouter();
const { session, data, pack, input, today, trainers } = useHomeInput();
const school = (): School => data<School>(schoolDef.name, schoolDef.empty());
const stand = inject<() => SchoolStand>('kk-school-stand', () => ({}));
const day = (): Day => data<Day>(dayDef.name, dayDef.empty());
const matchN = (): number => day().todayN;
const wallet = (): Wallet => data<Wallet>('wallet', { coins: 0, rest: 0, paid: [] });

/** Куда после звена: следующее звено цепочки или её цель. */
function leave(): void {
  const album = data<Album>(albumDef.name, albumDef.empty());
  const next = chainNext(chainSave(album, day(), school(), today(), trainers()), schoolOpenOf(input.value), 'kicks', globalThis.Date.now());
  void router.replace(next === null ? endChain() : next.path);
}

const run = ref<TourRun | null>(null);
/** Прибавлено к «Знатоку» на итоге; null — тур ещё идёт. */
const gained = ref<number | null>(null);
const fail = ref<string | null>(null);
const letters = (): string => lettersLearned(pack.pack.value?.lessons.stages ?? [], stageOf(input.value?.cur ?? 1));

// тур строим, когда пакет ответил (буквы нужны плану); сеанс не `ok` — записать некуда, звено пропускаем
const ready = ref(false);
watch(() => pack.state.value, (st) => {
  if (st === 'loading' || ready.value) return;
  ready.value = true;
  const d = day();
  if (kicksEntry(session.status.value === 'ok', wallet(), today(), d.todayN) === 'skip') return leave();
  const fresh = kicksRun(school(), tasks, today(), d.todayN, letters());
  const frame = stand().tour; // кадр стенда (Э3.17): часть задач уже сдана
  run.value = fresh !== null && frame !== undefined ? frameRun(fresh.tour, frame, tasks) : fresh;
  if (run.value === null) leave(); // задач нет — звено пропускается (kicksPlan вернул null)
}, { immediate: true });

const task = computed(() => (run.value?.stage === 'etalon' ? run.value.missed?.task : run.value?.tour.tasks[run.value.tour.i]));
const size = computed(() => run.value?.tour.tasks.length ?? 0);
const marks = computed<StripMark[]>(() => (run.value?.tour.tasks ?? []).map((_, i) => (i < (run.value?.tour.i ?? 0) ? (run.value?.tour.firsts[i] ? 'ok' : 'bad') : '')));
const cur = computed(() => (run.value === null ? 0 : run.value.stage === 'ask' ? run.value.tour.i + 1 : 0));
const digits = computed(() => ['choice', 'multi', 'pictures'].includes(task.value?.answer.kind ?? ''));
const hintText = computed(() => (run.value?.hint ? ru.paper.hint[run.value.hint] : ''));
/** «Второго», «третьего»…: слово как на кадре Э3.17; дальше десятого — число (Р145). */
const nth = computed(() => t.nth[matchN() - 2] ?? fill(t.nthN, { n: String(matchN()) }));
const num = computed(() => (run.value?.stage === 'etalon' ? run.value.tour.i : (run.value?.tour.i ?? 0) + 1));

/** Тур сдан: «Знаток» пишем один раз (касса помнит метку тура); отказ записи — причина на экране, итог всё равно виден. */
function settle(): void {
  if (run.value === null || gained.value !== null) return;
  const out = settleKicks(run.value, { wallet: wallet(), school: school(), stadium: data<Stadium>('stadium', emptyStadium()) }, today());
  if (out === null) return;
  gained.value = out.knower;
  fail.value = saveFail(session.save(out.patch)); // и при 0 верных: метка тура в кошельке не даёт повторить задачи (Р120)
}
let etalonAt = globalThis.performance.now();
const NEXT_DELAY = 300;
function act(): void {
  const r = run.value;
  if (r === null || gained.value !== null) return;
  if (r.stage === 'etalon' && !enterAllowed({ repeat: false, openedAt: etalonAt, now: globalThis.performance.now(), delay: NEXT_DELAY })) return;
  if (r.stage === 'ask') run.value = submitRun(r);
  else if (r.stage === 'etalon') run.value = nextRun(r);
  if (run.value?.stage === 'etalon' && r.stage !== 'etalon') etalonAt = globalThis.performance.now();
  settle();
}
useTourKeys({
  esc: () => { if (gained.value === null) void router.push(escChain()); },
  active: () => run.value !== null && gained.value === null,
  act,
});
</script>

<template>
  <main class="kicks">
    <div class="bg" />
    <div class="kb-head">
      <h1>{{ ru.home.houses.school }} <span>· {{ fill(t.sub, { nth }) }}</span></h1>
      <div class="kb-stats">
        <KitChip
          data-act="exit"
          @click="router.push(escChain())"
        >
          {{ ru.match.pause.quit }} <kbd>{{ ru.kit.esc }}</kbd>
        </KitChip>
      </div>
    </div>
    <section
      v-if="run && task"
      class="sheet"
    >
      <NumberStrip
        :marks="marks"
        :cur="cur"
      />
      <div class="zad">
        {{ fill(t.task, { n: String(num), of: String(size) }) }}
      </div>
      <div class="kind">
        {{ ru.paper.kind[task.answer.kind === 'fraction' && task.answer.mixed ? 'mixed' : task.answer.kind] }} {{ t.known }}
      </div>
      <TaskAnswer
        :run="run"
        :task="task"
        :digits="digits"
        @update:run="run = $event"
      />
      <p
        v-if="hintText"
        class="warn"
        role="status"
      >
        {{ hintText }}
      </p>
      <div class="ans">
        <button
          type="button"
          class="go"
          data-act="act"
          @click="act"
        >
          {{ run.stage === 'etalon' ? ru.result.next : ru.paper.go }} <kbd>{{ ru.kit.enter }}</kbd>
        </button>
        <span
          v-if="run.stage === 'ask'"
          class="note"
        >{{ keysOf(task.answer.kind, digits) }}</span>
        <span class="gain">{{ t.gain }}</span>
        <button
          type="button"
          class="skip"
          data-act="skip"
          @click="leave"
        >
          {{ ru.result.next }}
        </button>
      </div>
    </section>
    <KitModal
      v-if="gained !== null"
      :title="t.doneTitle"
      :lead="gained > 0 ? fill(ru.school.result.knower, { n: String(gained) }) : t.doneNone"
      :width="480"
      :top="200"
      :enter-delay="300"
      @close="leave"
    >
      <p
        v-if="fail"
        class="warn"
        role="alert"
      >
        {{ fail }}
      </p>
      <template #buttons>
        <KeyButton
          primary
          :sub="ru.kit.enter"
          @click="leave"
        >
          {{ ru.result.next }}
        </KeyButton>
      </template>
    </KitModal>
  </main>
</template>

<style scoped>
.kicks { position: absolute; inset: 0; overflow: hidden; }
.bg { position: absolute; inset: 0; background: linear-gradient(rgb(21 20 58 / 0.6) 0, rgb(21 20 58 / 0.6) 42px, rgb(21 20 58 / 0.4) 110px), url('/art/school/class.webp') center / cover no-repeat; }
/* лист по центру, как у итога тура (Э3.17): номера над ним, под ним — «Ответить», «+1 к Знатоку» и «Дальше» (пропуск) */
.sheet { position: absolute; left: 159px; top: 100px; width: 820px; max-height: 420px; display: flex; flex-direction: column; overflow-y: auto; padding: 14px 24px 16px; }
.zad { margin-top: 10px; font-size: 13px; font-weight: 800; }
.kind { color: #6b6b76; font-size: 14px; }
.warn { color: var(--paper-wrong); font-weight: 700; }
.ans { display: flex; align-items: center; gap: 14px; padding-top: 14px; }
.ans button { border: 0; font-family: inherit; cursor: pointer; }
.ans button:focus-visible { outline: 3px solid var(--paper-focus); outline-offset: 2px; }
.gain { margin-left: auto; font-weight: 800; }
.skip { background: none; color: inherit; text-decoration: underline; }
</style>

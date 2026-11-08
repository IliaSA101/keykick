<script setup lang="ts">
/*
 * Экран матча v2 (спека 017, Т6): показывает `MatchView` и отдаёт действия наружу (design §10); состояние
 * матча держит движок (`engine/match/machine`), связку и таймеры — `app/match/flow`.
 * Ввод — с клавиатуры всего окна: ребёнку не нужно никуда кликать перед печатью.
 * Фазы: вступление (Пробел/Enter) → разминка → тайм (печать, Esc — пауза) → перерыв (Enter) → пенальти
 * (задача, «Не бить» только кнопкой) → доп. время → минута тренера → итог (слот `result`, Т7). Итог открывается
 * после `screenDelay.shotMs` с ударом на поле, перерыв закрывает один Enter и не сразу (017-Р27).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import HandsView from '../../components/HandsView.vue';
import KeyboardView from '../../components/KeyboardView.vue';
import MatchPitch from '../../components/MatchPitch.vue';
import AttackText from '../../components/match/AttackText.vue';
import CoachMinute from '../../components/match/CoachMinute.vue';
import type { MatchContext } from '../../components/match/context';
import MatchBreak from '../../components/match/MatchBreak.vue';
import MatchIntro from '../../components/match/MatchIntro.vue';
import MatchKick from '../../components/match/MatchKick.vue';
import MatchPause from '../../components/match/MatchPause.vue';
import MatchStatus from '../../components/match/MatchStatus.vue';
import { captionOf } from '../../components/match/labels';
import { keymap } from '../../app/keymap';
import { shiftFor } from '../../engine/keymap';
import type { AttackOutcome } from '../../engine/match/score';
import { guardOpen, holdsResult, screenDelay, type MatchView } from '../../engine/match/view';
import { expectedHit, expectedThumb, type KeyPress } from '../../engine/typing';
import { ru } from '../../i18n/ru';

const props = defineProps<{ view: MatchView; ctx: MatchContext }>();
const emit = defineEmits<{
  start: [];
  press: [press: KeyPress];
  kickAnswer: [result: 'scored' | 'missed'];
  skipKick: [];
  toSecondHalf: [];
  pause: [];
  resume: [];
  quit: [];
}>();

const t = ru.match2;

const v = computed(() => props.view);
const typing = computed(() => (v.value.phase === 'kick' ? null : v.value.typing));
const printing = computed(() => ['warmup', 'half1', 'half2', 'extra', 'coach'].includes(v.value.phase) && !v.value.paused);

const caption = computed(() => captionOf(v.value));

// Удар по воротам по итогу атаки: показываем 1,4 с и гасим (переход к следующей атаке не ждёт).
const shot = ref<AttackOutcome | null>(null);
const shotNo = ref(0);
let shotTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
watch(
  () => v.value.lastOutcome,
  (o) => {
    globalThis.clearTimeout(shotTimer);
    if (!o) return void (shot.value = null);
    shot.value = o.outcome;
    shotNo.value += 1;
    shotTimer = globalThis.setTimeout(() => (shot.value = null), screenDelay.shotMs);
  },
);

// Итог сразу после последней атаки: пока `resultHeld`, на экране поле с ударом, а не слот итога (017-Р27).
const resultHeld = ref(false);
// Удар пенальти уже сыгран на листе, но движку ответ уйдёт по «играем дальше»: табло показывает гол сразу (017-Р32).
const kickShown = ref<'scored' | 'missed' | null>(null);
const kickBonus = computed(() => (v.value.phase === 'kick' && kickShown.value === 'scored' ? 1 : 0));
const breakAt = ref(0);
// Пауза вне печати (итог, перерыв, пенальти): движок её не знает, это окно поверх экрана (017-Р54).
const menuPause = ref(false);
let holdTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
watch(
  () => v.value.phase,
  (to, from) => {
    globalThis.clearTimeout(holdTimer);
    resultHeld.value = holdsResult(from, to);
    if (resultHeld.value) holdTimer = globalThis.setTimeout(() => (resultHeld.value = false), screenDelay.shotMs);
    if (to === 'break') breakAt.value = globalThis.performance.now();
    if (to !== 'kick') kickShown.value = null;
    menuPause.value = false;
  },
  { immediate: true },
);
const showResult = computed(() => v.value.phase === 'result' && !resultHeld.value);

// Пенальти без задачи (устаревший id в сохранении): решать нечего, играем дальше сами.
watch(
  () => v.value.phase === 'kick' && !props.ctx.kickTask,
  (stuck) => stuck && emit('skipKick'),
  { immediate: true, flush: 'post' },
);

// Клавиша, палец и большой — как в v1: подсветка ведёт руки к следующему знаку строки.
const hit = computed(() => (printing.value && typing.value ? expectedHit(keymap, typing.value) : null));
const target = computed(() => hit.value?.key ?? null);
const thumb = computed(() => (printing.value && typing.value ? expectedThumb(keymap, typing.value) : null));
const shiftFinger = computed(() => (hit.value?.shift && hit.value.key ? (keymap.byCode.get(shiftFor(hit.value.key.finger))?.finger ?? null) : null));

// Клавиатура, руки и строка статуса — только там, где печатают: на пенальти (лист), перерыве и итоге их нет (017-Р29).
const typingUi = computed(() => !['kick', 'break', 'result'].includes(v.value.phase));

/** Кнопки сработают сами (Enter, Пробел): окно их нажатие не повторяет. */
const onButton = (e: KeyboardEvent): boolean => e.target instanceof HTMLButtonElement;

/** Перерыв: только Enter и не сразу после входа в фазу — лишний Пробел или Enter не пролистывает счёт (017-Р27). */
function onBreakKey(e: KeyboardEvent): void {
  if (e.code !== 'Enter' || onButton(e) || e.repeat) return;
  e.preventDefault();
  if (guardOpen(breakAt.value, globalThis.performance.now(), screenDelay.breakMs)) emit('toSecondHalf');
}

/** «Продолжить»: окно вне печати закрывается у себя, печатная пауза — через движок. */
function onResume(): void {
  if (v.value.paused) emit('resume');
  else menuPause.value = false;
}

/**
 * Пока открыто окно паузы вне печати, итог, перерыв и пенальти клавиш не видят (их слушатели — на окне): ловим
 * раньше всех, закрываем по Enter и Esc сами, Tab пропускаем в ловушку окна. Enter на кнопке сработает сам.
 */
function shield(e: KeyboardEvent): void {
  if (!menuPause.value || e.code === 'Tab') return;
  e.stopPropagation();
  if (e.code === 'Escape' || (e.code === 'Enter' && !onButton(e))) {
    e.preventDefault();
    if (!e.repeat) menuPause.value = false;
  }
}

function onKey(e: KeyboardEvent): void {
  const x = v.value;
  if (x.phase === 'quit') return;
  if (!x.paused && ['result', 'break', 'kick'].includes(x.phase)) {
    // Esc открывает «Паузу» и здесь (ТЗ-0.16, 017-Р54); дальше — свои клавиши перерыва.
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) menuPause.value = true;
    } else if (x.phase === 'break') onBreakKey(e);
    return;
  }
  const go = e.code === 'Space' || e.code === 'Enter';
  if (x.paused) {
    // Пауза: Enter и Esc — назад в ту же фазу; «Выйти» — только кнопкой.
    if ((e.code === 'Enter' && !onButton(e)) || e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) emit('resume');
    }
    return;
  }
  if (x.phase === 'intro') {
    if (go && !onButton(e) && !e.repeat) {
      e.preventDefault();
      emit('start');
    }
    return;
  }
  if (e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) emit('pause');
    return;
  }
  const press: KeyPress = {
    code: e.code,
    key: e.key,
    repeat: e.repeat,
    mod: e.ctrlKey || e.altKey || e.metaKey,
    caps: e.getModifierState('CapsLock'),
    time: e.timeStamp,
  };
  // Печатный символ не должен листать страницу (пробел) или открывать поиск (/ и ' в Firefox).
  if (!press.mod && [...e.key].length === 1) e.preventDefault();
  emit('press', press);
}

onMounted(() => {
  globalThis.addEventListener('keydown', shield, true);
  globalThis.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', shield, true);
  globalThis.removeEventListener('keydown', onKey);
  globalThis.clearTimeout(shotTimer);
  globalThis.clearTimeout(holdTimer);
});
</script>

<template>
  <div
    v-if="showResult"
    class="result"
  >
    <slot
      name="result"
      :view="view"
    >
      <p>{{ t.result.fallback }}: {{ view.score.typed + view.score.kick }} : {{ view.score.conceded }}</p>
    </slot>
    <MatchPause
      v-if="menuPause"
      fixed
      done
      @resume="onResume"
      @quit="emit('quit')"
    />
  </div>
  <div
    v-else-if="view.phase !== 'quit'"
    class="match"
  >
    <div class="column">
      <MatchPitch
        :us="ctx.usName"
        :rival="ctx.rivalName"
        :us-kit="ctx.usKit"
        :rival-kit="ctx.rivalKit"
        :goals="view.score.typed + view.score.kick + kickBonus"
        :conceded="view.score.conceded"
        :penalties="view.score.kick + kickBonus"
        :caption="caption"
        :decisive="view.decisive"
        :clock="null"
        :shot="shot"
        :shot-id="String(shotNo)"
      >
        <MatchIntro
          v-if="view.phase === 'intro'"
          :lesson-name="ctx.lessonName"
          :new-keys="ctx.newKeys"
          :tip="ctx.tip"
          :g="ctx.g"
          :c="ctx.c"
          :comeback="ctx.comeback ?? false"
          :softened="ctx.softened ?? false"
          @start="emit('start')"
        />
        <MatchBreak
          v-else-if="view.phase === 'break'"
          :us="ctx.usName"
          :rival="ctx.rivalName"
          :goals="(view.firstScore?.typed ?? 0) + (view.firstScore?.kick ?? 0)"
          :conceded="view.firstScore?.conceded ?? 0"
          :continue2="view.banner === 'continue2'"
          @next="emit('toSecondHalf')"
        />
        <MatchKick
          v-else-if="view.phase === 'kick' && ctx.kickTask"
          :task="ctx.kickTask"
          @answer="(r) => emit('kickAnswer', r)"
          @shown="(r) => (kickShown = r)"
          @skip="emit('skipKick')"
        />
        <CoachMinute
          v-else-if="view.phase === 'coach' && view.coach && typing"
          :keys="view.coach.keys"
          :left-ms="view.coach.leftMs"
          :total-ms="ctx.coachMs"
          :typing="typing"
          :rows="view.rows"
          :row="view.row"
        />
        <AttackText
          v-else-if="typing"
          :typing="typing"
          :rows="view.rows"
          :row="view.row"
        />
      </MatchPitch>

      <MatchStatus
        v-if="typingUi"
        :view="view"
        :printing="printing"
        :typing="typing"
        :target="target"
        :thumb="thumb"
      />

      <div
        v-if="typingUi"
        class="board"
      >
        <KeyboardView
          :target="target"
          :thumb="thumb"
          :shift="hit?.shift ?? false"
          :error="typing?.last === 'error'"
          :errors="typing?.stats.errors ?? 0"
          :layout="ctx.layout"
        />
        <div class="hands">
          <HandsView
            :finger="target?.finger ?? null"
            :thumb="thumb"
            :shift-finger="shiftFinger"
          />
        </div>
      </div>

      <MatchPause
        v-if="view.paused || menuPause"
        :fixed="menuPause"
        @resume="onResume"
        @quit="emit('quit')"
      />
    </div>
  </div>
</template>

<style scoped>
/*
 * Размеры — окна 1024×640: клавиатура 760, строка 2rem и поле 230 (TypingLine, MatchPitch).
 * На больших окнах матч растёт целиком, одним множителем (App.vue, app/viewport), — отдельные
 * части здесь не растут.
 */
.match {
  --board-w: 760px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: var(--space-3);
}
/* Низкое окно (1024×640, 017-Р29): клавиатура уже — подсказка решающей серии в две строки влезает без прокрутки. */
@media (max-height: 700px) { .match { --board-w: 680px; } }

/* Колонка матча: поле, подсказка, клавиатура. Пауза — поверх неё. */
.column {
  flex: 0 1 calc(var(--board-w) + 60px);
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/*
 * Руки поверх клавиатуры: та же ширина, тот же верх и шкала (HandsView), указательные и средние —
 * над основным рядом. Картинка полупрозрачная, чтобы буквы под пальцами читались; метки — нет.
 */
.board {
  position: relative;
  max-width: var(--board-w);
  width: 100%;
  margin: 0 auto;
  /* Запас под ногти больших пальцев (они ниже пробела); что ниже — обрезается, а не растит страницу. */
  padding-bottom: 30px;
  overflow: hidden;
}

.hands {
  position: absolute;
  inset: 0 0 auto;
  --hands-opacity: 0.35; /* руки на основном ряду закрывают буквы — прозрачнее (017-Т3) */
  pointer-events: none;
}
</style>

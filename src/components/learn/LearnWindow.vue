<script setup lang="ts">
/**
 * Окно учебной игры 1–4 (067 Т17, макет Э8): над перерывом матча и над Базой. Три шага — старт, игра, итог. Свой слой и свой keydown
 * (не `KitModal`: он перехватывает Tab, а Tab — ввод игры). Enter/Esc — как в модалке, Enter после смены шага ждёт `ENTER_DELAY`.
 * Окно забирает фокус на главную кнопку при открытии и смене шага (как `KitModal`); свои клавиши не пускает дальше (`stopPropagation`: Esc закрывает только окно).
 * «Ещё раз» — через родителя (`again`): он пересчитывает «до игры» и ставку по свежим разделам.
 * Сеанс — `app/learn/run.ts`: «Играть» → `beginLearn`, конец игры → один раз `commitLearn` (если дан `deps`). Часы — `frozenNow` (стенд) или страница.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { gameIcon } from '../break/gameIcon';
import { beginLearn, commitLearn, inputLearn, isFormsPlay, playOf, type CommitDeps, type GameInput, type LearnFlow } from '../../app/learn/run';
import { ARENA_ASPECT, endLadder, endOf, endPrimary, gameName, keyAction, leadOf, missOf, mmss, playLadder, progressOf, schoolKind, type EndModel, type Ladder, type Miss } from '../../app/learn/view';
import type { FormsAction } from '../../engine/learn/forms';
import { GAMES } from '../../engine/learn/queue';
import type { RightsCard, Step } from '../../engine/learn/steps';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';
import KitTag from '../kit/KitTag.vue';
import { ENTER_DELAY, enterAllowed } from '../panel/focusCycle';
import Arrows from './games/Arrows.vue';
import Forms from './games/Forms.vue';
import Mouse from './games/Mouse.vue';
import Puzzle from './games/Puzzle.vue';
import Tab from './games/Tab.vue';
import LearnEnd from './LearnEnd.vue';
import LearnSide from './LearnSide.vue';

const props = defineProps<{
  flow: LearnFlow;
  /** Игра до сегодняшнего запуска: ступень и лучшее время («новое», «золото на повторе»). */
  before: { step: Step; best: number | null };
  /** Запись итога; нет — окно только показывает (стенд). */
  deps?: CommitDeps;
  /** Цвет формы наших фишек. */
  kitBody: string;
  /** Цвет соперника матча — фишки защитников на арене (067-Р105); нет — оранжевый. */
  rivalBody?: string | undefined;
  /** Раскладка курса (подписи клавиш «Собери клавиатуру»). */
  layout: string;
  /** Следующая игра очереди для «Ещё игра»; нет — «Ещё раз». */
  nextId?: string;
  nextName?: string;
  /** Ставка игры в монетах сейчас. */
  stake?: number;
  /** Часы кадра стенда (время игры не тикает). */
  frozenNow?: number;
  /** Красная полоса кадра стенда. */
  miss?: Miss | null;
}>();
const emit = defineEmits<{ close: []; second: []; next: [id: string]; again: []; done: [r: { end: EndModel; rights: RightsCard | null }] }>();

const t = ru.learn;
const cur = ref<LearnFlow>(props.flow);
const miss = ref<Miss | null>(props.miss ?? null);
const stepAt = ref(globalThis.performance.now());
const tick = ref(Date.now());
const titleId = useId();
const clock = (): number => props.frozenNow ?? Date.now();
let timer: ReturnType<typeof globalThis.setInterval> | undefined;
watch(() => props.flow, (f) => void ((cur.value = f), (miss.value = props.miss ?? null)));

const f = computed(() => cur.value);
const name = computed(() => gameName(f.value.game));
const goldTime = computed(() => mmss((GAMES.find((g) => g.id === f.value.game)?.t ?? 0) * 1000));
const letter = computed(() => (f.value.ctx.learned[0] ?? '').toUpperCase());
const isNew = computed(() => f.value.step === 'start' && props.before.step === 0 && props.before.best === null);
const end = computed(() => (f.value.step === 'end' ? endOf(f.value, props.before) : null));
const time = computed(() => mmss(f.value.run?.ms ?? (f.value.run ? (props.frozenNow ?? tick.value) - f.value.run.startedAt : 0)));
const ladder = computed<Ladder>(() => (end.value ? endLadder(end.value.tier) : f.value.step === 'play' ? playLadder(f.value.play?.s.misses ?? 0) : ['', '', '']));
const progress = computed(() => (f.value.play ? progressOf(f.value.play) : undefined));
/** Что рисует арена: в игре — её состояние, на старте — первое поле (без ввода: шаг не `play`). */
const shown = computed(() => f.value.play ?? (f.value.step === 'start' ? playOf(f.value, ARENA_ASPECT) : null));

/** Строка задания над ареной: жирное начало и хвост. */
const lead = computed(() => leadOf(f.value));
/** «лучшая: серебро · 0:41» над ступенями на старте, если игру уже играли. */
const bestLine = computed(() => {
  const b = props.before;
  if (f.value.step !== 'start' || b.step === 0 || b.best === null) return '';
  return t.side.best.replace('{tier}', ru.school.medal[b.step] ?? '').replace('{time}', mmss(b.best));
});
const strip = computed(() => (miss.value ? (miss.value.text ?? t.miss[miss.value.kind].replace('{num}', String(miss.value.num ?? ''))) : ''));
/** Игры 5–8 рисуют свою полосу состояния внутри арены (кнопка «Ответить» и «Enter — дальше»). */
const ownStrip = computed(() => shown.value !== null && isFormsPlay(shown.value));
/** Вид ответа «Школы» у игры 5–8: слово для ссылки у названия окна (Э8.14, 22). */
const school = computed(() => schoolKind(f.value.game));

function reset(): void {
  miss.value = null;
  stepAt.value = globalThis.performance.now();
}
const card = ref<HTMLElement | null>(null);
/** Фокус — на главную кнопку шага («Играть», «Второй тайм»/«Ещё раз»): Enter нажимает её, а не то, что под затемнением. В игре кнопок нет. */
function focusPrimary(): void {
  void nextTick(() => card.value?.querySelector<HTMLElement>('button.primary')?.focus());
}
watch(() => f.value.step, focusPrimary);
function begin(): void {
  cur.value = beginLearn(cur.value, clock(), ARENA_ASPECT);
  reset();
}
const again = (): void => emit('again');
function feed(input: GameInput): void {
  const before = cur.value;
  let next = inputLearn(before, input, clock());
  if (next === before || before.play === null || next.play === null) return;
  miss.value = missOf(before.play, next.play, input);
  if (next.step === 'end') {
    if (props.deps) next = commitLearn(next, props.deps);
    stepAt.value = globalThis.performance.now();
    const e = endOf(next, props.before);
    if (e !== null) emit('done', { end: e, rights: next.view?.rights ?? null });
  }
  cur.value = next;
}
/** Ввод игры 5–8: ввод в поле, «Ответить», линия «Пар». */
function act(action: FormsAction): void {
  const p = shown.value;
  if (p !== null && isFormsPlay(p)) feed({ game: p.game, action });
}
function onKey(e: KeyboardEvent): void {
  const s = f.value;
  const listOpen = card.value?.querySelector('[aria-expanded="true"]') != null;
  const plainButton = e.target instanceof HTMLButtonElement && !e.target.classList.contains('primary');
  const a = keyAction(s.step, s.game, { key: e.key, repeat: e.repeat, shift: e.shiftKey, plainButton }, listOpen);
  if (a === null) return;
  e.preventDefault();
  e.stopPropagation();
  if (a.do === 'close') emit('close');
  else if (a.do === 'feed') feed(a.input);
  else if (enterAllowed({ repeat: e.repeat, openedAt: stepAt.value, now: e.timeStamp, delay: ENTER_DELAY })) {
    if (s.step === 'start') begin();
    else if (endPrimary(s.place) === 'again') again();
    else emit('second');
  }
}
onMounted(() => {
  focusPrimary();
  globalThis.addEventListener('keydown', onKey, true);
  if (props.frozenNow === undefined) timer = globalThis.setInterval(() => void (tick.value = Date.now()), 250);
});
onBeforeUnmount(() => {
  globalThis.removeEventListener('keydown', onKey, true);
  globalThis.clearInterval(timer);
});
</script>

<template>
  <div class="layer">
    <div class="dim" />
    <section
      ref="card"
      class="card panel win"
      :class="f.step"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="titleId"
    >
      <KitTag
        v-if="isNew"
        kind="solid"
        class="new"
      >
        {{ ru.home.markNew }}
      </KitTag>
      <div class="head">
        <img
          class="ico"
          :src="gameIcon(f.game)"
          alt=""
        >
        <h2 :id="titleId">
          {{ name }}
        </h2>
        <span
          v-if="school"
          class="school"
        >{{ t.schoolLink.replace('{kind}', school) }}</span>
      </div>
      <p class="lead">
        <b v-if="lead.bold">{{ lead.bold }}</b>{{ lead.rest }}
      </p>
      <div class="body">
        <div
          class="arena"
          :class="{ plain: end }"
        >
          <LearnEnd
            v-if="end"
            :end="end"
            :name="name"
            :gold-time="goldTime"
          />
          <div
            v-else
            class="box"
            :class="{ idle: f.step === 'start' }"
          >
            <template v-if="shown">
              <Arrows
                v-if="shown.game === 'arrows'"
                :s="shown.s"
                :miss="miss"
                :body="kitBody"
                :rival="rivalBody"
                :letter="letter"
              />
              <Mouse
                v-else-if="shown.game === 'mouse'"
                :s="shown.s"
                :seed="f.seed"
                :miss="miss"
                :body="kitBody"
                :rival="rivalBody"
                @input="(input) => feed({ game: 'mouse', input })"
              />
              <Tab
                v-else-if="shown.game === 'tab'"
                :s="shown.s"
                :miss="miss"
                :body="kitBody"
                @click="feed({ game: 'tab', input: 'click' })"
              />
              <Forms
                v-else-if="isFormsPlay(shown)"
                :s="shown.s"
                :strip="strip"
                :idle="f.step === 'start'"
                @act="act"
              />
              <Puzzle
                v-else
                :s="shown.s"
                :layout="layout"
                :miss="miss"
                @place="(l, socket) => feed({ game: 'keyboard', letter: l, socket })"
              />
            </template>
            <p
              v-if="strip && !ownStrip"
              class="say"
            >
              ✗ {{ strip }}
            </p>
          </div>
        </div>
        <LearnSide
          :mode="f.step"
          :game="f.game"
          :ladder="ladder"
          :gold-time="goldTime"
          :time="time"
          :misses="f.play?.s.misses ?? end?.misses ?? 0"
          :progress="progress"
          :stake="stake ?? 2"
          :best="bestLine"
        />
      </div>
      <div
        v-if="f.step === 'start'"
        class="foot"
      >
        <KeyButton
          primary
          md
          :sub="ru.kit.enter"
          @click="begin"
        >
          {{ t.start.play }}
        </KeyButton>
        <span
          v-if="f.place === 'break'"
          class="note"
        >{{ t.start.skipNote }}</span>
        <span
          v-else
          class="spacer"
        />
        <KeyButton
          quiet
          md
          :sub="ru.kit.esc"
          @click="emit('close')"
        >
          {{ f.place === 'break' ? ru.kit.skip : t.end.base }}
        </KeyButton>
      </div>
      <div
        v-else-if="f.step === 'end'"
        class="foot"
      >
        <KeyButton
          v-if="endPrimary(f.place) === 'second'"
          primary
          md
          :sub="ru.kit.enter"
          @click="emit('second')"
        >
          {{ ru.match.break.second }}
        </KeyButton>
        <KeyButton
          v-else
          primary
          md
          :sub="ru.kit.enter"
          @click="again"
        >
          {{ ru.match.again }}
        </KeyButton>
        <span class="spacer" />
        <KeyButton
          v-if="f.place === 'base'"
          quiet
          md
          :sub="ru.kit.esc"
          @click="emit('close')"
        >
          {{ t.end.base }}
        </KeyButton>
        <KeyButton
          v-else-if="nextId"
          quiet
          md
          @click="emit('next', nextId)"
        >
          {{ t.end.next.replace('{name}', nextName ?? '') }}
        </KeyButton>
        <KeyButton
          v-else
          quiet
          md
          @click="again"
        >
          {{ ru.match.again }}
        </KeyButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.layer { position: absolute; inset: 0; }
.win { left: 50%; margin-left: -450px; top: 105px; width: 900px; height: 490px; display: flex; flex-direction: column; gap: 8px; padding: 12px 18px 14px; text-align: left; }
.win.play { height: 426px; }
.new { position: absolute; top: -10px; left: 14px; padding: 1px 6px; font-size: 12px; }
.head { display: flex; align-items: center; gap: 12px; }
.ico { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; box-shadow: 0 0 0 2px rgb(255 255 255 / 0.5); }
.school { align-self: flex-end; margin-bottom: 4px; font-size: 15px; font-weight: 700; color: #8fe3a8; }
.head h2 { margin: 0; font-size: 26px; line-height: 1; text-shadow: none; }
.lead { margin: 0; font-size: 16px; color: var(--text-muted); }
.lead b { color: var(--text); }
.body { display: grid; grid-template-columns: 1fr 286px; grid-template-rows: minmax(0, 1fr); gap: 16px; flex: 1; min-height: 0; }
.arena { position: relative; display: flex; flex-direction: column; border-radius: 14px; overflow: hidden; background: #1b2040; box-shadow: inset 0 0 0 1.5px var(--border); }
.box { position: relative; flex: none; width: 100%; height: 320px; margin: auto 0; overflow: hidden; }
.box.idle { pointer-events: none; }
.say { position: absolute; left: 0; right: 0; bottom: 0; margin: 0; padding: 9px 14px; font-size: 17px; font-weight: 800; background: #a32a2f; color: #fff; }
.foot { margin-top: 4px; display: flex; align-items: center; gap: 14px; min-height: 56px; }
.foot .note { flex: 1; font-size: 14px; color: var(--text-muted); }
.spacer { flex: 1; }
</style>

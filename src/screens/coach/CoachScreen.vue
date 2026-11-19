<script setup lang="ts">
/**
 * «Минута тренера» (067 Т25, 065-Р13; кадры Э4.11–14): старт → минута → итог. Две самые трудные клавиши (`hardKeys` раздела `coach`),
 * строка из них 60 секунд; итог — монеты как за печать и «было → стало» по клавишам (`finishMinute` с `ctx.keys`). Минута не матч:
 * в игровой день и журнал не идёт (ТЗ-10.9). Enter — начать / ещё минута, Esc — на Базу (в ходе минуты — без зачёта).
 * Правила — `engine/coach`, проводка — `app/coach`; экран только показывает. Кадр стенда — проп `frame`.
 */
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import type { CoachFrame } from '../../app/coach/frame';
import { clockText, endMinute, minuteLesson, minuteOf, pct, keysText, tileLine } from '../../app/coach/run';
import { dreamText, fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { dictionaryOf, keyEventOf } from '../../app/match/run';
import { artUrl } from '../../art/assets';
import ScreenHead from '../../components/league/ScreenHead.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import KeyCap from '../../components/kit/KeyCap.vue';
import TierMedal from '../../components/learn/TierMedal.vue';
import { coachDef, type CoachKeys } from '../../engine/coach/section';
import { idleMinute, minuteStep, type MinuteState } from '../../engine/coach/minute';
import { homeView } from '../../engine/home';
import { clubDef, type Club } from '../../engine/club/section';
import { formDef } from '../../engine/form/section';
import { fingerOf, type FormState } from '../../engine/form/rank';
import type { MinuteView } from '../../engine/match';
import { keymap } from '../../engine/typing/layouts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const props = defineProps<{ frame?: CoachFrame }>();
const t = ru.coach;
const router = useRouter();
const { session, pack, input, data } = useHomeInput();
const sections = computed(() => (session.player.value.kind === 'ok' ? session.player.value.env.sections : undefined));
const home = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (home.value ? dreamText(home.value) : null));
const club = computed(() => data<Club>(clubDef.name, clubDef.empty()));
const coach = computed(() => data<CoachKeys>(coachDef.name, coachDef.empty()));
const form = computed(() => data<FormState>(formDef.name, formDef.empty()));
const lesson = computed(() => (input.value ? minuteLesson(pack.pack.value, input.value.cur) : null));
const picked = computed(() => minuteOf(coach.value, form.value, keymap, lesson.value));
const tiles = computed(() => picked.value.tiles);
/** Сеанс не `ok` (вторая вкладка, чтение): минуту не начинаем — итог всё равно не запишется. */
const canPlay = computed(() => session.status.value === 'ok');

const step = ref<'start' | 'play' | 'end'>(props.frame?.step ?? 'start');
const state = shallowRef<MinuteState>(idleMinute);
const nowT = ref(Date.now());
const done = shallowRef<{ view: MinuteView; errors: number } | null>(props.frame?.end ?? null);
const fail = ref(false);
let minuteId = '';
let timer: ReturnType<typeof globalThis.setInterval> | undefined;
let left = false;

/** Старт минуты; идущую не перезапускаем (двойной Enter или щелчок по кнопке, что ещё не ушла с экрана). */
function begin(): void {
  if (step.value === 'play' || !canPlay.value) return;
  const l = lesson.value;
  const player = session.player.value;
  if (!l || player.kind !== 'ok' || picked.value.keys === '') return;
  const t0 = Date.now();
  minuteId = `c-${player.pid}-${t0}`;
  state.value = minuteStep(idleMinute, { type: 'start', seed: t0 % 2147483647, lesson: l, keys: picked.value.keys, dict: dictionaryOf(), keymap }).state;
  done.value = null;
  fail.value = false;
  nowT.value = t0;
  step.value = 'play';
}

/** Конец минуты (свисток на конце строки): итог в кассу и сохранение; повтор `minuteId` — без второй награды. */
function finish(): void {
  const s = state.value;
  const out = endMinute(sections.value, s, minuteId);
  if (out === null) return;
  fail.value = !session.save(out.patch).ok;
  done.value = { view: out.view, errors: out.errors };
  step.value = 'end';
}

function leave(): void {
  if (left || props.frame) return;
  left = true;
  void router.push('/base');
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault();
    leave();
  } else if (step.value === 'play') {
    const ev = keyEventOf({ code: e.code, key: e.key, repeat: e.repeat, ctrlKey: e.ctrlKey, altKey: e.altKey, metaKey: e.metaKey, caps: e.getModifierState('CapsLock') }, Date.now());
    if (ev === null || ev.type !== 'key') return;
    e.preventDefault();
    state.value = minuteStep(state.value, ev).state;
    if (state.value.phase === 'done') finish();
  } else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) {
    e.preventDefault();
    begin();
  }
}
onMounted(() => {
  if (props.frame) return;
  globalThis.addEventListener('keydown', onKey);
  timer = globalThis.setInterval(() => void (nowT.value = Date.now()), 250);
});
onUnmounted(() => {
  globalThis.removeEventListener('keydown', onKey);
  globalThis.clearInterval(timer);
});

// --- вид хода минуты
const run = computed(() => (state.value.phase === 'run' ? state.value : null));
const line = computed(() => {
  const f = props.frame?.play;
  if (f) return { text: f.text, next: f.next, pos: f.pos, missed: f.missed };
  const ty = run.value?.typing;
  return ty ? { text: ty.text, next: '', pos: ty.pos, missed: [...ty.missed] } : { text: '', next: '', pos: 0, missed: [] as number[] };
});
const chars = computed(() => Array.from(line.value.text).map((ch, i) => ({ ch, cls: ch === ' ' ? 'sp' : i < line.value.pos ? (line.value.missed.includes(i) ? 'miss' : 'ok') : i === line.value.pos ? 'cur' : '' })));
const nextChars = computed(() => Array.from(line.value.next));
const leftMs = computed(() => {
  if (props.frame?.play) return props.frame.play.leftMs;
  const r = run.value;
  if (!r) return 0;
  return Math.max(0, r.ms - (r.stats.startedAt === null ? 0 : nowT.value - r.stats.startedAt));
});
const clock = computed(() => clockText(leftMs.value));
const total = computed(() => run.value?.ms ?? 60000);
const correct = computed(() => props.frame?.play?.correct ?? run.value?.stats.correct ?? 0);
const errors = computed(() => props.frame?.play?.errors ?? run.value?.stats.errors ?? 0);
const target = computed(() => (line.value.text[line.value.pos] ?? '').toUpperCase());
const fingerName = (ch: string): string => {
  const f = fingerOf(ch);
  return f === null ? '' : (ru.match.status.fingers[f as keyof typeof ru.match.status.fingers] ?? '');
};
const tier = (r: number): 0 | 1 | 2 | 3 => (r <= 0 ? 0 : r >= 3 ? 3 : (r as 1 | 2));
const rankName = (r: number): string => ru.result.purse.rankNames[r] ?? '';
const coins = computed(() => done.value?.view.coins ?? 0);
const lead = computed(() => fill(picked.value.fresh ? t.start.leadFresh : t.start.lead, { keys: keysText(picked.value.keys) }));
const noHead = computed(() => !home.value || !head.value);
</script>

<template>
  <main class="coach">
    <div class="bg" />
    <div class="dim" />
    <ScreenHead
      v-if="home && head"
      :title="t.title"
      :city="`«${club.name}»`"
      :stars="`${home.stars.n}/${home.stars.of}`"
      :fans="home.fans.n"
      :coins="home.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[`${ru.learn.end.base} · ${ru.kit.esc}`]"
      @chip="leave"
    />
    <img
      class="fig"
      :src="artUrl('baseCoachYoungFull')"
      alt=""
    >
    <div
      v-if="step !== 'play'"
      class="say"
    >
      <b>{{ ru.kit.coachName }}</b>
      <p>{{ step === 'start' ? lead : t.end.lead }}</p>
    </div>
    <div
      v-else
      class="say"
    >
      <b>{{ ru.kit.coachName }}</b>
      <p>{{ leftMs <= 0 ? t.play.overtime : fill(t.play.errors, { n: errors }) }}</p>
    </div>

    <section
      v-if="step === 'start'"
      class="card"
      data-coach="start"
    >
      <div class="tiles">
        <div
          v-for="k in tiles"
          :key="k.ch"
          class="tile"
        >
          <KeyCap class="big">
            {{ k.ch.toUpperCase() }}
          </KeyCap>
          <b class="acc">{{ pct(k.permille) }}</b>
          <span class="rank"><TierMedal
            :tier="tier(k.rank)"
            :size="18"
          />{{ rankName(k.rank) }}<template v-if="tileLine(k)"> · {{ tileLine(k) }}</template></span>
          <span class="finger">{{ fingerName(k.ch) }}</span>
        </div>
      </div>
      <p class="pay">
        {{ t.start.pay }} <i class="coin" />
      </p>
      <div class="btns">
        <KeyButton
          primary
          :state="canPlay ? undefined : 'off'"
          :sub="ru.result.enter"
          @click="begin"
        >
          {{ ru.match.intro.start }}
        </KeyButton>
      </div>
    </section>

    <section
      v-else-if="step === 'play'"
      class="card play"
      data-coach="play"
    >
      <div class="top">
        <h2>{{ t.title }}</h2>
        <div class="clock">
          <b>{{ clock }}</b><i><u :style="{ width: `${Math.round(100 - (leftMs / total) * 100)}%` }" /></i>
        </div>
        <div class="count">
          <span>{{ t.right }}</span><b>{{ correct }}</b>
        </div>
      </div>
      <div class="line">
        <i
          v-for="(c, i) in chars"
          :key="i"
          :class="[c.cls, { sp: c.cls === 'sp' }]"
        >{{ c.cls === 'sp' ? '' : c.ch }}</i>
      </div>
      <div
        v-if="nextChars.length"
        class="line next"
      >
        <i
          v-for="(c, i) in nextChars"
          :key="i"
          :class="{ sp: c === ' ' }"
        >{{ c === ' ' ? '' : c }}</i>
      </div>
      <p class="hint">
        {{ ru.match.status.finger }} <b>{{ target }}</b> — {{ fingerName(target.toLowerCase()) }}
      </p>
      <p class="foot">
        <span>{{ fill(t.play.errors, { n: errors }) }}</span><span>{{ t.play.leave }}</span>
      </p>
    </section>

    <section
      v-else-if="done"
      class="card"
      data-coach="end"
    >
      <h2>{{ t.end.title }}</h2>
      <div class="sum">
        <span><b>+{{ coins }}</b> {{ plural(coins, ru.result.purse.coins) }} <i class="coin" /></span>
        <span>{{ t.right }}: <b>{{ done.view.correct }}</b></span>
        <span>{{ t.end.errors }} <b>{{ done.errors }}</b></span>
      </div>
      <div class="ress">
        <div
          v-for="k in done.view.keys"
          :key="k.before.ch"
          class="res"
        >
          <KeyCap class="big sm">
            {{ k.before.ch.toUpperCase() }}
          </KeyCap>
          <span class="was"><TierMedal
            :tier="tier(k.before.rank)"
            :size="18"
          />{{ rankName(k.before.rank) }}<small>{{ pct(k.before.permille) }}</small></span>
          <i class="arr">→</i>
          <span class="now"><TierMedal
            :tier="tier(k.after.rank)"
            :size="18"
          /><b>{{ rankName(k.after.rank) }}</b><small>{{ pct(k.after.permille) }}</small></span>
          <span class="state">
            <span
              v-if="k.after.rank > k.before.rank"
              class="up"
            >{{ t.end.newRank }}</span>
            <small v-else>{{ tileLine(k.after) }}</small>
          </span>
        </div>
      </div>
      <p
        v-if="fail"
        class="foot"
        role="alert"
      >
        {{ ru.learn.end.saveFail }}
      </p>
      <div class="btns">
        <KeyButton
          primary
          :state="canPlay ? undefined : 'off'"
          :sub="ru.result.enter"
          @click="begin"
        >
          {{ t.end.again }}
        </KeyButton>
      </div>
    </section>
    <span
      v-if="noHead"
      class="none"
    />
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640 (1920 ÷ 1,6875), как кадры Э4.11–14 */
.coach { position: absolute; inset: 0; overflow: hidden; isolation: isolate; container-type: inline-size; --col: clamp(224px, calc(224px + (100cqw - 1024px) * 0.1758), 244px); --colw: clamp(784px, calc(784px + (100cqw - 1024px) * 0.51), 842px); }
.bg { position: absolute; inset: 0; z-index: -2; background: #1a1f2a v-bind("`url('${artUrl('baseBgBase')}')`") center bottom / auto 125% no-repeat; }
.dim { position: absolute; inset: 0; z-index: -1; background: rgb(12 12 32 / 0.65); }
.fig { position: absolute; left: 20px; top: 104px; height: clamp(470px, calc(470px + (100cqw - 1024px) * 0.0527), 476px); filter: drop-shadow(0 8px 14px rgb(0 0 0 / 0.5)); }
.say { position: absolute; left: var(--col); top: 106px; width: var(--colw); box-sizing: border-box; padding: 8px 16px 10px; border-radius: 16px; background: linear-gradient(160deg, rgb(58 63 134 / 0.96), rgb(31 33 82 / 0.96)); box-shadow: inset 0 0 0 1.5px var(--border), 0 10px 22px rgb(0 0 0 / 0.4); }
.say::before { content: ''; position: absolute; left: -40px; top: 22px; width: 42px; height: 26px; background: rgb(58 63 134 / 0.96); clip-path: polygon(0 40%, 100% 0, 100% 100%); }
.say b { display: block; font-size: 13px; color: var(--text-muted); }
.say p { margin: 0; font-size: 17px; font-weight: 700; line-height: 1.3; text-wrap: balance; }
.card { position: absolute; left: var(--col); top: 200px; width: var(--colw); box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; padding: 16px 24px 18px; border-radius: 16px; background: linear-gradient(160deg, rgb(58 63 134 / 0.85), rgb(31 33 82 / 0.85)); box-shadow: inset 0 0 0 1.5px var(--border); }
.card h2 { margin: 0; font-size: 28px; }
.pay { margin: 0; font-size: 15px; color: var(--text-muted); }
.btns { margin-top: 4px; }
.big { min-width: 96px; height: 96px; font-size: 64px; border-radius: 16px; background: #fff; color: #1b1a3a; box-shadow: 0 6px 0 #9fb58a; }
.big.sm { min-width: 44px; height: 44px; font-size: 28px; border-radius: 10px; box-shadow: 0 3px 0 #9fb58a; }
.tiles { display: flex; gap: 18px; }
.tile { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 12px 12px; border-radius: 14px; background: rgb(255 255 255 / 0.07); border: 1px solid rgb(255 255 255 / 0.14); }
.acc { margin-top: 6px; font-size: 26px; }
.rank { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; text-align: center; }
.finger { font-size: 14px; color: var(--text-muted); }
.top { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.clock { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.clock b { font-size: 44px; line-height: 1; }
.clock i { display: block; width: 200px; height: 8px; border-radius: 4px; background: rgb(255 255 255 / 0.18); overflow: hidden; }
.clock u { display: block; height: 100%; background: #6fd89c; }
.count { display: flex; flex-direction: column; align-items: flex-end; }
.count span { font-size: 15px; color: var(--text-muted); }
.count b { font-size: 44px; line-height: 1; color: #6fd89c; }
.line { display: flex; justify-content: center; align-items: flex-end; gap: 4px; padding: 14px 12px; border-radius: 14px; background: rgb(21 20 58 / 0.7); }
.line i { display: grid; place-items: center; width: 36px; height: 56px; border-radius: 8px; font-style: normal; font-size: 42px; line-height: 1; color: var(--text); }
.line i.sp { width: 22px; }
.line i.ok { color: #6fd89c; }
.line i.miss { color: #fff; background: rgb(255 107 107 / 0.55); }
.line i.cur { background: rgb(255 255 255 / 0.2); box-shadow: 0 0 0 3px var(--text); }
.line.next { padding: 8px 12px; background: transparent; opacity: 0.55; }
.line.next i { height: 38px; font-size: 30px; }
.hint { margin: 0; font-size: 18px; font-weight: 700; text-align: center; }
.hint b { color: #6fd89c; font-size: 22px; }
.foot { display: flex; justify-content: space-between; margin: 0; font-size: 14px; color: var(--text-muted); }
.sum { display: flex; gap: 28px; align-items: baseline; font-size: 20px; font-weight: 700; }
.sum b { font-size: 28px; }
.ress { display: flex; flex-direction: column; gap: 10px; }
.res { display: grid; grid-template-columns: 52px 1fr 28px 1fr 190px; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 14px; background: rgb(255 255 255 / 0.07); border: 1px solid rgb(255 255 255 / 0.14); font-size: 18px; }
.res small { display: block; font-size: 14px; color: var(--text-muted); }
.was, .now { display: block; }
.was :deep(.medal), .now :deep(.medal) { margin-right: 6px; vertical-align: -4px; }
.was { color: var(--text-muted); font-weight: 700; }
.now b { font-size: 20px; }
.arr { font-style: normal; font-size: 24px; text-align: center; }
.state { text-align: right; }
.up { padding: 1px 10px; border-radius: 10px; background: rgb(111 216 156 / 0.2); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.55); color: #6fd89c; font-size: 12px; font-weight: 800; }
.coin { display: inline-block; width: 15px; height: 15px; box-sizing: border-box; border: 2px solid #fff; border-radius: 50%; background: #f2c230; vertical-align: -3px; }
.none { display: none; }
</style>

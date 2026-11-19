<script setup lang="ts">
/**
 * Тренировочная база (067 Т19, кадры Э4.01–08, 41, 47): сверху игры на интерес («сегодня можно N» из двух), ниже учебные, внизу слева — реплика тренера на первом
 * входе. «Доска рекордов ›» — вид с рекордами (Esc — назад на Базу). Учебная играет окном `LearnWindow` над Базой (067-Р4, Р16), игра на интерес — адресом
 * `/base/<игра>` (`FunShell`). Esc — Дом, Enter — главная игра. Правила — `engine/base`, проводка — `app/base`; экран только показывает.
 * Вход закрыт замком Базы (ТЗ-1.9) — на Дом. Правая нижняя панель — «Минута тренера» (067 Т25, Р173): «Начать» ведёт на `/coach`; Enter её запускает, когда игр на интерес не осталось.
 */
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { baseCtxOf, baseScreen, coachDue, failWhy, firstOpen, seeCoach } from '../../app/base/run';
import { useBase } from '../../app/base/useBase';
import { dreamText, fill } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { breakCtx } from '../../app/learn/entry';
import { artUrl } from '../../art/assets';
import CoachBubble from '../../components/panel/CoachBubble.vue';
import ScreenHead from '../../components/league/ScreenHead.vue';
import LearnWindow from '../../components/learn/LearnWindow.vue';
import { homeView } from '../../engine/home';
import type { FunId } from '../../engine/base/open';
import { rivalBodyOf } from '../../engine/club/rival';
import { clubDef, type Club } from '../../engine/club/section';
import { rivalOf } from '../../engine/cup/teams';
import { ru } from '../../i18n/ru';
import MinutePanel from '../../components/coach/MinutePanel.vue';
import { minuteLesson, minuteOf, pct } from '../../app/coach/run';
import { coachDef, type CoachKeys } from '../../engine/coach/section';
import { formDef } from '../../engine/form/section';
import type { FormState } from '../../engine/form/rank';
import { keymap } from '../../engine/typing/layouts';
import FunCards from './FunCards.vue';
import LearnList from './LearnList.vue';
import RecordsBoard from './RecordsBoard.vue';

const t = ru.base;
const router = useRouter();
const route = useRoute();
const { session, pack, input, data, today } = useHomeInput();
const clock = inject<(() => { now: number; day: string }) | null>('kk-home-clock', null);
const now = (): number => clock?.().now ?? Date.now();

const sections = computed(() => (session.player.value.kind === 'ok' ? session.player.value.env.sections : undefined));
const home = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (home.value ? dreamText(home.value) : null));
const club = computed(() => data<Club>('club', clubDef.empty()));
/** Урок ребёнка (не больше 32) — один поиск на учебные и на панель «Минута тренера». */
const courseLesson = computed(() => (input.value ? minuteLesson(pack.pack.value, input.value.cur) : null));
/** Номер урока и его выученные буквы — от них зависит, какие учебные собираются. */
const lesson = computed<{ n: number; keys: string } | null>(() => (input.value && pack.pack.value ? { n: Math.min(input.value.cur, 32), keys: courseLesson.value?.keys ?? '' } : null));
/** Цвет фишек соперника в учебной игре — форма команды двора урока при форме клуба (067-Р216, как у BreakLearn и стенда). */
const rivalBody = computed(() => (lesson.value ? rivalBodyOf(rivalOf(lesson.value.n), club.value.kit) : undefined));
// кадр стенда (только в разработке): доска рекордов открыта сразу, Кубок сыгран (Штрафной открыт); в игре поставщика нет
const stand = inject<() => { board?: boolean; cup?: boolean }>('kk-base-stand', () => ({}));
const ctx = computed(() => (input.value ? baseCtxOf(input.value, today(), stand().cup === true) : null));
const view = computed(() => {
  const l = lesson.value;
  const c = ctx.value;
  if (!l || !c) return null;
  return baseScreen(sections.value, c, breakCtx(sections.value, { lesson: input.value?.cur ?? l.n, keys: l.keys, entries: [], now: now(), day: today() }));
});
const primary = computed(() => (view.value ? firstOpen(view.value) : null));
// панель «Минута тренера» (067 Т25, Р173): две трудные клавиши раздела `coach`, не хватает — свежие клавиши урока (Р280)
const coachData = computed(() => data<CoachKeys>(coachDef.name, coachDef.empty()));
const formData = computed(() => data<FormState>(formDef.name, formDef.empty()));
const minute = computed(() => minuteOf(coachData.value, formData.value, keymap, courseLesson.value));
const minuteTiles = computed(() => minute.value.tiles.map((k) => ({ ch: k.ch, pct: pct(k.permille) })));
const canMinute = computed(() => session.status.value === 'ok');
function startMinute(): void {
  if (!canMinute.value) return;
  void router.push('/coach');
}

const base = useBase(session, { lesson: () => lesson.value, now, day: today, sections: () => sections.value, ok: () => session.player.value.kind === 'ok' && session.status.value === 'ok' });
const board = ref(stand().board === true);
const coach = ref(false);
const why = computed(() => failWhy(base.fail.value));

/** Замок Базы (ТЗ-1.9) закрыт — экрана нет, Дом. Решаем, как только вход собран. */
watch(ctx, (c) => c && !c.open && void router.replace('/home'), { immediate: true });

let started = false;
/** Один раз, когда вид собран: реплика тренера на первом входе; адрес `/base/<учебная>` открывает её окно (перезагрузка посреди игры — окно со старта). */
watch(view, (v) => {
  if (!v || started) return;
  started = true;
  coach.value = coachDue(sections.value);
  const play = route.query.play;
  if (typeof play === 'string') {
    void router.replace('/base');
    void base.open(play);
  }
}, { immediate: true });

function closeCoach(): void {
  coach.value = false;
  const patch = seeCoach(sections.value, today());
  if (patch !== null && session.status.value === 'ok') session.save(patch);
}
function playFun(id: FunId): void {
  void router.push(`/base/${id}`);
}
function onKey(e: KeyboardEvent): void {
  if (e.defaultPrevented || base.entry.value !== null || view.value === null) return; // окно учебной игры ловит свои клавиши
  if (e.key === 'Escape') {
    if (coach.value) closeCoach();
    else if (board.value) board.value = false;
    else void router.push('/home');
  } else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement) && !board.value) { if (primary.value !== null) playFun(primary.value); else startMinute(); }
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => {
  globalThis.removeEventListener('keydown', onKey);
  if (coach.value) closeCoach(); // ушёл с Базы, не закрыв реплику: она была показана — метку первого входа пишем (036-Р11, 067-Р212)
});

const funHead = computed(() => {
  const v = view.value;
  if (!v) return '';
  const full = v.left + v.spent;
  return fill(t.funHead[v.left === 0 ? 'spent' : v.spent === 0 ? 'full' : 'left'], { n: v.left === 0 ? full : v.left });
});
const field = computed(() => input.value?.cur ?? 1);
const chip = computed(() => `${board.value ? ru.learn.end.base : ru.frame.menu.home} · ${ru.kit.esc}`);
</script>

<template>
  <main class="base">
    <div class="bg" />
    <ScreenHead
      v-if="home && head"
      :title="board ? `${ru.home.houses.base} · ${t.recordsSuffix}` : ru.home.houses.base"
      :city="`«${club.name}»`"
      :stars="`${home.stars.n}/${home.stars.of}`"
      :fans="home.fans.n"
      :coins="home.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[chip]"
      @chip="board ? (board = false) : router.push('/home')"
    />
    <template v-if="view">
      <RecordsBoard
        v-if="board"
        :view="view"
        :today="today()"
        :club="club.name"
      />
      <div
        v-else
        class="body"
      >
        <div class="hd">
          <h2>{{ funHead }}</h2>
          <i
            v-for="k in view.left + view.spent"
            :key="k"
            class="pip"
            :class="{ on: k <= view.left }"
          />
          <span class="hint">{{ t.hint }}</span>
          <span class="end"><button
            type="button"
            class="kb-chip"
            @click="board = true"
          >{{ t.board }}</button></span>
        </div>
        <FunCards
          :view="view"
          :today="today()"
          :primary="primary"
          :cur="field"
          @play="playFun"
        />
        <div class="bot">
          <LearnList
            :rows="view.learn"
            @play="(id) => void base.open(id)"
          />
          <MinutePanel
            :keys="minuteTiles"
            :fresh="minute.fresh"
            :primary="primary === null"
            :spent="view.left === 0"
            :off="!canMinute"
            @start="startMinute"
          />
        </div>
      </div>
      <!-- свёрнутый тренер (одна голова, как на кадрах Э4.03–07): щелчок по ней — реплика снова -->
      <CoachBubble
        v-if="!board"
        class="coach"
        :text="coach ? t.coachFirst : ''"
        :width="340"
        @close="closeCoach"
        @again="coach = true"
      />
    </template>
    <LearnWindow
      v-if="base.entry.value"
      :key="`${base.entry.value.flow.game}-${base.entry.value.flow.seed}`"
      :flow="base.entry.value.flow"
      :before="base.entry.value.before"
      :deps="base.deps"
      :kit-body="club.kit.body"
      :rival-body="rivalBody"
      layout="jcuken-win"
      :stake="base.entry.value.stake"
      @close="base.close()"
      @again="void base.again()"
    />
    <p
      v-if="base.fail.value !== null"
      class="fail"
      role="alert"
    >
      {{ ru.learn.end.saveFail }} {{ why }}
    </p>
  </main>
</template>

<style scoped>
/* числа — базовые px сцены 1024×640 (1920 ÷ 1,6875), как кадры Э4.01–08 */
.base { position: absolute; inset: 0; overflow: hidden; }
/* доска рекордов на 1024: «Тренировочная база · рекорды · «Прогресс»» целиком — заголовок строки чуть мельче, промежутки правой группы уже (067 Т22; выше 1100 — как в макете Э4.08) */
@media (max-width: 1100px) {
  .base :deep(.kb-head h1) { font-size: 19px; }
  .base :deep(.kb-stats) { gap: 6px; margin-left: 8px; }
}
.bg { position: absolute; inset: 0; background: #1a1f2a v-bind("`url('${artUrl('baseBgBase')}')`") center bottom / auto 125% no-repeat; }
/* строка экрана — интерфейс, а не сцена: под ней тёмная полоса, чтобы текст читался на любом фоне */
.bg::after { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 86px; background: linear-gradient(rgb(21 20 58 / 0.94) 0 80%, rgb(21 20 58 / 0)); }
.body { position: absolute; left: 16px; right: 16px; top: 96px; bottom: 28px; display: flex; flex-direction: column; gap: 6px; }
.hd { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.hd h2 { margin: 0; font-size: 20px; line-height: 1.2; text-shadow: 0 1px 5px rgb(8 8 24 / 0.85); }
.end { margin-left: auto; }
.hint { margin-left: 10px; padding: 2px 10px; border-radius: 8px; background: rgb(21 20 58 / 0.85); font-size: 12px; color: var(--text-muted); }
.pip { box-sizing: border-box; width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--text-muted); }
.pip.on { background: #6fd89c; border-color: #fff; }
.bot { display: flex; align-items: flex-start; gap: 12px; min-height: 0; }
.coach { bottom: 62px; }
.fail { position: absolute; top: 608px; left: 50%; margin: 0 0 0 -450px; width: 900px; text-align: center; font-size: 17px; font-weight: 800; color: var(--text); }
</style>

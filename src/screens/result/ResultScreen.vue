<script setup lang="ts">
/**
 * Экран итога матча (065 Т10а, кадры Э1.22–Э1.24, Э1.32–Э1.33): сцена матча без клавиатуры и карточка итога. Забирает итог у
 * `handoff` один раз; пусто (F5 на итоге, второй заход) — сразу в Дом, без ошибки: сохранение уже записано свистком.
 * Enter — главное действие карточки, Esc — Дом; переход один (двойной Enter не даёт двух). Кадр стенда — проп `frame`.
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { takeFinished, takeMeta, type FinishedMeta } from '../../app/match/handoff';
import { rivalName } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { cardOf, type ResultGo } from '../../app/result/card';
import { chainNext, chainSave, schoolOpenOf, setChainTarget } from '../../app/result/chain';
import { useSession } from '../../app/save/session';
import { useResultDay, type Rhythm } from '../../app/day/useResultDay';
import { useNewsView } from '../../app/story/useNewsView';
import DayStrip from '../../components/day/DayStrip.vue';
import Warmup from '../../components/day/Warmup.vue';
import NewsWindow from '../../components/story/NewsWindow.vue';
import { emptyStory, storyDef, type Story } from '../../engine/story/section';
import ResultCard from '../../components/result/ResultCard.vue';
import CupAward from '../../components/cup/CupAward.vue';
import CupTitle from '../../components/cup/CupTitle.vue';
import TitleVideo from '../../components/story/TitleVideo.vue';
import { cupTitle, titleNext, titleStart, type TitleStep } from '../../app/cup/title';
import { fill } from '../../app/home/texts';
import CupResultCard from '../../components/cup/CupResultCard.vue';
import { cupAwards } from '../../app/cup/awards';
import { cupStep, stripMoreAct } from '../../app/cup/exit';
import { cupFrameResult, type CupResultFrame } from '../../app/cup/frame';
import { cupCard } from '../../app/cup/resultCard';
import { emblemKey } from '../../app/cup/groupView';
import { cupMatchInfo, cupRead, cupViewFor, type CupFinished } from '../../app/cup/run';
import { rivalFor, seedOf, TEAMS } from '../../engine/cup';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { isNarrowStage, stageScale } from '../../components/shell/stageScale';
import { albumDef, type Album } from '../../engine/album/section';
import { rivalKitOf } from '../../engine/club/rival';
import { rivalOf } from '../../engine/cup/teams';
import { clubDef, type Club } from '../../engine/club/section';
import { dayDef, type Day } from '../../engine/day/section';
import type { ResultView, Score } from '../../engine/match';
import { YARD_LESSONS } from '../../engine/path/view';
import { schoolDef, type School } from '../../engine/school/section';
import { ru } from '../../i18n/ru';
import MatchScene from '../match/MatchScene.vue';
import type { MatchView } from '../match/view';

/** Кадр стенда (065 К-Г): готовый вид итога из фикстуры; в игре поля нет. */
export interface ResultFrame {
  view: ResultView;
  /** Счёт 1-го тайма — только кадр (065-Р110). */
  half1?: Score;
  lessonNo: number;
  /** Улица соперника кадра (065-Р96). */
  street?: string;
  /** Решение дня со свистка (068 Т8в, Э6.38–.41): строка тренера над итогом и итог дня. */
  rhythm?: Rhythm;
  /** «Итог дня» открыт на кадре (Э6.12, .36): выпуск или полоса — как решит раздел `story` фикстуры. */
  open?: 'summary';
}

const props = defineProps<{ frame?: ResultFrame; cupFrame?: CupResultFrame }>();
const t = ru.match;
const router = useRouter();
const session = useSession();
const { input, data, today, trainers, lessonName } = useHomeInput();
const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
const onResize = (): void => void (win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight });
const width = computed(() => stageScale(win.value.w, win.value.h).width);

// итог забираем один раз при создании экрана; в кадре стенда он приходит пропом
const taken = props.frame || props.cupFrame ? null : takeFinished();
const meta: FinishedMeta = props.frame ? { lesson: '', no: props.frame.lessonNo } : takeMeta();
const view: ResultView | null = props.frame ? props.frame.view : taken !== null && taken.kind === 'done' ? taken.view : null;
const player = computed(() => (session.player.value.kind === 'ok' ? session.player.value : null));
/** Матч Кубка (068 Т6): итог со свистка или, в кадре стенда, свисток по разделам фикстуры. */
const cupFin: CupFinished | null = props.cupFrame
  ? cupFrameResult(cupRead(player.value?.env.sections), props.cupFrame, globalThis.Date.now(), today())
  : taken !== null && taken.kind === 'cup' ? taken : null;
if (view === null && cupFin === null) void router.replace('/home');

const club = computed<Club>(() => (player.value?.env.sections[clubDef.name]?.data as Club | undefined) ?? clubDef.empty());
const news = useNewsView(() => (day.paper.value === null ? null : { n: day.paper.value }));
const baseCard = computed(() => (view === null ? null : cardOf(view, { half1: props.frame?.half1 })));
/** Со строкой тренера или итогом дня кнопки карточки меняются (Э6.36–Э6.42): «Итог дня» или «Микроразминка» — первая, «Ещё матч» — вторая. */
const card = computed(() => {
  const c = baseCard.value;
  if (c === null || day.act.value === null || c.stuck) return c;
  return { ...c, primary: { ...c.primary, label: day.act.value === 'warmup' ? ru.day.act.warmup : ru.day.act.summary }, home: day.act.value === 'warmup' ? ru.day.act.summary : ru.day.act.more };
});
/** Соперник Кубка: от состояния после матча и семени игрока, без пакета Двора (тот грузится позже экрана) — улица нужна журналу дня сразу. */
const pid = session.player.value.kind === 'ok' ? session.player.value.pid : '';
const cupTeam = cupFin === null || pid === '' ? undefined : TEAMS.find((x) => x.id === rivalFor(cupFin.after, seedOf(pid), cupFin.view.round));
const cupModel = computed(() => {
  const i = input.value;
  const p = player.value;
  if (cupFin === null || !i || !p) return null;
  const cv = cupViewFor(cupFin.after, i, today(), p.pid);
  const info = cupMatchInfo(cv, cupFin.view.round, '', true);
  return { card: cupCard(cupFin, cv, club.value.name || ru.home.defaultClub), team: cupTeam, board: info?.board ?? '' };
});
// день (068 Т8): строка тренера над итогом, «Итог дня» и микроразминка; решение принято на свистке
const day = useResultDay({
  pid,
  rhythm: taken !== null && (taken.kind === 'done' || taken.kind === 'cup') ? taken.rhythm : (props.frame ?? props.cupFrame)?.rhythm, view, no: meta.no, today,
  next: () => ((input.value?.cur ?? YARD_LESSONS + 1) > YARD_LESSONS ? null : (input.value?.cur ?? null)),
  allStars: () => Object.values(input.value?.stars ?? {}).reduce((a, b) => a + b, 0),
  day: () => data<Day>(dayDef.name, dayDef.empty()), story: () => data<Story>(storyDef.name, emptyStory()), club: () => club.value, lessonName,
  school: () => data<School>(schoolDef.name, schoolDef.empty()), ...(meta.letters === undefined ? {} : { letters: meta.letters }),
  ...(cupFin === null ? {} : { cup: { a: cupFin.view.total.me, b: cupFin.view.total.opp, street: cupTeam?.street ?? '' } }),
  saveStory: (st) => void session.save({ story: st }),
  saveDay: (d) => void session.save({ day: d }),
});
// кадр стенда: «Итог дня» открыт сразу, когда пак Двора загружен (иначе «Завтра» и названия уроков пусты)
if ((props.frame ?? props.cupFrame)?.open === 'summary') watch(input, (i) => void (i !== null && day.openSummary()), { immediate: true });
/** Окна наград (068 Т6-3): серебро идёт вместо карточки, формы — после неё («Дальше»); `null` — номер ещё не выбран, показ по умолчанию. */
const awards = computed(() => (cupFin === null || cupModel.value === null ? [] : cupAwards(cupFin, cupModel.value.team)));
/** Карточка Кубка: матч довёл день до итога (068-Р71) и наград впереди нет — первая кнопка «Итог дня». */
const cupCardView = computed(() => {
  const m = cupModel.value;
  return m === null ? null : day.act.value === 'summary' && awards.value.length === 0 ? { ...m.card, primary: { ...m.card.primary, label: ru.day.act.summary } } : m.card;
});
const awardNo = ref<number | null>(null);
const awardAt = computed(() => awardNo.value ?? (awards.value[0]?.kind === 'silver' || props.cupFrame?.award === true ? 0 : -1));
const curAward = computed(() => awards.value[awardAt.value] ?? null);
/** Титул (068 Т9, Э5.39/.40): ролик по запросу (после победы в финале; «меньше движения» и кадр стенда — сразу окно) → окно титула → Дом. Серебро и повтор титула не дают. */
const champion = computed(() => (cupFin === null || cupModel.value === null ? null : cupTitle(cupFin, cupModel.value.team)));
const titleStep = ref<TitleStep | null>(null);
const titleAt = computed<TitleStep | null>(() => (champion.value === null ? null : (titleStep.value ?? titleStart({ reduced: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false, frame: props.cupFrame !== undefined }))));
const skipLabel = fill(ru.story.close, { to: ru.kit.skip });
const total = view?.total ?? cupFin?.view.total ?? null;
const board = computed<MatchView | null>(() => total === null ? null : { phase: t.phase.result, detail: cupModel.value?.board ?? '', score: { me: total.me, opp: total.opp }, line: null, balls: [], target: null, typed: null, next: [] });

/** Строка тренера поднимает карточку на 36 px (макет `COACH_LIFT`): фон сцены — на столько же, ворота остаются над карточкой. */
const COACH_LIFT = 36;
const coachLift = computed(() => (day.coach.value !== null && card.value !== null && !card.value.stuck && day.strip.value === null ? COACH_LIFT : 0));

const rivalTeam = computed(() => cupModel.value?.team ?? rivalOf(meta.no));
const rivalTitle = computed(() => {
  const s = rivalName(props.frame?.street ?? rivalTeam.value.street);
  return s.charAt(0).toUpperCase() + s.slice(1);
});

let left = false;
/** Один переход: повтор Enter и щелчок по уже ушедшему экрану ничего не делают. */
function go(to: ResultGo): void {
  if (left || props.frame) return;
  left = true;
  if (to === 'replay') void router.push(cupFin !== null ? { path: '/match', query: { cup: cupFin.view.round } } : meta.lesson === '' ? '/match' : { path: '/match', query: { lesson: meta.lesson } });
  else void router.push(to === 'map' ? '/map' : '/home');
}
/**
 * «Дальше» (067 Т12, К-Б): сначала звенья цепочки — пак, «Тур ждёт» или «штрафные» (`app/result/chain`), потом Карта или Дом.
 * «Ещё раз» (после поражения) идёт прямо в матч; Esc и «Дом» — в Дом без звеньев, непоказанное звено вернётся в следующий заход.
 */
function advance(to: ResultGo): void {
  if (left || props.frame) return;
  const next = to === 'replay' ? null : chainNext(chainSave(data<Album>(albumDef.name, albumDef.empty()), data<Day>(dayDef.name, dayDef.empty()), data<School>(schoolDef.name, schoolDef.empty()), today(), trainers()), schoolOpenOf(input.value), null, globalThis.Date.now());
  if (next === null) return go(to);
  left = true;
  setChainTarget(to);
  void router.push(next.path);
}
/** «Минута тренера» из «Застрял» (067-Р278): тот же один переход, что «Дальше» и «Дом»; звенья цепочки не трогаем — игра не пройдена. */
const minute = (): void => {
  if (left || props.frame) return;
  left = true;
  void router.push('/coach');
};
/** Раздевалка из окна формы: один переход, как «Дальше» и «Дом». */
const toLocker = (): void => {
  if (left || props.frame) return;
  left = true;
  void router.push('/locker');
};
/** Главное действие итога Кубка: шаг решает `cupStep` (титул → окна наград → карточка → «Итог дня» → уход, 068-Р71). */
function cupPrimary(m: NonNullable<typeof cupModel.value>): void {
  const step = cupStep({
    title: titleAt.value === null ? null : titleNext(titleAt.value) === null ? 'last' : 'more',
    awards: awards.value, at: awardAt.value, cardGo: m.card.primary.go, summary: day.act.value === 'summary' && !dayOpen.value,
  });
  if (step.kind === 'title') titleStep.value = titleNext(titleAt.value!);
  else if (step.kind === 'award') awardNo.value = step.at;
  else if (step.kind === 'summary') day.openSummary();
  else advance(step.to);
}
/** Вторая кнопка полосы «Итог дня»: у Кубка после победы — «На карту» (сыгранный раунд заново не играется), иначе «Ещё матч»; подпись и маршрут — из одного решения (068-Р99). */
const moreAct = computed(() => stripMoreAct(cupModel.value === null ? null : { cardGo: cupModel.value.card.primary.go, awards: awards.value }));
const stripMore = (): void => go(moreAct.value.go);
const dayOpen = computed(() => day.strip.value !== null || news.value !== null || day.warm.value);
const primary = (): void => {
  if (dayOpen.value) return;
  if (day.act.value !== null && card.value && !card.value.stuck) return day.act.value === 'warmup' ? day.openWarm() : day.openSummary();
  if (card.value) advance(card.value.primary.go);
  else if (cupModel.value) cupPrimary(cupModel.value);
};
/** Тихая кнопка окна награды: Раздевалка или Дом. */
const quiet = (): void => (curAward.value?.quietGo === 'locker' ? toLocker() : go('home'));

/** Кнопка «В Дом» карточки: со строкой тренера или итогом дня — «Ещё матч» (или «Итог дня» после «пальцы устали»). */
const homeBtn = (): void => (day.act.value === null || card.value?.stuck ? go('home') : day.act.value === 'warmup' ? day.openSummary() : go('replay'));

const SUMMARY_GUARD_MS = 300;
let openedAt = 0;
watch(dayOpen, (open) => void (open && (openedAt = globalThis.performance.now())));

function onKey(e: KeyboardEvent): void {
  if (day.warm.value) return;
  if (dayOpen.value) {
    // Enter в первые ~300 мс после открытия окна — хвост двойного нажатия: итог не закрываем, не дав его увидеть
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.repeat && e.timeStamp - openedAt > SUMMARY_GUARD_MS)) {
      e.preventDefault();
      advance('home');
    }
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    go('home');
  } else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLAnchorElement)) {
    e.preventDefault();
    primary();
  }
}
onMounted(() => {
  globalThis.addEventListener('resize', onResize);
  if (!props.frame) globalThis.addEventListener('keydown', onKey);
});
onUnmounted(() => {
  globalThis.removeEventListener('resize', onResize);
  globalThis.removeEventListener('keydown', onKey);
});
</script>

<template>
  <main
    v-if="(card || cupModel) && board"
    class="result"
  >
    <MatchScene
      :view="board"
      :kit="club.kit"
      :rival-kit="rivalKitOf(rivalTeam, club.kit)"
      :us="{ name: club.name || t.sides.us, backName: club.backName, backNumber: club.backNumber }"
      :rival="cupModel?.team ? { name: cupModel.team.name, city: rivalTitle } : { name: rivalTitle, city: club.city }"
      :cup="cupModel?.team ? { ours: emblemKey('our'), rival: emblemKey(cupModel.team.id), rivalShort: cupModel.team.name } : undefined"
      :width="width"
      :shout="null"
      :bump="null"
      :win="(card ?? cupModel?.card)?.kind === 'win' && day.strip.value === null"
      :lift="coachLift"
      :no-board="day.strip.value !== null"
      intro
    >
      <template
        v-if="card && card.stars !== null && card.stars > 0 && card.kind !== 'loss' && day.strip.value === null"
        #us
      >
        <span
          class="mine"
          role="img"
          :aria-label="ru.result.starsOf.replace('{n}', String(card.stars))"
        ><i
          v-for="i in card.stars"
          :key="i"
        >★</i></span>
      </template>
    </MatchScene>
    <ShellHeader
      match
      :pause="false"
    />
    <TitleVideo
      v-if="titleAt === 'video'"
      :label="skipLabel"
      :aria="ru.museum.videoTitle"
      auto-close
      @close="primary"
    />
    <CupTitle
      v-else-if="champion && titleAt === 'window'"
      :title="champion"
      :club="club.kit"
      :narrow="isNarrowStage(width)"
      @primary="primary"
    />
    <CupAward
      v-else-if="curAward"
      :key="awardAt"
      :award="curAward"
      :club="club.kit"
      @primary="primary"
      @quiet="quiet"
    />
    <CupResultCard
      v-else-if="cupModel"
      :card="cupCardView ?? cupModel.card"
      @primary="primary"
      @home="go('home')"
    />
    <ResultCard
      v-else-if="card && day.strip.value === null"
      :card="card"
      :coach="day.coach.value ?? undefined"
      @primary="primary"
      @home="homeBtn"
      @minute="minute"
    />
    <DayStrip
      v-if="day.strip.value"
      :view="day.strip.value"
      :more-label="moreAct.label"
      @home="advance('home')"
      @more="stripMore"
    />
    <NewsWindow
      v-else-if="news"
      :view="news.view"
      :color="news.color"
      back="home"
      foot="home"
      :more-label="moreAct.label"
      @close="advance('home')"
      @more="stripMore"
    />
    <Warmup
      v-if="day.warm.value"
      @done="day.closeWarm()"
      @skip="day.closeWarm()"
    />
  </main>
</template>

<style scoped>
.result { position: absolute; inset: 0; color: var(--text); }
.mine { display: flex; width: fit-content; margin: 8px auto 0; gap: 2px; padding: 3px 9px; border-radius: 14px; background: #efe9d8; border: 2px solid #cfc7ad; font-size: 17px; line-height: 1; }
.mine i { font-style: normal; color: #c98a00; }
</style>

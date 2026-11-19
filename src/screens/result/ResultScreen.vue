<script setup lang="ts">
/**
 * Экран итога матча (065 Т10а, кадры Э1.22–Э1.24, Э1.32–Э1.33): сцена матча без клавиатуры и карточка итога. Забирает итог у
 * `handoff` один раз; пусто (F5 на итоге, второй заход) — сразу в Дом, без ошибки: сохранение уже записано свистком.
 * Enter — главное действие карточки, Esc — Дом; переход один (двойной Enter не даёт двух). Кадр стенда — проп `frame`.
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { takeFinished, takeMeta } from '../../app/match/handoff';
import { rivalName } from '../../app/home/texts';
import { useHomeInput } from '../../app/home/useHomeInput';
import { cardOf, type ResultGo } from '../../app/result/card';
import { chainNext, chainSave, schoolOpenOf, setChainTarget } from '../../app/result/chain';
import { useSession } from '../../app/save/session';
import ResultCard from '../../components/result/ResultCard.vue';
import ShellHeader from '../../components/shell/ShellHeader.vue';
import { stageScale } from '../../components/shell/stageScale';
import { albumDef, type Album } from '../../engine/album/section';
import { rivalKitOf } from '../../engine/club/rival';
import { rivalOf } from '../../engine/cup/teams';
import { clubDef, type Club } from '../../engine/club/section';
import { dayDef, type Day } from '../../engine/day/section';
import type { ResultView, Score } from '../../engine/match';
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
}

const props = defineProps<{ frame?: ResultFrame }>();
const t = ru.match;
const router = useRouter();
const session = useSession();
const { input, data, today, trainers } = useHomeInput();
const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
const onResize = (): void => void (win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight });
const width = computed(() => stageScale(win.value.w, win.value.h).width);

// итог забираем один раз при создании экрана; в кадре стенда он приходит пропом
const taken = props.frame ? null : takeFinished();
const meta = props.frame ? { lesson: '', no: props.frame.lessonNo } : takeMeta();
const view: ResultView | null = props.frame ? props.frame.view : taken !== null && taken.kind === 'done' ? taken.view : null;
if (view === null) void router.replace('/home');

const card = computed(() => (view === null ? null : cardOf(view, { half1: props.frame?.half1 })));
const board: MatchView | null = view === null ? null : { phase: t.phase.result, detail: '', score: { me: view.total.me, opp: view.total.opp }, line: null, balls: [], target: null, typed: null, next: [] };

const player = computed(() => (session.player.value.kind === 'ok' ? session.player.value : null));
const club = computed<Club>(() => (player.value?.env.sections[clubDef.name]?.data as Club | undefined) ?? clubDef.empty());
const rival = rivalOf(meta.no);
const rivalTitle = computed(() => {
  const s = rivalName(props.frame?.street ?? rival.street);
  return s.charAt(0).toUpperCase() + s.slice(1);
});

let left = false;
/** Один переход: повтор Enter и щелчок по уже ушедшему экрану ничего не делают. */
function go(to: ResultGo): void {
  if (left || props.frame) return;
  left = true;
  if (to === 'replay') void router.push(meta.lesson === '' ? '/match' : { path: '/match', query: { lesson: meta.lesson } });
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
const primary = (): void => {
  if (card.value) advance(card.value.primary.go);
};

function onKey(e: KeyboardEvent): void {
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
    v-if="card && board"
    class="result"
  >
    <MatchScene
      :view="board"
      :kit="club.kit"
      :rival-kit="rivalKitOf(rival, club.kit)"
      :us="{ name: club.name || t.sides.us, backName: club.backName, backNumber: club.backNumber }"
      :rival="{ name: rivalTitle, city: club.city }"
      :width="width"
      :shout="null"
      :bump="null"
      :win="card.kind === 'win'"
      intro
    >
      <template
        v-if="card.stars !== null && card.stars > 0 && card.kind !== 'loss'"
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
    <ResultCard
      :card="card"
      @primary="primary"
      @home="go('home')"
      @minute="minute"
    />
  </main>
</template>

<style scoped>
.result { position: absolute; inset: 0; color: var(--text); }
.mine { display: flex; width: fit-content; margin: 8px auto 0; gap: 2px; padding: 3px 9px; border-radius: 14px; background: #efe9d8; border: 2px solid #cfc7ad; font-size: 17px; line-height: 1; }
.mine i { font-style: normal; color: #c98a00; }
</style>

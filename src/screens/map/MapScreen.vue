<script setup lang="ts">
/**
 * Карта Двора (065 Т8, спека 048/054): состояние и входы. Поле — `MapBoard`, правила и переходы — `engine/map`, строки — `ru.map`.
 * Управление (054): ← → дворы, ↑ ↓ уроки (окно уроков открывается само), Enter — переезд (автобус и плашка «Едем…», Э2.08),
 * второй Enter — на матч; Esc — закрыть окно, потом на Дом; в переезде Esc — сразу на Дом (`travelKey`, 065-Р170).
 * `?travel=1` — открыть сразу в переезде (вход с Дома «На матч», 012-Р39). Наведение — подсказка, выбор — клик или стрелки (054-Р1). Колёсика нет (063-Р28, К4).
 * Выбранный урок уходит в матч через `?lesson=<id>`; без выбора — текущий (`course:ru.current`).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PREVIEW_KIT } from '../../app/home/preview';
import { dreamText, fill } from '../../app/home/texts';
import { clubCardOf } from '../../app/club/cardData';
import { sheetOf, windowOf, type MapWindow } from '../../app/map/windows';
import { useNav } from '../../app/nav/useNav';
import { stageScale } from '../../components/shell/stageScale';
import KeyButton from '../../components/kit/KeyButton.vue';
import ScreenHead from '../../components/league/ScreenHead.vue';
import EventPlate from '../../components/panel/EventPlate.vue';
import CoachBubble from '../../components/panel/CoachBubble.vue';
import GoCard from '../../components/panel/GoCard.vue';
import PickCard from '../../components/panel/PickCard.vue';
import { homeView } from '../../engine/home';
import { enterLesson, mapView, navigate, pickYard, travelKey, travelOf, type MapKey, type MapSel, type TravelPhase } from '../../engine/map';
import { ru } from '../../i18n/ru';
import { yardAt } from './geometry';
import ClubCardWindow from './ClubCardWindow.vue';
import LeagueSheet from './LeagueSheet.vue';
import MapBoard from './MapBoard.vue';
import YardLegend from './YardLegend.vue';
import { useMapInput } from './useMapInput';

const t = ru.map;
/** Строка окна уроков — по форме `PickRow` компонента `PickCard` (тип из .vue линтер не видит). */
interface PickRow {
  name: string;
  sub: string;
  stars: string;
  state: 'done' | 'ring' | 'cur';
  sel?: boolean;
  tag?: string;
  mode?: string;
  today?: string;
  play?: string;
}
const router = useRouter();
const nav = useNav();
const route = useRoute();
const { session, stand, pack, player, home, map, club, lessonId, lessonName, data } = useMapInput();
/** Окно поверх Карты (068-Р17): «Лист лиги» или «Карточка клуба»; живёт в адресе `?win=`, стенд кадра ставит его сам. Пока открыто — ввод Карты молчит. */
const mapWin = computed<MapWindow | null>(() => windowOf(stand?.win ?? route.query.win));
function closeWin(): void {
  void router.replace({ path: '/map', query: { ...route.query, win: undefined } });
}

const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
const onResize = (): void => void (win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight });
const W = computed(() => stageScale(win.value.w, win.value.h).width);

const sel = ref<MapSel | undefined>(undefined);
const opened = ref(false);
const hover = ref<number | null>(null);
const going = ref(false);
/** Переезд идёт: автобус на пути, вместо карточки «На матч» — плашка «Едем…» (Э2.08). Вход — Enter на Карте, `?travel=1` или стенд кадра. */
const phase = ref<TravelPhase>(stand?.travel === true || route.query.travel === '1' ? 'travel' : 'idle');

const view = computed(() => (map.value ? mapView(map.value, sel.value) : null));
// стенд кадра (065-Р187): двор выбран и окно уроков открыто с первого кадра — один раз, когда вход собрался
const standPick = stand?.pick;
let standDone = standPick === undefined;
watch(
  [map, view],
  ([m, v]) => {
    if (standDone || !m || !v || standPick === undefined) return;
    standDone = true;
    sel.value = pickYard(m, v.sel, standPick);
    opened.value = true;
  },
  { immediate: true },
);
const hv = computed(() => (home.value ? homeView(home.value) : null));
const sheet = computed(() => (mapWin.value === 'sheet' && home.value && hv.value ? sheetOf(data, home.value.cur, hv.value.stars) : null));
const clubData = computed(() => (mapWin.value === 'club' ? clubCardOf(data, stand?.hardKeys) : null));
/** Итог пройденного двора в шапке окна уроков: «на ★★★: k из n уроков» (ТЗ-1.4). */
const pickSum = computed(() => {
  const node = view.value?.nodes[(view.value?.sel.stage ?? 1) - 1];
  return node?.passed ? fill(t.pickSum, { stars: '★★★', k: node.full, n: node.lessons.length, unit: ru.path.lessonForms.many }) : '';
});
const head = computed(() => (hv.value ? dreamText(hv.value) : null));
const canPlay = computed(() => session.status.value === 'ok' && !going.value);
const trip = computed(() => (view.value ? travelOf(view.value.selLesson.n) : null));
const busOn = computed(() => (phase.value === 'travel' && trip.value ? { stage: trip.value.stage, bus: trip.value.bus } : null));
const tripWho = computed(() => (trip.value ? fill(t.travelWho, { street: trip.value.street }) : ''));
const tripLesson = computed(() => (view.value ? fill(t.travelLesson, { n: view.value.selLesson.n, name: lessonName(view.value.selLesson.n) }) : ''));
const coach = computed(() => (home.value?.day === 1 && home.value.cur === 1 ? t.coachDay1 : ''));
const coachOpen = ref(true);

const stars = (k: number): string => (k ? '★'.repeat(k) + '☆'.repeat(3 - k) : '');
const rows = computed<PickRow[]>(() => {
  const v = view.value;
  if (!v) return [];
  return v.nodes[v.sel.stage - 1]!.lessons
    .filter((l) => l.reach)
    .map((l): PickRow => ({
      name: fill(t.lesson, { n: l.n, name: lessonName(l.n) }),
      sub: l.away ? t.away : t.home,
      stars: stars(l.stars),
      state: l.state === 'near' ? 'cur' : l.state,
      sel: l.n === v.sel.lesson,
      ...(l.control || l.friendly ? { tag: l.control ? t.control : t.friendly } : {}),
      ...(l.state === 'ring' && l.n === v.sel.lesson ? { mode: ru.kit.sheet.pick.rows[1].mode } : {}),
      ...(l.state === 'cur' ? { today: t.today } : {}),
      ...(l.n === v.sel.lesson ? { play: t.play } : {}),
    }));
});
const pick = computed(() => {
  const v = view.value;
  if (!v || !opened.value) return null;
  const at = yardAt(W.value, v.sel.stage);
  return { style: { left: `${at[0] - 160}px`, bottom: `${640 - at[1] + 34}px`, width: '320px' }, street: v.nodes[v.sel.stage - 1]!.street, stage: v.sel.stage };
});
const goLead = computed(() => (view.value ? fill(t.lead, { n: view.value.selLesson.n, where: view.value.selLesson.away ? t.away : t.home }) : ''));
const goRival = computed(() => (view.value ? fill(t.rival, { street: view.value.nodes[view.value.sel.stage - 1]!.street }) : ''));
/** Вид урока — чипом в конце ленты (как в кадре): контрольный — белый, товарищеский — тихий. */
const goKind = computed(() => (view.value?.selLesson.control ? t.control : view.value?.selLesson.friendly ? t.friendly : ''));
/** «Кубок — после урока N»: в день первого запуска (реплика тренера) строки нет, как в кадре Э2.07. */
const goCup = computed(() => {
  const n = view.value?.cupAfter;
  return n != null && !coach.value ? fill(t.cupAfter, { n }) : '';
});

function onPick(stage: number): void {
  if (!map.value || !view.value || phase.value === 'travel') return;
  sel.value = pickYard(map.value, view.value.sel, stage);
  opened.value = true;
}
/**
 * Enter и кнопка: на Карте — показать переезд, в переезде — в матч с выбранным уроком. Холостой Enter (урок недоступен, чужая
 * вкладка, повтор после перехода) ничего не делает (К1, К3).
 */
function go(): void {
  if (!map.value || !view.value || !canPlay.value) return;
  const n = enterLesson(map.value, view.value.sel);
  const id = n === null ? undefined : lessonId(n);
  if (id === undefined) return;
  const step = travelKey(phase.value, 'enter');
  phase.value = step.phase;
  if (step.go !== 'match') {
    opened.value = false;
    return;
  }
  going.value = true;
  void router.push({ path: '/match', query: { lesson: id } });
}
const ARROWS: Record<string, MapKey> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
function key(e: KeyboardEvent): void {
  if (mapWin.value) return; // окно держит Esc, Tab и Enter само (KitModal)
  const arrow = ARROWS[e.key];
  if (going.value) return;
  if (phase.value === 'travel') {
    // в переезде стрелок нет: выбор уже сделан; Esc — назад, на Дом (строка плашки)
    if (e.key === 'Escape' && travelKey(phase.value, 'escape').go === 'home') nav.send({ t: 'esc' });
    else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) go();
    return;
  }
  if (arrow !== undefined && map.value && view.value) {
    e.preventDefault();
    sel.value = navigate(map.value, view.value.sel, arrow);
    opened.value = true;
  } else if (e.key === 'Escape') {
    if (opened.value) opened.value = false;
    else if (coachOpen.value && coach.value) coachOpen.value = false;
    else nav.send({ t: 'esc' });
  } else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) go();
}
onMounted(() => {
  globalThis.addEventListener('keydown', key);
  globalThis.addEventListener('resize', onResize);
});
onUnmounted(() => {
  globalThis.removeEventListener('keydown', key);
  globalThis.removeEventListener('resize', onResize);
});
</script>

<template>
  <main
    v-if="view && home && hv && head"
    class="mapscreen"
  >
    <MapBoard
      :view="view"
      :width="W"
      :built="hv.stadium.built"
      :end="home.end"
      :region="home.region"
      :festive="home.festive === true"
      :kit-body="club.kit?.body ?? PREVIEW_KIT.body"
      :hover="hover"
      :travel="busOn"
      :hide-here="opened || mapWin !== null"
      @pick="onPick"
      @hover="hover = $event"
    />

    <ScreenHead
      :title="t.title"
      :city="club.city || t.defaultCity"
      :stars="`${hv.stars.n}/${hv.stars.of}`"
      :fans="hv.fans.n"
      :coins="hv.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[t.leagueSheet]"
      :open="mapWin === 'sheet' ? t.leagueSheet : undefined"
      @chip="router.push({ path: '/map', query: { ...route.query, win: 'sheet' } })"
    />

    <PickCard
      v-if="pick"
      class="abs pickwin"
      :style="pick.style"
      :title="fill(t.pickTitle, { street: pick.street })"
      :sub="fill(t.pickStep, { n: pick.stage })"
      :rows="rows"
      :hint="t.pickHint"
      :sum="pickSum"
      @close="opened = false"
    />

    <CoachBubble
      :style="{ position: 'absolute', zIndex: 3, left: '12px', bottom: '46px' }"
      :text="coachOpen ? coach : ''"
      :width="W > 1100 ? 430 : 400"
      @close="coachOpen = false"
    />

    <EventPlate
      v-if="phase === 'travel' && trip"
      :style="{ right: '12px', bottom: '12px', width: W > 1100 ? '375px' : '300px' }"
      :sub="t.travelBack"
    >
      <span class="gc-line">{{ trip.away ? t.travelAway : t.travelIncoming }} <b>{{ tripWho }}</b></span>
      <span class="gc-line">{{ tripLesson }}</span>
      <template #action>
        <KeyButton
          primary
          md
          :sub="ru.kit.enter"
          @click="go"
        >
          {{ t.travelGo }}
        </KeyButton>
      </template>
    </EventPlate>
    <GoCard
      v-else-if="!opened"
      :style="{ position: 'absolute', zIndex: 3, right: '12px', bottom: '12px', width: W > 1100 ? '360px' : '300px' }"
      variant="map"
      :lead="home.festive === true ? ru.cup.champion.head : goLead"
      :lead2="home.festive === true ? t.festiveSub : goRival"
      :chip="home.festive === true ? '' : goKind"
      :no-action="home.festive === true"
      :chip-kind="view.selLesson.control ? '' : 'nt'"
      :where="goCup"
      cup
      @go="go"
    />
    <YardLegend v-if="opened && !mapWin" />
    <LeagueSheet
      v-if="sheet"
      :sheet="sheet"
      @close="closeWin"
    />
    <ClubCardWindow
      v-if="clubData"
      :card="clubData"
      :name="club.name"
      :city="club.city || t.defaultCity"
      @close="closeWin"
      @edit="router.push({ path: '/club', query: { edit: '1' } })"
    />
  </main>
  <main
    v-else
    class="mapscreen wait"
  >
    <p v-if="pack.state.value === 'loading' || !player">
      {{ t.loading }}
    </p>
    <template v-else>
      <p>{{ t.packFail }}</p>
      <KeyButton
        primary
        md
        @click="pack.retry()"
      >
        {{ t.packRetry }}
      </KeyButton>
    </template>
  </main>
</template>

<style scoped>
.mapscreen {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.abs {
  position: absolute;
}
.gc-line {
  display: block;
  white-space: nowrap;
}
.pickwin {
  z-index: 5;
}
.wait {
  display: grid;
  place-content: center;
  gap: 12px;
  text-align: center;
}
</style>

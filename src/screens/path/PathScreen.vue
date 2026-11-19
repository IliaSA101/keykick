<script setup lang="ts">
/**
 * Путь клуба во Дворе (067 Т10, кадры Э7.113, 168, 174, 183, 184, 186, 189, 191): Двор на картинке, шкала шести лиг, главная карточка
 * как на Доме (`mainText`), подсказка клавиш. Камера = выбор = Двор (054-Р1); Район «строится» (П-З3). Ввод — через `useNav`:
 * Esc — Дом, колёсико и ← → — модель навигации, упор «дальше» качает шкалу (М7). Ничего не считает: вид — `pathView`.
 */
import { computed, inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { useGoMatch } from '../../app/home/useGoMatch';
import { useHomeInput } from '../../app/home/useHomeInput';
import { PREVIEW_KIT } from '../../app/home/preview';
import { sceneOf, seedOf } from '../../app/home/scene';
import { dreamText, fill, mainText } from '../../app/home/texts';
import { bumpCount, takeEntering, useNav } from '../../app/nav/useNav';
import { isNarrowStage } from '../../components/shell/stageScale';
import { useStageWidth } from '../../components/home/useStageWidth';
import KeyCap from '../../components/kit/KeyCap.vue';
import KitChip from '../../components/kit/KitChip.vue';
import ScreenHead from '../../components/league/ScreenHead.vue';
import GoCard from '../../components/panel/GoCard.vue';
import { crowdHue } from '../../engine/club/crowd';
import type { ClubKit } from '../../engine/club/section';
import { homeView, type HomeInput } from '../../engine/home';
import { isLeague } from '../../engine/nav';
import { PACKS_YARD } from '../../engine/album/order';
import { enterFrame, pathTip, pathView } from '../../engine/path';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import PathEntry from './PathEntry.vue';
import PathLevels from './PathLevels.vue';
import PathScale from './PathScale.vue';
import { PATH_STAND } from './stand';
import { useEnterRun } from './useEnterRun';

const t = ru.path;
const nav = useNav();
const stand = inject<(() => { over?: Partial<HomeInput>; seed?: number }) | null>('kk-home-stand', null)?.() ?? null;
const pathStand = inject(PATH_STAND, null)?.() ?? null;
const { plan, t: run } = useEnterRun(takeEntering(), pathStand); // вид входа забираем и забываем (адрес и F5 — без отъезда)
const W = useStageWidth();
const narrow = computed(() => isNarrowStage(W.value));

const { session, pack, player, data, input, lessonName } = useHomeInput(stand?.over);
const hv = computed(() => (input.value ? homeView(input.value) : null));
const club = computed(() => data<{ name: string; city: string; kit?: ClubKit }>('club', { name: '', city: '' }));
const album = computed(() => data<{ packs: number }>('album', { packs: 0 }).packs);
const view = computed(() => (input.value ? pathView({ cur: input.value.cur, regionOpen: input.value.region }) : null));
// --- отъезд от Дома (М8): слой Дома над Двором, Двор приближен; без движения — только прозрачность
const frame = computed(() => enterFrame(run.value));
const move = computed(() => plan?.move === true);
const entering = computed(() => plan !== null && run.value < 1);
const scene = computed(() => (input.value && hv.value && entering.value && plan?.home ? sceneOf(input.value, hv.value, stand?.seed ?? seedOf(player.value?.pid)) : null));
const zoom = computed(() => (entering.value && move.value ? { k: frame.value.k, origin: frame.value.origin } : undefined));
const gateOp = computed(() => (!entering.value ? 1 : move.value ? frame.value.gateOpacity : run.value));
const hereOp = computed(() => (!entering.value ? 1 : move.value ? frame.value.hereOpacity : run.value));
const walk = computed(() => (entering.value && move.value ? ([frame.value.hereDx, frame.value.hereDy] as const) : undefined));
const main = computed(() => (hv.value ? mainText(hv.value, lessonName) : null));
const head = computed(() => (hv.value ? dreamText(hv.value) : null));
const { go } = useGoMatch(session);
const kitBody = computed(() => club.value.kit?.body ?? PREVIEW_KIT.body);

// подсказка у деления: мышь (в кадрах — из стенда), не выбор (Z1)
const hover = ref<string | null>(pathStand?.hover ?? null);
const tip = computed(() => {
  const v = view.value;
  const h = hover.value;
  if (!v || h === null || !isLeague(h)) return null;
  const tp = pathTip(v, h);
  const name = ru.league.names[h];
  if (!tp) return null;
  if (tp.kind === 'lessons') return fill(t.tipLessons, { name, n: tp.n, lessons: plural(tp.n, t.lessonForms) });
  if (tp.kind === 'gate') return fill(t.tipGate, { name, state: tp.open ? t.gate.open : t.gate.building });
  return fill(t.tipAfter, { name, prev: ru.league.after[tp.prev as keyof typeof ru.league.after] });
});

// упор колёсика «дальше»: шкала качается, «Район» светлеет (М7); счётчик живёт в useNav
const nudge = ref(0);
watch(bumpCount, (n) => (nudge.value = n));

function key(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    if (!e.repeat) nav.send({ t: 'esc' }); // удержанная клавиша не гонит Путь → Дом → дальше
  } else if (e.key === 'ArrowLeft') nav.send({ t: 'arrow', dir: 'left' });
  else if (e.key === 'ArrowRight') nav.send({ t: 'arrow', dir: 'right' });
  else if (e.key === 'Enter' && !e.repeat && !(e.target instanceof HTMLButtonElement)) go();
}
function wheel(e: WheelEvent): void {
  if (e.deltaY !== 0) nav.send({ t: 'wheel', dir: e.deltaY > 0 ? 'out' : 'in' });
}
onMounted(() => {
  globalThis.addEventListener('keydown', key);
  globalThis.addEventListener('wheel', wheel, { passive: true });
});
onUnmounted(() => {
  globalThis.removeEventListener('keydown', key);
  globalThis.removeEventListener('wheel', wheel);
});
</script>

<template>
  <main
    v-if="view && hv && main && head"
    class="path"
    :class="{ narrow }"
  >
    <PathLevels
      :view="view"
      :width="W"
      :built="hv.stadium.built"
      :stars="`${hv.stars.n}/${hv.stars.of}`"
      :album="album"
      :album-of="PACKS_YARD"
      :flag="kitBody"
      :gate-op="gateOp"
      :here-op="hereOp"
      :zoom="zoom"
      :walk="walk"
    />
    <PathEntry
      v-if="scene && hv && input && entering"
      :view="hv"
      :input="input"
      :scene="scene"
      :width="W"
      :hue="crowdHue(club.kit)"
      :frame="frame"
      :move="move"
      :fade="1 - run"
    />
    <ScreenHead
      class="head"
      :title="fill(t.title, { club: club.name || ru.home.defaultClub })"
      :city="club.city || '—'"
      :stars="`${hv.stars.n}/${hv.stars.of}`"
      :fans="hv.fans.n"
      :coins="hv.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[ru.home.leagueSheet]"
    />
    <GoCard
      class="go"
      :style="{ right: '12px', bottom: '100px', width: narrow ? '340px' : '400px' }"
      :lead="main.lead"
      :chip="main.tag?.text ?? ''"
      :chip-kind="main.tag?.kind ?? ''"
      :action="main.action"
      :where="main.where"
      :record="main.record"
      @go="go"
    />
    <div class="kb-chip tip hint">
      <span class="ln">{{ t.hintWheel }} <KeyCap arrow="left" /><KeyCap arrow="right" /> {{ t.hintScale }} <KeyCap>Esc</KeyCap> {{ t.hintHome }}</span>
    </div>
    <div
      v-if="tip"
      class="tipbox"
    >
      <KitChip :tip="[tip]" />
    </div>
    <PathScale
      :scale="view.scale"
      :nudge="nudge"
      :hover="hover"
      :flag="kitBody"
      @hover="hover = $event"
    />
  </main>
  <main
    v-else
    class="path wait"
  >
    <p v-if="pack.state.value === 'loading' || !player">
      {{ ru.home.loading }}
    </p>
  </main>
</template>

<style scoped>
.path {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.head {
  z-index: 2; /* над слоем Дома `PathEntry` (z-index 1): строка экрана видна с t = 0 (054-Р10) */
}
.go {
  position: absolute;
  z-index: 3;
}
.hint {
  position: absolute;
  left: 16px;
  bottom: 34px; /* над строкой подвала («Игрок: … · Старая версия»), как .kb-coach Дома */
  z-index: 3;
}
.tipbox {
  position: absolute;
  right: 440px;
  bottom: 14px;
  z-index: 4;
  pointer-events: none;
}
.narrow .hint {
  bottom: 48px; /* на узкой сцене подвал — две строки */
}
.wait {
  display: grid;
  place-content: center;
  text-align: center;
}
</style>

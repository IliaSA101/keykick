<script setup lang="ts">
/**
 * Дом Двора (065 Т7, спека 048): состояние и входы; картинка двора — `HomeScene`, ярлыки и окна — `HomeHouses`, нижний ряд —
 * `HomeCards`, тренер — здесь. Экран ничего не считает: `homeView` отдаёт ключи и числа, `app/home/texts.ts` — строки.
 * Enter — главная кнопка, Esc — закрыть окно стенда, реплику или окно. Газета (068 Т7): вход открывает непоказанный выпуск окном поверх Дома
 * (`useStoryEntry`), стенд — окно «Стенгазета» с «Читать» (`StandCard`); комикс (Завязка, вехи Кубка) — окно `ComicWindow` по тому же входу; пока окно открыто, клавиши Дома молчат. Вторая вкладка (`busy`, `readonly`): просмотр, «На матч» неактивна (063 З1).
 */
import { computed, inject, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import cfg from '../../content/yard.json';
import { useGoMatch } from '../../app/home/useGoMatch';
import { useNav } from '../../app/nav/useNav';
import { useHomeInput } from '../../app/home/useHomeInput';
import { useComicView } from '../../app/story/useComicView';
import { homePaperIsArchive } from '../../app/story/newsOf';
import { useNewsView } from '../../app/story/useNewsView';
import { useStoryEntry } from '../../app/story/useStoryEntry';
import { newStepId, sceneOf, seedOf, stepGrew } from '../../app/home/scene';
import { dreamText, mainText, cupText } from '../../app/home/texts';
import { isNarrowStage } from '../../components/shell/stageScale';
import { useStageWidth } from '../../components/home/useStageWidth';
import ScreenHead from '../../components/league/ScreenHead.vue';
import KeyButton from '../../components/kit/KeyButton.vue';
import CoachBubble from '../../components/panel/CoachBubble.vue';
import { coachWidth } from '../../components/panel/coachWidth';
import HomeCards from '../../components/home/HomeCards.vue';
import HomeHouses from '../../components/home/HomeHouses.vue';
import HomeScene from '../../components/home/HomeScene.vue';
import ComicWindow from '../../components/story/ComicWindow.vue';
import NewsWindow from '../../components/story/NewsWindow.vue';
import StandCard from '../../components/story/StandCard.vue';
import { crowdHue } from '../../engine/club/crowd';
import { coachNameOf } from '../../engine/club/start';
import type { ClubKit } from '../../engine/club/section';
import { homeView, type HomeInput, type HouseId } from '../../engine/home';
import { cupDef, type Cup } from '../../engine/cup';
import { releasedPapers, storyDef, type ComicId, type Story } from '../../engine/story';
import { ru } from '../../i18n/ru';

const t = ru.home;
/** Здания с экраном: ярлык открывает его, когда замок снят (Музей клуба, 067 Т11). */
const HOUSE_ROUTES: Partial<Record<HouseId, string>> = { museum: '/museum', locker: '/locker' };
const router = useRouter();
const nav = useNav();
/** Стенд кадров: семя, поставщики следующих волн, окна кадра. В игре — null (065-Р64). */
const stand = inject<(() => { seed?: number; over?: Partial<HomeInput>; peek?: boolean; coach?: boolean; noBanner?: boolean }) | null>('kk-home-stand', null)?.() ?? null;

// --- размеры сцены: ширина в базовых px (1138 на 1920, 1024 на узком окне)
const W = useStageWidth();
const narrow = computed(() => isNarrowStage(W.value));

// --- вход правил из разделов сеанса (общий с Картой)
const homeIn = useHomeInput(stand?.over);
const { session, pack, player, data, input, lessonName } = homeIn;
const view = computed(() => (input.value ? homeView(input.value) : null));
const club = computed(() => data<{ name: string; city: string; kit?: ClubKit; coach?: string }>('club', { name: '', city: '' }));
/** Цвета клуба у людей на трибуне (Р80): оттенок формы или null — спрайты как есть. */
const hue = computed(() => crowdHue(club.value.kit));

// --- сцена и моушн М4 (ступень выросла с прошлого показа Дома)
const seed = computed(() => stand?.seed ?? seedOf(player.value?.pid));
const scene = computed(() => (input.value && view.value ? sceneOf(input.value, view.value, seed.value) : null));
const shown = new Map<string, number>();
const grow = ref(false);
const prevBase = shallowRef('');
watch(view, (v) => {
  const pid = player.value?.pid;
  if (!v || !pid || grow.value) return;
  const prev = shown.get(pid) ?? null;
  if (stepGrew(prev, v.stadium.built)) {
    prevBase.value = scene.value?.base.replace(/base-\d+/, `base-${prev}`) ?? '';
    grow.value = true;
  }
  shown.set(pid, v.stadium.built);
}, { immediate: true });
const newStep = computed(() => (input.value && stand?.noBanner !== true ? newStepId(input.value.cur, cfg.steps, input.value.pause5) : null));

// --- газета (068 Т7): окно выпуска (вход на Дом или «Читать» со стенда) и окно стенда; на стенде кадров окна — из фикстуры (`kk-story-stand`)
const storyStand = inject<(() => { window?: { stand?: boolean } }) | null>('kk-story-stand', null)?.() ?? null;
const entered = useStoryEntry(homeIn, storyStand !== null);
const paperN = ref<number | null>(null);
const comicId = ref<ComicId | null>(null);
/** Окно входа: комикс или выпуск (одно за вход, комикс раньше); закрытое открывается снова только «Читать» со стенда. */
watch(entered, (w) => {
  paperN.value = w?.kind === 'paper' ? w.n : null;
  comicId.value = w?.kind === 'comic' ? w.id : null;
}, { immediate: true });
const standOpen = ref(storyStand?.window?.stand === true);
const latestPaper = computed(() => releasedPapers(data<Story>(storyDef.name, storyDef.empty())).at(-1) ?? null);
const comic = useComicView(() => comicId.value);
/** Выпуск 8 после серебра и затем золота — архивный (068-Р55); прочие — как вышли. */
const archiveOf = (n: number): boolean => homePaperIsArchive(n, data<Story>(storyDef.name, storyDef.empty()), data<Cup>(cupDef.name, cupDef.empty()));
const news = useNewsView(() => (paperN.value === null ? null : { n: paperN.value, archive: archiveOf(paperN.value) }));
const standHead = useNewsView(() => (standOpen.value && latestPaper.value !== null ? { n: latestPaper.value, archive: archiveOf(latestPaper.value) } : null));
/** Стенд: есть выпуск — окно «Стенгазета», нет — заглушка здания (как было до газеты). */
function onStand(): void {
  if (latestPaper.value === null) building.value = true;
  else standOpen.value = true;
}
function read(): void {
  paperN.value = latestPaper.value;
  standOpen.value = false;
}

// --- состояние окна: реплика тренера, «что построят», заглушка здания
const coachOpen = ref(true);
const coachText = ref('');
const peek = ref(stand?.peek === true);
const building = ref(false);
watch(input, (i) => {
  if (!i) return;
  coachText.value = stand?.coach === true ? t.coach.tip : i.pause5 ? t.coach.back : i.day === 1 && i.cur === 1 ? t.coach.day1 : i.day === 2 ? t.coach.day2 : '';
  coachOpen.value = true;
}, { immediate: true });
const coachShown = computed(() => (coachOpen.value ? coachText.value : ''));
const { canPlay, go } = useGoMatch(session);
const main = computed(() => (view.value ? mainText(view.value, lessonName) : null));
const cup = computed(() => (view.value ? cupText(view.value) : null));
const head = computed(() => (view.value ? dreamText(view.value) : null));

function key(e: KeyboardEvent): void {
  if (paperN.value !== null || comicId.value !== null) return; // окно газеты и комикса ловят Enter и Esc сами (захват), Дом под ними молчит
  if (e.key === 'Escape') {
    if (e.repeat) return; // удержанная клавиша закрывает по одному слою, а не все сразу
    if (building.value) building.value = false;
    else if (peek.value) peek.value = false;
    else if (standOpen.value) standOpen.value = false;
    else coachOpen.value = false;
  } else if (e.key === 'Enter' && !building.value && !(e.target instanceof HTMLButtonElement)) go();
}
onMounted(() => globalThis.addEventListener('keydown', key));
onUnmounted(() => globalThis.removeEventListener('keydown', key));
</script>

<template>
  <main
    v-if="view && input && scene && main && cup && head"
    class="home"
    :class="{ narrow }"
  >
    <HomeScene
      v-model:peek="peek"
      :view="view"
      :input="input"
      :scene="scene"
      :width="W"
      :grow="grow"
      :prev-base="prevBase"
      :hue="hue"
      @grown="grow = false"
    />

    <ScreenHead
      :title="`«${club.name || t.defaultClub}»`"
      :city="club.city || '—'"
      :stars="`${view.stars.n}/${view.stars.of}`"
      :fans="view.fans.n"
      :coins="view.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[t.leagueSheet]"
      coins-link
      @coins="router.push('/shop')"
    />

    <HomeHouses
      :view="view"
      :input="input"
      :scene="scene"
      :width="W"
      :peek="peek"
      :building="building"
      :new-step="newStep"
      :stand-open="standOpen"
      @build="building = true"
      @stand="onStand"
      @open="(house) => router.push(HOUSE_ROUTES[house] ?? '/home')"
      @close-building="building = false"
    />

    <StandCard
      v-if="standOpen && standHead"
      :head="standHead.view.head"
      :width="W"
      @read="read"
      @close="standOpen = false"
    />

    <CoachBubble
      class="abs coach"
      :text="coachShown"
      :width="coachWidth(narrow)"
      :name="coachNameOf(club.coach)"
      @close="coachOpen = false"
      @again="coachText = t.coach.tip; coachOpen = true"
    />

    <HomeCards
      :main="main"
      :cup="cup"
      :width="W"
      :narrow="narrow"
      :can-play="canPlay"
      @play="go"
      @map="nav.send({ t: 'chipMap' })"
      @cup="router.push('/cup')"
    />
    <ComicWindow
      v-if="comicId !== null && comic"
      :view="comic.view"
      :coach="comic.coach"
      @close="comicId = null"
    />
    <NewsWindow
      v-if="paperN !== null && news"
      :view="news.view"
      :color="news.color"
      back="home"
      @close="paperN = null"
    />
  </main>
  <main
    v-else
    class="home wait"
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
.home {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.coach {
  position: absolute;
  z-index: 3;
  /* место (left 12, bottom 34 — над строкой подвала в одну строку, 065-Р160) задаёт общий .kb-coach (styles/kit/coach.css) */
}
.wait {
  display: grid;
  place-content: center;
  gap: 12px;
  text-align: center;
}
</style>

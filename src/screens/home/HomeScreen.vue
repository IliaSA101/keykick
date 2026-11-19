<script setup lang="ts">
/**
 * Дом Двора (065 Т7, спека 048): состояние и входы; картинка двора — `HomeScene`, ярлыки и окна — `HomeHouses`, нижний ряд —
 * `HomeCards`, тренер — здесь. Экран ничего не считает: `homeView` отдаёт ключи и числа, `app/home/texts.ts` — строки.
 * Enter — главная кнопка, Esc — закрыть реплику/окно. Вторая вкладка (`busy`, `readonly`): просмотр, «На матч» неактивна (063 З1).
 */
import { computed, inject, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import cfg from '../../content/yard.json';
import { useGoMatch } from '../../app/home/useGoMatch';
import { useNav } from '../../app/nav/useNav';
import { useHomeInput } from '../../app/home/useHomeInput';
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
import { crowdHue } from '../../engine/club/crowd';
import { coachNameOf } from '../../engine/club/start';
import type { ClubKit } from '../../engine/club/section';
import { homeView, type HomeInput, type HouseId } from '../../engine/home';
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
const { session, pack, player, data, input, lessonName } = useHomeInput(stand?.over);
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
  if (e.key === 'Escape') {
    if (e.repeat) return; // удержанная клавиша закрывает по одному слою, а не все сразу
    if (building.value) building.value = false;
    else if (peek.value) peek.value = false;
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
      @build="building = true"
      @open="(house) => router.push(HOUSE_ROUTES[house] ?? '/home')"
      @close-building="building = false"
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

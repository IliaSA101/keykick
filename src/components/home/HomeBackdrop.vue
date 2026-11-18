<script setup lang="ts">
/**
 * Фон первого запуска (063-Р49, Т6в): Дом дня 1 (Э2.01) — те же части, что рисует Дом (`HomeScene`, `HomeHouses`, `HomeCards`, шапка),
 * без тренера, подписей мест и интерактива (`inert`). Игрока ещё нет: вход Дома собирается из пустых разделов, как у нового игрока
 * (`homeInputOf`), без сохранения и без пакета — для урока 1 нужен только его id.
 * Виды: `home` — весь Дом под окном, размытый на 3 px (кадры Э6.71–82, затемнение 0,8 даёт окно: `dim-color`);
 * `scene` — только картинка двора, размытая сильнее и затемнённая (кадры «Твой клуб», выбор тренера — Э2К.34–37, затемнение окна 0,68);
 * `show` — весь Дом без размытия: витрина «Открой на компьютере» (063-Р61, Э6.101–102). С `preview` Дом стоит не на дне 1, а на уроке
 * `preview.lesson` выдуманного игрока (`app/home/preview`: тот же `homeInputOf`, сохранение не читается), с клубом «Прогресс» · Тверь.
 */
import { computed } from 'vue';
import { homeInputOf } from '../../app/home/input';
import { PREVIEW_KIT, previewInputOf } from '../../app/home/preview';
import { sceneOf } from '../../app/home/scene';
import { cupText, dreamText, mainText } from '../../app/home/texts';
import { crowdHue } from '../../engine/club/crowd';
import { FIRST_LESSON, ruCourseDef } from '../../engine/course/section';
import { emptyDay } from '../../engine/day/section';
import { homeView } from '../../engine/home';
import { emptyStadium } from '../../engine/home/section';
import { ru } from '../../i18n/ru';
import ScreenHead from '../league/ScreenHead.vue';
import { isNarrowStage } from '../shell/stageScale';
import HomeCards from './HomeCards.vue';
import HomeHouses from './HomeHouses.vue';
import HomeScene from './HomeScene.vue';
import { useStageWidth } from './useStageWidth';

/** Витрина: на каком уроке стоит выдуманный игрок, порядок уроков пакета и названия (`lessonName`; пакета нет — пусто). */
export interface BackdropPreview {
  lesson: number;
  order: readonly string[];
  lessonName: (n: number) => string;
}
const props = defineProps<{ mode: 'home' | 'scene' | 'show'; preview?: BackdropPreview }>();
const t = ru.home;
/** Рассадка людей на дне 1 не нужна (болельщиков нет), семя — любое постоянное. */
const SEED = 1;
const width = useStageWidth();
const today = new Date().toLocaleDateString('sv-SE');
const input = props.preview
  ? previewInputOf(props.preview.order, props.preview.lesson, today)
  : homeInputOf(
      { course: ruCourseDef.empty(), day: emptyDay(), wallet: { coins: 0, rest: 0, paid: [] }, stadium: emptyStadium() },
      { order: [FIRST_LESSON.ru!], friendly: new Set() },
      {},
      today,
    );
const hue = props.preview ? crowdHue(PREVIEW_KIT) : null;
const view = homeView(input);
const scene = computed(() => sceneOf(input, view, SEED));
const main = mainText(view, props.preview?.lessonName ?? (() => ''));
const cup = cupText(view);
const head = dreamText(view);
const noop = (): void => undefined;
</script>

<template>
  <div
    class="backdrop"
    :class="mode"
    aria-hidden="true"
    inert
  >
    <HomeScene
      :view="view"
      :input="input"
      :scene="scene"
      :width="width"
      :grow="false"
      prev-base=""
      :peek="false"
      :hue="hue"
    />
    <template v-if="mode !== 'scene'">
      <ScreenHead
        :title="`«${t.defaultClub}»`"
        :city="preview ? ru.map.defaultCity : '—'"
        :stars="`${view.stars.n}/${view.stars.of}`"
        :fans="view.fans.n"
        :coins="view.coins"
        :dream-text="head.text"
        :dream-pct="head.pct"
        :chips="[t.leagueSheet]"
      />
      <HomeHouses
        :view="view"
        :input="input"
        :scene="scene"
        :width="width"
        :peek="false"
        :building="false"
        :new-step="null"
        @build="noop"
        @close-building="noop"
      />
      <HomeCards
        :main="main"
        :cup="cup"
        :width="width"
        :narrow="isNarrowStage(width)"
        :can-play="preview !== undefined"
        @play="noop"
        @map="noop"
        @cup="noop"
      />
    </template>
  </div>
</template>

<style scoped>
.backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
/* Э6.71–82: Дом размыт на 3 px, подписи мест скрыты (кадр «Дом под окном», system.mjs) */
.home {
  filter: blur(3px);
}
.home :deep(.kb-place),
.show :deep(.kb-place) {
  visibility: hidden;
}
/* Э2К.34–37: картинка двора под окном — blur 9 px, ярче 0,52, насыщенность 0,85, чуть крупнее краёв (ce-scene.blur) */
.scene {
  filter: blur(9px) brightness(0.52) saturate(0.85);
  transform: scale(1.06);
}
</style>

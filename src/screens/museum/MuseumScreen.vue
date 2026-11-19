<script setup lang="ts">
/**
 * Музей клуба (067 Т11, 068 Т11; ТЗ-5.10; Э2К.26–30, .39/.40): белый павильон изнутри — стенд газет 2×4 (`MuseumPapers`), кубок на тумбе (`MuseumCup`), стенд «Стадион
 * «Коробка»» с Двором целиком, «Кубки лиг» и на скамье телевизор «Видео · N из 4». Места — по картинке сцены 1920×1072 через `geometry` Дома.
 * Выпуск с полки открывает окно архива (`NewsWindow`, Э6.11): Esc или Enter возвращают в Музей, флаг «показан» не трогаем. Телевизор после титула
 * проигрывает ролик Двора. Esc или «Дом · Esc» — домой. Данные — разделы `story`, `cup`, `stadium` через вход Дома (`app/museum/provide.ts`).
 */
import { computed, inject, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { artUrl } from '../../art/assets';
import { useHomeInput } from '../../app/home/useHomeInput';
import { cupText, dreamText, fill } from '../../app/home/texts';
import { sceneOf } from '../../app/home/scene';
import { cupWonOf, museumDataOf } from '../../app/museum/provide';
import { useNewsView, useNewsViews } from '../../app/story/useNewsView';
import { K, offOf, sxOf, syOf } from '../../components/home/geometry';
import { useStageWidth } from '../../components/home/useStageWidth';
import ScreenHead from '../../components/league/ScreenHead.vue';
import { clubDef, type Club } from '../../engine/club/section';
import NewsWindow from '../../components/story/NewsWindow.vue';
import { emptyCup, type Cup } from '../../engine/cup';
import { homeView, paperFreshMark, paperMarkOnHome } from '../../engine/home';
import { museumView, papersShelf } from '../../engine/museum';
import { emptyStory, releasedPapers, type Story } from '../../engine/story';
import MuseumCup from './MuseumCup.vue';
import MuseumPapers from './MuseumPapers.vue';
import MuseumVideo from './MuseumVideo.vue';
import { ru } from '../../i18n/ru';

const t = ru.museum;
const router = useRouter();
/** Стенд кадров: покупки кадра; в игре — null. */
const stand = inject<(() => { bought?: string[] }) | null>('kk-museum-stand', null)?.() ?? null;
const { input, data } = useHomeInput();
const width = useStageWidth();
const club = computed<Club>(() => data<Club>('club', clubDef.empty()));
const view = computed(() => (input.value ? homeView(input.value) : null));
const head = computed(() => (view.value ? dreamText(view.value) : null));
const story = computed(() => data<Story>('story', emptyStory()));
const cup = computed(() => data<Cup>('cup', emptyCup()));
const cupWon = computed(() => cupWonOf(cup.value));
const shelves = computed(() => museumView(stand?.bought ?? input.value?.bought ?? [], museumDataOf(cup.value, input.value?.cur ?? 0)));
const released = computed(() => releasedPapers(story.value));
/** Свежий — последний вышедший выпуск, пока он день выхода и до урока 31 (с 31 — метка на Стенгазете Дома, 049-Р37). */
const fresh = computed(() => (input.value && paperFreshMark(input.value) ? (released.value.at(-1) ?? null) : null));
const papers = computed(() => papersShelf(released.value, fresh.value));
const minis = useNewsViews(() => released.value);
const openN = ref<number | null>(null);
const news = useNewsView(() => (openN.value === null ? null : { n: openN.value, archive: true }));
const videoOn = ref(false);
const base = import.meta.env.BASE_URL;
/** Двор для стенда: тот же кадр ступени, что на Доме; врезка — стадион (593…1479 × 418…928 px кадра, как в макете). */
const yardImg = computed(() => (input.value && view.value ? `${base}${sceneOf(input.value, view.value, 1).base}` : ''));
const CROP = 'background-size:216.704% auto;background-position:57.350% 74.222%';

const sx = (x: number): number => sxOf(width.value, x);
/** Низ балки над точкой x (px сцены): задняя перемычка — 288, косые балки по краям выше (измерено по кадру макета). */
const beamY = (x: number): number => (x < 452 ? 240 - (452 - x) * 0.26 : x > 1472 ? 288 - (x - 1472) * 0.25 : 288);
/** Доска на двух шнурах к балкам: рамка в px сцены (x0, y0, x1) → стили доски и шнуров. */
function board(x0: number, y0: number, x1: number): { box: Record<string, string>; ropes: Record<string, string>[] } {
  return {
    box: { left: `${sx(x0)}px`, top: `${syOf(y0)}px`, width: `${sx(x1) - sx(x0)}px` },
    ropes: [x0 + 14, x1 - 14].map((x) => ({ left: `${sx(x) - 1}px`, top: `${syOf(beamY(x))}px`, height: `${syOf(y0) - syOf(beamY(x))}px` })),
  };
}
const stadium = computed(() => board(1106, 316, 1522));
const paperBoard = computed(() => board(150, 316, 780));
/** Ширина миниатюры: доска минус поля 2×9, рамка 2×2 и три зазора по 4 — на четыре колонки. */
const cell = computed(() => (sx(780) - sx(150) - 18 - 4 - 12) / 4);
const cupStage = computed(() => (view.value ? cupText(view.value).state : ''));
const leagues = computed(() => board(1546, 286, 1808));
/** Телевизор: ширина 150 px сцены, ножки на верху скамьи (низ — y 792, центр x 1600); картинка 360×317, экран — тёмный прямоугольник в долях. */
const TV = { w: 360, h: 317, screen: [9.2, 14.5, 65.8, 57.1] as const };
const tv = computed(() => {
  const w = 150 * K;
  return { left: `${sx(1600) - w / 2}px`, top: `${syOf(792) - (w * TV.h) / TV.w}px`, width: `${w}px`, aspectRatio: `${TV.w} / ${TV.h}` };
});
const screenBox = { left: `${TV.screen[0]}%`, top: `${TV.screen[1]}%`, width: `${TV.screen[2]}%`, height: `${TV.screen[3]}%` };
const caption = computed(() => ({ left: `${sx(1600)}px`, top: `${syOf(838)}px` }));
const sceneBox = computed(() => ({ left: `${offOf(width.value)}px`, width: `${1920 * K}px` }));

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && openN.value === null && !videoOn.value) void router.push('/home');
}
onMounted(() => globalThis.addEventListener('keydown', onKey));
onUnmounted(() => globalThis.removeEventListener('keydown', onKey));
</script>

<template>
  <main class="museum">
    <img
      class="scene"
      :style="sceneBox"
      :src="artUrl(cupWon ? 'albumMuseumGold' : 'albumMuseumIn')"
      alt=""
    >
    <div class="scrim" />
    <ScreenHead
      v-if="view && head"
      :title="ru.home.houses.museum"
      :city="`«${club.name}»`"
      :stars="`${view.stars.n}/${view.stars.of}`"
      :fans="view.fans.n"
      :coins="view.coins"
      :dream-text="head.text"
      :dream-pct="head.pct"
      :chips="[`${ru.frame.menu.home} · ${ru.kit.esc}`]"
      @chip="router.push('/home')"
    />

    <template v-if="input">
      <i
        v-for="(r, i) in paperBoard.ropes"
        :key="`p${i}`"
        class="rope"
        :style="r"
      />
      <section
        class="board papers"
        :style="paperBoard.box"
      >
        <MuseumPapers
          v-if="minis"
          :shelf="papers"
          :views="minis.views"
          :color="minis.color"
          :cell="cell"
          :note="paperMarkOnHome(input)"
          @open="openN = $event"
        />
      </section>

      <MuseumCup
        :won="cupWon"
        :stage="cupStage"
        :width="width"
      />

      <i
        v-for="(r, i) in stadium.ropes"
        :key="`s${i}`"
        class="rope"
        :style="r"
      />
      <section
        class="board stadium"
        :style="stadium.box"
      >
        <div class="bh">
          <b>{{ ru.home.stadium }}</b><span>{{ fill(t.bought, { n: String(shelves.bought), of: String(shelves.boughtOf) }) }}</span>
        </div>
        <div
          class="yard"
          :style="`background-image:url('${yardImg}');${CROP}`"
        />
      </section>

      <i
        v-for="(r, i) in leagues.ropes"
        :key="`l${i}`"
        class="rope"
        :style="r"
      />
      <section
        class="board"
        :style="leagues.box"
      >
        <div class="bh">
          <b>{{ t.leagues }}</b>
        </div>
        <div class="lg">
          <span
            v-for="l in shelves.leagues"
            :key="l.id"
            class="lc"
            :class="{ gold: l.won }"
          >
            <img
              :src="artUrl('albumCupYardGold')"
              alt=""
            ><i>{{ ru.league.names[l.id] }}</i>
          </span>
        </div>
      </section>

      <button
        type="button"
        class="tv"
        :class="{ off: shelves.videos === 0 }"
        :style="tv"
        :disabled="!cupWon"
        @click="videoOn = true"
      >
        <img
          :src="artUrl('albumTvWhite')"
          alt=""
        >
        <span
          class="tvs"
          :style="shelves.videos > 0 ? { ...screenBox, backgroundImage: `url('${yardImg}')` } : screenBox"
        ><i /></span>
      </button>
      <div
        class="cap"
        :style="caption"
      >
        <b>{{ fill(t.video, { n: String(shelves.videos), of: String(shelves.videosOf) }) }}</b>
      </div>
    </template>
    <NewsWindow
      v-if="news"
      :view="news.view"
      :color="news.color"
      back="museum"
      archive
      @close="openN = null"
    />
    <MuseumVideo
      v-if="videoOn"
      @close="videoOn = false"
    />
  </main>
</template>

<style scoped>
/* числа — единицы макета Э2К (collection-e.css, collection-e-museum.css); золота рядом с синим нет: рамки досок нейтральные */
.museum {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.scene {
  position: absolute;
  top: 0;
  height: 100%;
  object-fit: cover;
}
.scrim {
  position: absolute;
  inset: 0 0 auto;
  height: 170px;
  background: linear-gradient(#000d 0, #000b 55%, #0000);
  pointer-events: none;
}
.board {
  position: absolute;
  z-index: 4;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 9px 8px;
  border: 2px solid #dcd3bb;
  border-radius: 5px;
  background: #f3eddd;
  box-shadow: 8px 10px 16px #0007, inset 0 0 0 1px #fff;
  color: #2b2a26;
}
.bh {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  column-gap: 12px;
  min-height: 18px;
}
.bh b {
  font-size: 13px;
  line-height: 1.1;
  white-space: nowrap;
}
.bh span {
  font-size: 12px;
  color: #6b6652;
  white-space: nowrap;
}
.rope {
  position: absolute;
  z-index: 3;
  width: 2px;
  background: #d9d2c2;
  box-shadow: 0 0 2px #0008;
}
.rope::before {
  content: '';
  position: absolute;
  left: -2px;
  top: -2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d9d2c2;
  box-shadow: 0 0 2px #0008;
}
.yard {
  display: block;
  width: 100%;
  aspect-ratio: 886 / 509;
  border-radius: 2px;
  background-repeat: no-repeat;
  box-shadow: 0 0 0 1px #cfc6ad;
}
.lg {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.lc {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 3px 0;
  border-radius: 6px;
}
.lc img {
  display: block;
  height: 36px;
  width: auto;
  filter: brightness(0) opacity(0.42);
}
.lc i {
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
  letter-spacing: -0.3px;
  white-space: nowrap;
  color: #262a66;
}
/* взятый кубок — на светлой плашке с зелёной подсветкой (не жёлтое вплотную к синему) */
.lc.gold {
  background: #fffdf4;
  box-shadow: 0 0 0 2px #3c8a5c, 0 0 12px 2px #9fe3b8aa;
}
.lc.gold img {
  filter: drop-shadow(0 1px 2px #0005);
}
.tv {
  position: absolute;
  z-index: 5;
  padding: 0;
  border: 0;
  background: none;
  cursor: default;
}
.tv:not(:disabled) {
  cursor: pointer;
}
.tv:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
.tv > img {
  display: block;
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 1px 1px #0006);
}
.tvs {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 9% / 11%;
  background: #1a1c44 center / cover no-repeat;
  box-shadow: inset 0 0 8px #000a;
}
.tvs i {
  position: relative;
  width: 38%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: #10112aa0;
  box-shadow: inset 0 0 0 2px #ffffffd0;
  color: #fff;
}
.tvs i::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  width: 40%;
  height: 46%;
  transform: translate(-40%, -50%);
  background: currentColor;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}
.tv.off .tvs i {
  background: transparent;
  box-shadow: inset 0 0 0 2px #ffffff55;
  color: #ffffff70;
}
.cap {
  position: absolute;
  z-index: 5;
  padding: 3px 9px;
  border-radius: 10px;
  background: var(--surface);
  transform: translateX(-50%);
  white-space: nowrap;
}
.cap b {
  font-size: 12px;
}
</style>

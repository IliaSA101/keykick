<script setup lang="ts">
/**
 * Сцена матча (065 Т9, макет Б «Сцена», кадры Э1.01–Э1.05): фон-стадион, табло, две стороны, строка набора, статус, возглас,
 * мяч и клавиатура с руками. Только показ: всё приходит готовым из `viewOf` и `shownOf`, ничего не считает. Единицы — базовые px
 * сцены (на 1920 сцена шире: 1137,78; на 1024 — 1024), как в генераторе кадров `tools/mock-mk1/frames-b.mjs`.
 */
import { computed } from 'vue';
import { artUrl } from '../../art/assets';
import ShirtView from '../../components/club/ShirtView.vue';
import KeyboardHands from '../../components/keyboard/KeyboardHands.vue';
import type { ClubKit } from '../../engine/club/section';
import type { Layout } from '../../engine/typing/keymap';
import type { Shown } from '../../app/match/effects';
import { storyArtUrl } from '../../app/art/storyArt';
import type { StoryArtKey } from '../../app/art/storyArt';
import { confetti } from '../../app/result/confetti';
import { ru } from '../../i18n/ru';
import KitSprite from '../fun/KitSprite.vue';
import { KEEPER_SPRITES } from '../keeper/keeperGeo';
import SeriesMarks from './SeriesMarks.vue';
import SeriesStatus from './SeriesStatus.vue';
import type { SeriesBoard } from './seriesView';
import type { MatchView } from './view';

const props = defineProps<{
  view: MatchView;
  kit: ClubKit;
  rivalKit: ClubKit;
  us: { name: string; backName: string; backNumber: number };
  rival: { name: string; city: string };
  /** Матч Кубка (068 Т6): эмблемы двух команд на табло и у сторон, короткое имя соперника на табло. */
  cup?: { ours: StoryArtKey; rival: StoryArtKey; rivalShort: string } | undefined;
  width: number;
  /** Раскладка клавиатуры; без неё (итог матча) клавиатуры и кнопки «Как держать руки?» нет. */
  layout?: Layout | undefined;
  shout: Shown['shout'];
  bump: Shown['bump'];
  lit?: readonly string[];
  /** Мяч у ворот (не в разминке без удара и не после гола). */
  ball?: boolean;
  /** Вступление (окно «Начать» поверх): строки набора, статуса и цели нет — как в кадре Э1.01 (065 Т9е). */
  intro?: boolean;
  /** Серия ударов Кубка (068 Т6-2, Э5.30–.33): отметки в табло, вратарь в воротах и статус серии вместо запаса ошибок. */
  series?: SeriesBoard | undefined;
  /** Финал Кубка (Э5.36): тот же стадион ночью. */
  night?: boolean;
  /** Победа (итог, Э1.22/.32): конфетти над сеткой и мяч в сетке; без движения — статичный вид кадра. */
  win?: boolean;
  /** Итог со строкой тренера (068 Т8в-3, Э6.38–.42): карточка выше на столько px — фон поднят так же, мяч в сетке убран (макет: `ball: false`). */
  lift?: number;
  /** Без табло «Матч окончен · 3:1» — полоса «Итог дня» (Э6.36/.37). */
  noBoard?: boolean;
}>();
defineEmits<{ help: [] }>();

const t = ru.match;
const big = computed(() => props.width > 1100);
const shirtW = computed(() => (big.value ? 100 : 84));
// фон: линия ворот на 57,5 % высоты картинки стоит на 324 (макет, LINE_AT)
const BG_W = 1900;
const BG_H = Math.round(BG_W * (1536 / 2752));
const bg = computed(() => ({ left: `${Math.round((props.width - BG_W) / 2)}px`, top: `${Math.round(324 - 0.575 * BG_H) - (props.lift ?? 0)}px`, width: `${BG_W}px`, height: `${BG_H}px`, backgroundImage: `url('${artUrl(props.night === true ? 'matchBgFinal' : 'matchBgB')}')` }));
const sideW = computed(() => `calc(50% - 380px)`);
const cells = (text: string): { ch: string; sp: boolean }[] => [...text.toUpperCase()].map((ch) => ({ ch, sp: ch === ' ' }));
const shoutText = computed(() => (props.shout === null ? '' : props.shout === 'save' && props.series !== undefined ? t.shoutSeriesSave : t.shout[props.shout]));
const reserve = computed(() => t.status.reserve);
const finger = computed(() => (props.view.target === null ? '' : props.view.target.finger));
const pieces = confetti();
const warm = computed(() => props.view.phase === t.phase.warmup);
</script>

<template>
  <div class="scene">
    <div
      class="bg"
      :style="bg"
    />
    <div class="shade" />
    <KitSprite
      v-if="series"
      v-bind="KEEPER_SPRITES[series.keeper.pose]"
      :color="rivalKit.body"
      :height="series.keeper.h"
      :x="width / 2 + series.keeper.dx"
      :bottom="series.keeper.bottom"
    />
    <img
      v-if="ball"
      class="ball"
      :src="artUrl('ball')"
      alt=""
      style="left: 50%; margin-left: -14px; top: 286px; width: 28px; height: 28px"
    >

    <div
      v-if="!noBoard"
      class="board"
    >
      <span class="cap l">{{ view.phase }}</span>
      <span class="team"><span class="mini"><img
        v-if="cup"
        class="em"
        :src="storyArtUrl(cup.ours)"
        alt=""
      ><ShirtView
        v-else
        :kit="kit"
      /></span>{{ us.name }}</span>
      <span class="score"><span :class="{ bump: bump === 'us' }">{{ view.score.me }}</span> : <span :class="{ bump: bump === 'rival' }">{{ view.score.opp }}</span></span>
      <span class="team r">{{ cup ? cup.rivalShort : t.board.rivalShort }}<span class="mini"><img
        v-if="cup"
        class="em"
        :src="storyArtUrl(cup.rival)"
        alt=""
      ><ShirtView
        v-else
        :kit="rivalKit"
      /></span></span>
      <SeriesMarks
        v-if="series && cup"
        :rows="[{ em: cup.ours, list: series.us }, { em: cup.rival, list: series.them }]"
      />
      <span
        v-else
        class="cap r"
      >{{ view.detail }}</span>
    </div>

    <figure
      class="side"
      :style="{ left: 0, width: sideW }"
    >
      <div class="look">
        <div :style="{ width: `${shirtW}px` }">
          <ShirtView
            crop
            :kit="kit"
            :back="{ name: us.backName, number: us.backNumber }"
          />
        </div>
        <div
          v-if="big"
          class="rest"
        >
          <div style="width: 50px">
            <ShirtView
              crop
              part="shorts"
              :kit="kit"
            />
          </div>
          <div style="width: 30px">
            <ShirtView
              crop
              part="socks"
              :kit="kit"
            />
          </div>
        </div>
      </div>
      <figcaption>
        <img
          v-if="cup"
          class="em side-em"
          :src="storyArtUrl(cup.ours)"
          alt=""
        ><br v-if="cup"><span class="role">{{ t.sides.us }}</span><br><b class="name">{{ us.name }}</b>
        <slot name="us" />
      </figcaption>
    </figure>
    <figure
      class="side"
      :style="{ right: 0, width: sideW }"
    >
      <div class="look">
        <div :style="{ width: `${shirtW}px` }">
          <ShirtView
            crop
            :kit="rivalKit"
          />
        </div>
        <div
          v-if="big"
          class="rest"
        >
          <div style="width: 50px">
            <ShirtView
              crop
              part="shorts"
              :kit="rivalKit"
            />
          </div>
          <div style="width: 30px">
            <ShirtView
              crop
              part="socks"
              :kit="rivalKit"
            />
          </div>
        </div>
      </div>
      <figcaption>
        <img
          v-if="cup"
          class="em side-em"
          :src="storyArtUrl(cup.rival)"
          alt=""
        ><br v-if="cup"><span class="role">{{ t.sides.foe }}</span><br><b class="name">{{ rival.name }}</b>
        <template v-if="rival.city">
          <br><span class="city">{{ rival.city }}</span>
        </template>
      </figcaption>
    </figure>

    <div
      v-if="win"
      class="fx"
    >
      <i
        v-for="(p, i) in pieces"
        :key="i"
        class="conf"
        :style="{ left: `${p.left}px`, top: `${p.top}px`, background: p.color, transform: `rotate(${p.rot}deg)` }"
      />
      <img
        v-if="!lift"
        class="ball"
        :src="artUrl('ball')"
        alt=""
        style="left: 482px; top: 62px; width: 34px; height: 34px"
      >
    </div>
    <div
      v-if="shout"
      class="pitch"
      :class="shout"
    >
      <img
        v-if="shout === 'save' && series === undefined"
        class="glove"
        :src="artUrl('savedGlove')"
        alt=""
      >
      <template v-else-if="shout === 'warm'">
        <!-- разминка, как в кадре Э1.02: свечение у мяча, пунктир полёта от центра ворот, мяч в сетке (065-Р151) -->
        <div class="warm-glow" />
        <svg
          class="warm-path"
          width="740"
          height="160"
          aria-hidden="true"
        >
          <path d="M372 150 Q 430 40 488 70" />
        </svg>
        <img
          class="ball"
          :src="artUrl('ball')"
          alt=""
          style="left: 474px; top: 56px; width: 30px; height: 30px"
        >
      </template>
      <img
        v-else-if="shout === 'goal'"
        class="ball"
        :src="artUrl('ball')"
        alt=""
        style="left: 473px; top: 45px; width: 34px; height: 34px"
      >
      <div class="shout">
        {{ shoutText }}
      </div>
    </div>

    <!-- без клавиатуры (лист пенальти, итог) строки набора и статуса нет: лист перекрывал их не целиком (Т11, Э1.19) -->
    <div
      v-if="view.typed && !intro && layout"
      class="plate"
    >
      <div
        class="row cur"
        :style="{ fontSize: series ? '56px' : '30px' }"
      >
        <span
          v-for="(c, i) in cells(view.typed.text)"
          :key="i"
          class="c"
          :class="{ sp: c.sp, done: i < view.typed.pos, cur: i === view.typed.pos }"
        >{{ c.sp ? '' : c.ch }}</span>
      </div>
      <div
        v-for="(row, k) in view.next.slice(0, 2)"
        :key="k"
        class="row next"
        style="font-size: 20px"
      >
        <img
          class="tag"
          :src="artUrl('ball')"
          alt=""
        >
        <span
          v-for="(c, i) in cells(row)"
          :key="i"
          class="c"
          :class="{ sp: c.sp }"
        >{{ c.sp ? '' : c.ch }}</span>
      </div>
    </div>

    <SeriesStatus
      v-if="series && view.typed && !intro && layout"
      :left="series.left"
      :centre="series.centre"
      :finger="finger"
    />
    <div
      v-else-if="view.typed && !intro && layout"
      class="status"
    >
      <span
        v-if="view.line"
        class="lines"
      >{{ t.status.line }} <b>{{ view.line.n }}</b> {{ t.status.of }} {{ view.line.of }}
        <span class="segs"><i
          v-for="i in view.line.of"
          :key="i"
          :class="{ on: i < view.line.n, now: i === view.line.n }"
        /></span></span>
      <span v-if="warm">{{ t.status.warm }}</span>
      <span
        v-else
        class="reserve"
      ><img
        v-for="(off, i) in view.balls"
        :key="i"
        class="b"
        :class="{ off }"
        :src="artUrl('ball')"
        alt=""
      ><span>{{ reserve }}</span></span>
      <span
        v-if="!warm && finger"
        class="hint"
      >{{ t.status.finger }} <b>{{ finger }}</b></span>
      <span v-else />
    </div>

    <div
      v-if="layout"
      class="kbback"
    />
    <div
      v-if="layout"
      class="kb"
    >
      <KeyboardHands
        typing
        :layout="layout"
        :target="intro ? null : (view.target?.code ?? null)"
        :thumb="view.target?.thumb ?? null"
        :lit="lit ?? []"
      />
    </div>
    <button
      v-if="layout && !intro"
      type="button"
      class="chip-help"
      @click="$emit('help')"
    >
      {{ ru.match.helpChip }}
    </button>
  </div>
</template>

<style scoped>
.scene { position: absolute; inset: 0; overflow: hidden; background: #0d1b2a; font-weight: 700; }
.bg { position: absolute; background-size: 100% 100%; background-repeat: no-repeat; }
.shade { position: absolute; left: 0; right: 0; top: 326px; bottom: 0; background: linear-gradient(rgb(10 24 18 / 0), rgb(10 24 18 / 0.55) 30%, rgb(10 24 18 / 0.75)); }
.ball { position: absolute; filter: drop-shadow(0 3px 3px rgb(0 0 0 / 0.5)); }
.board { position: absolute; left: 50%; transform: translateX(-50%); top: 46px; width: 720px; height: 42px; box-sizing: border-box; padding: 0 14px; border-radius: 21px; display: grid; grid-template-columns: 170px 1fr auto 1fr 170px; gap: 12px; align-items: center; white-space: nowrap; background: linear-gradient(160deg, rgb(58 63 134 / 0.96), rgb(31 33 82 / 0.96)); box-shadow: 0 0 0 2px rgb(255 255 255 / 0.55), 0 6px 16px rgb(0 0 0 / 0.4); }
.team { display: flex; align-items: center; gap: 6px; font-size: 17px; font-weight: 800; justify-self: end; }
.team.r { justify-self: start; }
.mini { display: block; width: 26px; }
.em { display: block; width: 100%; height: auto; }
.side-em { width: 26px; margin: 0 auto 2px; }
.score { font-size: 30px; font-weight: 900; color: var(--accent); line-height: 1; letter-spacing: 1px; text-shadow: 0 2px 0 rgb(0 0 0 / 0.4); }
.score .bump { display: inline-block; transform: scale(1.3); transform-origin: 50% 70%; color: #fff; text-shadow: 0 0 14px rgb(255 255 255 / 0.85), 0 2px 0 rgb(0 0 0 / 0.4); }
.cap { font-size: 15px; color: var(--text-muted); }
.cap.l { justify-self: start; padding-left: 6px; color: var(--text); }
.cap.r { justify-self: end; padding-right: 6px; }
.side { position: absolute; top: 98px; margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; color: #fff; text-shadow: 0 1px 3px rgb(0 0 0 / 0.8); line-height: 1.2; isolation: isolate; }
.side::before { content: ''; position: absolute; inset: -8px 2px -10px 2px; z-index: -1; border-radius: 18px; background: rgb(12 14 40 / 0.55); backdrop-filter: blur(10px) saturate(0.8); border: 1px solid rgb(255 255 255 / 0.12); box-shadow: 0 6px 18px rgb(0 0 0 / 0.35); }
.look { display: flex; align-items: flex-start; justify-content: center; gap: 6px; }
.look .rest { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.role { font-size: 14px; font-weight: 800; color: var(--zone-middle); }
.name { font-size: 17px; font-weight: 800; overflow-wrap: normal; }
.city { font-size: 15px; color: var(--text-muted); }
.fx { position: absolute; left: 50%; margin-left: -370px; top: 100px; width: 740px; height: 160px; pointer-events: none; animation: fx-in 0.9s ease-out; }
.conf { position: absolute; width: 8px; height: 14px; border-radius: 2px; }
@keyframes fx-in { from { opacity: 0; transform: translateY(-50px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .fx { animation: none; } }
.pitch { position: absolute; left: 50%; margin-left: -370px; top: 180px; width: 740px; height: 160px; pointer-events: none; }
.pitch .glove { position: absolute; left: 372px; top: 14px; width: 128px; height: 128px; filter: drop-shadow(0 6px 10px rgb(0 0 0 / 0.45)); }
.shout { position: absolute; left: 26px; top: 40px; font-size: 50px; font-weight: 900; color: var(--accent); transform: rotate(-5deg); letter-spacing: 1px; text-shadow: 0 3px 0 #7a5a10, 0 5px 14px rgb(0 0 0 / 0.7); }
.warm-glow { position: absolute; left: 400px; top: 10px; width: 180px; height: 140px; background: radial-gradient(closest-side, rgb(255 255 255 / 0.35), transparent); }
.warm-path { position: absolute; left: 0; top: 0; }
.warm-path path { fill: none; stroke: #fff; stroke-width: 3; stroke-dasharray: 2 8; stroke-linecap: round; opacity: 0.8; }
.pitch.warm .shout { left: 40px; top: 46px; font-size: 44px; }
.pitch.save .shout { left: 20px; top: 44px; font-size: 42px; }
.pitch.concede .shout { left: 30px; top: 48px; font-size: 44px; color: #c9cbe6; text-shadow: 0 3px 0 #3a3c6a, 0 5px 14px rgb(0 0 0 / 0.7); }
.plate { position: absolute; left: 50%; margin-left: -370px; width: 740px; top: 326px; height: 108px; box-sizing: border-box; border-radius: 16px; padding: 8px 14px; display: flex; flex-direction: column; justify-content: center; gap: 4px; background: rgb(21 20 58 / 0.86); border: 2px solid var(--rim-silver); box-shadow: 0 8px 20px rgb(0 0 0 / 0.35); }
.row { display: flex; align-items: center; justify-content: center; white-space: nowrap; font-weight: 800; color: var(--text); }
.row .c { display: inline-block; width: 0.76em; text-align: center; line-height: 1.15; border-radius: 6px; margin: 0 1px; }
.row .c.sp { width: 0.45em; }
.row .c.done { color: var(--zone-middle); opacity: 0.85; }
.row .c.cur { box-shadow: 0 0 0 2px var(--accent); background: var(--accent-soft); color: #fff; }
.row.next { opacity: 0.88; font-weight: 700; }
.row .tag { width: 0.85em; height: 0.85em; margin-right: 8px; flex: none; }
.status { position: absolute; left: 50%; margin-left: -400px; width: 800px; top: 438px; height: 24px; display: flex; align-items: center; justify-content: space-between; gap: 10px; font-size: 15px; color: var(--text-muted); white-space: nowrap; }
.status b { color: var(--text); }
.hint b { color: var(--zone-index); }
.lines { display: flex; align-items: center; gap: 8px; }
.segs { display: flex; gap: 4px; }
.segs i { display: block; width: 22px; height: 9px; border-radius: 5px; background: rgb(255 255 255 / 0.2); }
.segs i.on { background: var(--accent); }
.segs i.now { background: none; box-shadow: inset 0 0 0 2px var(--accent); }
.reserve { display: flex; align-items: center; gap: 6px; }
.reserve .b { width: 18px; height: 18px; }
.reserve .b.off { opacity: 0.25; filter: grayscale(1); }
.kbback { position: absolute; left: 50%; margin-left: -290px; width: 580px; top: 462px; height: 178px; border-radius: 18px 18px 0 0; background: rgb(21 20 58 / 0.7); }
/* клавиатура: 15,18 единиц по ширине (поле вокруг) при 34 px на единицу, как в макете (510 px на 15 единиц); верх — по замеру
   кадра Э1.03 (ряды клавиш в кадре ниже на ≈ 3 px при 1920) */
.kb { position: absolute; left: 50%; margin-left: -259px; width: 516px; top: 465px; height: 175px; }
.chip-help { position: absolute; right: 14px; top: 600px; height: 30px; padding: 0 14px; border-radius: 15px; border: 1.5px solid var(--border); background: rgb(21 20 58 / 0.85); font: inherit; font-size: 15px; font-weight: 700; color: var(--text); cursor: pointer; }
</style>

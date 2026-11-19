<script setup lang="ts">
/**
 * Вкладка «Сетка» (Э5.09–.22, `bracketFrame` макета e5-bracket.mjs): линии и рамки пар — SVG с мел-фильтром, содержимое пар — HTML, окошки счёта,
 * подписи колонок, кубок и панель шага под финалом. Ничего не считает — вид готовит `app/cup/bracketView`. М3 (`motion`): раунд только что
 * выигран — итоги, ход по сетке, посадка нашей карточки (061).
 */
import { computed } from 'vue';
import { storyArtUrl } from '../../app/art/storyArt';
import { flightOf, type BracketScreen, type SlotView } from '../../app/cup/bracketView';
import { KO_ROUNDS, type KoRound } from '../../engine/cup';
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';
import KeyButton from '../kit/KeyButton.vue';

const props = defineProps<{ bs: BracketScreen; narrow: boolean; hover: string; motion: KoRound | null; fieldH: number }>();
defineEmits<{ play: []; hover: [name: string] }>();
const t = ru.cup.screen;

/** Размер эмблемы в ячейке: высота, ширина — по пропорции 162 × 192. */
const emb = (kind: 'h' | 'k' | 'f'): number => (kind === 'h' ? 22 : 20);
const ew = (h: number): number => Math.round((h * 162) / 192);
const pairStyle = (p: { x: number; top: number; w: number; h: number }): Record<string, string> => ({ left: `${p.x.toFixed(1)}px`, top: `${p.top.toFixed(1)}px`, width: `${p.w}px`, height: `${p.h}px` });

// ---------- М3: время (мс от начала) — итоги 1/8 → линия и карточка вместе → посадка → панель шага ----------
const T_RESULT = 260;
const T_MOVE = 560;
const LAND = `calc(${T_MOVE}ms + var(--motion-slow))`;
const LAND_COPY = `calc(${LAND} + 3ms)`; // копия гаснет на 3 мс позже начала посадки настоящей ячейки: ни провала, ни двойника
const resultAt = (n: number): string => `calc(${T_RESULT}ms + var(--motion-stagger) * ${n})`;
const ani = (name: string, dur: string, ease: string, delay: string): string => `${name} ${dur.endsWith('ms') ? dur : `var(--motion-${dur})`} var(--motion-ease-${ease}) ${delay} both`;
const nextRound = computed(() => (props.motion === null ? null : (KO_ROUNDS[KO_ROUNDS.indexOf(props.motion) + 1] ?? null)));
const flight = computed(() => (props.motion === null ? null : flightOf(props.bs, props.motion)));
const ourSlot = computed(() => props.bs.pairs.find((p) => p.round === nextRound.value && p.ours)?.slots.find((s) => s?.our) ?? null);

function slotAni(round: KoRound, i: number, sl: SlotView): string | undefined {
  if (props.motion === null) return undefined;
  if (round === props.motion) return sl.lose ? ani('ch-m3-dim', 'base', 'out', resultAt(i)) : undefined;
  if (round === nextRound.value) return sl.our ? ani('ch-m3-land', 'base', 'back', LAND) : ani('ch-m3-in', 'base', 'out', `calc(${resultAt(0)} + var(--motion-base))`);
  return undefined;
}
const pillAni = (round: KoRound, i: number): string | undefined => (props.motion === round ? ani('ch-m3-pill', 'base', 'back', resultAt(i)) : undefined);
const ringAni = (round: KoRound): string | undefined => (nextRound.value === round ? ani('ch-m3-in', 'base', 'out', LAND) : undefined);
const lineAni = (pair: string): string | undefined => (props.motion !== null && pair.startsWith(props.motion) && props.bs.pairs.some((p) => p.key === pair && p.ours) ? ani('ch-m3-draw', 'slow', 'in-out', `${T_MOVE}ms`) : undefined);
const copyStyle = computed(() => {
  const f = flight.value;
  if (!f) return {};
  return {
    left: `${f.fromX.toFixed(1)}px`,
    top: `${f.fromY.toFixed(1)}px`,
    width: `${f.w}px`,
    height: '46px',
    '--tx': `${(f.toX - f.fromX).toFixed(1)}px`,
    '--ty': `${(f.toY - f.fromY).toFixed(1)}px`,
    animation: [ani('ch-m3-show', '1ms', 'out', `${T_MOVE}ms`), ani('ch-m3-fly', 'slow', 'in-out', `${T_MOVE}ms`), ani('ch-m3-lift', 'fast', 'out', `${T_MOVE}ms`), ani('ch-m3-show', '1ms', 'out', LAND_COPY).replace('ch-m3-show', 'ch-m3-hide')].join(','),
  };
});
const rectIds = computed(() => props.bs.pairs.map((p) => ({ p, ring: p.cls.includes('now') ? ringAni(p.round) : undefined })));
</script>

<template>
  <div
    class="ch-bracket"
    :class="{ 'ch-m3': motion !== null }"
  >
    <p
      v-for="h in bs.heads"
      :key="h.round + h.x"
      class="ch-hd"
      :style="{ left: `${h.x}px`, top: `${h.y}px`, width: `${h.w}px` }"
    >
      <b>{{ h.name }}</b> · {{ fill(t.colAfter, { n: h.after }) }}
    </p>
    <svg
      class="ch-svg"
      width="100%"
      :height="fieldH"
      aria-hidden="true"
    >
      <path
        v-for="l in bs.lines"
        :key="l.pair"
        class="ch-ln"
        :class="[l.cls, { sm: l.sm }]"
        :d="l.d"
        :pathLength="lineAni(l.pair) ? 1 : undefined"
        :style="{ animation: lineAni(l.pair) }"
      />
      <template
        v-for="r in rectIds"
        :key="r.p.key"
      >
        <rect
          class="ch-rc"
          :class="r.p.cls"
          :x="r.p.x.toFixed(1)"
          :y="r.p.top.toFixed(1)"
          :width="r.p.w"
          :height="r.p.h"
          rx="7"
          :style="{ animation: r.ring }"
        />
        <path
          class="ch-rc"
          :class="r.p.cls"
          :d="`M${r.p.x + 4} ${r.p.yc}H${r.p.x + r.p.w - 4}`"
          opacity=".35"
        />
      </template>
    </svg>
    <div
      class="ch-cupw"
      :class="{ lit: bs.cup.lit }"
      :style="{ left: `${bs.cup.x}px`, top: `${bs.cup.top}px` }"
    >
      <img
        :src="storyArtUrl('cupCup')"
        alt=""
        :height="bs.cup.h"
        :width="bs.cup.w"
      >
    </div>
    <svg
      v-for="(sp, i) in bs.sparkles"
      :key="i"
      class="ch-spk"
      :style="{ left: `${sp.x.toFixed(1)}px`, top: `${sp.y.toFixed(1)}px` }"
      :width="2 * sp.r"
      :height="2 * sp.r"
      viewBox="-8 -8 16 16"
      aria-hidden="true"
    >
      <path d="M0-8 2-2 8 0 2 2 0 8-2 2-8 0-2-2z" />
    </svg>
    <div
      v-for="p in bs.pairs"
      :key="p.key"
      class="ch-pr"
      :class="{ now: p.cls.includes('now') }"
      :style="pairStyle(p)"
    >
      <template
        v-for="(sl, k) in p.slots"
        :key="k"
      >
        <div
          v-if="sl"
          class="ch-sl"
          :class="[p.kind === 'k' ? 'stk' : p.kind === 'f' ? 'cmp' : '', { our: sl.our, lose: sl.lose, hov: hover === sl.name, mir: p.kind === 'h' && p.dir < 0 }]"
          :style="{ animation: slotAni(p.round, p.i, sl) }"
          @mouseenter="$emit('hover', sl.name)"
          @mouseleave="$emit('hover', '')"
        >
          <img
            class="ch-emi"
            :src="storyArtUrl(sl.emblem)"
            alt=""
            :width="ew(emb(p.kind))"
            :height="emb(p.kind)"
          >
          <template v-if="p.kind === 'h'">
            <span><b>{{ sl.name }}</b><small>{{ sl.sub }}</small></span>
          </template>
          <template v-else-if="p.kind === 'f'">
            <span><b>{{ sl.name }}</b></span>
          </template>
          <template v-else>
            <b>{{ sl.name }}</b><small>{{ sl.sub }}</small>
          </template>
        </div>
        <div
          v-else
          class="ch-sl unk"
          :class="[p.kind === 'k' ? 'stk' : p.kind === 'f' ? 'cmp' : '', { mir: p.kind === 'h' && p.dir < 0 }]"
        >
          <i class="ch-q">?</i>
        </div>
      </template>
    </div>
    <span
      v-for="(w, i) in bs.pills"
      :key="w.pair"
      class="ch-wn"
      :class="{ warn: w.warn, ser: w.ser, r16: w.r16 }"
      :style="{ left: `${w.x.toFixed(1)}px`, top: `${w.y.toFixed(1)}px`, animation: pillAni(bs.pairs.find((p) => p.key === w.pair)!.round, i) }"
    >{{ w.text }}</span>
    <div
      v-if="motion !== null && flight && ourSlot"
      class="ch-sl stk our ch-m3-copy"
      :style="copyStyle"
    >
      <img
        class="ch-emi"
        :src="storyArtUrl(ourSlot.emblem)"
        alt=""
        :width="ew(20)"
        height="20"
      >
      <b>{{ ourSlot.name }}</b><small>{{ ourSlot.sub }}</small>
    </div>
    <template v-if="bs.step">
      <div
        v-if="bs.step.kind === 'title'"
        class="ch-again"
        :style="{ left: `${bs.step.left}px`, top: `${bs.step.againTop.toFixed(1)}px`, width: `${bs.step.width}px` }"
      >
        <KeyButton
          quiet
          @click="$emit('play')"
        >
          {{ bs.step.action }}
        </KeyButton>
      </div>
      <div
        class="ch-stc"
        :class="{ has: bs.step.action && !bs.step.quiet, title: bs.step.kind === 'title' }"
        :style="{ left: `${bs.step.left}px`, top: `${bs.step.top.toFixed(1)}px`, width: `${bs.step.width}px`, ...(bs.step.height ? { height: `${bs.step.height}px` } : { minHeight: '64px' }), animation: motion !== null ? ani('ch-m3-card', 'base', 'back', LAND) : undefined }"
      >
        <span
          v-if="bs.step.emblem"
          class="ch-sce"
        ><img
          class="ch-emi"
          :src="storyArtUrl(bs.step.emblem)"
          alt=""
          :width="bs.step.kind === 'silver' ? 27 : 40"
          height="48"
        ></span>
        <div class="ch-sct">
          <p class="ch-lead">
            {{ bs.step.lead }}
          </p>
          <p
            v-for="(line, i) in bs.step.sub"
            :key="i"
            class="ch-sub"
          >
            {{ line }}
          </p>
        </div>
        <div
          v-if="bs.step.action && !bs.step.quiet"
          class="ch-sca"
        >
          <KeyButton
            primary
            md
            :sub="ru.kit.enter"
            @click="$emit('play')"
          >
            {{ bs.step.action }}
          </KeyButton>
        </div>
      </div>
    </template>
  </div>
</template>

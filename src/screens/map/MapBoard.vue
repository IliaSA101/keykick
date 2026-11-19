<script setup lang="ts">
/**
 * Поле Карты Двора (065 Т8, спека 048/054): картинка района, путь по улицам, туман, ярлыки 10 дворов, «Наш двор», ворота в Район,
 * флаг клуба и «Ты здесь» у узла текущего урока. Ничего не считает: узлы даёт `mapView`; клики и наведение — наверх.
 * Наведение — подсказка, не выбор (054-Р1). Туман и «следующий» двор не нажимаются (К1).
 */
import { computed } from 'vue';
import MapFestive from './MapFestive.vue';
import cfg from '../../content/map-yard.json';
import { fill } from '../../app/home/texts';
import YardGround from '../../components/home/YardGround.vue';
import KitChip from '../../components/kit/KitChip.vue';
import PlaceTag from '../../components/league/PlaceTag.vue';
import type { MapView, YardNode } from '../../engine/map';
import { ru } from '../../i18n/ru';
import { gateOf, gateX as gateXOf, H, pointOf } from '../../components/home/yardGeometry';
import { alongPath, joinRoute, legOf, smooth, yardAt } from './geometry';

/** `travel` — идёт переезд (Э2.08): двор-цель и кто едет (`away` — наш автобус к ним, `incoming` — соперника к нам). */
const props = defineProps<{ view: MapView; width: number; built: number; end: boolean; region: boolean; festive?: boolean; kitBody: string; hover: number | null; travel?: { stage: number; bus: 'away' | 'incoming' } | null; /** Открыто окно: «Ты здесь» и флаг клуба скрыты (Э2.11, Э2.30, Э2.31). */ hideHere?: boolean }>();
const emit = defineEmits<{ pick: [stage: number]; hover: [stage: number | null] }>();
const t = ru.map;
const base = import.meta.env.BASE_URL;

const yards = computed(() => cfg.yards.map((y) => ({ y, n: props.view.nodes[y.stage - 1]!, at: yardAt(props.width, y.stage) })));
const allDone = computed(() => props.view.nodes.every((n) => n.state === 'done'));
/** Двор текущего урока (11 — все пройдены): путь до него ясный, дальше — бледный (макет `leagueFrame`). */
const cur = computed(() => (allDone.value ? 11 : (props.view.nodes.find((n) => n.state === 'cur')?.stage ?? 11)));
const road = computed(() => smooth(joinRoute(props.width, 0, allDone.value ? 11 : cur.value + 1)));
const walked = computed(() => (allDone.value || cur.value > 1 ? smooth(joinRoute(props.width, 0, allDone.value ? 11 : cur.value - 1)) : ''));
const ahead = computed(() => (allDone.value || cur.value + 1 >= 11 ? '' : smooth(joinRoute(props.width, cur.value + 1, 11))));

/** Этот переезд: отрезок к двору золотым тем же пунктиром, без второй линии (макет `leg`). */
const leg = computed(() => (props.travel ? legOf(props.width, props.travel.stage) : null));
/** Автобус — на 60 % пути от нас к ним, к нам — на 35 % обратного пути от них (как кадр); спрайт 62 px, зеркало по ходу. */
const bus = computed(() => {
  const l = leg.value;
  if (!l || !props.travel) return null;
  const incoming = props.travel.bus === 'incoming';
  const at = incoming ? alongPath([...l].reverse(), 0.35) : alongPath(l, 0.6);
  return { style: { left: `${at.x - 30}px`, top: `${at.y - 44}px` }, flip: at.dx < 0, incoming };
});

const fogs = computed(() => yards.value.filter((q) => q.n.state === 'fog').map((q) => ({ stage: q.n.stage, c: pointOf(props.width, q.y.pic) })));
const gate = computed(() => gateOf(props.width));
const gateX = computed(() => gateXOf(props.width));
const homeAt = computed(() => pointOf(props.width, cfg.home.at));
const yard = computed(() => (props.end ? 'full' : props.built === 0 ? 'empty' : null));
const cloudSrc = (i: number, j: number): string => `${base}art/map/cloud-${((i * 2 + j) % 6) + 1}.webp`;

const name = (n: YardNode): string => fill(t.yard, { street: n.street });
const open = (n: YardNode): boolean => n.state === 'done' || n.state === 'cur';
const tip = computed(() => {
  const q = yards.value.find((v) => v.n.stage === props.hover);
  if (!q || !open(q.n)) return null;
  return { at: q.at, lines: [...(q.n.passed ? [fill(t.hoverStars, { k: q.n.full, n: q.n.lessons.length })] : []), ...t.hover] };
});
const hereAt = computed(() => (props.hideHere ? null : (yards.value.find((q) => q.n.here)?.at ?? null)));
</script>

<template>
  <div class="board">
    <MapFestive
      v-if="festive"
      :width="width"
    />
    <YardGround
      :width="width"
      :yard="yard"
    />
    <svg
      class="road"
      :width="width"
      :height="H"
    >
      <path
        :d="road"
        class="shadow"
      />
      <path
        :d="road"
        class="line"
      />
      <path
        v-if="ahead"
        :d="ahead"
        class="line ahead"
      />
      <path
        v-if="walked"
        :d="walked"
        class="walked"
      />
      <path
        v-if="leg"
        :d="smooth(leg)"
        class="leg"
      />
    </svg>

    <template
      v-for="f in fogs"
      :key="`fog${f.stage}`"
    >
      <img
        v-for="j in 2"
        :key="j"
        class="cloud"
        :src="cloudSrc(f.stage - 1, j - 1)"
        :style="{ left: `${f.c[0] + (j - 1 ? 34 : -40)}px`, top: `${f.c[1] + (j - 1 ? 12 : -16)}px`, width: `${150 - (j - 1) * 30}px` }"
        alt=""
      >
    </template>
    <template v-if="!region && !end">
      <img
        v-for="j in 2"
        :key="`g${j}`"
        class="cloud"
        :src="cloudSrc(3, j - 1)"
        :style="{ left: `${gate[0] + 40 + (j - 1 ? 34 : -40)}px`, top: `${gate[1] - 10 + (j - 1 ? 12 : -16)}px`, width: `${190 - (j - 1) * 30}px` }"
        alt=""
      >
    </template>

    <PlaceTag
      kind="home"
      class="mid"
      :x="homeAt[0]"
      :y="homeAt[1] - cfg.home.labelDy"
      :name="t.homeName"
      :rows="[fill(t.homeBuilt, { n: built })]"
    />

    <template
      v-for="q in yards"
      :key="q.n.stage"
    >
      <div
        v-if="q.n.state === 'fog'"
        class="fogname"
        :style="{ left: `${q.at[0]}px`, top: `${q.at[1]}px` }"
        :title="fill(t.fogTitle, { n: q.n.stage })"
      >
        {{ t.fogName }}
      </div>
      <PlaceTag
        v-else
        class="mid"
        :class="{ picked: view.sel.stage === q.n.stage, fest: festive && q.n.state === 'done' }"
        :kind="q.n.state"
        :go="open(q.n)"
        no-arrow
        :x="q.at[0]"
        :y="q.at[1]"
        :name="name(q.n)"
        :mark="q.n.here && !hideHere ? t.here : ''"
        @click="emit('pick', q.n.stage)"
        @mouseenter="emit('hover', q.n.stage)"
        @mouseleave="emit('hover', null)"
      >
        <span class="pips"><i
          v-for="l in q.n.lessons"
          :key="l.n"
          class="pip"
          :class="[l.state, { ctl: l.control, fr: l.friendly }]"
          :title="fill(t.lessonShort, { n: l.n })"
        /></span>
        <b
          v-if="q.n.flag !== 'none'"
          class="nflag"
          :class="{ big: q.n.flag === 'next' }"
          :title="t.cupFlag"
        ><svg
          class="flag"
          viewBox="0 0 12 14"
          aria-hidden="true"
        ><path
          d="M1.5 1v12"
          stroke="currentColor"
          stroke-width="1.6"
        /><path
          d="M2.5 1.5h8l-2 3 2 3h-8z"
          fill="var(--map-flag)"
        /></svg></b>
      </PlaceTag>
    </template>

    <svg
      v-if="hereAt"
      class="clubflag"
      viewBox="0 0 14 20"
      aria-hidden="true"
      :style="{ left: `${hereAt[0] + 26}px`, top: `${hereAt[1] - 52}px` }"
    ><path
      d="M2 1v18"
      stroke="#fff"
      stroke-width="2"
    /><path
      d="M3 1.5h10l-3 4.5 3 4.5H3z"
      :fill="kitBody"
      stroke="#fff"
      stroke-width="1"
    /></svg>

    <div
      class="kb-gate left"
      :class="{ open: region || end }"
      :style="{ left: `${gateX}px`, top: `${gate[1] - 84}px` }"
    >
      <b><i v-if="region || end">←</i> {{ region || end ? t.gateOpen : t.gateBuilding }}</b><span>{{ t.gateAnnounce }}</span>
    </div>

    <img
      v-if="bus"
      class="bus"
      :class="{ flip: bus.flip, rival: bus.incoming }"
      :src="`${base}art/map/bus-34.webp`"
      :style="bus.style"
      :alt="t.busAlt"
    >

    <div
      v-if="tip"
      class="tip"
      :style="{ left: `${tip.at[0]}px`, bottom: `${H - tip.at[1] + 40}px` }"
    >
      <KitChip :tip="tip.lines" />
    </div>
  </div>
</template>

<style scoped>
.board {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--map-ground);
}
.road {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
}
.road path {
  fill: none;
  stroke-linecap: round;
  stroke-dasharray: 1 13;
}
.road .shadow {
  stroke: rgb(0 0 0 / 0.45);
  stroke-width: 9;
  transform: translateY(2px);
}
.road .line {
  stroke: var(--map-path);
  stroke-width: 7;
}
.road .line.ahead {
  stroke-width: 6;
  opacity: 0.25;
}
.road .walked {
  stroke: var(--map-point-done);
  stroke-width: 7;
}
.road .leg {
  stroke: var(--accent);
  stroke-width: 8;
}
/* наш автобус — зелёный (цвета образца клуба, 023-Р30), соперника — оранжевый, как его форма; без синего и жёлтого на вещи (ТАБУ) */
.bus {
  position: absolute;
  z-index: 2;
  width: 62px;
  pointer-events: none;
  filter: hue-rotate(118deg) saturate(1.1) drop-shadow(0 4px 6px rgb(0 0 0 / 0.5));
}
.bus.flip {
  transform: scaleX(-1);
}
.bus.rival {
  filter: hue-rotate(28deg) saturate(1.15) drop-shadow(0 4px 6px rgb(0 0 0 / 0.5));
}
.cloud {
  position: absolute;
  transform: translate(-50%, -50%); /* left/top — центр облака, как `.ycloud` макета */
  /* туман — самое яркое пятно Карты; приглушён ниже ярлыков (макет Р38): прозрачность, яркость и тень — из `.ycloud` */
  opacity: 0.9;
  filter: brightness(0.68) saturate(0.85) drop-shadow(0 6px 10px rgb(10 9 32 / 0.45));
  pointer-events: none;
}
.fogname {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 2;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  /* «?» на облаке — тихий знак, не кнопка: без плашки (`.ynode.fog` макета) */
  font-size: 22px;
  font-weight: 800;
  color: rgb(236 240 255 / 0.85);
  text-shadow: 0 1px 4px rgb(10 9 32 / 0.8);
  pointer-events: none;
}
.clubflag {
  position: absolute;
  width: 18px;
  height: 26px;
  pointer-events: none;
}
.tip {
  position: absolute;
  transform: translateX(-50%);
  pointer-events: none;
  z-index: 4;
}
</style>

<script setup lang="ts">
/**
 * Ярлыки зданий и мест Дома (065 Т7, 048 §3): Школа, Раздевалка, База, Музей, ярлык места урока, дверь Района, «Стадион» с точками
 * ступеней, окно «что построят» и заглушка здания. Ничего не считает: ключи и числа — из `homeView`, строки — `app/home/texts.ts`.
 */
import { computed } from 'vue';
import yard from '../../content/home-yard.json';
import { artUrl } from '../../art/assets';
import { fill, houseText, stadiumText } from '../../app/home/texts';
import type { Scene } from '../../app/home/scene';
import { plural } from '../../i18n/plural';
import KeyButton from '../../components/kit/KeyButton.vue';
import KitPanel from '../../components/kit/KitPanel.vue';
import PlaceTag from '../../components/league/PlaceTag.vue';
import StepDots from '../../components/league/StepDots.vue';
import { stageOf, type HomeInput, type HouseId } from '../../engine/home';
import type { HomeView } from '../../engine/home/view';
import { ru } from '../../i18n/ru';
import { stepBoxOf, sxOf, syOf } from './geometry';

const props = defineProps<{ view: HomeView; input: HomeInput; scene: Scene; width: number; peek: boolean; building: boolean; newStep: string | null }>();
const emit = defineEmits<{ build: []; closeBuilding: [] }>();
const t = ru.home;
const base = import.meta.env.BASE_URL;

const HOUSES = ['school', 'locker', 'base', 'museum'] as const satisfies readonly HouseId[];
const sx = (x: number): number => sxOf(props.width, x);
const note = computed(() => stadiumText(props.view, props.input));
const place = computed(() => yard.places.find((p) => p.stage === stageOf(Math.min(props.input.cur, 32))));
const showArch = computed(() => props.input.cur >= 25);
const showStand = computed(() => props.input.cur >= 31 || props.input.end);

/** «Что построят»: вырезка следующей основы по рамке заготовки, окно — над ней, хвост в её верх (048 §3, макет peekCard). */
const PEEK_W = 268;
const box = computed(() => stepBoxOf(props.view.stadium.built) ?? ([608, 554, 1312, 653] as [number, number, number, number]));
/** Вырезка шире рамки заготовки вверх: пропорция окна ≈ 4,6 : 1, как в макете (в рамку влезал один борт). */
const crop = computed<[number, number, number, number]>(() => [box.value[0], Math.min(box.value[1], box.value[3] - (box.value[2] - box.value[0]) / 4.6), box.value[2], box.value[3]]);
const peekImg = computed(() => {
  const [x0, y0, x1, y1] = crop.value;
  const sc = PEEK_W / (x1 - x0);
  return { height: `${Math.round((y1 - y0) * sc)}px`, backgroundImage: `url(${base}${props.scene.base.replace(/base-\d+/, `base-${props.view.stadium.built + 1}`)})`, backgroundSize: `${1920 * sc}px auto`, backgroundPosition: `${-x0 * sc}px ${-y0 * sc}px` };
});
const peekStyle = computed(() => ({ left: `${sx((box.value[0] + box.value[2]) / 2) - (PEEK_W + 24) / 2}px`, bottom: `${640 - syOf(box.value[1]) + 6}px`, width: `${PEEK_W + 24}px` }));
</script>

<template>
  <PlaceTag
    v-for="h in HOUSES"
    :key="h"
    :kind="view.houses[h].lock ? 'lock' : 'go'"
    :go="!view.houses[h].lock"
    :x="sx(yard.houses[h].label[0]!)"
    :y="syOf(yard.houses[h].label[1]!)"
    :name="t.houses[h]"
    :rows="houseText(view.houses[h]).rows"
    :mark="houseText(view.houses[h]).mark"
    :dot="h !== 'school'"
    @click="emit('build')"
  >
    <template
      v-if="view.houses[h].lock"
      #icon
    >
      <img
        class="lk-ic"
        :src="artUrl('iconLock')"
        alt=""
      >
    </template>
  </PlaceTag>
  <PlaceTag
    v-if="place && !peek"
    kind="ref"
    :x="sx(place.at[0]!)"
    :y="syOf(place.at[1]!)"
    :name="t.places[place.id] ?? place.id"
    :mark="place.id === 'arch' ? t.placeOpen : t.markPlace"
  />
  <div
    v-if="showArch"
    class="kb-gate right"
    :class="{ open: input.cur > 32 && input.region }"
    :style="{ left: `${sx(1277) + 64}px`, top: `${syOf(272) + 4}px` }"
  >
    <b>{{ t.regionBuilding }}</b><span>{{ t.regionAnnounce }}</span>
  </div>
  <PlaceTag
    v-if="showStand"
    kind="go"
    go
    :x="sx(0.69 * 1920)"
    :y="syOf(0.72 * 1072)"
    :name="t.stand"
    @click="emit('build')"
  />
  <PlaceTag
    v-if="!peek"
    kind="ref"
    :x="width / 2"
    :y="104"
    :name="t.stadium"
    :head="newStep ? fill(t.newStep, { name: t.steps[newStep] ?? '' }) : ''"
    :rows="[note.line, note.note].filter(Boolean)"
  >
    <StepDots
      :built="view.stadium.built"
      :of="view.stadium.of"
    />
  </PlaceTag>

  <KitPanel
    v-if="peek && view.stadium.ghost"
    soft
    class="pop tail peekcard"
    :style="peekStyle"
  >
    <p class="lk">
      {{ fill(t.peek.lead, { n: view.stadium.built + 1 }) }}
    </p>
    <div
      class="peek"
      :style="peekImg"
    />
    <b class="nm">{{ (t.steps[view.stadium.ghost.id] ?? '').replace(/^./, (c) => c.toUpperCase()) }}</b>
    <p class="where">
      {{ fill(t.peek.where, { lesson: view.stadium.ghost.lesson, left: fill(plural(view.stadium.ghost.left, t.peek.left), { n: view.stadium.ghost.left }) }) }}
    </p>
  </KitPanel>

  <div
    v-if="building"
    class="modal-shade"
  >
    <KitPanel class="building">
      <p>{{ t.building }}</p>
      <KeyButton
        primary
        md
        :sub="ru.kit.esc"
        @click="emit('closeBuilding')"
      >
        {{ t.buildingClose }}
      </KeyButton>
    </KitPanel>
  </div>
</template>

<style scoped>
.peekcard {
  position: absolute;
  z-index: 5;
}
.modal-shade {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  background: rgb(10 9 30 / 0.55);
}
.building {
  display: grid;
  gap: 12px;
  padding: 18px 24px;
  text-align: center;
}
</style>

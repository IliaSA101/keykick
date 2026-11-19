<script setup lang="ts">
/**
 * Двор на Пути клуба (Э7.113, 174, 183, 184): та же картинка, что у Карты Двора, затемнение, ярлык уровня «Двор · Кубок двора»,
 * плашка ворот Района («строится» / «открыт» с анонсом, 067-Р12), «Ты здесь» с флагом клуба у стадиона. Камера = выбор = Двор (054-Р1).
 * Двор пройден (Э7.184): строки «Ты здесь» — кубок и альбом, рядом плитка кубка, картинка — «Двор достроен». Ничего не считает.
 */
import { computed } from 'vue';
import cfg from '../../content/map-yard.json';
import { artFiles } from '../../art/assets';
import { fill } from '../../app/home/texts';
import YardGround from '../../components/home/YardGround.vue';
import YardShade from '../../components/home/YardShade.vue';
import KitTag from '../../components/kit/KitTag.vue';
import ClubFlag from '../../components/league/ClubFlag.vue';
import PlaceTag from '../../components/league/PlaceTag.vue';
import { isNarrowStage } from '../../components/shell/stageScale';
import type { PathView } from '../../engine/path';
import { ru } from '../../i18n/ru';
import { gateOf, gateX as gateXOf, H, IW, offOf, pointOf } from '../../components/home/yardGeometry';

const props = defineProps<{ view: PathView; width: number; built: number; stars: string; album: number; albumOf: number; flag: string; gateOp: number; hereOp: number; zoom?: { k: number; origin: readonly [number, number] } | undefined; walk?: readonly [number, number] | undefined }>();
const t = ru.path;
const base = import.meta.env.BASE_URL;

const yard = computed(() => (props.view.done ? 'full' : props.built === 0 ? 'empty' : null));
const gate = computed(() => gateOf(props.width));
const gateX = computed(() => gateXOf(props.width));
const open = computed(() => props.view.gate === 'open');
/** Отъезд от Дома (М8): картинка приближена в `k` раз вокруг точки `origin` (доли кадра); ярлыки и обвязка стоят на местах. */
const zoomStyle = computed(() => (props.zoom ? { transform: `scale(${props.zoom.k})`, transformOrigin: `${offOf(props.width) + props.zoom.origin[0] * IW}px ${props.zoom.origin[1] * H}px` } : {}));
/** Основание флага клуба (содержание карты Двора); ярлык «Ты здесь» — над ним. */
const flagAt = computed(() => pointOf(props.width, cfg.clubAt));
/** Размер флага в px сцены на единицу полотна 56×80: на 1920 сцена увеличена в 1,6875 раза, флаг крупнее в 1,4 (flagK), на 1024 — 0,93 (макет marks.mjs, scaleOf). */
const fk = computed(() => (isNarrowStage(props.width) ? 0.93 : 1.4 / 1.6875));
/** Флаг стоит на картинке: едет с ней при отъезде от Дома (М8), но размера не меняет — обратный масштаб вокруг основания древка (макет marks.mjs, flagAt, k). */
/** Сдвиг обвязки входа в px: на t = 0 флаг и «Ты здесь» стоят у стадиона на картинке Дома, к концу идут на место (054-Р10). */
const walkPx = computed<readonly [number, number]>(() => (props.walk ? [props.walk[0] * IW, props.walk[1] * H] : [0, 0]));
const flagStyle = computed(() => ({
  left: `${flagAt.value[0] - 6 * fk.value + walkPx.value[0]}px`,
  top: `${flagAt.value[1] - 78 * fk.value + walkPx.value[1]}px`,
}));
const rows = computed(() =>
  props.view.done
    ? [t.doneCup, fill(t.doneAlbum, { n: props.album, of: props.albumOf, stars: props.stars })]
    : [fill(t.hereRow, { n: props.view.lesson, of: props.view.of, stars: props.stars })],
);
</script>

<template>
  <div class="levels">
    <div
      class="zoom"
      :style="zoomStyle"
    >
      <YardGround
        :width="width"
        :yard="yard"
        shade="none"
      />
    </div>
    <!-- флаг — обвязка входа: тот же слой Двора (тот же масштаб), но над слоем Дома `PathEntry` (054-Р10, Э7.192–195) -->
    <div class="zoom over">
      <ClubFlag
        class="flag"
        :style="flagStyle"
        :fill="flag"
        :scale="fk"
      />
    </div>
    <YardShade kind="path" />
    <PlaceTag
      kind="ref"
      class="own"
      :x="16"
      :y="89"
      :name="ru.league.names.yard"
      :rows="[ru.map.cupFlag]"
    />
    <PlaceTag
      kind="ref"
      class="own"
      :style="{ opacity: gateOp }"
      :x="gateX"
      :y="gate[1] - 84"
      :name="ru.league.names.district"
      :rows="[ru.home.regionAnnounce]"
    >
      <template #head>
        <KitTag :kind="open ? 'ok' : 'nt'">
          {{ open ? t.gate.open : t.gate.building }}
        </KitTag>
      </template>
    </PlaceTag>
    <div
      class="here"
      :style="{ left: `${flagAt[0] + walkPx[0]}px`, top: `${flagAt[1] + walkPx[1] - 80 * fk - 4}px`, opacity: hereOp }"
    >
      <PlaceTag
        kind="cur"
        class="flow"
        :x="0"
        :y="0"
        :name="ru.league.names.yard"
        :rows="rows"
      >
        <template #head>
          <KitTag kind="solid">
            {{ ru.map.here }}
          </KitTag>
        </template>
      </PlaceTag>
      <span
        v-if="view.done"
        class="plate"
      ><img
        :src="`${base}${artFiles.iconTrophy}`"
        alt=""
      ></span>
      <i class="arr" />
    </div>
  </div>
</template>

<style scoped>
.levels {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--map-ground);
}
.zoom {
  position: absolute;
  inset: 0;
}
.over {
  z-index: 2;
  pointer-events: none;
}
.own {
  transform: none;
  text-align: left;
}
.flag {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}
/* «Ты здесь» (Э7.174): плашка и плитка кубка над флагом, носик вниз — как .sc-row.up макета; низ плашки — над полотном флага */
.here {
  position: absolute;
  z-index: 3;
  display: flex;
  gap: 8px;
  align-items: flex-start;
  transform: translate(-50%, -100%);
  pointer-events: none;
}
.plate {
  flex: none;
  padding: 5px 7px;
  border-radius: 12px;
  background: var(--award-plate);
  box-shadow: 0 0 0 1.5px var(--award-plate-edge);
  line-height: 0;
}
.plate img {
  height: 44px;
  width: auto;
}
.arr {
  position: absolute;
  left: 50%;
  bottom: -8px;
  margin-left: -9px;
  width: 0;
  height: 0;
  border: 9px solid transparent;
  border-bottom: 0;
  border-top-color: #fff;
}
</style>

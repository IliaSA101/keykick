<script setup lang="ts">
/**
 * Спрайт с цветом формы (Вратарь: Саша в форме клуба, бьющий в цвете соперника): серый рисунок со светотенью и маска формы `-kit` —
 * цвет кладёт SVG-фильтр по маске (как в макете `tools/mock-games/e4-keeper.mjs`, 036-Р35); сами картинки не перекрашиваем.
 * `x` — середина по горизонтали, `bottom` — нижняя кромка, `h` — высота на арене (px арены). `clip` — вырез в px файла (убрать нарисованный мяч).
 * `inSvg` — спрайт стоит внутри другой SVG-арены (Штрафной, 067 Т21): позиция атрибутами `x`, `y` вложенной SVG, а не CSS.
 * `flip` — отражение по горизонтали; работает только вне SVG (CSS `transform`), сочетание `inSvg` + `flip` типом запрещено.
 */
import { computed, useId } from 'vue';
import { artUrl, type ArtKey } from '../../art/assets';

type Place = { inSvg?: false; flip?: boolean } | { inSvg: true; flip?: never };
const props = defineProps<Place & {
  art: ArtKey;
  kit: ArtKey;
  /** Размер файла в px. */
  w: number;
  h: number;
  color: string;
  height: number;
  x: number;
  bottom: number;
  clip?: { x: number; y: number; w: number; h: number } | undefined;
}>();
// Vue сводит объединение к `inSvg?: false`: читаем флаги как обычные необязательные
const svg = computed(() => (props as { inSvg?: boolean }).inSvg === true);
const flipped = computed(() => (props as { flip?: boolean }).flip === true);
const uid = useId();
const width = computed(() => (props.height * props.w) / props.h);
const left = computed(() => +(props.x - width.value / 2).toFixed(1));
const top = computed(() => +(props.bottom - props.height).toFixed(1));
const style = computed(() => (svg.value ? undefined : { left: `${left.value}px`, top: `${top.value}px`, ...(flipped.value ? { transform: 'scaleX(-1)' } : {}) }));
const cut = computed(() => (props.clip === undefined ? '' : `M0 0H${props.w}V${props.h}H0Z M${props.clip.x} ${props.clip.y}h${props.clip.w}v${props.clip.h}h${-props.clip.w}Z`));
</script>

<template>
  <svg
    class="sp"
    :width="width.toFixed(1)"
    :height="height"
    :viewBox="`0 0 ${w} ${h}`"
    :x="svg ? left : undefined"
    :y="svg ? top : undefined"
    :style="style"
    aria-hidden="true"
  >
    <defs>
      <filter
        :id="`${uid}f`"
        filterUnits="userSpaceOnUse"
        x="0"
        y="0"
        :width="w"
        :height="h"
        color-interpolation-filters="sRGB"
      >
        <feImage
          :href="artUrl(kit)"
          x="0"
          y="0"
          :width="w"
          :height="h"
          preserveAspectRatio="none"
          result="M"
        />
        <feColorMatrix
          in="M"
          type="matrix"
          values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .2126 .7152 .0722 0 0"
          result="A"
        />
        <feFlood
          :flood-color="color"
          result="C"
        />
        <feComposite
          in="C"
          in2="A"
          operator="in"
          result="T"
        />
        <feBlend
          in="T"
          in2="SourceGraphic"
          mode="multiply"
        />
      </filter>
      <clipPath
        v-if="clip"
        :id="`${uid}c`"
      >
        <path
          clip-rule="evenodd"
          :d="cut"
        />
      </clipPath>
    </defs>
    <image
      :href="artUrl(art)"
      x="0"
      y="0"
      :width="w"
      :height="h"
      :filter="`url(#${uid}f)`"
      :clip-path="clip ? `url(#${uid}c)` : undefined"
    />
  </svg>
</template>

<style scoped>
.sp { position: absolute; display: block; overflow: visible; }
</style>

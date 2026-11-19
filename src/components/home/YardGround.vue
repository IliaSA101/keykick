<script setup lang="ts">
/**
 * Картинка Двора на Карте и на Пути клуба (066 Т6, один слой на два экрана): основа, вырезка Двора (пустой или полный)
 * и затемнение верха и краёв (`YardShade`); на Пути оно лежит над приближенным слоем отдельно — `shade="none"`. Ширина сцены `width` — в базовых px.
 */
import { computed } from 'vue';
import art from '../../content/home-art.json';
import { K } from './geometry';
import { IW, offOf } from './yardGeometry';
import YardShade from './YardShade.vue';

const props = withDefaults(defineProps<{ width: number; yard: 'full' | 'empty' | null; shade?: 'map' | 'none' }>(), { shade: 'map' });
const base = import.meta.env.BASE_URL;
const off = computed(() => offOf(props.width));
const box = computed(() => (props.yard === null ? null : art.map.yard[props.yard]));
</script>

<template>
  <img
    class="bg"
    :src="`${base}${art.map.base}`"
    :style="{ left: `${off}px`, width: `${IW}px` }"
    alt=""
  >
  <img
    v-if="box"
    class="yardcut"
    :src="`${base}${box.file}`"
    :style="{ left: `${off + box.box[0]! * K}px`, top: `${box.box[1]! * K}px`, width: `${(box.box[2]! - box.box[0]!) * K}px` }"
    alt=""
  >
  <YardShade
    v-if="shade !== 'none'"
    :kind="shade"
  />
</template>

<style scoped>
.bg,
.yardcut {
  position: absolute;
  pointer-events: none;
}
.bg {
  top: 0;
  height: 640px;
}
</style>

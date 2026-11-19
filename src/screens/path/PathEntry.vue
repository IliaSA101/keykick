<script setup lang="ts">
/**
 * Слой Дома при отъезде к Пути клуба (М8, Э7.192–196): та же картинка двора, что на Доме (`HomeScene`), сжимается и едет полем
 * на поле Двора, потом тает. Кадр `frame` приходит из `engine/path/enter`; без движения (`move` = false) — только прозрачность.
 */
import { computed } from 'vue';
import HomeScene from '../../components/home/HomeScene.vue';
import { K, offOf } from '../../components/home/geometry';
import type { Scene } from '../../app/home/scene';
import type { EnterFrame } from '../../engine/path';
import type { HomeInput } from '../../engine/home';
import type { HomeView } from '../../engine/home/view';

const props = defineProps<{ view: HomeView; input: HomeInput; scene: Scene; width: number; hue: number | null; frame: EnterFrame; move: boolean; fade: number }>();
const IMG_W = 1920 * K;
/** Сдвиг слоя в px: левый верх картинки Дома стоит на `dx`, `dy` долях кадра; масштаб — от угла сцены, поэтому поправка `off·(1−s)`. */
const style = computed(() => {
  if (!props.move) return { opacity: props.fade };
  const { scale: s, dx, dy, opacity } = props.frame.home;
  const off = offOf(props.width);
  return { transform: `translate(${off * (1 - s) + dx * IMG_W}px, ${dy * 640}px) scale(${s})`, opacity };
});
</script>

<template>
  <div
    class="entry"
    :style="style"
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
  </div>
</template>

<style scoped>
.entry {
  position: absolute;
  inset: 0;
  z-index: 1;
  transform-origin: 0 0;
  pointer-events: none;
}
</style>

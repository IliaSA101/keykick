<script setup lang="ts">
/** Сцена: `.stage` в базовых px 1024×640, подогнанная под окно (`stageScale`). Всё содержимое оболочки лежит внутри. */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { stageScale } from './stageScale';

const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
const onResize = (): void => {
  win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight };
};
onMounted(() => globalThis.addEventListener('resize', onResize));
onUnmounted(() => globalThis.removeEventListener('resize', onResize));

const box = computed(() => stageScale(win.value.w, win.value.h));
const style = computed(() => ({ width: `${box.value.width}px`, height: `${box.value.height}px`, zoom: String(box.value.scale) }));
</script>

<template>
  <div
    class="stage"
    :style="style"
  >
    <slot />
  </div>
</template>

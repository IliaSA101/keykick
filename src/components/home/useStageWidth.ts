/**
 * Ширина сцены в базовых px (1138 на 1920, 1024 на узком окне) — следит за размером окна. Нужна картинке двора (`HomeScene`):
 * Дом и фон первого запуска берут её отсюда, а не считают каждый свою.
 */
import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import { stageScale } from '../shell/stageScale';

export function useStageWidth(): ComputedRef<number> {
  const win = ref({ w: globalThis.innerWidth, h: globalThis.innerHeight });
  const onResize = (): void => void (win.value = { w: globalThis.innerWidth, h: globalThis.innerHeight });
  onMounted(() => globalThis.addEventListener('resize', onResize));
  onBeforeUnmount(() => globalThis.removeEventListener('resize', onResize));
  return computed(() => stageScale(win.value.w, win.value.h).width);
}

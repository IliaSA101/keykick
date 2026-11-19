/**
 * Размеры и места окон первого запуска — в единицах макета (одна единица = один px сцены до масштаба `.stage`),
 * числа взяты из генераторов принятых кадров КАК ЕСТЬ: умножать на масштаб сцены нельзя — её масштабирует `zoom` оболочки.
 * Источники: системные окна — `tools/mock-story/system.mjs` (`win`: 600 / 190), «Что изменится» —
 * `tools/mock-story/start.mjs` (кадры 1920 и 1024); реплика тренера — на месте тренера Дома (`components/panel/coachWidth.ts`, 063-Р49), «Твой клуб», выбор тренера и приветствие — `tools/mock-collection/e2k-club.mjs`.
 */
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import type { Place } from '../../components/club/places';
import { isNarrowStage, stageScale } from '../../components/shell/stageScale';

/** Окна «Новый клуб», «Клуб пропал?», «Файл не подошёл», «Клуб вернулся» (Э6.71, 73, 75, 79, 81). */
export const SYSTEM_WINDOW: Place = { width: 600, top: 190 };

/** «Что изменится» (Э6.77): на 1920 — 760 / 110, на 1024 — 700 / 16. */
export const checkWindow = (narrow: boolean): Place => (narrow ? { width: 700, top: 16 } : { width: 760, top: 110 });
/** Узкая ли сцена сейчас (окно 1024) — следит за размером окна. */
export function useNarrow(): Ref<boolean> {
  const calc = (): boolean => isNarrowStage(stageScale(globalThis.innerWidth, globalThis.innerHeight).width);
  const narrow = ref(calc());
  const onResize = (): void => {
    narrow.value = calc();
  };
  onMounted(() => globalThis.addEventListener('resize', onResize));
  onBeforeUnmount(() => globalThis.removeEventListener('resize', onResize));
  return narrow;
}

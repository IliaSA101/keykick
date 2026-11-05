/**
 * Масштаб экрана от окна для страницы: множитель — из движка (engine/viewport), здесь замер окна.
 * Каркас (App.vue) кладёт его в CSS как zoom: вся вёрстка растёт одним множителем, а клики,
 * фокус и getBoundingClientRect остаются в координатах окна (так устроен zoom в браузере).
 * Внутри увеличенного дерева 1vh и 1vw тоже увеличены — делить их на var(--ui-scale).
 * Шкал две (docs/specs/006-page-scale.md): --ui-scale — матча, --page-scale — страниц и панели;
 * внутри страниц каркас подменяет --ui-scale на --page-scale, так что экраны делят на своё.
 */
import { reactive } from 'vue';
import { hasSideRoom, pageScale, uiScale } from '../engine/viewport';

export const viewport = reactive({
  /** Множитель матча: 1 на окне 1024×640. */
  scale: 1,
  /** Множитель страниц и верхней панели: растёт вдвое медленнее матча. */
  page: 1,
  /** По бокам поля матча есть место для крупных форм. */
  sideRoom: false,
});

function measure(): void {
  const root = globalThis.document.documentElement;
  const scale = uiScale(globalThis.innerWidth, globalThis.innerHeight);
  const page = pageScale(scale);
  viewport.scale = scale;
  viewport.page = page;
  // Ширина без полосы прокрутки: место под неё занято всегда (scrollbar-gutter в tokens.css).
  viewport.sideRoom = hasSideRoom(root.clientWidth / scale);
  root.style.setProperty('--ui-scale', String(scale));
  root.style.setProperty('--page-scale', String(page));
}

/** Замер сразу (до первой отрисовки — без скачка) и на каждое изменение окна. */
export function watchViewport(): void {
  measure();
  globalThis.addEventListener('resize', measure);
}

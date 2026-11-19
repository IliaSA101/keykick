/**
 * Куда можно попасть с экрана (067 Т23, журнал 19.11 «вес и качество графики»): граф переходов для фоновой догрузки графики.
 * Данные, а не разбор кода: `EDGES` — переходы, которые экран делает сам (кнопки, ярлыки, Esc), в порядке важности;
 * меню шапки (Дом, Карта, Кубок, Путь, Клуб) есть на всех экранах с шапкой и добавляется функцией; `TAIL` — переходы, которые
 * идут после меню (ярлыки-заглушки). Глубина — один переход (067-Р248). Сверка с кодом — 067-Р243.
 * Чистая функция без Vue и DOM: `reach` — соседи, `screenOfRoute` — экран по имени маршрута.
 */
export type PreloadScreen =
  | 'home' | 'map' | 'cup' | 'path' | 'club' | 'museum' | 'shop' | 'locker' | 'school' | 'base'
  | 'keepy' | 'memo' | 'keeper' | 'mini' | 'free' | 'learn' | 'match' | 'result' | 'pack' | 'start' | 'who';

/** Пункты меню шапки в её порядке (`routes.ts`: MENU_ROUTES). */
export const MENU: readonly PreloadScreen[] = ['home', 'map', 'cup', 'path', 'club'];
/** Экраны без шапки с меню (`meta.bare`, матч): меню отсюда не идёт. */
const NO_MENU: ReadonlySet<PreloadScreen> = new Set(['match', 'result', 'pack', 'start', 'who']);

/**
 * Свои переходы экрана, важные первыми. Дом: Карта, матч сразу за ней (кнопка «Играть» ведёт через `useGoMatch`), затем Лавка,
 * Музей и Кубок, Раздевалка; Школа и База — в `TAIL`, пока ярлыки Дома ведут на заглушку (067-Р248).
 */
export const EDGES: Record<PreloadScreen, readonly PreloadScreen[]> = {
  home: ['map', 'match', 'shop', 'museum', 'cup', 'locker'],
  map: ['match'],
  cup: [],
  path: [],
  club: [],
  museum: [],
  shop: [],
  locker: [],
  school: [],
  base: ['keepy', 'keeper', 'memo', 'mini', 'learn', 'free'],
  keepy: ['base'],
  memo: ['base'],
  keeper: ['base'],
  mini: ['base'],
  free: ['base'],
  learn: ['base'],
  match: ['result', 'home', 'map'],
  result: ['pack', 'home', 'school', 'map', 'match'],
  pack: ['home', 'map'],
  start: ['home'],
  who: ['home'],
};

/** Переходы после меню шапки: ярлыки Дома на Школу и Базу (пока заглушки). */
const TAIL: Partial<Record<PreloadScreen, readonly PreloadScreen[]>> = { home: ['school', 'base'] };

/** Прямые переходы экрана: свои, затем меню (если шапка есть); себя не возвращает, повторов нет. */
export function neighbours(screen: PreloadScreen): PreloadScreen[] {
  const out: PreloadScreen[] = [];
  for (const s of [...EDGES[screen], ...(NO_MENU.has(screen) ? [] : MENU), ...(TAIL[screen] ?? [])]) if (s !== screen && !out.includes(s)) out.push(s);
  return out;
}

/** Экраны, куда можно попасть отсюда одним переходом, в порядке важности (глубина 1, 067-Р248: «остальное — когда понадобится»). */
export const reach = (screen: PreloadScreen): PreloadScreen[] => neighbours(screen);

const OWN_GAMES: ReadonlySet<string> = new Set(['keepy', 'memo', 'keeper', 'mini', 'free']);

/** Экран графики по имени маршрута; чужая игра Базы (`/base/free`) охрана уводит на Базу (`FunShell`) — это `base`; незнакомый и стенд кадров (`dev-*`) — `null`: догрузка там молчит. */
export function screenOfRoute(name: string, params: { game?: unknown } = {}): PreloadScreen | null {
  if (name === 'school-tour' || name === 'school-waits' || name === 'school-kicks') return 'school';
  if (name === 'base-game') {
    const g = typeof params.game === 'string' ? params.game : '';
    return OWN_GAMES.has(g) ? (g as PreloadScreen) : 'base';
  }
  return name in EDGES ? (name as PreloadScreen) : null;
}

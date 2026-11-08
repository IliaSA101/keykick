// Переходы карты (спека 019, design §1, §10): куда ведёт «Играть». Адрес матча урока — одна константа
// (с 017-Т8 это `/match`; прежний `/match2` — переадресация в роутере).
import type { RouteLocationRaw } from 'vue-router';

export const MAP_PATH = '/map';
export const MATCH_PATH = '/match';
/** «Путь клуба»: адрес маршрута (router.ts) и ссылка с листа лиги — одна константа. */
export const PATH_PATH = '/path';

/** Матч урока по карте. */
export const matchTo = (lessonId: string): RouteLocationRaw => ({ path: MATCH_PATH, query: { lesson: lessonId } });

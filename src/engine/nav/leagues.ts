/** Лиги и экраны модели навигации (054 §1–2). Кубок и Клуб — свои экраны вне модели лиг: здесь только адреса. */

/** Шесть лиг; «Дом» и «Квартал» — не деления шкалы (052-Р21 а, запрет Z6). */
export const LEAGUES = ['yard', 'district', 'city', 'country', 'europe', 'world'] as const;
export type League = (typeof LEAGUES)[number];

/** Пять пунктов меню ЭБ в порядке `PAGE` (`tools/mock-kit/kit.mjs`): Дом, Карта, Кубок, Путь клуба, Клуб. */
export const SCREENS = ['home', 'map', 'cup', 'path', 'club'] as const;
export type Screen = (typeof SCREENS)[number];

export function isLeague(x: unknown): x is League {
  return typeof x === 'string' && (LEAGUES as readonly string[]).includes(x);
}

export function isScreen(x: unknown): x is Screen {
  return typeof x === 'string' && (SCREENS as readonly string[]).includes(x);
}

export const leagueIndex = (l: League): number => LEAGUES.indexOf(l);

/** Лига на `d` ступеней выше (ниже); за краем шкалы — `null`. */
export function shiftLeague(l: League, d: number): League | null {
  return LEAGUES[leagueIndex(l) + d] ?? null;
}

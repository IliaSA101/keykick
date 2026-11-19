/**
 * Счёт входов в Путь клуба и вид входа (054-Р10, Р11, Р17; 067 К-З). Чистые функции: раздел `path` и эффект навигации приходят снаружи.
 * Полный отъезд (Э7.192–196) — только из Дома и только пока входов меньше `NAV.fullEntries` (П-З5); с Карты — слой гаснет, полного нет (П-З4).
 */
import { NAV, type League, type NavEffect, type Via } from '../nav';
import type { Path } from './section';

/** Сколько раз игрок входил в Путь клуба из Дома, пока L — эта лига. */
export const entriesOf = (path: Path, league: League): number => path.entries[league] ?? 0;

/**
 * Эффект ввода → раздел `path`: вход `go → path` из Дома растёт на единицу, но не выше `fullEntries`; всё прочее — раздел как был
 * (тот же объект — писать в сохранение нечего).
 */
export function countEntry(path: Path, league: League, effect: NavEffect): Path {
  if (effect.kind !== 'go' || effect.to !== 'path' || effect.from !== 'home') return path;
  const n = entriesOf(path, league);
  if (n >= NAV.fullEntries) return path;
  return { entries: { ...path.entries, [league]: n + 1 } };
}

/** Вид входа, с которым экран Пути начнёт движение: из эффекта `go`; не вход в Путь — `null` (экран открыт адресом, без движения). */
export const entryVia = (effect: NavEffect): Via | null => (effect.kind === 'go' && effect.to === 'path' ? effect.via : null);

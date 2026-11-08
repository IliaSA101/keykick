// Подписи карты: подстановки в тексты `ru.map`, замки и звёзды. Склонение — `i18n/plural`, ключ замка — `engine/map/lock`.
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { buildingFocus, flagFocus } from '../../engine/map/focus';
import type { MapFlag, MapModel, MapPoint } from '../../engine/map/model';
import { lockText, type LockCond } from '../../engine/map/lock';

/** Подставить значения в `{имя}`. */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all));
}

/** Строка замка: «Откроется на уроке 9», «Скоро». */
export function lockLine(cond: LockCond): string {
  const t = lockText(cond);
  const l = ru.map.lock;
  if (t.key === 'lesson') return fill(l.lesson, { n: t.n ?? 0 });
  if (t.key === 'matches') return fill(l.matches, { n: t.n ?? 0, w: plural(t.n ?? 0, l.matchesWord) });
  return t.key === 'nextTime' ? l.nextTime : l.soon;
}

/** Главная кнопка карточки: что она делает. Кольцо «вернуться за звёздами» — всегда «за звёздами», даже при трёх. */
export function cardAction(p: Pick<MapPoint, 'state' | 'stars' | 'back' | 'resume'>): 'resume' | 'play' | 'again' | 'repeat' {
  if (p.resume) return 'resume';
  if (p.state === 'current') return 'play';
  return p.stars < 3 || p.back ? 'again' : 'repeat';
}

/** «★★☆»: звёзды урока. */
export const starsGlyphs = (n: number): string => '★'.repeat(n) + '☆'.repeat(3 - n);

/**
 * Кубка на карте ещё нет (019-Р36, Р46, Р48): модель отмечает флажок без поставщика (чемпионат — Э5), он «появится в
 * следующих версиях». Одно условие для карточки и для вида флажка; замок и подсказка поставщика — не «позже».
 */
export function isCupLater(flag: Pick<MapFlag, 'later'>): boolean {
  return flag.later;
}

/** Карточка места: флажок кубка, здание или ворота. */
export interface PlaceInfo {
  kind: 'flag' | 'building' | 'gate';
  title: string;
  lines: string[];
}

/**
 * Что сказать о флажке, здании или воротах в фокусе (`flag:9`, `building:stadium`, `gate`); другое — `null`.
 * `cup` — название кубка лиги, `nextLeague` — название следующей лиги (может быть пустым).
 */
export function placeInfo(model: MapModel, id: string, o: { cup: string; nextLeague: string }): PlaceInfo | null {
  const t = ru.map;
  const flag = model.flags.find((f) => flagFocus(f.after) === id);
  if (flag) {
    const status = isCupLater(flag) ? fill(t.flag.later, { cup: o.cup }) : (flag.hint ?? (flag.lock ? lockLine(flag.lock) : t.lock.open));
    return { kind: 'flag', title: o.cup, lines: [fill(t.flag.after, { n: flag.after }), ...(flag.big ? [t.flag.big] : []), status] };
  }
  const b = model.buildings.find((x) => buildingFocus(x.id) === id);
  if (b) {
    const line = b.lock
      ? lockLine(b.lock)
      : b.next
        ? fill(t.building.next, { name: b.next.name, n: b.next.after })
        : b.id === 'stadium'
          ? t.building.built
          : t.lock.open;
    return { kind: 'building', title: t.building[b.id], lines: [line] };
  }
  if (id === 'gate') {
    const s = model.gate.state;
    return { kind: 'gate', title: t.gate.name, lines: [s === 'fog' ? t.gate.fog : fill(t.gate[s], { league: o.nextLeague })] };
  }
  return null;
}

/** Строка листа лиги: звёзды сделаны/остались. Альбом, эмблема, права (до 022/024/026) — одна строка `sheet.later`. */
export interface SheetRow {
  id: 'stars';
  kind: 'done' | 'left';
  n: number;
  max: number;
}

/** Вторая половина лиги: текущий урок дальше середины (все пройдены — тоже вторая). */
export function secondHalf(points: readonly Pick<MapPoint, 'state' | 'n'>[]): boolean {
  const current = points.find((p) => p.state === 'current');
  return current === undefined || current.n > points.length / 2;
}

/** Строки листа лиги (ТЗ-1.8): в первой половине — «сделано N из M», со второй — «осталось». */
export function sheetRows(stars: { got: number; max: number }, second: boolean): SheetRow[] {
  const got = Math.min(Math.max(stars.got, 0), stars.max);
  return [{ id: 'stars', kind: second ? 'left' : 'done', n: second ? stars.max - got : got, max: stars.max }];
}

/** Текст строки листа. */
export function sheetLine(row: SheetRow): string {
  const t = ru.map.sheet;
  if (row.kind === 'done') return fill(t.done, { n: row.n, max: row.max });
  return row.n === 0 ? t.full : fill(t.left, { n: row.n, w: plural(row.n, t.starsWord) });
}

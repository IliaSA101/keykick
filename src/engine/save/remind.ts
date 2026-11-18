/**
 * Напоминание родителю о выгрузке клуба (063-Р9, 063-Р63, ТЗ-12.17): Safari стирает хранилище сайта через 7 дней без захода,
 * поэтому, если последнему файлу ≥ 7 дней и с тех пор был прогресс (или файла нет и доиграно ≥ 3 матча), родителю
 * (не ребёнку, З4) показывают плашку.
 * Чистая функция: сегодняшний день приходит снаружи (`today`), часов и хранилища здесь нет.
 */
import type { Device } from './device';
import type { Envelope } from './envelope';
import { isDay } from './section';
import { isObj, playedOf } from './snapshot';

/** Через сколько дней после последнего файла (063-Р9, 064-Р8: срок стирания Safari, 059 В-3). */
export const REMIND_DAYS = 7;
/** Сколько матчей сыграно, когда без файла пора напомнить (064-Р8, 063-Р63). */
export const REMIND_MATCHES = 3;

const DAY_MS = 86_400_000;
/** Номер дня от начала эпохи для разности дней: `ГГГГ-ММ-ДД` → число (день уже проверен `isDay`). */
export const dayNo = (day: string): number => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / DAY_MS;

/** Дни, в которые игроки проходили уроки (`done` отметок любого курсового раздела `course:*`), по возрастанию. */
export function progressDays(players: readonly Envelope[]): string[] {
  const days: string[] = [];
  for (const env of players) {
    for (const [name, sec] of Object.entries(env.sections)) {
      if (!name.startsWith('course:') || !isObj(sec.data) || !isObj(sec.data.lessons)) continue;
      for (const mark of Object.values(sec.data.lessons)) if (isObj(mark) && isDay(mark.done)) days.push(mark.done);
    }
  }
  return days.sort();
}

/** Доигранных матчей у всех игроков вместе: `day.played` каждого (тот же счёт, что плитка «Матчей доиграно» страницы родителя, 064-Р8). */
export function matchesPlayed(players: readonly Envelope[]): number {
  let total = 0;
  for (const env of players) total += Math.max(0, playedOf(env) ?? 0);
  return total;
}

/**
 * Пора ли напомнить. `today` — день `ГГГГ-ММ-ДД` (часы снаружи; не день — не напоминаем). Правило — 063-Р63 (064-Р8):
 * - файл был (`device.parent.exported` — день): нужен прогресс строго после него и ≥ `REMIND_DAYS` дней с него;
 * - файла не было: плашка сразу после `REMIND_MATCHES`-го доигранного матча (`day.played`, сумма по всем игрокам; уточнение
 *   063-Р63: не по пройденным урокам — тот же счёт, что плитка «Матчей доиграно»), срок не ждём: терять уже есть что.
 * Значение `exported` не день — как «файла не было». Прогресс «после файла» — дни пройденных уроков (`done`); отметка без дня не считается.
 */
export function remind(device: Pick<Device, 'parent'>, players: readonly Envelope[], today: string): boolean {
  if (!isDay(today)) return false;
  if (!isDay(device.parent.exported)) return matchesPlayed(players) >= REMIND_MATCHES;
  const days = progressDays(players);
  const exported = device.parent.exported;
  if (!days.some((d) => d > exported)) return false;
  return dayNo(today) - dayNo(exported) >= REMIND_DAYS;
}

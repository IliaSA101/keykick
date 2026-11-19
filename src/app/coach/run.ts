/**
 * «Минута тренера», проводка (067 Т25): какие клавиши брать, как подписать плитку, что писать в сохранение после минуты, часы.
 * Выбор — `engine/coach` (`hardKeys`, `coachKeys`, `keyTile`); здесь только сборка для экрана и панели Базы.
 */
import cfg from '../../content/match.json';
import type { Pack } from '../../content/schema/pack';
import { coachKeys, minuteResult, weakKeys, type MinuteState } from '../../engine/coach/minute';
import { hardKeys, keyTile, type KeyTile } from '../../engine/coach/keys';
import type { CoachKeys } from '../../engine/coach/section';
import type { CourseLesson } from '../../engine/plan/lesson';
import type { FormState } from '../../engine/form/rank';
import { finishMinute, minutePatch, type MinuteView } from '../../engine/match';
import type { Keymap } from '../../engine/typing/keymap';
import { ru } from '../../i18n/ru';
import { fill } from '../home/texts';
import { mmss } from '../learn/view';
import { matchRead } from '../match/finish';
import { lessonsOf } from '../match/run';

/** Урок минуты и панели: урок ребёнка, не дальше 32-го (двор); пакета нет или урока нет — `null`. */
export function minuteLesson(pack: Pack | null | undefined, cur: number): CourseLesson | null {
  const n = Math.min(cur, 32);
  return pack ? (lessonsOf(pack, 'yard', 32).find((l) => l.n === n) ?? null) : null;
}

/** Всё для старта минуты и панели Базы (один сборщик на оба места): клавиши, «свежие» и плитки. */
export interface MinuteSetup {
  keys: string;
  /** Настоящих трудных (на раскладке урока) меньше двух: остальное — свежие клавиши урока (067-Р280). */
  fresh: boolean;
  tiles: KeyTile[];
}

/** Клавиши минуты: до двух самых трудных, не хватает — свежие клавиши урока (067-Р280); урока нет — пустая заглушка. */
export function minuteOf(c: CoachKeys, form: FormState, keymap: Keymap, lesson: CourseLesson | null): MinuteSetup {
  if (lesson === null) return { keys: '', fresh: true, tiles: [] };
  const hard = hardKeys(c, cfg.coach.keys).map((h) => h.ch);
  const keys = coachKeys(hard, keymap, lesson);
  return { keys, fresh: weakKeys(hard, keymap, lesson).length < cfg.coach.keys, tiles: Array.from(keys).map((ch) => keyTile(c, form, ch)) };
}

/** Часы минуты: оставшееся, округлённое вверх до секунды («0:00» — только когда время вышло). */
export const clockText = (leftMs: number): string => mmss(Math.ceil(Math.max(0, leftMs) / 1000) * 1000);

/** Итог минуты для экрана и записи: плитки «было → стало» (клавиши — из идущей минуты), ошибки и патч для `session.save`; повтор `matchId` — `null`. */
export function endMinute(sections: Parameters<typeof matchRead>[0], s: MinuteState, matchId: string): { view: MinuteView; errors: number; patch: Record<string, unknown> } | null {
  const out = finishMinute(matchRead(sections), minuteResult(s), { matchId, keys: s.phase === 'idle' ? '' : s.keys });
  if (out.view === null) return null;
  return { view: out.view, errors: s.phase === 'idle' ? 0 : s.stats.errors, patch: minutePatch(out.save) };
}

const comma = (n: number): string => String(n).replace('.', ',');

/** Точность буквы: «89,3 %» (тысячные → проценты, запятая); нажатий ещё нет — пусто. */
export const pct = (permille: number | null): string => (permille === null ? '' : `${comma(permille / 10)} %`);

/** Клавиши заглавными через «и» для строки тренера: «Ы и Ж». */
export const keysText = (keys: string): string => Array.from(keys).map((k) => k.toUpperCase()).join(ru.club.hardAnd);

/** Подсказка под рангом: «до «запас»: ещё 0,7 %»; порог буквы уже взят — «держи эту точность» (067-Р281); высший ранг — пусто. */
export function tileLine(t: KeyTile): string {
  if (t.next === null) return '';
  const name = ru.result.purse.rankNames[t.next.rank] ?? '';
  if (t.next.need === 0) return fill(ru.coach.tile.hold, { name });
  return fill(ru.coach.tile.toRank, { name, n: comma(t.next.need / 10) });
}

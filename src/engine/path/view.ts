/**
 * Вид Пути клуба во Дворе (067 Т10, design §4): что показать, чего не показывать. Чистая функция: урок и «открыт ли Район» приходят снаружи.
 * Камера = выбор = Двор (054-Р1, П-З1); Район — силуэт «Район строится» (067-Р12, П-З3); выше — туман, кубок мира виден (ТЗ-1.3).
 */
import { LEAGUES, leagueIndex, type League } from '../nav';

export const YARD_LESSONS = 32;

export interface PathInput {
  /** Номер текущего урока Двора, 33 и выше — Двор пройден. */
  cur: number;
  /** Район открыт: Двор пройден и ворота открыты (в этапе Э1 бывает только в кадре стенда). */
  regionOpen: boolean;
}

/** Состояние деления шкалы: «здесь», «следующее», туман, кубок мира. */
export type DotKind = 'here' | 'next' | 'far' | 'world';

export interface PathDot {
  league: League;
  kind: DotKind;
  /** Двор пройден — галочка (Э7.184). */
  done: boolean;
}

/** Подсказка у деления при наведении мыши (Э7.186): ключ и число — строку собирает экран из i18n. */
export type PathTip = { kind: 'lessons'; n: number } | { kind: 'gate'; open: boolean } | { kind: 'after'; prev: League };

export interface PathView {
  /** Камера и выбор — всегда Двор. */
  level: 'yard';
  done: boolean;
  /** Урок для строки «урок N из 32»; на пройденном Дворе — 32. */
  lesson: number;
  of: number;
  gate: 'building' | 'open';
  scale: PathDot[];
}

export function pathView(i: PathInput): PathView {
  const done = i.cur > YARD_LESSONS;
  const scale = LEAGUES.map((league): PathDot => ({
    league,
    kind: league === 'yard' ? 'here' : league === 'district' ? 'next' : league === 'world' ? 'world' : 'far',
    done: league === 'yard' && done,
  }));
  return { level: 'yard', done, lesson: Math.min(i.cur, YARD_LESSONS), of: YARD_LESSONS, gate: done && i.regionOpen ? 'open' : 'building', scale };
}

/** Что сказать о делении при наведении: Район — «через N уроков» (или «открыт»/«строится» на пройденном Дворе), дальше — «откроется после …», Двор — ничего. */
export function pathTip(v: PathView, league: League): PathTip | null {
  if (league === 'yard') return null;
  if (league === 'district') return v.done ? { kind: 'gate', open: v.gate === 'open' } : { kind: 'lessons', n: v.of + 1 - v.lesson };
  return { kind: 'after', prev: LEAGUES[leagueIndex(league) - 1]! };
}

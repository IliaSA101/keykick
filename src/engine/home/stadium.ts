/**
 * Стадион Двора на Доме (048 §4, 065-Т5): сколько ступеней построено, следующая заготовка, золото, табло и болельщики
 * шапки. Ключи и числа, не строки. Макет-образец — `tools/mock-map/yard.mjs` (STEPS), `home-parts.mjs` (tabloNote, fansOf).
 */
import cfg from '../../content/yard.json';
import type { HomeInput } from './input';
import { lessonsOf } from './yard';

const STEPS = cfg.steps;
const total = (i: HomeInput): number => Object.values(i.stars).reduce((a, b) => a + b, 0);

/** Ступень k = двор-соперник k (023-Р29): золотая, если построена и все её уроки на ★★★. */
const stageGold = (i: HomeInput, k: number): boolean => lessonsOf(k).every((l) => (i.stars[l] ?? 0) >= 3);

/** Есть ли звёздный сектор (трибуна построена и ★ лиги ≥ порога). */
export const hasSector = (i: HomeInput): boolean => i.cur > cfg.seats.sectorAfterLesson && total(i) >= cfg.seats.sectorFromStars;

/** Мест на трибунах: основные и звёздный сектор — в «фигурках»; болельщиков на фигурку — `figure`. */
export const seatsOf = (i: HomeInput): number => (cfg.seats.stand + (hasSector(i) ? cfg.seats.sector : 0)) * cfg.seats.figure;

export interface StadiumView {
  /** Построено ступеней из `of` (за титул — все). */
  built: number;
  of: number;
  /** Следующая заготовка: id, после какого урока, сколько уроков осталось (включая этот); нет — «Открытие» за титул. */
  ghost: { n: number; id: string; lesson: number; left: number } | null;
  /** Золотые ступени 1…10; `goldWaiting` — заслужены, но ★ лиги ещё меньше порога (праздник «Стадион засиял»). */
  golds: number[];
  goldWaiting: boolean;
  sector: boolean;
  /** Табло: ступени нет или Двор пройден — `none`; все сидят — `fans`; иначе `over` (n — сверх мест); `goal` — куплена анимация гола. */
  tablo: { kind: 'none' | 'fans' | 'over'; n: number; goal: boolean };
}

/** Сколько ступеней Двора построено на уроке `cur` (за титул `end` — все): единственное место, откуда Дом и догрузка графики берут ступень. */
export const builtOf = (cur: number, end = false): number => Math.min(cfg.stepsTotal, STEPS.filter((s) => s.after < cur).length + (end ? 1 : 0));

/** Табло построено: ступень «scoreboard» из `yard.json` среди уже достроенных (`built` — из `builtOf`; не зависит от титула и «Двор пройден»). */
export const scoreboardBuilt = (built: number): boolean => built > STEPS.findIndex((s) => s.id === 'scoreboard');

export function stadiumView(i: HomeInput): StadiumView {
  const built = builtOf(i.cur, i.end);
  const next = STEPS.find((s) => s.after >= i.cur);
  const owned = Array.from({ length: Math.min(built, cfg.stepsTotal) }, (_, k) => k + 1).filter((k) => stageGold(i, k));
  const enough = total(i) >= cfg.gold.fromStars;
  const fans = i.fans;
  const over = fans - seatsOf(i);
  const tabloOn = i.cur >= cfg.seats.tabloFrom && i.cur <= cfg.lessons;
  return {
    built,
    of: cfg.stepsTotal,
    ghost: i.end || !next ? null : { n: built + 1, id: next.id, lesson: next.after, left: next.after - i.cur + 1 },
    golds: enough ? owned : [],
    goldWaiting: !enough && owned.length > 0,
    sector: hasSector(i),
    tablo: { kind: !tabloOn ? 'none' : over > 0 ? 'over' : 'fans', n: !tabloOn ? 0 : over > 0 ? over : fans, goal: i.bought.includes('goal-anim') },
  };
}

/** Звёзды в шапке (ТЗ-1.8): `★ N/96`. Вариант «веха» слабого ребёнка (048-Р31) — волна 4. */
export const headStars = (i: HomeInput): { kind: 'total'; n: number; of: number } => ({ kind: 'total', n: total(i), of: cfg.gold.maxStars });

/** Болельщики в шапке: `n` — все; `over` — сверх мест со ступени «скамейки» (после урока 9), иначе 0 (048-Р29). */
export function headFans(i: HomeInput): { n: number; over: number } {
  const benches = STEPS.find((s) => s.id === 'benches')?.after ?? 0;
  return { n: i.fans, over: i.cur > benches ? Math.max(0, i.fans - seatsOf(i)) : 0 };
}

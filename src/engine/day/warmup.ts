/**
 * Микроразминка (068 Т3, ТЗ-10.5; story.md §4): раз в ≈ 20 мин печати с прошлой, после «На матч» или в перерыве, не посреди
 * атаки; пропуск и выполнение обнуляют счёт, новый игровой день — тоже (`addTyped`). Часы и время печати приходят снаружи.
 */
import { addTyped, type Day } from './section';

/** Печати с прошлой разминки, после которой пора размяться, мс. */
export const WARMUP_AFTER_MS = 20 * 60 * 1000;

/** Где в матче предлагаем разминку: перед матчем и в перерыве — можно, посреди атаки — нет (С4). */
export type WarmupSpot = 'start' | 'break' | 'attack';

/** Печати с прошлой разминки в день `today`, мс (день не тот — счёт идёт заново). */
export const typedSince = (d: Day, today: string): number => (d.msDay === today ? (d.typedMs ?? 0) - (d.warmFrom ?? 0) : 0);

/** Пора ли разминаться: ≥ 20 мин печати с прошлой разминки. */
export const warmupDue = (d: Day, today: string): boolean => typedSince(d, today) >= WARMUP_AFTER_MS;

/** Разминку можно показать здесь и сейчас. */
export const warmupAt = (d: Day, today: string, spot: WarmupSpot): boolean => spot !== 'attack' && warmupDue(d, today);

/** Разминка сделана или пропущена: счёт печати с неё — заново. */
export const warmupDone = (d: Day): Day => ({ ...d, warmFrom: d.typedMs ?? 0 });

/**
 * Разминка в перерыве (068-Р69): время печати первого тайма в день ещё не записано (запись — на свистке), поэтому считаем его здесь:
 * день с ним — только для решения, в сохранение не идёт.
 */
export const warmupAtBreak = (d: Day, today: string, halfMs: number): boolean => warmupAt(addTyped(d, today, halfMs), today, 'break');

/**
 * Разминка в перерыве сделана или пропущена: счёт — с этой точки. Время первого тайма на свистке запишется в `typedMs` целиком,
 * поэтому точка стоит на `halfMs` впереди записанного: после свистка «с разминки» останется только второй тайм.
 * Цена (068-Р77, принято): матч, брошенный после разминки в перерыве, свистка не даёт — точка остаётся впереди записанного, и следующая
 * разминка сдвигается не больше чем на тайм (`halfMs`); новый день счёт сбрасывает (`warmupAt` сверяет день).
 */
export const warmupDoneAtBreak = (d: Day, halfMs: number): Day => ({ ...d, warmFrom: (d.typedMs ?? 0) + Math.max(0, Math.round(Number.isFinite(halfMs) ? halfMs : 0)) });

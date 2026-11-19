/**
 * Цвет соперника матча (067-Р105, Р216 → Т21): один источник для сцены матча, итога, арены учебных игр, Штрафного и Вратаря.
 * Соперник — команда двора урока (`engine/cup/teams.ts`, `rivalOf(урок)`); цвет — `rivalColor` команды при форме клуба
 * (c1, при зелёном c1 — c2, 036-Р38/Р50). Чистые функции, без Vue. ТАБУ (В1): сине-жёлтого соперник не даёт — цвета команд
 * проверены тестом на всех 31 команде и всех расцветках клуба.
 */
import { rivalColor } from '../cup/teams';
import type { Team } from '../cup/types';
import type { ClubKit } from './section';

/** Оранжевый — цвет фишек соперника, пока команда не известна (стенд без урока). */
export const RIVAL_ORANGE = '#f28a1c';
/** Тёмный кант формы соперника и полосы его фишек на арене. */
export const RIVAL_TRIM = '#1f1f1f';

/** Цвет соперника при форме клуба: основной цвет формы команды (`rivalColor`). */
export function rivalBodyOf(rival: Pick<Team, 'c1' | 'c2'>, kit: Pick<ClubKit, 'body' | 'alt'>): string {
  return rivalColor(rival, kit);
}

/** Форма соперника в матче и на итоге: рисунок как у клуба, цвета — по `rivalBodyOf`. */
export function rivalKitOf(rival: Pick<Team, 'c1' | 'c2'>, kit: ClubKit): ClubKit {
  return { pattern: kit.pattern, body: rivalBodyOf(rival, kit), sleeves: 'split', trim: RIVAL_TRIM };
}

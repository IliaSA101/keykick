/**
 * Команда на поле Дома (065 Т7д, Р180; макет — `tools/mock-map/home_team.py`, ТЗ-5.11, 023-Р32 (3)): ребёнок — вратарь в своих
 * воротах с первого урока, полевые игроки приходят с уроками (пальцы левой руки слева, правой справа), белый контур — следующая
 * группа. Чистая функция «урок, покупки, ступень → картинки»: без DOM и случайности. Спрайты запечены в синем и красятся
 * цветом клуба тем же путём, что болельщики (`recolorCrowd`).
 */
import art from '../../content/home-art.json';
import type { Piece } from './scene';

const TEAM = art.team;
const BOOTS_BOX = 'boots-box';
const BOOTS_YARD = 'boots-yard';

/** Бутсы игроков: «коробка» — зелёные, «дворовые» — чёрные, до покупки — светлые кеды (ТЗ-3.7). */
export type Feet = 's' | 'b' | 'x';
export const feetOf = (bought: readonly string[]): Feet => (bought.includes(BOOTS_BOX) ? 'x' : bought.includes(BOOTS_YARD) ? 'b' : 's');

/** Урок, с которого приходит следующая группа игроков; все на поле — `null`. */
export const nextGroupFrom = (cur: number): number | null => TEAM.players.reduce<number | null>((m, p) => (p.from > cur && (m === null || p.from < m) ? p.from : m), null);

/** Картинка вратаря: призовая форма с урока `prizeFrom`; ближняя сетка у ворот — со ступени `netFrom` (ноги сквозь сетку). */
export function keeperFile(cur: number, built: number): string {
  const k = TEAM.keeper;
  const f = k.files as Record<string, string>;
  return f[`${cur >= k.prizeFrom ? 'p' : ''}${built >= k.netFrom ? 'n' : ''}` || 'r']!;
}

/**
 * Кто на поле. Порядок слоёв — как в макете: вратарь, пришедшие игроки, контур следующей группы (`outline: false` — «фото» газеты:
 * контур на фото читается браком). Файл `team-p…` красится цветом клуба, контур (`team-o…`) — нет.
 */
export function teamOf(cur: number, bought: readonly string[], built: number, outline = true): Piece[] {
  const k = TEAM.keeper;
  const out: Piece[] = [{ key: 'team-k', file: keeperFile(cur, built), x: k.x - k.w / 2, y: k.feet - k.ch + TEAM.pad, w: k.w, h: k.ch }];
  const feet = feetOf(bought);
  const next = nextGroupFrom(cur);
  TEAM.players.forEach((p, n) => {
    const file = p.from <= cur ? p.files[feet] : outline && p.from === next ? p.outline : null;
    if (file) out.push({ key: `team-${n}`, file, x: p.x - p.w / 2, y: p.feet - p.ch + TEAM.pad, w: p.w, h: p.ch });
  });
  return out;
}

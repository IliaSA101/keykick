/**
 * Команды Кубка Двора и соперник урока (067-Т21, контракт 068 design §2). Данные — `content/cup-yard.json` (31 команда макета
 * `tools/mock-champ/data.mjs`); соперник урока — двор на улице ступени урока (`engine/home/yard.ts`, как `rivalOf` макета `yard.mjs`).
 * Чистые функции: Vue, DOM, часов и случайности нет. Цвет формы соперника — `rivalColor`: один источник для сцены матча, итога,
 * арены учебных игр, Штрафного и Вратаря (036-Р38).
 */
import cup from '../../content/cup-yard.json';
import { hue, hexToRgb, lightness } from '../club/paint';
import type { ClubKit } from '../club/section';
import { streetName, streetOf } from '../home/yard';
import type { Team } from './types';

/** Все 31 команда Кубка в порядке макета: группы A…H, внутри — посев. */
export const TEAMS: readonly Team[] = cup.teams;
/** Сквозной соперник каждого чемпионата («Рассвет», 038-Р6): есть в каждом Кубке. */
export const THROUGH_TEAM: string = cup.through;

/** Команда двора на улице `street` (родительный падеж, как в `yard.json`); улицы нет в Кубке — `undefined`. */
export const teamOf = (street: string): Team | undefined => TEAMS.find((t) => t.street === street);

/** Соперник урока 1…32: команда двора, чьи ступень и улица у урока (`streetOf` Дома). Урок вне Двора — последняя ступень, как у Дома. */
export function rivalOf(lesson: number): Team {
  const street = streetName(streetOf(lesson));
  const team = teamOf(street);
  if (team === undefined) throw new Error(`rivalOf: no cup team on street "${street}" (lesson ${lesson})`);
  return team;
}

/** Зелёный ли цвет (оттенок 80–170°, насыщенность > 0,3): путается с зелёной формой клуба (036-Р50). Правило макета `greenish`, `tools/mock-games/data.mjs`.
 * Не `hue` из `club/paint`: там свои пороги (насыщенность и яркость), а у тёмно-зелёного Флагмана #0b5345 `hue` даёт null —
 * соперник остался бы зелёным против зелёных; пороги макета ловят его. */
export function greenish(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn || (mx - mn) / mx <= 0.3 || mx !== g) return false;
  const h = 60 * (2 + (b - r) / (mx - mn));
  return h >= 80 && h <= 170;
}

/** Близость оттенков (градусы) и яркостей безоттеночных цветов, при которой два цвета на поле сливаются. */
const CLOSE_HUE = 25;
const CLOSE_LIGHT = 0.2;

/** Сливаются ли два цвета: оба цветные с близким оттенком или оба серые (белое, чёрное, тёмный) с близкой яркостью. */
export function blends(a: string, b: string): boolean {
  const ha = hue(a);
  const hb = hue(b);
  if (ha === null || hb === null) return ha === hb && Math.abs(lightness(a) - lightness(b)) < CLOSE_LIGHT;
  const d = Math.abs(ha - hb);
  return Math.min(d, 360 - d) < CLOSE_HUE;
}

/**
 * Цвет формы соперника при форме клуба. Правило: c1 команды; если c1 зелёный — c2 (вторая форма, 036-Р50: иначе путается с нашими
 * зелёными). Дальше сверка с формой клуба (`blends`), сначала с основным цветом `kit.body`: выбранный цвет слился с ним — второй
 * цвет команды, если тот не сливается; сливаются оба — остаётся выбранный первым (команду не подменяем). Полосы `alt` учитываются,
 * только если по `body` годны оба цвета. Развилка 067-Р239 (поправлено по ревью 19.11).
 */
export function rivalColor(team: Pick<Team, 'c1' | 'c2'>, kit: Pick<ClubKit, 'body' | 'alt'>): string {
  const first = greenish(team.c1) ? team.c2 : team.c1;
  const second = first === team.c1 ? team.c2 : team.c1;
  const pick = (ours: string): string | undefined => {
    const clash = (c: string): boolean => blends(c, ours);
    if (!clash(first)) return clash(second) ? first : undefined;
    return clash(second) ? first : second;
  };
  // `undefined` — по этому цвету клуба выбора нет (годны оба): решает следующий
  const byBody = pick(kit.body);
  if (byBody !== undefined || kit.alt === undefined) return byBody ?? first;
  return pick(kit.alt) ?? first;
}

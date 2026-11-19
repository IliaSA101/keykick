/**
 * Раскладка арены Вратаря (кадры Э4.37–40; макет `tools/mock-games/e4-keeper.mjs`): всё в px арены — картинка `bg-keeper` 2560×1429, показанная
 * 720 px высотой (крупнее «cover»: ворота крупно, низ картинки — на низе сцены 640 px). Арена сдвигается по горизонтали так, чтобы
 * ворота встали по центру свободной части левее панели (`arenaLeft`). Ничего не считает по правилам игры — только где что стоит.
 */
import type { ArtKey } from '../../art/assets';

export const ARENA_H = 720;
export const ARENA_W = (ARENA_H * 2560) / 1429;
/** Проём ворот в долях картинки: между штангами, под перекладиной, до линии ворот. */
const GATE = { x0: 0.2674, x1: 0.7267, y0: 0.289, y1: 0.592 };
export const GATE_PX = { x0: GATE.x0 * ARENA_W, x1: GATE.x1 * ARENA_W, y0: GATE.y0 * ARENA_H, y1: GATE.y1 * ARENA_H };
export const GATE_CX = (GATE_PX.x0 + GATE_PX.x1) / 2;
/** Низ арены — низ сцены; ступни бьющего — 44 px от низа. */
const RIVAL_BOTTOM = ARENA_H - 44;

/** Ширина правой панели в базовых px: 214 на 1024, к 1920 (сцена 1137,78) — 261 (по макету). Выражение CSS в долях ширины сцены (`%` от блока-родителя). */
export const PANEL_W = 'clamp(214px, calc(214px + (100% - 1024px) * 0.413), 261px)';
/** Левый край арены: ворота — по центру места левее панели; картинка не уходит за края сцены. */
export const ARENA_LEFT = `clamp(calc(100% - ${ARENA_W.toFixed(1)}px), calc((100% - 16px - ${PANEL_W}) / 2 - ${GATE_CX.toFixed(1)}px), 0px)`;

/** Масштаб от замера макета: проём 218 px. */
const K = (GATE_PX.y1 - GATE_PX.y0) / 218;
export const KEEPER_H = Math.round(158 * K);
export const RIVAL_H = Math.round(196 * K);
export const FEET = GATE_PX.y1 + 4;
export const RIVAL_X = GATE_CX - 12;
export const RIVAL_BOTTOM_Y = RIVAL_BOTTOM;
/** Откуда летит мяч: рука бьющего. */
export const KICK_FROM = { x: RIVAL_X + 10, y: RIVAL_BOTTOM - 70 };

export type KeeperPose = 'ready' | 'dive' | 'joy';
export type RivalPose = 'run' | 'kick';
interface SpriteDef { art: ArtKey; kit: ArtKey; w: number; h: number }
export const KEEPER_SPRITES: Record<KeeperPose, SpriteDef> = {
  ready: { art: 'baseKeeperReady', kit: 'baseKeeperReadyKit', w: 400, h: 498 },
  dive: { art: 'baseKeeperDive', kit: 'baseKeeperDiveKit', w: 610, h: 445 },
  joy: { art: 'baseKeeperJoy', kit: 'baseKeeperJoyKit', w: 251, h: 424 },
};
export const RIVAL_SPRITES: Record<RivalPose, SpriteDef> = {
  run: { art: 'baseRivalRun', kit: 'baseRivalRunKit', w: 263, h: 414 },
  kick: { art: 'baseRivalKick', kit: 'baseRivalKickKit', w: 288, h: 424 },
};
/** У позы «удар» в файле нарисован мяч — вырезается (px файла). */
export const KICK_BALL_CLIP = { x: 0, y: 216, w: 66, h: 86 };

/** Центр сектора i (0…7) по горизонтали. */
export const sectorX = (i: number): number => GATE_PX.x0 + ((GATE_PX.x1 - GATE_PX.x0) * (i + 0.5)) / 8;
export const GATE_MID_Y = (GATE_PX.y0 + GATE_PX.y1) / 2;

/** Мяч в полёте: центр и радиус при доле пути `f` от бьющего к центру сектора `i`: чем дальше, тем меньше (64 → 40 px на 1920, делённые на 1,6875). */
export function ballAt(f: number, i: number): { x: number; y: number; r: number } {
  const tx = sectorX(i);
  return { x: KICK_FROM.x + f * (tx - KICK_FROM.x), y: KICK_FROM.y + f * (GATE_MID_Y - KICK_FROM.y), r: ((64 + (40 - 64) * f) / 1.6875) / 2 };
}

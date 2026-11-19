/**
 * Раскладка сцены Чеканки (кадры Э4.27–29, 45; макет `tools/mock-games/e4-keepy.mjs`): числа — «настоящие» px слоя 1920×1080,
 * слой масштабируется в базовые px экрана (1920 ÷ 1,6875). Ничего не считает по правилам игры — только где что стоит.
 */
import type { ArtKey } from '../../art/assets';

/** Множитель 1920 к базовым px сцены. */
export const Z = 1.6875;
/** Центр свободной части (правее панели) и сдвиг фона: проём гаража встаёт по этому центру. */
export const SX = 1170;
export const SHIFT = 210;
/** Линия ступней Саши; масштаб спрайта (≈ 430 px файла → ≈ 400 px роста на 1920). */
export const FEET = 1010;
export const K = 0.93;
/** Радиус мяча в px спрайта. */
export const BALL_R = 31;
/** Проём гаража на картинке фона (доли ширины и высоты), притемняется на время игры. */
export const OPENING = { x: 0.34, y: 0.508, w: 0.32, h: 0.272 };
/** Высота буквы над мячом: в начале падения — `UP_TOP`, у мяча — `UP_END` (px 1920). */
export const UP_TOP = 270;
export const UP_END = 30;

export type Pose = 'stand' | 'knee' | 'knee2' | 'joy' | 'joy1';

/** Спрайт Саши: рисунок, размер файла, середина тела по x, мяч в файле (если он там есть), центр поля футболки на спине. */
interface Sprite {
  art: ArtKey;
  w: number;
  h: number;
  cx: number;
  ball?: [number, number];
  back: [number, number];
}

export const SPRITES: Record<Pose, Sprite> = {
  stand: { art: 'baseSashaStand', w: 204, h: 431, cx: 100, ball: [170, 388], back: [72, 185] },
  knee: { art: 'baseSashaKnee', w: 194, h: 430, cx: 80, ball: [160, 190], back: [68, 180] },
  knee2: { art: 'baseSashaKnee2', w: 204, h: 427, cx: 119, ball: [32, 184], back: [112, 185] },
  joy: { art: 'baseSashaJoy', w: 200, h: 421, cx: 100, back: [90, 180] },
  joy1: { art: 'baseSashaJoy1', w: 158, h: 422, cx: 79, back: [72, 180] },
};

/** Где стоит спрайт позы: левый верх и размер на слое, мяч и спина — точки на слое. */
export function place(pose: Pose): { left: number; top: number; width: number; height: number; ball: [number, number] | null; back: [number, number] } {
  const p = SPRITES[pose];
  const left = SX - p.cx * K;
  const top = FEET - p.h * K;
  const at = ([u, v]: [number, number]): [number, number] => [Math.round(left + u * K), Math.round(top + v * K)];
  return { left, top, width: Math.round(p.w * K), height: Math.round(p.h * K), ball: p.ball ? at(p.ball) : null, back: at(p.back) };
}

/** Высота буквы над мячом (px 1920) по доле падения 0…1. */
export const letterUp = (progress: number): number => UP_TOP - (UP_TOP - UP_END) * Math.max(0, Math.min(1, progress));

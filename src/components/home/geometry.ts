/**
 * Координаты Дома (048): кадр печи 1920×1072 → сцена, картинка «cover» по высоте 640. Чистые функции, общие для слоёв сцены,
 * ярлыков и окон. Ширина сцены `W` — в базовых px (1138 на 1920, 1024 на узком окне).
 */
import yard from '../../content/home-yard.json';
import type { Piece } from '../../app/home/scene';

export const K = 640 / 1072;
/** Сдвиг картинки по ширине сцены: она по центру. */
export const offOf = (W: number): number => (W - 1920 * K) / 2;
export const sxOf = (W: number, x: number): number => offOf(W) + x * K;
export const syOf = (y: number): number => y * K;
export const pieceStyle = (p: Piece): Record<string, string> => ({ left: `${p.x}px`, top: `${p.y}px`, width: `${p.w}px`, height: `${p.clip !== undefined && p.clip < p.h ? p.clip : p.h}px`, transform: p.flip ? 'scaleX(-1)' : '' });

/** Рамка заготовки следующей ступени; у ступени с несколькими рамками — нет. */
export function stepBoxOf(built: number): [number, number, number, number] | null {
  const s = yard.steps.find((x) => x.n === built);
  return s && !Array.isArray(s.box[0]) ? (s.box as [number, number, number, number]) : null;
}

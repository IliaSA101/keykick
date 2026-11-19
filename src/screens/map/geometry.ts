/**
 * Линии и места Карты Двора (065 Т8): маршрут, ярлыки дворов, автобус. Привязка кадра к сцене (`H`, `pointOf`) — в
 * `components/home/yardGeometry.ts` (общая с Путём клуба). Чистые функции.
 */
import cfg from '../../content/map-yard.json';
import { pointOf, type Pt } from '../../components/home/yardGeometry';

/** Гладкая линия через точки (Catmull-Rom → кривые Безье), как `smooth` макета. */
export function smooth(pts: readonly Pt[]): string {
  const f = (v: number): string => v.toFixed(1);
  let d = `M${f(pts[0]![0])} ${f(pts[0]![1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Отрезки пути `from`…`to`-1 одной ломаной (без повтора стыков). */
export const joinRoute = (W: number, from: number, to: number): Pt[] => cfg.route.slice(from, to).flatMap((seg, i) => seg.slice(i ? 1 : 0).map((p) => pointOf(W, p)));

/** Место ярлыка двора `stage` (1…10): точка пути плюс сдвиг `dx`, `dy` из контента. */
export function yardAt(W: number, stage: number): Pt {
  const y = cfg.yards[stage - 1] as { at: number[]; dx?: number; dy?: number };
  const [x, yy] = pointOf(W, y.at);
  return [x + (y.dx ?? 0), yy + (y.dy ?? 0)];
}

/**
 * Точка автобуса на отрезке пути: доля `t` длины ломаной (0…1), `dx` — направление звена по горизонтали (знак — зеркало спрайта).
 * Как `along` макета (`tools/mock-map/league.mjs`): считается по сырым точкам, не по сглаженной кривой.
 */
export function alongPath(pts: readonly Pt[], t: number): { x: number; y: number; dx: number } {
  const len = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]));
  let need = t * len.reduce((a, b) => a + b, 0);
  for (let i = 0; i < len.length; i++) {
    if (need <= len[i]!) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const k = len[i]! === 0 ? 0 : need / len[i]!;
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: b[0] - a[0] };
    }
    need -= len[i]!;
  }
  const a = pts[pts.length - 2] ?? pts[0]!;
  const b = pts[pts.length - 1]!;
  return { x: b[0], y: b[1], dx: b[0] - a[0] };
}

/** Точки отрезка пути к двору `stage` (1…10), px сцены `W`. */
export const legOf = (W: number, stage: number): Pt[] => cfg.route[stage - 1]!.map((p) => pointOf(W, p));

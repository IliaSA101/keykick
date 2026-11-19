/**
 * «Точный пас мышью» (057, игра 2): пять щелчков по партнёру, затем три переноса мяча к нему.
 * Промах — щелчок мимо или сброс дальше радиуса. Координаты арены — проценты 0…100 по каждой стороне; радиус — доля ширины (067-Р33).
 */
import cfg from '../../../content/learn.json';
import { createRandom, randomInt } from '../../random';
import type { Playing, Pt } from './common';

export interface MouseStep {
  kind: 'click' | 'carry';
  /** Партнёр. */
  target: Pt;
  /** Откуда мяч (только перенос). */
  ball: Pt | null;
}

export interface MouseState extends Playing {
  steps: readonly MouseStep[];
  at: number;
  /** Высота арены к ширине: координаты — проценты каждой стороны, радиус — доля ширины, по высоте он масштабируется. */
  aspect: number;
}

export type MouseInput = { type: 'click'; at: Pt } | { type: 'drop'; at: Pt };

const spot = (rnd: () => number): Pt => ({ x: 10 + randomInt(rnd, 81), y: 10 + randomInt(rnd, 81) });

/** Расстояние в единицах ширины арены (проценты по высоте приводятся через соотношение сторон). */
const dist = (a: Pt, b: Pt, aspect: number): number => Math.hypot(a.x - b.x, (a.y - b.y) * aspect);

export function startMouse(seed: number, aspect: number): MouseState {
  const rnd = createRandom(seed);
  const { clicks, carries } = cfg.play.mouse;
  const steps: MouseStep[] = [];
  for (let i = 0; i < clicks; i++) steps.push({ kind: 'click', target: spot(rnd), ball: null });
  for (let i = 0; i < carries; i++) {
    const target = spot(rnd);
    // мяч не у самого партнёра: пока ближе двух радиусов — перевыбрать (как цель в tab)
    let ball = spot(rnd);
    while (dist(ball, target, aspect) <= 2 * cfg.play.mouse.radius) ball = spot(rnd);
    steps.push({ kind: 'carry', target, ball });
  }
  return { steps, at: 0, aspect, misses: 0, done: false };
}

/** Щелчок или сброс. Ввод не того рода (щелчок во время переноса) — не считается ничем. */
export function inputMouse(s: MouseState, input: MouseInput): MouseState {
  const step = s.steps[s.at];
  if (s.done || step === undefined) return s;
  if ((step.kind === 'click') !== (input.type === 'click')) return s;
  const hit = dist(input.at, step.target, s.aspect) <= cfg.play.mouse.radius;
  if (!hit) return { ...s, misses: s.misses + 1 };
  const at = s.at + 1;
  return { ...s, at, done: at >= s.steps.length };
}

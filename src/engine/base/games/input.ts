/** Ввод игр на интерес: нажатая клавиша или «тик» часов. Время `t` (мс) приходит снаружи (движку нельзя Date.now). */
export type FunInput = { kind: 'key'; key: string } | { kind: 'tick' };

/** Зерно для n-го случайного выбора: состояние игры хранит только числа и остаётся простым объектом. */
export function seedAt(seed: number, n: number): number {
  return (Math.imul(seed >>> 0, 2654435761) + Math.imul(n + 1, 40503)) >>> 0;
}

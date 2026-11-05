/**
 * Повторяемая случайность: одно и то же зерно даёт ту же последовательность.
 * Движку нельзя Math.random — тогда урок и тест не повторить (страж в tests/guards.test.ts).
 */

/** Генератор mulberry32: числа в [0, 1). Быстрый и с хорошим разбросом для игровых задач. */
export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Целое в [0, n). */
export function randomInt(rnd: () => number, n: number): number {
  return Math.floor(rnd() * n);
}

/** Элемент массива; массив не пустой. */
export function pick<T>(rnd: () => number, items: readonly T[]): T {
  const item = items[randomInt(rnd, items.length)];
  if (item === undefined) throw new Error('pick from empty list');
  return item;
}

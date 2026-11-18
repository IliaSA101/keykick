/**
 * Конфетти на победе (065 Т10в, кадры Э1.22/.32): 38 обрывков в полосе поля над сеткой, числа — из генератора кадра
 * (`tools/mock-mk1/extra.mjs: resultConfetti`: тот же счётчик, зерно 7). Чистая функция: случайности снаружи нет, раскладка
 * всегда одна и та же — как в принятом кадре. Цвета клуба и золото; синего и красного нет (ТАБУ: жёлтое не касается синего).
 */

export interface Piece {
  /** Слева, px сцены (полоса 740 px). */
  left: number;
  /** Сверху, px полосы (высота 160). */
  top: number;
  /** Цвет обрывка. */
  color: string;
  /** Поворот, градусы. */
  rot: number;
}

export const CONFETTI_COLORS = ['#f4c24a', '#ffffff', '#3cb85a', '#e8e8e8', '#7ad67f', '#d9a63a'] as const;

export function confetti(count = 38): Piece[] {
  let seed = 7;
  const rnd = (): number => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const out: Piece[] = [];
  for (let i = 0; i < count; i++) {
    const left = Math.round(rnd() * 720);
    const top = Math.round(4 + rnd() * 140);
    out.push({ left, top, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] ?? '#ffffff', rot: Math.round(rnd() * 180) });
  }
  return out;
}

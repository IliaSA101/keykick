/**
 * Геометрия экрана Кубка (макет `geo` из tools/mock-champ/e5-screens.mjs): доска под строкой экрана — cover без растяжения, меловое поле — по долям
 * картинки `board.webp` (1920×1072). Ширина сцены — 1137,78 на окне 1920 и 1024 на 1024; высота сцены — 640.
 */
const BOARD_TOP = 88; // доска — под шапкой kit (40) и строкой экрана (46…86)
const PAD = 16; // отступ мелового поля от рамы
const ALIGN = 0.4; // какую долю лишней высоты картинки срезать сверху

export interface CupGeo {
  W: number;
  bh: number;
  iw: number;
  ih: number;
  ox: number;
  oy: number;
  /** Область содержимого: левый верх и размер. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Вылет мяча слева от правого края поля (дорожка кончается левее). */
  ball: number;
  boardTop: number;
  /** Меловое поле целиком (по долям картинки): левый верх и размер — для маски праздничной доски. */
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  /** Низ сетки плей-офф: над мячом на полке (справа внизу), ниже — панель шага. */
  tb: number;
}

export function cupGeo(W: number): CupGeo {
  const bh = 640 - BOARD_TOP;
  const k = Math.max(W / 1920, bh / 1072);
  const [iw, ih] = [1920 * k, 1072 * k];
  const ox = (W - iw) / 2;
  const oy = -(ih - bh) * ALIGN;
  const fx = ox + 0.103 * iw;
  const fy = BOARD_TOP + oy + 0.175 * ih;
  const fw = 0.794 * iw;
  const fh = 0.681 * ih;
  return { W, bh, iw, ih, ox, oy, x: fx + PAD, y: fy + 8, w: fw - 2 * PAD, h: fh - 8 - PAD, ball: 0.079 * iw - PAD + 10, boardTop: BOARD_TOP, fx, fy, fw, fh, tb: 0.588 * ih - 14 };
}

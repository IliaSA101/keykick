/**
 * Отъезд от Дома к Пути клуба (М8, Э7.192–196; 052-Р36, Р38; 054-Р10, Р17). Чистые функции: доля `t` (0…1) приходит снаружи,
 * экран по ней ставит слои. Двор (слой Пути) приближен в `k = 3^(1−t)` раз вокруг точки `origin`; Дом лежит над ним картинкой,
 * сжимается вместе с ним (масштаб `k / 3`), полем едет на поле Двора и тает на долях 0,5…0,75. Всё — в долях кадра 16:9 (x по ширине
 * картинки, y по высоте); на t = 0 Дом стоит как в покое (тождество), на t = 1 слоя Дома нет.
 */
import { NAV, type Via } from '../nav';

type Pt = readonly [number, number];
/** Середина поля на кадре Дома и на кадре Двора (замер Э7.192 и Э7.196, 1920). */
const HOME_FIELD: Pt = [0.4583, 0.7315];
const YARD_FIELD: Pt = [0.138, 0.8889];
/** Где флаг и «Ты здесь» стоят на t = 0 относительно покоя (замер Э7.192, 1920: от флага Двора к стадиону на картинке Дома). */
const HERE_FROM: Pt = [0.132, -0.209];
/** Длительность полного отъезда: смена сцены (`--motion-scene`, 061); короткий — `NAV.stepMs` (054-Р17). */
export const FULL_MS = 900;

const clamp = (x: number): number => Math.min(1, Math.max(0, x));
const smooth = (x: number): number => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};

export interface EnterFrame {
  /** Масштаб слоя Двора вокруг `origin`. */
  k: number;
  origin: Pt;
  /** Слой Дома: масштаб, сдвиг левого верхнего угла (доли кадра) и прозрачность. */
  home: { scale: number; dx: number; dy: number; opacity: number };
  /** Ворота Района входят позже картинки (на 0,75 слой Двора ещё увеличен и ярлык лежал бы за кромкой). */
  gateOpacity: number;
  /** Плашка «Ты здесь»: стоит с t = 0 (054-Р10), на эталоне Э7.193–195 уступает место флагу и возвращается в конце. Сам флаг виден всегда. */
  hereOpacity: number;
  /** Сдвиг флага и «Ты здесь» от места в покое (доли кадра: x по ширине картинки, y по высоте): на t = 0 — у стадиона на картинке Дома, к концу ноль (линейно, замер Э7.193 и Э7.195). */
  hereDx: number;
  hereDy: number;
}

export function enterFrame(t: number): EnterFrame {
  const u = clamp(t);
  const k = 3 ** (1 - u);
  const origin: Pt = [Math.max(0, (3 * YARD_FIELD[0] - HOME_FIELD[0]) / 2), (3 * YARD_FIELD[1] - HOME_FIELD[1]) / 2];
  const s = k / 3;
  const ease = smooth(u / 0.5);
  const at = (i: 0 | 1): number => origin[i] + k * (YARD_FIELD[i] - origin[i]) + (HOME_FIELD[i] - (origin[i] + 3 * (YARD_FIELD[i] - origin[i]))) * (1 - ease);
  return {
    k,
    origin,
    home: { scale: s, dx: at(0) - s * HOME_FIELD[0], dy: at(1) - s * HOME_FIELD[1], opacity: 1 - smooth((u - 0.5) / 0.25) },
    gateOpacity: Math.max(0, 4 * u - 3),
    hereOpacity: Math.max(1 - smooth(u / 0.15), smooth((u - 0.85) / 0.15)),
    hereDx: HERE_FROM[0] * (1 - u),
    hereDy: HERE_FROM[1] * (1 - u),
  };
}

/** Вход с Карты: слой лиги гаснет, ярлыки Пути проявляются ≈ 0,3 с (054 §3 «Вход в Путь клуба из Карты», Р11). */
export const LAYER_MS = 300;

export interface EnterPlan {
  ms: number;
  /** Есть масштаб (отъезд); без него — только прозрачность. */
  move: boolean;
  /** Над Путём лежит слой Дома (тает); с Карты Дома нет — гаснет только слой лиги. */
  home: boolean;
}

/**
 * Сколько идёт вход и есть ли движение. «Меньше движения» (N7): растворение `NAV.reducedMs` без масштаба. Вход с Карты (`layerOff`) —
 * проявление ярлыков `LAYER_MS` без движения и без Дома. `null` — открыт адресом, Esc/«назад» и прочее: без отъезда.
 */
export function enterPlan(via: Via | null, reduced: boolean): EnterPlan | null {
  if (via === 'layerOff') return { ms: reduced ? NAV.reducedMs : LAYER_MS, move: false, home: false };
  if (via !== 'full' && via !== 'short') return null;
  if (reduced) return { ms: NAV.reducedMs, move: false, home: true };
  return { ms: via === 'full' ? FULL_MS : NAV.stepMs, move: true, home: true };
}

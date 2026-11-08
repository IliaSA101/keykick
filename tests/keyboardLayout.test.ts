/**
 * Геометрия экранной клавиатуры: клавиши не налезают друг на друга, ряды ровные,
 * пробел — по центру под руками, кончики пальцев — над своими клавишами.
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { parseKeymap } from '../src/engine/keymap';
import { HAND_TIPS, THUMB_TIPS } from '../src/art/hands';
import { KEY_GAP, fingerHomes, fitHands, layoutKeys, type KeyBox } from '../src/engine/keyboardLayout';

const geo = layoutKeys(keymap);
const byCode = (code: string): KeyBox => {
  const box = geo.keys.find((b) => b.key.code === code);
  if (!box) throw new Error(code);
  return box;
};
const center = (b: KeyBox) => b.x + b.w / 2;
const EPS = 1e-9;

describe('раскладка клавиш', () => {
  it('на экране все клавиши карты, каждая один раз', () => {
    const all = keymap.rows.flat();
    expect(geo.keys.map((b) => b.key)).toEqual(all);
  });

  it('клавиши не перекрываются и лежат внутри рамки', () => {
    for (const a of geo.keys) {
      expect(a.x).toBeGreaterThanOrEqual(-EPS);
      expect(a.y).toBeGreaterThanOrEqual(-EPS);
      expect(a.x + a.w).toBeLessThanOrEqual(geo.width + EPS);
      expect(a.y + a.h).toBeLessThanOrEqual(geo.height + EPS);
      for (const b of geo.keys) {
        if (a === b) continue;
        const apart =
          a.x + a.w <= b.x + EPS || b.x + b.w <= a.x + EPS || a.y + a.h <= b.y + EPS || b.y + b.h <= a.y + EPS;
        expect(apart, `${a.key.code} / ${b.key.code}`).toBe(true);
      }
    }
  });

  it('между соседями ровно зазор, порядок в ряду — по x', () => {
    for (const row of keymap.rows) {
      const boxes = row.map((k) => byCode(k.code));
      for (let i = 1; i < boxes.length; i++) {
        const prev = boxes[i - 1]!;
        const cur = boxes[i]!;
        expect(cur.x).toBeGreaterThan(prev.x);
        expect(cur.x - (prev.x + prev.w)).toBeCloseTo(KEY_GAP);
      }
    }
  });

  it('все ряды, кроме ряда пробела, одной ширины и начинаются у левого края', () => {
    const rows = keymap.rows.filter((r) => !r.some((k) => k.finger === 'th'));
    expect(rows.length).toBe(4);
    for (const row of rows) {
      const first = byCode(row[0]!.code);
      const last = byCode(row[row.length - 1]!.code);
      expect(first.x).toBeCloseTo(0);
      expect(last.x + last.w).toBeCloseTo(geo.width);
    }
  });

  it('пробел шире всех и стоит посередине между засечками А и О', () => {
    const space = byCode('Space');
    for (const b of geo.keys) if (b !== space) expect(space.w).toBeGreaterThan(b.w);
    expect(center(space)).toBeCloseTo((center(byCode('KeyF')) + center(byCode('KeyJ'))) / 2);
    // Под буквами нижнего ряда: от «Я» до «Ю», как на ноутбуке.
    expect(space.x).toBeGreaterThan(byCode('KeyZ').x);
    expect(space.x + space.w).toBeLessThan(byCode('Period').x + byCode('Period').w);
  });

  it('ряды идут сверху вниз с шагом 1, клавиша на шаг меньше зазора', () => {
    for (const b of geo.keys) {
      expect(b.y).toBe(b.key.row);
      expect(b.h).toBeCloseTo(1 - KEY_GAP);
      expect(b.w).toBeCloseTo(b.key.width - KEY_GAP);
    }
    expect(geo.height).toBeCloseTo(keymap.rows.length - KEY_GAP);
  });

  it('ряды разной ширины выравниваются по правому краю', () => {
    const small = parseKeymap({
      rows: [
        [{ code: 'A', finger: 'lp', label: 'A', width: 3 }],
        [{ code: 'B', finger: 'lp', label: 'B' }],
      ],
    });
    const g = layoutKeys(small);
    expect(g.width).toBeCloseTo(3 - KEY_GAP);
    expect(g.keys[1]!.x).toBeCloseTo(2);
  });
});

describe('кончики пальцев над основной позицией', () => {
  const homes = fingerHomes(geo);

  it('каждый палец — над своей клавишей основного ряда', () => {
    const home = { lp: 'KeyA', lr: 'KeyS', lm: 'KeyD', li: 'KeyF', ri: 'KeyJ', rm: 'KeyK', rr: 'KeyL', rp: 'Semicolon' };
    for (const [finger, code] of Object.entries(home)) {
      const box = byCode(code);
      expect(box.key.finger).toBe(finger);
      expect(homes[finger as keyof typeof home]).toBeCloseTo(center(box));
    }
    expect(homes.th).toBeCloseTo(center(byCode('Space')));
  });

  it('без двух засечек позицию не угадываем — ошибка', () => {
    const flat = parseKeymap({ rows: [[{ code: 'A', finger: 'lp', label: 'A' }]] });
    expect(() => fingerHomes(layoutKeys(flat))).toThrow(/bump/);
  });
});

describe('картинка рук на клавиатуре', () => {
  const homes = fingerHomes(geo);
  const homeY = byCode('KeyF').y + byCode('KeyF').h / 2;

  it('кончики в шаг клавиш ложатся точно, без искажения', () => {
    // Ловит: искажение (разный масштаб по осям) и потерю сдвига — кончики должны лечь на свои клавиши.
    // Кончики нарисованы в 50 пикселей на клавишу, со сдвигом: подгонка должна это найти.
    const at = (f: 'lm' | 'li' | 'ri' | 'rm') => ({ x: (homes[f] + 2) * 50, y: 30 });
    const fit = fitHands(geo, { lm: at('lm'), li: at('li'), ri: at('ri'), rm: at('rm') });
    expect(fit.scale).toBeCloseTo(1 / 50);
    for (const side of [fit.left, fit.right]) {
      expect(side.x).toBeCloseTo(-2);
      expect(side.y + 30 * fit.scale).toBeCloseTo(homeY);
    }
  });

  it('у каждой руки свой сдвиг при общем масштабе', () => {
    // Ловит: одна подгонка на обе руки — когда руки нарисованы не зеркально, одна из них съезжает.
    // Правая рука нарисована на 37 пикселей правее и на 11 ниже, чем «по шагу»; шаг — 50 пикселей.
    const at = (f: 'lm' | 'li' | 'ri' | 'rm', dx: number, dy: number) => ({ x: (homes[f] + 2) * 50 + dx, y: 30 + dy });
    const tips = { lm: at('lm', 0, 0), li: at('li', 0, 0), ri: at('ri', 37, 11), rm: at('rm', 37, 11) };
    const fit = fitHands(geo, tips);
    expect(fit.scale).toBeCloseTo(1 / 50);
    for (const f of ['lm', 'li'] as const) {
      expect(fit.left.x + tips[f].x * fit.scale).toBeCloseTo(homes[f]);
    }
    for (const f of ['ri', 'rm'] as const) {
      expect(fit.right.x + tips[f].x * fit.scale).toBeCloseTo(homes[f]);
    }
    expect(fit.right.y - fit.left.y).toBeCloseTo(-11 * fit.scale);
  });

  it('у нашей картинки ногти указательных — на «а» и «о», большие — на пробеле', () => {
    // Ловит: съехавшие точки ногтей или подгонку — указательные дальше 0,15 клавиши от своей буквы,
    // большой палец мимо пробела.
    const fit = fitHands(geo, HAND_TIPS);
    const nail = (side: 'left' | 'right', p: { x: number; y: number }) => ({
      x: fit[side].x + p.x * fit.scale,
      y: fit[side].y + p.y * fit.scale,
    });
    const a = byCode('KeyF');
    const o = byCode('KeyJ');
    expect(Math.abs(nail('left', HAND_TIPS.li).x - center(a))).toBeLessThan(0.15);
    expect(Math.abs(nail('right', HAND_TIPS.ri).x - center(o))).toBeLessThan(0.15);
    // Средние — тоже над своими клавишами, не дальше той же меры.
    expect(Math.abs(nail('left', HAND_TIPS.lm).x - homes.lm)).toBeLessThan(0.15);
    expect(Math.abs(nail('right', HAND_TIPS.rm).x - homes.rm)).toBeLessThan(0.15);
    const space = byCode('Space');
    for (const side of ['left', 'right'] as const) {
      const t = nail(side, THUMB_TIPS[side]);
      expect(t.x).toBeGreaterThan(space.x);
      expect(t.x).toBeLessThan(space.x + space.w);
      expect(t.y).toBeGreaterThan(space.y);
      expect(t.y).toBeLessThan(space.y + space.h);
    }
    // Левый большой левее правого.
    expect(nail('left', THUMB_TIPS.left).x).toBeLessThan(nail('right', THUMB_TIPS.right).x);
  });

  it('все 8 ногтей лежат на своих клавишах основного ряда', () => {
    // Ловит: подъём или общий сдвиг картинки на полряда — ногти на верхнем ряду (Й Ц У…) читаются как «средний — на У».
    const fit = fitHands(geo, HAND_TIPS);
    const row: [keyof typeof HAND_TIPS, string, 'left' | 'right'][] = [
      ['lp', 'KeyA', 'left'],
      ['lr', 'KeyS', 'left'],
      ['lm', 'KeyD', 'left'],
      ['li', 'KeyF', 'left'],
      ['ri', 'KeyJ', 'right'],
      ['rm', 'KeyK', 'right'],
      ['rr', 'KeyL', 'right'],
      ['rp', 'Semicolon', 'right'],
    ];
    for (const [finger, code, side] of row) {
      const box = byCode(code);
      expect(box.key.finger).toBe(finger);
      const dx = fit[side].x + HAND_TIPS[finger].x * fit.scale - center(box);
      const dy = fit[side].y + HAND_TIPS[finger].y * fit.scale - (box.y + box.h / 2);
      expect(Math.abs(dx), `${finger} по x`).toBeLessThanOrEqual(0.35);
      expect(Math.abs(dy), `${finger} по y`).toBeLessThanOrEqual(0.35);
    }
  });
});

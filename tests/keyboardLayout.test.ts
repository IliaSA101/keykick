/**
 * Геометрия экранной клавиатуры: клавиши не налезают друг на друга, ряды ровные,
 * пробел — по центру под руками, кончики пальцев — над своими клавишами.
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { parseKeymap } from '../src/engine/keymap';
import { HAND_TIPS } from '../src/art/hands';
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
    // Кончики нарисованы в 50 пикселей на клавишу, со сдвигом: подгонка должна это найти.
    const at = (f: 'lm' | 'li' | 'ri' | 'rm') => ({ x: (homes[f] + 2) * 50, y: 30 });
    const fit = fitHands(geo, { lm: at('lm'), li: at('li'), ri: at('ri'), rm: at('rm') });
    expect(fit.scale).toBeCloseTo(1 / 50);
    expect(fit.x).toBeCloseTo(-2);
    expect(fit.y + 30 * fit.scale).toBeCloseTo(homeY);
  });

  it('у нашей картинки указательные и средние — над своими клавишами', () => {
    const fit = fitHands(geo, HAND_TIPS);
    for (const f of ['lm', 'li', 'ri', 'rm'] as const) {
      // Не дальше пятой части клавиши: палец читается над своей буквой.
      expect(Math.abs(fit.x + HAND_TIPS[f].x * fit.scale - homes[f])).toBeLessThan(0.2);
    }
  });
});

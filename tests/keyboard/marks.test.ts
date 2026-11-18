/**
 * Метка пальца на ногте (065 Т9б, кадры Э1.03–Э1.05): только вне основного ряда и для пробела.
 */
import { describe, expect, it } from 'vitest';
import { nailMark } from '../../src/components/keyboard/marks';
import { keymap } from '../../src/engine/typing/layouts';
import { fingerHomes, layoutKeys } from '../../src/engine/typing/keyboardLayout';
import { TYPING_TIPS, applySim, frameHomes, typingFit, typingNail } from '../../src/components/keyboard/typingHands';

const key = (code: string) => keymap.byCode.get(code)!;

describe('К-Т9б: метка на ногте', () => {
  it('К-Т9б Э1.03: цель на основном ряду (ФЫВА ОЛДЖ) — метки нет, только подсветка клавиши', () => {
    // Ловит: метку на всех клавишах — она закрывала бы подсветку цели.
    for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon']) expect(nailMark(key(code), null)).toBeNull();
  });
  it('К-Т9б Э1.04: цель вне основного ряда (Е, Ш) — метка на ногте своего пальца', () => {
    // Ловит: метку не у того пальца и пропавшую метку у тянущегося пальца.
    expect(nailMark(key('KeyT'), null)).toEqual({ finger: 'li' });
    expect(nailMark(key('KeyI'), null)).toEqual({ finger: 'rm' });
  });
  it('К-Т9б Э1.05: пробел — метка на большом пальце выбранной руки; без руки — правый', () => {
    // Ловит: метку на пробеле не у большого пальца или потерянную руку.
    expect(nailMark(key('Space'), 'left')).toEqual({ finger: 'th', thumb: 'left' });
    expect(nailMark(key('Space'), 'right')).toEqual({ finger: 'th', thumb: 'right' });
    expect(nailMark(key('Space'), null)).toEqual({ finger: 'th', thumb: 'right' });
  });
  it('К-Т9б край: цели нет — метки нет', () => {
    expect(nailMark(null, null)).toBeNull();
  });
});

describe('К-Т9в Р73: руки как в кадре матча', () => {
  const geo = layoutKeys(keymap);
  const homes = fingerHomes(geo);
  const rowTop = geo.keys.find((b) => b.key.bump)!.y;
  const fit = typingFit(homes, rowTop);
  const centroid = (side: 'left' | 'right') => {
    const p = TYPING_TIPS[side].map((t) => applySim(fit[side], t));
    return { x: p.reduce((a, b) => a + b.x, 0) / 4, y: p.reduce((a, b) => a + b.y, 0) / 4 };
  };
  it('К-Т9в Р73: четыре кончика каждой руки в среднем стоят на своих клавишах основного ряда, правая — на 0,2 правее', () => {
    // Ловит: потерянный сдвиг правой руки, руки на верхнем ряду или перепутанные пальцы.
    expect(centroid('left').x).toBeCloseTo((homes.lp + homes.lr + homes.lm + homes.li) / 4, 6);
    expect(centroid('right').x).toBeCloseTo((homes.rp + homes.rr + homes.rm + homes.ri) / 4 + 0.2, 6);
    expect(centroid('left').y).toBeCloseTo(rowTop + 0.2, 6);
    expect(centroid('right').y).toBeCloseTo(rowTop + 0.2, 6);
  });
  it('К-Т9в Р73: метка пробела — на большом пальце своей руки; ноготь указательного — ниже его верхней точки', () => {
    // Ловит: метку на чужой руке и метку на самом контуре пальца.
    expect(typingNail(fit, { finger: 'th', thumb: 'left' }).x).toBeLessThan(typingNail(fit, { finger: 'th', thumb: 'right' }).x);
    const tip = applySim(fit.left, TYPING_TIPS.left[3]!);
    expect(typingNail(fit, { finger: 'li' }).y).toBeGreaterThan(tip.y);
  });
});

describe('К-Т9з: руки по середине рамки клавиши', () => {
  it('К-Т9з Р150: кончики встают на середину рамки клавиши (+0,06 к центру движка), как в кадре Э1.01–Э1.03', () => {
    // Ловит: руки на 2 px левее клавиш — расхождение с кадром по всей кромке пальцев.
    const geo = layoutKeys(keymap);
    const homes = fingerHomes(geo);
    const shifted = frameHomes(homes);
    for (const f of ['lp', 'lr', 'lm', 'li', 'ri', 'rm', 'rr', 'rp'] as const) expect(shifted[f] - homes[f]).toBeCloseTo(0.06, 9);
    // середина рамки в кадре: b.x + 0,04 + (b.w + 0,04) / 2
    const a = geo.keys.find((b) => b.key.code === 'KeyA')!;
    expect(shifted.lp).toBeCloseTo(a.x + 0.04 + (a.w + 0.04) / 2, 6);
  });
});

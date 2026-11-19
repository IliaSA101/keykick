/**
 * Разбор заголовка WebP для тестов графики: размер и «качество» без декодирования пикселей.
 * Качество у кодека с потерями (VP8) — индекс квантования `y_ac_qi` из заголовка кадра (RFC 6386 §9.6, §19.2):
 * чем он больше, тем сильнее пережато. Соответствие библиотеке (libwebp / Pillow, method=6), снято на кадре Базы:
 * q92 → 10, q90 → 12, q85 → 20, q80 → 27, q76 → 34, q74 → 36, q72 → 37, q70 → 39, q60 → 45.
 */
import { readFileSync } from 'node:fs';

export interface WebpInfo {
  w: number;
  h: number;
  /** Без потерь (VP8L) — «пережать» нечем. */
  lossless: boolean;
  /** Индекс квантования самого грубого сегмента кадра (только с потерями); у lossless — 0. */
  qindex: number;
}

/** Индекс квантования, который даёт q76 — самое низкое качество фонов в пайплайне (docs/art-pipeline.md). */
export const QINDEX_OF_Q76 = 34;

/** Читает `bits` бит заголовка VP8 арифметическим декодером с вероятностью 1/2 (булевый декодер RFC 6386 §7). */
function headerReader(b: Buffer, start: number): (bits: number) => number {
  let pos = start + 2;
  let value = ((b[start] ?? 0) << 8) | (b[start + 1] ?? 0);
  let range = 255;
  let shift = 0;
  const bit = (): number => {
    const split = 1 + ((range - 1) >> 1);
    const hi = split << 8;
    let r = 0;
    if (value >= hi) {
      r = 1;
      range -= split;
      value -= hi;
    } else range = split;
    while (range < 128) {
      value <<= 1;
      range <<= 1;
      if (++shift === 8) {
        shift = 0;
        value |= b[pos++] ?? 0;
      }
    }
    return r;
  };
  return (bits) => {
    let v = 0;
    for (let i = 0; i < bits; i++) v = (v << 1) | bit();
    return v;
  };
}

/** Индекс квантования из заголовка кадра VP8 (`data` — начало данных чанка «VP8 »). */
function lossyQindex(b: Buffer, data: number): number {
  const read = headerReader(b, data + 10);
  const signed = (bits: number): number => {
    if (!read(1)) return 0;
    const v = read(bits);
    return read(1) ? -v : v;
  };
  read(2); // цветовое пространство и отсечение
  let absolute = 1;
  const segment: number[] = [];
  if (read(1)) {
    const updateMap = read(1);
    if (read(1)) {
      absolute = read(1);
      for (let i = 0; i < 4; i++) segment.push(signed(7));
      for (let i = 0; i < 4; i++) signed(6); // поправки фильтра сегментов
    }
    if (updateMap) for (let i = 0; i < 3; i++) if (read(1)) read(8);
  }
  read(1 + 6 + 3); // тип фильтра, его уровень, резкость
  if (read(1) && read(1)) for (let i = 0; i < 8; i++) signed(6); // дельты фильтра по режимам и опорам
  read(2); // число разделов данных
  const base = read(7);
  if (segment.length === 0) return base;
  return Math.max(...segment.map((v) => Math.min(127, Math.max(0, absolute ? v : base + v))));
}

export function webpInfo(file: string): WebpInfo {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') throw new Error(`${file}: не WebP`);
  for (let p = 12; p + 8 <= b.length; p += 8 + b.readUInt32LE(p + 4) + (b.readUInt32LE(p + 4) & 1)) {
    const tag = b.toString('ascii', p, p + 4);
    const data = p + 8;
    if (tag === 'VP8 ') {
      return { w: b.readUInt16LE(data + 6) & 0x3fff, h: b.readUInt16LE(data + 8) & 0x3fff, lossless: false, qindex: lossyQindex(b, data) };
    }
    if (tag === 'VP8L') {
      // подпись 0x2f, затем ширина и высота по 14 бит
      const bits = b.readUInt32LE(data + 1);
      return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1, lossless: true, qindex: 0 };
    }
  }
  throw new Error(`${file}: нет данных кадра`);
}

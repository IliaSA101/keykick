/**
 * Сетка плей-офф Кубка Двора (ТЗ-8.1, 8.9, 068 design §4): 1/8 → финал, пары в порядке чемпионата мира.
 * Чужие победители — функция семени и номера матча; соперники нашего пути (`KO_RIVALS`: Стриж, Фрегат, Флагман, «Рассвет») выигрывают всё,
 * пока не встретят нас, — наша пара каждого раунда совпадает с двором Дома и Карты (023-Р35а); мы проходим дальше,
 * если выиграли раунд (проигрыш — «ответный», сетка не меняется, К2). Чужие счета раунда открываются, когда мы выиграли тот же раунд (К6).
 * Улицы в сетке не повторяются (К7): каждая команда одна, улица у команды своя (`content/cup-yard.json`).
 */
import { OUR, LETTERS, TOURS, groupTable, playedTours, rnd, scoreOf } from './group';
import { KO_ROUNDS } from './rounds';
import { KO_RIVALS } from './teams';
import type { Bracket, Cell, CellScore, Cup, KoRound } from './types';

/** 1/8: [группа, место, группа, место] — левая половина M1–M4, правая M5–M8; 1C играет с 2D, 2C — с 1D. */
const R16: readonly (readonly [string, 1 | 2, string, 1 | 2])[] = [
  ['A', 1, 'B', 2], ['C', 1, 'D', 2], ['E', 1, 'F', 2], ['G', 1, 'H', 2],
  ['B', 1, 'A', 2], ['D', 1, 'C', 2], ['F', 1, 'E', 2], ['H', 1, 'G', 2],
];

/** Кто занял первые два места в каждой группе; пока группа не пройдена — `null`. */
export function qualifiers(cup: Pick<Cup, 'tours'>, seed: number): Record<string, [string, string]> | null {
  if (playedTours(cup.tours) < TOURS) return null;
  const out: Record<string, [string, string]> = {};
  for (const l of LETTERS) {
    const t = groupTable(l, TOURS, cup.tours, seed);
    out[l] = [t[0]!.team, t[1]!.team];
  }
  return out;
}

function pickWinner(seed: number, round: KoRound, i: number, a: string | null, b: string | null): 'a' | 'b' | null {
  if (a === null || b === null) return null;
  const side = (id: string): 'a' | 'b' | null => (a === id ? 'a' : b === id ? 'b' : null);
  const forced = side(OUR) ?? Object.values(KO_RIVALS).reduce<'a' | 'b' | null>((s, id) => s ?? side(id), null);
  if (forced !== null) return forced;
  return rnd(seed, `k${round}${i}`, 2) === 0 ? 'a' : 'b';
}

function otherScore(seed: number, round: KoRound, i: number, win: 'a' | 'b'): CellScore {
  const key = `o${round}${i}`;
  const pen = rnd(seed, `p${key}`, 4) === 0;
  const [a, b] = scoreOf(seed, key, pen ? 'd' : win);
  return { a, b, pen };
}

/** Полная сетка при условии, что мы выигрываем каждый раунд: все команды и победители, без открытия результатов. */
function projected(cup: Pick<Cup, 'tours'>, seed: number): Record<KoRound, { a: string | null; b: string | null; win: 'a' | 'b' | null }[]> {
  const q = qualifiers(cup, seed);
  const out = { r16: [], qf: [], sf: [], f: [] } as unknown as Record<KoRound, { a: string | null; b: string | null; win: 'a' | 'b' | null }[]>;
  R16.forEach(([g1, p1, g2, p2], i) => {
    const a = q ? q[g1]![p1 - 1]! : null;
    const b = q ? q[g2]![p2 - 1]! : null;
    out.r16.push({ a, b, win: pickWinner(seed, 'r16', i, a, b) });
  });
  KO_ROUNDS.slice(1).forEach((round, k) => {
    const prev = out[KO_ROUNDS[k]!];
    const n = prev.length / 2;
    for (let i = 0; i < n; i++) {
      const w = (j: number): string | null => {
        const m = prev[j]!;
        return m.win === null ? null : m.win === 'a' ? m.a : m.b;
      };
      const a = w(2 * i);
      const b = w(2 * i + 1);
      out[round].push({ a, b, win: pickWinner(seed, round, i, a, b) });
    }
  });
  return out;
}

const labelOf = (round: KoRound, side: 0 | 1, i: number): string => {
  if (round === 'r16') {
    const [g1, p1, g2, p2] = R16[i]!;
    return side === 0 ? `${p1}${g1}` : `${p2}${g2}`;
  }
  return `W${2 * i + 1 + side}`;
};

/** Соперник нашего раунда плей-офф (id команды) или `null`, пока группа не пройдена. */
export function koRival(cup: Pick<Cup, 'tours'>, seed: number, round: KoRound): string | null {
  const m = projected(cup, seed)[round].find((c) => c.a === OUR || c.b === OUR);
  if (m === undefined) return null;
  return m.a === OUR ? m.b : m.a;
}

/** Сетка для экрана: команды раунда известны, когда выигран прошлый раунд; победитель и счёт — когда мы выиграли этот. */
export function bracketOf(cup: Cup, seed: number): Bracket {
  const full = projected(cup, seed);
  const out = { r16: [], qf: [], sf: [], f: [] } as unknown as Bracket;
  KO_ROUNDS.forEach((round, ri) => {
    const known = ri === 0 || cup.ko[KO_ROUNDS[ri - 1]!].won;
    const revealed = cup.ko[round].won;
    full[round].forEach((m, i) => {
      const mine = m.a === OUR || m.b === OUR;
      const k = cup.ko[round];
      let win: Cell['win'] = null;
      let score: CellScore | null = null;
      if (revealed && m.win !== null) {
        win = m.win;
        if (mine) {
          const ourSide = m.a === OUR ? 'a' : 'b';
          const me = k.me ?? 0;
          const opp = k.opp ?? 0;
          score = { a: ourSide === 'a' ? me : opp, b: ourSide === 'a' ? opp : me, pen: k.series !== null };
        } else score = otherScore(seed, round, i, m.win);
      }
      out[round].push({
        a: known ? m.a : null,
        b: known ? m.b : null,
        refA: labelOf(round, 0, i),
        refB: labelOf(round, 1, i),
        win,
        score,
        lost: mine && !k.won && k.tries > 0,
      });
    });
  });
  return out;
}

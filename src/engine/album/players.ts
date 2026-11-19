/**
 * Карточки игроков (067 Т13, ТЗ-5.11, 5.12, 2.10; кадры Э2К.25, 44): 8 пальцев-игроков в порядке клавиатуры, у каждого ранг,
 * полоса тренированности и число. Чистая функция от `form` и номера урока: ни хранилища, ни часов. Ранг не падает (`form.max`):
 * если точность окна ниже порога своего ранга — полоса пустая, пометка «ранг не падает». До `minPresses` нажатий окна числа нет — «набор N/300».
 */
import cfg from '../../content/match.json';
import team from '../../content/players.json';
import type { FormState } from '../form/rank';

export interface PlayerCard {
  finger: string;
  key: string;
  /** Название позиции из `match.json` («Левый мизинец»). */
  pos: string;
  /** Номер вырезки игрока (1…8). */
  fig: number;
  /** Урок прихода. */
  from: number;
  /** Игрок уже пришёл (`cur ≥ from`); пока нет — карточка «придёт с урока N». */
  here: boolean;
  /** Ранг 0…4 (юниор … звезда). */
  rank: number;
  /** Точность окна, %, одна десятичная; `null` — окно короче `minPresses` («набор»). */
  acc: number | null;
  /** Нажатий в окне и размер окна: «набор N/300». */
  n: number;
  window: number;
  /** Полоса: доля 0…1 между порогом своего ранга и следующего; у звезды — 1; без числа — 0. */
  fill: number;
  /** Порог следующего ранга, %; у звезды — `null`. */
  next: number | null;
  /** Точность ниже порога своего ранга: ранг остаётся (ТЗ-2.10). */
  kept: boolean;
}

const RANKS = cfg.form.ranks;
const MAX_RANK = RANKS.length;
const pct1 = (x: number): number => Math.round(x * 1000) / 10;

/** Порог ранга `r`, доля: у юниора 0, дальше — `ranks[r − 1]`. */
const lo = (r: number): number => (r === 0 ? 0 : RANKS[r - 1]!);

export function playersView(form: FormState, cur: number): PlayerCard[] {
  const names = new Map(cfg.squad.map((s) => [s.finger, s.name]));
  return team.team.map((p) => {
    const f = form.fingers[p.finger];
    const w = f?.w ?? '';
    const rank = f?.max ?? 0;
    const have = w.length >= cfg.form.minPresses;
    const acc = have ? Array.from(w).filter((b) => b === '1').length / w.length : null;
    const hi = rank >= MAX_RANK ? 1 : RANKS[rank]!;
    const fill = acc === null ? 0 : rank >= MAX_RANK ? 1 : Math.max(0, Math.min(1, (acc - lo(rank)) / (hi - lo(rank))));
    return {
      finger: p.finger,
      key: p.key,
      pos: names.get(p.finger) ?? p.finger,
      fig: p.fig,
      from: p.from,
      here: cur >= p.from,
      rank,
      acc: acc === null ? null : pct1(acc),
      n: w.length,
      window: cfg.form.window,
      fill,
      next: rank >= MAX_RANK ? null : pct1(hi),
      kept: acc !== null && acc < lo(rank),
    };
  });
}

/** Лестница рангов для шапки окна: порог «с N %» каждой ступени, юниор — «до N %». */
export const rankLadder = (): Array<{ rank: number; from: number; to: number }> => Array.from({ length: MAX_RANK + 1 }, (_, r) => ({ rank: r, from: pct1(lo(r)), to: r >= MAX_RANK ? 100 : pct1(RANKS[r]!) }));

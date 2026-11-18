/**
 * Форма клавиш (ТЗ-2.10, 017 §8): ранг пальца-игрока 0…4 — «юниор → запас → основа → сборная → звезда». Окно — последние
 * `window` нажатий основных клавиш пальца (биты «верно/неверно»); пороги `ranks` из `match.json`. Ранг не падает.
 * «Запас» и «основа» — с `minPresses` нажатий; «сборная» и «звезда» — только при полном окне и на `confirm` итогах подряд.
 * Чистые функции: хранилища нет; пишет `form`-раздел через кассу матча.
 */
import cfg from '../../content/match.json';
import type { Press } from '../match/types';

export type FormCfg = typeof cfg.form;

/** Окно пальца: биты строкой `'1'`/`'0'` (старые слева), ранг (не падает), кандидат на высокий ранг и его серия. */
export interface FingerForm {
  w: string;
  max: number;
  cand: { rank: number; n: number };
}

/** Форма игрока по пальцам (`lp`, `lr`, … из `squad`); пальца нет — всё с нуля. */
export interface FormState {
  fingers: Record<string, FingerForm>;
}

export const emptyForm = (): FormState => ({ fingers: {} });

const emptyFinger = (): FingerForm => ({ w: '', max: 0, cand: { rank: 0, n: 0 } });

/** Палец основной клавиши: строчный знак из `squad[].keys`; не основная клавиша — `null`. */
export function fingerOf(ch: string): string | null {
  const c = ch.toLowerCase();
  return cfg.squad.find((p) => Array.from(p.keys).includes(c))?.finger ?? null;
}

/** Ранг пальца 0…4; неизвестный палец и пустая форма — 0, не падает. */
export function rank(form: FormState, finger: string): number {
  return form.fingers[finger]?.max ?? 0;
}

/** Высший ранг, чьи условия окна и порога выполнены (подтверждение итогами — не здесь). */
function reached(w: string, rules: FormCfg): number {
  if (w.length < rules.minPresses) return 0;
  const acc = Array.from(w).filter((b) => b === '1').length / w.length;
  let r = 0;
  rules.ranks.forEach((min, i) => {
    const full = i >= rules.fullWindowFrom;
    if (acc >= min && (!full || w.length >= rules.window)) r = i + 1;
  });
  return r;
}

/** Окно + новые нажатия, не длиннее `window`. */
const push = (w: string, bits: string, rules: FormCfg): string => (w + bits).slice(-rules.window);

export interface FormGrowth {
  finger: string;
  from: number;
  to: number;
}

/**
 * Итог матча (или минуты тренера): нажатия попадают в окна, затем ранги пересматриваются один раз.
 * Ранги растут и в проигранном матче; падать не могут. Возвращает новую форму и рост (для строки итога).
 */
export function applyPresses(form: FormState, presses: readonly Press[], rules: FormCfg = cfg.form): { form: FormState; grew: FormGrowth[] } {
  const bits: Record<string, string> = {};
  for (const p of presses) {
    const f = fingerOf(p.ch);
    if (f !== null) bits[f] = (bits[f] ?? '') + (p.ok ? '1' : '0');
  }
  const fingers: Record<string, FingerForm> = { ...form.fingers };
  const grew: FormGrowth[] = [];
  for (const [finger, add] of Object.entries(bits)) {
    const prev = fingers[finger] ?? emptyFinger();
    const w = push(prev.w, add, rules);
    const t = reached(w, rules);
    // Лёгкие ранги — сразу, тяжёлые — серией итогов подряд (`confirm`).
    let max = Math.max(prev.max, Math.min(t, rules.fullWindowFrom));
    let cand = { rank: 0, n: 0 };
    if (t > max) {
      const n = prev.cand.rank > 0 ? prev.cand.n + 1 : 1;
      const rankNow = prev.cand.rank > 0 ? Math.min(t, prev.cand.rank) : t;
      if (n >= rules.confirm) max = Math.max(max, rankNow);
      else cand = { rank: rankNow, n };
    }
    fingers[finger] = { w, max, cand };
    if (max > prev.max) grew.push({ finger, from: prev.max, to: max });
  }
  return { form: { fingers }, grew };
}

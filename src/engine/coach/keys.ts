/**
 * «Трудные клавиши» (067-Р271…Р275, §9а): чистые функции над разделом `coach`. «Трудная» — буква с худшей точностью окна
 * при `form.minPresses` нажатий и более; проценты и «ещё N %» — точность буквы, ранг — палец-игрок (`form`).
 */
import cfg from '../../content/match.json';
import { fingerOf, rank, windowPermille, type FormCfg, type FormState } from '../form/rank';
import type { Press } from '../match/types';
import { LETTER, MAX_KEYS, type CoachKeys } from './section';

/** Нажатия итога → окна букв: только буквы (пробел, знаки, цифры не пишутся), окно не длиннее `window`. */
export function applyKeys(c: CoachKeys, presses: readonly Press[], rules: FormCfg = cfg.form): CoachKeys {
  const add: Record<string, string> = {};
  let count = Object.keys(c.keys).length;
  for (const p of presses) {
    const ch = p.ch.toLowerCase();
    if (!LETTER.test(ch)) continue;
    if (add[ch] === undefined) {
      // Раздел не растёт выше предела (иначе `check` отправит его в карантин): новая буква сверх предела не пишется.
      if (c.keys[ch] === undefined) {
        if (count >= MAX_KEYS) continue;
        count += 1;
      }
      add[ch] = '';
    }
    add[ch] += p.ok ? '1' : '0';
  }
  const keys = { ...c.keys };
  for (const [ch, bits] of Object.entries(add)) keys[ch] = ((keys[ch] ?? '') + bits).slice(-rules.window);
  return { keys };
}

export interface HardKey {
  ch: string;
  /** Точность буквы по окну, тысячные. */
  permille: number;
  misses: number;
  presses: number;
}

/** До `n` самых трудных букв: худшая точность — раньше; при равенстве — больше промахов, затем по алфавиту (067-Р274). */
export function hardKeys(c: CoachKeys, n: number = cfg.coach.hard, rules: FormCfg = cfg.form): HardKey[] {
  const list: HardKey[] = [];
  for (const [ch, w] of Object.entries(c.keys)) {
    const misses = Array.from(w).filter((b) => b === '0').length;
    const permille = windowPermille(w);
    if (w.length < rules.minPresses || misses === 0 || permille === null) continue;
    list.push({ ch, permille, misses, presses: w.length });
  }
  return list.sort((a, b) => a.permille - b.permille || b.misses - a.misses || a.ch.localeCompare(b.ch)).slice(0, n);
}

/** Плитка клавиши (Э4.11, панель Базы, Э4.14): % — окно буквы; ранг и «до …» — палец-игрок; пальца нет — `finger: null`, ранг 0. */
export interface KeyTile {
  ch: string;
  finger: string | null;
  /** Точность буквы, тысячные; нажатий ещё нет — `null`. */
  permille: number | null;
  rank: number;
  /** Следующий ранг и сколько тысячных точности буквы до его порога (067-Р275, макет `coach.mjs`); высший ранг — `null`. */
  next: { rank: number; need: number } | null;
}

export function keyTile(c: CoachKeys, form: FormState, ch: string, rules: FormCfg = cfg.form): KeyTile {
  const letter = ch.toLowerCase();
  const finger = fingerOf(letter);
  const permille = windowPermille(c.keys[letter] ?? '');
  if (finger === null) return { ch: letter, finger, permille, rank: 0, next: null };
  const r = rank(form, finger);
  const bar = rules.ranks[r];
  if (bar === undefined) return { ch: letter, finger, permille, rank: r, next: null };
  return { ch: letter, finger, permille, rank: r, next: { rank: r + 1, need: Math.max(0, Math.round(bar * 1000) - (permille ?? 0)) } };
}

/**
 * Матч v2 (спека 017, design §8): форма клавиш — 8 игроков-пальцев, окно последних нажатий, ранги.
 * Чистые функции: состояние приходит параметром, новое возвращается. Большие пальцы без ранга.
 * Ранг 0 — «юниор», 1…4 — «новичок / основа / сборная / звезда» (тексты — в i18n, не здесь).
 */
import type { Finger } from '../keymap';
import type { FormRules, SquadPlayer } from '../match/rules';

/** Откуда нажатия: разминка в окно не идёт (ТЗ-2.3, 017-Р14), остальное — да. */
export type PressSource = 'warmup' | 'attack' | 'extra' | 'coach';

/** Нажатие печати: ожидаемый знак (строчная буква) и верно ли. */
export interface FormPress {
  char: string;
  ok: boolean;
}

/** Кандидат на высокий ранг: сколько итогов подряд пройден именно этот порог. */
export interface RankCandidate {
  rank: number;
  n: number;
}

export interface FingerForm {
  /** Последние нажатия клавиш ряда пальца, по порядку: верно / неверно; не длиннее `window`. */
  recent: readonly boolean[];
  /** Лучший ранг за всё время — не падает. */
  maxRank: number;
  candidate: RankCandidate | null;
}

export type FormState = Readonly<Partial<Record<Finger, FingerForm>>>;

export const emptyForm: FormState = {};

const blank: FingerForm = { recent: [], maxRank: 0, candidate: null };

/** Нажатия в окна пальцев по составу; знаки вне состава (пробел, верхний ряд) и разминка — мимо. */
export function pushPresses(
  form: FormState,
  squad: readonly SquadPlayer[],
  presses: readonly FormPress[],
  source: PressSource,
  rules: FormRules,
): FormState {
  if (source === 'warmup') return form;
  const next: Partial<Record<Finger, FingerForm>> = { ...form };
  for (const p of presses) {
    const owner = squad.find((s) => s.keys.includes(p.char.toLowerCase()));
    if (!owner) continue;
    const cur = next[owner.finger] ?? blank;
    next[owner.finger] = { ...cur, recent: [...cur.recent, p.ok].slice(-rules.window) };
  }
  return next;
}

/** Точность окна, 0–1; пустое окно — 0. */
export function windowAccuracy(bits: readonly boolean[]): number {
  return bits.length === 0 ? 0 : bits.filter(Boolean).length / bits.length;
}

/**
 * Ранг по окну сейчас, без подтверждения: меньше `minPresses` нажатий — 0; пока окно не полное, выше
 * `fullWindowFrom` не бывает («сборная», «звезда» — только по полному окну).
 */
export function rawRank(bits: readonly boolean[], rules: FormRules): number {
  if (bits.length < rules.minPresses) return 0;
  const acc = windowAccuracy(bits);
  const reached = rules.ranks.filter((r) => acc >= r).length;
  return bits.length >= rules.window ? reached : Math.min(reached, rules.fullWindowFrom);
}

/**
 * Проверка в итоге матча (design §8): «новичок», «основа» — по `rawRank`; «сборная» и «звезда» — только после
 * `confirm` итогов подряд с тем же порогом на полном окне. `maxRank` только растёт.
 */
export function settleForm(form: FormState, squad: readonly SquadPlayer[], rules: FormRules): FormState {
  const next: Partial<Record<Finger, FingerForm>> = { ...form };
  for (const player of squad) {
    const cur = form[player.finger];
    if (!cur) continue;
    const raw = rawRank(cur.recent, rules);
    const high = raw > rules.fullWindowFrom ? raw : 0;
    // Кандидат {rank, n}: «n итогов подряд ранг был не ниже rank» (ревью Т2: 4→3 подтверждает «сборную», а не сбрасывает).
    const prev = cur.candidate;
    let candidate: RankCandidate | null = null;
    let confirmed = 0;
    if (high > 0) {
      if (prev && high <= prev.rank) candidate = { rank: high, n: prev.n + 1 };
      else {
        candidate = { rank: high, n: 1 };
        if (prev && prev.n + 1 >= rules.confirm) confirmed = prev.rank; // 3→4: «не ниже 3» держалось подряд
      }
    }
    if (candidate && candidate.n >= rules.confirm) confirmed = Math.max(confirmed, candidate.rank);
    const instant = Math.min(raw, rules.fullWindowFrom);
    next[player.finger] = { ...cur, candidate, maxRank: Math.max(cur.maxRank, instant, confirmed) };
  }
  return next;
}

export interface FormGrowth {
  finger: Finger;
  name: string;
  from: number;
  rank: number;
  /** Рост точности окна, целых процентных пунктов (≥ 0); 0 — не выросла или не с чем сравнить. */
  percent: number;
}

/**
 * Показ — только рост (017-Р26): пальцы, у которых выросла точность окна (хотя бы на 1 %) или `maxRank`.
 * Проценты — только если до матча в окне было не меньше `minPresses` нажатий: на пустом окне «+90 %» ничего не значит.
 */
export function formGrowth(before: FormState, after: FormState, squad: readonly SquadPlayer[], rules: FormRules): FormGrowth[] {
  const out: FormGrowth[] = [];
  for (const p of squad) {
    const was = before[p.finger];
    const from = was?.maxRank ?? 0;
    const rank = after[p.finger]?.maxRank ?? 0;
    const based = (was?.recent.length ?? 0) >= rules.minPresses;
    const gain = based ? Math.round((windowAccuracy(after[p.finger]?.recent ?? []) - windowAccuracy(was?.recent ?? [])) * 100) : 0;
    const percent = Math.max(0, gain);
    if (rank > from || percent > 0) out.push({ finger: p.finger, name: p.name, from, rank, percent });
  }
  return out;
}

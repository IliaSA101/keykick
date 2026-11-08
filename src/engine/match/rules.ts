/**
 * Матч v2 (спека 017, Т1): разбор `content/match.json` — все числа баланса живут там (ТЗ-0.10).
 * Чистые функции без Vue и DOM; файл читает `app/match/load.ts`. Ошибка — с адресом поля (`match.help.coachAt`).
 */
import { fingers, type Finger, type Keymap } from '../keymap';
import { fail } from '../lessonModel';

export interface HelpRules {
  /** После скольких провалов подряд — минута тренера. */
  coachAt: number;
  /** … «С запасом» (c + 1). */
  reserveAt: number;
  /** … «С тренером» (g + 1, c + 1). */
  coachHelpAt: number;
  /** Потолок звёзд: «с запасом», «с тренером», смягчение (017-Р16). */
  reserveCap: number;
  coachCap: number;
  softenCap: number;
}

export interface FormRules {
  window: number;
  minPresses: number;
  ranks: number[];
  fullWindowFrom: number;
  confirm: number;
}

export interface SquadPlayer {
  finger: Finger;
  keys: string;
  name: string;
}

export interface MatchRules {
  coinPer: number;
  threeStar: number;
  comebackDays: number;
  speedMatches: number;
  help: HelpRules;
  coach: { keys: number; ms: number };
  form: FormRules;
  squad: SquadPlayer[];
}

type Rec = Record<string, unknown>;

const rec = (item: unknown, where: string): Rec => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) fail(where, 'expected object');
  return item as Rec;
};

/** Белый список ключей: опечатка в имени поля не должна молча пропадать (и `coach.len` — тоже, 017 К12). */
function known(r: Rec, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(r)) if (!allowed.includes(key)) fail(where, `unknown field ${key}`);
}

function int(r: Rec, key: string, where: string, min = 1, max = Infinity): number {
  const v = r[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    fail(`${where}.${key}`, `expected integer in ${min}..${max}`);
  }
  return v;
}

function ratio(v: unknown, where: string): number {
  if (typeof v !== 'number' || !(v > 0) || v > 1) fail(where, 'expected number in (0, 1]');
  return v;
}

function parseHelp(raw: unknown): HelpRules {
  const where = 'match.help';
  const r = rec(raw, where);
  known(r, ['coachAt', 'reserveAt', 'coachHelpAt', 'reserveCap', 'coachCap', 'softenCap'], where);
  const help: HelpRules = {
    coachAt: int(r, 'coachAt', where),
    reserveAt: int(r, 'reserveAt', where),
    coachHelpAt: int(r, 'coachHelpAt', where),
    reserveCap: int(r, 'reserveCap', where, 1, 3),
    coachCap: int(r, 'coachCap', where, 1, 3),
    softenCap: int(r, 'softenCap', where, 1, 3),
  };
  if (!(help.coachAt < help.reserveAt && help.reserveAt < help.coachHelpAt)) {
    fail(where, 'expected coachAt < reserveAt < coachHelpAt');
  }
  return help;
}

function parseForm(raw: unknown): FormRules {
  const where = 'match.form';
  const r = rec(raw, where);
  known(r, ['window', 'minPresses', 'ranks', 'fullWindowFrom', 'confirm'], where);
  const ranksRaw = r.ranks;
  if (!Array.isArray(ranksRaw) || ranksRaw.length === 0) fail(`${where}.ranks`, 'expected non-empty list');
  const ranks = ranksRaw.map((v: unknown, n) => ratio(v, `${where}.ranks[${n}]`));
  ranks.forEach((v, n) => {
    if (n > 0 && v <= (ranks[n - 1] ?? 0)) fail(`${where}.ranks[${n}]`, 'ranks must strictly grow');
  });
  const form: FormRules = {
    window: int(r, 'window', where),
    minPresses: int(r, 'minPresses', where),
    ranks,
    fullWindowFrom: int(r, 'fullWindowFrom', where, 0, ranks.length - 1),
    confirm: int(r, 'confirm', where),
  };
  if (form.minPresses > form.window) fail(`${where}.minPresses`, 'expected minPresses <= window');
  return form;
}

/** Состав: 8 пальцев без большого; клавиши стоят у своего пальца и вместе дают основной ряд (017-Р14). */
function parseSquad(raw: unknown, map: Keymap): SquadPlayer[] {
  const where = 'match.squad';
  if (!Array.isArray(raw)) fail(where, 'expected list');
  const homeKey = map.byCode.get('KeyF'); // клавиша с засечкой левого указательного — основной ряд
  if (!homeKey) fail(where, 'no home key KeyF in keymap');
  const home = (map.rows[homeKey.row] ?? []).filter((k) => k.chars !== null).map((k) => k.chars?.ru[0] ?? '');
  const seen = new Set<string>();
  const seenFingers = new Set<string>();
  const squad = raw.map((item: unknown, n): SquadPlayer => {
    const at = `${where}[${n}]`;
    const r = rec(item, at);
    known(r, ['finger', 'keys', 'name'], at);
    const finger = r.finger;
    if (typeof finger !== 'string' || !(fingers as readonly string[]).includes(finger) || finger === 'th') {
      fail(`${at}.finger`, 'expected finger without thumb');
    }
    if (seenFingers.has(finger)) fail(`${at}.finger`, `duplicate ${finger}`);
    seenFingers.add(finger);
    const { keys, name } = r;
    if (typeof keys !== 'string' || keys === '') fail(`${at}.keys`, 'expected keys');
    if (typeof name !== 'string' || name === '') fail(`${at}.name`, 'expected name');
    for (const ch of keys) {
      const hit = map.byChar.ru.get(ch);
      if (!hit || hit.shift) fail(`${at}.keys`, `${ch} is not a key of keyboard.json`);
      if (hit.key.finger !== finger) fail(`${at}.keys`, `${ch} belongs to ${hit.key.finger}, not ${finger}`);
      if (seen.has(ch)) fail(`${at}.keys`, `duplicate ${ch}`);
      seen.add(ch);
    }
    return { finger: finger as Finger, keys, name };
  });
  if (squad.length !== fingers.length - 1) fail(where, `expected ${fingers.length - 1} players`);
  const missing = home.filter((ch) => !seen.has(ch));
  const extra = [...seen].filter((ch) => !home.includes(ch));
  if (missing.length > 0 || extra.length > 0) {
    fail(where, `keys must make the home row (missing: ${missing.join('') || '-'}, extra: ${extra.join('') || '-'})`);
  }
  return squad;
}

export function parseMatchRules(raw: unknown, map: Keymap): MatchRules {
  const where = 'match';
  const r = rec(raw, where);
  known(r, ['about', 'coinPer', 'threeStar', 'comebackDays', 'speedMatches', 'help', 'coach', 'form', 'squad'], where);
  const coachRaw = rec(r.coach, `${where}.coach`);
  known(coachRaw, ['keys', 'ms'], `${where}.coach`);
  return {
    coinPer: int(r, 'coinPer', where),
    threeStar: ratio(r.threeStar, `${where}.threeStar`),
    comebackDays: int(r, 'comebackDays', where),
    speedMatches: int(r, 'speedMatches', where),
    help: parseHelp(r.help),
    coach: { keys: int(coachRaw, 'keys', `${where}.coach`), ms: int(coachRaw, 'ms', `${where}.coach`) },
    form: parseForm(r.form),
    squad: parseSquad(r.squad, map),
  };
}

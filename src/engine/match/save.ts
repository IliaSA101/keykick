/**
 * Раздел `match` (спека 018 design §3.1, поля — 017 design §10): смягчение, ожидающий 2-й тайм, форма по пальцам,
 * ошибки клавиш, последние матчи по лигам, болельщики. Владелец — 017; писать — только через `updatePlayer`.
 */
import { fingers, type Finger } from '../keymap';
import { helps, type Help } from '../course/save';
import { defineSection, int, time, type SectionDef } from '../save/section';

/** Восемь пальцев без больших (017 §8). */
export type FormFinger = Exclude<Finger, 'th'>;
export const formFingers: readonly FormFinger[] = fingers.filter((f): f is FormFinger => f !== 'th');

export interface PlayedMatch {
  at: number;
  lessonId: string;
  league: string;
  kind: 'lesson' | 'cup';
  cpm: number;
  /** Тысячные 0–1000. */
  accuracy: number;
  passed: boolean;
  stars: number;
  help: Help;
}

export interface Half2 {
  lessonId: string;
  seed: number;
  /** Метка старта 2-го тайма (мс), 0 — ещё не начат. */
  started: number;
  score: [number, number];
  first: { correct: number; errors: number; ms: number };
  reason: 'break' | 'replay';
  /** Помощь матча (017-Р56): без поля — `none`; с ним после F5 метка и потолок ★★ целы. Старый файл читается как `none`. */
  help?: Help;
}

export interface MatchSave {
  /** Смягчение до прохода `lessonId`. */
  soften: { lessonId: string; from: string } | null;
  /** Ожидающий 2-й тайм, один на игрока. */
  half2: Half2 | null;
  form: {
    /** ≤ 300 знаков '0'/'1' по порядку. */
    windows: Record<FormFinger, string>;
    /** 0–4, не падает. */
    maxRank: Record<FormFinger, number>;
    /** Кандидат ранга: ранг и итогов подряд. */
    candidate: Record<FormFinger, { rank: number; n: number }>;
  };
  keyErrors: Record<string, number>;
  /** По лиге ≤ 3 последних (speedFor, 017 §7). */
  played: Record<string, PlayedMatch[]>;
  /** Конец последнего матча, мс; 0 — не было. */
  lastFinishedAt: number;
  /** Верные нажатия по лиге (017-Р10, 021). */
  leagueHits: Record<string, number>;
}

/** Потолки — защита от мусора. */
export const WINDOW_MAX = 300;
export const PLAYED_PER_LEAGUE = 3;
export const LEAGUES_MAX = 12;
export const KEY_ERRORS_MAX = 100;
export const COUNT_MAX = 1_000_000_000;
const ID_MAX = 40;
const SEED_MAX = 4_294_967_295;
const SCORE_MAX = 99;
const MS_MAX = 86_400_000;

const rec = (v: unknown): Record<string, unknown> => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const id = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, ID_MAX) : '');

/** Словарь «ключ → значение»: пустые и длинные ключи отброшены, не больше `max` записей. */
function entriesOf<T>(raw: unknown, max: number, one: (v: unknown) => T): [string, T][] {
  return Object.entries(rec(raw))
    .filter(([k]) => k !== '' && id(k) === k)
    .slice(0, max)
    .map(([k, v]) => [k, one(v)]);
}

const perFinger = <T>(raw: unknown, one: (v: unknown) => T): Record<FormFinger, T> => {
  const r = rec(raw);
  return Object.fromEntries(formFingers.map((f) => [f, one(r[f])])) as Record<FormFinger, T>;
};

/** Окно — только '0'/'1', хвост не длиннее `WINDOW_MAX` (старые итоги уходят первыми). */
const parseWindow = (v: unknown): string => (typeof v === 'string' ? v.replace(/[^01]/g, '').slice(-WINDOW_MAX) : '');

function parseCandidate(raw: unknown): { rank: number; n: number } {
  const r = rec(raw);
  return { rank: int(r.rank, 0, 4), n: int(r.n, 0, 1000) };
}

function parsePlayed(raw: unknown): PlayedMatch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x !== null && typeof x === 'object')
    .slice(-PLAYED_PER_LEAGUE)
    .map((x) => {
      const r = rec(x);
      return {
        at: time(r.at),
        lessonId: id(r.lessonId),
        league: id(r.league),
        kind: r.kind === 'cup' ? 'cup' : 'lesson',
        cpm: int(r.cpm, 0, 2000),
        accuracy: int(r.accuracy, 0, 1000),
        passed: r.passed === true,
        stars: int(r.stars, 0, 3),
        help: helps.find((h) => h === r.help) ?? 'none',
      };
    });
}

function parseHalf2(raw: unknown): Half2 | null {
  const r = rec(raw);
  const lessonId = id(r.lessonId);
  if (lessonId === '') return null;
  const score = Array.isArray(r.score) ? r.score : [];
  const first = rec(r.first);
  const help = helps.find((h) => h === r.help) ?? 'none';
  return {
    lessonId,
    seed: int(r.seed, 0, SEED_MAX),
    started: time(r.started),
    score: [int(score[0], 0, SCORE_MAX), int(score[1], 0, SCORE_MAX)],
    first: { correct: int(first.correct, 0, COUNT_MAX), errors: int(first.errors, 0, COUNT_MAX), ms: int(first.ms, 0, MS_MAX) },
    reason: r.reason === 'replay' ? 'replay' : 'break',
    // Поле необязательное: `none` не пишем, чтобы старые файлы и файлы без помощи не менялись.
    ...(help !== 'none' ? { help } : {}),
  };
}

function parseSoften(raw: unknown): MatchSave['soften'] {
  const r = rec(raw);
  const lessonId = id(r.lessonId);
  return lessonId === '' ? null : { lessonId, from: id(r.from) };
}

const emptyForm = (): MatchSave['form'] => ({
  windows: perFinger(null, parseWindow),
  maxRank: perFinger(null, (v) => int(v, 0, 4)),
  candidate: perFinger(null, parseCandidate),
});

export const section: SectionDef<MatchSave> = defineSection<MatchSave>({
  name: 'match',
  owner: '017',
  parse: (raw) => {
    const r = rec(raw);
    const form = rec(r.form);
    return {
      soften: parseSoften(r.soften),
      half2: parseHalf2(r.half2),
      form: {
        windows: perFinger(form.windows, parseWindow),
        maxRank: perFinger(form.maxRank, (v) => int(v, 0, 4)),
        candidate: perFinger(form.candidate, parseCandidate),
      },
      keyErrors: Object.fromEntries(entriesOf(r.keyErrors, KEY_ERRORS_MAX, (v) => int(v, 0, COUNT_MAX))),
      played: Object.fromEntries(entriesOf(r.played, LEAGUES_MAX, parsePlayed)),
      lastFinishedAt: time(r.lastFinishedAt),
      leagueHits: Object.fromEntries(entriesOf(r.leagueHits, LEAGUES_MAX, (v) => int(v, 0, COUNT_MAX))),
    };
  },
  empty: () => ({ soften: null, half2: null, form: emptyForm(), keyErrors: {}, played: {}, lastFinishedAt: 0, leagueHits: {} }),
  sample: () => ({
    soften: { lessonId: 'yard-05', from: 'yard-04' },
    half2: { lessonId: 'yard-05', seed: 123456, started: 1_800_000_000_000, score: [1, 0], first: { correct: 80, errors: 3, ms: 41_000 }, reason: 'break', help: 'reserve' },
    form: {
      windows: perFinger(null, () => '0110101'),
      maxRank: perFinger(null, () => 2),
      candidate: perFinger(null, () => ({ rank: 3, n: 1 })),
    },
    keyErrors: { KeyF: 4, KeyJ: 1 },
    played: {
      yard: [{ at: 1_800_000_000_000, lessonId: 'yard-04', league: 'yard', kind: 'lesson', cpm: 87, accuracy: 950, passed: true, stars: 3, help: 'none' }],
    },
    lastFinishedAt: 1_800_000_000_000,
    leagueHits: { yard: 1234 },
  }),
  // Потолок: окна полные, ошибки по всем клавишам каталога, по каждой лиге 3 матча, ожидающий тайм на максимумах.
  maxSample: (cat) => {
    const played: PlayedMatch = { at: time(Infinity), lessonId: 'l'.repeat(ID_MAX), league: 'g'.repeat(ID_MAX), kind: 'lesson', cpm: 2000, accuracy: 1000, passed: true, stars: 3, help: 'reserve' };
    return {
      soften: { lessonId: 'l'.repeat(ID_MAX), from: 'l'.repeat(ID_MAX) },
      half2: { lessonId: 'l'.repeat(ID_MAX), seed: SEED_MAX, started: time(Infinity), score: [SCORE_MAX, SCORE_MAX], first: { correct: COUNT_MAX, errors: COUNT_MAX, ms: MS_MAX }, reason: 'replay', help: 'reserve' },
      form: {
        windows: perFinger(null, () => '1'.repeat(WINDOW_MAX)),
        maxRank: perFinger(null, () => 4),
        candidate: perFinger(null, () => ({ rank: 4, n: 1000 })),
      },
      keyErrors: Object.fromEntries(cat.keyCodes.map((k) => [k, COUNT_MAX])),
      played: Object.fromEntries(cat.leagueIds.map((l) => [l, Array.from({ length: PLAYED_PER_LEAGUE }, () => played)])),
      lastFinishedAt: time(Infinity),
      leagueHits: Object.fromEntries(cat.leagueIds.map((l) => [l, COUNT_MAX])),
    };
  },
  // Ранги, верные по лигам и дата конца не падают (ТЗ-0.11); ошибки клавиш затухают.
  counters: (s) => ({
    maxRank: Object.values(s.form.maxRank).reduce((a, n) => a + n, 0),
    leagueHits: Object.values(s.leagueHits).reduce((a, n) => a + n, 0),
    lastFinishedAt: s.lastFinishedAt,
  }),
  check: (s) => {
    const bad: string[] = [];
    for (const f of formFingers) if (!/^[01]*$/.test(s.form.windows[f]) || s.form.windows[f].length > WINDOW_MAX) bad.push(`match.form.windows.${f}: not 0/1 or too long`);
    for (const [l, list] of Object.entries(s.played)) if (list.length > PLAYED_PER_LEAGUE) bad.push(`match.played.${l}: more than ${PLAYED_PER_LEAGUE}`);
    return bad;
  },
});

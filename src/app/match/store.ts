/**
 * Матч v2 (спека 017, Т5а, design §10): контракт `MatchStore` для флоу и его реализация в памяти.
 * Запись в сохранение — `saveStore.ts` над `updatePlayer` (Т5б).
 * В памяти живут и быстрые проверки (`jump.ts`): в хранилище браузера ничего не пишется.
 */
import { permille } from '../../engine/save/section';
import { courseLessons } from '../course/load';
import { addFans, payBlock, emptyWallet, type Fans, type Wallet } from '../../engine/matchResult/coins';
import { emptyForm, pushPresses, settleForm, type FormState } from '../../engine/matchResult/form';
import { emptyPlayed, recordPlayed, type PlayedLog } from '../../engine/matchResult/played';
import type { PendingSecond } from '../../engine/match/resume';
import type { MatchRules } from '../../engine/match/rules';
import { bestAfter } from '../../engine/match/verdict';
import type { Effect, MatchStore } from '../../engine/match/view';

type Of<K extends Effect['kind']> = Extract<Effect, { kind: K }>;

/** Записи по уроку: лучшие звёзды и провалы подряд. */
export interface LessonRecord {
  best: number;
  fails: number;
}

/** Строка журнала игры: открыта со старта, закрывается итогом или выходом. */
export interface MatchLogRow {
  id: number;
  lessonId: string;
  outcome: 'open' | 'win' | 'loss' | 'abandoned';
  /** Блоков записано (разминка, атаки, строки тренера). */
  blocks: number;
  /** Пенальти по ходу матча. */
  kicks: number;
  at: number;
}

/** Всё, что матч читает и пишет (design §10) — в памяти. */
export interface MatchData {
  lessons: Readonly<Record<string, LessonRecord>>;
  /** Ожидающий 2-й тайм: один на игрока. */
  pending: PendingSecond | null;
  /** Смягчение: урок, пройденный с помощью (следующий идёт копией, 017-Р8); снимается чистым проходом. */
  softenFrom: string | null;
  wallet: Wallet;
  fans: Fans;
  keyErrors: Readonly<Record<string, number>>;
  form: FormState;
  played: PlayedLog;
  /** Решённые задачи пенальти («Знаток» — их число). */
  solved: readonly string[];
  log: readonly MatchLogRow[];
}

export const emptyMatchData: MatchData = {
  lessons: {},
  pending: null,
  softenFrom: null,
  wallet: emptyWallet,
  fans: {},
  keyErrors: {},
  form: emptyForm,
  played: emptyPlayed,
  solved: [],
  log: [],
};

/** Хранилище, которое флоу ещё и читает (`read()` — на входе в урок). */
export interface ReadableMatchStore extends MatchStore {
  read(): MatchData;
  /**
   * Нажатия матча с его начала (журнал `keys`, 018-Р24): поток зовёт перед записью блока и итога, повтор — перезапись.
   * Есть только у хранилища, что пишет в сохранение; в памяти (витрина, тесты) — нет.
   */
  keys?(k: MatchKeys): void;
  /**
   * Возврат после перерыва (017-Р55): смягчить `lessonId` до прохода (`from` — урок перед ним). Ставит, только если
   * смягчения ещё нет. Нет `soften` — возврат не смягчает (хранилище без записи, например витрина); смягчение проходом читается из `softenFrom`.
   */
  soften?(lessonId: string, from: string): void;
}

/** Нажатия матча: что нажато, что ждали и мс от прошлого нажатия (первое — 0). */
export interface MatchKeys {
  typed: string;
  expected: string;
  dt: number[];
}

/** Память: `init` — стартовые данные (быстрые проверки кладут `fails`, `pending`, время возврата). */
export function memoryMatchStore(
  rules: MatchRules,
  init: Partial<MatchData> = {},
  /** Следующий урок курса (для смягчения); по умолчанию — порядок `courseLessons`. */
  next: (lessonId: string) => string | null = (id) => courseLessons[courseLessons.findIndex((l) => l.id === id) + 1]?.id ?? null,
): ReadableMatchStore {
  let d: MatchData = { ...emptyMatchData, ...init };
  let nextId = d.log.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  let openId: number | null = null;
  /** Уроки, пройденные в этой сессии (товарищеский проход даёт 0 звёзд, по `best` его не видно). */
  const passedHere = new Set<string>();

  const patchLog = (fn: (r: MatchLogRow) => MatchLogRow): void => {
    d = { ...d, log: d.log.map((r) => (r.id === openId ? fn(r) : r)) };
  };

  return {
    read: () => d,
    soften(_lessonId, from) {
      if (d.softenFrom === null) d = { ...d, softenFrom: from };
    },
    begin(e: Of<'begin'>) {
      openId = nextId++;
      const row: MatchLogRow = { id: openId, lessonId: e.lessonId, outcome: 'open', blocks: 0, kicks: 0, at: e.at };
      d = { ...d, log: [...d.log, row], lessons: { ...d.lessons, [e.lessonId]: { best: d.lessons[e.lessonId]?.best ?? 0, fails: e.fails } } };
    },
    block(e: Of<'block'>) {
      const keyErrors: Record<string, number> = { ...d.keyErrors };
      for (const [k, n] of Object.entries(e.keyErrors)) keyErrors[k] = (keyErrors[k] ?? 0) + n;
      d = {
        ...d,
        wallet: payBlock(d.wallet, e.correct, e.paid, rules.coinPer),
        fans: addFans(d.fans, e.league, e.correct),
        keyErrors,
        form: pushPresses(d.form, rules.squad, e.presses, e.source, rules.form),
      };
      patchLog((r) => ({ ...r, blocks: r.blocks + 1, at: e.at }));
    },
    toBreak(pending) {
      d = { ...d, pending };
    },
    half2Started() {
      if (d.pending) d = { ...d, pending: { ...d.pending, started: true } };
    },
    kick(e: Of<'kick'>) {
      d = { ...d, solved: e.expert > 0 ? [...d.solved, e.taskId] : d.solved };
      patchLog((r) => ({ ...r, kicks: r.kicks + 1, at: e.at }));
    },
    abandon(e: Of<'abandon'>) {
      patchLog((r) => ({ ...r, outcome: 'abandoned', at: e.at }));
      openId = null;
    },
    finish(e: Of<'finish'>) {
      const r = e.result;
      const prev = d.lessons[e.lessonId] ?? { best: 0, fails: 0 };
      const passedClean = r.verdict.passed && e.help === 'none';
      // Как в сохранении (017-Р35): смягчение ставит только проход текущего урока, снимает только чистый проход смягчённого.
      const softened = d.softenFrom !== null && next(d.softenFrom) === e.lessonId;
      // Ставит только первый проход урока (017-Р36); на последнем уроке курса ставить нечего — `null`, как в сохранении.
      const firstPass = prev.best <= 0 && !passedHere.has(e.lessonId);
      const set = r.verdict.passed && firstPass && e.help !== 'none' && (d.softenFrom === null || softened);
      const softenFrom = set ? (next(e.lessonId) === null ? null : e.lessonId) : passedClean && softened ? null : d.softenFrom;
      if (r.verdict.passed) passedHere.add(e.lessonId);
      d = {
        ...d,
        lessons: { ...d.lessons, [e.lessonId]: { best: bestAfter(prev.best, r.verdict.stars), fails: r.fails } },
        pending: e.pending,
        softenFrom,
        form: settleForm(d.form, rules.squad, rules.form),
        played: recordPlayed(
          d.played,
          e.session,
          { at: e.at, lessonId: e.lessonId, league: e.league, kind: 'lesson', cpm: r.cpm, accuracy: permille(r.correct, r.correct + r.errors), passed: r.verdict.passed, stars: r.verdict.stars, help: e.help },
          rules.speedMatches,
        ),
      };
      patchLog((row) => ({ ...row, outcome: r.outcome, at: e.at }));
      openId = null;
    },
  };
}

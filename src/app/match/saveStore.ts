/**
 * Матч v2 (спека 017, Т5б, design §10): `MatchStore` над слоем разделов 018 (`updatePlayer`). Каждое событие матча —
 * одна запись; журнал `match` уходит пачкой после записи. Игрок закрепляется на `begin`: смена игрока посреди
 * матча пишет в закреплённого. Слой и «текущий игрок» приходят параметрами (в приложении — `sections.ts` и
 * `progress.activeId`), поэтому тест подставляет две вкладки на одном хранилище. При `readOnly` слой считает вхолостую.
 */
import type { MatchLogCtx } from '../../engine/match/commit';
import {
  commitBlock, commitBreak, commitFinish, commitHalf2Started, commitKick, commitReplayBegin, commitSoften, formFromSave, logMatch, pendingFromHalf2, playedFromSave,
  type CommitRules,
} from '../../engine/match/commit';
import { section as courseSection } from '../../engine/course/save';
import { section as matchSection } from '../../engine/match/save';
import { section as schoolSection } from '../../engine/school/save';
import { hasSolved } from '../../engine/school/solved';
import type { Effect } from '../../engine/match/view';
import type { DeepReadonly, SectionKey, SectionTx } from '../../engine/save/section';
import { courseLessons } from '../course/load';
import { tasks as allTasks } from '../tasks';
import type { MatchData, MatchKeys, ReadableMatchStore } from './store';

type Of<K extends Effect['kind']> = Extract<Effect, { kind: K }>;

/** Урок курса для журнала и «следующего»: лига, номер в лиге, следующий id. */
export interface LessonPlace {
  league: string;
  n: number;
  next: string | null;
}

export interface SaveMatchDeps {
  layer: {
    updatePlayer<R>(fn: (tx: SectionTx) => R, opts?: { player?: string }): R;
    readSection<T>(key: SectionKey<T>): DeepReadonly<T>;
  };
  /** Текущий игрок; закрепляется на `begin`. */
  player(): string | null;
  rules: CommitRules;
  /** Журнал нажатий (018-Р24): `logMatchKeys` из `app/journal/boot`; тест подставляет свой. Нет — нажатия не пишутся. */
  keys?: (player: string, k: MatchKeys & { match: string }) => void;
  /** Часы, мс: метка старта 2-го тайма. */
  clock?: () => number;
  /** Место урока в курсе; по умолчанию — `courseLessons`. */
  place?: (lessonId: string) => LessonPlace | null;
  /** Порядок уроков курса (для `course.lesson`); по умолчанию — `courseLessons`. */
  order?: readonly string[];
  /** Номер задачи (`no`) и список задач для чтения «разобрано»; по умолчанию — `tasks.json`. */
  tasks?: readonly { id: string; no: number }[];
}

function coursePlace(id: string): LessonPlace | null {
  const i = courseLessons.findIndex((l) => l.id === id);
  const l = courseLessons[i];
  return l ? { league: l.league, n: l.n, next: courseLessons[i + 1]?.id ?? null } : null;
}

export function createSaveMatchStore(d: SaveMatchDeps): ReadableMatchStore {
  const clock = d.clock ?? Date.now;
  const place = d.place ?? coursePlace;
  const tasks = d.tasks ?? allTasks;
  const order = d.order ?? courseLessons.map((l) => l.id);
  let player: string | null = null;
  let log: MatchLogCtx | null = null;
  /** Ключ нажатий в журнале: id матча, а после «Продолжить» (`resumed`) — `<id>.2`, чтобы не затереть нажатия 1-го тайма (017-Р39). */
  let keysId = '';
  /** На `begin` игрока не было: матч идёт без записи (экран без игрока). */
  let noPlayer = false;

  /** Одна запись закреплённому игроку; игрока нет — молча (экран без игрока матч не пишет). */
  function write(fn: (tx: SectionTx) => void): void {
    if (noPlayer) return;
    const p = player ?? d.player();
    if (p !== null) d.layer.updatePlayer(fn, { player: p });
  }

  function read(): MatchData {
    const course = d.layer.readSection(courseSection);
    const match = d.layer.readSection(matchSection);
    const school = d.layer.readSection(schoolSection);
    // Раздел кошелька читаем по имени, без импорта кассы: страж «награды только через кассу» (018 §8).
    const wallet = d.layer.readSection<{ coins: number; pressRest: number }>({ name: 'wallet' });
    return {
      lessons: Object.fromEntries(Object.entries(course.lessons).map(([id, r]) => [id, { best: r.stars, fails: r.fails }])),
      pending: pendingFromHalf2(match.half2),
      solved: tasks.filter((t) => hasSolved(school.solved, t.no)).map((t) => t.id),
      played: playedFromSave(match),
      softenFrom: match.soften?.from ?? null,
      wallet: { coins: wallet.coins, carry: wallet.pressRest },
      fans: { ...match.leagueHits },
      keyErrors: { ...match.keyErrors },
      form: formFromSave(match.form),
      // Журнал живёт в IndexedDB (018), в разделах его нет.
      log: [],
    };
  }

  return {
    read,
    begin(e: Of<'begin'>) {
      player = d.player();
      noPlayer = player === null;
      log = null;
      if (player === null) return;
      const where = place(e.lessonId);
      // Один матч — одна запись журнала: `id` от зерна 1-го тайма; «Продолжить» после F5 берёт его из `half2` (018 §5).
      // Переигровка 2-го тайма (017-Р36) — своя запись: её зерно кладётся в `half2`, и после F5 переоткрывается она, а не проигранный матч.
      const h2all = e.resumed || e.replay ? d.layer.readSection(matchSection).half2 : null;
      const h2 = h2all && h2all.lessonId === e.lessonId ? h2all : null;
      // Переигровка уже начата (`started`, F5 во 2-м тайме) — продолжаем её запись; иначе начинается новая.
      const started = h2 !== null && h2.started > 0;
      const seed = e.resumed && h2 && (h2.reason === 'break' || started) ? h2.seed : e.seed;
      const first = h2 ? h2.first : null;
      log = {
        id: `${player}.${seed.toString(36)}.m`, lesson: e.lessonId, league: where?.league ?? '', n: where?.n ?? 0,
        attempt: e.fails + 1, signs: first ? first.correct + first.errors : 0, errors: first?.errors ?? 0, ms: first?.ms ?? 0,
        at: first ? e.attacks.length : 0, outcome: 'open',
      };
      const l = log;
      keysId = e.resumed ? `${l.id}.2` : l.id;
      const ownRecord = e.replay && h2 !== null && !(e.resumed && started);
      write((tx) => {
        logMatch(tx, l);
        if (ownRecord) commitReplayBegin(tx, e.seed);
      });
    },
    keys(k) {
      // Нажатия идут под id матча (после «Продолжить» — с суффиксом `.2`); игрок — закреплённый на `begin`.
      if (log && player !== null && !noPlayer && d.keys) d.keys(player, { match: keysId, typed: k.typed, expected: k.expected, dt: k.dt });
    },
    block(e: Of<'block'>) {
      const l = log;
      if (l) write((tx) => commitBlock(tx, e, l, d.rules));
    },
    soften(lessonId, from) {
      write((tx) => commitSoften(tx, lessonId, from));
    },
    toBreak(pending) {
      write((tx) => commitBreak(tx, pending));
    },
    half2Started() {
      write((tx) => commitHalf2Started(tx, clock()));
    },
    kick(e: Of<'kick'>) {
      const no = tasks.find((t) => t.id === e.taskId)?.no ?? null;
      write((tx) => commitKick(tx, e.expert, no));
    },
    abandon() {
      // Журнал уже хранит `open` с номером последней атаки; брошенный матч ничего не теряет (ТЗ-0.11).
      log = null;
      player = null;
      noPlayer = false;
    },
    finish(e: Of<'finish'>) {
      const l = log;
      // Контекст и игрок остаются: блоки минуты тренера идут после итога и пишутся в тот же закрытый журнал.
      if (l) write((tx) => commitFinish(tx, e, l, { rules: d.rules, next: place(e.lessonId)?.next ?? null, order }));
    },
  };
}

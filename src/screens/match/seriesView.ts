/**
 * Что показывает экран на серии ударов Кубка (068 Т6-2, кадры Э5.30–.33): табло с отметками, слово в строке набора, статус и вратарь.
 * Чистая функция от `SeriesUi`, без Vue и DOM — как `viewOf` у матча (тест `tests/cup/series.test.ts`). Тексты — `ru.cup.match.series`.
 */
import { expectedHit, expectedThumb } from '../../engine/typing/typing';
import type { RunningSeries, Shot } from '../../engine/cup';
import type { SeriesUi } from '../../app/cup/seriesFlow';
import { fill } from '../../app/home/texts';
import { ru } from '../../i18n/ru';
import { fingerName, type MatchView } from './view';

const t = ru.cup.match.series;

/** Отметка удара в табло: `now` — бьём сейчас, `goal` — гол, `miss` — вратарь взял. */
export type Mark = '' | 'now' | 'goal' | 'miss';

/** Вратарь соперника: поза (ready — стоит, dive — прыгнул за мячом), середина от центра сцены, высота и нижняя кромка в px сцены. */
export interface KeeperSpot {
  pose: 'ready' | 'dive';
  dx: number;
  h: number;
  bottom: number;
}

export interface SeriesBoard {
  us: Mark[];
  them: Mark[];
  /** Плашка над воротами: «удар 2 из 3». */
  ban: string;
  /** Строка статуса: слово слева и событие по центру (палец справа — `MatchView.target`). */
  left: string;
  centre: string;
  keeper: KeeperSpot;
}

const KEEPER = {
  /** Макет Э5.30–.33: вратарь стоит левее мяча; гол — он в броске у штанги; взял — стоит справа с мячом. */
  ready: { pose: 'ready', dx: -110, h: 134, bottom: 322 },
  goal: { pose: 'dive', dx: -120, h: 96, bottom: 292 },
  save: { pose: 'ready', dx: 100, h: 150, bottom: 322 },
} as const satisfies Record<string, KeeperSpot>;

const marks = (shots: readonly Shot[], now: Mark): Mark[] => [0, 1, 2].map((i) => shots[i] ?? (i === shots.length ? now : ''));

/** Вид серии для сцены; серия не началась — `null`. Ошибка в слове уже сейчас метит удар «вратарь взял»: гол в нём невозможен. */
export function seriesView(ui: SeriesUi, score: { me: number; opp: number }): { view: MatchView; board: SeriesBoard } | null {
  const s = ui.state;
  if (s.phase === 'idle') return null;
  const run: RunningSeries = s;
  const done = run.phase === 'done';
  const kick = Math.min(done ? run.kick - 1 : run.kick, 2);
  const word = run.words[kick] ?? '';
  const typing = run.typing;
  const errors = typing === null ? 0 : typing.lineErrors;
  const hit = typing === null ? null : expectedHit(run.keymap, typing);
  const thumb = typing === null ? null : expectedThumb(run.keymap, typing);
  const typed = typing === null ? { text: word, pos: word.length } : { text: typing.text, pos: typing.pos };
  const centre = done ? (run.won === true ? t.won : t.lost) : errors > 0 ? t.miss : t.hint;
  return {
    view: {
      phase: t.board,
      detail: '',
      score,
      line: null,
      balls: [],
      target: hit === null ? null : { code: hit.key.code, thumb, finger: fingerName(hit.key.finger, thumb) },
      typed,
      next: [],
    },
    board: {
      us: marks(run.mine, done ? '' : errors > 0 ? 'miss' : 'now'),
      them: marks(run.theirs, ''),
      ban: fill(t.ban, { n: kick + 1 }),
      left: fill(t.word, { len: word.length, typed: typed.pos }),
      centre,
      keeper: KEEPER[ui.shout ?? 'ready'],
    },
  };
}

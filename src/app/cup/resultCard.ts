/**
 * Карточка итога матча Кубка (068 Т6, кадры Э5.26–.28): чистая функция от итога свистка (`CupFinished`) и вида Кубка после записи.
 * Экран и компонент ничего не считают: заголовок по счёту, строки наград, таблица нашей группы, «что дальше» и куда ведут кнопки.
 * Серия ударов (Э5.34, .35): заголовок «Серия наша!», две строки отметок. Поражение — «Точность», «Скорость», «Что выросло» (общие блоки `components/result`).
 * Окна наград (Э5.37, .38, .41) — `awards.ts`. Повтор после титула (Э5.43): та же карточка победы, но без пака, таблицы и «дальше»; справа — «Кубок уже наш…» (ТЗ-8.13).
 */
import { TEAMS, type CupView, type RoundKey, type Shot } from '../../engine/cup';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import type { StoryArtKey } from '../art/storyArt';
import { fill } from '../home/texts';
import type { CupFinished } from './run';
import { emblemKey, nameOf } from './groupView';

const r = ru.cup.result;
const GROUP: readonly RoundKey[] = ['g1', 'g2', 'g3'];

/** Строка мини-таблицы группы в карточке итога. `rep` — наш проигранный тур переигрывается: в «играх» стоит «↻». */
export interface CardRow { place: number; emblem: StoryArtKey; name: string; p: number; goals: string; pts: number; our: boolean; rep: boolean }

export interface CupCard {
  kind: 'win' | 'draw' | 'loss';
  title: string;
  lead: string;
  /** «212 верных → 10 монет», «+212 болельщиков»; на проигрыше монеты — «+10 монет». */
  purse: { correct: string; coins: string; fans: string };
  /** Метка «пак — первая победа в раунде»; `null` — пака нет. */
  pack: string | null;
  /** «Группа пройдена: 2-е место!» после третьего тура. */
  done: string | null;
  /** «Точность» и «Скорость» — только поражение (Э5.28, .35). */
  stats: { acc: string; cpm: string } | null;
  /** Серия ударов: подпись «Серия 2:1» и две строки отметок (наши, соперника); серии не было — `null`. */
  series: { head: string; rows: { emblem: StoryArtKey; name: string; shots: readonly Shot[] }[] } | null;
  /** «Что выросло»: пальцы, у которых вырос ранг (поражение). */
  grew: string[];
  /** «Дальше»: следующий матч или «тур переигрывается». */
  note: string;
  /** Повтор после титула: плашка короче (Э5.43), пака и таблицы нет. */
  replay: boolean;
  table: { head: string; rows: CardRow[] } | null;
  primary: { label: string; go: 'next' | 'replay' };
  quiet: string;
}

const goalsOf = (x: readonly Shot[]): number => x.filter((v) => v === 'goal').length;
const cap = (s: string): string => (s === '' ? s : s[0]!.toUpperCase() + s.slice(1));

/** Наша группа после записи тура: заголовок и строки; ничего не сыграно — `null`. */
function tableOf(view: CupView, club: string): CupCard['table'] {
  const g = view.groups[view.ours]!;
  return {
    head: fill(ru.cup.screen.tabGroup, { letter: g.letter }),
    rows: g.rows.map((row, i) => ({
      place: i + 1,
      emblem: emblemKey(row.team),
      name: nameOf(row.team, club),
      p: row.p,
      goals: `${row.gf}:${row.ga}`,
      pts: row.pts,
      our: row.team === 'our',
      rep: row.team === 'our' && g.lost > 0,
    })),
  };
}

/** Следующий матч строкой: тур группы по порядку или раунд плей-офф с соперником; раундов больше нет — пусто. */
function nextNote(view: CupView, round: RoundKey): string {
  const n = view.next;
  if (n.round === null || n.flag === null) return '';
  if (GROUP.includes(n.round)) return fill(r.nextGroup, { n: GROUP.indexOf(n.round) + 1, lesson: n.flag });
  const team = TEAMS.find((x) => x.id === n.rival);
  if (team === undefined || round === n.round) return '';
  return fill(r.nextKo, { round: ru.home.flags[n.flag] ?? '', name: team.name, street: team.street, lesson: n.flag });
}

/** Карточка итога: `view` — вид Кубка после записи матча, `club` — имя клуба ребёнка. */
export function cupCard(fin: Pick<CupFinished, 'view'>, view: CupView, club: string): CupCard {
  const v = fin.view;
  const group = GROUP.includes(v.round);
  // повтор после титула раундом не засчитывается (`passed` пуст): счёт решает сам
  const kind = v.replay ? (v.total.me > v.total.opp ? 'win' : v.total.me === v.total.opp ? 'draw' : 'loss') : v.passed ? (v.total.me > v.total.opp || v.series?.won === true ? 'win' : 'draw') : 'loss';
  const rival = TEAMS.find((x) => x.id === view.path.find((p) => p.round === v.round)?.rival);
  const pts = kind === 'win' ? 3 : 1;
  const score = { a: v.total.me, b: v.total.opp };
  const table = group && !v.replay ? tableOf(view, club) : null;
  const place = table === null ? 0 : table.rows.findIndex((x) => x.our) + 1;
  const ok = kind !== 'loss';
  const sr = v.series;
  const sc = sr === null ? null : { a: goalsOf(sr.mine), b: goalsOf(sr.theirs) };
  const series: CupCard['series'] = sr === null || sc === null ? null : {
    head: fill(r.seriesHead, sc),
    rows: [{ emblem: emblemKey('our'), name: club, shots: sr.mine }, { emblem: emblemKey(rival?.id ?? 'our'), name: rival?.name ?? '', shots: sr.theirs }],
  };
  return {
    kind,
    title: sc !== null ? (ok ? r.seriesWin : fill(r.seriesLoss, sc)) : kind === 'loss' ? fill(r.loss, score) : fill(kind === 'win' ? r.win : r.draw, score) + (group && !v.replay ? fill(r.points, { pts: `${pts} ${plural(pts, ru.cup.pointsForms)}` }) : ''),
    lead: rival === undefined ? '' : fill(r.lead, { name: rival.name, street: rival.street }),
    purse: {
      correct: fill(ru.result.purse.correct, { n: v.correct }),
      coins: `${ok ? '' : '+'}${v.coins} ${plural(v.coins, ru.result.purse.coins)}`,
      fans: `+${v.fans} ${plural(v.fans, ru.result.purse.fans)}`,
    },
    stats: ok ? null : { acc: `${Math.round(v.acc / 10)} %`, cpm: String(v.cpm) },
    series,
    pack: v.pack ? r.pack : null,
    done: v.round === 'g3' && v.passed ? fill(r.groupDone, { place }) : null,
    grew: v.grew.map((g) => `${cap(ru.match.status.fingers[g.finger as keyof typeof ru.match.status.fingers] ?? g.finger)} — ${fill(ru.result.purse.rank, { name: ru.result.purse.rankNames[g.to] ?? String(g.to) })}`),
    note: v.replay ? ru.cup.screen.titleNote : ok ? nextNote(view, v.round) : group ? r.replay : series === null ? '' : r.seriesReplay,
    replay: v.replay,
    table,
    primary: ok ? { label: ru.result.next, go: 'next' } : { label: group ? r.again : ru.cup.screen.replayRound, go: 'replay' },
    quiet: ok ? ru.result.home : r.later,
  };
}


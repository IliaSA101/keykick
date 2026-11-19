/**
 * Вид вкладки «Группа» экрана Кубка (068 Т5, кадры Э5.01–.08): из `CupView` модели — строки таблицы, панель «Следующий матч»,
 * остальные группы, дорожка. Чистые функции: тексты — `ru.cup.screen`, соперник и «где играем» — слова Дома (`ru.home`).
 * Данные чужих групп и счёт — только из модели, своих чисел экран не считает.
 */
import { TEAMS, anchorOf, type CupView, type GroupView, type KoRound, type RoundKey } from '../../engine/cup';
import type { StoryArtKey } from '../art/storyArt';
import { fill, rivalName } from '../home/texts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const s = ru.cup.screen;
const KO: readonly KoRound[] = ['r16', 'qf', 'sf', 'f'];
const GROUP_ROUNDS: readonly RoundKey[] = ['g1', 'g2', 'g3'];

/** Ключ эмблемы в `story-art.json`: «Прогресс» (наш клуб) — своя, у остальных — по id команды. */
export const emblemKey = (id: string): StoryArtKey => `cupEm${id === 'our' ? 'Progress' : id[0]!.toUpperCase() + id.slice(1)}` as StoryArtKey;

/** Ячейка тура: победа `w`, ничья `d`, чужая `oth`, ещё нет `no`, проиграна и ждёт переигровки `lost`; `open` — следующий матч. */
export interface TourCell { kind: 'w' | 'd' | 'oth' | 'no' | 'lost'; text: string; open: boolean }
export interface GroupRow { place: string; emblem: StoryArtKey; name: string; sub: string; our: boolean; idle: boolean; cut: boolean; cells: TourCell[]; pts: string }
export interface NextView { phase: string; emblem: StoryArtKey; withOpp: string; where: string; action: string | null; note: string; status: string | null }
export interface OtherGroup { letter: string; rows: { emblem: StoryArtKey; name: string; pts: string; kind: '' | 'lead' | 'out' }[] }
export interface TrackNode { name: string; after: number; lit: boolean; seg: boolean }
export interface GroupScreen { status: string; rules: string; after: number[]; rows: GroupRow[]; next: NextView | null; others: OtherGroup[]; track: TrackNode[] }

/** Улица двора команды в родительном падеже («Заречной»); неизвестный id — пусто. */
export const streetOf = (id: string): string => TEAMS.find((t) => t.id === id)?.street ?? '';
const cap = (t: string): string => (t === '' ? t : t[0]!.toUpperCase() + t.slice(1));
export const nameOf = (id: string, club: string): string => (id === 'our' ? club : (TEAMS.find((t) => t.id === id)?.name ?? id));
const pts = (n: number): string => `${n} ${plural(n, ru.cup.pointsForms)}`;

function statusOf(g: GroupView): string {
  if (g.played === 0) return s.noMatches;
  const r = g.rows.findIndex((x) => x.team === 'our');
  const row = g.rows[r]!;
  if (g.played === 3 && r < 2) return fill(row.w === 0 ? s.throughNoWins : s.through, { place: r + 1, pts: pts(row.pts) });
  return fill(s.placeOf, { place: r + 1, pts: pts(row.pts) });
}

function rowsOf(g: GroupView, club: string, next: { round: RoundKey | null; open: boolean }): GroupRow[] {
  return g.rows.map((r, i) => {
    const our = r.team === 'our';
    const cells = r.byTour.map((b, t): TourCell => {
      if (our && g.lost === t + 1 && !b) return { kind: 'lost', text: '↻', open: false };
      if (!b) return { kind: 'no', text: '—', open: our && next.open && next.round === GROUP_ROUNDS[t] };
      return { kind: our ? (b.r === 'W' ? 'w' : 'd') : 'oth', text: `${b.f}:${b.a}`, open: false };
    });
    const team = TEAMS.find((x) => x.id === r.team);
    return { place: g.played ? String(i + 1) : '—', emblem: emblemKey(r.team), name: nameOf(r.team, club), sub: our ? s.ourYard : (team?.street ?? ''), our, idle: our && g.played === 0, cut: i === 1 && g.played > 0, cells, pts: g.played ? String(r.pts) : '—' };
  });
}

/** Панель «Следующий матч»; `null` — Кубок взят (кубок и «Сыграть снова» — на вкладке «Сетка»). */
export function nextOf(view: CupView, ctx: { cur: number; dayN: number }): NextView | null {
  const n = view.next;
  if (n.round === null || n.flag === null || n.rival === null) return null;
  const group = GROUP_ROUNDS.includes(n.round);
  const team = TEAMS.find((x) => x.id === n.rival);
  const where = fill(n.home ? ru.home.homeGame : ru.home.away, { rival: rivalName(team?.street ?? '') });
  const phaseBase = cap(ru.home.flags[n.flag] ?? '');
  const base = { emblem: emblemKey(n.rival), withOpp: fill(s.withOpp, { name: ru.cup.instr[n.rival] ?? '' }), where };
  if (n.state !== 'open' && n.state !== 'replay') {
    let status: string;
    if (n.state === 'day3' || n.state === 'later') status = ru.cup.card.later;
    else if (ctx.dayN === 1 && n.round === 'g1') status = ru.home.cup.before;
    else status = `${fill(s.afterLesson, { n: n.flag })}${n.round === 'g3' ? ` · ${s.drawEnough}` : ''}`;
    return { ...base, phase: phaseBase, action: null, note: '', status };
  }
  if (n.state === 'replay') {
    const k = KO.indexOf(n.round as KoRound);
    const nextRound = k >= 0 ? KO[k + 1] : undefined;
    const stack = nextRound !== undefined && ctx.cur > anchorOf(nextRound);
    const note = group ? s.noElimination : stack ? fill(s.afterWin, { next: s.trackNames[nextRound].toLowerCase(), this: s.trackNames[n.round as KoRound] }) : s.sameRound;
    return { ...base, phase: phaseBase, action: group ? fill(s.replayGroup, { phase: phaseBase }) : s.replayRound, note, status: null };
  }
  if (n.warmup) return { ...base, phase: phaseBase, action: ru.home.go, note: ru.home.cup.afterWarm, status: null };
  const final = n.round === 'f' && ctx.cur > 32;
  return { ...base, phase: final ? ru.home.cup.waitsFinal : phaseBase, action: ru.home.go, note: final ? s.anytime : '', status: null };
}

/** Вкладка «Группа»: `club` — имя клуба ребёнка (строка «наша»), `ctx` — урок и игровой день. */
export function groupScreen(view: CupView, ctx: { cur: number; dayN: number }, club: string): GroupScreen {
  const g = view.groups[view.ours]!;
  const done = g.played === 3;
  const wonKo = KO.filter((r) => view.bracket[r].some((c) => (c.a === 'our' || c.b === 'our') && c.win === (c.a === 'our' ? 'a' : 'b'))).length;
  const lit = done ? 1 + wonKo : 0;
  const open = view.next.state === 'open' || view.next.state === 'replay';
  return {
    status: statusOf(g),
    rules: s.rules,
    after: [0, 1, 2].map((i) => view.path[i]!.flag),
    rows: rowsOf(g, club, { round: view.next.round, open }),
    next: nextOf(view, ctx),
    others: view.groups.filter((x) => !x.our).map((x): OtherGroup => ({
      letter: x.letter,
      rows: x.rows.map((r, i) => ({ emblem: emblemKey(r.team), name: nameOf(r.team, club), pts: x.played ? String(r.pts) : '', kind: done ? (i < 2 ? 'lead' : 'out') : '' })),
    })),
    track: KO.map((r, i) => ({ name: s.trackNames[r], after: view.path[3 + i]!.flag, lit: i < lit, seg: i < lit - 1 })),
  };
}

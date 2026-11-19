/**
 * Вид вкладки «Сетка» экрана Кубка (068 Т5, кадры Э5.09–.22, макет `tools/mock-champ/e5-bracket.mjs`): из `CupView` модели — ячейки пар
 * с местами, линии, окошки счёта, подписи колонок, кубок и панель шага. Чистые функции: геометрия — в px области содержимого мелового
 * поля, часы и случайность не нужны. Победитель и счёт — только из модели; «пока» (до конца группы) — текущий порядок таблицы групп.
 * Наша половина — всегда слева (`ourHalfLeft`): если наша пара в правой половине данных, половины меняются местами.
 */
import { KO_ROUNDS, anchorOf, type Cell, type Cup, type CupView, type KoRound } from '../../engine/cup';
import type { StoryArtKey } from '../art/storyArt';
import { fill } from '../home/texts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';
import { emblemKey, nameOf, nextOf, streetOf } from './groupView';

const s = ru.cup.screen;
const SLOT_K = 46; // 1/4 и 1/2: ячейка карточкой — герб над именем, улица мелко
const TOP0 = 50; // верх первой пары 1/8 в координатах области (над ней — вкладки и подписи колонок)
const OUR = 'our';

/** Нужное виду от геометрии экрана (её считает `components/cup/cupGeo`): область содержимого и низ сетки. */
export interface CupGeo { x: number; y: number; w: number; h: number; tb: number }

export interface SlotView { id: string; name: string; sub: string; emblem: StoryArtKey; our: boolean; lose: boolean }
export interface PairView {
  key: string;
  round: KoRound;
  i: number;
  /** `h` — 1/8, `k` — карточки 1/4 и 1/2, `f` — финал. */
  kind: 'h' | 'k' | 'f';
  /** Направление пути: 1 — слева направо, -1 — зеркально (правая половина). */
  dir: 1 | -1;
  x: number;
  top: number;
  w: number;
  h: number;
  yc: number;
  /** Слоты пары; `null` — соперник ещё неизвестен («?»). */
  slots: [SlotView | null, SlotView | null];
  ours: boolean;
  /** Класс рамки: `ours`, `warn`, `now`, `tent`, `gold` — по состоянию пары. */
  cls: string;
}
export interface LineView { d: string; cls: string; sm: boolean; pair: string }
export interface PillView { text: string; x: number; y: number; warn: boolean; ser: boolean; r16: boolean; pair: string }
export interface HeadView { round: KoRound; x: number; y: number; w: number; name: string; after: number }
export interface StepView {
  kind: 'title' | 'silver' | 'plain' | 'wait';
  lead: string;
  /** Строки подписи (слова Дома: «где играем» и пояснение). */
  sub: string[];
  action: string | null;
  /** Кнопка тихая и без Enter («Сыграть снова» после титула, 038-Р12). */
  quiet: boolean;
  emblem: StoryArtKey | null;
  left: number;
  top: number;
  width: number;
  height: number | null;
  /** Верх тихой кнопки под панелью титула. */
  againTop: number;
}
export interface BracketScreen {
  pairs: PairView[];
  lines: LineView[];
  pills: PillView[];
  heads: HeadView[];
  cup: { x: number; top: number; h: number; w: number; lit: boolean };
  /** Центр кубка для меловых звёздочек праздника. */
  sparkles: { x: number; y: number; r: number }[];
  step: StepView | null;
  /** Пара наведённой команды: левый и правый край и середина (для подсказки). */
  ourKey: string | null;
}

/** Колонки области: 1/8 — шире всех (имя 13, улица 11), 1/4 и 1/2 — уже на ≈ 25 %; `g` — зазор между колонками. */
function columns(w: number, narrow: boolean) {
  const g = narrow ? 13 : 20;
  const cw = narrow ? 112 : 116;
  const wb = narrow ? 82 : 88;
  const wa = Math.round((w - cw - 6 * g) / 2 - 2 * wb);
  const cx = wa + 2 * wb + 3 * g;
  const rx = cx + cw + g;
  // высота строки ячейки 1/8 и финала: пара — две строки и черта между ними; на 1024 — 27 (просвет между парами под пилюлю счёта)
  const slot = narrow ? 27 : 28;
  return { slot, box: slot * 2 + 1, cw, cx, w: [wa, wb, wb] as const, xs: { l: [0, wa + g, wa + wb + 2 * g] as const, r: [rx + 2 * wb + 2 * g, rx + wb + g, rx] as const } };
}

/** Что показывает каждая сторона ячейки: id команды, `null` — неизвестна. */
interface Raw { a: string | null; b: string | null; win: 0 | 1 | null; text: string | null; lost: boolean; tent: boolean; pen: boolean }

const rot = <T>(a: readonly T[], k: number): T[] => [...a.slice(k), ...a.slice(0, k)];

/** Текущая команда места `1A`/`2B` в таблице группы («пока» до конца группы, 038-Р2). */
function seedOf(view: CupView, ref: string): string | null {
  const g = view.groups.find((x) => x.letter === ref.slice(1));
  return g?.rows[Number(ref[0]) - 1]?.team ?? null;
}

/** Победитель впереди: «2:1» пишется большим числом вперёд (038-Р37); серия — приписка. */
const scoreText = (x: number, y: number, pen: boolean): string => `${Math.max(x, y)}:${Math.min(x, y)}${pen ? ` · ${s.series}` : ''}`;

function rawOf(view: CupView, cup: Cup, round: KoRound, i: number): Raw {
  const c: Cell = view.bracket[round][i]!;
  const tentRound = round === 'r16' && view.groups[view.ours]!.played < 3;
  const a = c.a ?? (tentRound ? seedOf(view, c.refA) : null);
  const b = c.b ?? (tentRound ? seedOf(view, c.refB) : null);
  const k = cup.ko[round];
  let text: string | null = null;
  let pen = false;
  if (c.score) {
    text = scoreText(c.score.a, c.score.b, c.score.pen);
    pen = c.score.pen;
  } else if (c.lost && k.me !== null && k.opp !== null) {
    pen = k.series !== null;
    text = scoreText(k.me, k.opp, pen);
  }
  return { a, b, win: c.win === 'a' ? 0 : c.win === 'b' ? 1 : null, text, lost: c.lost, tent: tentRound, pen };
}

/** Все 15 пар после поворота половин: наша — слева. */
function rawBracket(view: CupView, cup: Cup): Record<KoRound, Raw[]> {
  const raw = Object.fromEntries(KO_ROUNDS.map((r) => [r, view.bracket[r].map((_, i) => rawOf(view, cup, r, i))])) as Record<KoRound, Raw[]>;
  if (raw.r16.findIndex((m) => m.a === OUR || m.b === OUR) < 4) return raw;
  return {
    r16: rot(raw.r16, 4),
    qf: rot(raw.qf, 2),
    sf: rot(raw.sf, 1),
    f: raw.f.map((m): Raw => ({ ...m, a: m.b, b: m.a, win: m.win === null ? null : m.win === 0 ? 1 : 0 })),
  };
}

const slotOf = (id: string | null, club: string, lose: boolean): SlotView | null =>
  id === null ? null : { id, name: nameOf(id, club), sub: id === OUR ? ru.cup.screen.ourYard : streetOf(id), emblem: emblemKey(id), our: id === OUR, lose };

/** Подсказка наведения (Э5.22): куда стать и что в ней написать. */
export interface HoverPop { name: string; place: string; where: string; maybe: string; emblem: StoryArtKey; left: number; top: number; w: number; tail: number }

export function hoverPop(view: CupView, name: string, bs: BracketScreen, geo: CupGeo): HoverPop | null {
  const p = bs.pairs.find((x) => x.slots.some((sl) => sl?.name === name));
  const sl = p?.slots.find((x) => x?.name === name);
  if (!p || !sl) return null;
  const g = view.groups.find((x) => x.rows.some((r) => r.team === sl.id))!;
  const i = g.rows.findIndex((r) => r.team === sl.id);
  const n = g.rows[i]!.pts;
  const w = 244;
  return {
    name,
    place: sl.our ? sl.sub : fill(ru.home.rival, { street: sl.sub }),
    where: g.played === 0 ? fill(s.popGroupNone, { letter: g.letter }) : fill(s.popGroup, { letter: g.letter, place: i + 1, pts: `${n} ${plural(n, ru.cup.pointsForms)}` }),
    maybe: view.groups[view.ours]!.played < 3 ? s.popMaybe : '',
    emblem: sl.emblem,
    left: geo.x + (p.dir > 0 ? p.x : p.x + p.w - w), // под парой: у левого края в левой половине, у правого — в правой
    top: geo.y + p.yc + p.h / 2 + 14,
    w,
    tail: p.dir > 0 ? p.w / 2 : w - p.w / 2,
  };
}

/** Панель шага под финалом: раунд, соперник, где играем, кнопка или «после урока N»; итог финала — «Кубок наш!» и серебро. */
function stepOf(view: CupView, ctx: { cur: number; dayN: number }, geo: { left: number; width: number; top: number; titleH: number; fieldBottom: number }): StepView | null {
  const base = { left: geo.left, width: geo.width, height: null, againTop: 0, quiet: false };
  if (view.title === 'gold') {
    const top = geo.top + 30;
    return { ...base, kind: 'title', lead: s.titleLead, sub: [s.titleNote], action: s.playAgain, quiet: true, emblem: null, top, height: geo.titleH, againTop: Math.min(top + geo.titleH + 12, geo.fieldBottom - 12 - 35) };
  }
  if (view.title === 'silver') return { ...base, kind: 'silver', lead: ru.cup.card.silver, sub: [ru.cup.card.silverSub], action: s.playFinalAgain, emblem: 'cupMedal', top: geo.top + 46 };
  const n = nextOf(view, ctx);
  if (n === null) return null;
  const top = geo.top + 46;
  if (n.action) return { ...base, kind: 'plain', lead: `${n.phase} · ${n.withOpp}`, sub: [n.where, ...(n.note ? [n.note] : [])], action: n.action, emblem: n.emblem, top };
  // «игры — после урока 9» / «в следующий раз»: одна строка, без соперника
  if (n.status === ru.home.cup.before || n.status === ru.cup.card.later) return { ...base, kind: 'wait', lead: n.status, sub: [], action: null, emblem: null, top };
  const flag = view.next.flag ?? 0;
  const draw = view.next.round === 'g3' ? [s.drawEnough] : [];
  return { ...base, kind: 'plain', lead: `${n.phase} — ${fill(s.afterLesson, { n: flag })}`, sub: [`${n.withOpp} · ${n.where}`, ...draw], action: null, emblem: n.emblem, top };
}

/** Вкладка «Сетка»: пары с местами, линии, окошки счёта, подписи колонок, кубок и панель шага. */
export function bracketScreen(view: CupView, cup: Cup, ctx: { cur: number; dayN: number }, club: string, geo: CupGeo, narrow: boolean): BracketScreen {
  const c = columns(geo.w, narrow);
  const pitch = (geo.tb - TOP0 - c.box) / 3; // сетка — до верха мяча на полке, дальше — панель шага и дорожка
  const raw = rawBracket(view, cup);
  const pos = new Map<string, { x: number; w: number; h: number; yc: number; dir: 1 | -1; round: KoRound; i: number }>();
  const put = (round: KoRound, i: number, x: number, w: number, dir: 1 | -1, yc: number, h: number): void => void pos.set(`${round}${i}`, { x, w, h, yc, dir, round, i });
  for (let i = 0; i < 8; i++) put('r16', i, i < 4 ? c.xs.l[0] : c.xs.r[0], c.w[0], i < 4 ? 1 : -1, TOP0 + c.box / 2 + (i % 4) * pitch, c.box);
  const mid = (a: string, b: string): number => (pos.get(a)!.yc + pos.get(b)!.yc) / 2;
  const box2 = SLOT_K * 2 + 1;
  for (let i = 0; i < 4; i++) put('qf', i, i < 2 ? c.xs.l[1] : c.xs.r[1], c.w[1], i < 2 ? 1 : -1, mid(`r16${2 * i}`, `r16${2 * i + 1}`), box2);
  for (let i = 0; i < 2; i++) put('sf', i, i ? c.xs.r[2] : c.xs.l[2], c.w[2], i ? -1 : 1, mid(`qf${2 * i}`, `qf${2 * i + 1}`), box2);
  put('f', 0, c.cx, c.cw, 1, mid('sf0', 'sf1'), c.box);

  const ci = raw.r16.findIndex((m) => m.a === OUR || m.b === OUR);
  const chain = new Set([`r16${ci}`, `qf${ci >> 1}`, 'sf0']);
  const title = view.title === 'gold';
  const openRound = view.next.state === 'open' ? view.next.round : null;
  const pairs: PairView[] = [];
  const lines: LineView[] = [];
  const pills: PillView[] = [];
  for (const p of pos.values()) {
    const m = raw[p.round][p.i]!;
    const ours = m.a === OUR || m.b === OUR;
    const top = p.yc - p.h / 2;
    const warn = m.lost;
    const now = ours && !m.lost && p.round === openRound;
    const key = `${p.round}${p.i}`;
    const cls = [m.tent ? 'tent' : '', ours ? 'ours' : '', warn ? 'warn' : '', now ? 'now' : '', title && ours ? 'gold' : ''].filter(Boolean).join(' ');
    const lose = (side: 0 | 1): boolean => !m.lost && m.win !== null && m.win !== side;
    pairs.push({ key, round: p.round, i: p.i, kind: p.round === 'r16' ? 'h' : p.round === 'f' ? 'f' : 'k', dir: p.dir, x: p.x, top, w: p.w, h: p.h, yc: p.yc, slots: [slotOf(m.a, club, lose(0)), slotOf(m.b, club, lose(1))], ours, cls });
    // счёт — под своей ячейкой (у 1/2 — над ней: снизу лежит панель шага), у 1/8 — в середине просвета между парами
    const sy = p.round === 'sf' ? top - 12 : top + p.h + (p.round !== 'r16' ? 10 : (pitch - p.h) / 2);
    const pill = (): void => { if (m.text) pills.push({ text: m.text, x: p.x + p.w / 2, y: sy, warn, ser: m.pen, r16: p.round === 'r16', pair: key }); };
    if (p.round === 'f') { pill(); continue; }
    const parent = pos.get(`${p.round === 'r16' ? 'qf' : p.round === 'qf' ? 'sf' : 'f'}${p.round === 'sf' ? 0 : p.i >> 1}`)!;
    const x1 = p.dir === 1 ? p.x + p.w : p.x;
    const x2 = p.dir === 1 ? parent.x : parent.x + parent.w;
    const xm = (x1 + x2) / 2;
    const ourWin = m.win !== null && (m.win === 0 ? m.a : m.b) === OUR;
    const fut = chain.has(key) && m.win === null && !warn;
    lines.push({ d: `M${x1.toFixed(1)} ${p.yc.toFixed(1)}H${xm.toFixed(1)}V${parent.yc.toFixed(1)}H${x2.toFixed(1)}`, cls: ourWin ? (title ? 'gold' : 'our') : warn ? 'warn' : fut ? 'fut' : '', sm: narrow, pair: key });
    pill();
  }
  const order = (l: LineView): number => (l.cls === 'gold' || l.cls === 'our' ? 2 : l.cls === 'fut' ? 0 : 1);
  lines.sort((a, b) => order(a) - order(b));

  const f = pos.get('f0')!;
  const hasScore = raw.f[0]!.text !== null;
  const heads: HeadView[] = [];
  (['r16', 'qf', 'sf'] as const).forEach((r, i) => {
    heads.push({ round: r, x: c.xs.l[i]!, y: 32, w: c.w[i]!, name: s.trackNames[r], after: anchorOf(r) }, { round: r, x: c.xs.r[i]!, y: 32, w: c.w[i]!, name: s.trackNames[r], after: anchorOf(r) });
  });
  if (!title) heads.push({ round: 'f', x: c.cx, y: f.yc + f.h / 2 + (hasScore ? 25 : 12), w: c.cw, name: s.trackNames.f, after: anchorOf('f') });
  const cupH = narrow ? 140 : 150;
  const cupTop = f.yc - f.h / 2 - 12 - cupH; // кубок над финалом, зазор 12 px
  const cupX = c.cx + c.cw / 2;
  const sparkles = title ? [[-68, -60, 9], [66, -66, 11], [-62, 30, 6], [66, 36, 7], [-40, -76, 6], [36, -82, 7]].map(([dx, dy, r]) => ({ x: cupX + dx! - r!, y: cupTop + cupH / 2 + dy! - r!, r: r! })) : [];
  const sf0 = pos.get('sf0')!;
  const sf1 = pos.get('sf1')!;
  const step = stepOf(view, ctx, { left: sf0.x, width: sf1.x + sf1.w - sf0.x, top: f.yc + f.h / 2, titleH: narrow ? 78 : 100, fieldBottom: geo.h + 16 });
  return { pairs, lines, pills, heads, cup: { x: cupX, top: cupTop, h: cupH, w: Math.round((cupH * 499) / 640), lit: title }, sparkles, step, ourKey: ci >= 0 ? `r16${ci}` : null };
}

/** Сколько раундов плей-офф выиграно (для М3: раунд, взятый между двумя показами экрана). */
export const wonKoCount = (cup: Cup): number => KO_ROUNDS.filter((r) => cup.ko[r].won).length;

/** М3 (Э5.12 → Э5.13): раунд, выигранный с прошлого показа экрана; `null` — движения нет (первый показ, ничего нового, финал — это титул, а не ход по сетке). */
export function motionRound(prev: number | null, now: number): KoRound | null {
  if (prev === null || now !== prev + 1 || now > 3) return null;
  return KO_ROUNDS[prev] ?? null;
}

/** Откуда и куда едет наша карточка в М3: слот нашей ячейки в раунде `round` и в следующем (слева направо; координаты области). */
export function flightOf(bs: BracketScreen, round: KoRound): { fromX: number; fromY: number; toX: number; toY: number; w: number } | null {
  const next = KO_ROUNDS[KO_ROUNDS.indexOf(round) + 1];
  if (next === undefined) return null;
  const from = bs.pairs.find((p) => p.round === round && p.ours);
  const to = bs.pairs.find((p) => p.round === next && p.ours);
  if (!from || !to) return null;
  const slotH = from.h / 2;
  const fi = from.slots[0]?.our ? 0 : 1;
  const ti = to.slots[0]?.our ? 0 : 1;
  const fromX = from.x + (from.w - to.w) / 2;
  return { fromX, fromY: from.top + fi * slotH, toX: to.x, toY: to.top + ti * SLOT_K, w: to.w };
}

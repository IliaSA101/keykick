/**
 * Свисток матча Кубка (068 К-Б, ТЗ-3.1, 5.1, 8.4–8.7, 8.13): `finishCup` — та же форма, что `finishMatch` (065 К-Б). Общий свисток —
 * `whistle` из `engine/match/finish.ts` (монеты, болельщики, форма, день); здесь — запись раунда в раздел `cup`, пак за первый
 * засчитанный раунд (касса, `cup-pack`), призовые формы (`grantPrizes`) и факты для газеты и праздника. Звёзд и курса нет (ТЗ-8.4).
 * Повтор с тем же `matchId` — без изменений; после титула — общий свисток целиком, но без пака, призовых форм и титула (ТЗ-8.13, Э5.43); раунд не по очереди — без изменений.
 * Время печати и точность дня (`addTyped`, `addAcc`) пишет общий свисток (068 Т8).
 */
import { grantPrizes } from '../album/award';
import { PACKS_YARD } from '../album/order';
import { whistle, type Rhythm, type WhistleSave } from '../match/finish';
import { permille } from '../match/stars';
import type { FormGrowth } from '../form/rank';
import type { MatchResult, Score, Verdict } from '../match/types';
import { charsPerMinute, type TypingStats } from '../typing/typing';
import { credit, isPaid } from '../rewards/cash';
import { claimPack, recordKo, recordTour } from './section';
import type { SeriesResult, Shot } from './series';
import type { Cup, RoundKey } from './types';

/** Призовые формы за события Кубка (ТЗ-8.7, `content/prizes.json`): выход из группы, полуфинал, титул. */
export const PRIZE_GROUP = 'p-turq';
export const PRIZE_SEMI = 'p-red';
export const PRIZES_TITLE: readonly string[] = ['p-ystars', 'p-champ'];

/** Разделы, которые меняет свисток Кубка: общий свисток и раздел `cup` (курс не трогается). */
export type CupSave = WhistleSave & { cup: Cup };

/** Имя раздела в конверте → данные: то, что отдают `session.save(patch)`. */
export function cupPatch(s: CupSave): Record<string, unknown> {
  return { cup: s.cup, wallet: s.wallet, day: s.day, school: s.school, form: s.form, coach: s.coach, stadium: s.stadium, album: s.album };
}

export interface CupFinishCtx {
  /** Время свистка, мс. */
  now: number;
  /** Игровой день `ГГГГ-ММ-ДД`. */
  day: string;
  /** Идентификатор матча (повтор — без второй награды). */
  matchId: string;
  /** Раунд Кубка: `g1`…`g3`, `r16`, `qf`, `sf`, `f`. */
  round: RoundKey;
  /** Платит ли урок (ТЗ-0.2); по умолчанию — да. */
  pays?: boolean;
  /** Урок матча Кубка (`ru.yard.cup-N`) и его ступень: ритм дня (068 Т8); нет — только время печати. */
  rhythm?: Rhythm;
}

/** Факт свистка Кубка — для газеты, праздника и экрана наград; редьюсер из него ничего не делает. */
export type CupFact =
  | { fact: 'round'; round: RoundKey; passed: boolean; series: 'w' | 'l' | null }
  | { fact: 'pack'; round: RoundKey }
  | { fact: 'kit'; id: string }
  | { fact: 'patch' }
  | { fact: 'boots' }
  | { fact: 'stage'; stage: 'open' }
  | { fact: 'title' }
  | { fact: 'silver' };

/** Всё, что показывает итог матча Кубка: экран ничего не считает. */
export interface CupResultView {
  round: RoundKey;
  verdict: Verdict;
  /** Счёт с пенальти (по нему раунд и решается). */
  total: Score;
  /** Раунд засчитан: победа, ничья в группе, победа в серии. */
  passed: boolean;
  /** Серия была: наши и чужие удары, победа в ней. */
  series: { won: boolean; mine: readonly Shot[]; theirs: readonly Shot[] } | null;
  correct: number;
  /** Точность и скорость матча (карточка поражения: «Точность», «Скорость»): доля верных в тысячных и знаков в минуту. */
  acc: number;
  cpm: number;
  coins: number;
  fans: number;
  grew: FormGrowth[];
  /** Пак за раунд положен сейчас (показ — `pendingPack`). */
  pack: boolean;
  /** Призовые формы, полученные сейчас (id из `prizes.json`). */
  kits: string[];
  /** Титул после матча (золото — победа в финале, серебро — первый проигранный финал). */
  title: 'gold' | 'silver' | null;
  /** Повтор после титула: свисток платит, но пака, форм и титула нет (ТЗ-8.13). */
  replay: boolean;
}

/** Печать серии прибавляется к печати матча: серия платит монеты и пишет форму клавиш (ТЗ-3.1). */
function withSeries(result: MatchResult, series: SeriesResult | null): MatchResult {
  if (series === null) return result;
  const a = result.stats;
  const b = series.stats;
  const sum = <K extends string>(x: Readonly<Partial<Record<K, number>>>, y: Readonly<Partial<Record<K, number>>>): Partial<Record<K, number>> => {
    const out: Partial<Record<K, number>> = { ...x };
    for (const k of Object.keys(y) as K[]) out[k] = (out[k] ?? 0) + (y[k] ?? 0);
    return out;
  };
  const stats: TypingStats = {
    correct: a.correct + b.correct,
    errors: a.errors + b.errors,
    keyErrors: sum(a.keyErrors, b.keyErrors),
    fingerErrors: sum(a.fingerErrors, b.fingerErrors),
    startedAt: a.startedAt ?? b.startedAt,
    lastAt: b.lastAt ?? a.lastAt,
    intervals: [...a.intervals, ...b.intervals],
  };
  return { ...result, stats, presses: [...result.presses, ...series.presses] };
}

/** Раздел `cup` после матча: туры группы и плей-офф — по ТЗ-8.5; раунд вне очереди даёт тот же `cup`. */
function record(cup: Cup, round: RoundKey, total: Score, series: SeriesResult | null, day: string): Cup {
  if (round === 'g1' || round === 'g2' || round === 'g3') return recordTour(cup, Number(round.slice(1)), total.me, total.opp);
  return recordKo(cup, round, total.me, total.opp, total.me === total.opp ? (series === null ? null : series.won ? 'w' : 'l') : null, day);
}

/** Раунд засчитан этим матчем: тур группы записан (победа или ничья) либо раунд плей-офф выигран. */
const passedRound = (cup: Cup, round: RoundKey): boolean => (round === 'g1' || round === 'g2' || round === 'g3' ? cup.tours[Number(round.slice(1)) - 1]!.me !== null : cup.ko[round].won);

/**
 * Свисток матча Кубка — звать один раз, после серии. `series` — исход серии при ничьей в плей-офф (`seriesResult`), иначе `null`; ничья плей-офф без серии — как поражение
 * (раунд заново). Звёзд нет, курс не меняется. Награды раунда — один раз: пак за первый засчитанный раунд (ТЗ-5.1, засчитанная ничья группы
 * тоже раунд — 7 паков Двора), «Бирюза» за выход из группы, «белая с красными полосами» за полуфинал, титул — кубок, нашивка, бутсы,
 * две формы и ступень «Открытие»; проигранный финал — серебро (без праздника, 038-Р10).
 */
export function finishCup(save: CupSave, result: MatchResult, series: SeriesResult | null, ctx: CupFinishCtx): { save: CupSave; facts: CupFact[]; view: CupResultView | null } {
  if (isPaid(save.wallet, ctx.matchId)) return { save, facts: [], view: null };
  const pays = ctx.pays ?? true;
  const total = result.total;
  const view: CupResultView = {
    round: ctx.round,
    verdict: result.verdict,
    total,
    passed: false,
    series: total.me === total.opp && series !== null ? series : null,
    correct: 0,
    acc: permille(result.play),
    cpm: charsPerMinute(result.play),
    coins: 0,
    fans: 0,
    grew: [],
    pack: false,
    kits: [],
    title: save.cup.title,
    replay: false,
  };

  const paying = withSeries(result, series);
  // После титула — общий свисток целиком (монеты, болельщики, стадион, «Знаток», день, форма), но паков, призовых форм и титула нет (ТЗ-8.13).
  if (save.cup.title === 'gold') {
    const paid = whistle(save, paying, { now: ctx.now, day: ctx.day, matchId: ctx.matchId, pays, ...(ctx.rhythm === undefined ? {} : { rhythm: ctx.rhythm }) });
    const out: CupSave = { ...paid.save, cup: { ...save.cup, replays: save.cup.replays + 1 } };
    return { save: out, facts: [], view: { ...view, correct: paid.correct, coins: paid.coins, fans: paid.fans, grew: paid.grew, replay: true } };
  }

  const cup = record(save.cup, ctx.round, total, series, ctx.day);
  if (cup === save.cup) return { save, facts: [], view: null };
  const passed = passedRound(cup, ctx.round);
  const paid = whistle(save, paying, { now: ctx.now, day: ctx.day, matchId: ctx.matchId, pays, ...(ctx.rhythm === undefined ? {} : { rhythm: ctx.rhythm }) });
  const facts: CupFact[] = [{ fact: 'round', round: ctx.round, passed, series: view.series === null ? null : view.series.won ? 'w' : 'l' }];
  let album = paid.save.album;
  let next = cup;
  let pack = false;
  if (passed) {
    const claim = claimPack(next, ctx.round);
    next = claim.cup;
    if (claim.first && album.packs < PACKS_YARD) {
      album = credit({ ...paid.save, album }, 'cup-pack', 1).purse.album;
      pack = true;
      facts.push({ fact: 'pack', round: ctx.round });
    }
  }
  const prizes: string[] = [];
  if (ctx.round === 'g3' && passed) prizes.push(PRIZE_GROUP);
  if (ctx.round === 'sf' && passed) prizes.push(PRIZE_SEMI);
  if (next.title === 'gold') prizes.push(...PRIZES_TITLE);
  const granted = grantPrizes(album, prizes);
  album = granted.album;
  for (const id of granted.fresh) facts.push({ fact: 'kit', id });
  if (next.title === 'gold') facts.push({ fact: 'patch' }, { fact: 'boots' }, { fact: 'stage', stage: 'open' }, { fact: 'title' });
  if (next.title === 'silver' && save.cup.title === null) facts.push({ fact: 'silver' });
  const out: CupSave = { ...paid.save, album, cup: next };
  return { save: out, facts, view: { ...view, passed, correct: paid.correct, coins: paid.coins, fans: paid.fans, grew: paid.grew, pack, kits: granted.fresh, title: next.title } };
}

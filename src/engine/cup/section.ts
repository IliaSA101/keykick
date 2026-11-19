/**
 * Раздел сохранения `cup` (068 design §3, формат свободен до выпуска — 060-Р7): засчитанные туры и раунды Кубка, выданные паки, титул.
 * Чужие матчи не хранятся — считаются от семени (хэш id игрока, `seedOf`) и номера тура. Старое сохранение без раздела — `empty()`, миграции нет.
 * Чистые функции: день приходит снаружи. Записи результатов — `recordTour`, `recordKo`, `claimPack`; награды и свисток — задача 068-Т2.
 */
import { badCounters, isDay, isInt, isRecord, type SectionDef } from '../save/section';
import { playedTours, TOURS } from './group';
import { KO_ROUNDS, ROUND_KEYS } from './rounds';
import type { Cup, KoRound, KoState, RoundKey, Tour } from './types';

const emptyTour = (): Tour => ({ me: null, opp: null, tries: 0 });
const emptyKo = (): KoState => ({ tries: 0, won: false, me: null, opp: null, series: null });

export const emptyCup = (): Cup => ({
  tours: [emptyTour(), emptyTour(), emptyTour()],
  ko: { r16: emptyKo(), qf: emptyKo(), sf: emptyKo(), f: emptyKo() },
  first: null,
  packs: [],
  title: null,
  titleDay: null,
  replays: 0,
});

/** Засчитать тур группы `tour` (1…3): победа или ничья — тур записан; поражение — попытка +1, тур снова (ТЗ-8.5). Первый сыгранный матч — и проигранный — пишет счёт в `first`. Тур вне очереди или уже засчитанный — без изменений. */
export function recordTour(cup: Cup, tour: number, me: number, opp: number): Cup {
  const i = tour - 1;
  if (!isInt(tour) || i < 0 || i >= TOURS || i !== playedTours(cup.tours)) return cup;
  const t = cup.tours[i]!;
  const next: Tour = me < opp ? { ...t, tries: t.tries + 1 } : { me, opp, tries: t.tries };
  const tours = cup.tours.map((x, k) => (k === i ? next : x)) as Cup['tours'];
  // счёт первого сыгранного матча Кубка — при любом исходе (заголовок газеты №3, 068-Р19)
  return { ...cup, tours, first: cup.first ?? { me, opp } };
}

/**
 * Засчитать матч плей-офф: победа (больше голов или ничья и выигранная серия) — раунд выигран; иначе попытка +1 («ответный»).
 * Раунд вне очереди (группа не пройдена, прошлый раунд не выигран) — без изменений. Финал: проигрыш при пустом титуле — `silver`,
 * победа — `gold` и `titleDay`; повтор после золота — только `replays + 1` (ТЗ-8.13, К3).
 */
export function recordKo(cup: Cup, round: KoRound, me: number, opp: number, series: 'w' | 'l' | null, day: string): Cup {
  const ri = KO_ROUNDS.indexOf(round);
  if (playedTours(cup.tours) < TOURS || (ri > 0 && !cup.ko[KO_ROUNDS[ri - 1]!].won)) return cup;
  if (round === 'f' && cup.title === 'gold') return { ...cup, replays: cup.replays + 1 };
  if (cup.ko[round].won) return cup;
  const draw = me === opp;
  const won = me > opp || (draw && series === 'w');
  const k = cup.ko[round];
  const state: KoState = { tries: won ? k.tries : k.tries + 1, won, me, opp, series: draw ? series : null };
  const out: Cup = { ...cup, ko: { ...cup.ko, [round]: state } };
  if (round !== 'f') return out;
  if (won) return { ...out, title: 'gold', titleDay: day };
  return cup.title === null ? { ...out, title: 'silver' } : out;
}

/** Пак за первую победу в раунде (ТЗ-5.1): `first` — пак положен сейчас; второй раз за тот же раунд — нет. */
export function claimPack(cup: Cup, round: RoundKey): { cup: Cup; first: boolean } {
  if (cup.packs.includes(round)) return { cup, first: false };
  return { cup: { ...cup, packs: [...cup.packs, round] }, first: true };
}

/** Счёт записи испорчен: `me` и `opp` либо оба `null`, либо оба неотрицательные целые. */
const badScore = (o: Record<string, unknown>): boolean => {
  const n = o.me === null;
  return n !== (o.opp === null) || (!n && (!isInt(o.me) || o.me < 0 || !isInt(o.opp) || o.opp < 0));
};

const badTour = (t: unknown): boolean => !isRecord(t) || badCounters(t, ['tries']).length > 0 || badScore(t);

/** Счёт первого матча: `null` или `{me, opp}` — оба целые неотрицательные. */
const badFirst = (f: unknown): boolean => f !== null && (!isRecord(f) || f.me === null || f.opp === null || badScore(f));

const badKo = (k: unknown): boolean => {
  if (!isRecord(k) || badCounters(k, ['tries']).length > 0 || typeof k.won !== 'boolean') return true;
  if (badScore(k)) return true;
  if (k.series !== null && k.series !== 'w' && k.series !== 'l') return true;
  return k.won && k.me === null;
};

export const cupDef: SectionDef<Cup> = {
  name: 'cup',
  v: 1,
  empty: emptyCup,
  up: {},
  check(d) {
    if (!isRecord(d)) return ['shape'];
    const why: string[] = [];
    const tours = Array.isArray(d.tours) && d.tours.length === TOURS && !d.tours.some(badTour) ? (d.tours as Tour[]) : null;
    if (tours === null) why.push('tours');
    else {
      // тур засчитан или проигран только после засчитанного предыдущего
      if (tours.some((t, i) => (t.me !== null || t.tries > 0) && i > 0 && tours[i - 1]!.me === null)) why.push('tours-order');
      const played = tours[0]!.me !== null || tours[0]!.tries > 0;
      if (badFirst(d.first) || (d.first !== null) !== played) why.push('first');
    }
    if (!isRecord(d.ko) || KO_ROUNDS.some((r) => badKo((d.ko as Record<string, unknown>)[r]))) why.push('ko');
    else {
      const ko = d.ko as Record<KoRound, KoState>;
      if (KO_ROUNDS.some((r, i) => i > 0 && (ko[r].won || ko[r].tries > 0) && !ko[KO_ROUNDS[i - 1]!].won)) why.push('ko-order');
      if (tours !== null && playedTours(tours) < TOURS && KO_ROUNDS.some((r) => ko[r].won || ko[r].tries > 0)) why.push('ko-before-group');
    }
    if (!Array.isArray(d.packs) || d.packs.some((p) => !ROUND_KEYS.includes(p as RoundKey)) || new Set(d.packs).size !== d.packs.length) why.push('packs');
    if (d.title !== null && d.title !== 'gold' && d.title !== 'silver') why.push('title');
    if (d.titleDay !== null && !isDay(d.titleDay)) why.push('titleDay');
    if ((d.titleDay !== null) !== (d.title === 'gold')) why.push('title-day');
    if (isRecord(d.ko)) {
      const f = d.ko.f as KoState | undefined;
      if ((d.title === 'gold') !== (f?.won === true)) why.push('title-gold');
      if (d.title === 'silver' && !((f?.tries ?? 0) > 0)) why.push('title-silver');
    }
    if (!isInt(d.replays) || d.replays < 0) why.push('replays');
    return why;
  },
};

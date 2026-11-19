/**
 * Поставщик Кубка для Дома и Карты (068 Т5, К-А → `HomeInput`): из раздела `cup` и входа дня — раунд главной кнопки,
 * «Кубок наш», серебро и карточка Кубка. Чистая функция: часы, номер дня и семя приходят снаружи. Модель — `engine/cup`,
 * тексты — `ru.cup`; Район в Э1 не строится, поэтому `region` всегда `false` (068-Р8).
 * Раунд на главной кнопке — открытый раунд или переигровка тура группы (`cupRound`); переигровка раунда плей-офф — карточка «ответный матч ждёт»
 * (068-Р26, Э2.16): после проигранного финала (серебро) кнопки нет,
 * финал снова играют из сетки (Э2.89).
 */
import { cupView, TEAMS, type Cup, type CupCtx, type CupView, type KoRound, type RoundKey } from '../../engine/cup';
import type { CupData } from '../../engine/home';
import { fill } from '../home/texts';
import { plural } from '../../i18n/plural';
import { ru } from '../../i18n/ru';

const t = ru.cup.card;
const GROUP: readonly RoundKey[] = ['g1', 'g2', 'g3'];

/** Что Кубок даёт входу Дома: флажок раунда, финал взят, серебро, карточка (`null` — стандартная). */
export interface CupHome {
  round: number | null;
  end: boolean;
  silver: boolean;
  card: CupData | null;
}

/** Улица двора-соперника в родительном падеже («Заречной») по id команды; без соперника — пусто. */
const streetOf = (id: string | null): string => TEAMS.find((x) => x.id === id)?.street ?? '';

/** Наше место (1…4) и очки строкой («4 очка») в нашей группе по таблице вида. */
function groupLine(view: CupView): { place: number; pts: string } {
  const rows = view.groups[view.ours]!.rows;
  const i = rows.findIndex((r) => r.team === 'our');
  const n = rows[i]!.pts;
  return { place: i + 1, pts: `${n} ${plural(n, ru.cup.pointsForms)}` };
}

/** Карточка до матча раунда, который ещё не на главной кнопке (якорь не пройден или день раньше 3-го): строка итога и «что дальше». */
function waitingCard(view: CupView): CupData | null {
  const n = view.next;
  const round = n.round;
  if (round === null || n.flag === null) return null;
  if (n.state === 'later' || n.state === 'day3') return { key: t.later, params: { sub: ru.home.cup.look } };
  const street = streetOf(n.rival);
  if (GROUP.includes(round)) {
    const played = GROUP.indexOf(round);
    if (played === 0) return null;
    const g = groupLine(view);
    return {
      key: fill(t.group, { letter: view.groups[view.ours]!.letter, place: g.place, pts: g.pts }),
      params: { sub: fill(t.sub, { round: fill(t.nextGroup, { n: played + 1 }), street, n: n.flag }) },
    };
  }
  const ko = round as KoRound;
  const key = ko === 'r16' ? fill(t.groupDone, { place: groupLine(view).place }) : t.done[(ko === 'qf' ? 'r16' : ko === 'sf' ? 'qf' : 'sf')];
  return { key, params: { sub: fill(t.sub, { round: ko === 'r16' || ko === 'qf' ? t.next[ko] : (ru.home.flags[n.flag] ?? ''), street, n: n.flag }) } };
}


export function cupHome(cup: Cup, ctx: CupCtx): CupHome {
  const view = cupView(cup, ctx);
  if (cup.title === 'gold') return { round: null, end: true, silver: false, card: null };
  if (cup.title === 'silver') return { round: null, end: false, silver: true, card: { key: t.silver, params: { sub: t.silverSub } } };
  const n = view.next;
  // переигровка раунда плей-офф — из сетки Кубка, флажка на главной кнопке нет (068-Р26, кадр Э2.16)
  if (n.state === 'replay' && n.round !== null && !GROUP.includes(n.round)) {
    return { round: null, end: false, silver: false, card: { key: fill(t.replayKo, { round: ru.home.flags[n.flag ?? 0] ?? '' }), params: { sub: fill(t.replaySub, { street: streetOf(n.rival) }) } } };
  }
  const playable = n.state === 'open' || n.state === 'replay';
  return { round: playable ? n.flag : null, end: false, silver: false, card: playable ? null : waitingCard(view) };
}

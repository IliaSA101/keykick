/**
 * Вид Кубка для экрана и поставщиков Дома, Карты, газеты (контракт К-А, 068 design §3): только ключи и числа, текстов нет.
 * `cupView` — группы, сетка, наш путь, следующий матч; `cupMilestones` — вехи для газеты и комиксов.
 */
import { LETTERS, OUR_GROUP, TOURS, groupTable, groupTeams, playedTours } from './group';
import { bracketOf, koRival } from './bracket';
import { nextMatch, roundStates, cupStage, ROUND_KEYS, anchorOf } from './rounds';
import { isHomeRound } from '../home/yard';
import type { Cup, CupCtx, CupMilestones, CupView, GroupView, PathItem, RoundKey } from './types';

/** Соперник раунда (id команды): тур группы — команда нашей группы по порядку, плей-офф — по сетке. Не требует урока и часов — годится, пока пакет не загружен. */
export function rivalFor(cup: Cup, seed: number, round: RoundKey): string | null {
  if (round === 'g1' || round === 'g2' || round === 'g3') return groupTeams(OUR_GROUP)[1 + ROUND_KEYS.indexOf(round)] ?? null;
  return koRival(cup, seed, round);
}

export function cupView(cup: Cup, ctx: CupCtx): CupView {
  const played = playedTours(cup.tours);
  const lost = cup.tours.findIndex((t) => t.me === null && t.tries > 0) + 1;
  const groups: GroupView[] = LETTERS.map((letter) => ({
    letter,
    our: letter === OUR_GROUP,
    played,
    lost: letter === OUR_GROUP ? lost : 0,
    rows: groupTable(letter, played, cup.tours, ctx.seed),
  }));
  const states = roundStates(cup, ctx);
  const path: PathItem[] = ROUND_KEYS.map((round, i) => ({
    round,
    flag: anchorOf(round),
    rival: rivalFor(cup, ctx.seed, round),
    home: isHomeRound(anchorOf(round)),
    state: states[i]!,
  }));
  return {
    stage: cupStage(cup),
    groups,
    ours: LETTERS.indexOf(OUR_GROUP),
    bracket: bracketOf(cup, ctx.seed),
    path,
    next: nextMatch(cup, ctx, (r) => rivalFor(cup, ctx.seed, r)),
    title: cup.title,
  };
}

/** Вехи Кубка (ТЗ-9.3, story.md §1): первый матч (любой исход — веха и счёт для заголовка), группа пройдена, полуфинал выигран, итог финала. */
export function cupMilestones(cup: Cup): CupMilestones {
  return { first: cup.first !== null, firstScore: cup.first, group: playedTours(cup.tours) === TOURS, semi: cup.ko.sf.won, final: cup.title };
}

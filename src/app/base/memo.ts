/**
 * Мемори формы на экране (067 Т20, кадры Э4.31–33, 49): связь движка `engine/base/games/memo` с кадром — какие формы лежат на картах,
 * клавиши (буквы урока, при нехватке — цифры, ТЗ-7.8), вид формы, «найдено пар», итог партии. Чистые функции: часы, зерно, день и разделы приходят снаружи.
 * Правил здесь нет: пара, не пара и счёт ходов — в движке; рекорд (меньше ходов — лучше) и счётчик дня — `finishFun` через `finishGame`.
 */
import { albumView } from '../../engine/album/award';
import { KIT_IDS } from '../../engine/album/order';
import { albumDef, type Album } from '../../engine/album/section';
import type { Club, ClubKit } from '../../engine/club/section';
import { MEMO_CLUB, type MemoState } from '../../engine/base/games/memo';
import { isLetter } from '../../engine/typing/keymap';
import { lookOf } from '../album/locker';
import { dataOf, finishGame, pressedChar, type FunEnd } from './play';
import type { baseOf } from './run';

type Sections = Parameters<typeof baseOf>[0];

/**
 * Формы на картах (036-Р14): форма клуба первой, дальше формы альбома с выданной футболкой (одна футболка — уже форма, собирать целиком не нужно) — по порядку альбома.
 * Сколько пар взять (не больше 8) решает движок.
 */
export function memoKits(sections: Sections): string[] {
  const album = dataOf<Album>(sections, albumDef);
  return [MEMO_CLUB, ...albumView(album).kits.filter((k) => k.have[0] === true).map((k) => k.id)];
}

/** Клавиша карты: буква или цифра по месту клавиши (`code`) в русской раскладке; служебная и повтор — `null`. */
export const memoChar = (e: Parameters<typeof pressedChar>[0]): string | null => pressedChar(e, (ch) => isLetter(ch) || /^\d$/.test(ch));

/** Вид формы на карте: расцветка для `ShirtView` и подпись; у формы клуба подпись — название клуба. */
export function memoLook(id: string, club: Pick<Club, 'name' | 'kit'>): { kit: ClubKit; name: string } {
  const look = lookOf(id === MEMO_CLUB ? null : id, club.kit);
  return { kit: look.kit, name: look.name ?? club.name };
}

/** «Найдено пар: N из M» — по сложенным картам. */
export const memoPairs = (s: MemoState): { found: number; total: number } => ({ found: s.cards.filter((c) => c.face === 'done').length / 2, total: s.cards.length / 2 });

/**
 * Формы найденных пар (список слева и итог). `order` — порядок форм в наборе (`memoKits`): как в альбоме, форма клуба последней (кадр Э4.33: «Алые, Мандарины, Вишни … Прогресс»);
 * порядок карт на поле случаен и ребёнку ничего не говорит. Без `order` — по порядку карт.
 */
export function memoFound(s: MemoState, order: readonly string[] = []): string[] {
  const ids = [...new Set(s.cards.filter((c) => c.face === 'done').map((c) => c.kit))];
  if (order.length === 0) return ids;
  // формы вне набора (в сохранении их нет, на карте есть) — после набора, по порядку альбома: порядок не зависит от случая
  const full = [...order, ...KIT_IDS];
  const rank = (id: string): number => (id === MEMO_CLUB ? full.length : full.indexOf(id));
  return ids.sort((a, b) => rank(a) - rank(b));
}

/** Открыты две разные карты: «Не пара — карты закроются» (совпавшие сразу складываются, у них `up` пуст). */
export const memoMismatch = (s: MemoState): boolean => s.up.length === 2;

/** Записать итог партии Мемори: счёт — ходы, рекорд — меньше (см. `finishGame`). */
export const finishMemo = (sections: Sections, save: (patch: Record<string, unknown>) => { ok: boolean }, moves: number, run: string, day: string): FunEnd => finishGame('memo', sections, save, moves, run, day);

/** Кадр стенда (только в разработке, фикстура `base.memo`): фаза, партия «замерзла» на нужном ходе и итог — экран не тикает и ничего не пишет. */
export interface MemoStand {
  phase: 'start' | 'play' | 'end';
  /** Раскладка карт и открытые (на итоге — все сложены); на старте — рубашкой вверх. */
  state?: MemoState;
  end?: FunEnd;
}

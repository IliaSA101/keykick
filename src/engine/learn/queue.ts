/**
 * Очередь учебных игр (ТЗ-7.2–7.4, 067 К-Г): что открыто, в каком порядке предлагать в перерыве, две карточки перерыва
 * и список Базы. Чистые функции: день и успехи приходят снаружи (`LearnCtx`).
 */
import cfg from '../../content/learn.json';
import { formsBuildable, isFormsGame } from './forms';
import { RECENT_MAX, type Learn, type LearnGame } from './section';

export interface GameDef {
  id: string;
  /** Урок-запас, с которого игра открыта. */
  lesson: number;
  /** Тур «Школы», с которого игра открыта; `null` — только по уроку. */
  tour: number | null;
  /** Время «золота», секунды. */
  t: number;
  /** Норма игры в минутах (ставка, ТЗ-3.3). */
  norm: number;
}

export const GAMES: readonly GameDef[] = cfg.games;

/** Факты игрока, от которых зависит очередь: берёт вызывающий из `course` и `school`. */
export interface LearnCtx {
  /** Время, мс. */
  now: number;
  /** Игровой день. */
  day: string;
  /** Номер самого дальнего пройденного урока лиги (0 — ни одного). */
  lesson: number;
  /** Номер последнего пройденного тура «Школы» (0 — ни одного). */
  tour: number;
  /** Скорость (зн/мин) последних доигранных матчей, старые первыми. Источник — журнал матчей (`engine/journal`), только доигранные матчи текущей лиги (ТЗ-3.3, 10.9); считает Т17. */
  speeds: readonly number[];
  /** Выученные буквы (нижний регистр). От них зависит «Пары» (раунд «палец ↔ клавиши»): без них очередь не знает, собирается ли игра. */
  learned: readonly string[];
}

export const NO_GAME: LearnGame = { step: 0, plays: 0, best: null, last: null };

export const gameOf = (learn: Learn, id: string): LearnGame => learn.games[id] ?? NO_GAME;

/** ТЗ-7.2: тренажёр входит по туру или уроку-запасу, что раньше. */
export const isOpen = (g: GameDef, ctx: Pick<LearnCtx, 'lesson' | 'tour'>): boolean => ctx.lesson >= g.lesson || (g.tour !== null && ctx.tour >= g.tour);

/** Игру есть из чего собрать (общий предикат со стартом игры, `formsBuildable`): «Пары» без четырёх пальцев с выученными буквами не предлагаем. */
export const isBuildable = (g: GameDef, ctx: Pick<LearnCtx, 'learned'>): boolean =>
  !isFormsGame(g.id) || formsBuildable(g.id, ctx.learned);

export const isGold = (learn: Learn, id: string): boolean => gameOf(learn, id).step === 3;

/** Раньше меньше сыгранная, при равенстве — давно не игранная (без даты — раньше всех), при равенстве — по порядку каталога. */
function byTurn(learn: Learn): (a: GameDef, b: GameDef) => number {
  return (a, b) => {
    const x = gameOf(learn, a.id);
    const y = gameOf(learn, b.id);
    if (x.plays !== y.plays) return x.plays - y.plays;
    const dx = x.last ?? '';
    const dy = y.last ?? '';
    if (dx !== dy) return dx < dy ? -1 : 1;
    return GAMES.indexOf(a) - GAMES.indexOf(b);
  };
}

/**
 * Очередь перерыва (ТЗ-7.3): открытые и собираемые не-«золотые»; новая — в первый же перерыв; без трёх последних, если есть другие;
 * дальше по `byTurn`. «Золотая» из очереди перерыва уходит.
 */
export function queue(learn: Learn, ctx: LearnCtx): string[] {
  const open = GAMES.filter((g) => isOpen(g, ctx) && isBuildable(g, ctx) && !isGold(learn, g.id));
  const fresh = open.filter((g) => gameOf(learn, g.id).plays === 0);
  const played = open.filter((g) => gameOf(learn, g.id).plays > 0);
  const recent = learn.recent.slice(-RECENT_MAX);
  const fit = played.filter((g) => !recent.includes(g.id));
  // хвост из трёх последних: раньше сыгранная — первой, только что сыгранная — последней
  const tail = played.filter((g) => !fit.includes(g)).sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id));
  const sort = (xs: GameDef[]): GameDef[] => [...xs].sort(byTurn(learn));
  return [...sort(fresh), ...sort(fit), ...tail].map((g) => g.id);
}

/** Карточка перерыва: игра (тренажёр помечен «к «Школе»») или «побей рекорд» «золотой» игры (0 монет). */
export type Card = { kind: 'game'; id: string; toSchool: boolean } | { kind: 'record'; id: string; best: number | null };

/** «Золотые» открытые игры для «побей рекорд»: давно не игранная первой. */
function recordCards(learn: Learn, ctx: LearnCtx): Card[] {
  return GAMES.filter((g) => isOpen(g, ctx) && isBuildable(g, ctx) && isGold(learn, g.id))
    .sort(byTurn(learn))
    .map((g) => ({ kind: 'record', id: g.id, best: gameOf(learn, g.id).best }));
}

/**
 * Карточки перерыва (ТЗ-7.4): первые две по очереди; не-«золотых» меньше двух — недостающие «побей рекорд» (У-З4: «золотая»
 * не при двух и более не-«золотых»); все на «золоте» — две разные «побей рекорд» (067-Р201, макет Э4.19: две золотые игры по
 * очереди), золотая одна — одна карточка; ничего не открыто — пусто (сразу тайм).
 */
export function breakCards(learn: Learn, ctx: LearnCtx): Card[] {
  const cards: Card[] = queue(learn, ctx)
    .slice(0, 2)
    .map((id) => ({ kind: 'game', id, toSchool: (GAMES.find((g) => g.id === id)?.tour ?? null) !== null }));
  return [...cards, ...recordCards(learn, ctx).slice(0, 2 - cards.length)];
}

export interface BaseItem {
  id: string;
  open: boolean;
  step: number;
  best: number | null;
  plays: number;
  /** Открыта и ещё не играна: метка «новое». */
  isNew: boolean;
}

/** Список игр для Базы (ТЗ-7.1): все по порядку каталога, «золотые» тоже — на них рекорд. */
export function baseList(learn: Learn, ctx: LearnCtx): BaseItem[] {
  return GAMES.map((g) => {
    const s = gameOf(learn, g.id);
    const open = isOpen(g, ctx) && isBuildable(g, ctx);
    return { id: g.id, open, step: s.step, best: s.best, plays: s.plays, isNew: open && s.plays === 0 };
  });
}

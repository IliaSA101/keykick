/**
 * Вход в учебную игру из перерыва матча (067 Т17, этап 6; временная кнопка — заменит `LearnCard` Т18): что открыто по текущему уроку
 * и очереди, откуда окно берёт разделы игрока. Чистые функции: разделы, статус сеанса, часы и семя приходят снаружи.
 * Сеанс не `ok` (другая вкладка, новее версия, сбой) — входа нет: монеты записать было бы некуда (как `useGoMatch.canPlay`).
 */
import { ruCourseDef } from '../../engine/course/section';
import { stadiumDef } from '../../engine/home/section';
import { ownEntries, type JournalEntry } from '../../engine/journal';
import type { LearnSave } from '../../engine/learn/finish';
import { breakCards, queue, type LearnCtx } from '../../engine/learn/queue';
import { learnDef } from '../../engine/learn/section';
import type { Step } from '../../engine/learn/steps';
import { schoolDef } from '../../engine/school/section';
import type { SaveResult, Status } from '../save/session';
import { walletOf } from '../save/sections';
import { learnCtxOf, openLearn, type CommitDeps, type LearnFlow } from './run';
import { beforeOf, stakeOf } from './view';

type Sections = Readonly<Record<string, { data: unknown } | undefined>> | undefined;

const sec = <T,>(sections: Sections, def: { name: string; empty(): T }): T => (sections?.[def.name]?.data as T | undefined) ?? def.empty();

/** Разделы игрока для записи итога: игры, кошелёк, школа, стадион (как `matchRead` у матча). */
export function learnRead(sections: Sections): LearnSave {
  return { learn: sec(sections, learnDef), wallet: walletOf(sections), school: sec(sections, schoolDef), stadium: sec(sections, stadiumDef) };
}

/**
 * Зависимости записи итога (067-Р112): `save` сеанса, отказ которого не теряется — статус ложится в `fail` (сеанс не `ok` — он сам;
 * отказ `invalid` приходит со статусом `ok` и списком причин — для ребёнка это «не получается сохранить», `quota`).
 */
export function commitDeps(sections: () => Sections, save: (patch: Record<string, unknown>) => SaveResult, fail: (s: Status) => void): CommitDeps {
  return {
    read: () => learnRead(sections()),
    save: (patch) => {
      const res = save(patch);
      if (!res.ok) fail(res.status === 'ok' ? 'quota' : res.status);
      return res;
    },
  };
}

/** Журнал матчей для ставки: он один на устройство, берутся записи только игрока сеанса; сеанс не `ok` — пусто. */
export function breakJournal(all: readonly JournalEntry[], player: { kind: string; pid?: string }): JournalEntry[] {
  return player.kind === 'ok' && player.pid !== undefined ? ownEntries(all, player.pid) : [];
}

/** Что известно сейчас: урок матча, выученные буквы урока, журнал матчей и время. */
export interface EntryFacts {
  lesson: number;
  keys: string;
  entries: readonly JournalEntry[];
  now: number;
  day: string;
}

export function breakCtx(sections: Sections, f: EntryFacts): LearnCtx {
  const bests = Object.values(sec(sections, ruCourseDef).lessons).map((l) => l.best);
  return learnCtxOf({ ...f, school: sec(sections, schoolDef), bests });
}

/** Игры, которые перерыв предлагает сейчас: очередь ТЗ-7.3, что окно Т17 умеет играть. Сеанс не `ok` — пусто. */
export function breakGames(sections: Sections, ok: boolean, f: EntryFacts): string[] {
  if (!ok) return [];
  const ctx = breakCtx(sections, f);
  return queue(sec(sections, learnDef), ctx).filter((id) => openLearn(id, 'break', ctx, 0) !== null);
}

/** Всё, что окну нужно на старте и что не должно меняться, пока оно идёт: запись итога сдвинет раздел, а «до игры» и ставка — прежние. */
export interface BreakEntry {
  flow: LearnFlow;
  before: { step: Step; best: number | null };
  stake: number;
  /** Следующая игра очереди после этой (для «Ещё игра»); `null` — других нет. */
  nextId: string | null;
}

/**
 * Открыть игру перерыва: `game` — из `next` или первая очереди. `null` — входа нет (сеанс не `ok`, игры нет ни в очереди, ни среди карточек перерыва — в том числе «побей рекорд»).
 * `again` — «Ещё раз» ту же игру: она может быть уже на золоте (из очереди ушла), тогда «до игры» и ставка пересчитываются по свежим разделам (ставка 0).
 */
export function enterBreak(sections: Sections, ok: boolean, f: EntryFacts, seed: number, game?: string, again = false): BreakEntry | null {
  const games = breakGames(sections, ok, f);
  const ctx = breakCtx(sections, f);
  // карточка «побей рекорд» (ТЗ-7.3: золотой игры в очереди нет, ставка 0) тоже вход: её id берётся из карточек перерыва
  const shown = ok ? breakCards(sec(sections, learnDef), ctx).map((c) => c.id) : [];
  const id = game === undefined ? games[0] : games.includes(game) || shown.includes(game) || (again && ok) ? game : undefined;
  if (id === undefined) return null;
  const flow = openLearn(id, 'break', ctx, seed);
  if (flow === null) return null;
  const learn = sec(sections, learnDef);
  return { flow, before: beforeOf(learn, id), stake: stakeOf(ctx, learn, id), nextId: games.find((g) => g !== id) ?? null };
}

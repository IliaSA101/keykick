/**
 * Учебная игра окном над Базой (067 Т19): состояние Vue и проводка сеанса; выбор и правила — `run.ts` (чистые функции).
 * Запись итога — `commitLearn` внутри окна через `deps`; отказ записи ложится в `fail` (статус сеанса), экран говорит причину.
 */
import { ref, shallowRef, type Ref } from 'vue';
import type { JournalEntry } from '../../engine/journal';
import { matchJournal } from '../journal/app';
import { breakJournal, commitDeps, type EntryFacts } from '../learn/entry';
import type { Status, useSession } from '../save/session';
import { enterBase, type BaseEntry } from './run';

type Session = ReturnType<typeof useSession>;

export interface BaseFacts {
  /** Урок ребёнка сейчас и его выученные буквы; `null` — пакет ещё не загружен. */
  lesson: () => { n: number; keys: string } | null;
  now: () => number;
  day: () => string;
  /** Разделы игрока сейчас (сеанс не `ok` — `undefined`) и можно ли писать (статус `ok`). */
  sections: () => Record<string, { data: unknown } | undefined> | undefined;
  ok: () => boolean;
}

export function useBase(session: Session, facts: BaseFacts) {
  const entry = shallowRef<BaseEntry | null>(null);
  const fail: Ref<Status | null> = ref(null);
  let opening = false;


  /** Открыть игру окном; двойной щелчок и вход без `ok` (или в закрытую игру) — холостые. Журнал матчей читается каждый раз: ставка — по свежим скоростям. */
  async function open(game: string): Promise<void> {
    const l = facts.lesson();
    if (opening || l === null) return;
    opening = true;
    try {
      const entries: JournalEntry[] = breakJournal(await matchJournal().all(), session.player.value);
      const f: EntryFacts = { lesson: l.n, keys: l.keys, entries, now: facts.now(), day: facts.day() };
      fail.value = null;
      entry.value = enterBase(facts.sections(), facts.ok(), f, facts.now() % 2147483647, game);
    } finally {
      opening = false;
    }
  }

  return {
    entry,
    fail,
    open,
    close: () => {
      entry.value = null;
    },
    /** «Ещё раз» из итога: та же игра по свежим разделам («до игры» и ставка пересчитаны). */
    again: () => {
      const e = entry.value;
      return e === null ? Promise.resolve() : open(e.flow.game);
    },
    deps: commitDeps(facts.sections, (patch) => session.save(patch), (s) => {
      fail.value = s;
    }),
  };
}

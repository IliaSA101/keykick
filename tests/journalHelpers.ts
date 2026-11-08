// Общая подготовка тестов журнала игры (018-Т4): журнал на памяти, события, образцы записей.
import type { JournalBackend } from '../src/app/journal/backend';
import { createJournal, type JournalDeps } from '../src/app/journal/journal';
import { memoryBackend } from '../src/app/journal/memory';
import type { JournalRecord } from '../src/engine/journal/records';


export function mk(over: Partial<JournalDeps> & { backend?: JournalBackend; constNow?: number } = {}) {
  const backend = over.backend ?? memoryBackend();
  const told: string[] = [];
  let now = 1_000_000;
  const j = createJournal({
    open: () => Promise.resolve(backend),
    now: () => over.constNow ?? now++,
    app: 'test',
    tab: 'aaaa',
    onStorage: (x) => told.push(x),
    ...over,
  });
  return { j, backend, told };
}
export const ids = async (b: JournalBackend, player?: string) => ((await b.all('records', player)) as JournalRecord[]).map((r) => r.id);
export const mdata = (outcome: string, at = 1) => ({ lesson: 'a1', league: 'L1', n: 1, attempt: 1, outcome, at });
export const keysOf = (n: number) => ({ typed: 'a'.repeat(n), expected: 'a'.repeat(n), dt: Array.from({ length: n }, () => 150) });

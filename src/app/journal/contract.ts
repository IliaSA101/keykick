/**
 * Контрактный набор бэкенда журнала (спека 018 design §5, В6): без vitest — гоняется и в тесте (на памяти),
 * и в браузере кнопкой на `#/dev/frames` (на IndexedDB). Каждый случай берёт чистый бэкенд из `make`.
 */
import type { JournalBackend } from './backend';
import { idbBackend, openIdb } from './idb';

export interface ContractResult {
  name: string;
  ok: boolean;
  detail: string;
}

const rec = (id: string, player: string, t: number, extra: object = {}): object => ({ id, player, t, ...extra });
const kl = (match: string, player: string, t: number): object => ({ match, player, t, typed: 'ab', expected: 'ab', dt: [1, 2] });

function expect(cond: boolean, detail: string): void {
  if (!cond) throw new Error(detail);
}
const ids = (xs: object[]): string => xs.map((x) => (x as { id: string }).id).join(',');

const CASES: Array<[string, (b: JournalBackend) => Promise<void>]> = [
  [
    'empty',
    async (b) => {
      expect((await b.all('records')).length === 0 && (await b.all('keys', 'p1')).length === 0, 'all is not empty');
      expect((await b.list('records', 'p1')).length === 0, 'list is not empty');
    },
  ],
  [
    'put-all',
    async (b) => {
      await b.put('records', [rec('a', 'p1', 1), rec('b', 'p1', 2)]);
      await b.put('keys', [kl('m1', 'p1', 1)]);
      expect(ids(await b.all('records')) === 'a,b', `records: ${ids(await b.all('records'))}`);
      expect((await b.all('keys')).length === 1, 'keys: record is missing');
    },
  ],
  [
    'overwrite',
    async (b) => {
      await b.put('records', [rec('a', 'p1', 1, { v: 1 })]);
      await b.put('records', [rec('a', 'p1', 1, { v: 2 })]);
      const all = (await b.all('records')) as Array<{ v: number }>;
      expect(all.length === 1 && all[0]?.v === 2, `after overwrite: ${JSON.stringify(all)}`);
    },
  ],
  [
    'all-player',
    async (b) => {
      await b.put('records', [rec('a', 'p1', 1), rec('b', 'p2', 2), rec('c', 'p1', 3)]);
      expect(ids(await b.all('records', 'p1')) === 'a,c' || ids(await b.all('records', 'p1')) === 'c,a', 'not only p1');
      expect((await b.all('records', 'p3')).length === 0, 'other player is not empty');
    },
  ],
  [
    'list-order',
    async (b) => {
      await b.put('keys', [kl('m3', 'p1', 30), kl('m1', 'p1', 10), kl('x', 'p2', 5), kl('m2', 'p1', 20)]);
      const got = (await b.list('keys', 'p1')).map((e) => `${e.key}:${e.t}`).join(',');
      expect(got === 'm1:10,m2:20,m3:30', `list: ${got}`);
    },
  ],
  [
    'remove-missing',
    async (b) => {
      await b.put('keys', [kl('m1', 'p1', 1), kl('m2', 'p1', 2)]);
      await b.remove('keys', ['missing', 'm1']);
      await b.remove('keys', []);
      expect((await b.list('keys', 'p1')).map((e) => e.key).join(',') === 'm2', 'after remove');
    },
  ],
  [
    'put-300',
    async (b) => {
      await b.put('records', Array.from({ length: 300 }, (_, i) => rec(`r${i}`, 'p1', i)));
      expect((await b.all('records', 'p1')).length === 300, 'not all 300');
    },
  ],
  [
    'copy-on-put',
    async (b) => {
      const o = rec('a', 'p1', 1, { n: { v: 1 } }) as { n: { v: number } };
      await b.put('records', [o]);
      o.n.v = 99;
      const got = (await b.all('records')) as Array<{ n: { v: number } }>;
      expect(got[0]?.n.v === 1, 'value was changed');
    },
  ],
];

/** Прогнать набор: на каждый случай — свежий бэкенд из `make`. Не бросает. */
export async function backendContract(make: () => Promise<JournalBackend>): Promise<ContractResult[]> {
  const out: ContractResult[] = [];
  for (const [name, fn] of CASES) {
    try {
      const b = await make();
      try {
        await fn(b);
      } finally {
        b.close();
      }
      out.push({ name, ok: true, detail: '' });
    } catch (e) {
      out.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}

/** Только браузер (В6): второе открытие версией 2 не висит на `blocked` — первое соединение закрылось по `versionchange`. */
async function versionChangeCase(name: string): Promise<ContractResult> {
  const label = 'versionchange';
  await deleteDb(name);
  try {
    const first = await openIdb(name, 1);
    const second = await openIdb(name, 2);
    second.close();
    first.close();
    return { name: label, ok: true, detail: '' };
  } catch (e) {
    return { name: label, ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Кнопка «Проверить журнал»: набор на IndexedDB во временной базе `<base>.check`, затем база удаляется. */
export async function checkIdb(base: string): Promise<ContractResult[]> {
  const name = `${base}.check`;
  const results: ContractResult[] = [];
  try {
    results.push(
      ...(await backendContract(async () => {
        await deleteDb(name);
        return idbBackend(await openIdb(name));
      })),
    );
    results.push(await versionChangeCase(name));
  } catch (e) {
    results.push({ name: 'open', ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
  await deleteDb(name);
  return results;
}

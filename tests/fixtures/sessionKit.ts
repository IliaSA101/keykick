/**
 * Подготовка для тестов сеанса (063-Р5): две «вкладки» одного браузера и сеанс с одним игроком. Общая у `session.test.ts` и `sessionBin.test.ts`.
 */
import { expect } from 'vitest';
import { createSession } from '../../src/app/save/session';
import { createKeyValue } from '../../src/app/save/storage';
import { createStore } from '../../src/app/save/store';
import { FOREIGN, MemStorage, P, fakeLocks } from './storageKit';

/** Две «вкладки» одного браузера: общее `localStorage` и замки, своё `sessionStorage`. */
export function browser() {
  const mem = new MemStorage();
  for (const [k, v] of Object.entries(FOREIGN)) mem.map.set(k, v);
  const locks = fakeLocks();
  let n = 0;
  const tab = () => {
    const store = createStore({ prefix: P, local: createKeyValue(mem), session: createKeyValue(new MemStorage()), locks });
    return { store, session: createSession({ store, newPid: () => `p${++n}` }) };
  };
  return { mem, tab };
}

export async function withClub(name = 'Метеор') {
  const b = browser();
  const t = b.tab();
  await t.session.init();
  const made = await t.session.create({ name: 'Саша' });
  if (!made.ok) throw new Error('create');
  expect(t.session.save({ club: { ...(t.session.player.value as { env: { sections: Record<string, { data: object }> } }).env.sections.club!.data, name } })).toEqual({ ok: true });
  return { ...b, ...t, pid: made.pid };
}

export interface Disk {
  rev: number;
  players: { pid: string; order: number }[];
  sections: Record<string, { data: Record<string, unknown> }>;
}
export const disk = (mem: MemStorage, key: string): Disk => JSON.parse(mem.map.get(`${P}${key}`) ?? '{}') as Disk;
export const rev = (mem: MemStorage, pid: string): number => disk(mem, `player.${pid}`).rev;

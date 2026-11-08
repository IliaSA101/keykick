/**
 * Общая подготовка тестов игроков через обёртку app/ (tests/players-app, tests/players-tabs): хранилище в памяти
 * с перечислением ключей, загрузка модулей поверх него и чтение клуба/монет игрока.
 */
import { vi } from 'vitest';
import { section as clubSection } from '../src/engine/club/save';
import { section as walletSection } from '../src/engine/wallet/save';

/** Хранилище в памяти с перечислением ключей; failKey — запись этого ключа бросает (переполнение). */
export function fakeStorage(initial: Record<string, string> = {}, failKey = '') {
  let failOn = failKey;
  const data = new Map(Object.entries(initial));
  return {
    data,
    /** Дальше запись этого ключа бросает; '' — снова пишется. */
    failOn: (k: string) => void (failOn = k),
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (k === failOn) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
}

export const T0 = 1_800_000_000_000;

export async function boot(local: ReturnType<typeof fakeStorage>, tab = fakeStorage()) {
  vi.stubGlobal('localStorage', local);
  vi.stubGlobal('sessionStorage', tab);
  const players = await import('../src/app/players/list');
  const active = await import('../src/app/players/active');
  const shared = await import('../src/app/players/shared');
  const roster = await import('../src/app/roster');
  const sections = await import('../src/app/save/sections');
  return { ...players, ...active, ...shared, ...roster, ...sections };
}

/** Клуб v2 и монеты игроку вкладки — разделами через слой. */
export function setClub(p: Awaited<ReturnType<typeof boot>>, name: string, coins = 0): void {
  p.updatePlayer((tx) => {
    tx.set(clubSection, { ...clubSection.sample(), name });
    tx.set(walletSection, { ...walletSection.empty({}), coins });
  });
}
export const clubOf = (p: Awaited<ReturnType<typeof boot>>): string => p.readSection(clubSection).name;
export const coinsOf = (p: Awaited<ReturnType<typeof boot>>): number => p.readSection(walletSection).coins;
export const clubAt = (s: ReturnType<typeof fakeStorage>, key: string): string => (json(s, key) as { sections: { club: { name: string } } }).sections.club.name;

export const json = (s: ReturnType<typeof fakeStorage>, key: string) => JSON.parse(s.data.get(key) ?? 'null') as unknown;

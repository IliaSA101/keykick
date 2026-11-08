/**
 * Фикстуры для кадров (только dev-сборка, спека 015): `?seed=<имя>` в адресе кладёт в хранилище готовые
 * игроки и сохранения, после чего адрес очищается. Грузится из dev/boot.ts ДО app/players:
 * тот читает список игроков при загрузке модуля. Хранилище трогаем только через app/storage.
 * `?seed=` стирает данные игроков этого origin: использовать на отдельном порту (стенд кадров — 5291).
 */
import {
  LEGACY_KEY,
  PLAYERS_KEY,
  SHARED_KEY,
  removeKey,
  saveKey,
  savedPlayerIds,
  writeJson,
  writeTabPlayer,
} from '../app/storage';
import { APP_VERSION } from '../app/version';
import { nextEnvelope } from '../engine/save/format';
import { dev } from '../i18n/ru/dev';
import { applyV2Seed, isV2Seed, sampleClub, V2_SEEDS } from './seed2';

export const SEEDS = ['fresh', 'mid', 'two', ...V2_SEEDS] as const;
export type SeedName = (typeof SEEDS)[number];

function isSeed(v: string | null): v is SeedName {
  return v !== null && (SEEDS as readonly string[]).includes(v);
}

/** Чистое хранилище: ни игроков, ни сохранений, ни выбора вкладки. */
function wipe(): void {
  removeKey(LEGACY_KEY);
  removeKey(PLAYERS_KEY);
  removeKey(SHARED_KEY);
  for (const id of savedPlayerIds()) removeKey(saveKey(id));
  writeTabPlayer(null);
}

function fixture(name: SeedName): void {
  wipe();
  if (isV2Seed(name)) return applyV2Seed(name);
  if (name === 'fresh') return;
  // `mid` — игрок на середине курса: то же, что `v2-mid` (клуб, курс, кошелёк, ожидающий 2-й тайм).
  applyV2Seed('v2-mid');
  if (name === 'mid') return;
  // two: игроков двое, выбора вкладки нет — приложение спросит «Кто играет?». Второй — с клубом и чистым курсом.
  const [first, second] = dev.seed.players;
  writeJson(saveKey('p2'), nextEnvelope({ rev: 0 }, { club: sampleClub() }, APP_VERSION));
  writeJson(PLAYERS_KEY, {
    players: [
      { id: 'p1', name: first },
      { id: 'p2', name: second },
    ],
    current: 'p1',
    lastId: 2,
  });
}

/** Применяет `?seed=` из адреса и убирает его; неизвестное имя — ничего не трогает. */
export function applySeed(search: string): void {
  const name = new URLSearchParams(search).get('seed');
  if (!isSeed(name)) return;
  fixture(name);
  const url = new URL(globalThis.location.href);
  url.searchParams.delete('seed');
  globalThis.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

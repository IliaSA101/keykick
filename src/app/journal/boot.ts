/**
 * Подключение журнала игры к приложению (спека 018-Т4): база `dbName(PREFIX)`, приёмник `tx.log`, сеанс,
 * крючки файла выгрузки. Зовётся из `main.ts` до монтирования. Режим `v1` (ключи сына) — ничего: ни базы, ни слушателей.
 */
import type { Router } from 'vue-router';
import { activeId } from '../players/active';
import { logEvent } from '../save/eventLog';
import { saveStore } from '../save/instance';
import { setBackupJournal } from '../save/backup';
import { pendingJournal, setJournalSink } from '../save/sections';
import { APP_VERSION } from '../version';
import { dbName, PREFIX } from '../versions/build';
import { idbBackend, openIdb } from './idb';
import { createJournal, type Journal, type KeysInput } from './journal';
import { startSession } from './session';

let journal: Journal | null = null;

/** Журнал этой вкладки; `null` — режим `v1` или ещё не запущен. */
export function currentJournal(): Journal | null {
  return journal;
}

/**
 * Нажатия матча в журнал (спека 018-Р24): `k.match` — id матча (у записи `match` тот же), после «Продолжить» — `<id>.2` (017-Р39); игрок — закреплённый
 * за матчем. Журнал не запущен (`v1`) или хранилище только для чтения — ничего не пишем. Подключает матч 017-Т8.
 */
export function logMatchKeys(player: string, k: KeysInput): void {
  if (journal === null || saveStore.status().readOnly) return;
  journal.logKeys(player, k);
}

/** Постоянное хранение: просить, только если ещё не дано (`persisted()`, затем `persist()`). */
function askPersist(): Promise<unknown> {
  const s = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (!s?.persist) return Promise.resolve(false);
  return s.persisted().then((p) => p || s.persist());
}

/** `mode` — режим хранилища (в тесте задаётся; в приложении — `saveStore.mode`): в `v1` ни базы, ни слушателей. */
export function startJournal(router: Router, mode: string = saveStore.mode): void {
  if (journal !== null || mode !== 'envelope') return;
  const tab = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  const j = createJournal({
    open: async () => idbBackend(await openIdb(dbName(PREFIX))),
    now: () => Date.now(),
    app: APP_VERSION,
    tab,
    onStorage: (text) => logEvent('storage', text),
    persist: askPersist,
  });
  journal = j;
  setJournalSink((recs, player) => j.log(recs, player));
  for (const p of pendingJournal()) j.log([p.rec], p.player);
  // Журнал в файл читается по требованию (design §5: ≈ 10 МБ нажатий в памяти не держим); `dump` ждёт не больше 3 с.
  setBackupJournal({
    dump: (player) => j.dump(player),
    merge: (file, players) => j.importFile(file, players),
  });
  startSession({
    journal: j,
    now: () => Date.now(),
    tab,
    player: activeId,
    route: () => router.currentRoute.value.name,
    hidden: () => document.visibilityState === 'hidden',
    onRoute: (cb) => router.afterEach((to) => cb(to.name)),
    onHidden: (cb) => listen(document, 'visibilitychange', () => document.visibilityState === 'hidden', cb),
    onVisible: (cb) => listen(document, 'visibilitychange', () => document.visibilityState === 'visible', cb),
    onPageHide: (cb) => listen(window, 'pagehide', () => true, cb),
  });
}

/** Подписка на событие с условием; возвращает отписку. */
function listen(target: EventTarget, type: string, when: () => boolean, cb: () => void): () => void {
  const handler = (): void => {
    if (when()) cb();
  };
  target.addEventListener(type, handler);
  return () => target.removeEventListener(type, handler);
}

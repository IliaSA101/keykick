/**
 * Журнал матчей для приложения (065-Т3б, Р30 «б»): один ленивый экземпляр на вкладку.
 * База — из `storage.ts` (имя зависит от мажора и канала, как ключи); отказ уходит в журнал событий сбоя без окна.
 */
import { APP_VERSION } from '../../engine/save/envelope';
import { crash } from '../crash/boot';
import { browserIdb, journalDbName } from '../save/storage';
import { channelOf } from '../save/session';
import { createJournal, lazyDb, openIdb, type Journal } from '.';

let shared: Journal | undefined;

/** Общий журнал матчей. Экран матча зовёт `void matchJournal().put(matchId, { seed, events })` после `finishMatch`. */
export function matchJournal(): Journal {
  shared ??= createJournal({
    db: lazyDb(() => openIdb(browserIdb(), journalDbName(Number(APP_VERSION.split('.')[0]), channelOf(import.meta.env.BASE_URL)))),
    now: () => Date.now(),
    onFail: (err) => crash.note('journal', err),
  });
  return shared;
}

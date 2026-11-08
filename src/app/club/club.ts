/**
 * Клуб v2 в приложении (спека 019, design §2, Р2, Р11, Р12): чтение раздела `club` и три писателя —
 * создать, править, отметить «Что нового». Каждый пишет одной `updatePlayer`; из `tx.get` строится новое значение,
 * поэтому вторая вкладка не затирается (018-Р23). Правила — чистые функции `engine/club/create`.
 * Писатели-транзакции (`*Tx`) принимают `tx` — их зовёт тест на двух вкладках; обёртки привязаны к игроку.
 */
import coachJson from '../../content/coach.json';
import { createClub, editClub, emptyClub, hasClub, markNewsSeen as markSeen, type ClubDraft, type ClubFields } from '../../engine/club/create';
import { section } from '../../engine/club/save';
import { defaultCoach, parseCoachData } from '../../engine/coach/coach';
import type { SectionTx } from '../../engine/save/section';
import { saveStore } from '../save/instance';
import { canWrite, readSection, sectionRef, updatePlayer } from '../save/sections';
import { APP_VERSION } from '../version';

export const coachData = parseCoachData(coachJson);

/** Раздел `club` для показа, реактивно (после записи, смены игрока и чужой записи). */
export const clubRef = sectionRef(section);

export interface CreateResult {
  /** Клуб, который лежит у игрока после записи (при `blocked` — лежащий, возможно «пустой»: `createdAt = 0`). */
  club: ClubFields;
  /** Эта запись создала клуб. Ложь — клуб уже лежал (создала другая вкладка) или писать не удалось (`blocked`). */
  created: boolean;
  /** Записи не было: сохранение только для чтения, игрока нет или он удалён в другой вкладке. Клуб не создан. */
  blocked: boolean;
}

export interface CreateOptions {
  /** Время создания; по умолчанию — часы страницы. */
  now?: number;
  /** Игрок, закреплённый при входе на `/start`; по умолчанию — текущий. */
  player?: string;
}

/**
 * Черновик с экрана — реактивный (Proxy Vue): слой записи клонирует раздел `structuredClone`, а он Proxy не берёт
 * (DataCloneError на «Готово», браузер 08.11). В транзакцию — простая копия.
 */
const plain = (d: ClubDraft): ClubDraft => JSON.parse(JSON.stringify(d)) as ClubDraft;

/** Транзакция «создать»: лежащий клуб (`createdAt > 0`) не трогается. */
export function createClubTx(tx: SectionTx, draft: ClubDraft, o: { now: number; coach: string; version: string }): CreateResult {
  const cur = tx.get(section) as ClubFields;
  const next = createClub(cur, plain(draft), o);
  if (next === cur) return { club: cur, created: false, blocked: false };
  tx.set(section, next);
  return { club: next, created: true, blocked: false };
}

/** Транзакция «править»: три поля (название, форма, город) поверх лежащего. */
export function editClubTx(tx: SectionTx, patch: ClubDraft): ClubFields {
  const next = editClub(tx.get(section), plain(patch));
  tx.set(section, next);
  return next;
}

/** Транзакция «Что нового увидено»: версия не идёт назад. */
export function markNewsSeenTx(tx: SectionTx, version: string): ClubFields {
  const next = markSeen(tx.get(section), version);
  tx.set(section, next);
  return next;
}

/**
 * «Готово» на слое: `update` пишет одной транзакцией, `lying` читает клуб игрока из памяти после неё.
 * Слой при `readOnly` и при удалённом игроке считает `fn` вхолостую, поэтому «создано» берётся из того, что
 * действительно лежит у игрока, а не из результата `fn` и не из проверки до записи.
 */
export function createClubOn(
  update: <R>(fn: (tx: SectionTx) => R) => R,
  lying: () => ClubFields,
  draft: ClubDraft,
  o: { now: number; coach: string; version: string },
): CreateResult {
  const res = update((tx) => createClubTx(tx, draft, o));
  const now = lying();
  if (res.created && !hasClub(now)) return { club: now, created: false, blocked: true };
  return res;
}

/**
 * «Готово» на первом запуске: одна запись всего клуба. Тренер — по умолчанию из `coach.json`,
 * `newsSeen` — текущая версия. Если записи не вышло (только чтение, игрока нет) — `blocked: true`, клуб не создан.
 */
export function createClubNow(draft: ClubDraft, opts: CreateOptions = {}): CreateResult {
  const o = { now: opts.now ?? Date.now(), coach: defaultCoach(coachData).id, version: APP_VERSION };
  const { player } = opts;
  // Игрока нет или сохранение только для чтения: писать нечего (закреплённый игрок проверяется итогом записи).
  if (player === undefined && !canWrite()) return { club: readSection(section), created: false, blocked: true };
  return createClubOn(
    (fn) => updatePlayer(fn, player === undefined ? undefined : { player }),
    () => (player === undefined ? readSection(section) : ((saveStore.memory(player)?.club as ClubFields | undefined) ?? emptyClub())),
    draft,
    o,
  );
}

/** Правка клуба из карты («Исправить»): название, форма, город. */
export function editClubNow(patch: ClubDraft): ClubFields {
  return updatePlayer((tx) => editClubTx(tx, patch));
}

/** Отметить, что «Что нового» до версии `version` увидено (по умолчанию — текущая). */
export function markNewsSeenNow(version: string = APP_VERSION): ClubFields {
  return updatePlayer((tx) => markNewsSeenTx(tx, version));
}

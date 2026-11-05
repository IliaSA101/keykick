/**
 * Игроки на одном компьютере (docs/design.md, 04.11, «несколько игроков»): список, имена
 * и план первого запуска — перенос старого сохранения одного игрока. Без localStorage —
 * его читает и пишет src/app/players.ts по плану отсюда.
 *
 * Разбор списка не теряет сохранений: битое имя заменяется запасным, а не выкидывает игрока;
 * список пропал или пуст — собирается заново из ключей сохранений, найденных в хранилище.
 */
import { parseSave } from './save';
import { emptyShared, parseShared, type SharedSession } from './session';

export const PLAYERS_MAX = 4;
export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 12;

export interface Player {
  /** «p1», «p2»…: часть ключа сохранения, поэтому строго такого вида. */
  id: string;
  name: string;
}

export interface PlayersData {
  players: Player[];
  /** Последний выбранный игрок; null — игроков нет. */
  current: string | null;
  /**
   * Самый большой номер id, когда-либо выданный (и удалённым игрокам). Новый id — больше него:
   * иначе вкладка, где ещё играет удалённый, писала бы в сохранение нового с тем же id.
   */
  lastId: number;
}

export type PlayerNameError = 'short' | 'long' | 'chars' | 'spaces' | 'taken';

const PLAYER_ID = /^p([1-9][0-9]{0,5})$/;
// Буквы кириллицы (с Ё) и латиницы, цифры, пробел, дефис — как имя на спине, но с цифрами
// («Игрок 2»). Кириллица — кодами: страж tests/guards.test.ts.
const NAME_CHARS = /^[0-9a-zA-Z\u0410-\u044f\u0401\u0451 -]+$/;
const HAS_LETTER = /[a-zA-Z\u0410-\u044f\u0401\u0451]/;

/** Запасное имя игрока по номеру: текст — у app-слоя (ru.ts), движок текстов не знает. */
export type FallbackName = (n: number) => string;

const ID_MAX = 999_999;

export function isPlayerId(v: unknown): v is string {
  return typeof v === 'string' && PLAYER_ID.test(v);
}

/** Номер в id: «p12» → 12; не id — 0. */
function idNumber(id: string): number {
  const m = PLAYER_ID.exec(id);
  return m ? Number(m[1]) : 0;
}

/** Для сравнения имён: без регистра, Ё = Е («Алёна» и «алена» — одно имя). */
function plainName(name: string): string {
  return name.toLowerCase().replaceAll('\u0451', '\u0435');
}

/**
 * Имя игрока: 2–12 знаков, буквы, цифры, пробел и дефис, хотя бы одна буква; не как у другого
 * игрока (кроме exceptId — при переименовании своё имя не мешает).
 */
export function checkPlayerName(
  raw: string,
  players: readonly Player[] = [],
  exceptId: string | null = null,
): { ok: true; name: string } | { ok: false; error: PlayerNameError } {
  const name = raw.trim();
  if (name.length < PLAYER_NAME_MIN) return { ok: false, error: 'short' };
  if (name.length > PLAYER_NAME_MAX) return { ok: false, error: 'long' };
  if (!NAME_CHARS.test(name) || !HAS_LETTER.test(name)) return { ok: false, error: 'chars' };
  if (name.includes('  ')) return { ok: false, error: 'spaces' };
  if (players.some((p) => p.id !== exceptId && plainName(p.name) === plainName(name))) {
    return { ok: false, error: 'taken' };
  }
  return { ok: true, name };
}

/** Порядковый номер для запасного имени: свободный «Игрок N», начиная с номера места в списке. */
function freeFallback(players: readonly Player[], from: number, fallback: FallbackName): string {
  for (let n = from; ; n++) {
    const name = fallback(n);
    if (!players.some((p) => plainName(p.name) === plainName(name))) return name;
  }
}

/**
 * Список игроков. Мусор — пусто; повтор id — первый; битое имя — запасное; больше PLAYERS_MAX —
 * первые; current не из списка — первый игрок. Список пуст, а в хранилище есть сохранения
 * игроков (savedIds) — список собирается из них заново с запасными именами.
 */
export function parsePlayers(raw: unknown, fallback: FallbackName, savedIds: readonly string[] = []): PlayersData {
  const r = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const players: Player[] = [];
  const items: unknown[] = Array.isArray(r.players) ? r.players : [];
  for (const item of items) {
    if (players.length >= PLAYERS_MAX) break;
    if (item === null || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    if (!isPlayerId(p.id) || players.some((x) => x.id === p.id)) continue;
    const check = typeof p.name === 'string' ? checkPlayerName(p.name, players) : null;
    const name = check?.ok ? check.name : freeFallback(players, players.length + 1, fallback);
    players.push({ id: p.id, name });
  }
  if (players.length === 0) {
    const ids = [...new Set(savedIds.filter(isPlayerId))].sort((a, b) => idNumber(a) - idNumber(b));
    for (const id of ids.slice(0, PLAYERS_MAX)) {
      players.push({ id, name: freeFallback(players, players.length + 1, fallback) });
    }
  }
  const current = players.find((p) => p.id === r.current)?.id ?? players[0]?.id ?? null;
  const saved = typeof r.lastId === 'number' && Number.isInteger(r.lastId) ? Math.min(ID_MAX, Math.max(0, r.lastId)) : 0;
  const lastId = Math.max(saved, ...players.map((p) => idNumber(p.id)), ...savedIds.map(idNumber));
  return { players, current, lastId };
}

/** Свободный id: больше всех выданных — удалённый игрок не делит ключ с новым. */
export function nextPlayerId(data: PlayersData): string {
  return `p${Math.min(ID_MAX, Math.max(data.lastId, ...data.players.map((p) => idNumber(p.id))) + 1)}`;
}

/** Новый игрок — в конец списка и сразу выбран. Список полон или имя не годится — null. */
export function addPlayer(data: PlayersData, rawName: string): { data: PlayersData; id: string } | null {
  if (data.players.length >= PLAYERS_MAX) return null;
  const check = checkPlayerName(rawName, data.players);
  if (!check.ok) return null;
  const id = nextPlayerId(data);
  if (data.players.some((p) => p.id === id)) return null;
  const players = [...data.players, { id, name: check.name }];
  return { data: { players, current: id, lastId: idNumber(id) }, id };
}

/** Удалить игрока. Последнего не удалить (для него — сброс прогресса): игрок есть всегда. */
export function removePlayer(data: PlayersData, id: string): PlayersData {
  if (data.players.length <= 1 || !data.players.some((p) => p.id === id)) return data;
  const players = data.players.filter((p) => p.id !== id);
  const current = data.current === id ? (players[0]?.id ?? null) : data.current;
  return { players, current, lastId: data.lastId };
}

/** Новое имя; не годится — список как был. */
export function renamePlayer(data: PlayersData, id: string, rawName: string): PlayersData {
  const check = checkPlayerName(rawName, data.players, id);
  if (!check.ok || !data.players.some((p) => p.id === id)) return data;
  return { ...data, players: data.players.map((p) => (p.id === id ? { id, name: check.name } : p)) };
}

/** Выбрать игрока; не из списка — список как был. */
export function selectPlayer(data: PlayersData, id: string): PlayersData {
  return data.players.some((p) => p.id === id) && data.current !== id ? { ...data, current: id } : data;
}

/**
 * Кто играет в этой вкладке: выбранный в ней (tabId), если он ещё есть в списке; иначе при одном
 * игроке — он, а при двух и больше — null: нужен экран «Кто играет?».
 */
export function tabPlayer(data: PlayersData, tabId: string | null): string | null {
  if (tabId !== null && data.players.some((p) => p.id === tabId)) return tabId;
  return data.players.length === 1 ? (data.players[0]?.id ?? null) : null;
}

/** Что лежит в хранилище при запуске. undefined — ключа нет (не путать с битым значением). */
export interface StartInput {
  list: unknown;
  /** Старое сохранение одного игрока ('keykick.save'), уже из JSON. */
  legacy: unknown;
  shared: unknown;
  /** id игроков, чьи сохранения есть в хранилище. */
  savedIds: readonly string[];
}

/** Что сделать при запуске; app-слой пишет по порядку полей и удаляет старый ключ последним. */
export interface StartPlan {
  data: PlayersData;
  /** Старое сохранение — в ключ этого игрока как есть (формат его читает); потом удалить старый ключ. */
  moveLegacyTo: string | null;
  /** Общую часть записать: её не было. null — уже есть. */
  shared: SharedSession | null;
  /** Список записать: его не было, или он был починен. */
  writeList: boolean;
}

/**
 * План первого запуска и починки. Есть список — по нему (старое сохранение уже перенесено,
 * не трогаем). Списка нет, есть старое сохранение — оно первый игрок с именем со спины формы
 * (или запасным); общая часть — из него же. Нет ничего — первый игрок с чистым сохранением.
 */
export function planStart(input: StartInput, fallback: FallbackName): StartPlan {
  const sharedPlan = (from: unknown): SharedSession | null =>
    input.shared === undefined ? (from === undefined ? emptyShared() : parseShared(from)) : null;
  if (input.list !== undefined) {
    const data = parsePlayers(input.list, fallback, input.savedIds);
    if (data.players.length > 0) {
      const same = JSON.stringify(data) === JSON.stringify(input.list);
      return { data, moveLegacyTo: null, shared: sharedPlan(undefined), writeList: !same };
    }
  }
  if (input.legacy !== undefined) {
    const shirt = parseSave(input.legacy).club?.shirtName;
    const check = shirt === undefined ? null : checkPlayerName(shirt);
    const player = { id: 'p1', name: check?.ok ? check.name : fallback(1) };
    return {
      data: { players: [player], current: player.id, lastId: 1 },
      moveLegacyTo: player.id,
      shared: sharedPlan(input.legacy),
      writeList: true,
    };
  }
  const rebuilt = parsePlayers(null, fallback, input.savedIds);
  if (rebuilt.players.length > 0) {
    return { data: rebuilt, moveLegacyTo: null, shared: sharedPlan(undefined), writeList: true };
  }
  const player = { id: 'p1', name: fallback(1) };
  return {
    data: { players: [player], current: player.id, lastId: 1 },
    moveLegacyTo: null,
    shared: sharedPlan(undefined),
    writeList: true,
  };
}

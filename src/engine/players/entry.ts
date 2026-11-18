/**
 * Охрана входа (063 design §1, «Модель приложения»; 063-Р27): куда вести вкладку по состоянию устройства, игрока и пакета.
 * Чистая функция: хранилища, роутера и часов нет — всё приходит в `EntryInput`. Роутер (Т4) вызывает её на каждый
 * переход и после каждого изменения сеанса и выполняет ответ.
 *
 * Правила по порядку:
 * 1. `crash` — поверх всего: экран «что-то сломалось».
 * 1а. `phone` (сенсорный экран без клавиатуры, окно уже 1024; `engine/phone/rule.ts`, 059-В7) — «Открой на компьютере» до всего,
 *     в том числе до `#/parent`: родитель без клавиатуры работать не будет (063-Р60). Сохранения охрана не читает (`device`
 *     не нужен), а `#/phone` на компьютере ведёт домой.
 * 2. `#/parent` — всегда (родителю нужен вход при любом состоянии сохранения; З3: ссылки на него с экранов игры нет — это роутер/меню).
 * 3. Устройство: `newer`/`broken` — экран «позови взрослого» (игроков не знаем); `absent`/`denied` и пустой список — `#/start`.
 * 4. Вкладка без игрока (`tabPid` пуст или не из списка): один игрок — выбрать его (`choose`), больше — `#/who`.
 *    `#/start` и `#/who` — входные адреса: на них остаёмся, пока устройство годно.
 * 5. Игрок `broken` — «позови взрослого»; `newer` и `busy` — вход есть, запись закрыта (плашку рисует экран по `status`, З1).
 * 6. Пакет не `ok` — экран ошибки пакета (`loading` — ожидание), не пустой Дом.
 * З2 (Дом без игрока) закрыт правилами 3–4; З5 (значения ключей `keykick.*` v1 не читаются) — `app/players/v1.ts`.
 */

/** Игроков на устройстве не больше (063-Р11, 059-В10: четвёртый — последний). */
export const MAX_PLAYERS = 4;

export type DeviceKind = 'absent' | 'ok' | 'broken' | 'newer' | 'denied';
export type PlayerKind = 'none' | 'ok' | 'busy' | 'newer' | 'broken';
export type PackKind = 'loading' | 'ok' | 'offline' | 'forbidden' | 'bad' | 'shell-old';

export interface EntryInput {
  device: DeviceKind;
  /** Pid игроков из записи устройства (при `device !== 'ok'` — пусто). */
  players: readonly string[];
  /** Игрок этой вкладки (`sessionStorage`); пусто — вкладка ещё не выбирала. */
  tabPid: string | undefined;
  /** Состояние загруженного игрока вкладки. */
  player: PlayerKind;
  pack: PackKind;
  /** Адрес вида `#/home`, `#/parent?tab=x`; пустой — как `#/`. */
  route: string;
  crash: boolean;
  /** Телефон или планшет без клавиатуры (`isPhone`); не задан — компьютер. */
  phone?: boolean;
}

export type Entry =
  | { kind: 'stay' }
  | { kind: 'go'; to: string }
  /** Выбрать единственного игрока (`session.choose(pid)`) и спросить снова. */
  | { kind: 'choose'; pid: string }
  | { kind: 'crash' }
  /** «Позови взрослого»: сохранение устройства или игрока не открылось. */
  | { kind: 'help'; why: 'device-broken' | 'device-newer' | 'player-broken' }
  | { kind: 'pack'; state: Exclude<PackKind, 'ok'> };

/** Адреса, которым не нужны ни игрок, ни пакет. */
export const START = '#/start';
export const WHO = '#/who';
export const PARENT = '#/parent';
export const HOME = '#/home';
/** «Открой на компьютере» (059-В7): единственный адрес телефона и планшета без клавиатуры. */
export const PHONE = '#/phone';

/** Путь без параметров: `#/parent?tab=x` → `#/parent`. */
function pathOf(route: string): string {
  const cut = route.indexOf('?');
  return cut < 0 ? route : route.slice(0, cut);
}

/** Адрес страницы родителя (`#/parent`, `#/parent?tab=x`): вкладка только смотрит, игрока не берёт (063-Р59). */
export const isParentRoute = (route: string): boolean => {
  const p = pathOf(route);
  return p === PARENT || p.startsWith(`${PARENT}/`);
};

export function enter(input: EntryInput): Entry {
  const path = pathOf(input.route);
  if (input.crash) return { kind: 'crash' };
  if (input.phone === true) return path === PHONE ? { kind: 'stay' } : { kind: 'go', to: PHONE };
  if (path === PHONE) return { kind: 'go', to: HOME };
  if (isParentRoute(input.route)) return { kind: 'stay' };

  if (input.device === 'newer') return { kind: 'help', why: 'device-newer' };
  if (input.device === 'broken') return { kind: 'help', why: 'device-broken' };
  if (input.device === 'absent' || input.device === 'denied' || input.players.length === 0) {
    return path === START ? { kind: 'stay' } : { kind: 'go', to: START };
  }

  // Вкладка без игрока. Pid не из списка (удалён, чужой `sessionStorage`) — как пустой.
  const tab = input.tabPid !== undefined && input.players.includes(input.tabPid) ? input.tabPid : undefined;
  if (tab === undefined) {
    if (path === START || path === WHO) return { kind: 'stay' };
    if (input.players.length === 1) return { kind: 'choose', pid: input.players[0]! };
    return { kind: 'go', to: WHO };
  }
  if (path === START || path === WHO) return { kind: 'stay' };
  if (input.player === 'none') return { kind: 'choose', pid: tab };
  if (input.player === 'broken') return { kind: 'help', why: 'player-broken' };

  if (input.pack !== 'ok') return { kind: 'pack', state: input.pack };
  return path === '' || path === '#' || path === '#/' ? { kind: 'go', to: HOME } : { kind: 'stay' };
}

/**
 * Охрана входа (063 design §1–2, К9): чистая функция `enter`; значения ключей v1 не читаются (З5). У каждого теста строка «Ловит:».
 */
import { describe, expect, it, vi } from 'vitest';
import { hasV1Keys } from '../../src/app/players/v1';
import { createKeyValue } from '../../src/app/save/storage';
import { enter, type EntryInput } from '../../src/engine/players/entry';
import { MemStorage } from '../fixtures/storageKit';

const base = (over: Partial<EntryInput> = {}): EntryInput => ({
  device: 'ok',
  players: ['a'],
  tabPid: 'a',
  player: 'ok',
  pack: 'ok',
  route: '#/home',
  crash: false,
  ...over,
});

describe('охрана входа (К9)', () => {
  it('К9: устройства нет (первый вход, стёрто Safari) — на #/start; на нём же — остаёмся', () => {
    // Ловит: первый вход попадает в пустой Дом (З2) или зацикливается на #/start.
    expect(enter(base({ device: 'absent', players: [], tabPid: undefined, player: 'none' }))).toEqual({ kind: 'go', to: '#/start' });
    expect(enter(base({ device: 'absent', players: [], tabPid: undefined, player: 'none', route: '#/start' }))).toEqual({ kind: 'stay' });
    expect(enter(base({ device: 'denied', players: [], tabPid: undefined, player: 'none' }))).toEqual({ kind: 'go', to: '#/start' });
    expect(enter(base({ players: [], tabPid: undefined, player: 'none' }))).toEqual({ kind: 'go', to: '#/start' });
  });

  it('К9: двое игроков и вкладка без выбора — #/who; один игрок — выбрать его; pid не из списка — как пустой', () => {
    // Ловит: ребёнок попадает в чужой клуб без вопроса «Кто играет?» (ТЗ-12.10); `tabPid` удалённого игрока ведёт в никуда.
    const two = { players: ['a', 'b'], tabPid: undefined, player: 'none' as const };
    expect(enter(base(two))).toEqual({ kind: 'go', to: '#/who' });
    expect(enter(base({ ...two, route: '#/who' }))).toEqual({ kind: 'stay' });
    expect(enter(base({ ...two, tabPid: 'zzz' }))).toEqual({ kind: 'go', to: '#/who' });
    expect(enter(base({ tabPid: undefined, player: 'none' }))).toEqual({ kind: 'choose', pid: 'a' });
    expect(enter(base({ ...two, tabPid: 'b' }))).toEqual({ kind: 'choose', pid: 'b' });
    expect(enter(base({ players: ['a', 'b'], tabPid: 'b' }))).toEqual({ kind: 'stay' });
  });

  it('К9: #/parent — всегда, при любом состоянии сохранения и пакета', () => {
    // Ловит: родитель не может открыть страницу выгрузки, когда сохранение битое/новее/пустое (тогда она нужнее всего).
    for (const device of ['absent', 'broken', 'newer', 'denied', 'ok'] as const) {
      expect(enter(base({ device, route: '#/parent', pack: 'offline', player: 'none', tabPid: undefined }))).toEqual({ kind: 'stay' });
    }
    expect(enter(base({ device: 'broken', route: '#/parent?tab=file' }))).toEqual({ kind: 'stay' });
  });

  it('К9: crash — поверх всего, даже поверх #/parent', () => {
    // Ловит: «что-то сломалось» прячется за экраном, который сам сломан.
    expect(enter(base({ crash: true }))).toEqual({ kind: 'crash' });
    expect(enter(base({ crash: true, route: '#/parent' }))).toEqual({ kind: 'crash' });
  });

  it('К9: устройство broken/newer и игрок broken — «позови взрослого»; newer и busy у игрока — вход есть', () => {
    // Ловит: битый клуб открывается как пустой (затирание) или newer-игрок выгнан вместо просмотра (063-Р15, Р16).
    expect(enter(base({ device: 'broken', players: [], tabPid: undefined, player: 'none' }))).toEqual({ kind: 'help', why: 'device-broken' });
    expect(enter(base({ device: 'newer', players: [], tabPid: undefined, player: 'none' }))).toEqual({ kind: 'help', why: 'device-newer' });
    expect(enter(base({ player: 'broken' }))).toEqual({ kind: 'help', why: 'player-broken' });
    expect(enter(base({ player: 'newer' }))).toEqual({ kind: 'stay' });
    expect(enter(base({ player: 'busy' }))).toEqual({ kind: 'stay' });
  });

  it('К9: пакет не ok — экран ошибки пакета, не пустой Дом; на #/start и #/who пакет не нужен', () => {
    // Ловит: без сети Дом рисуется пустым; первый запуск ждёт пакет, которого ему не нужно.
    for (const pack of ['loading', 'offline', 'forbidden', 'bad', 'shell-old'] as const) {
      expect(enter(base({ pack }))).toEqual({ kind: 'pack', state: pack });
    }
    expect(enter(base({ pack: 'offline', route: '#/who', players: ['a', 'b'] }))).toEqual({ kind: 'stay' });
    expect(enter(base({ pack: 'offline', device: 'absent', players: [], tabPid: undefined, player: 'none', route: '#/start' }))).toEqual({ kind: 'stay' });
  });

  it('К9: пустой адрес при готовом игроке ведёт в Дом', () => {
    // Ловит: вход по голому адресу сайта оставляет пустую страницу.
    expect(enter(base({ route: '' }))).toEqual({ kind: 'go', to: '#/home' });
    expect(enter(base({ route: '#/' }))).toEqual({ kind: 'go', to: '#/home' });
  });
});

describe('«Открой на компьютере» в охране входа (К14, 059-В7)', () => {
  it('К14: телефон — на #/phone с любого адреса, раньше родителя и первого запуска; сбой — впереди телефона', () => {
    // Ловит: ребёнок с телефона попадает в #/start или на Дом, родитель — на #/parent без клавиатуры; окно сбоя прячется за заглушкой.
    for (const route of ['#/home', '#/start', '#/who', '#/parent', '#/parent?tab=x', '#/match', '']) {
      expect(enter(base({ phone: true, route })), route).toEqual({ kind: 'go', to: '#/phone' });
    }
    expect(enter(base({ phone: true, device: 'absent', players: [], tabPid: undefined, player: 'none', route: '#/home' }))).toEqual({ kind: 'go', to: '#/phone' });
    expect(enter(base({ phone: true, device: 'newer', route: '#/home' }))).toEqual({ kind: 'go', to: '#/phone' });
    expect(enter(base({ phone: true, route: '#/phone' }))).toEqual({ kind: 'stay' });
    expect(enter(base({ phone: true, crash: true }))).toEqual({ kind: 'crash' });
  });

  it('К14: на компьютере #/phone ведёт домой (планшет повернули, подключили клавиатуру), остальные адреса — как были', () => {
    // Ловит: застрявшая на экране «Открой на компьютере» вкладка после того, как устройство стало компьютером.
    expect(enter(base({ route: '#/phone' }))).toEqual({ kind: 'go', to: '#/home' });
    expect(enter(base({ phone: false, route: '#/phone' }))).toEqual({ kind: 'go', to: '#/home' });
    expect(enter(base({ phone: false, route: '#/home' }))).toEqual({ kind: 'stay' });
    expect(enter(base({ route: '#/parent' }))).toEqual({ kind: 'stay' });
  });
});

describe('ключи v1 (К9, З5)', () => {
  it('К9: следы v1 ищутся по именам ключей `keykick.*`; значения не читаются, ключи v2 не в счёт', () => {
    // Ловит: загрузка читает значение v1-ключа (импорт v1 запрещён 059-В2) или принимает `keykick2.*` за v1.
    const mem = new MemStorage();
    const kv = createKeyValue(mem);
    const read = vi.spyOn(kv, 'read');
    const getItem = vi.spyOn(mem, 'getItem');
    expect(hasV1Keys(kv)).toBe(false);
    mem.map.set('keykick2.device', '{}');
    mem.map.set('keykick2-next.player.a', '{}');
    expect(hasV1Keys(kv)).toBe(false);
    mem.map.set('keykick.save', '{"v1":1}');
    expect(hasV1Keys(kv)).toBe(true);
    expect(read).not.toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    mem.failRead = true;
    expect(hasV1Keys(kv)).toBe(true);
  });
});

/**
 * Хранилище сохранения, часть 2 (060 Т6): карантин, кольцо копий, переполнение квоты, корзина, случайные
 * последовательности. Оснастка — tests/fixtures/storageKit.ts. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { serializePlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { createRandom, pick, randomInt } from '../../src/engine/random';
import { COPIES_LIMIT, newDevice, type Store } from '../../src/app/save/store';
import { withPlayer, withoutPlayer } from '../../src/engine/save/device';
import { P, clubV2, foreignIntact, key, player, seed, setup, stored } from '../fixtures/storageKit';

// --- Новее, битое, карантин, копии -----------------------------------------------------------------------------

describe('newer, broken: только чтение; broken — ещё и карантин (≤ 3 на игрока)', () => {
  it('newer: сырое цело, карантина нет (копия не нужна), запись — readonly', () => {
    // Ловит: игрок новее программы открывается для записи — сохранение портится старым кодом; или «новее» плодит карантин.

    const { store, mem } = setup();
    const raw = JSON.stringify({
      ...player(),
      sections: { club: { v: 9, data: { stars: 1 } } },
    });
    mem.map.set(key(), raw);
    expect(store.loadPlayer('p1')).toEqual({
      kind: 'newer',
      raw,
      section: 'club',
    });
    expect([...mem.map.keys()].filter((k) => k.includes('quarantine') && k.startsWith(P))).toEqual([]);
    expect(stored(mem)).toBe(raw);
    expect(store.savePlayer('p1', player(), 0)).toEqual({
      ok: false,
      err: 'readonly',
    });
    foreignIntact(mem);
  });

  it('broken: сырое в карантин, повторная загрузка того же не плодит копий; игрок недоступен для записи', () => {
    // Ловит: каждая загрузка битого пишет ещё одну копию — карантин забит одним и тем же.
    const { store, mem } = setup();
    const raw = JSON.stringify({
      ...player(),
      sections: { club: { v: 1, data: { stars: 'x' } } },
    });
    mem.map.set(key(), raw);
    const first = store.loadPlayer('p1');
    expect(first).toMatchObject({
      kind: 'broken',
      raw,
      why: ['section:club:stars'],
      sections: ['club'],
      quarantined: true,
    });
    store.loadPlayer('p1');
    expect([...mem.map.keys()].filter((k) => k.startsWith(`${P}quarantine`))).toEqual([`${P}quarantine.p1.1`]);
    expect(store.savePlayer('p1', player(), 0)).toEqual({
      ok: false,
      err: 'readonly',
    });
    expect(stored(mem)).toBe(raw);
  });

  it('четыре разных битых — в карантине три новейших', () => {
    // Ловит: карантин растёт без предела и съедает квоту.
    const { store, mem } = setup();
    for (const n of [1, 2, 3, 4]) {
      mem.map.set(key(), `мусор ${n}`);
      store.loadPlayer('p1');
    }
    const q = (n: number) => mem.map.get(`${P}quarantine.p1.${n}`);
    expect([q(1), q(2), q(3), q(4)]).toEqual(['мусор 4', 'мусор 3', 'мусор 2', undefined]);
  });

  it('после починки игрок снова записываем', () => {
    // Ловит: пометка «только чтение» остаётся после того, как родитель вернул годный конверт.
    const { store, mem } = setup();
    mem.map.set(key(), 'мусор');
    store.loadPlayer('p1');
    const env = player();
    mem.map.set(key(), serializePlayer(env));
    expect(store.loadPlayer('p1').kind).toBe('ok');
    expect(store.savePlayer('p1', writePlayer(env, { club: { stars: 2 } }), 0)).toEqual({ ok: true });
  });
});

describe('кольцо копий c1…c3 перед миграцией', () => {
  const v1 = (stars: number) => serializePlayer({ ...player('p1', stars), rev: stars });

  it('сырое до миграции — в c1, основной ключ не тронут; без миграции копий нет', () => {
    // Ловит: миграция меняет сохранение, а прежнего байта нигде нет — откат на старую версию невозможен.
    const { open, mem } = setup();
    const raw = v1(1);
    mem.map.set(key(), raw);
    const res = open([clubV2]).loadPlayer('p1');
    expect(res).toMatchObject({ kind: 'ok', changed: true, backup: true });
    expect(mem.map.get(`${key()}.c1`)).toBe(raw);
    expect(stored(mem)).toBe(raw);
    expect(open().loadPlayer('p1')).toMatchObject({
      kind: 'ok',
      changed: false,
    });
  });

  it('сдвиг c1→c2→c3, четвёртая вытесняет старшую, повтор того же сырого не сдвигает', () => {
    // Ловит: кольцо не сдвигается (копии затираются) или сдвигается на каждой загрузке (три одинаковые копии).
    const { open, mem } = setup();
    const store = open([clubV2]);
    for (const n of [1, 2, 3, 4]) {
      mem.map.set(key(), v1(n));
      store.loadPlayer('p1');
      store.loadPlayer('p1');
    }
    expect([1, 2, 3].map((n) => mem.map.get(`${key()}.c${n}`))).toEqual([v1(4), v1(3), v1(2)]);
    expect(mem.map.has(`${key()}.c4`)).toBe(false);
  });

  it('квота при загрузке (backup:false): первая запись снова пробует копию; не вышло — quota, сырое цело', () => {
    // Ловит: загрузка не смогла сделать копию, запись всё равно идёт — исходного сохранения нет ни в одном ключе.
    const { open, mem } = setup();
    const raw = v1(1);
    mem.map.set(key(), raw);
    const store = open([clubV2]);
    const used = [...mem.map].reduce((s, [k, v]) => s + k.length + v.length, 0);
    const probe = setup();
    probe.mem.map.set(key(), raw);
    const opened = probe.open([clubV2]).loadPlayer('p1'); // отдельный стенд: здесь копия не должна появиться
    if (opened.kind !== 'ok') throw new Error('игрок не открылся');
    const grown = writePlayer(opened.env, { club: { stars: 1, tag: '' } });
    // Места хватает ровно на саму запись (она чуть длиннее прежней), но не на копию сырого.
    mem.capacity = used + serializePlayer(grown).length - raw.length + 3;
    const res = store.loadPlayer('p1');
    expect(res).toMatchObject({ kind: 'ok', changed: true, backup: false });
    if (res.kind !== 'ok') return;
    expect(mem.map.has(`${key()}.c1`)).toBe(false);
    const before = mem.snapshot();
    expect(store.savePlayer('p1', grown, res.env.rev)).toEqual({
      ok: false,
      err: 'quota',
    });
    expect(mem.snapshot()).toEqual(before);
    expect(stored(mem)).toBe(raw);
    // Место появилось: копия делается перед записью, исходное — в c1 байт в байт.
    mem.capacity = Infinity;
    expect(store.savePlayer('p1', grown, res.env.rev)).toEqual({ ok: true });
    expect(mem.map.get(`${key()}.c1`)).toBe(raw);
    expect(stored(mem)).toBe(serializePlayer(grown));
  });

  it('копию сделать нельзя (квота) — backup:false, игрок всё равно открывается', () => {
    // Ловит: нехватка места на копии не даёт открыть игрока, или об этом не сказано вызывающему.
    const { open, mem } = setup();
    const raw = v1(1);
    mem.map.set(key(), raw);
    mem.capacity = [...mem.map].reduce((s, [k, v]) => s + k.length + v.length, 0);
    const res = open([clubV2]).loadPlayer('p1');
    expect(res).toMatchObject({ kind: 'ok', changed: true, backup: false });
    expect(stored(mem)).toBe(raw);
  });

  it('потолок копий устройства: сначала уходят c3 и c2 других игроков, чужие префиксы целы', () => {
    // Ловит: копии растут без предела (до 5 МиБ квоты) или обрезка считает и стирает ключи чужих префиксов.
    const { open, mem } = setup();
    const big = 'x'.repeat(Math.floor(COPIES_LIMIT / 3));
    mem.map.set(`${P}player.p2.c1`, big);
    mem.map.set(`${P}player.p2.c2`, big);
    mem.map.set(`${P}player.p2.c3`, big);
    const raw = v1(1);
    mem.map.set(key(), raw);
    open([clubV2]).loadPlayer('p1');
    expect(mem.map.has(`${P}player.p2.c3`)).toBe(false);
    expect(mem.map.get(`${P}player.p2.c1`)).toBe(big);
    expect(mem.map.get(`${key()}.c1`)).toBe(raw);
    foreignIntact(mem);
  });

  it('игрок с pid c1, c2, c3 — не копия: обрезка по потолку его основной ключ не стирает', () => {
    // Ловит: регулярка копии `\\.c[1-3]$` принимает `player.c3` за копию и стирает основной ключ живого игрока.
    for (const pid of ['c1', 'c2', 'c3']) {
      const { open, mem } = setup();
      const own = serializePlayer(player(pid, 1));
      mem.map.set(key(pid), own); // раньше чужих копий: при ничьей по рангу его обрезка увидела бы первым
      mem.map.set(`${P}player.p2.c3`, 'x'.repeat(COPIES_LIMIT));
      mem.map.set(key(), v1(1));
      open([clubV2]).loadPlayer('p1');
      expect(mem.map.has(`${P}player.p2.c3`)).toBe(false); // обрезка сработала
      expect(mem.map.get(key(pid))).toBe(own);
      foreignIntact(mem);
    }
  });

  it('обрезка дошла до c1 других игроков, а своя c1 цела', () => {
    // Ловит: потолок съедает свежую копию текущего игрока, когда чужие c2 и c3 уже не помогают.
    const { open, mem } = setup();
    mem.map.set(`${key()}.c1`, 'старая'); // ключ раньше чужих: при ничьей по рангу свою обрезка увидела бы первой
    const pad = 'x'.repeat(Math.floor(COPIES_LIMIT / 4));
    mem.map.set(`${P}player.p2.c3`, pad);
    mem.map.set(`${P}player.p2.c2`, pad);
    const bigC1 = 'y'.repeat(COPIES_LIMIT - 1000);
    mem.map.set(`${P}player.p2.c1`, bigC1);
    const raw = serializePlayer({
      ...player('p1', 1),
      rev: 1,
      name: 'и'.repeat(3000),
    });
    mem.map.set(key(), raw);
    open([clubV2]).loadPlayer('p1');
    expect(mem.map.has(`${P}player.p2.c3`)).toBe(false);
    expect(mem.map.has(`${P}player.p2.c2`)).toBe(false);
    expect(mem.map.has(`${P}player.p2.c1`)).toBe(false);
    expect(mem.map.get(`${key()}.c1`)).toBe(raw);
    foreignIntact(mem);
  });
});

// --- Переполнение (К20) ----------------------------------------------------------------------------------------

describe('переполнение квоты (К20, таблица спеки)', () => {
  /** Игрок с тремя копиями; ёмкость — впритык к тому, что лежит, плюс `slack`. */
  function crowded(slack: number) {
    const s = setup();
    const env = seed(s.store);
    for (const n of [1, 2, 3]) s.mem.map.set(`${key()}.c${n}`, `копия-${n}-`.padEnd(400, '#'));
    const used = [...s.mem.map].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
    s.mem.capacity = used + slack;
    return { ...s, env };
  }

  it('не хватило — свои c3 и c2 удалены, запись повторена и прошла; c1 и чужое целы', () => {
    // Ловит: переполнение сразу даёт отказ, хотя копии можно пожертвовать; или удаляется c1, или чужой ключ.
    const { store, mem, env } = crowded(0);
    const grown = writePlayer(env, { club: { stars: 7 } });
    const need = serializePlayer(grown).length - (stored(mem) ?? '').length;
    mem.capacity += need - 2; // места на 2 знака меньше, чем надо: первая запись упрётся в квоту
    const res = store.savePlayer('p1', grown, 0);
    expect(res).toEqual({ ok: true });
    expect(stored(mem)).toBe(serializePlayer(grown));
    expect(mem.map.has(`${key()}.c3`)).toBe(false);
    expect(mem.map.has(`${key()}.c2`)).toBe(false);
    expect(mem.map.has(`${key()}.c1`)).toBe(true);
    foreignIntact(mem);
  });

  it('и после этого не хватило — quota; игрок на диске прежний, чужие ключи целы', () => {
    // Ловит: после неудачной повторной записи на диске остаётся обрезок, или «очистка» добирается до чужих префиксов.
    const { store, mem, env } = crowded(0);
    const before = stored(mem);
    const huge = writePlayer(env, {
      club: { stars: 1, junk: 'z'.repeat(5000) },
    });
    expect(store.savePlayer('p1', huge, 0)).toEqual({
      ok: false,
      err: 'quota',
    });
    expect(stored(mem)).toBe(before);
    expect(mem.map.has(`${key()}.c1`)).toBe(true);
    foreignIntact(mem);
    // Игра идёт из памяти: после освобождения места та же запись проходит с тем же rev.
    mem.capacity = Infinity;
    expect(store.savePlayer('p1', huge, 0)).toEqual({ ok: true });
  });

  it('отказ не по квоте (denied) копий не трогает', () => {
    // Ловит: «лечение» запускается на любом отказе и зря стирает копии.
    const { store, mem, env } = crowded(0);
    mem.failWrite = 'SecurityError';
    expect(store.savePlayer('p1', writePlayer(env, { club: { stars: 7 } }), 0)).toEqual({ ok: false, err: 'denied' });
    for (const n of [1, 2, 3]) expect(mem.map.has(`${key()}.c${n}`)).toBe(true);
  });

  it('чужие копии при переполнении не трогаются', () => {
    // Ловит: переполнение у одного игрока стирает копии другого.
    const { store, mem, env } = crowded(0);
    mem.map.set(`${P}player.p2.c3`, 'чужая');
    mem.capacity += 'чужая'.length + `${P}player.p2.c3`.length;
    store.savePlayer('p1', writePlayer(env, { club: { stars: 1, junk: 'z'.repeat(5000) } }), 0);
    expect(mem.map.get(`${P}player.p2.c3`)).toBe('чужая');
  });
});

// --- Корзина ---------------------------------------------------------------------------------------------------

describe('корзина: trash → restore → emptyTrash (059-В10)', () => {
  it('trash переносит конверт дословно, restore возвращает его', () => {
    // Ловит: удалённый игрок теряется сразу, а не лежит до «очистить корзину»; восстановление меняет байты.
    const { store, mem } = setup();
    seed(store);
    const raw = stored(mem);
    expect(store.trash('p1')).toEqual({ ok: true });
    expect(stored(mem)).toBeUndefined();
    expect(mem.map.get(`${P}trash.p1`)).toBe(raw);
    expect(store.loadPlayer('p1')).toEqual({ kind: 'absent' });
    expect(store.trashed()).toEqual({ ok: true, value: ['p1'] });
    expect(store.restore('p1')).toEqual({ ok: true });
    expect(stored(mem)).toBe(raw);
    expect(mem.map.has(`${P}trash.p1`)).toBe(false);
    expect(store.loadPlayer('p1').kind).toBe('ok');
    foreignIntact(mem);
  });

  it('холостые: trash пустого — absent; restore пустой корзины — absent; restore поверх живого — exists', () => {
    // Ловит: двойной клик «удалить» или «вернуть» затирает живого игрока или падает.
    const { store, mem } = setup();
    expect(store.trash('p1')).toEqual({ ok: false, err: 'absent' });
    expect(store.restore('p1')).toEqual({ ok: false, err: 'absent' });
    seed(store);
    mem.map.set(`${P}trash.p1`, 'старая корзина');
    expect(store.trash('p1')).toEqual({ ok: false, err: 'exists' });
    expect(store.restore('p1')).toEqual({ ok: false, err: 'exists' });
    expect(mem.map.get(`${P}trash.p1`)).toBe('старая корзина');
    expect(stored(mem)).toBeDefined();
  });

  it('emptyTrash стирает корзину и хвосты её игроков, а чужих и живых не трогает', () => {
    // Ловит: «очистить корзину» стирает живого игрока, его копии или чужие префиксы.
    const { store, mem } = setup();
    seed(store, 'p1');
    seed(store, 'p2');
    for (const pid of ['p1', 'p2']) {
      mem.map.set(`${key(pid)}.c1`, 'копия');
      mem.map.set(`${P}quarantine.${pid}.1`, 'карантин');
    }
    store.trash('p1');
    expect(store.emptyTrash()).toEqual({ ok: true, value: 1 });
    expect([...mem.map.keys()].filter((k) => k.startsWith(P) && k.includes('p1'))).toEqual([]);
    expect(stored(mem, 'p2')).toBeDefined();
    expect(mem.map.get(`${key('p2')}.c1`)).toBe('копия');
    expect(mem.map.get(`${P}quarantine.p2.1`)).toBe('карантин');
    expect(store.emptyTrash()).toEqual({ ok: true, value: 0 });
    foreignIntact(mem);
  });

  it('emptyTrash: игрок снова на месте (корзина и живой одновременно) — копии и карантин живого целы', () => {
    // Ловит: очистка корзины стирает c1 и карантин живого игрока, потому что его pid ещё лежит в корзине.
    const { store, mem } = setup();
    seed(store, 'p1');
    store.trash('p1');
    seed(store, 'p1'); // тот же pid создан заново, пока старый в корзине
    mem.map.set(`${key()}.c1`, 'копия');
    mem.map.set(`${P}quarantine.p1.1`, 'карантин');
    expect(store.emptyTrash()).toEqual({ ok: true, value: 1 });
    expect(mem.map.has(`${P}trash.p1`)).toBe(false);
    expect(stored(mem)).toBeDefined();
    expect(mem.map.get(`${key()}.c1`)).toBe('копия');
    expect(mem.map.get(`${P}quarantine.p1.1`)).toBe('карантин');
  });

  it('нет места под корзину — c3 и c2 игрока уступают, иначе quota и игрок на месте', () => {
    // Ловит: удаление игрока при полной квоте теряет его (корзина не записалась, а игрок стёрт).
    const { store, mem } = setup();
    seed(store);
    const raw = stored(mem);
    mem.capacity = [...mem.map].reduce((s, [k, v]) => s + k.length + v.length, 0);
    expect(store.trash('p1')).toEqual({ ok: false, err: 'quota' });
    expect(stored(mem)).toBe(raw);
    expect(mem.map.has(`${P}trash.p1`)).toBe(false);
  });
});

// --- Кольцо при квоте, putCopy, корзина с записью устройства (063 Т2: К2, К3) -----------------------------------------

describe('кольцо копий при квоте и положить конверт в копии (063 К2, К3)', () => {
  const v1 = (n: number) => serializePlayer({ ...player('p1', n), rev: n });
  const used = (mem: { map: Map<string, string> }) => [...mem.map].reduce((sum, [k, v]) => sum + k.length + v.length, 0);

  it('К2: сдвиг кольца упёрся в квоту — сырое прямо в c1, backup:true, основной ключ цел', () => {
    // Ловит: сдвиг c1→c2 не лёг в квоту — копия не делается, backup:false, и каждая запись игрока отказывает `quota` (долг 060, Т11).
    const { open, mem } = setup();
    mem.map.set(key(), v1(2));
    mem.map.set(`${key()}.c1`, v1(1));
    mem.capacity = used(mem); // c2 нового ключа не поместится, замена c1 той же длины — да
    const res = open([clubV2]).loadPlayer('p1');
    expect(res).toMatchObject({ kind: 'ok', changed: true, backup: true });
    expect(mem.map.get(`${key()}.c1`)).toBe(v1(2));
    expect(mem.map.has(`${key()}.c2`)).toBe(false);
    expect(stored(mem)).toBe(v1(2));
    foreignIntact(mem);
  });

  it('К2: после квоты на сдвиге первая запись идёт — не quota каждый раз', () => {
    // Ловит: игрок открыт с backup:false при старой c1, и запись после этого вечно отказывает `quota`.
    const { open, mem } = setup();
    mem.map.set(key(), v1(2));
    mem.map.set(`${key()}.c1`, v1(1));
    mem.capacity = used(mem);
    const store = open([clubV2]);
    const res = store.loadPlayer('p1');
    if (res.kind !== 'ok') throw new Error('игрок не открылся');
    mem.capacity = used(mem) + 40; // хватает на рост записи, но не на копию в c2
    const next = writePlayer(res.env, { club: { stars: 2, tag: '' } });
    expect(store.savePlayer('p1', next, res.env.rev)).toEqual({ ok: true });
    expect(stored(mem)).toBe(serializePlayer(next));
    expect(mem.map.get(`${key()}.c1`)).toBe(v1(2));
  });

  it('К2: три копии разной длины, сдвиг упёрся в квоту на c3←c2 — свежая c1 не теряется, а уходит в c2', () => {
    // Ловит: сдвиг встал на первом шаге (c2 длиннее c3), c1 затёрта новой записью — самая свежая прежняя копия пропала (ревью-1, copies.ts:85).
    const { store, mem } = setup();
    seed(store, 'p1');
    const raw = serializePlayer(player('p1', 5));
    const len = raw.length;
    const a = 'A'.repeat(len); // c1: самая свежая прежняя, длина новой записи — замена на месте влезает
    mem.map.set(`${key()}.c1`, a);
    mem.map.set(`${key()}.c2`, 'B'.repeat(len * 3)); // длиннее c3: c3←c2 в квоту
    mem.map.set(`${key()}.c3`, 'C'.repeat(len));
    mem.capacity = used(mem);
    expect(store.putCopy('p1', player('p1', 5))).toEqual({ ok: true });
    expect([1, 2, 3].map((n) => mem.map.get(`${key()}.c${n}`))).toEqual([raw, a, undefined]);
    foreignIntact(mem);
  });

  it('К3: putCopy — конверт в c1 со сдвигом, основной ключ не тронут; повтор того же — холостой', () => {
    // Ловит: проигравший при импорте clash нигде не сохраняется (теряется), затирает основной ключ или сдвигает кольцо на каждый повтор.
    const { store, mem } = setup();
    const winner = seed(store, 'p1', 1);
    const loser = player('p1', 5);
    expect(store.putCopy('p1', loser)).toEqual({ ok: true });
    expect(mem.map.get(`${key()}.c1`)).toBe(serializePlayer(loser));
    expect(stored(mem)).toBe(serializePlayer(winner));
    const older = player('p1', 7);
    expect(store.putCopy('p1', older)).toEqual({ ok: true });
    expect(store.putCopy('p1', older)).toEqual({ ok: true });
    expect([1, 2, 3].map((n) => mem.map.get(`${key()}.c${n}`))).toEqual([serializePlayer(older), serializePlayer(loser), undefined]);
    foreignIntact(mem);
  });

  it('К3: putCopy — чужой pid в конверте и негодный pid: invalid, на диске ничего нового', () => {
    // Ловит: копия игрока p2 ложится в кольцо p1 (при восстановлении подменила бы чужое сохранение).
    const { store, mem } = setup();
    seed(store, 'p1');
    const before = mem.snapshot();
    expect(store.putCopy('p1', player('p2'))).toEqual({ ok: false, err: 'invalid' });
    expect(store.putCopy('a.b', player('a.b'))).toEqual({ ok: false, err: 'invalid' });
    expect(mem.snapshot()).toEqual(before);
  });

  it('К3: putCopy — нет места: quota, на диске всё прежнее; отказ доступа — denied', () => {
    // Ловит: копия при нехватке места ломает уже лежащее (частичный сдвиг) или молча «успешна»; отказ доступа выдаётся за квоту.
    const { store, mem } = setup();
    seed(store, 'p1');
    mem.capacity = used(mem);
    const before = mem.snapshot();
    expect(store.putCopy('p1', player('p1', 5))).toEqual({ ok: false, err: 'quota' });
    expect(mem.snapshot()).toEqual(before);
    mem.capacity = Infinity;
    mem.failWrite = 'SecurityError';
    expect(store.putCopy('p1', player('p1', 5))).toEqual({ ok: false, err: 'denied' });
    expect(mem.snapshot()).toEqual(before);
  });

  it('К3: clash — проигравший в копию, победитель записан с rev = max + 1', () => {
    // Ловит: «взять из файла» затирает игрока на компьютере без следа (проигравшего нет ни в одном ключе).
    const { store, mem } = setup();
    const mine = seed(store, 'p1', 3);
    const theirs = { ...player('p1', 9), rev: 11 };
    expect(store.putCopy('p1', mine)).toEqual({ ok: true });
    const winner = { ...theirs, rev: Math.max(mine.rev, theirs.rev) + 1 };
    expect(store.savePlayer('p1', winner, mine.rev)).toEqual({ ok: true });
    expect(stored(mem)).toBe(serializePlayer(winner));
    expect(mem.map.get(`${key()}.c1`)).toBe(serializePlayer(mine));
  });

  it('К3: корзина вместе с записью устройства — игрок уходит из списка и возвращается, rev растёт', () => {
    // Ловит: игрок в корзине остаётся в списке устройства (плитка без игрока) или возвращается не в список; rev устройства не растёт.
    const { store, mem } = setup();
    seed(store, 'p1');
    seed(store, 'p2');
    const d0 = { ...newDevice(), players: [{ pid: 'p1', order: 0 }, { pid: 'p2', order: 1 }] };
    expect(store.saveDevice(d0, null)).toEqual({ ok: true });
    expect(store.trash('p1')).toEqual({ ok: true });
    const d1 = withoutPlayer(d0, 'p1');
    expect(d1).toEqual({ ...d0, rev: 1, players: [{ pid: 'p2', order: 1 }] });
    expect(store.saveDevice(d1, d0.rev)).toEqual({ ok: true });
    expect(withoutPlayer(d1, 'p1')).toBe(d1); // двойной клик — тот же объект, записывать нечего
    expect(store.restore('p1')).toEqual({ ok: true });
    const d2 = withPlayer(d1, 'p1');
    expect(d2.players).toEqual([{ pid: 'p2', order: 1 }, { pid: 'p1', order: 2 }]);
    expect(withPlayer(d2, 'p1')).toBe(d2);
    expect(store.saveDevice(d2, d1.rev)).toEqual({ ok: true });
    expect(JSON.parse(mem.map.get(`${P}device`) ?? '{}')).toMatchObject({ rev: 2 });
    expect(store.loadPlayer('p1').kind).toBe('ok');
  });
});

// --- Карантин для выгрузки (063 К4, Р10) -------------------------------------------------------------------------------

describe('store.quarantined — карантин для выгрузки (063-Р10)', () => {
  it('К4: битый игрок и битое устройство — сырые версии, свежая первой; нет битого — пусто', () => {
    // Ловит: выгрузке нечего положить в поле quarantine — битое сырое видно только в ключах хранилища.
    const { store, mem } = setup();
    expect(store.quarantined('p1')).toEqual([]);
    mem.map.set(key(), 'мусор 1');
    store.loadPlayer('p1');
    mem.map.set(key(), 'мусор 2');
    store.loadPlayer('p1');
    expect(store.quarantined('p1')).toEqual(['мусор 2', 'мусор 1']);
    mem.map.set(`${P}device`, '{оборвано');
    store.loadDevice();
    expect(store.quarantined('device')).toEqual(['{оборвано']);
    expect(store.quarantined('p2')).toEqual([]);
  });
});

// --- Случайные последовательности ------------------------------------------------------------------------------

describe('случайные последовательности операций двух вкладок', () => {
  it('чужие ключи байт в байт; успешная запись — только при совпавшем rev; ничего не бросает', () => {
    // Ловит: любая комбинация записи, отказа квоты, корзины и двух вкладок без замков трогает чужое или пишет поверх чужого rev.
    for (const seedValue of [1, 2, 3, 4, 5]) {
      const rnd = createRandom(seedValue);
      const { open, mem } = setup();
      const tabs = [open(), open()];
      const known: (Envelope | undefined)[] = [undefined, undefined];
      for (let step = 0; step < 200; step++) {
        const t = randomInt(rnd, 2);
        const store = tabs[t] as Store;
        const op = pick(rnd, ['load', 'save', 'save', 'create', 'trash', 'restore', 'quota', 'free', 'empty'] as const);
        if (op === 'load') {
          const r = store.loadPlayer('p1');
          known[t] = r.kind === 'ok' ? r.env : undefined;
        } else if (op === 'save' || op === 'create') {
          const base = known[t];
          const env = op === 'create' || !base ? player() : writePlayer(base, { club: { stars: step } });
          const expected = op === 'create' || !base ? null : base.rev;
          const diskRev = stored(mem) === undefined ? null : (JSON.parse(stored(mem) as string) as { rev: number }).rev;
          const res = store.savePlayer('p1', env, expected);
          if (res.ok) {
            expect(diskRev).toBe(expected);
            known[t] = env;
          }
        } else if (op === 'trash') store.trash('p1');
        else if (op === 'restore') store.restore('p1');
        else if (op === 'empty') store.emptyTrash();
        else mem.capacity = op === 'quota' ? 900 : Infinity;
        foreignIntact(mem);
      }
    }
  });
});

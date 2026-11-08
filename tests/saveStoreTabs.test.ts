/**
 * Слой хранилища сохранений (спека 014-Т3д): гонки вкладок и отказы записи — `wrote`, `create` без места,
 * режим v1 при отказе записи и удаления, `refresh`/`follow`. Обвязка — `saveStoreHelpers.ts`. У каждого теста — «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { copyPlayerName } from '../src/engine/save/copies';
import { SAVE_DRAFT } from '../src/engine/save/format';
import { full } from './saveFixtures';
import { NEXT, envAt, envText, make, memory, onProbe, probeAt, probeOf } from './saveStoreHelpers';

describe('слой хранилища: вкладки и отказы записи', () => {
  const KEY = `${NEXT}save.p1`;
  // Сырой текст, который перед записью конверта обязан лечь копией в карантин (место на неё — предмет двух кейсов).
  const BROKEN = '{не json';
  const bump = (field: 'goals' | 'matches', by = 1) => onProbe((v) => ({ ...v, [field]: v[field] + by }));

  // Ловит (014-Р18): игрок удалён в другой вкладке, ключ ещё лежит (удаление не доделано) — ход писал в чужой ключ и копии.
  it('игрока нет в списке: ход не пишет ни ключ, ни копии, даже если ключ лежит или битый', () => {
    const inList = new Set(['p1']);
    const { io, data, state } = memory({ [KEY]: envText(full) });
    const s = make(io, NEXT, 'next', (id) => inList.has(id));
    s.load('p1');
    expect(probeOf(s.update('p1', bump('goals'))).goals).toBe(full.goals + 1);
    inList.delete('p1');
    const before = Object.fromEntries(data);
    const writes = state.writes;
    expect(s.update('p1', bump('goals'))).toBeNull();
    // Ключ повредили — разбор писал бы карантин; игрока удалили, и карантина тоже нет.
    data.set(KEY, BROKEN);
    const broken = Object.fromEntries(data);
    expect(s.update('p1', bump('goals'))).toBeNull();
    expect([state.writes, Object.fromEntries(data)]).toEqual([writes, broken]);
    expect({ ...broken, [KEY]: before[KEY] }).toEqual(before);
  });

  // Ловит (014-Р18): копия «до удаления» без имени игрока; удаление не отдаёт копию в игру иначе, чем сохранение.
  it('remove с именем: копия — конверт игрока плюс имя, основной ключ удалён', () => {
    const { io, data } = memory({ [KEY]: envText(full) });
    const s = make(io);
    s.load('p1');
    expect(s.remove('p1', 'Витя')).toBe(true);
    expect(data.has(KEY)).toBe(false);
    const copy = [...data.entries()].find(([k]) => k.startsWith(`${NEXT}pre.p1.delete.`))?.[1] ?? '';
    expect(copyPlayerName(copy)).toBe('Витя');
    expect(probeAt(new Map([['c', copy]]), 'c')).toMatchObject({ goals: full.goals });
  });

  // Ловит (S1): `create` не записался (хранилище полное), игрока нет в списке — `update` отвечал null, ходы нового игрока терялись.
  it('create без места: ходы нового игрока живут в памяти и ложатся, когда место появилось', () => {
    const { io, data, state } = memory({}, { quota: 0 });
    const s = make(io, NEXT, 'next', () => false);
    s.create('p2');
    expect(data.size).toBe(0);
    expect(probeOf(s.update('p2', bump('goals', 3))).goals).toBe(3);
    expect(probeOf(s.update('p2', bump('goals', 1))).goals).toBe(4);
    state.quota = undefined;
    expect(probeOf(s.update('p2', bump('goals', 1))).goals).toBe(5);
    const key = `${NEXT}save.p2`;
    expect(envAt(data, key).sections.probe).toMatchObject({ goals: 5 });
    // Ключ записан этим слоем: теперь его пропажа при игроке вне списка — «удалён в другой вкладке».
    data.delete(key);
    expect(s.update('p2', bump('goals', 1))).toBeNull();
    expect(data.has(key)).toBe(false);
  });

  // Ловит (S2): `create` при отказе записи оставлял `lastText` пустым при лежащем null — ход 2 строился на лежащем, ход 1 откатывался.
  it('конверт: create не записался → два хода подряд не откатывают первый', () => {
    const { io, data, state } = memory({}, { quota: 0 });
    const s = make(io);
    s.create('p1');
    expect(probeOf(s.update('p1', bump('goals', 5))).goals).toBe(5);
    expect(probeOf(s.update('p1', bump('goals', 1))).goals).toBe(6);
    state.quota = undefined;
    expect(probeOf(s.update('p1', bump('goals', 1))).goals).toBe(7);
    expect(probeAt(data, `${NEXT}save.p1`)).toMatchObject({ goals: 7 });
  });

  // Ловит (Т3д3): `reset` в конверте при нечитаемом хранилище считал ключ пустым и писал поверх чистое.
  it('режим конверта: хранилище не читается → сброс отказывает (null), ничего не записано', () => {
    const { io, data, state } = memory({ [KEY]: envText(full) });
    const s = make(io);
    s.load('p1');
    const before = Object.fromEntries(data);
    const writes = state.writes;
    state.unreadable = true;
    expect(s.reset('p1')).toBeNull();
    expect([state.writes, Object.fromEntries(data)]).toEqual([writes, before]);
  });

  // Ловит (M3): `update` строит ход на лежащем, когда чужой `rev` (`known`/`rev` конверта) не совпал с памятью; чужая запись
  // без уведомления и отказ записи — иначе ход 2 откатывал ход 1. `refresh` тут не вызывается, его путь `known` не прикрывает.
  it('конверт: чужая запись без notify, квота 0, два хода подряд — первый не откатывается', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, state } = memory({ [key]: envText(full) });
    const s = make(io);
    s.load('p1');
    data.set(key, envText({ ...full, matches: 40 }, 2));
    state.quota = 0;
    expect(probeOf(s.update('p1', bump('goals')))).toMatchObject({ matches: 40, goals: full.goals + 1 });
    expect(probeOf(s.update('p1', bump('goals')))).toMatchObject({ matches: 40, goals: full.goals + 2 });
  });

  // Ловит (M4): `refresh` кладёт чужую запись в `known` с её `rev`; ход при нечитаемом хранилище остаётся в памяти (без записи);
  // когда чтение вернулось, следующий ход строится на памяти (`rev` сошёлся), а не на лежащем (иначе ход пропадал).
  it('конверт: refresh подхватил чужую запись, чтение отвалилось на ход и вернулось → ход не пропал', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, state, notify } = memory({ [key]: envText(full) });
    const s = make(io);
    s.load('p1');
    s.follow('p1');
    data.set(key, envText({ ...full, matches: 40 }, 2));
    notify(key);
    state.unreadable = true;
    expect(probeOf(s.update('p1', bump('goals'))).goals).toBe(full.goals + 1);
    state.unreadable = false;
    expect(probeOf(s.update('p1', bump('goals')))).toMatchObject({ matches: 40, goals: full.goals + 2 });
    expect(probeAt(data, key)).toMatchObject({ matches: 40, goals: full.goals + 2 });
  });

  // Ловит (S3): метка «ключ держали» оставалась после refresh с исходом ok, и чужая новая запись затиралась памятью.
  it('копия не легла, refresh подхватил чужую запись, она снова изменилась → мой ход строится на ней', () => {
    const { io, data, state, used, notify } = memory({ [KEY]: BROKEN });
    state.quota = used() + 10;
    const a = make(io);
    const got: number[] = [];
    a.load('p1');
    a.follow('p1', (all) => void got.push(probeOf(all).matches));
    expect(a.events().some((e) => e.text.startsWith('copy-'))).toBe(true);
    // Вкладка B: места теперь хватает — кладёт битое в карантин, пишет конверт и матчей на 33 больше, потом ещё на 1 (A об этом не знает).
    state.quota = undefined;
    const b = make(io);
    b.load('p1');
    b.update('p1', bump('matches', 33));
    notify(KEY);
    expect(got).toEqual([33]);
    b.update('p1', bump('matches'));
    const mine = a.update('p1', bump('goals'));
    expect(probeOf(mine)).toMatchObject({ matches: 34, goals: 1 });
    expect(envAt(data, KEY).sections.probe).toMatchObject({ matches: 34, goals: 1 });
  });

  // Ловит (S3): после того как копия наконец легла, ходы, сделанные пока ключ держали, пропадали бы (база — память, а не лежащее).
  it('копия не легла: ходы живут в памяти, а когда место появилось — ложатся в ключ', () => {
    const { io, data, state, used } = memory({ [KEY]: BROKEN });
    state.quota = used() + 10;
    const s = make(io);
    s.load('p1');
    expect(probeOf(s.update('p1', bump('goals'))).goals).toBe(1);
    expect(data.get(KEY)).toBe(BROKEN);
    state.quota = undefined;
    expect(probeOf(s.update('p1', bump('goals'))).goals).toBe(2);
    expect(envAt(data, KEY).sections.probe).toMatchObject({ goals: 2 });
    expect([...data.keys()].some((k) => k.includes('quarantine.p1.'))).toBe(true);
  });

  // Ловит: чужая запись → refresh → отказ записи → ход: ход не должен терять ни чужую запись, ни себя.
  it('refresh подхватил чужую запись, запись не удалась, ход и следующий ход — в памяти и в ключ позже', () => {
    const { io, data, state, notify } = memory();
    const a = make(io);
    const got: number[] = [];
    a.create('p1');
    a.follow('p1', (all) => void got.push(probeOf(all).matches));
    const b = make(io);
    b.load('p1');
    b.update('p1', bump('matches', 40));
    notify(KEY);
    expect(got).toEqual([40]);
    const before = data.get(KEY);
    state.quota = 0;
    expect(probeOf(a.update('p1', bump('goals'))).matches).toBe(40);
    expect(data.get(KEY)).toBe(before);
    state.quota = undefined;
    expect(probeOf(a.update('p1', bump('goals')))).toMatchObject({ matches: 40, goals: 2 });
    expect(envAt(data, KEY).sections.probe).toMatchObject({ matches: 40, goals: 2 });
    // Слежение снято — чужая запись не перечитывается и не сообщается.
    a.follow(null);
    b.update('p1', bump('matches'));
    notify(KEY);
    expect(got).toEqual([40]);
  });

  // Ловит: refresh видит `newer` от другой вкладки — слой должен перейти в чтение и не затирать будущую запись ходом.
  it('refresh: чужая запись новее программы → только чтение, ход ничего не пишет', () => {
    const { io, data, state, notify } = memory();
    const a = make(io);
    let called = 0;
    a.create('p1');
    a.follow('p1', () => void called++);
    const future = JSON.stringify({ format: 0, draft: SAVE_DRAFT + 1, rev: 9, app: '9', sections: { probe: {} } });
    data.set(KEY, future);
    notify(KEY);
    expect(a.status().readOnly).toBe(true);
    expect(a.events().map((e) => e.text)).toContain('newer p1');
    expect(called).toBe(0);
    const writes = state.writes;
    a.update('p1', bump('goals'));
    expect([state.writes, data.get(KEY)]).toEqual([writes, future]);
  });

  // Ловит: `refresh` подхватил чужую запись (`known`/`rev`), запись не удалась, второй ход откатывал первый.
  it('конверт: refresh, отказ записи, два хода подряд — первый ход не откатывается', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, state, notify } = memory({ [key]: envText(full) });
    const s = make(io);
    const got: number[] = [];
    s.load('p1');
    s.follow('p1', (all) => void got.push(probeOf(all).matches));
    data.set(key, envText({ ...full, matches: 40 }, 2));
    notify(key);
    expect(got).toEqual([40]);
    state.quota = 0;
    expect(probeOf(s.update('p1', bump('goals'))).goals).toBe(full.goals + 1);
    expect(probeOf(s.update('p1', bump('goals')))).toMatchObject({ matches: 40, goals: full.goals + 2 });
  });

  // Ловит (Т3д3): `refresh` ставил «только чтение» без записи в журнал, в отличие от `readEnvelope` и `scanNewer`.
  it('конверт: refresh увидел чужую запись новее → только чтение, в журнале «newer»', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, notify } = memory({ [key]: envText(full) });
    const s = make(io);
    s.load('p1');
    s.follow('p1');
    data.set(key, JSON.stringify({ format: 0, draft: 9, rev: 5, sections: {} }));
    notify(key);
    expect(s.status().readOnly).toBe(true);
    expect(s.events().map((e) => e.text)).toContain('newer p1');
  });
});

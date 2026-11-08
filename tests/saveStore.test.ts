/**
 * Слой хранилища сохранений (спека 014-Т3, design §0, §4, §5): две «вкладки», квота, чужие ключи v1, newer.
 * Опора — тестовый раздел `probe` (tests/saveFixtures.ts); раздел `legacy` ушёл в 018-Т6б.
 * Хранилище и часы — в памяти теста. Ловит у каждого теста — строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { isV1Prefix } from '../src/app/save/store';
import { SAVE_DRAFT, emptyEnvelope, type SaveEnvelope } from '../src/engine/save/format';
import { PROBES, full, probe } from './saveFixtures';
import { NEXT, TODAY, V1, ctx, envAt, envText, make, memory, onProbe, probeAt, probeOf } from './saveStoreHelpers';

// ───────────── слой хранилища (014-Т3, design §0, §4, §5) ─────────────

describe('слой хранилища: createSaveStore', () => {
  // Ловит: вторая вкладка молча затирает первую целым снимком (Б2) — оба хода обязаны остаться в лежащем.
  it('две «вкладки» на одном хранилище ничего не теряют', () => {
    const { io, data } = memory();
    const a = make(io);
    const b = make(io);
    a.load('p1');
    b.load('p1');
    b.update('p1', onProbe((s) => ({ ...s, matches: 1 })));
    a.update('p1', onProbe((s) => ({ ...s, goals: 5 })));
    const env = envAt(data, `${NEXT}save.p1`);
    expect(env.rev).toBe(2);
    expect(probe.parse(env.sections.probe, ctx)).toMatchObject({ matches: 1, goals: 5 });
    expect(probeOf(a.memory('p1'))).toMatchObject({ matches: 1, goals: 5 });
  });

  // Ловит: сброс у родителя и загрузка файла отменяются следующей записью открытой игры (Б2).
  it('сброс и загрузка при открытой игре не откатываются', () => {
    const { io, data } = memory();
    const game = make(io);
    const parent = make(io);
    game.load('p1');
    game.update('p1', onProbe((s) => ({ ...s, goals: 3 })));
    parent.reset('p1');
    game.update('p1', onProbe((s) => ({ ...s, matches: s.matches + 1 })));
    expect(probeAt(data, `${NEXT}save.p1`)).toMatchObject({ goals: 0, matches: 1 });
    // Загрузка файла: чужая запись с большим rev и своим прогрессом.
    const fromFile: SaveEnvelope = { ...emptyEnvelope('0.10.1', PROBES, ctx), rev: 9, sections: { probe: { ...probe.empty(ctx), goals: 7 } } };
    data.set(`${NEXT}save.p1`, JSON.stringify(fromFile));
    game.update('p1', onProbe((s) => ({ ...s, matches: s.matches + 1 })));
    expect(probeAt(data, `${NEXT}save.p1`)).toMatchObject({ goals: 7, matches: 1 });
    expect(envAt(data, `${NEXT}save.p1`).rev).toBe(10);
    // Копия «до сброса» перечитывается и цела.
    const copy = [...data.keys()].find((k) => k.includes('.reset.')) ?? '';
    expect(probeAt(data, copy).goals).toBe(3);
  });

  // Ловит: игрока удалили в другой вкладке, а открытая игра воскресила его ключ записью.
  it('ключ пропал и игрока нет в списке → не писать', () => {
    const { io, data } = memory();
    const s = make(io, NEXT, 'next', () => false);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, goals: 1 })));
    data.delete(`${NEXT}save.p1`);
    expect(s.update('p1', onProbe((v) => ({ ...v, goals: 2 })))).toBeNull();
    expect(data.has(`${NEXT}save.p1`)).toBe(false);
  });

  // Ловит: копия не влезла, а основной ключ всё равно перезаписан (Б1) — «до» потеряно.
  it('квота: карантин не влез → основной ключ побайтно прежний, игра из памяти', () => {
    const broken = '{"сломано": ';
    const key = `${NEXT}save.p1`;
    const { io, data } = memory({ [key]: broken }, { quota: key.length + broken.length + 20 });
    const s = make(io);
    s.load('p1');
    expect(data.get(key)).toBe(broken);
    expect([...data.keys()].some((k) => k.includes('quarantine'))).toBe(false);
    expect(s.status().storageFull).toBe(true);
    const next = s.update('p1', onProbe((v) => ({ ...v, goals: 4 })));
    expect(probeOf(next).goals).toBe(4);
    expect(data.get(key)).toBe(broken);
  });

  // Ловит: битое затирается без карантина (старое «первая запись затирает»); «не прочёл» принято за «пусто».
  it('битое → побайтно в карантин, чистый старт; чтение не удалось → не пишет', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, state } = memory({ [key]: '{не json' });
    const s = make(io);
    s.load('p1');
    const q = [...data.keys()].find((k) => k.includes('quarantine.p1.')) ?? '';
    expect(data.get(q)).toBe('{не json');
    expect(s.status().found.p1).toBe('broken');
    expect(envAt(data, key).rev).toBe(1);
    const before = data.get(key);
    state.unreadable = true;
    const writes = state.writes;
    s.update('p1', onProbe((v) => ({ ...v, goals: 9 })));
    expect([data.get(key), state.writes]).toEqual([before, writes]);
  });

  // Ловит: освобождение места на /next/ сносит все старые копии разом вместо одной (ревью Т2).
  it('при отказе записи на next удалено одно старое имя, остальные целы', () => {
    const main = JSON.stringify({ ...emptyEnvelope('0.10.1', PROBES, ctx), rev: 3 });
    const init = {
      [`${NEXT}save.p1`]: main,
      [`${NEXT}snap.p1.${TODAY}`]: main,
      [`${NEXT}quarantine.p1.1`]: 'a'.repeat(100),
      [`${NEXT}quarantine.p1.2`]: 'b'.repeat(100),
      [`${NEXT}quarantine.p1.3`]: 'c'.repeat(100),
    };
    // Квота — ровно столько, сколько занято: любой рост основного ключа требует освободить место.
    const { io, data, used } = memory(init, { quota: memory(init).used() });
    const s = make(io);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, days: { '2026-11-08': 1000 } })));
    expect(data.has(`${NEXT}quarantine.p1.1`)).toBe(false);
    expect(data.has(`${NEXT}quarantine.p1.2`)).toBe(true);
    expect(data.has(`${NEXT}quarantine.p1.3`)).toBe(true);
    expect(probeOf(s.memory('p1')).days).toEqual({ '2026-11-08': 1000 });
    expect(probeAt(data, `${NEXT}save.p1`).days).toEqual({ '2026-11-08': 1000 });
    expect(used()).toBeGreaterThan(0);
  });

  // Ловит: режим v1 пишет конверт, снимки или новые ключи на ключи сына (В9, Р34) — 0.10.1 прочёл бы «повреждённое».
  it('режим v1: только чтение — ключи сына не меняются ни загрузкой, ни ходом, ни create/reset/remove', () => {
    expect(isV1Prefix(V1)).toBe(true);
    expect(isV1Prefix(NEXT)).toBe(false);
    const init = { [`${V1}save.p1`]: JSON.stringify({ ...full, goals: 12 }), [`${V1}players`]: '{}' };
    const { io, data, state } = memory(init);
    const s = make(io, V1, 'release');
    expect(s.mode).toBe('v1');
    expect(s.status().readOnly).toBe(true);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, goals: v.goals + 1 })));
    s.create('p2');
    s.reset('p1');
    expect(s.remove('p1')).toBe(false);
    expect([state.writes, Object.fromEntries(data)]).toEqual([0, init]);
  });

  // Ловит: сохранение новее программы затирается (В5/В6) — не должно писаться ни оно, ни копии, ни список.
  it('newer: ничего не пишется; scanNewer ставит readOnly до planStart', () => {
    const key = `${NEXT}save.p1`;
    const future = JSON.stringify({ format: 0, draft: SAVE_DRAFT + 1, rev: 5, app: '9', sections: { probe: {} } });
    const { io, data, state } = memory({ [key]: future });
    const s = make(io);
    expect(s.scanNewer(['p1'])).toBe(true);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, goals: 1 })));
    s.create('p2');
    s.reset('p1');
    s.remove('p1');
    expect([state.writes, data.get(key), data.size]).toEqual([0, future, 1]);
    expect(s.status().readOnly).toBe(true);
  });

  // Ловит: копии (снимки, карантин, pre.*) принимаются за игроков — список игроков «чинится» из них.
  it('копии не принимаются за игроков: ключи save.* — только сами сохранения', () => {
    const { io } = memory({ [`${NEXT}save.p1`]: envText(full), [`${NEXT}save.p2`]: '{мусор' });
    const s = make(io);
    s.load('p1');
    s.load('p2');
    s.reset('p1');
    s.remove('p2');
    const names = Object.keys(s.dumpStorage());
    expect(names.some((n) => n.startsWith('snap.') || n.startsWith('pre.') || n.startsWith('quarantine.'))).toBe(true);
    expect(names.filter((n) => n.startsWith('save.'))).toEqual(['save.p1']);
  });

  // ───────────── доправка по ревью Т3д (A–E) ─────────────

  const BIG_BROKEN = `{"сломано": "${'я'.repeat(3000)}`;
  const hasName = (data: Map<string, string>, part: string): boolean => [...data.keys()].some((k) => k.includes(part));
  const goalsOf = (data: Map<string, string>, key: string): number => probeAt(data, key).goals;

  // Ловит (A): копия в карантин не легла, а ход всё равно записал конверт поверх битого — битое пропало (ревью Т3, A).
  it('A: битый текст 3 КБ, места на копию нет → update не пишет; место появилось — карантин, ход сохранён', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, state, used } = memory({ [key]: BIG_BROKEN });
    state.quota = used() + 400;
    const s = make(io);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, goals: 4 })));
    const after = s.update('p1', onProbe((v) => ({ ...v, goals: v.goals + 1 })));
    expect(probeOf(after).goals).toBe(5);
    expect([data.get(key), hasName(data, 'quarantine')]).toEqual([BIG_BROKEN, false]);
    expect(s.status().storageFull).toBe(true);
    // Место появилось: карантин с побайтной копией, ход из памяти не теряется.
    state.quota = undefined;
    s.update('p1', onProbe((v) => ({ ...v, goals: v.goals + 1 })));
    const q = [...data.keys()].find((k) => k.includes('quarantine.p1.')) ?? '';
    expect(data.get(q)).toBe(BIG_BROKEN);
    expect(goalsOf(data, key)).toBe(6);
  });

  // Ловит (A, журнал): повтор одной причины в журнале на каждом ходу — журнал памяти раздувается.
  it('A: повтор одной причины в журнале памяти не пишется', () => {
    const key = `${NEXT}save.p1`;
    const { io, used, state } = memory({ [key]: BIG_BROKEN });
    state.quota = used() + 400;
    const s = make(io);
    s.load('p1');
    for (let i = 0; i < 4; i++) s.update('p1', onProbe((v) => ({ ...v, goals: v.goals + 1 })));
    const texts = s.events().map((e) => e.text);
    expect(texts.filter((t) => t === 'copy-copy-failed')).toHaveLength(1);
    expect(texts.filter((t) => t === 'storage-full')).toHaveLength(1);
  });

  // Ловит (B): копия «до сброса» не легла, а память уже чистая — следующий ход пишет чистое поверх прогресса.
  it('B: копия до сброса не легла → reset отказывает, память и ключ прежние, ход строится на прогрессе', () => {
    const key = `${NEXT}save.p1`;
    const { io, data, state, used } = memory();
    const s = make(io);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, goals: 7, days: { '2026-11-08': 5000 } })));
    const before = data.get(key);
    state.quota = used() + 20;
    expect(s.reset('p1')).toBeNull();
    expect([data.get(key), hasName(data, '.reset.')]).toEqual([before, false]);
    expect(probeOf(s.memory('p1')).goals).toBe(7);
    state.quota = undefined;
    s.update('p1', onProbe((v) => ({ ...v, matches: 1 })));
    expect(probeAt(data, key)).toMatchObject({ goals: 7, matches: 1 });
    // С местом сброс проходит и возвращает чистое.
    expect(probeOf(s.reset('p1'))?.goals).toBe(0);
    expect(hasName(data, '.reset.')).toBe(true);
  });

  // Ловит (C): ход 1 не записался по квоте, ход 2 строится на лежащем — голы и поля хода 1 откатываются.
  it('C: ход 1 не записался → ход 2 строится на памяти; место появилось — пишутся оба', () => {
    const key = `${NEXT}save.p1`;
    const raw = envText({ ...full, goals: 12 });
    const { io, data, state, used } = memory({ [key]: raw });
    state.quota = used();
    const s = make(io);
    s.load('p1');
    s.update('p1', onProbe((v) => ({ ...v, days: { ...v.days, '2026-11-08': 1000, '2026-11-09': 2000, '2026-11-10': 3000 } })));
    expect(data.get(key)).toBe(raw);
    s.update('p1', onProbe((v) => ({ ...v, goals: v.goals + 1 })));
    expect(probeOf(s.memory('p1'))).toMatchObject({ goals: 13, days: { '2026-11-10': 3000 } });
    state.quota = undefined;
    s.update('p1', onProbe((v) => ({ ...v, goals: v.goals + 1 })));
    expect(probeAt(data, key)).toMatchObject({ goals: 14, days: { '2026-11-10': 3000 } });
  });

  // Ловит (C, граница): «память главнее» не должна глушить чужую запись — другая вкладка поменяла ключ.
  it('C: другая вкладка записала → ход строится на её записи', () => {
    const key = `${NEXT}save.p1`;
    const { io, data } = memory({ [key]: envText({ ...full, goals: 12 }) });
    const a = make(io);
    a.load('p1');
    data.set(key, envText({ ...full, goals: 40 }, 2));
    a.update('p1', onProbe((v) => ({ ...v, matches: 3 })));
    expect(probeAt(data, key)).toMatchObject({ goals: 40, matches: 3 });
  });

  // Ловит (D): запись основного ключа освобождала место, снося только что записанную копию операции.
  it('D: main не влез после копии → копия операции не удаляется (основной ключ прежний, копия цела)', () => {
    const key = `${NEXT}save.p1`;
    const short = '{не json'; // короче нового конверта: основной ключ растёт
    const dry = memory({ [key]: short });
    make(dry.io).load('p1');
    const copyKey = [...dry.data.keys()].find((k) => k.includes('quarantine.p1.')) ?? '';
    const wrapped = (dry.data.get(key) ?? '').length;
    const start = memory({ [key]: short });
    // Влезает копия, но не новый конверт: основной ключ вырастает на длину конверта минус битое.
    start.state.quota = start.used() + copyKey.length + wrapped - 1;
    const s = make(start.io);
    s.load('p1');
    expect(start.data.get(copyKey)).toBe(short);
    expect(start.data.get(key)).toBe(short);
    expect(s.status().storageFull).toBe(true);
  });

  // Ловит (E): у p1 `newer` → readOnly, а загрузка p2/p3 пишет копии, обёртку, снимок и карантин (ревью Т3, E).
  it('E: двое игроков, один newer, другой битый и третий целый → ноль записей', () => {
    const future = JSON.stringify({ format: 0, draft: SAVE_DRAFT + 1, rev: 5, app: '9', sections: { probe: {} } });
    const init = {
      [`${NEXT}save.p1`]: future,
      [`${NEXT}save.p2`]: '{битое',
      [`${NEXT}save.p3`]: envText(full),
    };
    const first = memory(init);
    const s = make(first.io);
    expect(s.scanNewer(['p1', 'p2', 'p3'])).toBe(true);
    for (const id of ['p2', 'p3']) {
      s.load(id);
      s.update(id, onProbe((v) => ({ ...v, goals: 1 })));
    }
    expect(s.reset('p2')).toBeNull();
    expect([first.state.writes, Object.fromEntries(first.data)]).toEqual([0, init]);
    // Без scanNewer: p1 прочитан загрузкой → дальше update чужого p2 тоже не пишет.
    const second = memory(init);
    const t = make(second.io);
    t.load('p1');
    t.update('p2', onProbe((v) => ({ ...v, goals: 1 })));
    expect([second.state.writes, Object.fromEntries(second.data)]).toEqual([0, init]);
  });

  // Ловит (мелочь): режим v1 при newer пишет и удаляет ключи сына — create/reset/remove/adopt.
  it('режим v1, newer: create, reset и remove ничего не пишут и не удаляют', () => {
    const future = JSON.stringify({ format: 0, draft: 9, rev: 5, sections: {} });
    const init = { [`${V1}save.p1`]: future };
    const { io, data, state } = memory(init);
    const s = make(io, V1, 'release');
    expect(s.scanNewer(['p1'])).toBe(true);
    s.create('p2');
    s.reset('p1');
    expect(s.remove('p1')).toBe(false);
    expect([state.writes, Object.fromEntries(data)]).toEqual([0, init]);
  });

  // Ловит (мелочь): ключ игрока пропал, игрока нет в списке, а слой воскрешает его, потому что rev в памяти нулевой.
  // Доправка S1: так — только для игрока, чей `create` в слое не терпел отказа (тот с полным хранилищем — `saveStoreTabs.test.ts`).
  it('ключ пропал до первой записи и игрока нет в списке → не писать', () => {
    const { io, data } = memory();
    const s = make(io, NEXT, 'next', () => false);
    s.load('p1');
    expect(s.update('p1', onProbe((v) => ({ ...v, goals: 2 })))).toBeNull();
    expect(data.has(`${NEXT}save.p1`)).toBe(false);
  });

  // Ловит (§11): битое поле раздела чинится молча — без копии `repair` сырой текст терялся бы.
  it('битое поле раздела probe → pre.<id>.repair с сырым текстом до записи и событие', () => {
    const key = `${NEXT}save.p1`;
    const text = JSON.stringify({ format: 0, draft: SAVE_DRAFT, rev: 3, app: '0.10.1', sections: { probe: { ...full, goals: 'много' } } });
    const { io, data } = memory({ [key]: text });
    const s = make(io);
    s.load('p1');
    expect(data.get(`${NEXT}pre.p1.repair.${TODAY}`)).toBe(text);
    expect(s.events().some((e) => e.text.startsWith('repair p1'))).toBe(true);
    expect(data.get(key)).toBe(text);
  });
});

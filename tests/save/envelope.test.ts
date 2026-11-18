/**
 * Конверт игрока и разделы сохранения (060 Т5а, design §3): незнакомое — дословно, «новее» и «битое» — сырое цело,
 * цепочка `up`, rev. У каждого теста строка «Ловит:» — какую поломку он видит.
 */
import { describe, expect, it } from 'vitest';
import { APP_VERSION, createPlayer, serializePlayer, writePlayer, type Envelope } from '../../src/engine/save/envelope';
import { openPlayer, type Opened } from '../../src/engine/save/open';
import { isDay, isInt, type SectionDef } from '../../src/engine/save/section';
import { dayDef } from '../../src/engine/day/section';
import { stadiumDef } from '../../src/engine/home/section';
import { walletDef } from '../../src/engine/rewards/section';
import { prefix } from '../../src/engine/release/keys';
import { createRandom, pick, randomInt } from '../../src/engine/random';

// --- Разделы-образцы -------------------------------------------------------------------------------------------

interface Club {
  stars: number;
  since: string;
}
const clubDef: SectionDef<Club> = {
  name: 'club',
  v: 1,
  empty: () => ({ stars: 0, since: '2026-11-18' }),
  up: {},
  check: (d) => {
    const c = d as Partial<Club> | null;
    const bad: string[] = [];
    if (!c || !isInt(c.stars) || c.stars < 0) bad.push('stars');
    if (!c || !isDay(c.since)) bad.push('since');
    return bad;
  },
};

/** Раздел на третьей версии: v1 `{n}` → v2 `{count}` → v3 `{count, log:[]}`; шаги пишут в журнал вызовов. */
function courseDef(calls: number[] = []): SectionDef<{ count: number; log: string[] }> {
  return {
    name: 'course:ru',
    v: 3,
    empty: () => ({ count: 0, log: [] }),
    up: {
      2: (d) => {
        calls.push(2);
        return { count: (d as { n: number }).n };
      },
      3: (d) => {
        calls.push(3);
        return { ...(d as { count: number }), log: ['from-v2'] };
      },
    },
    check: (d) => {
      const c = d as { count?: unknown; log?: unknown } | null;
      return c && isInt(c.count) && Array.isArray(c.log) ? [] : ['shape'];
    },
  };
}

const defs = [clubDef, courseDef()] as SectionDef<unknown>[];
const base = (): Envelope => createPlayer({ pid: 'p-1', name: 'Test' }, defs);

/** Сырой конверт с руками подставленными разделами. */
function rawWith(sections: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...base(), ...extra, sections });
}

function ok(res: Opened): Extract<Opened, { kind: 'ok' }> {
  if (res.kind !== 'ok') throw new Error(`expected ok, got ${res.kind}`);
  return res;
}

// --- Префикс ---------------------------------------------------------------------------------------------------

describe('prefix (060-Р3)', () => {
  it('выпуск — keykick2., канал next — keykick2-next.', () => {
    // Ловит: тестовая сборка /next/ пишет под ключами выпуска и стирает сохранения детей.
    expect(prefix(2, 'release')).toBe('keykick2.');
    expect(prefix(2, 'next')).toBe('keykick2-next.');
    expect(prefix(3, 'next')).toBe('keykick3-next.');
  });

  it('префиксы не пересекаются между собой и с ключами v1', () => {
    // Ловит: `keykick2.` оказывается началом `keykick2-next.` или `keykick.` — чужие ключи попадают в перебор по префиксу.
    const p = [prefix(2, 'release'), prefix(2, 'next'), prefix(3, 'release')];
    for (const a of p) {
      expect('keykick.player.x'.startsWith(a)).toBe(false);
      expect('keykick-next.player.x'.startsWith(a)).toBe(false);
      for (const b of p) if (a !== b) expect(a.startsWith(b)).toBe(false);
    }
  });

  it('v1 и не целая мажорная — ошибка', () => {
    // Ловит: prefix(1, …) молча даёт `keykick1.` — не ключи v1, а выдуманный префикс.
    expect(() => prefix(1, 'release')).toThrow(RangeError);
    expect(() => prefix(2.5, 'next')).toThrow(RangeError);
  });
});

// --- Целые и дни -----------------------------------------------------------------------------------------------

describe('целые и дни строками (А-20)', () => {
  it('isInt: целые да, дроби, строки и NaN нет', () => {
    // Ловит: в сохранение попадает 1.5, '3' или NaN, а check их пропускает.
    expect([0, -4, 7].every(isInt)).toBe(true);
    expect([1.5, '3', NaN, Infinity, null, undefined].some(isInt)).toBe(false);
  });

  it('isInt: 2^53 и выше — не годятся (безопасные целые)', () => {
    // Ловит: rev = 2^53 принят как целое, а rev + 1 равен самому себе — сверка rev между вкладками перестаёт видеть запись.
    expect(isInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isInt(2 ** 53)).toBe(false);
    expect(isInt(-(2 ** 53))).toBe(false);
    const res = openPlayer(JSON.stringify({ ...base(), rev: 2 ** 53 }), defs);
    expect(res.kind).toBe('broken');
    if (res.kind === 'broken') expect(res.why).toContain('rev');
  });

  it('isDay: настоящие даты да; метка времени, число и несуществующий день нет', () => {
    // Ловит: день хранится числом или датой, 31 апреля и 29 февраля не високосного проходят.
    expect(isDay('2026-11-18')).toBe(true);
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2000-02-29')).toBe(true);
    for (const bad of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-1-1', 1763424000, null]) {
      expect(isDay(bad)).toBe(false);
    }
  });

  it('rev не целый или отрицательный — broken', () => {
    // Ловит: конверт с rev 1.5 или -1 открывается как годный, и сверка rev между вкладками теряет смысл.
    for (const rev of [1.5, -1, '2', null]) {
      const res = openPlayer(JSON.stringify({ ...base(), rev }), defs);
      expect(res.kind).toBe('broken');
      if (res.kind === 'broken') expect(res.why).toContain('rev');
    }
  });
});

// --- Открытие: ok ----------------------------------------------------------------------------------------------

describe('openPlayer: годный конверт', () => {
  it('новый игрок: запись → открытие даёт тот же конверт, changed=false', () => {
    // Ловит: round-trip теряет или меняет поля конверта; открытие годного помечает его изменённым и вызывает лишнюю запись.
    const env = writePlayer(base(), { club: { stars: 3, since: '2026-11-01' } });
    const res = ok(openPlayer(serializePlayer(env), defs));
    expect(res.env).toEqual(env);
    expect(res.changed).toBe(false);
  });

  it('раздела, которого в сохранении нет, добавляется пустым текущей версии', () => {
    // Ловит: игрок из прошлого выпуска не открывается из-за нового раздела (или раздел остаётся undefined и ломает экран).
    const raw = rawWith({ club: { v: 1, data: { stars: 2, since: '2026-11-02' } } });
    const res = ok(openPlayer(raw, defs));
    expect(res.changed).toBe(true);
    expect(res.env.sections['course:ru']).toEqual({ v: 3, data: { count: 0, log: [] } });
    expect(res.env.sections.club?.data).toEqual({ stars: 2, since: '2026-11-02' });
  });

  it('повторяющееся имя раздела в реестре — ошибка программиста', () => {
    // Ловит: два описания одного раздела молча перебивают друг друга при открытии.
    expect(() => openPlayer(serializePlayer(base()), [clubDef, clubDef] as SectionDef<unknown>[])).toThrow(/duplicate/);
  });
});

// --- К13: незнакомый раздел ------------------------------------------------------------------------------------

describe('К13: незнакомый раздел пишется обратно байт в байт', () => {
  const stranger = {
    v: 7,
    data: { zeta: [1, 2, { k: 'ё "\\' }], '10': 'a', '2': 'b', nested: { deep: [null, true, 0.5, -3] }, empty: {} },
  };
  const fragment = JSON.stringify(stranger);

  it('открытие и запись не меняют JSON чужого раздела и порядок его ключей', () => {
    // Ловит: ядро «нормализует» или перестраивает раздел, которого не знает, — публичная сборка портит Район из новой.
    const raw = rawWith({
      club: { v: 1, data: { stars: 1, since: '2026-11-03' } },
      'course:ru': { v: 3, data: { count: 1, log: [] } },
      'league:ru.district': stranger,
    });
    expect(raw).toContain(fragment);
    let env = ok(openPlayer(raw, defs)).env;
    env = writePlayer(env, { club: { stars: 2, since: '2026-11-03' } });
    const out = serializePlayer(env);
    expect(out).toContain(`"league:ru.district":${fragment}`);
    expect(JSON.stringify(env.sections['league:ru.district'])).toBe(fragment);
  });

  it('и после миграции соседних разделов, и после десятка записей', () => {
    // Ловит: чужой раздел страдает при миграции соседа (общий объект мутируют) или копится дрейф при повторных записях.
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 1, data: { n: 4 } },
      'league:ru.district': stranger,
    });
    const opened = ok(openPlayer(raw, defs));
    expect(opened.changed).toBe(true);
    let env = opened.env;
    for (let i = 1; i <= 10; i++) env = writePlayer(env, { club: { stars: i, since: '2026-11-03' } });
    env = ok(openPlayer(serializePlayer(env), defs)).env;
    expect(JSON.stringify(env.sections['league:ru.district'])).toBe(fragment);
  });

  it('незнакомый раздел с любой формой не делает игрока битым', () => {
    // Ловит: раздел от новой программы без v/data (или не объект) выбрасывает игрока в карантин.
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 3, data: { count: 0, log: [] } },
      odd: 'just a string',
      odd2: [1, 2],
    });
    const env = ok(openPlayer(raw, defs)).env;
    const out = JSON.parse(serializePlayer(writePlayer(env, {}))) as { sections: Record<string, unknown> };
    expect(out.sections.odd).toBe('just a string');
    expect(out.sections.odd2).toEqual([1, 2]);
  });

  it('лишнее поле верхнего уровня конверта тоже переживает запись', () => {
    // Ловит: ядро собирает конверт заново из известных полей и теряет добавленное более новой сборкой того же fmt.
    const env = ok(openPlayer(rawWith({}, { extraField: { a: 1 } }), defs)).env;
    const out = JSON.parse(serializePlayer(writePlayer(env, {}))) as { extraField?: unknown };
    expect(out.extraField).toEqual({ a: 1 });
  });
});

// --- К14: newer и broken ---------------------------------------------------------------------------------------

describe('К14: newer и broken не теряют сырое', () => {
  it('fmt больше 1 — newer, raw дословно, даже если остальная форма непонятна', () => {
    // Ловит: конверт новой формы разбирают по старым правилам, «чинят» и перезаписывают — данные ребёнка потеряны.
    const raw = '{"kind":"keykick-player","fmt":2,"blob":"x","sections":42}';
    const res = openPlayer(raw, defs);
    expect(res).toEqual({ kind: 'newer', raw });
  });

  it('раздел с v больше def.v — newer с именем раздела, raw дословно', () => {
    // Ловит: старая сборка понижает версию раздела или считает его битым и отдаёт в карантин вместо чтения.
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 4, data: { whatever: true } },
    });
    expect(openPlayer(raw, defs)).toEqual({ kind: 'newer', raw, section: 'course:ru' });
  });

  it('newer важнее broken соседнего раздела', () => {
    // Ловит: битый раздел перекрывает «новее» — игрока отправляют в карантин, а на деле он просто из будущего.
    const raw = rawWith({
      club: { v: 1, data: { stars: -5, since: 'nope' } },
      'course:ru': { v: 9, data: null },
    });
    const res = openPlayer(raw, defs);
    expect(res.kind).toBe('newer');
    if (res.kind === 'newer') expect(res.raw).toBe(raw);
  });

  it('не JSON, чужой kind, нет pid, раздел не объект — broken, raw дословно', () => {
    // Ловит: мусор в ключе игрока роняет загрузку исключением или молча заменяется новым игроком.
    const noPid = JSON.stringify({ ...base(), pid: '' });
    const cases: [string, string][] = [
      ['{"kind":"keykick-pl', 'json'],
      ['[1,2,3]', 'kind'],
      [JSON.stringify({ ...base(), kind: 'keykick-device' }), 'kind'],
      [JSON.stringify({ ...base(), fmt: 0 }), 'fmt'],
      [noPid, 'pid'],
      [JSON.stringify({ ...base(), sections: [] }), 'sections'],
      [rawWith({ club: 5, 'course:ru': { v: 3, data: { count: 0, log: [] } } }), 'section:club:shape'],
      [rawWith({ club: { v: 0, data: {} }, 'course:ru': { v: 3, data: { count: 0, log: [] } } }), 'section:club:shape'],
    ];
    for (const [raw, why] of cases) {
      const res = openPlayer(raw, defs);
      expect(res.kind).toBe('broken');
      if (res.kind === 'broken') {
        expect(res.raw).toBe(raw);
        expect(res.why).toContain(why);
      }
    }
  });

  it('раздел не прошёл check после миграции — broken с кодами, raw дословно', () => {
    // Ловит: проверка идёт до миграции (или не идёт вовсе) — битое после `up` попадает в игру.
    const raw = rawWith({
      club: { v: 1, data: { stars: 1.5, since: '2026-02-30' } },
      'course:ru': { v: 2, data: { count: 1 } },
    });
    const res = openPlayer(raw, defs);
    expect(res.kind).toBe('broken');
    if (res.kind === 'broken') {
      expect(res.raw).toBe(raw);
      expect(res.why).toEqual(['section:club:stars', 'section:club:since']);
    }
  });

  it('check смотрит данные ПОСЛЕ миграции', () => {
    // Ловит: check применён к старой форме — годные после `up` данные признаны битыми (или наоборот).
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 1, data: { n: 'seven' } }, // после up: count='seven' — не целое
    });
    const res = openPlayer(raw, defs);
    expect(res.kind).toBe('broken');
    if (res.kind === 'broken') expect(res.why).toEqual(['section:course:ru:shape']);
  });

  it('нет шага up или шаг упал — broken, исключение не выходит наружу', () => {
    // Ловит: дыра в цепочке миграции или падение `up` вешает загрузку игрока вместо карантина.
    const gap: SectionDef<unknown> = { ...courseDef(), up: { 3: (d) => d } }; // нет up[2]
    const boom: SectionDef<unknown> = {
      ...courseDef(),
      up: {
        2: () => {
          throw new Error('boom');
        },
        3: (d) => d,
      },
    };
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 1, data: { n: 1 } },
    });
    const a = openPlayer(raw, [clubDef, gap] as SectionDef<unknown>[]);
    const b = openPlayer(raw, [clubDef, boom] as SectionDef<unknown>[]);
    expect(a).toEqual({ kind: 'broken', raw, why: ['section:course:ru:no-up:2'], sections: ['course:ru'] });
    expect(b).toEqual({ kind: 'broken', raw, why: ['section:course:ru:up-failed:2'], sections: ['course:ru'] });
  });

  it('check бросил исключение — broken с кодом check-failed, исключение не выходит наружу', () => {
    // Ловит: бросающая проверка раздела вылетает из openPlayer, и загрузка игрока вешается вместо карантина.
    const boom: SectionDef<unknown> = {
      ...clubDef,
      check: () => {
        throw new Error('boom');
      },
    };
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 3, data: { count: 0, log: [] } },
    });
    const res = openPlayer(raw, [boom, courseDef()] as SectionDef<unknown>[]);
    expect(res).toEqual({ kind: 'broken', raw, why: ['section:club:check-failed'], sections: ['club'] });
  });

  it('broken по разделам: sections — имена битых разделов целиком (в них есть «:»)', () => {
    // Ловит: карантин вынужден разбирать строки why по «:» и путает имя 'course:ru' с кодом; битый раздел не назван.
    const raw = rawWith({
      club: { v: 1, data: { stars: -1, since: '2026-11-03' } },
      'course:ru': { v: 3, data: { count: 'x', log: [] } },
    });
    const res = openPlayer(raw, defs);
    expect(res.kind).toBe('broken');
    if (res.kind === 'broken') expect(res.sections).toEqual(['club', 'course:ru']);
    const one = openPlayer(
      rawWith({ club: { v: 1, data: { stars: 0, since: '2026-11-03' } }, 'course:ru': { v: 3, data: { count: 'x', log: [] } } }),
      defs,
    );
    if (one.kind === 'broken') expect(one.sections).toEqual(['course:ru']);
    else throw new Error('expected broken');
  });

  it('broken по форме конверта: поля sections нет', () => {
    // Ловит: поле sections заполняется и при битом конверте (не JSON, нет pid) — карантин ищет раздел, которого не называли.
    for (const raw of ['{"kind":"keykick-pl', JSON.stringify({ ...base(), pid: '' })]) {
      const res = openPlayer(raw, defs);
      expect(res.kind).toBe('broken');
      if (res.kind === 'broken') expect(res).not.toHaveProperty('sections');
    }
  });

  it('нет name, course не строка, раздел {v:1} без data — broken', () => {
    // Ловит: край формы пропущен — конверт без name, с числовым course или раздел без data открываются как годные.
    const { name: _name, ...noName } = base();
    void _name;
    const cases: [string, string][] = [
      [JSON.stringify(noName), 'name'],
      [JSON.stringify({ ...base(), course: 5 }), 'course'],
      [rawWith({ club: { v: 1 }, 'course:ru': { v: 3, data: { count: 0, log: [] } } }), 'section:club:shape'],
    ];
    for (const [raw, why] of cases) {
      const res = openPlayer(raw, defs);
      expect(res.kind).toBe('broken');
      if (res.kind === 'broken') {
        expect(res.raw).toBe(raw);
        expect(res.why).toContain(why);
      }
    }
  });
});

// --- К15: цепочка up -------------------------------------------------------------------------------------------

describe('К15: цепочка up раздела до текущей версии', () => {
  it('с v1 до v3: шаги 2 и 3 подряд, по порядку, данные идут из шага в шаг', () => {
    // Ловит: пропущен промежуточный шаг, шаги идут не по порядку или применяется только последний.
    const calls: number[] = [];
    const d = [clubDef, courseDef(calls)] as SectionDef<unknown>[];
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 1, data: { n: 5 } },
    });
    const res = ok(openPlayer(raw, d));
    expect(calls).toEqual([2, 3]);
    expect(res.env.sections['course:ru']).toEqual({ v: 3, data: { count: 5, log: ['from-v2'] } });
    expect(res.changed).toBe(true);
  });

  it('с v2 — только шаг 3', () => {
    // Ловит: миграция всегда стартует с первого шага и ломает данные, уже поднятые до v2.
    const calls: number[] = [];
    const d = [clubDef, courseDef(calls)] as SectionDef<unknown>[];
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 2, data: { count: 8 } },
    });
    ok(openPlayer(raw, d));
    expect(calls).toEqual([3]);
  });

  it('раздел уже текущей версии — шаги не вызываются, changed=false', () => {
    // Ловит: лишние миграции годных данных и запись при каждом открытии.
    const calls: number[] = [];
    const d = [clubDef, courseDef(calls)] as SectionDef<unknown>[];
    const res = ok(openPlayer(serializePlayer(createPlayer({ pid: 'p', name: 'n' }, d)), d));
    expect(calls).toEqual([]);
    expect(res.changed).toBe(false);
  });

  it('после миграции запись сохраняет новую версию раздела; повторное открытие ничего не меняет', () => {
    // Ловит: в конверт возвращается старая v с новыми данными — следующее открытие применит `up` второй раз.
    const raw = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 1, data: { n: 2 } },
    });
    const env = writePlayer(ok(openPlayer(raw, defs)).env, {});
    const again = ok(openPlayer(serializePlayer(env), defs));
    expect(again.changed).toBe(false);
    expect(again.env.sections['course:ru']).toEqual({ v: 3, data: { count: 2, log: ['from-v2'] } });
  });
});

// --- rev и writePlayer -----------------------------------------------------------------------------------------

describe('writePlayer: rev и неизменяемость', () => {
  it('rev растёт на 1 на каждой записи, даже пустой; исходный конверт не тронут', () => {
    // Ловит: rev не растёт (две вкладки не заметят друг друга) или запись мутирует переданный конверт.
    const e0 = base();
    const snapshot = JSON.stringify(e0);
    const e1 = writePlayer(e0, { club: { stars: 1, since: '2026-11-03' } });
    const e2 = writePlayer(e1, {});
    expect([e0.rev, e1.rev, e2.rev]).toEqual([0, 1, 2]);
    expect(JSON.stringify(e0)).toBe(snapshot);
    expect(e1.sections.club?.data).toEqual({ stars: 1, since: '2026-11-03' });
    expect(e2.app).toBe(APP_VERSION);
  });

  it('запись в раздел, которого нет в конверте — ошибка, а не молчаливое создание', () => {
    // Ловит: опечатка в имени раздела создаёт новый раздел рядом с настоящим, и данные расходятся.
    expect(() => writePlayer(base(), { clubb: {} })).toThrow(/unknown section/);
    expect(() => writePlayer(base(), { toString: {} })).toThrow(/unknown section/);
  });

  it('запись ставит текущую app, даже если конверт записан старой версией', () => {
    // Ловит: writePlayer не обновляет app — конверт навсегда числится за программой, которая его давно не писала.
    const old: Envelope = { ...base(), app: '1.9.0' };
    expect(old.app).not.toBe(APP_VERSION);
    expect(writePlayer(old, {}).app).toBe(APP_VERSION);
  });

  it('data: undefined в patch — ошибка программиста', () => {
    // Ловит: JSON теряет undefined, раздел остаётся без data, и следующее открытие объявляет игрока битым.
    expect(() => writePlayer(base(), { club: undefined })).toThrow(/undefined/);
    expect(() => writePlayer(base(), { club: null })).not.toThrow();
  });

  it('createPlayer: пустой pid — ошибка', () => {
    // Ловит: игрок с pid '' создаётся, а открытие тут же признаёт его битым (shapeProblems).
    expect(() => createPlayer({ pid: '', name: 'X' }, defs)).toThrow(/pid/);
  });

  it('запись не меняет v раздела', () => {
    // Ловит: запись сбрасывает версию раздела (например, на 1) — следующее открытие мигрирует уже новые данные.
    const env = writePlayer(base(), { 'course:ru': { count: 1, log: [] } });
    expect(env.sections['course:ru']?.v).toBe(3);
  });
});

// --- Цепочка со случайными действиями --------------------------------------------------------------------------

describe('цепочка записей и открытий с семенем', () => {
  it('200 шагов: rev строго растёт, чужой раздел неизменен, открытие своей записи возвращает то же', () => {
    // Ловит: накопление дрейфа за много циклов запись/открытие — потеря раздела, откат rev, порча чужого раздела.
    const rnd = createRandom(200);
    const strangerSection = { v: 2, data: { x: [1, 2, 3], s: 'ё', n: { a: null } } };
    const fragment = JSON.stringify(strangerSection);
    const raw0 = rawWith({
      club: { v: 1, data: { stars: 0, since: '2026-11-03' } },
      'course:ru': { v: 1, data: { n: 0 } },
      'x:future': strangerSection,
    });
    let env = ok(openPlayer(raw0, defs)).env;
    let prevRev = env.rev;
    for (let i = 0; i < 200; i++) {
      const action = pick(rnd, ['club', 'course', 'empty', 'reopen'] as const);
      if (action === 'club') env = writePlayer(env, { club: { stars: randomInt(rnd, 1000), since: '2026-11-18' } });
      else if (action === 'course') env = writePlayer(env, { 'course:ru': { count: randomInt(rnd, 50), log: [] } });
      else if (action === 'empty') env = writePlayer(env, {});
      else {
        const res = ok(openPlayer(serializePlayer(env), defs));
        expect(res.changed).toBe(false);
        expect(res.env).toEqual(env);
        env = res.env;
        continue;
      }
      expect(env.rev).toBe(prevRev + 1);
      prevRev = env.rev;
      expect(JSON.stringify(env.sections['x:future'])).toBe(fragment);
    }
    expect(Object.keys(env.sections).sort()).toEqual(['club', 'course:ru', 'x:future']);
  });
});

describe('check разделов day, stadium, wallet (066 Т6)', () => {
  const defs = [
    { def: dayDef, counters: ['played', 'days', 'todayN'] },
    { def: stadiumDef, counters: ['fans', 'goals'] },
    { def: walletDef, counters: ['coins'] },
  ] as const;
  const badNumbers: [string, unknown][] = [['-1', -1], ['1.5', 1.5], ['NaN', NaN], ["'3'", '3'], ['Infinity', Infinity]];

  // Ловит: из isRecord убран `!Array.isArray` (массив прошёл бы дальше и дал имена полей вместо ['shape']);
  // целый раздел неверного типа принят за данные.
  it.each(defs)('$def.name: целый раздел — не объект → [shape]', ({ def }) => {
    for (const bad of [null, [], [1, 2], 3, 'x', true]) expect(def.check(bad)).toEqual(['shape']);
  });

  // Ловит: пустой и «лишнее поле» раздел отвергнуты; в проверку попали лишние имена.
  it.each(defs)('$def.name: пустой раздел и лишнее поле — годны', ({ def }) => {
    expect(def.check(def.empty())).toEqual([]);
    expect(def.check({ ...def.empty(), extra: 'x', more: [1] })).toEqual([]);
  });

  // Ловит: из списка счётчиков убрано имя ('goals', 'todayN', …) — порча этого поля не замечена; счётчик принимает
  // отрицательное, дробное, NaN, строку, бесконечность или отсутствует без отказа; причина названа чужим именем.
  it.each(defs.flatMap(({ def, counters }) => counters.map((c) => ({ name: def.name, def, c }))))(
    '$name.$c: отсутствует, -1, 1.5, NaN, строка, Infinity → [$c]',
    ({ def, c }) => {
      const absent: Record<string, unknown> = { ...def.empty() };
      delete absent[c];
      expect(def.check(absent)).toEqual([c]);
      for (const [, v] of badNumbers) expect(def.check({ ...def.empty(), [c]: v })).toEqual([c]);
      expect(def.check({ ...def.empty(), [c]: 7 })).toEqual([]);
    },
  );

  // Ловит: у day не проверены today (не день) и last (не целое/отрицательное); у wallet — rest (≥ coinPer, дробь) и paid
  // (не массив, длиннее PAID_KEEP, не строки, строка длиннее 80); несколько порч сразу — список в порядке проверки.
  it('day и wallet: прочие поля и несколько порч сразу', () => {
    for (const v of ['2026-02-30', 'x', 5, undefined]) expect(dayDef.check({ ...dayDef.empty(), today: v })).toEqual(['today']);
    expect(dayDef.check({ ...dayDef.empty(), today: '2026-11-18', last: 1700000000000 })).toEqual([]);
    for (const v of [-1, 1.5, NaN, '3', undefined]) expect(dayDef.check({ ...dayDef.empty(), last: v })).toEqual(['last']);
    for (const v of [-1, 1.5, NaN, '3', Infinity, 20, undefined]) expect(walletDef.check({ ...walletDef.empty(), rest: v })).toEqual(['rest']);
    expect(walletDef.check({ ...walletDef.empty(), rest: 19 })).toEqual([]);
    for (const v of ['a', {}, undefined, [1], ['a', 'b', 'c', 'd', 'e'], ['x'.repeat(81)]]) expect(walletDef.check({ ...walletDef.empty(), paid: v })).toEqual(['paid']);
    expect(walletDef.check({ ...walletDef.empty(), paid: ['a', 'b', 'c', 'd'] })).toEqual([]);
    expect(dayDef.check({ played: -1, days: 1.5, todayN: NaN, today: 'x', last: -5 })).toEqual(['played', 'days', 'todayN', 'today', 'last']);
    expect(walletDef.check({ coins: -1, rest: -1, paid: 1 })).toEqual(['coins', 'rest', 'paid']);
  });
});

/**
 * Разделы волны 4 (067 Т1, К7): миграция school и таблица `check` из design §7. Подготовка — только определения разделов.
 * У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { albumDef } from '../../src/engine/album/section';
import { coachDef } from '../../src/engine/coach/section';
import { baseDef } from '../../src/engine/base/section';
import { learnDef } from '../../src/engine/learn/section';
import { pathDef } from '../../src/engine/path/section';
import { migrateSection } from '../../src/engine/save/section';
import { schoolDef } from '../../src/engine/school/section';
import { shopDef } from '../../src/engine/shop/section';

describe('разделы волны 4 (067 Т1, К7)', () => {
  it('К7: school v1 → v2 сохраняет «Знатока», остальные поля — пустые; битое v1 не падает', () => {
    // Ловит: миграция теряет накопленного «Знатока» (дети уже набрали пенальти) или оставляет v2 без полей, и check его отвергает.
    const up = migrateSection(schoolDef, 1, { knower: 7 });
    expect(up).toEqual({ ok: true, data: { ...schoolDef.empty(), knower: 7 } });
    expect(schoolDef.check((up as { data: unknown }).data)).toEqual([]);
    expect(schoolDef.v).toBe(2);
  });

  it('К7: испорченное school v1 не обнуляется молча — check отвергает, раздел уходит в карантин', () => {
    // Ловит: миграция превращает `{knower:1.5}`, `{knower:"5"}`, `null` в пустой раздел и ребёнок молча теряет «Знатока».
    for (const bad of [{ knower: 1.5 }, { knower: '5' }, { knower: -3 }, {}, null, [1]]) {
      const up = migrateSection(schoolDef, 1, bad) as { ok: boolean; data: unknown };
      expect(up.ok).toBe(true);
      expect(schoolDef.check(up.data), JSON.stringify(bad)).not.toEqual([]);
    }
  });

  it('К7: check новых разделов — пустое годно, порча по таблице design §7 отвергается', () => {
    // Ловит: раздел принимает показ пака больше выданных, класс вне 1…8, третью игру на интерес за день, лигу-выдумку, чужую вещь.
    for (const d of [pathDef, albumDef, shopDef, learnDef, baseDef]) expect(d.check(d.empty()), d.name).toEqual([]);
    expect(pathDef.check({ entries: { yard: 3, mars: 1 } })).toEqual(['entries']);
    expect(pathDef.check({ entries: { yard: 4 } })).toEqual(['entries']);
    expect(pathDef.check({ entries: { yard: 3 } })).toEqual([]);
    expect(albumDef.check({ packs: 1, shown: 1, worn: 'Bad Id', prize: [] })).toEqual(['worn']);
    expect(albumDef.check({ packs: 2, shown: 3, worn: null, prize: [] })).toEqual(['shown']);
    expect(albumDef.check({ packs: 1, shown: 1, worn: null, prize: ['a', 'a'] })).toEqual(['prize']);
    expect(shopDef.check({ bought: ['drum', 'drum'] })).toEqual(['bought']);
    expect(shopDef.check({ bought: ['no-such-thing'] })).toEqual(['bought']);
    expect(shopDef.check({ bought: ['drum', 'banner'] })).toEqual([]);
    expect(learnDef.check({ games: { a: { step: 4, plays: 0, best: null, last: null } }, recent: ['a', 'b', 'c', 'd'] })).toEqual(['games', 'recent']);
    expect(baseDef.check({ day: '2026-02-30', today: 3, records: { x: -1 }, lastN: {}, played: [], last: null, seen: [] })).toEqual(['day', 'today', 'records']);
    expect(schoolDef.check({ ...schoolDef.empty(), grade: 9, emblem: 1024, level: { a: 4 } })).toEqual(['grade', 'emblem', 'level']);
  });

  it('К7: school.check — журнал туров, решённые, медаль: границы', () => {
    // Ловит: журнал длиннее 400 туров, решённых больше 500, медаль 4 проходят в сохранение.
    const tour = { n: 1, kind: 'a', medal: 3, first: 0, day: '2026-02-03' };
    const sc = (o: object) => schoolDef.check({ ...schoolDef.empty(), ...o });
    expect(sc({ tours: Array.from({ length: 400 }, () => tour) })).toEqual([]);
    expect(sc({ tours: Array.from({ length: 401 }, () => tour) })).toEqual(['tours']);
    expect(sc({ tours: [{ ...tour, medal: 4 }] })).toEqual(['tours']);
    expect(sc({ solved: Array.from({ length: 500 }, () => 'ru.a') })).toEqual([]);
    expect(sc({ solved: Array.from({ length: 501 }, () => 'ru.a') })).toEqual(['solved']);
  });
});

describe('раздел coach: check (067 Т24, К1)', () => {
  it('К1: пусто — годно; ключ «A», « », «аб», окно «012», 301 бит, 65 ключей, не объект — ошибки', () => {
    // Ловит: битое сохранение проходит в игру или годное уходит в карантин.
    expect(coachDef.check(coachDef.empty())).toEqual([]);
    expect(coachDef.check({ keys: { ы: '1'.repeat(300), ж: '' } })).toEqual([]);
    for (const bad of [{ keys: { A: '1' } }, { keys: { ' ': '1' } }, { keys: { аб: '1' } }, { keys: { 1: '1' } }, { keys: { ы: '012' } }, { keys: { ы: '1'.repeat(301) } }, { keys: { ы: 1 } }]) {
      expect(coachDef.check(bad), JSON.stringify(bad)).not.toEqual([]);
    }
    const letters = Array.from({ length: 0x500 }, (_, i) => String.fromCodePoint(0x61 + i)).filter((c) => /^\p{Ll}$/u.test(c));
    const of = (n: number) => ({ keys: Object.fromEntries(letters.slice(0, n).map((c) => [c, '1'])) });
    expect(coachDef.check(of(64))).toEqual([]);
    expect(coachDef.check(of(65))).toEqual(['keys:count']);
    for (const bad of [null, [], 3, {}, { keys: [] }, { keys: null }]) expect(coachDef.check(bad)).toEqual(['shape']);
    expect(coachDef.v).toBe(1);
  });
});


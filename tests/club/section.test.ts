/**
 * Раздел `club` (063-Р6, К8): пустое значение, проверка полей, форма из палитр. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import clubs from '../../src/content/clubs.json';
import { BACK_NAME_MAX, CITY_MAX, NAME_MAX, NUMBER_MAX, clubDef, defaultKit } from '../../src/engine/club/section';
import { migrateSection } from '../../src/engine/save/section';

const full = () => ({
  name: 'Метеор',
  kit: { pattern: 'stripes', body: '#c8102e', alt: '#ffffff', sleeves: '#c8102e', trim: '#16161a' },
  city: 'Тверь',
  coach: 'young',
  backName: 'САША',
  backNumber: 10,
});

describe('раздел club (К8)', () => {
  it('К8: пустой раздел годен по собственной проверке, а форма по умолчанию — первая палитра clubs.json', () => {
    // Ловит: новый игрок создаётся с разделом, который не проходит `check` (запись игрока отказала бы с `invalid`); форма по умолчанию уехала из палитры.
    expect(clubDef.check(clubDef.empty())).toEqual([]);
    expect(clubDef.empty().kit).toEqual(defaultKit());
    expect(defaultKit()).toMatchObject({ pattern: clubs.palettes[0]!.pattern, body: clubs.palettes[0]!.body });
  });

  it('К8: заполненный клуб, форма с `split` в рукавах и без `alt`, и все палитры clubs.json — годны', () => {
    // Ловит: проверка строже содержимого: настоящие палитры (рукава `split`, нет `alt`) объявлены битыми.
    expect(clubDef.check(full())).toEqual([]);
    for (const p of clubs.palettes) expect(clubDef.check({ ...full(), kit: p })).toEqual([]);
  });

  it('К8: границы длины — на пределе годно, на единицу больше — код поля', () => {
    // Ловит: потолок длины сдвинут (длинное имя ломает табло) или проверка длины забыта.
    expect(clubDef.check({ ...full(), name: 'а'.repeat(NAME_MAX), city: 'б'.repeat(CITY_MAX), backName: 'в'.repeat(BACK_NAME_MAX) })).toEqual([]);
    expect(clubDef.check({ ...full(), name: 'а'.repeat(NAME_MAX + 1) })).toEqual(['name']);
    expect(clubDef.check({ ...full(), city: 'б'.repeat(CITY_MAX + 1) })).toEqual(['city']);
    expect(clubDef.check({ ...full(), backName: 'в'.repeat(BACK_NAME_MAX + 1) })).toEqual(['backName']);
  });

  it('К8: номер на спине — целое 0–99', () => {
    // Ловит: номер 100, дробь, строка или NaN попадают в сохранение.
    for (const n of [0, 1, NUMBER_MAX]) expect(clubDef.check({ ...full(), backNumber: n })).toEqual([]);
    for (const n of [-1, NUMBER_MAX + 1, 1.5, '7', Number.NaN, null]) expect(clubDef.check({ ...full(), backNumber: n })).toEqual(['backNumber']);
  });

  it('К8: чужая форма данных — коды ошибок без падения (не объект, массив, цвет не #rrggbb, лишний тип полей)', () => {
    // Ловит: `check` бросает на мусоре (игрок станет `check-failed`) или пропускает цвет, который нечем нарисовать.
    for (const bad of [null, undefined, 7, 'x', [], [full()]]) expect(clubDef.check(bad)).toEqual(['shape']);
    expect(clubDef.check({ ...full(), kit: { ...full().kit, body: 'red' } })).toEqual(['kit:body']);
    expect(clubDef.check({ ...full(), kit: { ...full().kit, sleeves: '#fff' } })).toEqual(['kit:sleeves']);
    expect(clubDef.check({ ...full(), kit: { ...full().kit, alt: 5 } })).toEqual(['kit:alt']);
    expect(clubDef.check({ ...full(), kit: null })).toEqual(['kit']);
    expect(clubDef.check({ ...full(), name: 5, coach: null })).toEqual(['name', 'coach']);
  });

  it('К8: версия 1 — шагов `up` нет, миграция с v1 возвращает данные как есть', () => {
    // Ловит: версия поднята без шага `up` (раздел старых игроков станет `no-up` и игрок — битым).
    expect(Object.keys(clubDef.up)).toEqual([]);
    const data = full();
    expect(migrateSection(clubDef as never, 1, data)).toEqual({ ok: true, data });
  });
});

/**
 * Раздел `course:<курс>` и «куда продолжать» (063-Р6, К8): форма прогресса, первый урок по настоящему пакету,
 * `current` вне `order`. У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { FIRST_LESSON, courseDef, ruCourseDef } from '../../src/engine/course/section';
import { resumeLesson } from '../../src/engine/course/resume';
import { courseLessons } from './yard';

const mark = (over: object = {}) => ({ stars: 2, best: 80, tries: 1, done: '2026-11-02', ...over });
const progress = (over: object = {}) => ({ current: 'ru.yard.ao', lessons: {}, archive: {}, leaguesDone: {}, ...over });
const ORDER = ['ru.yard.ao', 'ru.yard.ao-pairs', 'ru.yard.vl'];

describe('раздел course:ru (К8)', () => {
  it('К8: имя раздела по курсу, пустой раздел годен и начинается с первого урока Двора из пакета', () => {
    // Ловит: константа первого урока разошлась с порядком пакета (новый игрок стартует с несуществующего урока).
    expect(ruCourseDef.name).toBe('course:ru');
    expect(courseDef('en', 'en.yard.a').name).toBe('course:en');
    expect(ruCourseDef.check(ruCourseDef.empty())).toEqual([]);
    expect(ruCourseDef.empty().current).toBe(FIRST_LESSON.ru);
    expect(courseLessons.filter((l) => l.league === 'yard')[0]!.id).toBe(FIRST_LESSON.ru);
  });

  it('К8: отметки — звёзды 0–3, целые, день — настоящая дата; в архиве то же правило', () => {
    // Ловит: звёзды 4, дробные попытки или выдуманная дата в сохранении (дальше `reconcile` и напоминание считают по ним).
    expect(ruCourseDef.check(progress({ lessons: { 'ru.yard.ao': mark(), 'ru.yard.vl': { stars: 0, best: 0, tries: 0 } }, archive: { 'ru.yard.old': mark() } }))).toEqual([]);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ stars: 4 }) } }))).toEqual(['mark:stars']);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ best: 1.5 }) } }))).toEqual(['mark:best']);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ tries: -1 }) } }))).toEqual(['mark:tries']);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ done: '2026-13-01' }) } }))).toEqual(['mark:done']);
    expect(ruCourseDef.check(progress({ archive: { a: mark({ stars: -1 }) } }))).toEqual(['mark:stars']);
    expect(ruCourseDef.check(progress({ lessons: { a: null } }))).toEqual(['mark']);
    expect(ruCourseDef.check(progress({ leaguesDone: { yard: 'вчера' } }))).toEqual(['leaguesDone']);
  });

  it('К8: чужая форма — коды без падения; `current` не пустая строка', () => {
    // Ловит: `check` бросает на мусоре; пустой `current` проходит и Дом не знает, куда вести.
    for (const bad of [null, 3, 'x', []]) expect(ruCourseDef.check(bad)).toEqual(['shape']);
    expect(ruCourseDef.check(progress({ current: '' }))).toEqual(['current']);
    expect(ruCourseDef.check(progress({ current: 5 }))).toEqual(['current']);
    expect(ruCourseDef.check(progress({ lessons: [] }))).toEqual(['shape']);
  });

  it('К8: `current` закрытого пакета (вне `order`) раздел пропускает: он годен, ведёт Дом `resumeLesson`', () => {
    // Ловит: сохранение с уроком из пакета, которого в этой сборке нет, объявлено битым (ребёнок теряет клуб).
    expect(ruCourseDef.check(progress({ current: 'ru.district.zz' }))).toEqual([]);
  });
});

describe('resumeLesson: `current` вне `order` (К8)', () => {
  it('К8: `current` в порядке — он и есть; вне порядка — первый непройденный Двора; сохранение не меняется', () => {
    // Ловит: Дом ведёт в несуществующий урок (пустой Дом) или «чинит» сохранение, затирая урок закрытого пакета.
    const p = progress({ current: 'ru.district.zz', lessons: { 'ru.yard.ao': mark(), 'ru.yard.ao-pairs': { stars: 0, best: 0, tries: 2 } } });
    const before = JSON.stringify(p);
    expect(resumeLesson(p, ORDER)).toBe('ru.yard.ao-pairs');
    expect(JSON.stringify(p)).toBe(before);
    expect(resumeLesson(progress({ current: 'ru.yard.vl' }), ORDER)).toBe('ru.yard.vl');
  });

  it('К8: пройденным считается урок со звёздами или с днём; все пройдены — первый; порядок пуст — null', () => {
    // Ловит: «пройден» только по звёздам (урок с `done` и 0 звёзд зациклит Дом) или падение на пустом порядке.
    const done0 = { stars: 0, best: 0, tries: 1, done: '2026-11-01' };
    expect(resumeLesson(progress({ current: 'x', lessons: { 'ru.yard.ao': done0 } }), ORDER)).toBe('ru.yard.ao-pairs');
    const all = Object.fromEntries(ORDER.map((id) => [id, mark()]));
    expect(resumeLesson(progress({ current: 'x', lessons: all }), ORDER)).toBe('ru.yard.ao');
    expect(resumeLesson(progress({ current: 'x' }), [])).toBeNull();
  });
});

describe('К1: отметка урока v2 — провалы подряд и помощь (065-Р9)', () => {
  it('К1: up v1 → v2 дописывает fails: 0 в уроки и архив, остальное цело; v2 принимает fails, back, bestAcc', () => {
    // Ловит: потерю отметок при подъёме формата, отсутствие счётчика после миграции.
    expect(ruCourseDef.v).toBe(2);
    const old = progress({ lessons: { a: mark() }, archive: { b: mark({ stars: 1 }) } });
    const up = ruCourseDef.up[2]!(old) as { lessons: Record<string, object>; archive: Record<string, object> };
    expect(up.lessons.a).toEqual({ ...mark(), fails: 0 });
    expect(up.archive.b).toEqual({ ...mark({ stars: 1 }), fails: 0 });
    expect(ruCourseDef.check(up)).toEqual([]);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ fails: 3, back: true, bestAcc: 970 }) } }))).toEqual([]);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ fails: -1 }) } }))).toEqual(['mark:fails']);
    expect(ruCourseDef.check(progress({ lessons: { a: mark({ back: 1 }) } }))).toEqual(['mark:back']);
  });
});

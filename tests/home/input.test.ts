/**
 * Вход Дома из разделов (065 Т7, К-Д): `app/home/input.ts` собирает `HomeInput` из разделов сеанса. На фикстурах стенда
 * (`tests/fixtures/accepted/home.*.json`) поля, которые считаются из разделов, совпадают с входом макета (`fx.home`).
 * Метка «К7» — кадры Дома собираются из сохранения, а не подкладываются целиком.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tabloLine } from '../../src/app/home/texts';
import { currentLesson, gameDay, homeInputOf, pausedLong } from '../../src/app/home/input';
import { previewInputOf } from '../../src/app/home/preview';
import { newStepId, rng, sceneOf, seatsOf, shieldOf, stepGrew } from '../../src/app/home/scene';
import { feetOf, keeperFile, nextGroupFrom, teamOf } from '../../src/app/home/team';
import cfg from '../../src/content/yard.json';
import { homeView } from '../../src/engine/home';

const dir = new URL('../fixtures/accepted/', import.meta.url);
const lessons = JSON.parse(readFileSync(new URL('../../src/content/packs/ru.yard/lessons.json', import.meta.url), 'utf8')) as { order: string[]; lessons: Record<string, { friendly?: boolean }> };
const facts = { order: lessons.order, friendly: new Set(Object.entries(lessons.lessons).filter(([, l]) => l.friendly).map(([id]) => id)) };
type Fx = { clock: { day: string }; sections: Record<string, never>; home: Record<string, unknown> };
const fixtures = readdirSync(dir).filter((f) => f.startsWith('home.')).map((f) => [f, JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as Fx] as const);

describe('вход Дома из разделов', () => {
  it.each(fixtures)('К7 %s: урок, день, матчи, звёзды, монеты, болельщики — из разделов', (_f, fx) => {
    const s = fx.sections as never as { 'course:ru': never; day: never; wallet: never; stadium: never };
    const i = homeInputOf({ course: s['course:ru'], day: s.day, wallet: s.wallet, stadium: s.stadium }, facts, {}, fx.clock.day);
    const h = fx.home as { cur: number; day: number; matchesToday: number; played: number; stars: Record<string, number>; coins: number; fans: number; pause5: boolean };
    expect(i.cur).toBe(h.cur);
    expect(i.matchesToday).toBe(h.matchesToday);
    expect(i.played).toBe(h.played);
    expect(i.coins).toBe(h.coins);
    expect(i.fans).toBe(h.fans);
    expect(i.pause5).toBe(h.pause5);
    for (const [n, st] of Object.entries(h.stars)) if (st > 0) expect(i.stars[Number(n)]).toBe(st);
  });

  it('К7 край: current вне порядка — первый непройденный; Двор пройден — 33', () => {
    const done = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { stars: 1 as const, best: 0, tries: 1, done: '2026-11-10' }]));
    const three = done(facts.order.slice(0, 3));
    expect(currentLesson({ current: 'ru.yard.нет', lessons: three, archive: {}, leaguesDone: {} }, facts.order)).toBe(4);
    const all = done(facts.order);
    expect(currentLesson({ current: facts.order[31]!, lessons: all, archive: {}, leaguesDone: {} }, facts.order)).toBe(33);
    expect(currentLesson({ current: 'x', lessons: all, archive: {}, leaguesDone: {} }, facts.order)).toBe(33);
  });

  it('К7 край: день по счёту и пауза ≥ 5 дней', () => {
    const d = { played: 4, days: 3, today: '2026-11-10', todayN: 1, last: Date.parse('2026-11-10T12:00:00Z') };
    expect(gameDay(d, '2026-11-10')).toBe(3);
    expect(gameDay(d, '2026-11-11')).toBe(4);
    expect(pausedLong(d, '2026-11-14')).toBe(false);
    expect(pausedLong(d, '2026-11-15')).toBe(true);
    expect(pausedLong({ played: 0, days: 0, today: null, todayN: 0, last: null }, '2026-11-15')).toBe(false);
  });
});

describe('сцена Дома', () => {
  const input = (cur: number, fans: number) => ({ cur, day: 5, matchesToday: 1, played: 20, stars: {}, best: 0, coins: 0, fans, bought: [], friendly: false, round: null, end: false, region: false, pause5: false, extras: {} });

  it('К7: основа — по числу построенных ступеней, люди — по болельщикам, повтор с тем же семенем одинаков', () => {
    const i = input(19, 6000);
    const v = homeView(i);
    const a = sceneOf(i, v, 7);
    expect(a.base).toBe(`art/home/base-${v.stadium.built}.webp`);
    expect(a.people.length).toBeGreaterThan(0);
    expect(sceneOf(i, v, 7)).toEqual(a);
    const none = input(19, 0);
    expect(sceneOf(none, homeView(none), 7).people).toHaveLength(0);
  });

  // Команда на поле (Т7д, Р180). Ловит: игрок появился не с тем уроком / не на своём месте; контур показан не той группе или остался
  // после того, как все пришли; бутсы или форма вратаря не по покупкам и уроку; пропавший или лишний слой в сцене.
  const players = (cur: number, bought: string[] = []) => teamOf(cur, bought, 4).filter((p) => /^team-\d+$/.test(p.key));
  const isOutline = (f: string) => f.includes('team-o');

  it('К7 Ловит: день 1 — вратарь и четыре белых контура («большие»), игроков ещё нет; контур — не игрок', () => {
    const t = teamOf(1, [], 0);
    expect(t[0]!.key).toBe('team-k');
    const rest = t.slice(1);
    expect(rest).toHaveLength(4);
    expect(rest.every((p) => isOutline(p.file))).toBe(true);
  });

  it('К7 Ловит: игроки приходят группами по урокам (2 — четверо, 4 — ещё двое, 7 — ещё двое, 11 — все десять), контур — только следующей группе', () => {
    const count = (cur: number) => [players(cur).filter((p) => !isOutline(p.file)).length, players(cur).filter((p) => isOutline(p.file)).length];
    expect(count(2)).toEqual([4, 2]);
    expect(count(3)).toEqual([4, 2]);
    expect(count(4)).toEqual([6, 2]);
    expect(count(7)).toEqual([8, 2]);
    expect(count(11)).toEqual([10, 0]);
    expect(count(33)).toEqual([10, 0]);
    expect([nextGroupFrom(1), nextGroupFrom(4), nextGroupFrom(7), nextGroupFrom(11)]).toEqual([2, 7, 11, null]);
  });

  it('К7 Ловит: «фото» газеты — без белого контура следующей группы', () => {
    expect(teamOf(1, [], 0, false)).toHaveLength(1);
    expect(teamOf(3, [], 1, false)).toHaveLength(5);
  });

  it('К7 Ловит: бутсы игроков — кеды до покупки, «дворовые» после, «коробка» главнее «дворовых»', () => {
    expect([feetOf([]), feetOf(['boots-yard']), feetOf(['boots-box']), feetOf(['boots-yard', 'boots-box'])]).toEqual(['s', 'b', 'x', 'x']);
    expect(players(11)[0]!.file).toMatch(/s\.webp$/);
    expect(players(11, ['boots-yard'])[0]!.file).toMatch(/b\.webp$/);
    expect(players(11, ['boots-box']).every((p) => p.file.endsWith('x.webp'))).toBe(true);
  });

  it('К7 Ловит: вратарь — клубная форма до урока 28, призовая с 28; ноги за ближней сеткой — со ступени 4', () => {
    expect(keeperFile(27, 3)).toBe('art/home/team-k.webp');
    expect(keeperFile(28, 3)).toBe('art/home/team-kp.webp');
    expect(keeperFile(10, 4)).toBe('art/home/team-kn.webp');
    expect(keeperFile(33, 10)).toBe('art/home/team-kpn.webp');
  });

  it('К7 Ловит: ступни стоят на своих местах кадра — вратарь (644, 770), передний ряд на 800, задний на 728; игроки симметрично по центру', () => {
    const t = teamOf(33, [], 10);
    const feet = (p: { y: number; h: number }) => Math.round(p.y + p.h - 4);
    expect(feet(t[0]!)).toBe(770);
    expect(Math.round(t[0]!.x + t[0]!.w / 2)).toBe(644);
    expect(t.slice(1).map((p) => feet(p)).sort()).toEqual([728, 728, 728, 728, 728, 728, 800, 800, 800, 800]);
    expect(new Set(t.map((p) => p.key)).size).toBe(t.length);
  });

  it('К7 Ловит: сцена Дома отдаёт команду по уроку и покупкам (слой не потерян)', () => {
    const i = { ...input(3, 0), bought: ['boots-yard'] };
    const s = sceneOf(i, homeView(i), 1);
    expect(s.team).toEqual(teamOf(3, ['boots-yard'], homeView(i).stadium.built));
    expect(s.team.length).toBeGreaterThan(1);
  });

  // Ловит: щит нарисован до дня 2 или не по числу частей эмблемы; части вылезли за 0…10; щит пропал из слоёв сцены.
  it('К7 Ловит: щит «Школы» — со дня 2 (урок 3), число частей — по эмблеме, край 0…10', () => {
    expect(shieldOf(1, 0)).toBeNull();
    expect(shieldOf(2, 5)).toBeNull();
    expect(shieldOf(3, 0)!.file).toBe('art/home/shield-0.webp');
    expect(shieldOf(10, 7)!.file).toBe('art/home/shield-7.webp');
    expect(shieldOf(33, 10)!.file).toBe('art/home/shield-10.webp');
    expect(shieldOf(33, 99)!.file).toBe('art/home/shield-10.webp');
    expect(shieldOf(33, -1)!.file).toBe('art/home/shield-0.webp');
    const i = { ...input(5, 0), extras: { emblemN: 4 } };
    expect(sceneOf(i, homeView(i), 1).over.find((p) => p.key === 'shield')!.file).toBe('art/home/shield-4.webp');
    const day1 = input(1, 0);
    expect(sceneOf(day1, homeView(day1), 1).over.some((p) => p.key === 'shield')).toBe(false);
  });

  it('К7: места рядов — без дырки под столб табло; семя даёт одно и то же', () => {
    expect(seatsOf([[10, 0, 100, 20]], 30)).toHaveLength(3);
    expect(seatsOf([[10, 0, 100, 20]], 30, [[40, 60]]).length).toBeLessThan(3);
    expect(rng(5)()).toBe(rng(5)());
  });

  it('К7: «ступень выросла» — только если прошлый показ был и ступеней стало больше; баннер — урок после порога, ворота не объявляем', () => {
    expect(stepGrew(null, 4)).toBe(false);
    expect(stepGrew(3, 3)).toBe(false);
    expect(stepGrew(3, 4)).toBe(true);
    expect(newStepId(19, cfg.steps)).toBe('stand');
    expect(newStepId(3, cfg.steps)).toBeNull();
    expect(newStepId(17, cfg.steps)).toBeNull();
    // К7 край (Р80, кадр Э2.91): возврат после паузы ≥ 5 дней — ступень не новая, баннера нет
    expect(newStepId(25, cfg.steps)).toBe('floodlight');
    expect(newStepId(25, cfg.steps, true)).toBeNull();
  });

  it('К7 край: надпись табло — «КУБОК» у пройденного Двора, «3:1» с анимацией гола, число и «+» сверх мест', () => {
    expect(tabloLine({ kind: 'fans', n: 11780, goal: false }, 22)).toBe('11\u00a0780');
    expect(tabloLine({ kind: 'over', n: 5580, goal: false }, 25)).toBe('+5\u00a0580');
    expect(tabloLine({ kind: 'over', n: 5580, goal: true }, 25)).toBe('3:1');
    expect(tabloLine({ kind: 'none', n: 0, goal: true }, 33)).toBe('КУБОК');
  });

  it('К7 витрина (063-Р61): выдуманный игрок на уроке 17 даёт тот же вход Дома, что сохранение кадра Э2.04 (home.mid)', () => {
    const fx = fixtures.find(([f]) => f === 'home.mid.json')![1];
    const s = fx.sections as never as { 'course:ru': never; day: never; wallet: never; stadium: never };
    const real = homeInputOf({ course: s['course:ru'], day: s.day, wallet: s.wallet, stadium: s.stadium }, facts, {}, fx.clock.day);
    const shown = previewInputOf(lessons.order, 17, fx.clock.day);
    for (const k of ['cur', 'day', 'matchesToday', 'played', 'stars', 'best', 'coins', 'fans', 'friendly', 'pause5'] as const) expect(shown[k], k).toEqual(real[k]);
  });

  it('К7 край: витрина не зависит от пакета целиком — порядок короче урока: текущий пуст, падения нет', () => {
    expect(previewInputOf(['a', 'b'], 17, '2026-11-18').cur).toBe(3);
  });
});

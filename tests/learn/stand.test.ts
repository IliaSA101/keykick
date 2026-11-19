/**
 * Стенд учебных игр 1–4 (067 Т17, К-Г, кадры Э8.01–12, 28): фикстуры `learn-*` собираются в окно через `learnStandOf` → `frameFlow`,
 * Другая подготовка, чем в `learn.test.ts`: готовые фикстуры стенда. У теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { isFormsPlay } from '../../src/app/learn/run';
import { endPrimary } from '../../src/app/learn/view';
import { rivalBodyOf } from '../../src/engine/club/rival';
import { rivalOf } from '../../src/engine/cup/teams';
import { learnStandOf } from '../../src/screens/dev/learnStand';
import type { FrameFixture } from '../../src/screens/dev/frameSession';

const files = import.meta.glob<FrameFixture>('../fixtures/accepted/learn-*.json', { eager: true, import: 'default' });
const all = Object.entries(files).map(([path, fx]) => [path.replace(/^.*\/|\.json$/g, ''), fx] as const);
const GAMES = ['arrows', 'mouse', 'tab', 'puzzle', 'pick', 'board', 'sheet', 'pairs'];
/** Итог кадров Э8: «Табло» — бронза с тремя промахами, «Пары» — золото на повторе (монет нет, рекорд), остальные — серебро с одним промахом. */
const END: Record<string, { step: number; misses: number; record: boolean }> = { board: { step: 1, misses: 3, record: false }, pairs: { step: 3, misses: 0, record: true } };

describe('К4: стенд учебных игр 1–8 (067 Т17, Т18)', () => {
  it('К4: фикстуры — восемь игр × старт, игра, итог и старт на Базе; каждая собирается в окно нужного шага', () => {
    // Ловит: кадр Э8 снимается без окна (игра не открылась по разделам фикстуры, пустая очередь) или не в том шаге: «игра» показывает старт, «итог» — игру.
    const ids = GAMES.flatMap((g) => ['start', 'play', 'end'].map((s) => `learn-${g}.${s}`));
    expect(all.map(([id]) => id).sort()).toEqual([...ids, 'learn-arrows.start-base'].sort());
    for (const [id, fx] of all) {
      const st = learnStandOf(fx);
      expect(st, id).not.toBeNull();
      expect(st!.flow.step, id).toBe(fx.learn!.step);
      expect(st!.flow.place, id).toBe(fx.learn!.place);
      expect(st!.flow.play === null, id).toBe(fx.learn!.step === 'start');
    }
  });

  it('К4: «игра» — один промах и время с листа; «итог» — серебро с готовым видом; «старт» первого раза — без прежней ступени', () => {
    // Ловит: промахи и время кадра не доходят до окна (красная полоса и «0:21» не те), итог без вида награды, метка «новое» не там.
    for (const g of GAMES) {
      const play = learnStandOf(files[`../fixtures/accepted/learn-${g}.play.json`]!)!;
      expect(play.flow.play!.s.misses, g).toBe(1);
      expect(play.miss, g).not.toBeNull();
      const end = learnStandOf(files[`../fixtures/accepted/learn-${g}.end.json`]!)!;
      const want = END[g] ?? { step: 2, misses: 1, record: false };
      expect(end.flow.view, g).toMatchObject({ step: want.step, record: want.record, ...(want.step === 3 ? { coins: 0 } : {}) });
      expect(end.flow.run!.misses, g).toBe(want.misses);
      expect(end.flow.run!.ms, g).toBe(end.flow.view!.ms);
      expect(learnStandOf(files[`../fixtures/accepted/learn-${g}.start.json`]!)!.before, g).toEqual({ step: 0, best: null });
    }
  });

  it('К4: Э8.28 — старт повтором на Базе: «Пас стрелками» на серебре, лучшее 0:41, урок 6', () => {
    // Ловит: кадр Базы строится как первый раз (метка «новое», ставка «первые 2 монеты») — раздел `learn` из фикстуры не дошёл до окна.
    const st = learnStandOf(files['../fixtures/accepted/learn-arrows.start-base.json']!)!;
    expect(st.before).toEqual({ step: 2, best: 41000 });
    expect(st.flow.place).toBe('base');
    expect(st.stake).toBeGreaterThanOrEqual(3);
    expect(learnStandOf(files['../fixtures/accepted/learn-arrows.start.json']!)!.stake).toBe(2);
  });

  it('К4: итог в перерыве зовёт «Второй тайм», итог на Базе — «Ещё раз», «Второго тайма» там нет', () => {
    // Ловит: итог на Базе ведёт в матч (кнопка «Второй тайм» вне перерыва), итог в перерыве теряет её.
    const fx = files['../fixtures/accepted/learn-arrows.end.json']!;
    expect(endPrimary(learnStandOf(fx)!.flow.place)).toBe('second');
    expect(endPrimary(learnStandOf({ ...fx, learn: { ...fx.learn!, place: 'base' } })!.flow.place)).toBe('again');
  });

  it('К13 Р166: кадр «Пар» — четыре пальца кадра (мизинец и указательный левой, указательный и мизинец правой), «Отбора» — игроки В, А, О; ставка игр 5–8 на старте — +3', () => {
    // Ловит: зерно фикстуры потеряно (кадр снова со случайными пальцами и игроками), ставка стенда снова «+5» (скорость не по норме игры).
    const pairs = learnStandOf(files['../fixtures/accepted/learn-pairs.play.json']!)!.flow.play!;
    const a = isFormsPlay(pairs) ? pairs.s.tasks[0]!.answer : null;
    expect(a?.kind === 'match' ? a.left : []).toEqual(['lp', 'li', 'ri', 'rp']);
    const pick = learnStandOf(files['../fixtures/accepted/learn-pick.start.json']!)!.flow.play ?? learnStandOf(files['../fixtures/accepted/learn-pick.play.json']!)!.flow.play!;
    const q = isFormsPlay(pick) ? pick.s.tasks[0]!.answer : null;
    expect(q?.kind === 'choice' ? q.options : []).toEqual(['Игрок В', 'Игрок А', 'Игрок О']);
    for (const g of ['pick', 'board', 'sheet', 'pairs']) expect(learnStandOf(files[`../fixtures/accepted/learn-${g}.start.json`]!)!.stake, g).toBe(3);
  });

  it('К13 Р105/Т21: стенд даёт окну цвет соперника урока кадра по форме клуба — цвет команды двора, при слиянии с клубом второй цвет', () => {
    // Ловит: провод цвета соперника на стенде оборван (окно берёт общий оранжевый, а не цвет команды урока) — фишки игр 1–2 не по макету; цвет не уступает форме клуба.
    for (const [id, fx] of all) {
      const club = fx.sections.club as { kit: { body: string; alt?: string } };
      expect(learnStandOf(fx)!.rivalBody, id).toBe(rivalBodyOf(rivalOf(fx.learnCtx!.lesson), club.kit));
    }
    const fx = files['../fixtures/accepted/learn-arrows.play.json']!;
    const team = rivalOf(fx.learnCtx!.lesson);
    const club = fx.sections.club as { kit: object };
    const same = { ...fx, sections: { ...fx.sections, club: { ...club, kit: { ...club.kit, body: rivalBodyOf(team, { body: '#2f9a27' }) } } } };
    expect(learnStandOf(fx)!.rivalBody).toBe(rivalBodyOf(team, { body: '#2f9a27' })); // клуб образца — зелёный: цвет команды
    expect(learnStandOf(same)!.rivalBody).not.toBe(rivalBodyOf(team, { body: '#2f9a27' })); // клуб того же цвета: соперник во втором цвете команды
  });
});

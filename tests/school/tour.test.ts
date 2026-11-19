/**
 * Школа, движок тура (спека 067 Т2, критерий К2): ТЗ-6.1–6.9, 6.11, 6.13, 6.14, 0 монет.
 */
import { describe, expect, it } from 'vitest';
import { afterResult } from '../../src/engine/day/chain';
import { emptyStadium } from '../../src/engine/home/section';
import { credit, type Purse } from '../../src/engine/rewards/cash';
import { walletDef } from '../../src/engine/rewards/section';
import { correctInput, type AnswerInput } from '../../src/engine/school/answers';
import { finishKicks, finishTour } from '../../src/engine/school/finish';
import { kicksPlan } from '../../src/engine/school/kicks';
import { EMBLEM_FULL, addPart, emblemN, medalOf } from '../../src/engine/school/medal';
import { createRandom, shuffle } from '../../src/engine/random';
import { levelOf, lettersLearned } from '../../src/engine/school/level';
import { KINDS, kindOf, repeatDue, skipTrainer } from '../../src/engine/school/order';
import { emptySchool, MISS_MAX, schoolDef, type School } from '../../src/engine/school/section';
import type { Task } from '../../src/engine/school/tasks';
import { isFinished, revanche, step, tourPlan as planOrNull, type Tour } from '../../src/engine/school/tour';

/** Задача-число: ответ равен номеру. */
const num = (i: number): Task => ({ id: `t-n-${i}`, no: i, text: `Сколько будет ${i}?`, answer: { kind: 'integer', value: i }, solution: `Это ${i}.`, verified: true, level: 1 });
const bank = (k: number, from = 1): Task[] => Array.from({ length: k }, (_, i) => num(from + i));
const asChoice = (ts: Task[]): Task[] => ts.map((x) => ({ ...x, answer: { kind: 'choice' as const, options: ['а', 'б'], correct: 0 } }));
const purse = (school: School = emptySchool()): Purse => ({ wallet: { ...walletDef.empty(), coins: 10 }, school, stadium: emptyStadium() });
const wrong: AnswerInput = { kind: 'integer', value: '999999' };
const entry = (n: number, kind: string, medal = 1) => ({ n, kind, medal, first: 3, day: '2026-11-19' });
/** План тура, который точно есть (пустой банк проверяется отдельно через `planOrNull`). */
const tourPlan = (...args: Parameters<typeof planOrNull>): Tour => planOrNull(...args) as Tour;
/** Сыграть тур: `ok[i]` — задача i решена верно, иначе промах. */
function play(t: Tour, ok: boolean[]): Tour {
  let cur = t;
  ok.forEach((good, i) => {
    const task = cur.tasks[i] as Task;
    cur = step(cur, good ? correctInput(task.answer) : wrong).tour;
  });
  return cur;
}

describe('К2 Школа: порядок видов и медали', () => {
  it('К2 ТЗ-6.8: вид тура по номеру, 1–18 парами, дальше вперемешку', () => {
    const ns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 40];
    expect(ns.map((n) => kindOf(n).id)).toEqual([
      'number', 'number', 'choice', 'choice', 'multi', 'multi', 'fields', 'fields', 'expr', 'expr', 'fraction', 'fraction', 'select', 'select', 'order', 'order', 'match', 'match', 'mixed', 'mixed',
    ]);
    expect(KINDS).toHaveLength(EMBLEM_FULL);
    // Ловит: вид с туром длиннее MISS_MAX — промахов в записи больше, чем она держит (`check` отвергает запись)
    expect(KINDS.every((k) => k.size <= MISS_MAX)).toBe(true);
  });

  // Ловит: сдвиг порога бронзы/серебра/золота; золото у тура из 3
  it('К2 ТЗ-6.4: пороги медали — из 5: 3/4/5, из 3: 2/3 и золота нет', () => {
    expect([0, 2, 3, 4, 5].map((f) => medalOf(5, f))).toEqual([0, 0, 1, 2, 3]);
    expect([0, 1, 2, 3].map((f) => medalOf(3, f))).toEqual([0, 0, 1, 2]);
    expect([1, 2, 3, 4].map((f) => medalOf(4, f))).toEqual([0, 1, 2, 3]);
    expect(medalOf(2, 2)).toBe(0);
  });

  it('К2 ТЗ-6.7: частей ровно 10, повтор вида части не даёт', () => {
    let mask = 0;
    for (const k of KINDS) mask = addPart(mask, k.id, 1).mask;
    expect(emblemN(mask)).toBe(10);
    expect(addPart(mask, 'number', 3).added).toBe(false);
    expect(addPart(0, 'number', 0).added).toBe(false);
    expect(addPart(0, 'repeat', 3).added).toBe(false);
  });
});

describe('К2 Школа: тур', () => {
  it('К2 ТЗ-6.13: неверный формат и пусто не списывают попытку', () => {
    const t = tourPlan(emptySchool(), bank(6), 4, 1);
    const r = step(t, { kind: 'integer', value: 'пять' });
    expect(r.verdict).toBe('format');
    expect(r.tour.i).toBe(0);
    expect(step(t, { kind: 'integer', value: '' }).tour.i).toBe(0);
  });

  it('К2 ТЗ-6.3: промах — эталон тем же видом; «Реванш» пишет «разобрано», медаль и «Знаток» не меняет', () => {
    const t0 = tourPlan(emptySchool(), bank(6), 4, 1);
    expect(t0.tasks).toHaveLength(4);
    const r = step(t0, wrong);
    expect(r.etalon?.input.kind).toBe('integer');
    const full = [1, 2, 3].reduce((cur, i) => step(cur, correctInput((cur.tasks[i] as Task).answer)).tour, r.tour);
    expect(isFinished(full)).toBe(true);
    const done = finishTour(purse(), full, { day: '2026-11-19' });
    expect(done.view.medal).toBe(2);
    const missed = done.view.missed[0] as number;
    const task = full.tasks[missed] as Task;
    const rv = revanche(done.save.school, full, missed, correctInput(task.answer));
    expect(rv.school.solved).toContain(task.id);
    expect(rv.school.tours).toEqual(done.save.school.tours);
    expect(rv.school.knower).toBe(done.save.school.knower);
    expect(revanche(rv.school, full, 1, correctInput((full.tasks[1] as Task).answer)).verdict).toBe('over');
  });

  // Ловит: «Знаток» за тур не растёт; монеты за Школу
  it('К2 ТЗ-6.6: 0 монет; «Знаток» +1 за новую верную задачу; повторный итог не удваивает', () => {
    const t = play(tourPlan(emptySchool(), bank(6), 4, 1), [true, true, true, true]);
    const a = finishTour(purse(), t, { day: '2026-11-19' });
    expect(a.save.wallet).toEqual(purse().wallet);
    expect(a.view).toMatchObject({ medal: 3, knower: 4, newPart: 'number' });
    expect(a.save.school.knower).toBe(4);
    const b = finishTour(a.save, t, { day: '2026-11-19' });
    expect(b.save.school).toEqual(a.save.school);
  });

  // Ловит: потолок медали у пересдачи тех же задач
  it('К2 ТЗ-6.5: новых задач нет — те же вперемешку, медаль не выше взятой', () => {
    const played = play(tourPlan(emptySchool(), bank(4), 4, 1), [true, true, true, false]);
    const first = finishTour(purse(), played, { day: '2026-11-19' });
    expect(first.view.medal).toBe(2);
    const missed = first.view.missed[0] as number;
    const fixed = revanche(first.save.school, played, missed, correctInput((played.tasks[missed] as Task).answer)).school;
    const again = tourPlan(fixed, bank(4), 4, 2, { retake: 1 });
    expect(again.cap).toBe(2);
    const fin = finishTour({ ...first.save, school: fixed }, play(again, [true, true, true, true]), { day: '2026-11-20' });
    expect(fin.view.medal).toBe(2);
    expect(fin.save.school.tours).toHaveLength(1);
    expect(fin.save.school.tours[0]?.medal).toBe(2);
  });

  it('К2 ТЗ-6.5: есть новые задачи — пересдача берёт другие, потолка нет', () => {
    const first = finishTour(purse(), play(tourPlan(emptySchool(), bank(10), 4, 1), [true, true, true, true]), { day: '2026-11-19' });
    const again = tourPlan(first.save.school, bank(10), 4, 2, { retake: 1 });
    expect(again.cap).toBeNull();
    expect(again.tasks.map((x) => x.id).filter((id) => first.save.school.solved.includes(id))).toEqual([]);
  });

  // Ловит: тренажёр пропущен — а тур всё равно нового вида
  it('К2 ТЗ-6.9: перед новым видом с тренажёром — карточка; пропуск — тур прежних видов, без части эмблемы', () => {
    const school: School = { ...emptySchool(), tours: [1, 2, 3, 4].map((n) => entry(n, kindOf(n).id)) };
    const multi = Array.from({ length: 6 }, (_, i) => ({ ...num(100 + i), id: `m-${i}`, answer: { kind: 'multi' as const, options: ['а', 'б'], correct: [0] } }));
    const t = tourPlan(school, [...bank(10), ...multi], 4, 1);
    expect(t).toMatchObject({ n: 5, kind: 'multi', trainer: 'multi', waiting: null });
    const skipped = tourPlan(skipTrainer(school, 'multi'), [...bank(10), ...multi], 4, 1);
    expect(skipped).toMatchObject({ repeat: true, waiting: 'multi', trainer: null, kind: 'repeat' });
    expect(skipped.tasks.every((x) => x.answer.kind !== 'multi')).toBe(true);
    expect(tourPlan(skipTrainer(school, 'multi'), [...bank(10), ...multi], 4, 1, { trainerDone: ['multi'] })).toMatchObject({ kind: 'multi', trainer: null, repeat: false });
    expect(tourPlan(emptySchool(), bank(6), 4, 1).trainer).toBeNull();
  });

  it('К2 Ш-З3: тур-повтор вне нумерации, части эмблемы не даёт, номер следующего тура не растёт', () => {
    const school = finishTour(purse(), play(tourPlan(emptySchool(), bank(9), 4, 1), [true, true, true, true]), { day: '2026-11-19' }).save.school;
    const rep = tourPlan(school, bank(9), 4, 3, { repeat: true });
    const fin = finishTour(purse(school), play(rep, rep.tasks.map(() => true)), { day: '2026-11-19' });
    expect(fin.view.newPart).toBeNull();
    expect(fin.save.school.tours.at(-1)?.kind).toBe('repeat');
    expect(tourPlan(fin.save.school, bank(9), 4, 4).n).toBe(2);
  });

  it('К2 А7-Р9: повтор — каждые 5–7 туров', () => {
    const mk = (k: number): School => ({ ...emptySchool(), tours: Array.from({ length: k }, (_, i) => entry(i + 1, 'number')) });
    expect([4, 5].map((k) => repeatDue(mk(k)))).toEqual([false, true]);
  });

  it('К2 ТЗ-6.11: слово-ответ не выдаётся с невыученной буквой', () => {
    const word: Task = { ...num(50), id: 't-word', answer: { kind: 'text', accepted: ['жук'] } };
    const fields = bank(3).map((x) => ({ ...x, answer: { kind: 'fields' as const, fields: [{ label: 'а', value: 1 }], unordered: false } }));
    const school = { ...emptySchool(), tours: [1, 2, 3, 4, 5, 6].map((n) => entry(n, kindOf(n).id)) };
    const ids = (letters: string): string[] => tourPlan(school, [word, ...fields], 4, 1, { letters, trainerDone: ['fields'] }).tasks.map((x) => x.id);
    expect(ids('ыу')).not.toContain('t-word');
    expect(ids('жук')).toContain('t-word');
  });

  it('К2 Ш-З6: выученные буквы — новые буквы ступеней до ступени текущего урока включительно', () => {
    const stages = [{ n: 1, newKeys: 'ао' }, { n: 2, newKeys: 'вл' }, { n: 3, newKeys: 'ыд' }];
    expect(lettersLearned(stages, 1)).toBe('ао');
    expect(lettersLearned(stages, 2)).toBe('аовл');
    expect(lettersLearned(stages, 0)).toBe('');
    expect(lettersLearned(stages, 99)).toBe('аовлыд');
  });

  it('К2 ТЗ-6.2: тур из 4–5 задач (число — 4, 025-Р31); 1 класс — из 4', () => {
    expect(tourPlan(emptySchool(), bank(9), 4, 1).tasks).toHaveLength(4);
    const school = { ...emptySchool(), tours: [entry(2, 'number')] };
    expect(tourPlan(school, asChoice(bank(9)), 1, 1).tasks).toHaveLength(4);
    expect(tourPlan(school, asChoice(bank(9)), 4, 1).tasks).toHaveLength(5);
  });
});

describe('К2 Школа: «штрафные»', () => {
  // Ловит: «Знаток» за штрафные не растёт; монеты или медаль появляются
  it('К2 ТЗ-6.14: 3 задачи, +1 к «Знатоку» за верную, монет и медали нет', () => {
    const k = kicksPlan(emptySchool(), bank(6), 4, 1) as Tour;
    expect(k.tasks).toHaveLength(3);
    const fin = finishKicks(purse(), play(k, [true, false, true]), { ref: 'k1' });
    expect(fin.knower).toBe(2);
    expect(fin.save.school.knower).toBe(2);
    expect({ ...fin.save.wallet, paid: [] }).toEqual(purse().wallet);
    expect(fin.save.wallet.paid).toEqual(['k1']);
    expect(fin.save.school.tours).toEqual([]);
    expect(fin.save.school.emblem).toBe(0);
  });

  it('К2 ТЗ-6.1, 6.14: после первого матча дня — тур, после остальных — «штрафные»', () => {
    const at = (todayN: number) => afterResult({ album: { packs: 0, shown: 0 }, day: { todayN } }, { schoolOpen: true }, 0);
    expect(at(1)).toEqual(['tourWaits']);
    expect(at(2)).toEqual(['kicks']);
  });

  it('К2 ТЗ-6.6: верная задача пенальти — +1 к «Знатоку», медаль и части не меняются', () => {
    const p = credit(purse(), 'penalty-knower', 1).purse;
    expect(p.school.knower).toBe(1);
    expect(p.school.tours).toEqual([]);
    expect(p.school.emblem).toBe(0);
  });
});

describe('К2 Школа: раздел v2', () => {
  it('К2: итог тура оставляет раздел валидным', () => {
    const fin = finishTour(purse(), play(tourPlan(emptySchool(), bank(6), 4, 1), [true, false, true, true]), { day: '2026-11-19' });
    expect(schoolDef.check(fin.save.school)).toEqual([]);
  });
});

const DAY = { day: '2026-11-19' };
const all = (n: number): boolean[] => Array.from({ length: n }, () => true);
/** Задача линии `line`: id у разных линий разные. */
const lined = (line: string, k: number): Task[] => bank(k).map((x) => ({ ...x, id: `${line}-${x.id}`, line }) as Task);
/** Тур-повтор (5 задач, нумерацию не двигает): медаль 0 / 2 / 3 по верным 0 / 4 / 5. */
const REPEAT_PLAY: Record<number, boolean[]> = { 0: [false, false, false, false, false], 2: [true, true, true, true, false], 3: all(5) };
function repeatTour(school: School, tasks: Task[], seed: number, medal: number): { school: School; tour: Tour } {
  const tour = play(tourPlan(school, tasks, 4, seed, { repeat: true }), REPEAT_PLAY[medal] as boolean[]);
  return { school: finishTour(purse(school), tour, DAY).save.school, tour };
}
const run = (school: School, tasks: Task[], medals: number[]): School => medals.reduce((s, m, i) => repeatTour(s, tasks, 100 + i, m).school, school);

describe('К2 Школа: журнал и повторный итог (ревью 067 Т2)', () => {
  // Ловит: повторный итог «штрафных» с тем же туром платит «Знатока» второй раз (нет isPaid / ref не запомнен кассой)
  it('К2 ТЗ-6.14: «штрафные» дважды — одна оплата', () => {
    const k = play(kicksPlan(emptySchool(), bank(6), 4, 1) as Tour, [true, true, true]);
    const a = finishKicks(purse(), k, { ref: 'k-1' });
    const b = finishKicks(a.save, k, { ref: 'k-1' });
    expect([a.knower, b.knower, b.save.school.knower]).toEqual([3, 0, 3]);
    expect(b.save).toEqual(a.save);
    expect(finishKicks(a.save, k, { ref: 'k-2' }).knower).toBe(3);
  });

  // Ловит: sid различает туры только по семени — два тура ожидания одним семенем сливаются в одну запись
  it('К2: два тура ожидания одним семенем — две записи; перезагрузка до итога — тот же тур', () => {
    const multi = Array.from({ length: 6 }, (_, i) => ({ ...num(100 + i), id: `m-${i}`, answer: { kind: 'multi' as const, options: ['а', 'б'], correct: [0] } }));
    const tasks = [...bank(12), ...multi];
    const school = skipTrainer({ ...emptySchool(), tours: [1, 2, 3, 4].map((n) => entry(n, kindOf(n).id)) }, 'multi');
    const first = tourPlan(school, tasks, 4, 9);
    expect(first.waiting).toBe('multi');
    expect(tourPlan(school, tasks, 4, 9)).toEqual(first);
    const a = finishTour(purse(school), play(first, all(first.tasks.length)), DAY).save;
    const second = tourPlan(a.school, tasks, 4, 9);
    expect(second.sid).not.toBe(first.sid);
    const b = finishTour(a, play(second, all(second.tasks.length)), DAY).save;
    expect(b.school.tours).toHaveLength(a.school.tours.length + 1);
  });

  // Ловит: соль повтора или пересдачи убрана — метки разных тура/повтора/пересдачи с одним номером совпадают
  it('К2: метка тура: обычный, повтор и пересдача с одним семенем и номером — разные', () => {
    const school: School = { ...emptySchool(), tours: [entry(1, 'number', 1)] };
    const plain = tourPlan(emptySchool(), bank(10), 4, 3);
    const rep = tourPlan(emptySchool(), bank(10), 4, 3, { repeat: true });
    const re = tourPlan({ ...school, tours: [] }, bank(10), 4, 3, { retake: 1 });
    expect(new Set([plain.sid, rep.sid, re.sid]).size).toBe(3);
  });

  // Ловит: пустой банк — тур с 0 задач вместо null
  it('К2: ни задач вида, ни прежних — тур null', () => {
    expect(planOrNull(emptySchool(), [], 4, 1)).toBeNull();
    expect(planOrNull({ ...emptySchool(), tours: Array.from({ length: 8 }, (_, i) => entry(i + 1, kindOf(i + 1).id)) }, [], 4, 1)).toBeNull();
  });

  // Ловит: сравнение итогов по номеру/медали/верным/дню сливает два разных тура-повтора в одну запись
  it('К2: два разных тура-повтора с одинаковым итогом — две записи; один и тот же тур дважды — одна', () => {
    const school = finishTour(purse(), play(tourPlan(emptySchool(), bank(12), 4, 1), all(4)), DAY).save.school;
    const a = repeatTour(school, bank(12), 3, 3);
    const b = repeatTour(a.school, bank(12), 4, 3);
    expect(b.school.tours).toHaveLength(3);
    expect(finishTour(purse(b.school), b.tour, DAY).save.school.tours).toHaveLength(3);
  });

  // Ловит: перезагрузка посреди тура даёт другие задачи; итог дважды двигает «Знатока» или журнал
  it('К2 design §6: перезагрузка — тот же тур при том же семени; итог тура дважды сохранение не меняет', () => {
    const t = tourPlan(emptySchool(), bank(10), 4, 7);
    expect(tourPlan(emptySchool(), bank(10), 4, 7)).toEqual(t);
    const done = play(t, all(4));
    const a = finishTour(purse(), done, DAY);
    const b = finishTour(a.save, play(tourPlan(emptySchool(), bank(10), 4, 7), all(4)), DAY);
    expect(b.view.knower).toBe(0);
    const c = finishTour(a.save, done, DAY);
    expect(c.save.school).toEqual(a.save.school);
  });

  // Ловит: потолок пересдачи берётся по лучшей медали вида, а не по записи пересдаваемого тура
  it('К2 ТЗ-6.5: тур 3 бронза, тур 4 золото, пересдача 3 — не выше бронзы', () => {
    const tasks = asChoice(bank(10));
    const school: School = { ...emptySchool(), tours: [entry(3, 'choice', 1), entry(4, 'choice', 3)], solved: tasks.map((x) => x.id) };
    expect(tourPlan(school, tasks, 4, 1, { retake: 3 }).cap).toBe(1);
    expect(tourPlan(school, tasks, 4, 1, { retake: 4 }).cap).toBe(3);
  });

  // Ловит: Math.max(old.medal, medal) заменён на medal — пересдача понизила взятую медаль
  it('К2 ТЗ-6.5: пересдача не понижает взятую медаль и верные', () => {
    const first = finishTour(purse(), play(tourPlan(emptySchool(), bank(10), 4, 1), all(4)), DAY).save;
    const again = finishTour(first, play(tourPlan(first.school, bank(10), 4, 2, { retake: 1 }), [false, false, false, false]), DAY);
    expect(again.view.medal).toBe(0);
    expect(again.save.school.tours).toHaveLength(1);
    expect(again.save.school.tours[0]).toMatchObject({ medal: 3, first: 4 });
  });

  // Ловит: emblemDone по любой новой части или по полной эмблеме без новой части
  it('К2 ТЗ-6.7: праздник эмблемы — только когда добавлена 10-я часть', () => {
    expect(finishTour(purse(), play(tourPlan(emptySchool(), bank(6), 4, 1), all(4)), DAY).view).toMatchObject({ newPart: 'number', emblemN: 1, emblemDone: false });
    const nine = KINDS.slice(0, -1).reduce((m, k) => addPart(m, k.id, 1).mask, 0);
    const base: School = { ...emptySchool(), tours: [entry(18, 'match')], emblem: nine };
    const last = finishTour(purse(base), play(tourPlan(base, bank(12), 4, 1), all(5)), DAY);
    expect(last.view).toMatchObject({ newPart: 'mixed', emblemN: EMBLEM_FULL, emblemDone: true });
    const full = last.save.school;
    const again = finishTour(purse(full), play(tourPlan(full, bank(12), 4, 2), all(5)), DAY);
    expect(again.view).toMatchObject({ newPart: null, emblemN: EMBLEM_FULL, emblemDone: false });
  });

  // Ловит: подсказка у тура-повтора, пересдачи или второго тура вида
  it('К2 ТЗ-6.9: подсказка — только у первого тура вида (не повтор, не пересдача)', () => {
    const t1 = tourPlan(emptySchool(), bank(10), 4, 1);
    expect(t1.hint).toBe(true);
    const school = finishTour(purse(), play(t1, all(4)), DAY).save.school;
    expect(tourPlan(school, bank(10), 4, 2).hint).toBe(false);
    expect(tourPlan(school, bank(10), 4, 2, { retake: 1 }).hint).toBe(false);
    expect(tourPlan(school, bank(10), 4, 2, { repeat: true }).hint).toBe(false);
  });
});

describe('К2 Школа: уровень по серии линии (А7-Р5)', () => {
  const main = lined('main', 12);
  // Ловит: уровень по чётности журнала — 0,2,3,0 не давал подъёма после пары 2–3
  it('К2 А7-Р5: 0, 2, 3, 0 — подъём после 2–3', () => {
    const lv = (medals: number[]): number => levelOf(run(emptySchool(), main, medals), 'main');
    expect([lv([0]), lv([0, 2]), lv([0, 2, 3]), lv([0, 2, 3, 0])]).toEqual([1, 1, 2, 2]);
  });

  // Ловит: уровень ставится по чётности длины журнала, при полном журнале (400) решение не наступает
  it('К2 А7-Р5: полный журнал (400 записей) — уровень растёт так же', () => {
    const full: School = { ...emptySchool(), tours: Array.from({ length: 400 }, (_, i) => entry(i + 1, 'number')) };
    const done = run(full, main, [2, 3]);
    expect(done.tours).toHaveLength(400);
    expect(levelOf(done, 'main')).toBe(2);
    expect(schoolDef.check(done)).toEqual([]);
  });

  // Ловит: после шага серия не сбрасывается — третья медаль подряд дала бы подъём
  it('К2 А7-Р5: после шага серия начинается заново: 3,3,3 — уровень 2, 3,3,3,3 — уровень 3', () => {
    expect([[3, 3, 3], [3, 3, 3, 3]].map((m) => levelOf(run(emptySchool(), main, m), 'main'))).toEqual([2, 3]);
  });

  // Ловит: серии разных линий смешаны
  it('К2 А7-Р5: разные линии не смешиваются', () => {
    const a = lined('a', 12);
    const b = lined('b', 12);
    const s = [a, b, a].reduce((sc, tasks, i) => repeatTour(sc, tasks, 200 + i, 2).school, emptySchool());
    expect([levelOf(s, 'a'), levelOf(s, 'b')]).toEqual([2, 1]);
  });

  // Ловит: подъём без +1, спуск без −1, выход за границы 1…3
  it('К2 А7-Р5: ровно ±1, границы 1…3', () => {
    const at = (l: number): School => ({ ...emptySchool(), level: { main: l } });
    expect([1, 2, 3].map((l) => levelOf(run(at(l), main, [3, 3]), 'main'))).toEqual([2, 3, 3]);
    expect([1, 2, 3].map((l) => levelOf(run(at(l), main, [0, 0]), 'main'))).toEqual([1, 1, 2]);
    expect(levelOf(run(at(2), main, [0, 2, 0]), 'main')).toBe(2);
  });

  // Ловит: итог того же тура дважды продвигает серию и уровень (без `merged`)
  it('К2 А7-Р5: тот же тур дважды уровень не двигает', () => {
    const one = repeatTour(emptySchool(), main, 5, 3);
    const twice = finishTour(purse(one.school), one.tour, DAY).save.school;
    expect(levelOf(twice, 'main')).toBe(1);
    expect(twice.streak).toEqual(one.school.streak);
  });

  it('К2: серия и метка тура — необязательные поля, check держит границы', () => {
    const sc = (o: object): string[] => schoolDef.check({ ...emptySchool(), ...o });
    expect(sc({ streak: { main: [2, 3] } })).toEqual([]);
    expect(sc({ streak: { main: [1, 2, 3] } })).toEqual(['streak']);
    expect(sc({ streak: { main: [4] } })).toEqual(['streak']);
    expect(sc({ tours: [{ ...entry(1, 'number'), sid: 5 }] })).toEqual([]);
    expect(sc({ tours: [{ ...entry(1, 'number'), sid: -1 }] })).toEqual(['tours']);
  });
});

describe('К2 Школа: «Знаток», пустой банк, мелочи (ревью 067 Т2)', () => {
  // Ловит: «штрафные» дают только за новые задачи — на исчерпанном банке ничего
  it('К2 ТЗ-6.14, 025-Р38: банк исчерпан — «штрафные» всё равно дают за каждую верную с первой попытки', () => {
    const tasks = bank(3);
    const school: School = { ...emptySchool(), solved: tasks.map((x) => x.id) };
    const k = kicksPlan(school, tasks, 4, 1) as Tour;
    expect(finishKicks(purse(school), play(k, [true, true, false]), { ref: 'k1' }).knower).toBe(2);
  });

  // Ловит: тур платит «Знатока» за задачи, решённые раньше (А7-Р9)
  it('К2 А7-Р9: тур дарит «Знатока» только за новые задачи', () => {
    const tasks = bank(4);
    const school: School = { ...emptySchool(), solved: tasks.map((x) => x.id) };
    const t = tourPlan(school, tasks, 4, 1);
    expect(finishTour(purse(school), play(t, all(4)), DAY).view.knower).toBe(0);
  });

  // Ловит: исключение «no tasks» на пустом пуле вида
  it('К2: тур 9 (expr) без задач вида — безопасный тур из прежних видов; «штрафных» без задач нет', () => {
    const school: School = { ...emptySchool(), tours: Array.from({ length: 8 }, (_, i) => entry(i + 1, kindOf(i + 1).id)) };
    const t = tourPlan(school, bank(10), 4, 1);
    expect(t).toMatchObject({ n: 9, repeat: true, kind: 'repeat', cap: null, hint: false });
    expect(t.tasks.length).toBeGreaterThan(0);
    expect(kicksPlan(emptySchool(), [], 4, 1)).toBeNull();
  });

  it('К2 А7-Р9: повтор через 5, 6, 7, 5 туров — по числу повторов в журнале', () => {
    const mk = (repeats: number, since: number): School => ({
      ...emptySchool(),
      tours: [...Array.from({ length: repeats }, () => [entry(1, 'number'), entry(1, 'repeat')]).flat(), ...Array.from({ length: since }, (_, i) => entry(i + 1, 'number'))],
    });
    const due = (repeats: number): number => [4, 5, 6, 7].find((since) => repeatDue(mk(repeats, since))) ?? 0;
    expect([0, 1, 2, 3].map(due)).toEqual([5, 6, 7, 5]);
  });

  it('К2: shuffle — перестановка того же набора, зерно повторяет, вход цел', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(createRandom(3), src);
    expect([...a].sort()).toEqual(src);
    expect(shuffle(createRandom(3), src)).toEqual(a);
    expect(a).not.toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

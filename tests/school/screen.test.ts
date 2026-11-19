/**
 * Школа, экран журнала и сеанс тура (спека 067 Т14, критерий К2): чистые функции `app/school/` — журнал, сеанс тура, «Реванш».
 */
import { describe, expect, it } from 'vitest';
import { emptyStadium } from '../../src/engine/home/section';
import type { Purse } from '../../src/engine/rewards/cash';
import { walletDef } from '../../src/engine/rewards/section';
import { correctInput, type AnswerInput } from '../../src/engine/school/answers';
import { finishTour } from '../../src/engine/school/finish';
import { setGrade } from '../../src/engine/school/level';
import { kindOf } from '../../src/engine/school/order';
import { emptySchool, schoolDef, type School } from '../../src/engine/school/section';
import type { Task } from '../../src/engine/school/tasks';
import { step, tourPlan as planOrNull, type Tour } from '../../src/engine/school/tour';
import { routes } from '../../src/app/router/routes';
import { chainSave } from '../../src/app/result/chain';
import { afterResult } from '../../src/engine/day/chain';
import { kicksEntry, kicksPaid, kicksRef, kicksRun, kicksSeed, settleKicks } from '../../src/app/school/kicks';
import { PLAYABLE, learnCtxOf, openLearn } from '../../src/app/learn/run';
import { trainerGame, trainersDone, waitingKind } from '../../src/engine/school/order';
import { trainerPath } from '../../src/app/school/tour';
import { blockText, matchPlayed, saveFail, tourGate } from '../../src/app/school/gate';
import { tasks as bankTasks } from '../../src/app/school/tasks';
import { journalView, needsGrade, schoolExtras, tourWaits } from '../../src/app/school/journal';
import { canRetake, coachHint, finishRun, journalFixRun, nextRun, openRun, startFix, submitFix, submitRun, typeInto } from '../../src/app/school/tour';

const num = (i: number): Task => ({ id: `t-n-${i}`, no: i, text: `Сколько будет ${i}?`, answer: { kind: 'integer', value: i }, solution: `Это ${i}.`, verified: true, level: 1 });
const bank = (k: number, from = 1): Task[] => Array.from({ length: k }, (_, i) => num(from + i));
const purse = (school: School = emptySchool()): Purse => ({ wallet: { ...walletDef.empty(), coins: 10 }, school, stadium: emptyStadium() });
const wrong: AnswerInput = { kind: 'integer', value: '999999' };
const entry = (n: number, kind: string, medal = 1) => ({ n, kind, medal, first: 3, day: '2026-11-19' });
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

describe('К2 Школа: экран журнала и сеанс тура (067 Т14)', () => {
  const day = { today: '2026-11-19', todayN: 1 };

  // Ловит: вопрос класса задаётся каждый раз (или не задаётся вовсе): Э3.08 — один раз, потом журнал
  it('К2 Э3.08: Школа без класса — вопрос один раз; класс записан — вопроса нет; игрок не открыт — не спрашиваем', () => {
    expect(needsGrade(emptySchool())).toBe(true);
    expect(needsGrade(setGrade(emptySchool(), 2))).toBe(false);
    expect(needsGrade(setGrade(emptySchool(), 9))).toBe(true); // вне 1…8 класс не записывается
    expect(needsGrade(null)).toBe(false);
  });

  // Ловит: «Тур ждёт» на Доме после тура или до матча; эмблема не доходит до Дома
  it('К2 ТЗ-6.1: тур ждёт после матча дня и пока нет тура нумерации за сегодня; повтор не считается; эмблема — из раздела', () => {
    const s = emptySchool();
    const today = '2026-11-19';
    const played = (kind: string): School => ({ ...s, tours: [{ ...entry(1, kind), day: today }] });
    expect(tourWaits(s, day, today, [])).toBe(true);
    expect(tourWaits(s, { today, todayN: 0 }, today, [])).toBe(false);
    expect(tourWaits(s, { today: '2026-11-18', todayN: 3 }, today, [])).toBe(false);
    expect(tourWaits(played('number'), day, today, [])).toBe(false);
    expect(tourWaits(played('repeat'), day, today, [])).toBe(true);
    expect(schoolExtras({ ...s, emblem: 0b111 }, day, today, [])).toEqual({ emblemN: 3, tourWaits: true });
  });

  it('К2 Э3.13, Э3.09: журнал пуст — «сейчас» тур 1, дальше строки до 12; тактики и «Знаток» считаются по записям', () => {
    const v = journalView(emptySchool());
    expect(v.rows.map((r) => r.type)).toEqual(['now', ...Array<string>(11).fill('next')]);
    expect(v.rows[0]).toMatchObject({ n: 1, kind: 'number' });
    expect(v).toMatchObject({ emblem: 0, tactics: { n: 0, of: 4 }, expert: { left: 15, pct: 0, done: false }, ahead: 4 });
    const tours = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ ...entry(n, kindOf(n).id, n === 5 ? 0 : n === 4 || n === 8 ? 3 : 1), ...(n === 5 ? { miss: ['t-a'] } : {}) }));
    const mid = journalView({ ...emptySchool(), tours, emblem: 0b1111 });
    expect(mid.tactics.n).toBe(2);
    expect(mid.expert.left).toBe(8);
    expect(mid.rows.find((r) => r.n === 4)).toMatchObject({ type: 'tour', tactic: true, fixed: 'none' }); // золото — разбирать нечего
    expect(mid.rows.find((r) => r.n === 5)?.fixed).toBe('todo');
    expect(mid.rows.find((r) => r.type === 'now')?.n).toBe(9);
    // граница «Знатока»: 14 туров с медалью — ещё нет, 15 — звание
    const medals = (n: number): School => ({ ...emptySchool(), tours: Array.from({ length: n }, (_, i) => entry(i + 1, kindOf(i + 1).id, 1)) });
    expect(journalView(medals(14)).expert).toMatchObject({ left: 1, done: false });
    expect(journalView(medals(15)).expert).toMatchObject({ left: 0, done: true, pct: 100 });
  });

  // Ловит: «разобрано» не доходит до журнала; старая запись без miss получает «разобрать»; поле miss принимает не то (067-Р88)
  it('К2 Р88: «Разобрано» — по miss записи; повтор в нумерацию не входит; нет miss — старая запись; miss проверяется', () => {
    const tours = [1, 2, 3, 4, 5].map((n) => entry(n, kindOf(n).id, 1)).concat([entry(5, 'repeat', 0)]);
    const v = journalView({ ...emptySchool(), tours: tours.map((t, i) => (i === 0 ? { ...t, miss: [] } : i === 1 ? { ...t, miss: ['t-a'] } : t)) });
    expect(v.rows[0]?.fixed).toBe('done');
    expect(v.rows[1]).toMatchObject({ fixed: 'todo', fixN: 2 });
    expect(v.rows[2]?.fixed).toBe('none'); // нет поля — старая запись
    expect(v.rows.filter((r) => r.fixN !== null).map((r) => r.n)).toEqual([2]); // «разобрать» — только у строки с неразобранными промахами
    expect(v.rows.find((r) => r.type === 'repeat')).toMatchObject({ fixed: 'none', n: 5 });
    expect(v.rows.find((r) => r.type === 'now')?.n).toBe(6);
    const check = (miss: unknown): string[] => schoolDef.check({ ...emptySchool(), tours: [{ ...entry(1, 'number'), miss }] });
    expect(check([])).toEqual([]);
    expect(check(['t-a', 't-b', 't-c', 't-d', 't-e'])).toEqual([]);
    expect(check(['t-a', 't-b', 't-c', 't-d', 't-e', 't-f'])).toContain('tours'); // не больше 5
    expect(check('t-a')).toContain('tours');
    expect(check([1])).toContain('tours');
    expect(check(true)).toContain('tours');
  });

  // Ловит: тур без промахов навсегда «разобрать» или «разобрано» (оценка по медали и размеру тура, а не по записи, Р94)
  it('К2 Р94: тур без промахов — miss в записи нет и строка пуста; промахи были и разобраны — «разобрано»; пересдача без промахов поле снимает', () => {
    const clean = finishTour(purse(), play(tourPlan(emptySchool(), bank(8), 4, 7), [true, true, true, true]), { day: '2026-11-19' });
    expect(clean.save.school.tours[0]).not.toHaveProperty('miss');
    expect(journalView(clean.save.school).rows[0]?.fixed).toBe('none');
    const rough = finishTour(purse(), play(tourPlan(emptySchool(), bank(8), 4, 7), [true, false, true, true]), { day: '2026-11-19' });
    expect(rough.save.school.tours[0]?.miss).toHaveLength(1);
    expect(journalView(rough.save.school).rows[0]?.fixed).toBe('todo');
    const retake = finishTour(purse(rough.save.school), play(tourPlan(rough.save.school, bank(8), 4, 9, { retake: 1 }), [true, true, true, true]), { day: '2026-11-19' });
    expect(retake.save.school.tours).toHaveLength(1);
    expect(retake.save.school.tours[0]).not.toHaveProperty('miss');
    const v = journalView({ ...emptySchool(), tours: [{ ...entry(1, 'number', 2), miss: [] }, entry(2, 'number', 1)] });
    expect(v.rows[0]?.fixed).toBe('done'); // [] — все разобраны
    expect(v.rows[1]?.fixed).toBe('none'); // нет поля — старая запись или тур без промахов
  });

  // Ловит: ввод тянется в следующую задачу; неверный формат списывает попытку; двойной Enter шлёт два ответа
  it('К2 ТЗ-6.13: сеанс — формат не списывает попытку, верный ответ сбрасывает ввод, двойной «Ответить» холостой, эталон после промаха', () => {
    const tour = tourPlan(emptySchool(), bank(8), 4, 7);
    let run = openRun(tour);
    expect(run.stage).toBe('ask');
    const first = tour.tasks[0] as Task;
    run = submitRun(typeInto(run, { kind: 'integer', value: '' }));
    expect(run).toMatchObject({ stage: 'ask', hint: 'empty' });
    expect(run.tour.i).toBe(0);
    run = submitRun(typeInto(run, correctInput(first.answer)));
    expect(run.tour.i).toBe(1);
    expect(run.input).toEqual({ kind: 'integer', value: '' });
    const missed = submitRun(typeInto(run, wrong));
    expect(missed.stage).toBe('etalon');
    expect(nextRun(missed).tour.i).toBe(2);
    expect(nextRun(nextRun(missed)).tour.i).toBe(2); // двойной «Дальше» — холостой
    expect(submitRun(missed)).toBe(missed); // «Ответить» на эталоне — холостое
    expect(missed.missed?.etalon.input).toEqual(correctInput((tour.tasks[1] as Task).answer));
  });

  it('К2: тур до конца — итог один раз; «Реванш» разбирает промах, медаль не меняет; все разобраны — строка журнала', () => {
    const tour = tourPlan(emptySchool(), bank(8), 4, 7);
    let run = openRun(tour);
    for (let k = 0; k < tour.tasks.length; k++) {
      const task = run.tour.tasks[run.tour.i] as Task;
      run = submitRun(typeInto(run, k === 1 ? wrong : correctInput(task.answer)));
      if (run.stage === 'etalon') run = nextRun(run);
    }
    expect(run.stage).toBe('result');
    const done = finishRun(run, purse(), '2026-11-19');
    expect(done.run.view).toMatchObject({ first: 3, size: 4, medal: 2, missed: [1] });
    expect(finishRun(done.run, done.purse, '2026-11-19').purse).toBe(done.purse); // итог второй раз — холостой
    expect(done.purse.school.tours).toHaveLength(1);
    expect(done.purse.school.tours[0]?.miss).toEqual([(tour.tasks[1] as Task).id]); // К2 Р88: итог пишет неразобранные промахи
    const fixing = startFix(done.run);
    expect(fixing.stage).toBe('fix');
    const bad = submitFix(typeInto(fixing, wrong), done.purse.school);
    expect(bad.run.stage).toBe('result'); // неверно — назад к итогу, ничего не записано
    expect(bad.school.solved).toEqual(done.purse.school.solved);
    const good = submitFix(typeInto(fixing, correctInput((tour.tasks[1] as Task).answer)), done.purse.school);
    expect(good.school.tours[0]).toMatchObject({ medal: 2, miss: [] });
    expect(good.school.solved).toContain((tour.tasks[1] as Task).id);
    expect(submitFix(good.run, good.school).school).toBe(good.school); // не в «Реванше» — холостое
  });

  it('К2: перезагрузка посреди тура — тот же тур заново, записи журнала нет; банк пуст — тура нет, экран не падает', () => {
    const school = emptySchool();
    const a = tourPlan(school, bank(8), 4, 7);
    const b = tourPlan(school, bank(8), 4, 7);
    expect(b.sid).toBe(a.sid);
    expect(b.tasks.map((x) => x.id)).toEqual(a.tasks.map((x) => x.id));
    expect(openRun(a).tour.i).toBe(0);
    expect(school.tours).toHaveLength(0);
    expect(planOrNull(school, [], 4, 7)).toBeNull();
  });
});
describe('К2 Школа: «Реванш» и запись промахов (067-Р88)', () => {
  const run3 = (school: School, ok: boolean[], seed = 7) => {
    const tour = play(tourPlan(school, bank(8), 4, seed), ok);
    return { tour, done: finishRun({ ...openRun(tour), stage: 'result' }, purse(school), '2026-11-19') };
  };

  // Ловит: «разобрано» снимается по sid — у пересдачи он старый, и промах остаётся «разобрать» навсегда
  it('К2 Р88: два промаха, разобран один — в miss остался один; пересдача берёт miss у новой попытки', () => {
    const { tour, done } = run3(emptySchool(), [true, false, false, true]);
    const [a, b] = [(tour.tasks[1] as Task).id, (tour.tasks[2] as Task).id];
    expect(done.purse.school.tours[0]?.miss).toEqual([a, b]);
    const fixing = startFix(done.run);
    const out = submitFix(typeInto(fixing, correctInput((tour.tasks[1] as Task).answer)), done.purse.school);
    expect(out.school.tours[0]?.miss).toEqual([b]);
    const retake = tourPlan(out.school, bank(8), 4, 9, { retake: 1 });
    const again = finishTour(purse(out.school), play(retake, [true, true, true, true]), { day: '2026-11-19' });
    expect(again.save.school.tours).toHaveLength(1);
    expect(again.save.school.tours[0]).not.toHaveProperty('miss'); // К2 Р94: промахов нет — поля нет
  });

  // Ловит: «Реванш» одного тура отмечает записи других туров с тем же id задачи
  it('К2 Р88: два тура — отмечен только свой', () => {
    const first = run3(emptySchool(), [false, true, true, true]);
    const second = run3(first.done.purse.school, [false, true, true, true], 11);
    const both = second.done.purse.school;
    expect(both.tours).toHaveLength(2);
    const keep = both.tours[0]?.miss;
    const task = second.tour.tasks[0] as Task;
    const out = submitFix(typeInto(startFix(second.done.run), correctInput(task.answer)), { ...both, tours: both.tours.map((t, i) => (i === 0 ? { ...t, miss: [task.id] } : t)) });
    expect(out.school.tours[1]?.miss).toEqual([]);
    expect(out.school.tours[0]?.miss).toEqual([task.id]);
    expect(keep).toBeDefined();
  });

  // Ловит: у повтора номер совпадает с номером тура нумерации — «Реванш» повтора снимал бы промахи чужого тура
  it('К2 Р88: «Реванш» тура-повтора не трогает запись тура с тем же номером', () => {
    const school: School = { ...emptySchool(), tours: [{ ...entry(1, 'number'), miss: ['t-n-1'] }] };
    const plan = { ...tourPlan(school, bank(8), 4, 5, { repeat: true }), n: 1 }; // n как у тура в журнале: иначе охрана `!tour.repeat` не проверяется
    const tour = play(plan, plan.tasks.map((_, i) => i !== 0));
    const done = finishRun({ ...openRun(tour), stage: 'result' }, purse(school), '2026-11-19');
    expect(done.purse.school.tours.find((t) => t.kind === 'repeat')?.miss).toBeUndefined(); // у повтора miss нет
    const task = tour.tasks[0] as Task;
    const withMiss = { ...done.purse.school, tours: done.purse.school.tours.map((t) => (t.kind === 'repeat' ? t : { ...t, miss: [task.id] })) };
    const out = submitFix(typeInto(startFix(done.run), correctInput(task.answer)), withMiss);
    expect(out.school.tours[0]?.miss).toEqual([task.id]);
  });

  // Ловит: «Реванш» из журнала не находит задачи по id или не снимает промах после верного ответа
  it('К2 Р88: «Реванш» из журнала — по id из банка; верно — промах снят, дальше следующий; неверно — запись цела', () => {
    const school: School = { ...emptySchool(), tours: [{ ...entry(1, 'number'), miss: ['t-n-2', 't-n-3'] }] };
    const run = journalFixRun(school.tours[0] as School['tours'][number], bank(8)) as NonNullable<ReturnType<typeof journalFixRun>>;
    expect(run.stage).toBe('fix');
    expect(run.tour.tasks.map((t) => t.id)).toEqual(['t-n-2', 't-n-3']);
    expect(journalFixRun({ ...entry(1, 'number'), miss: [] }, bank(8))).toBeNull();
    expect(journalFixRun({ ...entry(1, 'number'), miss: ['t-n-99'] }, bank(8))).toBeNull();
    const bad = submitFix(typeInto(run, wrong), school);
    expect(bad.school.tours[0]?.miss).toEqual(['t-n-2', 't-n-3']);
    expect(bad.run).toMatchObject({ stage: 'etalon', last: 'bad', journal: true }); // К2 Р95: неверно — эталон
    expect(bad.run.missed?.etalon.input).toEqual(correctInput(num(2).answer));
    const back = nextRun(bad.run);
    expect(back).toMatchObject({ stage: 'result', journal: true }); // затем назад в журнал, строка остаётся «разобрать»
    expect(nextRun(back)).toBe(back); // двойной «Дальше» — холостой
    expect(finishRun(back, purse(school), '2026-11-19').purse.school).toBe(school); // К2 Р95: журнальный «Реванш» тура не пишет
    const ok1 = submitFix(typeInto(run, correctInput(num(2).answer)), school);
    expect(ok1.run).toMatchObject({ stage: 'fix', fixIdx: 1, last: 'ok' });
    expect(ok1.school.tours[0]?.miss).toEqual(['t-n-3']);
    const ok2 = submitFix(typeInto(ok1.run, correctInput(num(3).answer)), ok1.school);
    expect(ok2.run.stage).toBe('result');
    expect(ok2.school.tours[0]?.miss).toEqual([]);
    expect(ok2.school.solved).toEqual(expect.arrayContaining(['t-n-2', 't-n-3']));
  });

  // Ловит: тактика засчитана за тур 4 без медали; повтор «ждёт» не попадает в строки при due
  it('К2 Р88: тур 4 с медалью 0 — тактика не засчитана; при due в строках есть повтор с waits', () => {
    const t = [1, 2, 3, 4, 5].map((n) => entry(n, kindOf(n).id, n === 4 ? 0 : 1));
    const v = journalView({ ...emptySchool(), tours: t });
    expect(v.tactics.n).toBe(0);
    expect(v.due).toBe(true);
    expect(v.rows.some((r) => r.type === 'repeat' && r.waits)).toBe(true);
    expect(journalView({ ...emptySchool(), tours: t.slice(0, 3) }).rows.some((r) => r.waits)).toBe(false);
  });
});

describe('К2 Школа: место ждущего повтора в журнале (067-Р179, Э3.14)', () => {
  // Ловит: строка «ждёт» всегда в конце журнала, а на кадре она стоит там, где подошёл срок (после 12-го, 13-й уже сыгран)
  it('К2 Э3.14: повтор ждёт с тура 12 (шаг 6), тур 13 сыгран — строка между 12 и 13', () => {
    const tours = [...[1, 2, 3, 4, 5, 6].map((n) => entry(n, kindOf(n).id)), entry(6, 'repeat', 0), ...[7, 8, 9, 10, 11, 12, 13].map((n) => entry(n, kindOf(n).id))];
    const rows = journalView({ ...emptySchool(), tours }).rows;
    const at = rows.findIndex((r) => r.waits);
    expect(rows[at - 1]).toMatchObject({ type: 'tour', n: 12 });
    expect(rows[at + 1]).toMatchObject({ type: 'tour', n: 13 });
    expect(rows.filter((r) => r.type === 'now')).toHaveLength(1);
    // срок только что подошёл — строка прямо перед «сейчас»
    const fresh = journalView({ ...emptySchool(), tours: tours.slice(0, -1) }).rows;
    expect(fresh[fresh.findIndex((r) => r.waits) + 1]?.type).toBe('now');
  });
});

describe('К2 Школа: реплика тренера у задачи (067-Р109, Э3.39)', () => {
  // Ловит: у задачи кадра Э3.39 пропала реплика тренера в контенте (колонка тура показывает её по `hint`)
  it('К2 Э3.39: у «поля в выражении» с рисунком есть `hint`, у остальных он необязателен', () => {
    const t = bankTasks.find((x) => x.id === 't-expr-field');
    expect(t?.hint).toBe('Длина — это ширина и ещё 2 клетки.');
    expect(t?.figure).toBeDefined();
  });
});

describe('К2 Школа: показ реплики тренера по флагу движка (067-Р199)', () => {
  // Ловит: экран показывает `task.hint` всегда, а флаг `Tour.hint` (первые задачи вида, не повтор, не пересдача) нигде не читается
  const hinted = bank(8).map((t) => ({ ...t, hint: 'Подсказка' }));
  it('К2 ТЗ-6.9: первый тур вида — реплика есть; повтор вида и пересдача — null', () => {
    const first = tourPlan(emptySchool(), hinted, 4, 7);
    expect(coachHint(openRun(first))).toBe('Подсказка');
    const played = finishTour(purse(), play(first, [true, true, true, true]), { day: '2026-11-19' }).save.school;
    expect(coachHint(openRun(tourPlan(played, hinted, 4, 9)))).toBeNull(); // вид уже брали
    expect(coachHint(openRun(tourPlan(played, hinted, 4, 9, { retake: 1 })))).toBeNull(); // пересдача
  });
});

describe('К2 Школа: журнал — готовая эмблема и десять строк пустого журнала (067-Р176–Р178)', () => {
  // Ловит: «собрана», число показанных строк и «ещё N» считает Vue, а не journalView
  it('К2: пустой журнал — 10 из 12 строк и «ещё 2»; сыгранный — все строки, «ещё» нет; done — по полной маске', () => {
    const v = journalView(emptySchool());
    expect([v.shown, v.below, v.done]).toEqual([10, 2, false]);
    const some = journalView({ ...emptySchool(), tours: [entry(1, 'number')] });
    expect([some.shown, some.below]).toEqual([some.rows.length, 0]);
    expect(journalView({ ...emptySchool(), emblem: (1 << v.parts.length) - 1 }).done).toBe(true);
    expect(journalView({ ...emptySchool(), emblem: (1 << v.parts.length) - 2 }).done).toBe(false);
  });
});

describe('К2 Школа: вход в тур и «Пересдать» (067-Р97)', () => {
  const day = { today: '2026-11-19', todayN: 1 };

  // Ловит: тур открывается без матча дня (проверка по входу Дома, а он null без пакета) или при сеансе не ok
  it('К2 Ш-З4: без матча дня — «после матча»; сеанс не ok — закрыто с причиной; ok и матч — открыто', () => {
    expect(matchPlayed(day, '2026-11-19')).toBe(true);
    expect(matchPlayed({ today: '2026-11-18', todayN: 3 }, '2026-11-19')).toBe(false); // матч был вчера
    expect(matchPlayed({ today: '2026-11-19', todayN: 0 }, '2026-11-19')).toBe(false);
    expect(matchPlayed({ today: null, todayN: 0 }, '2026-11-19')).toBe(false);
    expect(tourGate('ok', true)).toEqual({ kind: 'open' });
    expect(tourGate('ok', false)).toEqual({ kind: 'afterMatch' });
    for (const st of ['busy', 'readonly', 'quota', 'conflict', 'broken'] as const) {
      const g = tourGate(st, true);
      expect(g.kind).toBe('blocked');
      expect(g).toMatchObject({ text: blockText(st) });
    }
    expect(tourGate('readonly', false).kind).toBe('blocked'); // причина сеанса важнее «после матча»
  });

  // Ловит: сбой записи итога молчит — ребёнок думает, что тур сохранён
  it('К2 Ш-З4: отказ записи показывает причину; успех — ничего', () => {
    expect(saveFail({ ok: true })).toBeNull();
    expect(saveFail({ ok: false, status: 'readonly' })).toBe(blockText('readonly'));
    expect(saveFail({ ok: false, status: 'ok', why: ['tours'] })).toBe(blockText('quota'));
  });

  // Ловит: «Пересдать» после повтора (его нет в нумерации) или тура, которого нет в журнале
  it('К2 Р97: пересдать можно только тур нумерации из журнала; повтор — нельзя', () => {
    const school: School = { ...emptySchool(), tours: [entry(1, 'number')] };
    expect(canRetake(school, tourPlan(school, bank(8), 4, 7, { retake: 1 }))).toBe(true);
    expect(canRetake(emptySchool(), tourPlan(emptySchool(), bank(8), 4, 7))).toBe(false); // записи ещё нет
    expect(canRetake({ ...school, tours: [entry(1, 'repeat', 0)] }, tourPlan(school, bank(8), 4, 5, { repeat: true }))).toBe(false);
    expect(canRetake(school, { ...tourPlan(school, bank(8), 4, 5, { repeat: true }), n: 1 })).toBe(false); // n как у записи тура: охрана `!tour.repeat`
  });

  const today = '2026-11-19';
  const allRight = (t: Tour): Tour => play(t, t.tasks.map(() => true));
  const dayRow = { today, todayN: 2, played: 2, days: 1, last: 0 };

  // Ловит: «Тур ждёт» пропадает после поражения или победы, пока тур дня не взят (Р73); или остаётся, когда тур уже взят
  it('К2 Р73: «Тур ждёт» — пока тур дня не взят, хоть второй матч; тур взят — «штрафные»; тур повтора не считается', () => {
    const album = { packs: 0, shown: 0, bag: [] } as never;
    const waiting = chainSave(album, dayRow, emptySchool(), today, []);
    expect(waiting.tourWaits).toBe(true);
    expect(afterResult(waiting, { schoolOpen: true }, 0)).toEqual(['tourWaits']);
    const took: School = { ...emptySchool(), tours: [{ ...entry(1, 'number'), day: today }] };
    const taken = chainSave(album, dayRow, took, today, []);
    expect(taken.tourWaits).toBe(false);
    expect(afterResult(taken, { schoolOpen: true }, 0)).toEqual(['kicks']);
    const onlyRepeat: School = { ...emptySchool(), tours: [{ ...entry(1, 'repeat', 0), day: today }] };
    expect(afterResult(chainSave(album, dayRow, onlyRepeat, today, []), { schoolOpen: true }, 0)).toEqual(['tourWaits']);
    // тренажёр вида 5 пропущен: все туры идут видом «повтор» (ТЗ-6.9); тур дня сдан — «штрафные», иначе «Тур ждёт» зовёт вечно
    const past = [1, 2, 3, 4].map((n) => ({ ...entry(n, kindOf(n).id), day: '2026-11-18' }));
    const skipped: School = { ...emptySchool(), trainerSkip: ['multi'], tours: past };
    expect(chainSave(album, dayRow, skipped, today, []).tourWaits).toBe(true); // сегодня туров ещё нет
    const waitingTaken: School = { ...skipped, tours: [...past, { ...entry(4, 'repeat', 0), day: today }] };
    expect(chainSave(album, dayRow, waitingTaken, today, []).tourWaits).toBe(false);
    expect(afterResult(chainSave(album, { ...dayRow, todayN: 3 }, waitingTaken, today, []), { schoolOpen: true }, 0)).toEqual(['kicks']);
    // тренажёр взят — тур обычный, повтор за сегодня его не заменяет
    expect(tourWaits(waitingTaken, dayRow, today, ['multi'])).toBe(true);
    expect(tourWaits({ ...waitingTaken, trainerSkip: [] }, dayRow, today, [])).toBe(true);
  });

  // Ловит: «Тур ждёт» не видит тренажёр, взятый на Базе после пропуска (Р146): ожидание не снимается, тур вида не предлагается
  it('К2 Р146: тренажёр взят после пропуска — ожидание снято и «Тур ждёт» зовёт тур вида; не взят — ждёт, повтор тур дня закрывает', () => {
    const album = { packs: 0, shown: 0, bag: [] } as never;
    const past = [1, 2, 3, 4].map((n) => ({ ...entry(n, kindOf(n).id), day: '2026-11-18' }));
    const skipped: School = { ...emptySchool(), trainerSkip: ['multi'], tours: past };
    const taken: School = { ...skipped, tours: [...past, { ...entry(4, 'repeat', 0), day: today }] }; // тур дня сдан повтором, пока вид ждал
    const day3 = { ...dayRow, todayN: 3 };
    const notTaken = trainersDone({ squad: { step: 0 } }); // игра открыта, но ступени нет
    const bronze = trainersDone({ squad: { step: 1 } });
    expect(waitingKind(skipped, notTaken)).toBe('multi');
    expect(waitingKind(skipped, bronze)).toBeNull();
    expect(afterResult(chainSave(album, day3, taken, today, notTaken), { schoolOpen: true }, 0)).toEqual(['kicks']);
    expect(afterResult(chainSave(album, day3, taken, today, bronze), { schoolOpen: true }, 0)).toEqual(['tourWaits']);
    expect(tourWaits(taken, day3, today, notTaken)).toBe(false);
    expect(tourWaits(taken, day3, today, bronze)).toBe(true);
    expect(schoolExtras(taken, day3, today, bronze).tourWaits).toBe(true); // Дом: подпись «тур ждёт»
    expect(schoolExtras(taken, day3, today, notTaken).tourWaits).toBe(false);
    expect(tourWaits(skipped, day3, today, notTaken)).toBe(true); // сегодня туров ещё нет — ждёт в обоих случаях
    expect(tourWaits(skipped, day3, today, bronze)).toBe(true);
  });

  // Ловит: «Тренажёр» ведёт не в игру своего вида или в игру, которой окно не играет
  it('К2 Р116: «Тренажёр» на карточке тура ведёт в окно игры своего вида — /base?play=<игра>; у вида без тренажёра адреса нет', () => {
    const paths = ['multi', 'fields', 'select', 'match'].map(trainerPath);
    expect(paths).toEqual(['/base?play=squad', '/base?play=board', '/base?play=roster', '/base?play=pairs']);
    for (const kind of ['multi', 'fields', 'select', 'match']) expect(PLAYABLE).toContain(trainerGame(kind));
    expect(['number', 'choice', 'expr', 'fraction', 'order', 'mixed', 'repeat'].map(trainerPath)).toEqual([null, null, null, null, null, null, null]);
  });

  // Ловит: звено «штрафные» ведёт на пустой экран, когда задач для них нет (kicksPlan → null)
  it('К2 ТЗ-6.14: задач для «штрафных» нет — сеанса нет (звено пропускается); есть — 3 задачи, тот же матч — те же задачи', () => {
    expect(kicksRun(emptySchool(), [], today, 2)).toBeNull();
    const a = kicksRun(emptySchool(), bank(12), today, 2);
    const b = kicksRun(emptySchool(), bank(12), today, 2);
    expect(a?.tour.tasks).toHaveLength(3);
    expect(a?.tour.tasks.map((x) => x.id)).toEqual(b?.tour.tasks.map((x) => x.id));
    expect(kicksSeed(today, 2)).not.toBe(kicksSeed(today, 3));
  });

  // Ловит: «штрафные» платят «Знатока» дважды (перезагрузка, вторая вкладка) или тянут монеты
  it('К2 Ш-З2: итог «штрафных» — «Знаток» по верным с первой попытки один раз, монет нет; сданный тур звено пропускает', () => {
    const run = kicksRun(emptySchool(), bank(12), today, 2);
    const done = { ...(run as NonNullable<typeof run>), stage: 'result' as const, tour: play((run as NonNullable<typeof run>).tour, [true, false, true]) };
    expect(settleKicks({ ...done, stage: 'ask' }, purse(), today)).toBeNull(); // не на итоге — ничего
    const out = settleKicks(done, purse(), today);
    expect(out?.knower).toBe(2);
    expect(out?.purse.wallet.coins).toBe(10);
    expect(out?.purse.wallet.paid).toContain(kicksRef(today, done.tour.sid));
    expect(kicksPaid(out?.purse.wallet ?? walletDef.empty(), today, 2)).toBe(true);
    expect(kicksPaid(purse().wallet, today, 2)).toBe(false);
    expect(settleKicks(done, out?.purse ?? purse(), today)?.knower).toBe(0);
    // патч — то, что экран передаёт в сохранение: кошелёк и раздел «Школы» ровно из кассы
    expect(out?.patch.wallet).toEqual(out?.purse.wallet);
    expect(out?.patch.school).toEqual(out?.purse.school);
    expect((out?.patch.school as School).knower).toBe(2);
  });

  // Ловит: при 0 верных метка тура теряется и перезагрузка на итоге даёт те же задачи с известными ответами (Р120)
  it('К2 Р120: «штрафные» без верных — патч всё равно с меткой тура, и вход в звено после этого закрыт', () => {
    const run = kicksRun(emptySchool(), bank(12), today, 2) as NonNullable<ReturnType<typeof kicksRun>>;
    const zero = { ...run, stage: 'result' as const, tour: play(run.tour, [false, false, false]) };
    const out = settleKicks(zero, purse(), today);
    expect(out?.knower).toBe(0);
    expect((out?.patch.wallet as { paid: string[] }).paid).toContain(kicksRef(today, zero.tour.sid));
    expect(kicksEntry(true, out?.patch.wallet as never, today, 2)).toBe('skip');
    expect(kicksEntry(true, purse().wallet, today, 2)).toBe('play');
    expect(kicksEntry(false, purse().wallet, today, 2)).toBe('skip'); // сеанс не ok — записать некуда
    expect(kicksEntry(true, out?.patch.wallet as never, today, 3)).toBe('play'); // следующий матч дня — новые «штрафные»
  });

  // Ловит: тренажёр предлагается снова после бронзы вида; или ведёт в игру чужого вида
  it('К2 ТЗ-6.9: тренажёр у видов 5, 7, 13, 17; взят хотя бы на бронзу — вид «сделан», ступень 0 — нет', () => {
    expect(['multi', 'fields', 'select', 'match'].map(trainerGame)).toEqual(['squad', 'board', 'roster', 'pairs']);
    expect(['number', 'choice', 'expr', 'fraction', 'order', 'mixed', 'нет'].map(trainerGame)).toEqual([null, null, null, null, null, null, null]);
    expect(trainersDone({})).toEqual([]);
    expect(trainersDone({ roster: { step: 0 }, squad: { step: 1 }, pairs: { step: 3 } })).toEqual(['multi', 'match']);
    expect(trainerPath('select')).toBe('/base?play=roster');
    expect(trainerPath('number')).toBeNull();
    const school: School = { ...emptySchool(), tours: [1, 2, 3, 4].map((n) => entry(n, kindOf(n).id)) };
    const multi = Array.from({ length: 6 }, (_, i) => ({ ...num(100 + i), id: `m-${i}`, answer: { kind: 'multi' as const, options: ['а', 'б'], correct: [0] } }));
    expect(tourPlan(school, [...bank(10), ...multi], 4, 1, { trainerDone: trainersDone({ squad: { step: 1 } }) }).trainer).toBeNull();
    expect(tourPlan(school, [...bank(10), ...multi], 4, 1, { trainerDone: trainersDone({ squad: { step: 0 } }) }).trainer).toBe('multi');
  });

  // Ловит: «Тренажёр» на карточке тура N ведёт в закрытую игру (ctx.tour был «последний пройденный», 067-Р211, Р70)
  it('К2 Р211: тренажёр на карточке тура 5, 7, 13, 17 открыт при уроке ниже порога', () => {
    for (const [kind, n] of [['multi', 5], ['fields', 7], ['select', 13], ['match', 17]] as const) {
      const school: School = { ...emptySchool(), tours: Array.from({ length: n - 1 }, (_, i) => entry(i + 1, kindOf(i + 1).id)) };
      const ctx = learnCtxOf({ lesson: 6, keys: 'фывапролдж', school, entries: [], bests: [60], now: 1000, day: today });
      expect(openLearn(trainerGame(kind)!, 'base', ctx, 1), kind).not.toBeNull();
    }
  });

  // Ловит: часть эмблемы за повтор или за вторую медаль того же вида; праздник без десятой части
  it('К2 Ш-З3, ТЗ-6.7: часть — за первую медаль нового вида; тур-повтор части не даёт; праздник — только с десятой', () => {
    const school: School = { ...emptySchool(), tours: [1, 2].map((n) => entry(n, 'number')) };
    const first = finishTour(purse(school), allRight(tourPlan(school, bank(12), 4, 1)), { day: today });
    expect(first.view.newPart).toBeNull(); // тур 3 — «выбор»: задач выбора в банке нет, тур из прежних видов (повтор) — части нет
    const rep = tourPlan(school, bank(12), 4, 2, { repeat: true });
    const rd = finishTour(purse(school), allRight(rep), { day: today });
    expect(rd.view.newPart).toBeNull();
    expect(rd.save.school.emblem).toBe(0);
    // повтор с видом, который без `repeat` дал бы часть (вид «выбор», первая медаль): флаг `repeat` один и держит
    const asNew = finishTour(purse(school), { ...allRight(rep), kind: 'choice' }, { day: today });
    expect(asNew.view.newPart).toBeNull();
    expect(asNew.save.school.emblem).toBe(0);
    expect(finishTour(purse(school), { ...allRight(rep), kind: 'choice', repeat: false }, { day: today }).view.newPart).toBe('choice');
    const last: School = { ...emptySchool(), emblem: 0b0111111111, tours: Array.from({ length: 18 }, (_, i) => entry(i + 1, kindOf(i + 1).id)) };
    const mixed = finishTour(purse(last), allRight(tourPlan(last, bank(20), 4, 3)), { day: today });
    expect(mixed.view).toMatchObject({ newPart: 'mixed', emblemN: 10, emblemDone: true });
    const again = finishTour(purse(mixed.save.school), allRight(tourPlan(mixed.save.school, bank(20), 4, 4)), { day: today });
    expect(again.view).toMatchObject({ newPart: null, emblemDone: false });
  });

  it('К13 Р133: «Тур ждёт» — звено цепочки без общей шапки (рисует свою, «матч»), как пак; остальные пути Школы — с меню «Дом»', () => {
    const meta = (path: string) => routes.find((r) => r.path === path)?.meta;
    expect(meta('/school/waits')).toMatchObject({ bare: true });
    expect(meta('/school/tour')).toMatchObject({ menu: 'home' });
    expect(meta('/school/tour')?.bare).toBeUndefined();
  });
});

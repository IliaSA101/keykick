/**
 * Ритм дня (068 Т3, К5): время печати, итог дня, совет и «пальцы устали», микроразминка. Часы и день — снаружи.
 */
import { describe, expect, it } from 'vitest';
import { coachLine, markCoachLine, tiredNorm } from '../../src/engine/day/advice';
import { addAcc, addTyped, dayDef, emptyDay, playedMatch, type Day } from '../../src/engine/day/section';
import { daySummary, summaryDue } from '../../src/engine/day/summary';
import { warmupAt, warmupAtBreak, warmupDone, warmupDoneAtBreak, warmupDue } from '../../src/engine/day/warmup';
import { useMatchWarmup } from '../../src/app/day/useMatchWarmup';
import { afterMatch } from '../../src/engine/day/flow';
import { emptyLog, factsOfLog, noteMatch } from '../../src/engine/day/log';
import { coachText, stripView } from '../../src/app/day/view';
import { emptyStory, type Story } from '../../src/engine/story/section';
import { markPaperShown, releasePapers } from '../../src/engine/story';
import { useResultDay, type ResultDayDeps } from '../../src/app/day/useResultDay';
import { clubDef } from '../../src/engine/club/section';
import { schoolDef, type School } from '../../src/engine/school/section';
import { ru } from '../../src/i18n/ru';
import type { ResultView } from '../../src/engine/match';

const D1 = '2026-11-10';
const D2 = '2026-11-11';
const MIN = 60 * 1000;

/** n матчей подряд в день `day`. */
const play = (d: Day, day: string, n: number): Day => Array.from({ length: n }).reduce<Day>((x, _, k) => playedMatch(x, day, k), d);

describe('раздел day v2', () => {
  it('К5: v1 поднимается до v2 без потери счётчиков; проверка ловит битое', () => {
    // Ловит: потерю played/days при миграции и пропуск отрицательного времени печати.
    const v1 = { played: 4, days: 3, today: D1, todayN: 1, last: 5 };
    expect(dayDef.up[2]!(v1)).toEqual({ ...emptyDay(), ...v1 });
    expect(dayDef.check(emptyDay())).toEqual([]);
    expect(dayDef.check({ ...emptyDay(), typedMs: -1 })).toEqual(['typedMs']);
    expect(dayDef.check({ ...emptyDay(), acc: { a: [1, 2, 3, 4, 5, 6] } })).toEqual(['acc:v']);
  });

  it('К5: матч сохраняет время печати и точности; точности — окно из 5', () => {
    // Ловит: playedMatch затирает поля v2; окно растёт без предела.
    const typed = addTyped(emptyDay(), D1, 5 * MIN);
    expect(playedMatch(typed, D1, 1).typedMs).toBe(5 * MIN);
    const acc = [900, 910, 920, 930, 940, 950, 960].reduce((d, p) => addAcc(d, D1, 'l1', 3, p), emptyDay());
    expect(acc.acc?.['3']).toEqual([920, 930, 940, 950, 960]);
  });

  it('К5: время и точность нормализуются — дробное и больше 1000 не ломают check', () => {
    // Ловит: дробные мс и ‰ из часов/счёта попадают в сохранение, и раздел отвергается (запись молча не проходит).
    const d = addAcc(addTyped(emptyDay(), D1, 1234.7), D1, 'l1', 3, 1500.4);
    expect(d.typedMs).toBe(1235);
    expect(d.todayMs).toBe(1235);
    expect(d.acc?.['3']).toEqual([1000]);
    expect(dayDef.check(d)).toEqual([]);
    const low = addAcc(addTyped(emptyDay(), D1, -50), D1, 'l1', 3, -7.4);
    expect(low.typedMs).toBe(0);
    expect(low.acc?.['3']).toEqual([0]);
    expect(dayDef.check(addAcc(addTyped(emptyDay(), D1, Number.NaN), D1, 'l1', 3, 912.6))).toEqual([]);
  });

  it('К5: проверка ловит битые msDay и серию', () => {
    // Ловит: msDay не проверяется как дата (мутант «msDay без isDay»); серия с мусором проходит.
    expect(dayDef.check({ ...emptyDay(), msDay: 'вчера' })).toEqual(['msDay']);
    expect(dayDef.check({ ...emptyDay(), series: { lessonId: 'a', day: 'вчера', n: 1 } })).toEqual(['series']);
    expect(dayDef.check({ ...emptyDay(), series: { lessonId: 'a', day: D1, n: 0 } })).toEqual(['series']);
    expect(dayDef.check({ ...emptyDay(), series: { lessonId: 'a', day: D1, n: 2 } })).toEqual([]);
  });

  it('К5 068-Р18: серия растёт только у того же урока в тот же день', () => {
    // Ловит: серия не обнуляется при смене урока или дня («два подряд» превращается в «два за всё время»).
    let d = addAcc(emptyDay(), D1, 'A', 3, 900);
    expect(d.series).toEqual({ lessonId: 'A', day: D1, n: 1 });
    d = addAcc(d, D1, 'A', 3, 900);
    expect(d.series?.n).toBe(2);
    d = addAcc(d, D1, 'B', 3, 900);
    expect(d.series).toEqual({ lessonId: 'B', day: D1, n: 1 });
    d = addAcc(addAcc(d, D1, 'A', 3, 900), D2, 'A', 3, 900);
    expect(d.series).toEqual({ lessonId: 'A', day: D2, n: 1 });
  });
});

describe('итог дня', () => {
  it('К5: пора — после 3-го доигранного матча или 40 мин печати за день', () => {
    // Ловит: итог после 2-го матча, 40 мин вчерашней печати, итог по печати не срабатывает.
    expect(summaryDue(play(emptyDay(), D1, 2), D1)).toBe(false);
    expect(summaryDue(play(emptyDay(), D1, 3), D1)).toBe(true);
    const typed = addTyped(play(emptyDay(), D1, 1), D1, 40 * MIN);
    expect(summaryDue(typed, D1)).toBe(true);
    expect(summaryDue(addTyped(play(emptyDay(), D1, 1), D1, 39 * MIN), D1)).toBe(false);
    expect(summaryDue(typed, D2)).toBe(false);
    // Ловит: условие `d.today === today` убрано (вчерашние 3 матча дают итог сегодня) и `d.msDay === today` (печать чужого дня).
    expect(summaryDue(play(emptyDay(), D1, 3), D2)).toBe(false);
    expect(summaryDue({ ...play(emptyDay(), D2, 1), todayMs: 45 * MIN, msDay: D1 }, D2)).toBe(false);
  });

  it('К5: непоказанный выпуск — вместо полосы; показан — полоса', () => {
    // Ловит: полоса при непоказанном выпуске (ТЗ-10.3) и выпуск повторно после показа.
    let story: Story = releasePapers(emptyStory(), { cur: 6, cup: { first: false, group: false, semi: false, final: null }, day: 1 });
    expect(daySummary(story, { events: [], next: 7 })).toEqual({ kind: 'paper', n: 1 });
    story = markPaperShown(story, 1);
    expect(daySummary(story, { events: [], next: 7 })).toEqual({ kind: 'strip', head: { key: 'train' }, items: [], next: 7 });
  });

  it('К5: заголовок — старшее событие, пункты — остальные ≤ 3, «пройден» всегда, звёзды +1 — только пунктом', () => {
    // Ловит: порядок старшинства story.md §3, больше трёх пунктов, звёзды +1 заголовком, потерянный «пройден».
    const s = emptyStory();
    const r = daySummary(s, {
      events: [{ key: 'record', params: { n: 200 } }, { key: 'control', params: { n: 14 } }, { key: 'stars', params: { n: 1 } }, { key: 'letters' }, { key: 'return' }],
      passed: { n: 14 },
      next: 15,
    });
    expect(r).toMatchObject({ kind: 'strip', head: { key: 'return' }, next: 15 });
    if (r.kind !== 'strip') throw new Error('strip');
    expect(r.items.map((i) => i.key)).toEqual(['control', 'letters', 'passed']); // 068-Р93: «Пройден» — последним
    const stars1 = daySummary(s, { events: [{ key: 'stars', params: { n: 1 } }], next: null });
    expect(stars1).toMatchObject({ head: { key: 'train' }, items: [{ key: 'stars' }] });
    expect(daySummary(s, { events: [{ key: 'stars', params: { n: 2 } }], next: null })).toMatchObject({ head: { key: 'stars' } });
  });

  it('К5: «тренировка» не пункт полосы — только заголовок, когда других событий нет', () => {
    // Ловит: `train` попадает в пункты рядом с настоящим событием.
    expect(daySummary(emptyStory(), { events: [{ key: 'train' }, { key: 'record', params: { n: 200 } }], next: 3 })).toMatchObject({ head: { key: 'record' }, items: [] });
  });
});

describe('совет ритма и «пальцы устали»', () => {
  /** Матчи урока `lesson` в день `day` с точностями `list` (‰), ступень 3. */
  const withAcc = (d: Day, list: number[], lesson = 'l9', day = D1): Day => list.reduce((x, p) => addAcc(x, day, lesson, 3, p), d);

  it('К5: дни 1–4 — совет после 1-го матча, с 5-го — после 2-го, раз в день', () => {
    // Ловит: совет до 2-го матча с 5-го дня, пропущенный совет в дни 1–4, повтор в тот же день.
    const early = { ...play(emptyDay(), D1, 1), days: 3 };
    expect(coachLine({ day: early, story: emptyStory() }, D1, 3)).toBe('advice');
    const late = { ...play(emptyDay(), D1, 1), days: 5 };
    expect(coachLine({ day: late, story: emptyStory() }, D1, 3)).toBeNull();
    expect(coachLine({ day: playedMatch(late, D1, 2), story: emptyStory() }, D1, 3)).toBe('advice');
    const story = markCoachLine(emptyStory(), 'advice', 3);
    expect(coachLine({ day: early, story }, D1, 3)).toBeNull();
    expect(coachLine({ day: early, story: emptyStory() }, D2, 3)).toBeNull();
  });

  it('К5: два матча подряд ≥ 3 п. п. ниже медианы пяти — «пальцы устали» вместо совета; раз в день, и не вместе с советом', () => {
    // Ловит: порог 2 п. п. вместо 3, «устали» при новой ступени (< 5 матчей), оба сообщения за день (С5).
    const tired = withAcc(play(emptyDay(), D1, 2), [940, 950, 960, 900, 910]);
    expect(tiredNorm(tired, 3)).toEqual({ acc: 91, norm: 94 });
    expect(coachLine({ day: tired, story: emptyStory() }, D1, 3)).toBe('tired');
    expect(coachLine({ day: { ...tired, days: 6 }, story: markCoachLine(emptyStory(), 'tired', 6) }, D1, 3)).toBeNull();
    expect(coachLine({ day: { ...tired, days: 6 }, story: markCoachLine(emptyStory(), 'advice', 6) }, D1, 3)).toBeNull();
    const near = withAcc(play(emptyDay(), D1, 2), [940, 950, 960, 915, 915]);
    expect(tiredNorm(near, 3)).toBeNull();
    // Норма считается по ступени: другая ступень без своих пяти матчей — нормы нет.
    expect(tiredNorm(tired, 4)).toBeNull();
  });

  it('К5 068-Р18: меньше пяти матчей ступени — «устали» не срабатывает, даже если два последних низкие', () => {
    // Ловит: граница окна `< 5` сдвинута на `< 4` (на четырёх матчах норма уже считается).
    const four = withAcc(play(emptyDay(), D1, 2), [960, 960, 900, 900]);
    expect(tiredNorm(four, 3)).toBeNull();
    expect(coachLine({ day: four, story: emptyStory() }, D1, 3)).toBe('advice');
    expect(tiredNorm(withAcc(play(emptyDay(), D1, 2), [960, 960, 960, 900, 900]), 3)).not.toBeNull();
  });

  it('К5 068-Р18: два плохих матча ОДНОГО урока в один день при норме из 5 матчей ступени — «устали»; норма — по ступени, не по уроку', () => {
    // Ловит: норма по уроку (у урока A всего 2 матча), «подряд» не по серии.
    const before = withAcc(play(emptyDay(), D1, 3), [960, 960, 960], 'B');
    const today = withAcc(play(before, D2, 2), [900, 900], 'A', D2);
    expect(tiredNorm(today, 3)).toEqual({ acc: 90, norm: 96 });
    expect(coachLine({ day: today, story: emptyStory() }, D2, 3)).toBe('tired');
  });

  it('К5 068-Р18: вчера плохой матч урока A, сегодня B, затем плохой A — НЕ «устали» (сценарий ревью)', () => {
    // Ловит: «два подряд» как todayN ≥ 2 плюс два низких в окне — серия урока и дня не проверяется.
    let d = withAcc(play(emptyDay(), D1, 3), [960, 960, 960], 'A');
    d = withAcc(play(d, D2, 2), [900], 'B', D2);
    d = withAcc(d, [900], 'A', D2);
    expect(d.acc?.['3']).toEqual([960, 960, 960, 900, 900]);
    expect(d.series).toEqual({ lessonId: 'A', day: D2, n: 1 });
    expect(coachLine({ day: d, story: emptyStory() }, D2, 3)).toBe('advice');
  });

  it('К5 068-Р18: серия вчерашнего дня не считается сегодня; новый урок — не срабатывает', () => {
    // Ловит: серия не привязана к дню; «устали» на первом матче урока.
    const y = withAcc(play(emptyDay(), D1, 2), [960, 960, 960, 900, 900], 'A');
    expect(coachLine({ day: y, story: emptyStory() }, D1, 3)).toBe('tired');
    const next = playedMatch(y, D2, 9);
    expect(coachLine({ day: next, story: emptyStory() }, D2, 3)).toBe('advice');
    expect(coachLine({ day: withAcc(next, [900], 'C', D2), story: emptyStory() }, D2, 3)).toBe('advice');
  });
});

describe('микроразминка', () => {
  it('К5: пора после 20 мин печати с прошлой разминки; выполнение и пропуск обнуляют счёт', () => {
    // Ловит: 19 мин вместо 20, счёт не обнуляется после разминки.
    let d = addTyped(emptyDay(), D1, 19 * MIN);
    expect(warmupDue(d, D1)).toBe(false);
    d = addTyped(d, D1, 1 * MIN);
    expect(warmupDue(d, D1)).toBe(true);
    d = warmupDone(d);
    expect(warmupDue(d, D1)).toBe(false);
    expect(warmupDue(addTyped(d, D1, 20 * MIN), D1)).toBe(true);
  });

  it('К5 С4: не посреди атаки — только перед матчем и в перерыве', () => {
    // Ловит: разминка в разгар атаки (ТЗ-10.5).
    const d = addTyped(emptyDay(), D1, 25 * MIN);
    expect(warmupAt(d, D1, 'start')).toBe(true);
    expect(warmupAt(d, D1, 'break')).toBe(true);
    expect(warmupAt(d, D1, 'attack')).toBe(false);
  });

  it('К5: новый игровой день — счёт заново', () => {
    // Ловит: разминка с утра из-за вчерашних 20 мин (story.md §4а).
    const d = addTyped(emptyDay(), D1, 25 * MIN);
    expect(warmupDue(d, D2)).toBe(false);
    const next = addTyped(d, D2, 1 * MIN);
    expect(warmupDue(next, D2)).toBe(false);
    expect(next.todayMs).toBe(1 * MIN);
  });
});

describe('068-Р69: микроразминка в матче', () => {
  it('К5 Р69: в перерыве время первого тайма идёт в счёт — 17 мин до матча и 4 мин тайма дают разминку, без тайма — нет', () => {
    // Ловит: перерыв смотрит только на записанное (время тайма пишется на свистке) — разминка опаздывает на целый матч.
    const d = addTyped(emptyDay(), D1, 17 * MIN);
    expect(warmupAtBreak(d, D1, 0)).toBe(false);
    expect(warmupAtBreak(d, D1, 4 * MIN)).toBe(true);
    expect(d.typedMs).toBe(17 * MIN); // день не меняется: проверка не пишет
  });

  it('К5 Р69: разминка в перерыве — счёт идёт заново с неё: после свистка с временем матча остаётся только второй тайм', () => {
    // Ловит: точка отсчёта = записанное время (тайм считается дважды) — разминка снова на следующем матче.
    const d = addTyped(emptyDay(), D1, 18 * MIN);
    const warmed = warmupDoneAtBreak(d, 5 * MIN);
    expect(warmed.typedMs).toBe(18 * MIN); // время тайма на свистке запишется целиком
    const whistle = addTyped(warmed, D1, 9 * MIN); // весь матч — 9 мин
    expect(warmupDue(whistle, D1)).toBe(false);
    expect(whistle.typedMs).toBe(27 * MIN);
    expect(whistle.warmFrom).toBe(23 * MIN);
    expect(warmupDue(addTyped(whistle, D1, 16 * MIN), D1)).toBe(true); // 4 мин второго тайма + 16 = 20
  });

  it('К5 Р69 С4: перед матчем — по записанному; окно открывается раз, «Готово» и «Пропустить» пишут день один раз', () => {
    // Ловит: окно на каждый «На матч» после разминки; двойная запись; разминка при малой печати.
    const saved: Day[] = [];
    const closed: string[] = [];
    let day = addTyped(emptyDay(), D1, 25 * MIN);
    const w = useMatchWarmup({ day: () => day, today: () => D1, saveDay: (x) => void saved.push((day = x)), halfMs: () => 0 }, (at) => void closed.push(at));
    expect(w.offerStart()).toBe(true);
    expect(w.open.value).toBe(true);
    expect(w.offerStart()).toBe(true); // двойной Enter: то же окно, не второе
    w.close();
    w.close();
    expect(saved).toEqual([warmupDone(addTyped(emptyDay(), D1, 25 * MIN))]);
    expect(closed).toEqual(['start']);
    expect(w.open.value).toBe(false);
    expect(w.offerStart()).toBe(false); // счёт обнулён
    expect(w.offerBreak()).toBe(false);
  });

  it('К5 Р69: в перерыве окно с временем тайма; закрытие пишет точку впереди записанного', () => {
    // Ловит: перерыв игнорирует halfMs; закрытие в перерыве пишет `warmupDone` без тайма.
    const saved: Day[] = [];
    const closed: string[] = [];
    const day = addTyped(emptyDay(), D1, 17 * MIN);
    const w = useMatchWarmup({ day: () => day, today: () => D1, saveDay: (x) => void saved.push(x), halfMs: () => 4 * MIN }, (at) => void closed.push(at));
    expect(w.offerStart()).toBe(false); // перед матчем 17 мин — рано
    expect(w.offerBreak()).toBe(true);
    w.close();
    expect(saved).toEqual([warmupDoneAtBreak(day, 4 * MIN)]);
    expect(saved[0]?.warmFrom).toBe(21 * MIN);
    expect(closed).toEqual(['break']);
  });
});

/** Матч в день `day`: день после свистка и решение `afterMatch`. */
const run = (before: Day, day: string, ms: number, acc: number, story: Story = emptyStory()) => {
  const after = addAcc(addTyped(playedMatch(before, day, 1), day, ms), day, 'l1', 3, acc);
  return { after, out: afterMatch(before, after, story, day, 3) };
};

describe('068-Т8: после матча — строка тренера и итог дня', () => {

  it('068-Т8-К1: итог дня — ровно на 3-м матче дня и ровно на пересечении 40 мин, не на каждом следующем', () => {
    // Ловит: итог на каждом матче после порога (повтор окна), пропуск 3-го матча, итог в день без матчей.
    let d = emptyDay();
    const flags: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = run(d, D1, 5 * MIN, 900);
      flags.push(r.out.summary);
      d = r.after;
    }
    expect(flags).toEqual([false, false, true, false]);
    const slow = run(addTyped(playedMatch(emptyDay(), D1, 1), D1, 35 * MIN), D1, 6 * MIN, 900);
    expect(slow.out.summary).toBe(true);
    expect(run(slow.after, D1, 1 * MIN, 900).out.summary).toBe(false);
  });

  it('068-Т8-К2: С5 — строка тренера пишет день: совет и «пальцы устали» в один день не вместе, перезагрузка не повторяет', () => {
    // Ловит: две строки за день, отсутствие отметки показанной строки в story.
    const first = run(emptyDay(), D1, MIN, 900);
    expect(first.out.line).toBe('advice');
    expect(first.out.story.adviceDay).toBe(first.after.days);
    const again = run(first.after, D1, MIN, 900, first.out.story);
    expect(again.out.line).toBeNull();
    expect(again.out.story).toBe(first.out.story);
  });

  it('068-Т8-К3: журнал дня копит звёзды и рекорд, сбрасывается в новый день; без журнала — «Тренировка дня»', () => {
    // Ловит: перенос вчерашних звёзд в полосу сегодня, потерю последнего пройденного урока.
    let log = noteMatch(null, D1, { newStars: 1, recordCpm: 20, passedLesson: 3 });
    log = noteMatch(log, D1, { newStars: 2, recordCpm: 25, passedLesson: null });
    expect(log).toMatchObject({ matches: 2, stars: 3, record: 25, passed: 3 });
    expect(factsOfLog(log, D1, 4, 9)).toEqual({ events: [{ key: 'record', params: { n: 25 } }, { key: 'stars', params: { n: 3, all: 9 } }], passed: { n: 3 }, next: 4 });
    expect(factsOfLog(log, D2, 4, 9)).toEqual({ events: [], next: 4 });
    expect(noteMatch(log, D2, { newStars: 0, recordCpm: null, passedLesson: null })).toEqual({ ...emptyLog(D2), matches: 1 });
  });

  it('068-Р73: матч Кубка — событие дня «Кубок»: старше рекорда и звёзд, в полосе заголовком со счётом и двором, следующий матч урока его не стирает', () => {
    // Ловит: матч Кубка не попадает в журнал дня (полоса после Кубка — «Тренировка дня»); Кубок младше рекорда; затёртый следующим матчем.
    const cup = { a: 2, b: 1, street: 'Заречной' }; // в журнале — улица, «двор на …» строит вид полосы (rivalName, неразрывный пробел)
    let log = noteMatch(null, D1, { newStars: 3, recordCpm: 180, passedLesson: null });
    log = noteMatch(log, D1, { newStars: 0, recordCpm: null, passedLesson: null, cup });
    log = noteMatch(log, D1, { newStars: 0, recordCpm: null, passedLesson: null });
    expect(log.cup).toEqual(cup);
    const facts = factsOfLog(log, D1, 7, 12);
    expect(facts.events.map((e) => e.key)).toEqual(['cup', 'record', 'stars']);
    const sum = daySummary(emptyStory(), facts);
    expect(sum.kind === 'strip' && sum.head.key).toBe('cup');
    const view = stripView(sum as Extract<typeof sum, { kind: 'strip' }>, { club: 'Прогресс', day: 3, lessonName: (n) => `урок-${n}` });
    expect(view.head).toBe('Кубок: Прогресс 2:1 — двор\u00A0на Заречной');
    expect(view.items).toEqual(['Рекорд дня: 180 зн/мин'.replace('зн/мин', ru.result.perMinute), '+3 ★ сегодня, всего 12']);
    expect(noteMatch(log, D2, { newStars: 0, recordCpm: null, passedLesson: null }).cup).toBeNull(); // новый день — заново
  });

  describe('068-Р78: остальные события полосы (story §3)', () => {
    const strip = (log: ReturnType<typeof noteMatch> | null, school: Parameters<typeof factsOfLog>[4] = null) => {
      const s = daySummary(emptyStory(), factsOfLog(log, D1, 40, 80, school));
      if (s.kind !== 'strip') throw new Error('полоса');
      return { s, v: stripView(s, { club: 'Прогресс', day: 9, lessonName: (n) => `урок-${n}` }) };
    };
    const quiet = { newStars: 0, recordCpm: null, passedLesson: null } as const;
    const tour = (o: Partial<School['tours'][number]>): School => ({ ...schoolDef.empty(), tours: [{ n: 4, kind: 'logic', medal: 2, first: 3, day: D1, ...o }] });

    it('К78 return: «Капитан вернулся» — старше Кубка, заголовок и пункт; следующий матч дня его не стирает, новый день — стирает', () => {
      // Ловит: потерю события возврата (журнал / старшинство); возврат младше Кубка.
      let log = noteMatch(null, D1, { ...quiet, cup: { a: 1, b: 0, street: 'Заречной' }, returned: true });
      log = noteMatch(log, D1, quiet);
      const { v } = strip(log);
      expect(v.head).toBe('Капитан вернулся — и сразу в игру!');
      expect(v.items[0]).toContain('Кубок');
      expect(strip(noteMatch(null, D1, { ...quiet, returned: true })).v.items).toEqual([]);
      expect(noteMatch(log, D2, quiet).returned).toBe(false);
    });

    it('К78 control: контрольный урок (14, 21) пройден впервые — «Контрольный «имя» сдан!»; обычный урок и повтор — нет', () => {
      // Ловит: событие за любой пройденный урок или за непройденный контрольный.
      expect(strip(noteMatch(null, D1, { ...quiet, passedLesson: 14 })).v.head).toBe('Контрольный «урок-14» сдан!');
      expect(strip(noteMatch(null, D1, { ...quiet, passedLesson: 13 })).s.head.key).not.toBe('control');
      expect(strip(noteMatch(null, D1, quiet)).s.head.key).toBe('train');
    });

    it('К78 letters: новые буквы засчитываются, только если урок пройден впервые; несколько уроков — без повторов', () => {
      // Ловит: буквы за матч без прохода; потерю букв предыдущего урока дня.
      expect(strip(noteMatch(null, D1, { ...quiet, letters: 'ыв' })).s.head.key).toBe('train');
      let log = noteMatch(null, D1, { ...quiet, passedLesson: 3, letters: 'ыв' });
      log = noteMatch(log, D1, { ...quiet, passedLesson: 4, letters: 'ва' });
      expect(strip(log).v.head).toBe('В составе новенькие: Ы, В, А');
    });

    it('К78 stage: прохождение урока, после которого достраивается ступень (2 — ворота), — «Во дворе — ворота»; другой урок — нет', () => {
      // Ловит: ступень берётся не из yard.json (`after`), а по номеру урока наугад.
      expect(strip(noteMatch(null, D1, { ...quiet, passedLesson: 2 })).v.head).toBe('Во дворе — ворота');
      expect(strip(noteMatch(null, D1, { ...quiet, passedLesson: 3 })).s.head.key).not.toBe('stage');
    });

    it('К78 medal: медаль тура дня из раздела «Школа» — старше звёзд, младше рекорда; вчерашняя, без медали и тур-повтор — нет', () => {
      // Ловит: медаль за любой тур; вчерашняя медаль в сегодняшней полосе; медаль выше рекорда.
      const base = noteMatch(null, D1, { newStars: 3, recordCpm: null, passedLesson: null });
      expect(strip(base, tour({})).v.head).toBe('Медаль тура 4 — Знаток всё ближе');
      expect(strip(noteMatch(null, D1, { newStars: 1, recordCpm: 90, passedLesson: null }), tour({})).v.head).toBe('Рекорд дня: 90 знаков в минуту');
      for (const o of [{ day: D2 }, { medal: 0 }, { kind: 'repeat' }]) expect(strip(base, tour(o)).s.head.key).toBe('stars');
    });

    it('К93 пункты — теми же строками, что заголовки, «Пройден» — последним (068-Р93, story §3)', () => {
      // Ловит: отдельные «короткие» строки пунктов (`item.*`) и «Пройден» первым пунктом.
      const log = noteMatch(null, D1, { newStars: 1, recordCpm: null, passedLesson: 14, cup: { a: 2, b: 1, street: 'Заречной' }, returned: true });
      const { v, s } = strip(log, tour({}));
      expect(v.head).toBe('Капитан вернулся — и сразу в игру!');
      const headOf = (o: Partial<Parameters<typeof noteMatch>[2]>) => strip(noteMatch(null, D1, { ...quiet, ...o })).v.head;
      expect(v.items[0]).toBe(headOf({ cup: { a: 2, b: 1, street: 'Заречной' } }));
      expect(v.items[1]).toBe(headOf({ passedLesson: 14 }));
      expect(v.items.at(-1)).toBe('Пройден: урок 14 «урок-14»');
      expect(s.kind === 'strip' && s.items.at(-1)?.key).toBe('passed');
    });

    it('К78 старшинство: все события сразу — порядок story §3, пунктов не больше трёх, «Пройден» последним (Р93)', () => {
      // Ловит: сбитый порядок EVENTS и обрезку пунктов.
      let log = noteMatch(null, D1, { newStars: 3, recordCpm: 50, passedLesson: 14, cup: { a: 1, b: 0, street: 'Заречной' }, returned: true, letters: 'ы' });
      log = noteMatch(log, D1, { ...quiet, passedLesson: 2, letters: 'в' });
      const { s } = strip(log, tour({}));
      expect(s.kind === 'strip' && [s.head.key, ...s.items.map((i) => i.key)]).toEqual(['return', 'cup', 'control', 'passed']);
    });
  });

  it('068-Т8-К4: тексты — совет дней 1–4 и с 5-го, «устали» с числами, полоса с рекордом, звёздами и завтра', () => {
    // Ловит: перепутанные строки совета, потерянный «завтра» и «Двор пройден».
    expect(coachText('advice', { days: 2, next: 5 })).toContain('одного в день');
    expect(coachText('advice', { days: 9, next: 5 })).toContain('Два матча');
    expect(coachText('advice', { days: 9, next: null })).toContain('Двор пройден');
    expect(coachText('tired', { days: 9, next: 5, acc: 79, norm: 85 })).toContain('79');
    const s = daySummary(emptyStory(), factsOfLog(noteMatch(null, D1, { newStars: 1, recordCpm: 25, passedLesson: 17 }), D1, 18, 40));
    if (s.kind !== 'strip') throw new Error('полоса');
    const v = stripView(s, { club: 'Прогресс', day: 9, lessonName: (n) => `урок-${n}` });
    expect(v.head).toBe('Рекорд дня: 25 знаков в минуту');
    expect(v.items).toEqual(['+1 ★ сегодня, всего 40', 'Пройден: урок 17 «урок-17»']);
    expect(v.items.at(-1)?.startsWith(v.passedLead)).toBe(true); // Э6.36: зачин «Пройден:» выделяет полоса, пункт начинается с него
    expect(v.passedLead).toBe('Пройден:');
    expect(v.tomorrow).toBe('Завтра — урок 18 «урок-18»');
  });
});

describe('068-Т8 доправка: день на экране итога', () => {
  const view = (o: Partial<ResultView> = {}): ResultView => ({ newStars: 1, starsAll: 1, passed: true, cpm: 30, record: { kind: 'none', best: null }, ...o }) as ResultView;
  /** Зависимости итога: `saved` — что экран записал в сеансе. */
  const deps = (o: Partial<ResultDayDeps> & { pid: string }): { d: ResultDayDeps; saved: { day: Day[]; story: Story[] } } => {
    const saved = { day: [] as Day[], story: [] as Story[] };
    const d: ResultDayDeps = {
      rhythm: undefined, view: view(), no: 5, today: () => D1, next: () => 6, allStars: () => 3, day: () => emptyDay(), story: () => emptyStory(), club: () => clubDef.empty(),
      lessonName: (n) => `урок-${n}`, saveStory: (x) => void saved.story.push(x), saveDay: (x) => void saved.day.push(x), ...o,
    };
    return { d, saved };
  };
  const rhythm = (o: Partial<ReturnType<typeof afterMatch>>): ReturnType<typeof afterMatch> => ({ story: emptyStory(), line: null, summary: false, tired: null, ...o });
  const stripOf = (r: ReturnType<typeof useResultDay>) => (r.openSummary(), r.strip.value);

  it('К-ревью 1: журнал дня — свой у каждого игрока: звёзды и «Пройден» игрока А не видны игроку Б', () => {
    // Ловит: модульный журнал на вкладку — у Б в полосе чужие «+3 ★» и «Пройден».
    const a = useResultDay(deps({ pid: 'pA', view: view({ newStars: 3, starsAll: 3 }), no: 6, rhythm: rhythm({ summary: true }) }).d);
    expect(stripOf(a)?.items.join('|')).toContain('Пройден: урок 6');
    const b = useResultDay(deps({ pid: 'pB', view: view({ newStars: 0, starsAll: 2 }), rhythm: rhythm({ summary: true }) }).d);
    const sb = stripOf(b);
    expect(sb?.items.join('|') ?? '').not.toContain('Пройден');
    expect(sb?.head).toBe('Тренировка дня');
    const a2 = useResultDay(deps({ pid: 'pA', view: view({ newStars: 0, starsAll: 3 }), rhythm: rhythm({ summary: true }) }).d);
    const sa = stripOf(a2);
    expect([sa?.head, ...(sa?.items ?? [])].join('|')).toContain('+3 ★ за день'); // свой журнал А живёт между матчами
  });

  it('К-ревью 7: «пройден» — только впервые: повтор уже пройденного урока в журнал не идёт', () => {
    // Ловит: `newStars > 0` — доборные звёзды давали «Пройден» старого урока.
    const r = useResultDay(deps({ pid: 'pC', view: view({ newStars: 1, starsAll: 3 }), rhythm: rhythm({ summary: true }) }).d);
    expect(stripOf(r)?.items.join('|') ?? '').not.toContain('Пройден');
  });

  it('К-ревью 2: 3-й матч без строки тренера — первая кнопка «Итог дня» (act), без итога и строки — обычная цепочка', () => {
    // Ловит: `summary` на свистке не доходит до карточки — «Итога дня» на 3-м матче нет.
    expect(useResultDay(deps({ pid: 'pD', rhythm: rhythm({ summary: true }) }).d).act.value).toBe('summary');
    expect(useResultDay(deps({ pid: 'pD', rhythm: rhythm({}) }).d).act.value).toBeNull();
    expect(useResultDay(deps({ pid: 'pD', rhythm: rhythm({ line: 'advice' }) }).d).act.value).toBe('summary');
    expect(useResultDay(deps({ pid: 'pD', rhythm: rhythm({ line: 'tired', tired: { acc: 79, norm: 86 } }) }).d).act.value).toBe('warmup');
  });

  it('К-ревью 7: числа «устали» — со свистка; без них (saved: false) строка не показывает «0 %»', () => {
    // Ловит: пересчёт по несохранённому дню — «точность 0 %, норма 0 %».
    const withN = useResultDay(deps({ pid: 'pE', rhythm: rhythm({ line: 'tired', tired: { acc: 79, norm: 86 } }) }).d);
    expect(withN.coach.value?.text).toContain('79');
    expect(withN.coach.value?.text).toContain('86');
  });

  it('К-ревью 6: разминка («Готово» и «Пропустить») обнуляет счёт печати через сохранение дня; второй вызов не пишет', () => {
    // Ловит: счёт 20 мин не обнуляется — разминка предлагается снова на каждом матче.
    const day = { ...emptyDay(), typedMs: 25 * MIN, warmFrom: 0 };
    const x = deps({ pid: 'pF', rhythm: rhythm({ line: 'tired', tired: { acc: 79, norm: 86 } }), day: () => day });
    const r = useResultDay(x.d);
    r.openWarm();
    r.closeWarm();
    r.closeWarm();
    expect(x.saved.day).toEqual([warmupDone(day)]);
    expect(x.saved.day[0]?.warmFrom).toBe(25 * MIN);
    expect(r.act.value).toBe('summary');
  });

  it('К-ревью 3 068-Р64: строка тренера не считается и не помечается, если карточка её не покажет; итог дня остаётся', () => {
    // Ловит: в «Застрял» строка помечена показанной — совет дня потерян, хотя ребёнок его не видел.
    const before = playedMatch(playedMatch(emptyDay(), D1, 1), D1, 2);
    const after = addAcc(addTyped(playedMatch(before, D1, 3), D1, MIN), D1, 'l1', 3, 900);
    const story = emptyStory();
    const hidden = afterMatch(before, after, story, D1, 3, false);
    expect(hidden.line).toBeNull();
    expect(hidden.story).toBe(story);
    expect(hidden.summary).toBe(true);
    expect(afterMatch(before, after, story, D1, 3).line).toBe('advice');
  });

  it('К-ревью 1 (блокер): выпуск вместо полосы — после его пометки показанной окно выпуска остаётся, полосы нет', () => {
    // Ловит: `strip` пересчитывался по уже помеченному `story` — ребёнок видел «Тренировку дня», а выпуск терялся.
    let story: Story = releasePapers(emptyStory(), { cur: 6, cup: { first: false, group: false, semi: false, final: null }, day: 1 });
    const x = deps({ pid: 'pG', rhythm: rhythm({ summary: true }), story: () => story, saveStory: (s) => void (story = s) });
    const r = useResultDay(x.d);
    r.openSummary();
    expect(r.paper.value).toBe(1);
    expect(r.strip.value).toBeNull();
    expect(story.papers['1']?.shown).toBe(true);
    r.openSummary();
    expect(r.strip.value).toBeNull();
    expect(r.paper.value).toBe(1);
  });

  it('К78 проводка: итог матча с returned и буквами урока, пройденного впервые, доходит до полосы экрана итога', () => {
    // Ловит: `rhythm.returned` / `letters` не доходят из useResultDay в журнал.
    const r = useResultDay({ ...deps({ pid: 'pR78', view: view({ newStars: 1, starsAll: 1 }), no: 2, letters: 'ыв', rhythm: { line: null, summary: true, tired: null, returned: true } }).d });
    expect(stripOf(r)?.head).toBe('Капитан вернулся — и сразу в игру!');
    expect(stripOf(r)?.items.join('|')).toContain('В составе новенькие: Ы, В');
  });

  describe('068-Р70: итог дня, пришедшийся на «Застрял», — на следующем матче дня', () => {
    const third = (): { before: Day; after: Day } => {
      const before = play(emptyDay(), D1, 2);
      return { before, after: addAcc(addTyped(playedMatch(before, D1, 3), D1, MIN), D1, 'l1', 3, 900) };
    };

    it('К-ревью 3: на «Застрял» долг пишется в day, следующий матч дня — итог, долг снят; другой день — без итога', () => {
      // Ловит: ребёнок теряет итог дня из-за трудного матча (пересечение порога бывает один раз).
      const { before, after } = third();
      const stuck = afterMatch(before, after, emptyStory(), D1, 3, false);
      expect(stuck.day?.summaryMissed).toBe(D1);
      const next = run(stuck.day ?? after, D1, MIN, 900);
      expect(next.out.summary).toBe(true);
      expect(next.out.day?.summaryMissed).toBeNull();
      expect(run(next.out.day ?? next.after, D1, MIN, 900).out.summary).toBe(false);
      // «Застрял» и на следующем — долг остаётся; следующий день — долга нет
      const again = afterMatch(stuck.day ?? after, addTyped(playedMatch(stuck.day ?? after, D1, 4), D1, MIN), emptyStory(), D1, 3, false);
      expect(again.day).toBeUndefined();
      expect(run({ ...stuck.day!, todayN: 0 }, D2, MIN, 900).out.summary).toBe(false);
    });

    it('К-ревью 3: итог показан на пересечении — долга нет, поле day не трогаем', () => {
      // Ловит: лишняя запись раздела day на каждом свистке.
      const { before, after } = third();
      expect(afterMatch(before, after, emptyStory(), D1, 3).day).toBeUndefined();
    });

    it('К-ревью 3: Кубок — итог дня показывается без строки (summaryShows при shows = false); раздел day проверяется', () => {
      // Ловит: итог дня в Кубке пометил долг и потерялся; битое поле пропущено проверкой.
      const { before, after } = third();
      const cup = afterMatch(before, after, emptyStory(), D1, 0, false, true);
      expect(cup.summary).toBe(true);
      expect(cup.line).toBeNull();
      expect(cup.day).toBeUndefined();
      expect(dayDef.check({ ...emptyDay(), summaryMissed: D1 })).toEqual([]);
      expect(dayDef.check({ ...emptyDay(), summaryMissed: 'вчера' })).toContain('summaryMissed');
    });
  });

  it('068-Т8б-К-ревью: матч Кубка через useResultDay попадает в журнал дня — полоса «Итога дня» со счётом и улицей соперника', () => {
    // Ловит: Кубок не пишется в журнал (полоса — «Тренировка дня»); улица пуста («двор на » — соперник брался до загрузки пакета).
    const r = useResultDay(deps({ pid: 'pCup', view: null, rhythm: rhythm({ summary: true }), cup: { a: 2, b: 1, street: 'Заречной' }, club: () => ({ ...clubDef.empty(), name: 'Прогресс' }) }).d);
    const strip = stripOf(r);
    expect(strip?.head).toBe('Кубок: Прогресс 2:1 — двор\u00A0на Заречной');
  });
});

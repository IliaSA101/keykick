/**
 * Счёт матча: атака по ошибкам строки, зачёт по решающей серии (спека 008: правила лиги), звёзды,
 * итог, два тайма. Пенальти по ходу матча (спека 005): план по зерну, гол в счёт, награда с таймом.
 */
import { describe, expect, it } from 'vitest';
import lessonsJson from '../src/content/lessons.json';
import { cupAdvances } from '../src/engine/cup';
import {
  DECISIVE_MAX_ERRORS,
  LEAGUE_RULES,
  MATCH_HALVES,
  addAttack,
  addPenalty,
  attackResult,
  decisiveReserve,
  emptyScore,
  isDecisive,
  leagueRules,
  lessonPassed,
  matchStats,
  outcome,
  seriesFrom,
  seriesIsNew,
  starsFor,
  type AttackResult,
} from '../src/engine/match';
import {
  MID_GOAL_COINS,
  MISS_COINS,
  earnedPenalty,
  penaltyCoins,
  penaltyNow,
  penaltyPlan,
  penaltyReason,
  recordKick,
  scoredTasks,
  settleKick,
  type MidKick,
} from '../src/engine/midPenalty';
import { createRandom, randomInt } from '../src/engine/random';
import { applyFirstHalf, applyHalf, emptySave } from '../src/engine/save';
import { accuracy, charsPerMinute, emptyStats, halfTime } from '../src/engine/typing';

/** Правила решающей: двор — одна атака и 2 ошибки, район — серия 2 и 3 ошибки на обе (спека 008). */
const yard = leagueRules('yard');
const district = leagueRules('district');

describe('счёт матча', () => {
  it('строка без ошибок — гол, 1–2 ошибки — сейв, 3+ — гол в наши ворота', () => {
    expect([0, 1, 2, 3, 7].map(attackResult)).toEqual(['goal', 'save', 'save', 'conceded', 'conceded']);
  });

  it('счёт копится по атакам и даёт итог', () => {
    const score = [0, 0, 1, 4, 0, 3].reduce(addAttack, emptyScore);
    expect([score.goals, score.conceded, score.attacks.length]).toEqual([3, 2, 6]);
    expect(outcome(score)).toBe('win');
    expect(outcome([3, 0].reduce(addAttack, emptyScore))).toBe('draw');
    expect(outcome([5].reduce(addAttack, emptyScore))).toBe('loss');
  });

  it('правила лиги: двор — серия 1 и запас 2, район и город — серия 2 и запас 3, незнакомая — как двор', () => {
    expect(yard).toEqual({ series: 1, maxErrors: DECISIVE_MAX_ERRORS });
    expect(district).toEqual({ series: 2, maxErrors: 3 });
    expect(leagueRules('city')).toEqual({ series: 2, maxErrors: 3 });
    expect([leagueRules('region'), leagueRules(''), leagueRules('toString')]).toEqual([yard, yard, yard]);
    // Областной в коде нет, пока нет лиги (008-Р13).
    expect(Object.keys(LEAGUE_RULES)).toEqual(['yard', 'district', 'city']);
  });

  it('зачёт урока — решающая атака не больше чем с 2 ошибками', () => {
    expect([0, 1, 2, 3, 9].map((n) => lessonPassed(n, yard))).toEqual([true, true, true, false, false]);
  });

  it('зачёт в районе — серия не больше чем с 3 ошибками на обе атаки', () => {
    expect([0, 2, 3, 4, 9].map((n) => lessonPassed(n, district))).toEqual([true, true, true, false, false]);
  });

  it('запас ошибок решающей — сколько ещё можно ошибиться до провала, не меньше нуля', () => {
    expect([0, 1, 2, 3, 9].map((n) => decisiveReserve(n, yard))).toEqual([2, 1, 0, 0, 0]);
    expect(decisiveReserve(0, yard)).toBe(DECISIVE_MAX_ERRORS);
    expect([0, 1, 2, 3, 4].map((n) => decisiveReserve(n, district))).toEqual([3, 2, 1, 0, 0]);
    // Запас есть ровно пока урок ещё зачитывается — в обеих лигах.
    for (const rules of [yard, district]) {
      for (const n of [0, 1, 2, 3, 4, 5]) expect(decisiveReserve(n, rules) > 0).toBe(lessonPassed(n + 1, rules));
    }
  });

  it('звёзды: 1 — без зачёта, 2 — зачёт, 3 — решающая без ошибок и точность тайма ≥ 97 %', () => {
    const at = (correct: number, errors: number, decisive: number) =>
      starsFor({ ...emptyStats, correct, errors }, decisive, yard);
    expect([at(97, 3, 0), at(96, 4, 0), at(100, 0, 1), at(100, 0, 2), at(100, 0, 3), at(10, 90, 0)]).toEqual([
      3, 2, 2, 2, 1, 2,
    ]);
  });

  it('звёзды в районе: ★★ — серия в запасе, ★★★ — серия без ошибок и точность ≥ 97 %', () => {
    const at = (correct: number, errors: number, decisive: number) =>
      starsFor({ ...emptyStats, correct, errors }, decisive, district);
    expect([at(97, 3, 0), at(96, 4, 0), at(100, 0, 1), at(100, 0, 3), at(100, 0, 4)]).toEqual([3, 2, 2, 2, 1]);
  });

  it('решающая — только шестая атака второго тайма', () => {
    expect([isDecisive(1, 5, 6, 1), isDecisive(2, 4, 6, 1), isDecisive(2, 5, 6, 1), isDecisive(2, 0, 1, 1)]).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it('решающая серия района — пятая и шестая атаки второго тайма; строк меньше серии — весь тайм', () => {
    expect([isDecisive(2, 4, 6, 2), isDecisive(2, 5, 6, 2), isDecisive(2, 3, 6, 2)]).toEqual([true, true, false]);
    expect([isDecisive(1, 5, 6, 2), isDecisive(1, 4, 6, 2), isDecisive(2, 4, 6, 1)]).toEqual([false, false, false]);
    expect([seriesFrom(6, 2), seriesFrom(6, 1), seriesFrom(1, 2), seriesFrom(2, 2)]).toEqual([4, 5, 0, 0]);
    expect([isDecisive(2, 0, 1, 2), isDecisive(2, 0, 2, 2), isDecisive(2, 1, 2, 2)]).toEqual([true, true, true]);
  });

  it('3 ошибки в 5-й атаке: «пропустили», запаса нет, но чистая 6-я — зачёт; 2 + 2 — два сейва и незачёт', () => {
    // Сумма серии — функция хода (app/matchFlow, scoreAttack): здесь — её правило по атакам серии.
    const series = (errors: number[]) => ({
      attacks: errors.map(attackResult),
      reserveAfterFirst: decisiveReserve(errors[0] ?? 0, district),
      passed: lessonPassed(
        errors.reduce((a, b) => a + b, 0),
        district,
      ),
    });
    expect(series([3, 0])).toEqual({ attacks: ['conceded', 'goal'], reserveAfterFirst: 0, passed: true });
    expect(series([2, 2])).toEqual({ attacks: ['save', 'save'], reserveAfterFirst: 1, passed: false });
  });

  it('правило серии — новое на первом уроке района: «Новое!» по урокам, без поля сохранения', () => {
    const real = lessonsJson.lessons;
    const fresh = real.filter((l) => seriesIsNew(real, l.id)).map((l) => l.id);
    expect(fresh).toEqual(['district-1']);
    expect([seriesIsNew(real, 'yard-1'), seriesIsNew(real, 'city-1'), seriesIsNew(real, 'none')]).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('счётчики матча — сумма таймов: точность, скорость и время за оба, ошибки клавиш складываются', () => {
    const first = {
      ...emptyStats,
      correct: 40,
      errors: 10,
      keyErrors: { KeyF: 2 },
      fingerErrors: { lp: 2 },
      startedAt: 1000,
      lastAt: 9000,
      intervals: [200, 300],
    };
    const second = {
      ...emptyStats,
      correct: 50,
      errors: 0,
      keyErrors: { KeyF: 1, KeyJ: 3 },
      startedAt: 60_000,
      lastAt: 70_000,
      intervals: [500],
    };
    const both = matchStats([first, second]);
    expect([both.correct, both.errors, accuracy(both)]).toEqual([90, 10, 0.9]);
    expect(both.keyErrors).toEqual({ KeyF: 3, KeyJ: 3 });
    expect(both.fingerErrors).toEqual({ lp: 2 });
    expect([both.startedAt, both.lastAt, halfTime(both)]).toEqual([1000, 70_000, 1000]);
    expect(charsPerMinute(both)).toBe(5400);
    expect(matchStats([emptyStats, second]).startedAt).toBe(60_000);
    expect(matchStats([emptyStats, emptyStats])).toEqual(emptyStats);
  });
});

describe('пенальти по ходу матча: когда', () => {
  const LINES = 6;

  it('первое — по зерну после атаки 2, 3 или 4 первого тайма; одно зерно — тот же план', () => {
    const firsts = Array.from({ length: 300 }, (_, seed) => penaltyPlan(seed).first);
    expect([...new Set(firsts)].sort()).toEqual([2, 3, 4]);
    expect(penaltyPlan(77)).toEqual(penaltyPlan(77));
  });

  it('второй тайм: две чистые атаки подряд, не раньше атаки 2 и не позже атаки 4', () => {
    const g = 'goal' as const;
    const cases: [AttackResult[], boolean][] = [
      [[g], false],
      [[g, g], true],
      [['save', g], false],
      [['save', g, g], true],
      [[g, 'conceded', g], false],
      [['save', 'save', g, g], true],
      [['save', 'save', 'save', g, g], false], // атака 5 — поздно
      [[g, g, g, g, g, g], false],
    ];
    for (const [attacks, earned] of cases) expect(earnedPenalty(attacks), attacks.join()).toBe(earned);
  });

  it('по ходу матча: одно за тайм, два за матч; в разминке, на атаках 5–6 и на решающей — нет', () => {
    // Двор — серия 1, район — серия 2 (008-Р7): во втором тайме района — только после атак 2–3.
    for (const rules of [yard, district]) {
      const from = seriesFrom(LINES, rules.series);
      for (let seed = 0; seed < 500; seed++) {
        const plan = penaltyPlan(seed);
        const rnd = createRandom(seed + 1);
        let total = 0;
        for (let half = 1; half <= MATCH_HALVES; half++) {
          const attacks: AttackResult[] = [];
          let taken = false;
          for (let line = 0; line < LINES; line++) {
            attacks.push(attackResult(randomInt(rnd, 3) === 0 ? randomInt(rnd, 4) : 0));
            if (!penaltyNow(plan, half, attacks, LINES, taken, from)) continue;
            const n = attacks.length;
            expect(n).toBeGreaterThanOrEqual(2);
            expect(n).toBeLessThanOrEqual(4);
            if (half === 1) expect(n).toBe(plan.first);
            else {
              expect(attacks.slice(-2)).toEqual(['goal', 'goal']);
              // Следующая строка — не из серии.
              expect(n).toBeLessThan(from);
              if (rules === district) expect(n).toBeLessThanOrEqual(3);
            }
            taken = true;
            total += 1;
          }
          // Первый тайм — всегда; второй — только если заработал.
          if (half === 1) expect(taken).toBe(true);
        }
        expect(total).toBeLessThanOrEqual(2);
      }
    }
    const plan = { first: 4 };
    const from = seriesFrom(LINES, 1);
    const four: AttackResult[] = ['goal', 'goal', 'goal', 'goal'];
    expect(penaltyNow(plan, 0, four, LINES, false, from)).toBe(false); // разминка — не тайм
    expect(penaltyNow(plan, 1, four, LINES, true, from)).toBe(false); // уже было в этом тайме
    expect(penaltyNow(plan, 1, four, 4, false, from)).toBe(false); // последняя строка тайма
    expect(penaltyNow(plan, 2, ['goal', 'goal'], 2, false, seriesFrom(2, 1))).toBe(false); // решающая
    expect(penaltyNow(plan, 2, ['goal', 'goal'], LINES, false, from)).toBe(true);
    // Серия 2: после атаки 4 следующая строка — первая атака серии, пенальти нет; после атаки 3 — есть.
    const series = seriesFrom(LINES, 2);
    expect(penaltyNow(plan, 2, four, LINES, false, series)).toBe(false);
    expect(penaltyNow(plan, 2, four.slice(1), LINES, false, series)).toBe(true);
    expect(penaltyNow(plan, 2, four, LINES, false, from)).toBe(true);
    // Первый тайм серия не трогает: план после атаки 4 — пенальти и в районе.
    expect(penaltyNow(plan, 1, four, LINES, false, series)).toBe(true);
  });
});

describe('пенальти по ходу матча: счёт и награда', () => {
  const kick = (taskId: string, result: MidKick['result']): MidKick => ({ taskId, result });

  it('гол с пенальти — в счёт и в счётчик пенальти; атакой не считается', () => {
    const scored = addPenalty([0, 3].reduce(addAttack, emptyScore), true);
    expect([scored.goals, scored.conceded, scored.attacks]).toEqual([2, 1, ['goal', 'conceded']]);
    expect(scored.penalties).toEqual({ taken: 1, scored: 1 });
    const missed = addPenalty(scored, false);
    expect([missed.goals, missed.penalties]).toEqual([2, { taken: 2, scored: 1 }]);
    // Следующие атаки счётчик не теряют.
    expect(addAttack(missed, 0).penalties).toEqual({ taken: 2, scored: 1 });
    expect(emptyScore.penalties).toEqual({ taken: 0, scored: 0 });
  });

  it('звёзды и зачёт — только по печати; в кубке гол с пенальти решает счёт, как любой', () => {
    const lost = [0, 3, 4].reduce(addAttack, emptyScore);
    const level = addPenalty(lost, true);
    expect([outcome(lost), outcome(level), outcome(addPenalty(level, true))]).toEqual(['loss', 'draw', 'win']);
    // Ничья с пенальти — проход по решающей; победа с пенальти — проход и без зачёта.
    expect([cupAdvances(lost, 0, yard), cupAdvances(level, 0, yard), cupAdvances(level, 3, yard)]).toEqual([
      false,
      true,
      false,
    ]);
    expect(cupAdvances(addPenalty(level, true), 3, yard)).toBe(true);
    // Звёзды и зачёт не видят счёта: те же счётчики печати — те же звёзды.
    const stats = { ...emptyStats, correct: 99, errors: 1 };
    expect([starsFor(stats, 0, yard), starsFor(stats, 3, yard), lessonPassed(3, yard)]).toEqual([3, 1, false]);
  });

  it('монеты: верно — 10, промах с ответом — 2, «Не бить» — 0; повтор задачи — один раз', () => {
    expect([MID_GOAL_COINS, MISS_COINS]).toEqual([10, 2]);
    const one = [kick('a', 'scored'), kick('b', 'missed'), kick('c', 'skipped')].map((k) => penaltyCoins([k]));
    expect(one).toEqual([10, 2, 0]);
    expect(penaltyCoins([kick('a', 'scored'), kick('a', 'scored'), kick('b', 'missed')])).toBe(12);
    expect(scoredTasks([kick('a', 'scored'), kick('b', 'missed'), kick('a', 'scored')])).toEqual(['a']);
    // Двойной Enter и повторный ответ после решения — пишется только первый.
    const once = recordKick([], 'a', 'missed');
    expect(recordKick(once, 'a', 'scored')).toBe(once);
    expect(recordKick(once, '', 'scored')).toBe(once);
    expect(recordKick(once, 'b', 'skipped')).toEqual([kick('a', 'missed'), kick('b', 'skipped')]);
  });

  it('ответ на экране: засчитан первый — двойной Enter, клик и Esc после ответа ничего не добавляют', () => {
    expect([penaltyReason(1), penaltyReason(2)]).toEqual(['foul', 'earned']);
    const start = { turn: { taskId: 'q1', reason: penaltyReason(1), result: null }, kicks: [], score: emptyScore };
    const goal = settleKick(start, 'scored');
    expect([goal.turn.result, goal.kicks, goal.score.goals, goal.score.penalties]).toEqual([
      'scored',
      [kick('q1', 'scored')],
      1,
      { taken: 1, scored: 1 },
    ]);
    // Повтор — тот же объект: ни второго гола, ни второй записи удара.
    expect(settleKick(goal, 'scored')).toBe(goal);
    expect(settleKick(goal, 'skipped')).toBe(goal);
    const miss = settleKick(start, 'missed');
    expect([miss.score.goals, miss.score.penalties, miss.kicks]).toEqual([0, { taken: 1, scored: 0 }, [kick('q1', 'missed')]]);
    // «Не бить» — удар в тайме записан (второго пенальти в тайме не будет), счётчик и счёт не тронуты.
    const skip = settleKick(start, 'skipped');
    expect([skip.score, skip.kicks, skip.turn.result]).toEqual([emptyScore, [kick('q1', 'skipped')], 'skipped']);
  });

  it('пишется с таймом: первый тайм — монеты и решённые; без пенальти — ничего', () => {
    const stats = { ...emptyStats };
    const goal = applyFirstHalf(emptySave(), { goals: 2, stats, penalties: [kick('q1', 'scored')] });
    expect([goal.coins, goal.solvedTasks, goal.goals, goal.pendingPacks]).toEqual([10, ['q1'], 2, 0]);
    const miss = applyFirstHalf(emptySave(), { goals: 1, stats, penalties: [kick('q1', 'missed')] });
    expect([miss.coins, miss.solvedTasks]).toEqual([2, []]);
    const skip = applyFirstHalf(emptySave(), { goals: 1, stats, penalties: [kick('q1', 'skipped')] });
    expect([skip.coins, skip.solvedTasks]).toEqual([0, []]);
    expect(applyFirstHalf(emptySave(), { goals: 1, stats }).coins).toBe(0);
    // Уже решённая задача второй раз в решённые не идёт; монеты — за удар.
    const again = applyFirstHalf(goal, { goals: 1, stats, penalties: [kick('q1', 'scored')] });
    expect([again.coins, again.solvedTasks]).toEqual([20, ['q1']]);
    // Второй тайм: монеты за пенальти — к звёздным, урок — по звёздам.
    const half = { lessonId: 'a', stars: 2 as const, goals: 1, stats, penalties: [kick('q2', 'missed')] };
    const end = applyHalf(goal, half, ['a', 'b']);
    expect([end.coins, end.solvedTasks, end.lessonIndex]).toEqual([10 + 20 + 2, ['q1'], 1]);
  });
});

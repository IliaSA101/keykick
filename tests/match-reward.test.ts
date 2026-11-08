/**
 * Матч v2 (спека 017, Т2): монеты и остаток, доигранные матчи и возврат, форма пальцев, пенальти.
 * Случайность — только зерном (`createRandom`), часы — числами.
 */
import { describe, expect, it } from 'vitest';
import matchJson from '../src/content/match.json';
import tasksJson from '../src/content/tasks.json';
import leaguesJson from '../src/content/leagues.json';
import { courseLessons } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { createRandom } from '../src/engine/random';
import { parseTasks } from '../src/engine/tasks';
import { addFans, earn, emptyWallet, isPaid, payBlock, untilCoin } from '../src/engine/matchResult/coins';
import {
  DAY_MS,
  comebackDue,
  countsAsPlayed,
  emptyPlayed,
  opensDay,
  recordPlayed,
  speedFor,
  type PlayedMatch,
} from '../src/engine/matchResult/played';
import { emptyForm, formGrowth, pushPresses, rawRank, settleForm, type FormPress, type FormState } from '../src/engine/matchResult/form';
import { answerKick, kickDue, kickTask } from '../src/engine/match/kick';
import { parseMatchRules } from '../src/engine/match/rules';
import { emptyScore } from '../src/engine/match/score';
import { accuracyFor } from '../src/engine/course/odds';

const rules = parseMatchRules(matchJson, keymap);
const per = rules.coinPer;
const leagueIds = (leaguesJson as { leagues: { id: string }[] }).leagues.map((l) => l.id);

describe('монеты и остаток (К8)', () => {
  it('0 и 50 ошибок платят поровну: считаются только верные нажатия', () => {
    // Ловит: вычет за ошибки или ставка от точности — монеты не должны зависеть от числа ошибок.
    // Подпись оплаты принимает только верные: блок «100 верных, 0 ошибок» и «100 верных, 50 ошибок» — один вход.
    const blocks = [{ correct: 100, errors: 0 }, { correct: 100, errors: 50 }];
    const pay = blocks.map((b) => payBlock(emptyWallet, b.correct, true, per));
    expect(pay[1]).toEqual(pay[0]);
    expect(pay[0]).toEqual({ coins: 5, carry: 0 });
  });

  it('остаток целый и переходит между блоками; сумма не зависит от разбивки на блоки', () => {
    // Ловит: потерю остатка на границе блока (floor каждый раз), дробные монеты, остаток ≥ ставки.
    const blocks = [7, 13, 1, 19, 20, 40, 3];
    let w = emptyWallet;
    for (const b of blocks) {
      w = payBlock(w, b, true, per);
      expect(Number.isInteger(w.coins) && Number.isInteger(w.carry)).toBe(true);
      expect(w.carry).toBeGreaterThanOrEqual(0);
      expect(w.carry).toBeLessThan(per);
    }
    const total = blocks.reduce((a, b) => a + b, 0);
    expect(w).toEqual({ coins: Math.floor(total / per), carry: total % per });
    expect(payBlock(emptyWallet, total, true, per)).toEqual(w);
  });

  it('ставка берётся из контента: per = coinPer; «512 верных → 25 монет», до монеты ещё 8', () => {
    // Ловит: зашитое число 20 в коде вместо coinPer, неверный расчёт «до монеты».
    expect(per).toBe(20);
    expect(earn(0, 512, per)).toEqual({ coins: 25, carry: 12 });
    expect(untilCoin(12, per)).toBe(8);
    expect(earn(0, 512, 25)).toEqual({ coins: 20, carry: 12 });
    expect(earn(3, 0, per)).toEqual({ coins: 0, carry: 3 });
  });

  it('позапрошлая лига — 0 монет и остаток не меняется; текущая и прошлая платят', () => {
    // Ловит: оплату позапрошлой лиги, потерю остатка у неоплачиваемого урока, ошибку на границе «прошлая лига».
    const [a, b, c] = leagueIds;
    expect(isPaid(c ?? '', c ?? '', leagueIds)).toBe(true);
    expect(isPaid(b ?? '', c ?? '', leagueIds)).toBe(true);
    expect(isPaid(a ?? '', c ?? '', leagueIds)).toBe(false);
    expect(isPaid('нет', c ?? '', leagueIds)).toBe(false);
    const w = { coins: 4, carry: 9 };
    expect(payBlock(w, 500, false, per)).toEqual(w);
  });

  it('разминка, доп. время, переигровка и тренер платят как любой блок; 10-й матч дня и повтор — как первый', () => {
    // Ловит: дневной счётчик или скидку за повтор — функция оплаты не знает ни числа матчей, ни звёзд.
    const first = payBlock(emptyWallet, 60, true, per);
    let w = emptyWallet;
    for (let match = 0; match < 10; match += 1) {
      const before = w;
      w = payBlock(w, 60, true, per);
      expect(w.coins - before.coins).toBe(match === 0 ? first.coins : Math.floor((before.carry + 60) / per));
    }
    expect(w.coins).toBe(30);
    expect(payBlock(emptyWallet, 60, true, per)).toEqual(first);
  });

  it('болельщики: верные кладутся в лигу урока; ошибки и нули — ничего', () => {
    // Ловит: запись в лигу игрока вместо лиги урока, подсчёт нуля как записи.
    const f1 = addFans({}, 'yard', 120);
    const f2 = addFans(f1, 'yard', 30);
    expect(f2).toEqual({ yard: 150 });
    expect(addFans(f2, 'academy', 5)).toEqual({ yard: 150, academy: 5 });
    expect(addFans(f2, 'academy', 0)).toBe(f2);
  });
});

const rec = (over: Partial<PlayedMatch> = {}): PlayedMatch => ({
  at: 0,
  lessonId: 'yard-01',
  league: 'yard',
  kind: 'lesson',
  cpm: 100,
  accuracy: 0.9,
  passed: true,
  stars: 1,
  help: 'none',
  ...over,
});

describe('доигранные матчи, скорость, возврат (К7, К9)', () => {
  it('доигранный и переигровка — да; брошенный, тренер, микроразминка — нет', () => {
    // Ловит: запись брошенного матча или минуты тренера в скорость и возврат.
    expect(countsAsPlayed('match')).toBe(true);
    expect(countsAsPlayed('replay')).toBe(true);
    for (const s of ['abandoned', 'coach', 'micro'] as const) {
      expect(countsAsPlayed(s)).toBe(false);
      expect(recordPlayed(emptyPlayed, s, rec(), rules.speedMatches)).toBe(emptyPlayed);
    }
  });

  it('кубок открывает день; урок — только текущей и прошлой лиги', () => {
    // Ловит: день, открытый уроком позапрошлой лиги, и закрытый кубок.
    const [a, , c] = leagueIds;
    expect(opensDay({ kind: 'cup', league: a ?? '' }, c ?? '', leagueIds)).toBe(true);
    expect(opensDay({ kind: 'lesson', league: a ?? '' }, c ?? '', leagueIds)).toBe(false);
    expect(opensDay({ kind: 'lesson', league: c ?? '' }, c ?? '', leagueIds)).toBe(true);
  });

  it('скорость — медиана cpm трёх последних матчей лиги, чужая лига не мешает; нет матчей — null', () => {
    // Ловит: среднее вместо медианы, старые матчи в медиане, смешение лиг, число вместо null без матчей.
    let log = emptyPlayed;
    expect(speedFor(log, 'yard', rules.speedMatches)).toBeNull();
    for (const cpm of [500, 100, 300, 200]) log = recordPlayed(log, 'match', rec({ cpm }), rules.speedMatches);
    log = recordPlayed(log, 'match', rec({ cpm: 9999, league: 'other' }), rules.speedMatches);
    expect(log.byLeague.yard?.length).toBe(rules.speedMatches);
    expect(speedFor(log, 'yard', rules.speedMatches)).toBe(200); // 100, 300, 200 → медиана 200 (500 вытеснен)
    expect(speedFor(log, 'none', rules.speedMatches)).toBeNull();
  });

  it('возврат: ≥ 5 × 24 ч — да; 4 × 24 ч и пять часов без суток — нет; матчей не было — нет', () => {
    // Ловит: календарные дни вместо часов, строгое > на границе, баннер новичку без матчей.
    const log = recordPlayed(emptyPlayed, 'match', rec({ at: 1000 }), rules.speedMatches);
    const d = rules.comebackDays;
    expect(comebackDue(log, 1000 + d * DAY_MS, d)).toBe(true);
    expect(comebackDue(log, 1000 + d * DAY_MS - 1, d)).toBe(false);
    expect(comebackDue(log, 1000 + 4 * DAY_MS, d)).toBe(false);
    expect(comebackDue(emptyPlayed, 99 * DAY_MS, d)).toBe(false);
    const aband = recordPlayed(log, 'abandoned', rec({ at: 1000 + 9 * DAY_MS }), rules.speedMatches);
    expect(aband.lastFinishedAt).toBe(1000);
  });
});

/** Нажатия пальца `finger` на его клавишах: верно с вероятностью `acc`, по зерну. */
function presses(chars: string, n: number, acc: number, rnd: () => number): FormPress[] {
  return Array.from({ length: n }, (_, i) => ({ char: chars[i % chars.length] ?? '', ok: rnd() < acc }));
}
const index = rules.squad.find((s) => s.finger === 'li');
const idxKeys = index?.keys ?? '';

describe('форма клавиш (К6)', () => {
  it('разминка не идёт в окно; чужие знаки (пробел, верхний ряд) — тоже', () => {
    // Ловит: ошибки разминки в окне формы (ТЗ-2.3), пробел или «й» в окне указательного.
    const rnd = createRandom(1);
    const warm = pushPresses(emptyForm, rules.squad, presses(idxKeys, 80, 0.5, rnd), 'warmup', rules.form);
    expect(warm).toBe(emptyForm);
    const foreign = pushPresses(emptyForm, rules.squad, [{ char: ' ', ok: true }, { char: 'й', ok: false }], 'attack', rules.form);
    expect(foreign.li).toBeUndefined();
    for (const src of ['attack', 'extra', 'coach'] as const) {
      const f = pushPresses(emptyForm, rules.squad, presses(idxKeys, 10, 1, rnd), src, rules.form);
      expect(f.li?.recent.length).toBe(10);
    }
  });

  it('окно держит последние 300 и порядок; клавиши ряда пальца идут одному игроку (а и п — указательный)', () => {
    // Ловит: окно длиннее window, потерю порядка, раздачу «п» не тому пальцу.
    const first = Array.from({ length: 300 }, () => ({ char: 'а', ok: false }));
    const then = Array.from({ length: 5 }, () => ({ char: 'п', ok: true }));
    const f = pushPresses(emptyForm, rules.squad, [...first, ...then], 'attack', rules.form);
    expect(f.li?.recent.length).toBe(rules.form.window);
    expect(f.li?.recent.slice(-5)).toEqual([true, true, true, true, true]);
    expect(f.li?.recent[0]).toBe(false);
  });

  it('«новичок» и «основа» — с 50 нажатий; до 50 — юниор', () => {
    // Ловит: ранг по 49 нажатиям и отсутствие ранга на 50-м.
    const ok = (n: number) => Array.from({ length: n }, () => true);
    expect(rawRank(ok(49), rules.form)).toBe(0);
    expect(rawRank(ok(50), rules.form)).toBe(rules.form.fullWindowFrom); // 100 % на 50 нажатиях — не выше «основа»
    const f = pushPresses(emptyForm, rules.squad, ok(50).map((o) => ({ char: 'а', ok: o })), 'attack', rules.form);
    expect(settleForm(f, rules.squad, rules.form).li?.maxRank).toBe(2);
  });

  it('«сборная» и «звезда» — только полное окно 300 и два итога подряд', () => {
    // Ловит: высокий ранг на неполном окне, без подтверждения, с одного итога, при сбросе подтверждения.
    const all = (n: number) => Array.from({ length: n }, () => ({ char: 'а', ok: true }));
    let f = pushPresses(emptyForm, rules.squad, all(299), 'attack', rules.form);
    f = settleForm(settleForm(f, rules.squad, rules.form), rules.squad, rules.form);
    expect(f.li?.maxRank).toBe(2); // окно 299 — выше «основа» не бывает, сколько итогов ни подряд
    f = pushPresses(f, rules.squad, all(1), 'attack', rules.form); // окно 300, 100 %
    f = settleForm(f, rules.squad, rules.form);
    expect(f.li?.maxRank).toBe(2); // первый итог — только кандидат
    expect(f.li?.candidate).toEqual({ rank: 4, n: 1 });
    f = settleForm(f, rules.squad, rules.form);
    expect(f.li?.maxRank).toBe(4); // второй подряд — «звезда»
    // сброс подтверждения: точность упала между итогами
    let g = pushPresses(emptyForm, rules.squad, all(300), 'attack', rules.form);
    g = settleForm(g, rules.squad, rules.form);
    g = pushPresses(g, rules.squad, Array.from({ length: 60 }, () => ({ char: 'а', ok: false })), 'attack', rules.form);
    g = settleForm(g, rules.squad, rules.form);
    expect(g.li?.candidate).toBeNull();
    // Ловит: сброс подтверждения при колебании порога (4→3 — «сборная» держалась оба итога; 3→4 — тоже).
    const at = (pct: number) => Array.from({ length: 300 }, (_, i) => ({ char: 'а', ok: i >= 300 - (300 * pct) / 100 }));
    const step = (s: typeof emptyForm, pct: number) => settleForm(pushPresses(s, rules.squad, at(pct), 'attack', rules.form), rules.squad, rules.form);
    const r4 = 100;
    const r3 = 98;
    expect(rawRank(at(r4).map((x) => x.ok), rules.form)).toBe(4);
    expect(rawRank(at(r3).map((x) => x.ok), rules.form)).toBe(3);
    expect(step(step(emptyForm, r4), r3).li?.maxRank).toBe(3);
    const up = step(step(emptyForm, r3), r4);
    expect(up.li?.maxRank).toBe(3); // «не ниже 3» — два итога подряд; «звезда» — ещё нет
    expect(step(up, r4).li?.maxRank).toBe(4);
    expect(g.li?.maxRank).toBe(2);
  });

  it('ранг не падает, когда окно ухудшилось; показ — только рост', () => {
    // Ловит: пересчёт maxRank «вниз» после плохого матча, показ падения.
    const good = Array.from({ length: 300 }, () => ({ char: 'а', ok: true }));
    let f = pushPresses(emptyForm, rules.squad, good, 'attack', rules.form);
    f = settleForm(settleForm(f, rules.squad, rules.form), rules.squad, rules.form);
    const top = f.li?.maxRank ?? 0;
    expect(top).toBe(4);
    const worse = pushPresses(f, rules.squad, Array.from({ length: 300 }, () => ({ char: 'а', ok: false })), 'attack', rules.form);
    const after = settleForm(worse, rules.squad, rules.form);
    expect(after.li?.maxRank).toBe(top);
    expect(formGrowth(f, after, rules.squad, rules.form)).toEqual([]);
    expect(formGrowth(emptyForm, f, rules.squad, rules.form).map((g) => [g.finger, g.from, g.rank])).toEqual([['li', 0, 4]]);
  });

  it('«что выросло» (017-Р26): рост точности окна в %, только рост; без базы проценты не считаются; ранг — отдельно', () => {
    // Ловит: падение точности в показе, «+90 %» на пустом окне, потерю процентов при смене ранга, дробные проценты.
    const win = (n: number, ok: number): boolean[] => Array.from({ length: n }, (_, i) => i < ok);
    const form = (recent: boolean[], maxRank = 0) => ({ li: { recent, maxRank, candidate: null } });
    const grow = (a: FormState, b: FormState) => formGrowth(a, b, rules.squad, rules.form);
    expect(grow(form(win(100, 80)), form(win(100, 85)))).toEqual([{ finger: 'li', name: 'Левый указательный', from: 0, rank: 0, percent: 5 }]);
    expect(grow(form(win(100, 85)), form(win(100, 80)))).toEqual([]);
    expect(grow(form(win(100, 80)), form(win(100, 80)))).toEqual([]);
    expect(grow(form(win(100, 80)), form(win(1000, 804)))).toEqual([]); // +0,4 % округляется в 0 — не показываем
    expect(grow(emptyForm, form(win(100, 90)))).toEqual([]);
    expect(grow(form(win(rules.form.minPresses - 1, 40)), form(win(100, 99)))).toEqual([]);
    expect(grow(form(win(100, 80), 1), form(win(100, 84), 2)).map((g) => [g.percent, g.from, g.rank])).toEqual([[4, 1, 2]]);
    expect(grow(form(win(100, 90), 1), form(win(100, 85), 2)).map((g) => [g.percent, g.rank])).toEqual([[0, 2]]); // ранг вырос, окно просело — минус не показываем
    expect(grow(emptyForm, form([], 1)).map((g) => [g.percent, g.from, g.rank])).toEqual([[0, 0, 1]]);
  });

  it('на семени палец с точностью 95 % за 600 нажатий не получает «звезду»; ранг не раньше 50-го нажатия', () => {
    // Ловит: ранги «звезда» по малому окну или без подтверждения (замер критика: при 50 для всех — у 10 % пальцев).
    let stars = 0;
    let early = 0;
    const star = rules.form.ranks.length;
    for (let seed = 1; seed <= 300; seed += 1) {
      const rnd = createRandom(seed);
      let f = emptyForm;
      for (let step = 1; step <= 24; step += 1) { // итог раз в 25 нажатий, всего 600
        f = pushPresses(f, rules.squad, presses(idxKeys, 25, 0.95, rnd), 'attack', rules.form);
        f = settleForm(f, rules.squad, rules.form);
        if (step === 1 && (f.li?.maxRank ?? 0) > 0) early += 1; // 25 нажатий < 50
      }
      if ((f.li?.maxRank ?? 0) >= star) stars += 1;
    }
    expect(stars).toBe(0);
    expect(early).toBe(0);
  });

  it('на семени палец 99,5 % за 600 нажатий становится «звездой» (правило не закрывает путь наверх)', () => {
    // Ловит: недостижимые ранги из-за слишком жёсткого подтверждения.
    let reached = 0;
    for (let seed = 1; seed <= 50; seed += 1) {
      const rnd = createRandom(seed);
      let f = emptyForm;
      for (let step = 1; step <= 24; step += 1) {
        f = pushPresses(f, rules.squad, presses(idxKeys, 25, 0.998, rnd), 'attack', rules.form);
        f = settleForm(f, rules.squad, rules.form);
      }
      if ((f.li?.maxRank ?? 0) === rules.form.ranks.length) reached += 1;
    }
    expect(reached).toBeGreaterThan(30);
  });
});

describe('пенальти (К4)', () => {
  const tasks = parseTasks(tasksJson);

  it('только 2-й тайм, только после чистой атаки (0 ошибок), одно на тайм, не после последней атаки', () => {
    // Ловит: пенальти в 1-м тайме (v1), при ошибке в атаке, второе в тайме, пенальти после последней атаки.
    const w = { half: 2 as const, attack: 1, attacks: 4, errors: 0, taken: false };
    expect(kickDue(w)).toBe(true);
    expect(kickDue({ ...w, attack: 3 })).toBe(true);
    expect(kickDue({ ...w, half: 1 })).toBe(false);
    expect(kickDue({ ...w, attack: 4 })).toBe(false);
    expect(kickDue({ ...w, errors: 1 })).toBe(false);
    expect(kickDue({ ...w, taken: true })).toBe(false);
  });

  it('верно — гол и «Знаток» +1 за новую задачу; промах и «Не бить» — без гола; монет нет ни при каком ответе', () => {
    // Ловит: монеты за пенальти, «Знаток» за повторную задачу, гол за промах, второй ответ (двойной Enter).
    const kick = { taskId: 't1', result: null };
    const score = { ...emptyScore, typed: 1 };
    const scored = answerKick(kick, 'scored', score, []);
    expect(scored.score).toEqual({ typed: 1, kick: 1, conceded: 0 });
    expect(scored.expert).toBe(1);
    expect(answerKick(kick, 'scored', score, ['t1']).expert).toBe(0);
    for (const r of ['scored', 'missed', 'skipped'] as const) expect(answerKick(kick, r, score, []).coins).toBe(0);
    expect(answerKick(kick, 'missed', score, []).score).toBe(score);
    expect(answerKick(kick, 'skipped', score, []).expert).toBe(0);
    const again = answerKick(scored.kick, 'missed', scored.score, []);
    expect(again.kick).toBe(scored.kick);
    expect(again.score).toBe(scored.score);
  });

  it('задача удара — по зерну из проверенных быстрых; без таких задач пенальти не будет', () => {
    // Ловит: удар по непроверенной задаче, случайность вне зерна.
    const t = kickTask(tasks, 7, []);
    expect(t).not.toBeNull();
    expect(t?.verified).toBe(true);
    expect(kickTask(tasks, 7, [])?.id).toBe(t?.id);
    expect(kickTask([], 7, [])).toBeNull();
  });

  it('на семени (2 000 матчей, уроки 2, 16, 31 при A80) пенальти бывает в 15–55 % матчей', () => {
    // Ловит: пенальти почти в каждом матче (вариант «гол», 82–91 %) или почти никогда.
    for (const n of [2, 16, 31]) {
      const lesson = courseLessons.filter((l) => l.league === 'yard')[n - 1];
      expect(lesson).toBeDefined();
      if (!lesson) continue;
      const a = accuracyFor(lesson, 0.8);
      const rnd = createRandom(1000 + n);
      let kicks = 0;
      for (let m = 0; m < 2000; m += 1) {
        let taken = false;
        lesson.attacks.forEach((len, k) => {
          let errors = 0;
          for (let i = 0; i < len; i += 1) if (rnd() >= a) errors += 1;
          if (kickDue({ half: 2, attack: k + 1, attacks: lesson.attacks.length, errors, taken })) {
            taken = true;
            kicks += 1;
          }
        });
      }
      const share = kicks / 2000;
      expect(share, `урок ${n}`).toBeGreaterThan(0.15);
      expect(share, `урок ${n}`).toBeLessThan(0.55);
    }
  });
});

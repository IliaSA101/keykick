/**
 * Матч v2 (спека 017, Т1): счёт, итог и звёзды, переигровка, копии урока, разбор `match.json`.
 * Уроки грузятся так же, как в `course.test.ts` — настоящие файлы Двора.
 */
import { describe, expect, it } from 'vitest';
import matchJson from '../src/content/match.json';
import { courseLessons } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { winChance } from '../src/engine/course/odds';
import { coachLesson, soften, withHelp } from '../src/engine/match/lessonCopy';
import { parseMatchRules } from '../src/engine/match/rules';
import {
  addKick,
  addOutcome,
  attackOutcome,
  emptyScore,
  isDecisive,
  matchResult,
  reserveView,
  saveExists,
  type MatchScore,
} from '../src/engine/match/score';
import { bestAfter, matchAccuracy, nextFails, shortfall, starCap, stuckOffer, verdict, type VerdictInput } from '../src/engine/match/verdict';

const rules = parseMatchRules(matchJson, keymap);
const yard = courseLessons.filter((x) => x.league === 'yard');
const sc = (typed: number, kick: number, conceded: number): MatchScore => ({ typed, kick, conceded });
const input = (score: MatchScore, over: Partial<VerdictInput> = {}): VerdictInput => ({
  score,
  friendly: false,
  accuracy: 0.9,
  help: 'none',
  softened: false,
  kind: 'lesson',
  best: 0,
  ...over,
});

describe('исход атаки и мячи запаса (К1)', () => {
  it('границы g и c: e = g — ещё гол, e = c — гол соперника, между — сейв', () => {
    // Ловит: сдвиг границы на единицу (< вместо ≤), потерянный гол при e = g, сейв вместо гола соперника при e = c.
    for (const [g, c] of [[1, 5], [1, 4], [2, 6]] as const) {
      expect(attackOutcome(0, g, c)).toBe('goal');
      expect(attackOutcome(g, g, c)).toBe('goal');
      expect(attackOutcome(g + 1, g, c)).toBe('save');
      expect(attackOutcome(c - 1, g, c)).toBe('save');
      expect(attackOutcome(c, g, c)).toBe('conceded');
      expect(attackOutcome(c + 3, g, c)).toBe('conceded');
    }
  });

  it('мячей c − 1, ошибка гасит мяч, цветные (первые g) гаснут первыми', () => {
    // Ловит: мячей g или c вместо c − 1 (017-Р13); цветной мяч «гол», горящий после того, как гол уже потерян.
    const g = 1;
    const c = 5;
    expect(reserveView(0, g, c)).toMatchObject({ total: 4, left: 4, goalLit: 1 });
    expect(reserveView(1, g, c)).toMatchObject({ total: 4, left: 3, goalLit: 0 });
    expect(reserveView(3, g, c)).toMatchObject({ left: 1, goalLit: 0 });
    expect(reserveView(4, g, c)).toMatchObject({ left: 0, goalLit: 0 });
    expect(reserveView(1, 2, 5)).toMatchObject({ left: 3, goalLit: 1 });
    expect(reserveView(3, 2, 5)).toMatchObject({ left: 1, goalLit: 0 });
    expect(reserveView(9, g, c).left).toBe(0);
  });

  it('цветных мячей — готовое поле: g, пока гол жив, дальше столько же, сколько сгорело; не больше мячей', () => {
    // Ловит: арифметику «из горящих» в экране (она ошибалась при e > g) и выход за число мячей.
    expect(reserveView(0, 1, 5).goalBalls).toBe(1);
    expect(reserveView(1, 1, 5).goalBalls).toBe(1);
    expect(reserveView(3, 1, 5).goalBalls).toBe(3);
    expect(reserveView(9, 1, 5).goalBalls).toBe(4);
    expect(reserveView(0, 0, 3).goalBalls).toBe(0);
    for (const e of [0, 1, 2, 3]) {
      const r = reserveView(e, 2, 5);
      expect(r.goalBalls - (r.total - r.left)).toBe(r.goalLit); // стыкуется с горящими цветными
    }
  });

  it('правило вступления: сейв бывает, если между g и c есть число ошибок', () => {
    // Ловит: «сейв при ошибках 2…1» (c − g = 1) и пропажу строки про сейв при c − g > 1.
    expect(saveExists(1, 3)).toBe(true);
    expect(saveExists(1, 2)).toBe(false);
    expect(saveExists(0, 2)).toBe(true);
    expect(saveExists(0, 1)).toBe(false);
  });

  it('подпись: «можно ошибиться ещё N» при e < g, «дальше без ошибок» при e = g, пусто при e > g', () => {
    // Ловит: пропавшую подпись на границе e = g (мяч ещё гол) или подпись «ещё N» после границы.
    expect(reserveView(0, 2, 6).hint).toEqual({ kind: 'more', n: 2 });
    expect(reserveView(1, 2, 6).hint).toEqual({ kind: 'more', n: 1 });
    expect(reserveView(2, 2, 6).hint).toEqual({ kind: 'last' });
    expect(reserveView(3, 2, 6).hint).toEqual({ kind: 'none' });
    expect(reserveView(0, 0, 4).hint).toEqual({ kind: 'last' });
  });

  it('счёт: гол, сейв, гол соперника, пенальти — отдельным полем', () => {
    // Ловит: сейв, засчитанный голом; пенальти, смешанный с голами печатью (звезда только печатью).
    let s = emptyScore;
    s = addOutcome(s, 'goal');
    s = addOutcome(s, 'save');
    s = addOutcome(s, 'conceded');
    s = addKick(s, true);
    s = addKick(s, false);
    expect(s).toEqual(sc(1, 1, 1));
    expect(emptyScore).toEqual(sc(0, 0, 0));
  });
});

describe('победа, ничья, решающая (К2)', () => {
  it('победа — голов больше с пенальти, ничья — доп. время', () => {
    // Ловит: ничью, засчитанную победой; пенальти, не идущее в итог.
    expect(matchResult(sc(2, 0, 1))).toBe('win');
    expect(matchResult(sc(1, 1, 1))).toBe('win');
    expect(matchResult(sc(1, 0, 1))).toBe('draw');
    expect(matchResult(sc(0, 0, 2))).toBe('loss');
  });

  it('товарищеский пройден при поражении, звёзд 0, подпись «можно лучше»; обычный — нет', () => {
    // Ловит: товарищеский, который можно провалить, и обычный урок, пройденный поражением.
    const lost = sc(0, 0, 2);
    expect(verdict(input(lost, { friendly: true }), rules)).toMatchObject({ passed: true, stars: 0, couldBeBetter: true });
    expect(verdict(input(lost), rules)).toMatchObject({ passed: false, stars: 0, couldBeBetter: false });
    expect(verdict(input(sc(2, 0, 1), { friendly: true }), rules).couldBeBetter).toBe(false);
  });

  it('решающая: последняя атака 2-го тайма при разнице −1…+1, и доп. время; −1 — с пенальти и без', () => {
    // Ловит: решающую при −2 или +2, решающую в 1-м тайме или не на последней атаке, пенальти, не учтённое в разнице.
    const last = { half: 2 as const, attack: 4, attacks: 4 };
    expect(isDecisive(last, sc(1, 0, 2))).toBe(true); // −1 без пенальти
    expect(isDecisive(last, sc(1, 1, 3))).toBe(true); // −1 с пенальти: 2:3
    expect(isDecisive(last, sc(0, 1, 2))).toBe(true);
    expect(isDecisive(last, sc(1, 0, 1))).toBe(true); // 0
    expect(isDecisive(last, sc(2, 0, 1))).toBe(true); // +1
    expect(isDecisive(last, sc(0, 0, 2))).toBe(false); // −2
    expect(isDecisive(last, sc(3, 0, 1))).toBe(false); // +2
    expect(isDecisive(last, sc(1, 1, 0))).toBe(false); // +2 с пенальти
    expect(isDecisive({ half: 2, attack: 3, attacks: 4 }, sc(1, 0, 1))).toBe(false);
    expect(isDecisive({ half: 1, attack: 4, attacks: 4 }, sc(1, 0, 1))).toBe(false);
    expect(isDecisive({ half: 'extra', attack: 1, attacks: 1 }, sc(1, 0, 1))).toBe(true);
  });
});

describe('звёзды и итог (К3)', () => {
  it('пример ТЗ-2.6 дословно: 1:1 печатью + пенальти = 2:1 — пройден, звёзд 0; 3:1 + пенальти = 4:1 — звезда есть', () => {
    // Ловит: звезду за победу на пенальти (В-1), потерю звезды при голе с пенальти поверх победы печатью.
    expect(verdict(input(sc(1, 1, 1)), rules)).toMatchObject({ passed: true, typedWin: false, stars: 0, newStars: 0 });
    expect(verdict(input(sc(3, 1, 1)), rules)).toMatchObject({ passed: true, typedWin: true, stars: 1, newStars: 1 });
  });

  it('★ — победа, ★★ — всухую, ★★★ — всухую и ≥ 97 % (граница включена)', () => {
    // Ловит: сдвиг порога 0,97 (> вместо ≥), ★★ без «всухую», ★★★ при пропущенном голе.
    expect(verdict(input(sc(2, 0, 1), { accuracy: 1 }), rules).stars).toBe(1);
    expect(verdict(input(sc(2, 0, 0), { accuracy: 0.96 }), rules).stars).toBe(2);
    expect(verdict(input(sc(2, 0, 0), { accuracy: rules.threeStar }), rules).stars).toBe(3);
    expect(verdict(input(sc(2, 0, 0), { accuracy: 1 }), rules).stars).toBe(3);
    expect(verdict(input(sc(0, 1, 0), { accuracy: 1 }), rules).stars).toBe(0); // 1:0 только пенальти
  });

  it('сверх лучшего: новые звёзды = звёзды − лучшее, не меньше 0; кубок звёзд не даёт', () => {
    // Ловит: повторная оплата уже взятых звёзд, отрицательный прирост, звёзды за матч кубка.
    const win3 = sc(2, 0, 0);
    expect(verdict(input(win3, { accuracy: 1, best: 0 }), rules).newStars).toBe(3);
    expect(verdict(input(win3, { accuracy: 1, best: 2 }), rules).newStars).toBe(1);
    expect(verdict(input(win3, { accuracy: 1, best: 3 }), rules).newStars).toBe(0);
    expect(verdict(input(sc(2, 0, 1), { best: 3 }), rules).newStars).toBe(0);
    expect(verdict(input(win3, { accuracy: 1, kind: 'cup' }), rules)).toMatchObject({ stars: 3, newStars: 0 });
  });

  it('звёзды не тратятся: лучшее по уроку только растёт', () => {
    // Ловит: перезапись лучшего худшим результатом (ТЗ-4.2).
    expect(bestAfter(3, 1)).toBe(3);
    expect(bestAfter(1, 2)).toBe(2);
    expect(bestAfter(0, 0)).toBe(0);
  });

  it('точность по обоим таймам: 1-й 90 %, 2-й 100 % — не ★★★', () => {
    // Ловит: ★★★ и рекорд по одному тайму в переигровке 2-го тайма (критик В3).
    const acc = matchAccuracy([{ correct: 90, errors: 10 }, { correct: 100, errors: 0 }]);
    expect(acc).toBeCloseTo(0.95, 10);
    expect(verdict(input(sc(2, 0, 0), { accuracy: acc }), rules).stars).toBe(2);
    expect(matchAccuracy([])).toBe(0);
  });

  it('«чего не хватило»: голы до победы или «держалась на пенальти»', () => {
    // Ловит: подсказку в голах там, где победу сорвала только печать, и ошибку счёта на единицу.
    expect(shortfall(sc(0, 0, 2))).toEqual({ goals: 3 });
    expect(shortfall(sc(1, 0, 1))).toEqual({ goals: 1 });
    expect(shortfall(sc(1, 1, 1))).toEqual({ typedOnly: true });
    expect(shortfall(sc(2, 0, 1))).toEqual({ goals: 0 });
    expect(shortfall(sc(1, 1, 3))).toEqual({ goals: 2 }); // пенальти входят в счёт «сколько не хватило»
  });
});

describe('переигровка, «Застрял», потолки (К5)', () => {
  it('fails: сброс при проходе, иначе +1', () => {
    // Ловит: fails, растущий при проходе или не сбрасываемый.
    expect(nextFails(0, false)).toBe(1);
    expect(nextFails(4, false)).toBe(5);
    expect(nextFails(4, true)).toBe(0);
  });

  it('предложения по fails 1 / 2 / 3–4 / ≥ 5; первая кнопка — выделенная (Р12)', () => {
    // Ловит: Enter по привычке на «Ещё раз» вместо «С запасом»; тренера не на своём провале; «хватит» не там.
    expect(stuckOffer(1, true, rules)).toEqual({ coachMinute: false, options: ['replay2'] });
    expect(stuckOffer(1, false, rules)).toEqual({ coachMinute: false, options: ['replay'] });
    expect(stuckOffer(2, true, rules)).toEqual({ coachMinute: true, options: ['replay2'] });
    expect(stuckOffer(2, false, rules)).toEqual({ coachMinute: true, options: ['replay'] });
    expect(stuckOffer(3, true, rules)).toEqual({ coachMinute: false, options: ['reserve', 'again', 'quit'] });
    expect(stuckOffer(4, true, rules).options[0]).toBe('reserve');
    expect(stuckOffer(5, true, rules)).toEqual({ coachMinute: false, options: ['coach', 'reserve', 'quit'] });
    expect(stuckOffer(9, false, rules).options[0]).toBe('coach');
  });

  it('потолки звёзд: «с запасом» ≤ ★★, «с тренером» ≤ ★, смягчение ≤ ★★; вместе — меньший', () => {
    // Ловит: ★★★ на уроке с запасом или тренером, потерянный потолок смягчения (Р16).
    const flawless = input(sc(2, 0, 0), { accuracy: 1 });
    expect(verdict(flawless, rules).stars).toBe(3);
    expect(verdict({ ...flawless, help: 'reserve' }, rules).stars).toBe(2);
    expect(verdict({ ...flawless, help: 'coach' }, rules).stars).toBe(1);
    expect(verdict({ ...flawless, softened: true }, rules).stars).toBe(2);
    expect(verdict({ ...flawless, help: 'coach', softened: true }, rules).stars).toBe(1);
    expect(starCap('none', false, rules)).toBe(3);
  });

  it('помощь: «с запасом» — c + 1; «с тренером» — g + 1 и c + 1; атаки и лесенка те же', () => {
    // Ловит: помощь, меняющую длины атак (генератор их читает), и g, выросшее у «с запасом».
    const l = yard[1]!;
    expect(withHelp(l, 'none')).toBe(l);
    expect(withHelp(l, 'reserve')).toEqual({ ...l, c: l.c + 1 });
    expect(withHelp(l, 'coach')).toEqual({ ...l, g: l.g + 1, c: l.c + 1 });
  });

  it('смягчение: буквы, фокус, материал N+1; длины, строки, пороги N (не ниже N+1)', () => {
    // Ловит: смягчение, взявшее от N буквы, или оставившее длины N+1 (ничего не меняет — 25 пар из 25).
    const n = yard[4]!;
    const next = yard[5]!;
    const s = soften(next, n);
    expect(s).toMatchObject({ id: next.id, keys: next.keys, focus: next.focus, material: next.material, name: next.name });
    expect(s.attacks).toEqual(n.attacks);
    expect(s.rows).toBe(n.rows);
    expect(s.g).toBe(Math.max(n.g, next.g));
    expect(s.c).toBe(Math.max(n.c, next.c));
    expect(s.ladder).toHaveLength(s.attacks.length);
    expect(next.attacks).not.toBe(s.attacks);
  });

  it('свойство К по Р8 на всех парах «N → N+1» (31 пара), a = 0,90 и 0,95', () => {
    // Ловит: смягчение, которое делает матч труднее урока N+1 или не легче там, где длины N+1 больше.
    expect(yard.length).toBe(32);
    let strict = 0;
    for (const a of [0.9, 0.95]) {
      for (let i = 0; i + 1 < yard.length; i++) {
        const n = yard[i]!;
        const next = yard[i + 1]!;
        const s = soften(next, n);
        const label = `${n.id} → ${next.id} @${a}`;
        expect(winChance(s, a), label).toBeGreaterThanOrEqual(winChance(next, a) - 1e-12);
        expect(winChance(s, a), label).toBeGreaterThanOrEqual(winChance(n, a) - 1e-12);
        const longer = next.attacks.some((len, k) => len > (n.attacks[k] ?? len));
        if (longer) {
          expect(winChance(s, a), label).toBeGreaterThan(winChance(next, a));
          strict++;
        }
      }
    }
    expect(strict).toBeGreaterThan(0);
  });
});

describe('копия тренера (К18, 016-Р10)', () => {
  it('поля контракта: пары, лесенка из одной ступени, одна строка rowWidth, фокус — клавиши, без coach.len', () => {
    // Ловит: копию, наследующую лесенку из 4 ступеней при одной атаке (разбор 016 её не принимает), и поле coach.len.
    for (const l of yard) {
      const c = coachLesson(l, 'ап');
      expect(c).toMatchObject({ focus: 'ап', focusWeak: 0, material: 'pairs', ladder: ['pairs'], noWords: true, rows: 1 });
      expect(c.attacks).toEqual([l.rowWidth]);
      expect(c.attacks.length).toBe(c.ladder.length);
      expect(c.keys).toBe(l.keys);
      expect(c.g).toBe(l.g);
      expect(Object.keys(c)).not.toContain('len');
    }
    expect('len' in rules.coach).toBe(false);
  });
});

describe('match.json и разбор (К12)', () => {
  type Obj = Record<string, unknown>;
  const clone = (): Obj => JSON.parse(JSON.stringify(matchJson)) as Obj;
  const bad = (edit: (o: Obj) => void, expected: string) => {
    const o = clone();
    edit(o);
    expect(() => parseMatchRules(o, keymap)).toThrow(expected);
  };

  it('настоящий файл разбирается; числа из него: 20 монет, ★★★ с 0,97, 5 дней, 8 игроков', () => {
    // Ловит: правку файла в обход разбора и расхождение с design §9.
    expect(rules).toMatchObject({ coinPer: 20, threeStar: 0.97, comebackDays: 5, speedMatches: 3 });
    expect(rules.help).toEqual({ coachAt: 2, reserveAt: 3, coachHelpAt: 5, reserveCap: 2, coachCap: 1, softenCap: 2 });
    expect(rules.coach).toEqual({ keys: 2, ms: 60000 });
    expect(rules.squad).toHaveLength(8);
    expect(rules.squad.map((p) => p.finger)).not.toContain('th');
  });

  it('ошибки — с адресом поля', () => {
    // Ловит: молчаливое принятие кривого файла или ошибку без адреса.
    bad((o) => (o.coinPer = 0), 'match.coinPer');
    bad((o) => (o.coinPer = 1.5), 'match.coinPer');
    bad((o) => (o.threeStar = 1.2), 'match.threeStar');
    bad((o) => ((o.help as Obj).coachAt = 3), 'match.help');
    bad((o) => ((o.help as Obj).coachCap = 4), 'match.help.coachCap');
    bad((o) => ((o.form as Obj).ranks = [0.9, 0.9]), 'match.form.ranks[1]');
    bad((o) => ((o.form as Obj).fullWindowFrom = 4), 'match.form.fullWindowFrom');
    bad((o) => ((o.form as Obj).minPresses = 301), 'match.form.minPresses');
    bad((o) => ((o.coach as Obj).len = 29), 'match.coach: unknown field len');
    bad((o) => (o.coinPeer = 1), 'match: unknown field coinPeer');
    bad((o) => ((o.help as Obj).coachAtt = 1), 'match.help: unknown field coachAtt');
  });

  it('состав: 8 пальцев без большого, клавиши у своего пальца и вместе дают основной ряд', () => {
    // Ловит: потерянную клавишу ряда, клавишу чужого пальца, большой палец или повтор пальца.
    const squad = (o: Obj) => o.squad as Obj[];
    bad((o) => squad(o).pop(), 'match.squad: expected 8 players');
    bad((o) => (squad(o)[0]!.finger = 'th'), 'match.squad[0].finger');
    bad((o) => (squad(o)[1]!.finger = 'lp'), 'duplicate lp');
    bad((o) => (squad(o)[0]!.keys = 'ц'), 'match.squad[0].keys');
    bad((o) => (squad(o)[3]!.keys = 'а'), 'match.squad');
  });
});

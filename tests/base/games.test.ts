/** К5 (067 Т6): правила Чеканки, Мемори формы, Вратаря (036-Р6, Р14, Р15; 067 design §8). Часы и семя — снаружи. */
import { describe, expect, it } from 'vitest';
import cfg from '../../src/content/base.json';
import { fallMs, scoreKeepy, startKeepy, stepKeepy } from '../../src/engine/base/games/keepy';
import { scoreKeeper, sectors, startKeeper, stepKeeper, type KeeperState } from '../../src/engine/base/games/keeper';
import { finishFun } from '../../src/engine/base/finish';
import { scoreFree, startFree, stepFree, timeFree, wordLeft, wordsFor, type FreeState } from '../../src/engine/base/games/free';
import { TACTIC_IDS, atGoal, beginMini, foeEvery, forward, holdLimit, openTactics, scoreMini, shooter, shotChance, startMini, stealsToGoal, stepMini, type MiniState } from '../../src/engine/base/games/mini';
import { createRandom, randomInt } from '../../src/engine/random';
import dict from '../../src/content/dictionary.json';
import { baseDef, type Base } from '../../src/engine/base/section';
import { firstSeed, rollSeed, seriesPips, takeSeed } from '../../src/app/base/play';
import { ru } from '../../src/i18n/ru';
import { finishFree, freeBoards, freeChar, freeEndNote, freeFlight, freeKeyList, freeResults, freeScoreText, freeWordBar, freeWordSeconds } from '../../src/app/base/free';
import { scoreMemo, startMemo, stepMemo, type MemoState } from '../../src/engine/base/games/memo';

const key = (k: string) => ({ kind: 'key' as const, key: k });
const tick = { kind: 'tick' as const };

describe('К5 · Чеканка', () => {
  const s0 = startKeepy({ keys: ['а', 'о'] }, 7);

  it('Ловит: верная буква в зоне удара — +1, мяч берёт следующую букву только из выученных', () => {
    const t = fallMs(0) - 100;
    const s = stepKeepy(s0, key(s0.letter as string), t);
    expect(scoreKeepy(s)).toBe(1);
    expect(['а', 'о']).toContain(s.letter);
    expect(s.since).toBe(t);
  });

  it('Ловит: слишком ранняя верная клавиша игнорируется без штрафа', () => {
    const s = stepKeepy(s0, key(s0.letter as string), 10);
    expect(s).toBe(s0);
  });

  it('Ловит: два промаха игру не кончают, третий кончает (036-Р6, «Промахи можно ещё 2»); после конца ввод не меняет', () => {
    expect(cfg.keepy.lives).toBe(3);
    const wrong = (s: typeof s0) => (s.letter === 'а' ? 'о' : 'а');
    let a = stepKeepy(s0, key(wrong(s0)), 500);
    expect(a.over).toBe(false);
    a = stepKeepy(a, key(wrong(a)), 600);
    expect(a.over).toBe(false);
    expect(a.misses).toBe(2);
    a = stepKeepy(a, key(wrong(a)), 700);
    expect(a.over).toBe(true);
    expect(a.misses).toBe(cfg.keepy.lives);
    let b = s0;
    for (let i = 0; i < 3; i++) b = stepKeepy(b, tick, b.since + fallMs(0) + 1);
    expect(b.over).toBe(true);
    expect(stepKeepy(b, key('а'), 9999)).toBe(b);
    expect(stepKeepy(s0, tick, 100)).toBe(s0);
  });

  it('Ловит: верная клавиша после того, как мяч упал (тика не было), — промах, не касание (К5)', () => {
    const s = stepKeepy(s0, key(s0.letter as string), fallMs(0) + 50);
    expect(scoreKeepy(s)).toBe(0);
    expect(s.misses).toBe(1);
  });

  it('Ловит: мяч ускоряется, но не быстрее предела; без выученных клавиш игра сразу кончена; то же семя — то же поле', () => {
    expect(fallMs(10)).toBeLessThan(fallMs(0));
    expect(fallMs(10_000)).toBe(cfg.keepy.minFallMs);
    expect(startKeepy({ keys: [] }, 1).over).toBe(true);
    expect(startKeepy({ keys: ['а', 'о', 'л'] }, 5)).toEqual(startKeepy({ keys: ['а', 'о', 'л'] }, 5));
  });
});

describe('К5 · Мемори формы', () => {
  const kits = ['club', 'k1', 'k2', 'k3'];
  const keys = ['а', 'о', 'л', 'д', 'ж', 'ф', 'ы', 'в'];

  it('Ловит: карт 2 × min(8, форм) (036-Р14); у каждой своя клавиша; пар по форме ровно две', () => {
    const s = startMemo({ keys, kits }, 3);
    expect(s.cards).toHaveLength(8);
    expect(new Set(s.cards.map((c) => c.key)).size).toBe(8);
    for (const k of kits) expect(s.cards.filter((c) => c.kit === k)).toHaveLength(2);
    const many = startMemo({ keys, kits: Array.from({ length: 12 }, (_, i) => `k${i}`) }, 3);
    expect(many.cards).toHaveLength(16);
  });

  it('Ловит: клавиши карт — выученные буквы, цифры только когда букв не хватило', () => {
    const s = startMemo({ keys: ['а', 'о'], kits }, 3);
    const letters = s.cards.filter((c) => ['а', 'о'].includes(c.key));
    expect(letters).toHaveLength(2);
    expect(s.cards.filter((c) => /\d/.test(c.key))).toHaveLength(6);
    expect(s.cards.map((c) => c.key).filter((k) => /\d/.test(k))).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(startMemo({ keys, kits }, 3).cards.every((c) => keys.includes(c.key))).toBe(true);
  });

  const pairOf = (s: MemoState, same: boolean): [string, string] => {
    const a = s.cards[0];
    const b = s.cards.find((c, i) => i > 0 && (c.kit === a?.kit) === same);
    return [a?.key as string, b?.key as string];
  };

  it('Ловит: пара — ход; одинаковые остаются, разные закрываются по времени или со следующим нажатием', () => {
    let s = startMemo({ keys, kits }, 3);
    const [a, b] = pairOf(s, false);
    s = stepMemo(stepMemo(s, key(a), 0), key(b), 100);
    expect(scoreMemo(s)).toBe(1);
    expect(s.up).toHaveLength(2);
    expect(stepMemo(s, tick, 100 + cfg.memo.hideMs - 1).up).toHaveLength(2);
    expect(stepMemo(s, tick, 100 + cfg.memo.hideMs).up).toHaveLength(0);
    const [c, d] = pairOf(s, true);
    const t = stepMemo(stepMemo(stepMemo(s, tick, 5000), key(c), 5000), key(d), 5100);
    expect(t.cards.filter((x) => x.face === 'done')).toHaveLength(2);
    expect(scoreMemo(t)).toBe(2);
    const fresh = s.cards.find((x) => x.face === 'down')?.key as string;
    expect(stepMemo(s, key(fresh), 200).up).toHaveLength(1);
  });

  it('Ловит: повторное нажатие на открытую карту и чужая клавиша — не ход; все пары — игра окончена', () => {
    let s = startMemo({ keys, kits }, 3);
    const first = s.cards[0]?.key as string;
    s = stepMemo(s, key(first), 0);
    expect(stepMemo(s, key(first), 1)).toBe(s);
    expect(stepMemo(s, key('я'), 1)).toBe(s);
    let g = startMemo({ keys, kits }, 4);
    for (const k of kits) {
      const ks = g.cards.filter((c) => c.kit === k).map((c) => c.key);
      g = stepMemo(stepMemo(g, key(ks[0] as string), 0), key(ks[1] as string), 1);
    }
    expect(g.done).toBe(true);
    expect(scoreMemo(g)).toBe(4);
    expect(stepMemo(g, key('а'), 2)).toBe(g);
  });
});

describe('К5 · Вратарь ФЫВА ОЛДЖ', () => {
  const row = ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'];

  it('Ловит: невыученная клавиша — сектор закрыт, мяч туда не летит (036-Р15)', () => {
    expect(sectors(['ф', 'ы', 'я']).filter((x) => x.open).map((x) => x.key)).toEqual(['ф', 'ы']);
    for (let seed = 0; seed < 30; seed++) {
      let s = startKeeper({ keys: ['а', 'о', 'я'] }, seed);
      for (let i = 0; i < cfg.keeper.shots; i++) {
        expect(['а', 'о']).toContain(s.cur);
        s = stepKeeper(s, tick, s.since + cfg.keeper.windowMs + 1);
      }
      expect(s.over).toBe(true);
    }
  });

  it('Ловит: сейв за окно времени; пропуск и неверная клавиша — без штрафа; серия — 20 ударов', () => {
    let s: KeeperState = startKeeper({ keys: row }, 2);
    s = stepKeeper(s, key(s.cur as string), 500);
    expect(scoreKeeper(s)).toBe(1);
    const wrong = row.find((k) => k !== s.cur) as string;
    expect(stepKeeper(s, key(wrong), 600)).toBe(s);
    const passed = stepKeeper(s, tick, s.since + cfg.keeper.windowMs + 1);
    expect(scoreKeeper(passed)).toBe(1);
    expect(passed.shot).toBe(s.shot + 1);
    let t = startKeeper({ keys: row }, 2);
    let now = 0;
    for (let i = 0; i < cfg.keeper.shots; i++) {
      now += 100;
      t = stepKeeper(t, key(t.cur as string), now);
    }
    expect(t.over).toBe(true);
    expect(scoreKeeper(t)).toBe(cfg.keeper.shots);
    expect(stepKeeper(t, key('а'), now + 1)).toBe(t);
  });

  it('Ловит: поздняя верная клавиша — пропуск; без клавиш ряда серия окончена сразу', () => {
    const s = startKeeper({ keys: row }, 2);
    const late = stepKeeper(s, key(s.cur as string), cfg.keeper.windowMs + 1);
    expect(scoreKeeper(late)).toBe(0);
    expect(late.shot).toBe(2);
    expect(startKeeper({ keys: ['я'] }, 1).over).toBe(true);
  });
});

describe('К5 · Мини-футбол', () => {
  const keys = ['а', 'о', 'в', 'л', 'ы', 'д'];
  const ctx = (cur: number, streak = 0, rank = 0, tactic: string | null = null) => ({ keys, cur, streak, tactic, ranks: Object.fromEntries(keys.map((k) => [k, rank])) });
  /** Верная клавиша 2×2: у ворот — удар, иначе пас партнёру. */
  const right = (s: MiniState): string => [s.team[1 - s.holder] as string, ' '][Number(atGoal(s))] as string;

  it('Ловит: размер команды по вехам урока — 6 → 2, 7 → 3, 10 → 3, 11 → 4; буквы только выученные', () => {
    expect(startMini(ctx(3), 1).team).toHaveLength(2);
    expect(startMini(ctx(6), 1).team).toHaveLength(2);
    expect(startMini(ctx(7), 1).team).toHaveLength(3);
    expect(startMini(ctx(10), 1).team).toHaveLength(3);
    expect(startMini(ctx(11), 1).team).toHaveLength(4);
    for (const k of startMini(ctx(11), 5).team) expect(keys).toContain(k);
    expect(startMini({ keys: ['а'], cur: 11 }, 1).over).toBe(true);
  });

  it('Ловит: буква партнёра — пас; неверная клавиша (своя, чужая, Пробел до ворот) — отбор', () => {
    const s = startMini(ctx(4), 3);
    const p = stepMini(s, key(s.team[1] as string), 100);
    expect(p.holder).toBe(1);
    expect(p.passes).toBe(1);
    for (const bad of [s.team[0] as string, 'я', ' ']) {
      const r = stepMini(s, key(bad), 100);
      expect(r.steals).toBe(1);
      expect(r.passes).toBe(0);
    }
  });

  it('Ловит: у ворот — нападающий (последний в составе) после пасов; номер бьющего отдаёт движок', () => {
    const s = startMini(ctx(7), 3);
    expect(shooter(s)).toBeNull();
    const fwd = s.team.length - 1;
    const direct = stepMini(s, key(s.team[fwd] as string), 100);
    expect(direct.holder).toBe(fwd);
    expect(shooter(direct)).toBe(fwd);
    const mid = stepMini(s, key(s.team[1] as string), 100);
    expect(shooter(mid)).toBeNull();
    expect(atGoal(mid)).toBe(false);
    expect(atGoal(direct)).toBe(true);
  });

  it('Ловит: после отбора мяч у другого игрока, розыгрыш сначала', () => {
    let s = startMini(ctx(7), 3);
    s = stepMini(s, key(s.team[1] as string), 100);
    const lost = stepMini(s, key('я'), 200);
    expect(lost.holder).not.toBe(s.holder);
    expect(lost.holder).toBe((s.holder + 1) % 3);
    expect(lost.passes).toBe(0);
    expect(lost.since).toBe(200);
  });

  it('Ловит: удар нападающим — гол или сейв по надёжности; победа продолжает серию, ничья и поражение обнуляют', () => {
    let s = startMini(ctx(4, 2, 4), 3);
    let t = 100;
    while (s.us === 0 && t < 60000) {
      s = stepMini(s, key(right(s)), (t += 100));
    }
    expect(s.us).toBe(1);
    expect(s.passes).toBe(0);
    const end = stepMini(s, tick, cfg.mini.matchMs);
    expect(end.over).toBe(true);
    expect(scoreMini({ ...end, them: 0 })).toBe(3);
    expect(scoreMini({ ...end, us: 1, them: 1 })).toBe(0);
    expect(scoreMini({ ...end, us: 0, them: 1 })).toBe(0);
    expect(stepMini(end, key(' '), cfg.mini.matchMs + 1)).toBe(end);
  });

  it('Ловит: мяч держат дольше срока — отбор; атака соперника по своим часам идёт и без бездействия; каждый stealsPerGoal-й отбор — гол', () => {
    let s = startMini(ctx(4), 3);
    s = stepMini(s, tick, cfg.mini.holdMs + 1);
    expect(s.steals).toBe(1);
    expect(s.them).toBe(0);
    let busy = startMini(ctx(4), 3);
    for (let t = 1000; t < cfg.mini.foeMs; t += 1000) busy = stepMini(busy, key(right(busy)), t);
    busy = stepMini(busy, tick, cfg.mini.foeMs + 500);
    expect(busy.steals).toBe(1);
    let g = startMini(ctx(4), 3);
    for (let i = 1; i <= cfg.mini.stealsPerGoal; i++) g = stepMini(g, key('я'), i * 10);
    expect(g.them).toBe(1);
  });

  it('Ловит: сила от ранга — при тех же нажатиях высокий ранг даёт не меньше голов, чем низкий, и держит мяч дольше', () => {
    const run = (rank: number): MiniState => {
      let s = startMini(ctx(4, 0, rank), 11);
      for (let t = 1000; t < cfg.mini.matchMs; t += 1500) s = stepMini(s, key(right(s)), t);
      return stepMini(s, tick, cfg.mini.matchMs);
    };
    const low = run(0);
    const high = run(4);
    expect(high.us).toBeGreaterThanOrEqual(low.us);
    expect(high.them).toBeLessThanOrEqual(low.them);
    expect(holdLimit(high, 0)).toBeGreaterThan(holdLimit(low, 0));
    expect(shotChance(high)).toBeGreaterThan(shotChance(low));
  });

  /** Ребёнок: клавиша раз в `pace` мс; ошибка с вероятностью `err` — мимо; `mash` — любая клавиша подряд. */
  const play = (seed: number, pace: number, err: number, mash = false, tactic: string | null = null): MiniState => {
    const rnd = createRandom(seed * 7 + 1);
    let s = startMini(ctx(4, 0, 1, tactic), seed);
    for (let t = pace; !s.over; t += pace) {
      const any = [...keys, ' '][randomInt(rnd, keys.length + 1)] as string;
      const pressed = [right(s), 'я', any][Math.min(2, Number(rnd() < err) + 2 * Number(mash))] as string;
      s = stepMini(s, key(pressed), t);
    }
    return s;
  };
  const seeds = Array.from({ length: 30 }, (_, i) => i + 1);

  it('Ловит: средний ребёнок (клавиша в 1,5 с, 5 % ошибок) выигрывает с разницей 1–2; колотящий по клавишам проигрывает (067-Р52)', () => {
    const diffs = seeds.map((x) => { const s = play(x, 1500, 0.05); return s.us - s.them; });
    const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    expect(mean).toBeGreaterThanOrEqual(1);
    expect(mean).toBeLessThanOrEqual(2);
    expect(diffs.filter((d) => d > 0).length).toBeGreaterThanOrEqual(16);
    const mash = seeds.map((x) => play(x, 300, 0, true));
    expect(mash.filter((m) => m.us > m.them)).toHaveLength(0);
  });

  it('К21 тактики: каждая меняет одно своё — Фланг удар, Прессинг гол соперника, Короткий пас часы соперника, Контратака розыгрыш после отбора; остальное прежнее', () => {
    const base = startMini(ctx(4), 3);
    const t = (id: string) => startMini(ctx(4, 0, 0, id), 3);
    const T = cfg.mini.tactics;
    expect(shotChance(t('wing'))).toBeCloseTo(shotChance(base) + T.wing.shotBonus);
    expect([stealsToGoal(t('wing')), foeEvery(t('wing')), holdLimit(t('wing'), 0)]).toEqual([stealsToGoal(base), foeEvery(base), holdLimit(base, 0)]);
    let p = t('press');
    for (let i = 1; i < T.press.stealsPerGoal; i++) p = stepMini(p, key('я'), i * 10);
    expect(p.them).toBe(0);
    expect(stepMini(p, key('я'), 100).them).toBe(1);
    expect(shotChance(t('press'))).toBe(shotChance(base));
    expect(foeEvery(t('short'))).toBe(cfg.mini.foeMs + T.short.foeBonusMs);
    expect(t('short').foeAt).toBe(foeEvery(t('short')));
    const busy = (id: string | null): number => {
      let s = startMini(ctx(4, 0, 0, id), 3);
      for (let at = 1000; at < cfg.mini.foeMs; at += 1000) s = stepMini(s, key(right(s)), at); // мяч не держат — отбор только по часам соперника
      return stepMini(s, tick, cfg.mini.foeMs + 500).steals;
    };
    expect([busy('short'), busy(null)]).toEqual([0, 1]);
    expect(shotChance(t('short'))).toBe(shotChance(base));
    const late = stepMini(t('counter'), tick, cfg.mini.holdMs + 1);
    expect([late.steals, late.holder, late.passes, atGoal(late)]).toEqual([1, forward(late), cfg.mini.minPasses, true]);
    expect(atGoal(stepMini(base, tick, cfg.mini.holdMs + 1))).toBe(false);
    expect(atGoal(stepMini(t('counter'), key('я'), 100))).toBe(false); // по своей ошибке — розыгрыш прежний
  });

  it('К21 без тактики или с неизвестной — игра прежняя; тактики открывают туры «Школы» 4, 8, 12, 16', () => {
    const base = startMini(ctx(4), 3);
    expect(base.tactic).toBeNull();
    expect(startMini(ctx(4, 0, 0, 'toString'), 3)).toEqual(base);
    expect(startMini(ctx(4, 0, 0, 'нет-такой'), 3)).toEqual(base);
    expect(startMini(ctx(4, 0, 0, 'wing'), 3).tactic).toBe('wing');
    expect([0, 3, 4, 7, 8, 11, 12, 15, 16, 40].map((n) => openTactics(n))).toEqual([[], [], ['wing'], ['wing'], ['wing', 'press'], ['wing', 'press'], ['wing', 'press', 'short'], ['wing', 'press', 'short'], [...TACTIC_IDS], [...TACTIC_IDS]]);
    expect(TACTIC_IDS).toEqual(['wing', 'press', 'short', 'counter']);
  });

  it('К21 честность: ни одна тактика не заведомо сильнее — средний ребёнок с любой выигрывает не больше чем на 1,2 лучше, чем без неё; колотящий по клавишам проигрывает и с тактикой', () => {
    const mean = (tc: string | null): number => seeds.reduce((a, x) => { const s = play(x, 1500, 0.05, false, tc); return a + s.us - s.them; }, 0) / seeds.length;
    const plain = mean(null);
    for (const id of TACTIC_IDS) {
      const gain = mean(id) - plain;
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThanOrEqual(1.2);
      expect(seeds.map((x) => play(x, 300, 0, true, id)).filter((m) => m.us > m.them)).toHaveLength(0);
    }
  });

  it('Ловит: старт ставит серию на кон — lastN.mini = 0 без траты лимита; итог: победа — прежняя + 1; брошенный матч — 0', () => {
    const base = { ...baseDef.empty(), lastN: { mini: { n: 2 } } };
    const b = beginMini({ base });
    expect(b.streak).toBe(2);
    expect(b.save.base.lastN.mini).toEqual({ n: 0 });
    expect(b.save.base.today).toBe(0);
    expect(baseDef.check(b.save.base)).toEqual([]);
    expect(beginMini(b.save).streak).toBe(0);
    expect(beginMini({ base: baseDef.empty() }).streak).toBe(0);
    const won3 = scoreMini({ ...startMini(ctx(4, b.streak), 3), us: 2, them: 1 });
    expect(won3).toBe(3);
    const r = finishFun(b.save, { id: 'mini', score: won3, run: 'm1' }, { day: '2026-11-19' });
    expect(r.save.base.lastN.mini?.n).toBe(3);
    expect(r.view).toMatchObject({ record: 'first', score: 3 });
    expect(baseDef.check(r.save.base)).toEqual([]);
  });

  it('Ловит: итог проходит finishFun и baseDef.check; тактика — только место (067-Р22)', () => {
    const s = startMini(ctx(4), 3);
    expect(s.tactic).toBeNull();
    const end = { ...stepMini(s, tick, cfg.mini.matchMs), us: 1, them: 0 };
    const r = finishFun({ base: baseDef.empty() }, { id: 'mini', score: scoreMini(end), run: 'm1' }, { day: '2026-11-19' });
    expect(r.view).toMatchObject({ record: 'first', score: 1 });
    expect(baseDef.check(r.save.base)).toEqual([]);
    expect(r.save.base.lastN.mini?.n).toBe(1);
  });
});

describe('К5 · Штрафной через стенку', () => {
  const keys = ['а', 'о', 'в', 'л'];
  const words = dict.ru.words;

  it('Ловит: слова-мишени — только из выученных букв, 5 ударов, при том же зерне те же', () => {
    for (let seed = 0; seed < 20; seed++) {
      const w = wordsFor(keys, seed, words);
      expect(w).toHaveLength(cfg.free.shots);
      for (const word of w) for (const c of word) expect(keys).toContain(c);
    }
    expect(wordsFor(keys, 4, words)).toEqual(wordsFor(keys, 4, words));
    expect(wordsFor([], 1, words)).toEqual([]);
    expect(startFree({ keys: [], words }, 1).over).toBe(true);
  });

  it('Ловит: длина мишеней — от minWordLen до maxWordLen; при ключах аовл однобуквенных мишеней нет; при одной букве мишени — сама буква', () => {
    for (let seed = 0; seed < 20; seed++) {
      for (const w of wordsFor(['а', 'о', 'в', 'л'], seed, words)) {
        expect(w.length).toBeGreaterThanOrEqual(cfg.free.minWordLen);
        expect(w.length).toBeLessThanOrEqual(cfg.free.maxWordLen);
      }
    }
    expect(wordsFor(['ж'], 1, words)).toEqual(['ж', 'ж', 'ж', 'ж', 'ж']);
    for (const w of wordsFor(['а', 'о', 'в', 'л'], 1, ['аааааааа', 'а'])) expect(['а', 'о', 'в', 'л']).toContain(w);
  });

  /** Серия ударов: 1 — набрать слово верно, 0 — первая буква неверная. */
  const play = (s0: FreeState, goals: number[]): FreeState => {
    let s = s0;
    let t = 0;
    for (const g of goals) {
      const word = s.words[s.shot] as string;
      for (const c of word) {
        t += 500;
        s = stepFree(s, key(g ? c : 'я'), t);
        if (!g) break;
      }
    }
    return s;
  };

  it('Ловит: верные буквы слова — гол; неверная буква — в стенку, без гола; пять ударов — конец', () => {
    const s = play(startFree({ keys, words }, 2), [1, 0, 1, 1, 0]);
    expect(s.over).toBe(true);
    expect(scoreFree(s)).toBe(3);
    expect(stepFree(s, key('а'), 99999)).toBe(s);
  });

  it('Ловит: слово не набрано за wordMs — удар без гола; тик слово не меняет', () => {
    const s = startFree({ keys, words }, 2);
    expect(stepFree(s, tick, 100)).toBe(s);
    const late = stepFree(s, tick, cfg.free.wordMs + 1);
    expect(late.shot).toBe(1);
    expect(late.goals).toBe(0);
  });

  it('Ловит: время серии — целые секунды; нечётное число шагов по 500 мс округляется вверх (5 шагов = 2,5 с → 3)', () => {
    const s = play(startFree({ keys, words }, 2), [0, 0, 0, 0, 0]);
    expect(s.endedAt).toBe(2500);
    expect(timeFree(s, 0)).toBe(3);
  });

  it('Ловит: итог «голов и время» проходит finishFun и baseDef.check; при равных голах меньшее время — рекорд', () => {
    const s = play(startFree({ keys, words }, 2), [1, 1, 0, 0, 0]);
    expect(Number.isInteger(timeFree(s, 0))).toBe(true);
    const first = finishFun({ base: baseDef.empty() }, { id: 'free', score: scoreFree(s), t: 47, run: 'f1' }, { day: '2026-11-19' });
    expect(first.view).toMatchObject({ record: 'first', score: 2 });
    expect(baseDef.check(first.save.base)).toEqual([]);
    expect(first.save.base.records.free).toMatchObject({ n: 2, t: 47 });
    const slow = finishFun(first.save, { id: 'free', score: 2, t: 59, run: 'f2' }, { day: '2026-11-19' });
    expect(slow.view).toMatchObject({ record: 'same' });
    const fast = finishFun(first.save, { id: 'free', score: 2, t: 40, run: 'f3' }, { day: '2026-11-19' });
    expect(fast.view).toMatchObject({ record: 'beaten' });
  });
});

describe('К21 · Штрафной на экране (067 Т21)', () => {
  const keys = ['а', 'о', 'в', 'л'];
  const words = dict.ru.words;
  const day = '2026-11-19';
  /** Раздел `base` сеанса и запись: сохранённые патчи копятся в `saved`. */
  const saver = (base: Base) => {
    const saved: Base[] = [];
    return { sections: { base: { data: base } }, saved, save: (patch: Record<string, unknown>) => { saved.push(patch.base as Base); return { ok: true }; } };
  };
  const withRecord = (n: number, t: number): Base => ({ ...baseDef.empty(), records: { free: { n, t, day: '2026-11-10' } } });

  it('К21 ряд ударов: гол и мяч в стенку — по смене удара; последний удар закрывает серию', () => {
    const a = startFree({ keys, words }, 2);
    const word = a.words[0] as string;
    let s = a;
    for (const c of word) s = stepFree(s, key(c), 100);
    expect(freeResults([], a, s)).toEqual([true]);
    expect(freeResults([true], a, stepFree(a, tick, 5))).toEqual([true]); // шаг без смены удара ряд не меняет
    expect(freeResults([true], a, stepFree(a, key('я'), 100))).toEqual([true, false]);
    let last = a;
    let res: boolean[] = [];
    for (let i = 0; i < cfg.free.shots; i++) {
      const n = stepFree(last, key('я'), 100 + i);
      res = freeResults(res, last, n);
      last = n;
    }
    expect(last.over).toBe(true);
    expect(res).toEqual([false, false, false, false, false]);
  });

  it('К21 мишени: слово удара и два следующих, в конце серии меньше; мяч по набранным буквам — от ноги до 0,72 дуги', () => {
    const w = ['а', 'б', 'в', 'г', 'д'];
    expect(freeBoards(w, 0)).toEqual(['а', 'б', 'в']);
    expect(freeBoards(w, 3)).toEqual(['г', 'д']);
    expect(freeBoards(w, 4)).toEqual(['д']);
    expect(freeFlight(0, 3)).toBe(0);
    expect(freeFlight(2, 3)).toBeCloseTo(0.48, 5);
    expect(freeFlight(1, 3)).toBeLessThan(freeFlight(2, 3));
    expect(freeFlight(5, 3)).toBeCloseTo(0.72, 5);
    expect(freeFlight(0, 0)).toBe(0);
  });

  it('К21 клавиша удара: любая буква по месту клавиши, не знак и не повтор', () => {
    expect(freeChar({ code: 'KeyF' })).toBe('а');
    expect(freeChar({ code: 'KeyG' })).toBe('п'); // не выученная тоже буква: промах решает движок
    expect(freeChar({ code: 'Digit1' })).toBeNull();
    expect(freeChar({ code: 'KeyF', repeat: true })).toBeNull();
    expect(freeChar({ code: 'ShiftLeft' })).toBeNull();
  });

  it('К21 клавиши в панели: в порядке клавиатуры (ФЫВА ОЛДЖ), не в порядке урока', () => {
    expect(freeKeyList(['а', 'о', 'в', 'л', 'ы', 'д', 'ф', 'ж'])).toEqual(['Ф', 'Ы', 'В', 'А', 'О', 'Л', 'Д', 'Ж']);
    expect(freeKeyList(['к', 'а', 'ф'])).toEqual(['Ф', 'А', 'К']);
  });

  it('К21 рекорд со временем: первая серия пишет голы и секунды (рекорд и последняя игра), 0 монет', () => {
    const r = saver(baseDef.empty());
    const end = finishFree(r.sections, r.save, 4, 21, 'f1', day);
    expect(end).toMatchObject({ score: 4, record: 'first', best: 4, t: 21, bestT: 21, prevT: 0, left: 1, unsaved: false });
    const b = r.saved[0] as Base;
    expect(b.records.free).toEqual({ n: 4, t: 21, day });
    expect(b.lastN.free).toEqual({ n: 4, t: 21 });
    expect(b.today).toBe(1);
    expect(baseDef.check(b)).toEqual([]);
  });

  it('К21 равные голы: быстрее — рекорд побит, медленнее — прежний; рекорд хранит и время', () => {
    const fast = saver(withRecord(3, 40));
    expect(finishFree(fast.sections, fast.save, 3, 31, 'f2', day)).toMatchObject({ record: 'beaten', best: 3, t: 31, bestT: 31, prev: 3, prevT: 40 });
    expect(fast.saved[0]?.records.free).toMatchObject({ n: 3, t: 31 });
    const slow = saver(withRecord(3, 40));
    expect(finishFree(slow.sections, slow.save, 3, 55, 'f3', day)).toMatchObject({ record: 'same', best: 3, bestT: 40, t: 55 });
    expect(slow.saved[0]?.records.free).toMatchObject({ n: 3, t: 40 });
    const more = saver(withRecord(3, 40));
    expect(finishFree(more.sections, more.save, 4, 99, 'f4', day).record).toBe('beaten');
  });

  it('К21 строка итога: первый рекорд с числом и временем, побит — «было …», не побит — рекорд, не записан — причина', () => {
    const first = saver(baseDef.empty());
    const e1 = finishFree(first.sections, first.save, 4, 21, 'n1', day);
    expect(freeEndNote(e1, '')).toBe('Раньше рекорда не было — теперь он твой: 4 из 5 · 0:21. Монет за игры на интерес нет — награда рекорд.');
    const beaten = saver(withRecord(3, 40));
    expect(freeEndNote(finishFree(beaten.sections, beaten.save, 4, 30, 'n2', day), '')).toContain('было 3 из 5 · 0:40.');
    const same = saver(withRecord(4, 25));
    expect(freeEndNote(finishFree(same.sections, same.save, 3, 30, 'n3', day), '')).toContain('До рекорда 4 из 5 · 0:25.');
    const lost = { sections: { base: { data: baseDef.empty() } }, save: () => ({ ok: false }) };
    const e4 = finishFree(lost.sections, lost.save, 4, 21, 'n4', day);
    expect(e4.unsaved).toBe(true);
    expect(freeEndNote(e4, 'Нет места.')).toContain('Нет места.');
    expect(freeEndNote(e4, 'Нет места.')).not.toContain('рекорд');
    expect(freeScoreText(4, 21)).toBe('4 из 5 · 0:21');
  });
  it('К21 первая серия без голов: рекорда не было — в итоге только «монет нет», без «До рекорда 0 из 5 · 0:00»', () => {
    const r = saver(baseDef.empty());
    const end = finishFree(r.sections, r.save, 0, 0, 'z1', day);
    expect(end).toMatchObject({ score: 0, record: 'same', prev: 0, unsaved: false });
    expect(freeEndNote(end, '')).toBe(ru.base.keepy.noCoins);
    expect(freeEndNote(end, '')).not.toContain('До рекорда');
    // с прежним рекордом «До рекорда» остаётся: ноль к нему ближе не делает
    const old = saver(withRecord(3, 40));
    expect(freeEndNote(finishFree(old.sections, old.save, 0, 10, 'z2', day), '')).toContain('До рекорда 3 из 5 · 0:40.');
  });

  it('К21 не записан, но счёт лучше рекорда: «Итог не записан» и причина, ни «было …», ни «побил»', () => {
    const lost = { sections: { base: { data: withRecord(3, 40) } }, save: () => ({ ok: false }) };
    const end = finishFree(lost.sections, lost.save, 4, 30, 'u1', day);
    expect(end).toMatchObject({ unsaved: true, record: 'beaten' });
    const note = freeEndNote(end, 'Нет места.');
    expect(note).toBe(`${ru.learn.end.saveFail} Нет места.`);
    expect(note).not.toContain('было');
  });

  it('К21 ряд точек серии: сыгранные — гол/мимо, текущий — «now» только в игре, остальные пусты (общий у Штрафного и Вратаря)', () => {
    expect(seriesPips([true, false], 5, true, 'goal')).toEqual(['goal', 'miss', 'now', '', '']);
    expect(seriesPips([true, false], 5, false, 'goal')).toEqual(['goal', 'miss', '', '', '']);
    expect(seriesPips([], 3, true, 'save')).toEqual(['now', '', '']);
    expect(seriesPips([true, true, true], 3, true, 'save')).toEqual(['save', 'save', 'save']);
  });

  it('К21 мишени на старте: слова зерна, которое раздаст игра, — те же, что в серии', () => {
    const ks = ['а', 'о', 'в', 'л', 'ы', 'д'];
    expect(freeBoards(wordsFor(ks, 12345, words), 0)).toEqual(startFree({ keys: ks, words }, 12345).words.slice(0, 3));
  });

  it('К22 Р261 зерно партии: первое — зерно кадра стенда, иначе по часам; партия берёт разыгранное заранее, следующее — из него; слова старта = слова серии', () => {
    expect(firstSeed(54, 1_700_000_000_000)).toBe(54);
    expect(firstSeed(undefined, 1000)).toBe(rollSeed(1000, 0));
    const first = firstSeed(undefined, 5000);
    const a = takeSeed(first, 7000);
    expect(a.seed).toBe(first);
    expect(a.next).toBe(rollSeed(7000, first));
    const ks = ['а', 'о', 'в', 'л', 'ы', 'д'];
    expect(freeBoards(wordsFor(ks, first, words), 0)).toEqual(startFree({ keys: ks, words }, a.seed).words.slice(0, 3));
  });

  it('К22 Р268 отсчёт слова: полоска убывает за wordMs, в последние warnMs — тревога; серия кончена — полоски нет; число секунд — из контента', () => {
    const s = startFree({ keys, words }, 2, 1000);
    expect(freeWordSeconds).toBe(cfg.free.wordMs / 1000);
    expect(wordLeft(s, 1000)).toBe(cfg.free.wordMs);
    expect(freeWordBar(s, 1000)).toEqual({ left: 1, hot: false });
    expect(freeWordBar(s, 1000 + cfg.free.wordMs / 2)).toEqual({ left: 0.5, hot: false });
    expect(freeWordBar(s, 1000 + cfg.free.wordMs - cfg.free.warnMs)?.hot).toBe(true);
    expect(freeWordBar(s, 1000 + cfg.free.wordMs + 500)).toEqual({ left: 0, hot: true });
    expect(freeWordBar(null, 0)).toBeNull();
    expect(freeWordBar({ ...s, over: true }, 0)).toBeNull();
  });
});

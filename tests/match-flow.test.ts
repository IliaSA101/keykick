/**
 * Матч v2 (спека 017, Т4): машина состояний — фазы, пенальти, доп. время, помощь, тренер, перезагрузка, запись.
 * Тексты подставные (`ф`-строки заданной длины), игра ведётся нажатиями через `next`.
 */
import { describe, expect, it } from 'vitest';
import matchJson from '../src/content/match.json';
import { courseLessons } from '../src/app/course/load';
import { keymap } from '../src/app/keymap';
import { earn, emptyWallet, untilCoin } from '../src/engine/matchResult/coins';
import { initMatch, next, type MatchConfig, type MatchState, type MatchTexts } from '../src/engine/match/machine';
import { entryFor, type PendingSecond } from '../src/engine/match/resume';
import type { Help } from '../src/engine/match/verdict';
import { parseMatchRules } from '../src/engine/match/rules';
import { applyEffects, guardOpen, holdsResult, matchView, screenDelay, type Action, type Effect, type MatchStore } from '../src/engine/match/view';

const rules = parseMatchRules(matchJson, keymap);
const lesson = courseLessons.find((l) => l.league === 'yard' && !l.friendly && l.attacks.length === 4 && l.c >= 2)!;
const A = lesson.attacks.length;
const { g, c } = lesson;

interface Lens {
  warm: number[];
  attack: number;
  extra: number;
}
const word = (n: number): string => 'ф'.repeat(n);
const textsOf = (len: Lens): MatchTexts => ({
  warmup: () => len.warm.map((n) => [word(n)]),
  half: () => lesson.attacks.map(() => word(len.attack)),
  extra: () => word(len.extra),
  coachLine: () => word(10),
});
const cfgOf = (len: Lens, over: Partial<MatchConfig> = {}): MatchConfig => ({
  lesson, softened: false, kind: 'lesson', best: 0, paid: true, rules, map: keymap, texts: textsOf(len),
  kickTask: () => null, solved: [], ...over,
});
const small: Lens = { warm: [6, 6], attack: 6, extra: 6 };
const kick = { kickTask: () => 'task-1' };

let clock = 1000;
const press = (ch: string, ok = true): Action => ({
  type: 'press',
  press: { code: ok ? (keymap.byChar.ru.get(ch)?.key.code ?? 'KeyA') : 'KeyZ', key: ok ? ch : '§', repeat: false, mod: false, caps: false, time: (clock += 100) },
});

interface Run {
  s: MatchState;
  fx: Effect[];
  /** Верные нажатия по источникам — счёт самого теста, не машины. */
  ok: Record<string, number>;
  /** Сколько неверных нажатий вставил тест (разминка и тренер их не получают). */
  bad: { n: number };
}
const begin = (cfg: MatchConfig, fails = 0, help?: Help): Run => {
  const r = next(initMatch(cfg, { seed: 7, fails, help: help ?? 'none' }), { type: 'start', now: 1 });
  return { s: r.state, fx: r.effects, ok: {}, bad: { n: 0 } };
};
const act = (r: Run, a: Action): Run => {
  const x = next(r.s, a);
  return { s: x.state, fx: [...r.fx, ...x.effects], ok: r.ok, bad: r.bad };
};

/** Печатает, пока не выполнится `stop`; `errs(ключ атаки)` ошибок вставляется после первого знака строки 0. */
function drive(r0: Run, stop: (s: MatchState) => boolean, errs: (phase: string, attack: number) => number = () => 0): Run {
  let r = r0;
  const done = new Set<string>();
  for (let guard = 0; guard < 20000 && !stop(r.s) && r.s.typing; guard++) {
    const t = r.s.typing;
    const key = `${r.s.phase}${r.s.attack}`;
    if (t.pos === 1 && r.s.row === 0 && !done.has(key) && r.s.phase !== 'warmup' && r.s.phase !== 'coach') {
      done.add(key);
      for (let i = 0; i < errs(r.s.phase, r.s.attack); i++) {
        r = act(r, press('ф', false));
        r.bad.n++;
      }
    }
    const src = r.s.phase;
    r = act(r, press(t.text[t.pos] ?? 'ф'));
    r.ok[src] = (r.ok[src] ?? 0) + 1;
  }
  return r;
}
const toBreak = (r: Run, errs?: (p: string, a: number) => number): Run => drive(r, (s) => s.phase === 'break', errs);
const through = (r: Run, errs?: (p: string, a: number) => number): Run => {
  const br = toBreak(r, errs);
  return drive(act(br, { type: 'toSecondHalf', now: 5, seed: 8 }), (s) => ['result', 'extra', 'coach'].includes(s.phase), errs);
};
const finishOf = (r: Run) => r.fx.filter((e): e is Extract<Effect, { kind: 'finish' }> => e.kind === 'finish');
const kinds = (r: Run, k: Effect['kind']) => r.fx.filter((e) => e.kind === k);

describe('поток матча (design §1)', () => {
  it('разминка → 1-й тайм → перерыв → 2-й тайм → победа, ★★★ при чистой печати', () => {
    // Ловит: пропущенную фазу, потерянный переход перерыв → 2-й тайм, звёзды не по точности, журнал не со старта.
    let r = begin(cfgOf(small));
    expect(r.s.phase).toBe('warmup');
    expect(r.fx[0]).toMatchObject({ kind: 'begin', lessonId: lesson.id, fails: 0 });
    r = toBreak(r);
    expect(matchView(r.s)).toMatchObject({ phase: 'break', score: { typed: A, conceded: 0 }, beforeUnload: false });
    expect(kinds(r, 'toBreak')).toHaveLength(1);
    r = through(r);
    const f = finishOf(r);
    expect(f).toHaveLength(1);
    expect(f[0]!.result).toMatchObject({ outcome: 'win', fails: 0, offer: null });
    expect(f[0]!.result.verdict.stars).toBe(3);
    expect(kinds(r, 'begin')).toHaveLength(1);
    expect(r.s.opened).toBe(false);
  });

  it('счёт и исход атак: гол при e = g, сейв между, гол соперника при e = c', () => {
    // Ловит: сдвиг границ g/c в машине (счёт идёт от числа ошибок атаки, а не от строки).
    const r = toBreak(begin(cfgOf(small)), (_p, a) => (a === 0 ? g : a === 1 ? c : a === 2 ? g + 1 : 0));
    // g + 1 может совпасть с c: тогда это гол соперника, а не сейв.
    // Атаки: 0 — гол (e = g), 1 — гол соперника (e = c), 2 — сейв (g + 1 < c) или гол соперника, 3 — гол.
    const saved = g + 1 < c;
    expect(r.s.score).toEqual({ typed: 2, kick: 0, conceded: saved ? 1 : 2 });
  });

  it('пенальти — одно, во 2-м тайме после первой чистой атаки; не в 1-м и не после последней', () => {
    // Ловит: пенальти в 1-м тайме, второе пенальти за тайм, пенальти после последней атаки, потерю счёта удара.
    let r = toBreak(begin(cfgOf(small, kick)));
    expect(kinds(r, 'kick')).toHaveLength(0);
    r = act(r, { type: 'toSecondHalf', now: 5 });
    r = drive(r, (s) => s.phase === 'kick');
    expect(matchView(r.s)).toMatchObject({ phase: 'kick', banner: 'kick', attack: 1 });
    r = act(r, { type: 'kickAnswer', result: 'scored' });
    expect(r.s.score.kick).toBe(1);
    expect(kinds(r, 'kick')[0]).toMatchObject({ result: 'scored', expert: 1, taskId: 'task-1' });
    r = drive(r, (s) => s.phase === 'result');
    expect(r.s.phase).toBe('result');
    expect(kinds(r, 'kick')).toHaveLength(1);
    expect(r.s.score).toEqual({ typed: 2 * A, kick: 1, conceded: 0 });
  });

  it('«Не бить» — исход skipped без гола; ошибка в первой атаке откладывает пенальти на чистую', () => {
    // Ловит: гол за «Не бить», пенальти после грязной атаки, потерянную «чистую» вторую атаку.
    let r = toBreak(begin(cfgOf(small, kick)));
    r = act(r, { type: 'toSecondHalf', now: 5 });
    r = drive(r, (s) => s.phase === 'kick', (_p, a) => (a === 0 && g > 0 ? 1 : 0));
    // при g = 0 ошибка делает сейв, при g ≥ 1 — гол с ошибкой; пенальти в обоих случаях не после грязной
    expect(r.s.attack).toBe(1);
    r = act(r, { type: 'skipKick' });
    expect(kinds(r, 'kick')[0]).toMatchObject({ result: 'skipped', expert: 0 });
    expect(r.s.score.kick).toBe(0);
    const again = act(r, { type: 'skipKick' });
    expect(kinds(again, 'kick')).toHaveLength(1);
  });

  it('решающая атака: последняя атака 2-го тайма при разнице −1…+1, иначе нет; в 1-м тайме никогда', () => {
    // Ловит: подсветку «решающей» в 1-м тайме, при разнице вне −1…+1 и потерю её при −1.
    const view = (half1Errors: number) => {
      let r = toBreak(begin(cfgOf(small)), () => half1Errors);
      expect(matchView(r.s).decisive).toBe(false);
      r = act(r, { type: 'toSecondHalf', now: 5, seed: 8 });
      r = drive(r, (s) => s.half === 2 && s.attack === A - 1 && s.typing?.pos === 1);
      return matchView(r.s);
    };
    // 1-й тайм проигран 0:A, три гола во 2-м → −1: решает последняя атака.
    expect(view(c)).toMatchObject({ attack: A, decisive: true, score: { typed: A - 1, conceded: A } });
    // 1-й тайм выигран A:0, три гола во 2-м → +2A−1: исход атаки итог не меняет.
    expect(view(0)).toMatchObject({ attack: A, decisive: false });
  });

  it('ничья → доп. время: гол — победа, иначе провал с переигровкой 2-го тайма', () => {
    // Ловит: победу при ничьей без доп. времени, победу после сейва в доп. времени, потерю ожидающей переигровки.
    const draw = (extraErrors: number): Run => {
      const r = through(begin(cfgOf(small)), (p) => (p === 'half2' ? c : p === 'extra' ? extraErrors : 0));
      expect(r.s.phase).toBe('extra');
      expect(matchView(r.s)).toMatchObject({ decisive: true, attacks: 1 });
      // Удар последней атаки 2-го тайма не гаснет при переходе в доп. время (017-Р27).
      expect(matchView(r.s).lastOutcome).toMatchObject({ outcome: 'conceded' });
      return drive(r, (s) => s.phase === 'result' || s.phase === 'coach', (p) => (p === 'extra' ? extraErrors : 0));
    };
    const win = finishOf(draw(0))[0]!;
    expect(win.result).toMatchObject({ outcome: 'win', fails: 0 });
    const lost = finishOf(draw(c))[0]!;
    expect(lost.result).toMatchObject({ outcome: 'loss', fails: 1 });
    expect(lost.result.offer?.options).toEqual(['replay2']);
    expect(lost.pending).toMatchObject({ started: false, reason: 'replay', first: { score: { typed: A, conceded: 0 } } });
  });

  it('товарищеский: поражение — пройден, звёзд 0', () => {
    // Ловит: провал товарищеского и звёзды за непройденный по печати матч.
    const fl = { ...lesson, friendly: true };
    const r = through(begin(cfgOf(small, { lesson: fl })), (p) => (p === 'half1' ? c : p === 'half2' ? c : p === 'extra' ? c : 0));
    const f = finishOf(drive(r, (s) => s.phase === 'result'))[0]!;
    expect(f.result.verdict).toMatchObject({ passed: true, stars: 0 });
    expect(f.result.offer).toBeNull();
  });
});

describe('провал, помощь, тренер, переигровка (design §4–5)', () => {
  const lose = (fails: number, len = small): Run =>
    through(begin(cfgOf(len), fails), (p) => (p === 'half1' || p === 'half2' ? c : 0));

  it('поражение при проигранном 1-м тайме: «Переиграть матч», переигровка 2-го тайма не предлагается', () => {
    // Ловит: переигровку 2-го тайма после проигранного 1-го (счёт 1-го сохраняется только если он не проигран).
    const r = lose(0);
    const f = finishOf(r)[0]!;
    expect(f.result.offer?.options).toEqual(['replay']);
    expect(f.pending).toBeNull();
    expect(f.result.verdict.stars).toBe(0);
  });

  it('переигровка 2-го тайма: печать и счёт 1-го целы, новое зерно, помечен started', () => {
    // Ловит: потерю печати 1-го тайма в переигровке (★★★ и точность), запуск 1-го тайма заново, молчание о started.
    // 2-й тайм проигран по голам, доп. время тоже: A:A → провал с предложением «Переиграть 2-й тайм».
    const lost2 = (p: string) => (p === 'half2' || p === 'extra' ? c : 0);
    const r0 = through(begin(cfgOf(small)), lost2);
    const r1 = drive(r0, (s) => s.phase === 'result', lost2);
    expect(r1.s.phase).toBe('result');
    const r2 = act(r1, { type: 'choose', offer: 'replay2', seed: 99, now: 9 });
    expect(r2.s).toMatchObject({ phase: 'half2', half: 2, seed: 99, replay: true });
    expect(r2.s.score).toEqual({ typed: A, kick: 0, conceded: 0 });
    expect(r2.fx.at(-1)).toEqual({ kind: 'half2Started' });
    expect(kinds(r2, 'begin')).toHaveLength(2);
    const r3 = drive(r2, (s) => s.phase === 'result');
    const f = finishOf(r3).at(-1)!;
    expect(f).toMatchObject({ session: 'replay', pending: null });
    expect(f.result).toMatchObject({ outcome: 'win', fails: 0 });
    expect(f.result.verdict.stars).toBe(3);
  });

  it('fails 2: минута тренера на слабых клавишах, платит как печать, потом предложение', () => {
    // Ловит: тренера без клавиш, тренера без записи блоков, бесконечную минуту, потерю предложения после неё.
    const r0 = lose(1);
    expect(r0.s.phase).toBe('coach');
    expect(matchView(r0.s).coach).toMatchObject({ keys: 'ф', leftMs: null });
    expect(matchView(r0.s).beforeUnload).toBe(true);
    // Нажатия идут с шагом 20 с: минута кончается на конце второй строки.
    let r = r0;
    for (let i = 0; i < 100 && r.s.phase === 'coach'; i++) {
      r = drive(r, (s) => s.typing?.pos === 1 || s.phase !== 'coach');
      clock += 20000;
      r = act(r, press('ф'));
      r.ok.coach = (r.ok.coach ?? 0) + 1;
      r = drive(r, (s) => s.phase !== 'coach' || (s.typing?.pos ?? 0) === 0);
    }
    expect(r.s.phase).toBe('result');
    expect(r.s.coachDone).toBe(true);
    const coachBlocks = r.fx.filter((e) => e.kind === 'block' && e.source === 'coach');
    expect(coachBlocks.length).toBeGreaterThanOrEqual(2);
    expect(matchView(r.s).offer?.options).toEqual(['replay']);
  });

  it('fails 3: «С запасом» даёт c + 1, потолок ★★; fails 5: «С тренером» даёт g + 1 и c + 1', () => {
    // Ловит: помощь, не доходящую до порогов атаки, и звёзды выше потолка помощи.
    const r3 = lose(2);
    expect(r3.s.result?.offer?.options).toEqual(['reserve', 'again', 'quit']);
    const h = act(r3, { type: 'choose', offer: 'reserve', seed: 5, now: 9 });
    expect(h.s).toMatchObject({ phase: 'half1', help: 'reserve', fails: 3 });
    expect(kinds(h, 'begin').at(-1)).toMatchObject({ help: 'reserve', c: c + 1, g, fails: 3 });
        const r5 = lose(4);
    expect(r5.s.result?.offer?.options).toEqual(['coach', 'reserve', 'quit']);
    const hc = act(r5, { type: 'choose', offer: 'coach', seed: 5, now: 9 });
    expect(kinds(hc, 'begin').at(-1)).toMatchObject({ help: 'coach', c: c + 1, g: g + 1 });
    expect(matchView(hc.s).reserve?.total).toBe(c);
  });

  it('с запасом выигранный матч: ★★ при чистой печати', () => {
    // Ловит: срез потолка помощи (reserveCap) при подсчёте звёзд в машине.
    const r = lose(2);
    const h = act(r, { type: 'choose', offer: 'reserve', seed: 5, now: 9 });
    const done = drive(through(h), (s) => s.phase === 'result');
    expect(finishOf(done).at(-1)!.result.verdict.stars).toBe(rules.help.reserveCap);
  });

  it('«На сегодня хватит» — выход без записи', () => {
    // Ловит: запись или abandon после уже доигранного матча.
    const r = act(lose(2), { type: 'choose', offer: 'quit', seed: 1, now: 9 });
    expect(r.s.phase).toBe('quit');
    expect(kinds(r, 'abandon')).toHaveLength(0);
  });

  it('К16: 1-й тайм < 0,97 и чистая переигровка 2-го → ★★, скорость — по обоим таймам', () => {
    // Ловит: точность только 2-го тайма (★★★ вместо ★★), cpm без печати 1-го тайма, потерю ms 1-го тайма в ожидающей.
    expect(g).toBeGreaterThan(0);
    const e1 = (p: string) => (p === 'half1' ? g : p === 'half2' || p === 'extra' ? c : 0);
    const r0 = drive(through(begin(cfgOf(small)), e1), (s) => s.phase === 'result', e1);
    const lost = finishOf(r0)[0]!;
    expect(lost.result.verdict.stars).toBe(0);
    const pending = lost.pending!;
    expect(pending.first.errors).toBe(A * g);
    const r1 = act(r0, { type: 'choose', offer: 'replay2', seed: 99, now: 9 });
    const from = r1.fx.length;
    const r2 = drive(r1, (s) => s.phase === 'result');
    const f = finishOf(r2).at(-1)!;
    expect(f.result.verdict.stars).toBe(2);
    expect(f.result.accuracy).toBeCloseTo((A * 6 * 2) / (A * 6 * 2 + A * g), 10);
    const mine = r2.fx.slice(from).filter((e): e is Extract<Effect, { kind: 'block' }> => e.kind === 'block');
    const ms = pending.first.ms + mine.reduce((n, b) => n + b.ms, 0);
    const correct = pending.first.correct + mine.reduce((n, b) => n + b.correct, 0);
    expect(f.result.cpm).toBe(Math.round((correct * 60000) / ms));
    expect(correct).toBe(2 * A * 6);
  });

  it('переигровка 2-го тайма платит монеты: блоки с paid и верными знаками нового тайма', () => {
    // Ловит: молчаливую переигровку без записи блоков (монеты и ошибки клавиш не доходят до кассы).
    const lost2 = (p: string) => (p === 'half2' || p === 'extra' ? c : 0);
    const r0 = drive(through(begin(cfgOf(small)), lost2), (s) => s.phase === 'result', lost2);
    const r1 = act(r0, { type: 'choose', offer: 'replay2', seed: 99, now: 9 });
    const from = r1.fx.length;
    const r2 = drive(r1, (s) => s.phase === 'result', (p) => (p === 'half2' ? 1 : 0));
    const mine = r2.fx.slice(from).filter((e): e is Extract<Effect, { kind: 'block' }> => e.kind === 'block');
    expect(mine).toHaveLength(A);
    expect(mine.every((b) => b.paid && b.source === 'attack' && b.half === 2)).toBe(true);
    expect(mine.reduce((n, b) => n + b.correct, 0)).toBe(A * 6);
    expect(mine[0]!.errors).toBe(1);
    expect(mine.map((b) => b.attack)).toEqual(Array.from({ length: A }, (_, i) => i + 1));
  });

  it('«с тренером» — потолок ★, смягчённый урок — потолок ★★, начатые через machine', () => {
    // Ловит: потолки звёзд, не доходящие до итога машины (помощь из initMatch и choose, смягчение).
    const coach = drive(through(begin(cfgOf(small), 4, 'coach')), (s) => s.phase === 'result');
    expect(kinds(coach, 'begin')[0]).toMatchObject({ help: 'coach', fails: 4 });
    expect(finishOf(coach)[0]!.result.verdict).toMatchObject({ passed: true, stars: rules.help.coachCap });
    const soft = drive(through(begin(cfgOf(small, { softened: true }))), (s) => s.phase === 'result');
    expect(kinds(soft, 'begin')[0]).toMatchObject({ softened: true });
    expect(finishOf(soft)[0]!.result.verdict.stars).toBe(rules.help.softenCap);
    const viaChoose = act(lose(4), { type: 'choose', offer: 'coach', seed: 5, now: 9 });
    const done = drive(through(viaChoose), (s) => s.phase === 'result');
    expect(finishOf(done).at(-1)!.result.verdict.stars).toBe(rules.help.coachCap);
  });

  it('choose принимает только «хватит» или показанный вариант', () => {
    // Ловит: переход в «Ещё раз» и переигровку, которых итог не предлагал (обход лестницы помощи).
    const r = lose(0);
    expect(r.s.result?.offer?.options).toEqual(['replay']);
    for (const offer of ['reserve', 'coach', 'again', 'replay2'] as const) {
      expect(act(r, { type: 'choose', offer, seed: 3, now: 9 }).s).toBe(r.s);
    }
    expect(act(r, { type: 'choose', offer: 'replay', seed: 3, now: 9 }).s.phase).toBe('half1');
  });

  it('минута тренера стартует по первому нажатию, часы её не запускают, пауза не ест время', () => {
    // Ловит: старт минуты по tick (до печати) и сгорание времени на паузе.
    const r0 = lose(1);
    expect(r0.s.phase).toBe('coach');
    const ticked = act(r0, { type: 'tick', now: 5_000_000 });
    expect(matchView(ticked.s).coach?.leftMs).toBeNull();
    let r = act(ticked, press('ф'));
    expect(matchView(r.s).coach?.leftMs).toBe(rules.coach.ms);
    const at = r.s.now;
    r = act(r, { type: 'pause', now: at + 500 });
    r = act(r, { type: 'tick', now: at + 9_000_000 });
    r = act(r, { type: 'resume', now: at + 9_000_500 });
    expect(matchView(r.s).coach?.leftMs).toBe(rules.coach.ms - 500);
  });

  it('вид и записи: replay, кубок в finish, блок атаки несёт тайм, номер, исход, счёт, место', () => {
    // Ловит: пустые поля контракта для журнала 018 (место at, исход, ms) и потерянный признак кубка/переигровки.
    const r = drive(through(begin(cfgOf(small, { kind: 'cup' })), (p, a) => (p === 'half1' && a === 1 ? g : 0)), (s) => s.phase === 'result');
    expect(finishOf(r)[0]).toMatchObject({ lessonKind: 'cup' });
    expect(matchView(r.s).replay).toBe(false);
    const blocks = r.fx.filter((e): e is Extract<Effect, { kind: 'block' }> => e.kind === 'block' && e.source === 'attack');
    expect(blocks).toHaveLength(2 * A);
    expect(blocks.map((b) => [b.half, b.attack, b.at])).toEqual(
      Array.from({ length: 2 * A }, (_, i) => [i < A ? 1 : 2, (i % A) + 1, i + 1]),
    );
    expect(blocks[1]).toMatchObject({ outcome: 'goal', score: { typed: 2, conceded: 0 } });
    expect(blocks[1]!.ms).toBeGreaterThan(0);
    expect(blocks[1]!.time).toBeGreaterThan(blocks[0]!.time);
    expect(blocks.at(-1)!.score).toEqual({ typed: 2 * A, kick: 0, conceded: 0 });
  });
});

describe('перезагрузка и выход (design §1.1, К16)', () => {
  const pendingOf = (r: Run): PendingSecond => kinds(r, 'toBreak')[0]!.kind === 'toBreak' ? (kinds(r, 'toBreak')[0] as Extract<Effect, { kind: 'toBreak' }>).pending : (null as never);

  it('F5 на перерыве: снова перерыв с ожидающим 2-м таймом, счёт и печать целы, fails не меняется', () => {
    // Ловит: потерю выигранного 1-го тайма при F5 на перерыве и рост fails.
    const r = toBreak(begin(cfgOf(small), 1));
    const pending = pendingOf(r);
    expect(pending).toMatchObject({ started: false, reason: 'break', seed: 7 });
    const e = entryFor(pending, lesson.id);
    expect(e.kind).toBe('break');
    const back = initMatch(cfgOf(small), { seed: 50, fails: 1, entry: e });
    expect(matchView(back)).toMatchObject({ phase: 'break', score: { typed: A }, firstScore: { typed: A }, banner: null });
    expect(back).toMatchObject({ fails: 1, seed: 7 });
    expect(back.first).toEqual({ correct: pending.first.correct, errors: pending.first.errors, ms: pending.first.ms });
    const go = next(back, { type: 'toSecondHalf', now: 3 });
    expect(go.state.phase).toBe('half2');
    expect(go.effects.map((x) => x.kind)).toEqual(['begin', 'half2Started']);
  });

  it('F5 во 2-м тайме: «Продолжить» при непроигранном 1-м, иначе матч заново; fails не растёт', () => {
    // Ловит: бесплатную перебивку с атаки, потерю счёта 1-го тайма, продолжение после проигранного 1-го.
    const p = pendingOf(toBreak(begin(cfgOf(small))));
    const started = { ...p, started: true };
    const e = entryFor(started, lesson.id);
    expect(e.kind).toBe('continue2');
    const back = initMatch(cfgOf(small), { seed: 77, fails: 2, entry: e });
    expect(matchView(back)).toMatchObject({ phase: 'break', banner: 'continue2', score: { typed: A } });
    expect(back).toMatchObject({ fails: 2, seed: 77 });
    const lostFirst = { ...started, first: { ...started.first, score: { typed: 0, kick: 0, conceded: 1 } } };
    expect(entryFor(lostFirst, lesson.id).kind).toBe('fresh');
    expect(entryFor(started, 'yard-99').kind).toBe('fresh');
    expect(entryFor(null, lesson.id).kind).toBe('fresh');
  });

  it('пауза: нажатия стоят, Enter возвращает, «Выйти» пишет abandon один раз; на перерыве паузы нет', () => {
    // Ловит: печать под паузой, beforeunload на паузе, двойную или поздно записанную отметку брошенного матча.
    let r = begin(cfgOf(small));
    r = act(r, { type: 'pause' });
    expect(matchView(r.s)).toMatchObject({ paused: true, beforeUnload: false });
    const before = r.s.typing;
    r = act(r, press('ф'));
    expect(r.s.typing).toBe(before);
    r = act(r, { type: 'resume' });
    expect(matchView(r.s).beforeUnload).toBe(true);
    const br = act(toBreak(r), { type: 'pause' });
    expect(br.s.paused).toBe(false);
    const q = act(act(r, { type: 'pause' }), { type: 'quit', now: 9 });
    expect(q.s.phase).toBe('quit');
    expect(kinds(q, 'abandon')).toEqual([{ kind: 'abandon', phase: 'warmup', half: 1, attack: 0, at: 9 }]);
    expect(kinds(act(q, { type: 'quit', now: 10 }), 'abandon')).toHaveLength(1);
  });
});

describe('запись по концу блока (К17, К8)', () => {
  it('журнал open со старта и закрытие в итоге; хранилищу уходят записи по порядку', () => {
    // Ловит: журнал, открытый только в итоге (брошенный матч выпал бы из калибровки), и потерянный вызов store.
    const calls: string[] = [];
    const store: MatchStore = {
      begin: () => calls.push('begin'), block: (e) => calls.push(`block:${e.source}`), toBreak: () => calls.push('toBreak'),
      half2Started: () => calls.push('half2'), kick: () => calls.push('kick'), abandon: () => calls.push('abandon'),
      finish: () => calls.push('finish'),
    };
    const r = through(begin(cfgOf(small)));
    applyEffects(store, r.fx);
    expect(calls[0]).toBe('begin');
    expect(calls.at(-1)).toBe('finish');
    expect(calls.filter((x) => x === 'begin')).toHaveLength(1);
    expect(calls.indexOf('toBreak')).toBeLessThan(calls.indexOf('half2'));
    expect(calls.filter((x) => x === 'block:warmup')).toHaveLength(2);
    expect(calls.filter((x) => x === 'block:attack')).toHaveLength(2 * A);
  });

  it('блок несёт верные, ошибки клавиш и нажатия для формы; брошенный матч уже записал сделанное', () => {
    // Ловит: запись только в итоге (брошенный матч терял монеты и ошибки), ошибки не по кодам клавиш.
    let r = toBreak(begin(cfgOf(small)), (_p, a) => (a === 0 ? 1 : 0));
    const b = r.fx.filter((e): e is Extract<Effect, { kind: 'block' }> => e.kind === 'block' && e.source === 'attack');
    expect(b[0]).toMatchObject({ correct: 6, paid: true, league: lesson.league });
    expect(b[0]!.errors).toBe(1);
    expect(b[0]!.keyErrors).toEqual({ KeyA: 1 });
    expect(b[0]!.presses.filter((p) => p.ok)).toHaveLength(6);
    r = act(r, { type: 'quit', now: 1 });
    expect(kinds(r, 'block').length).toBeGreaterThan(0);
  });

  it('голден К8: верные по источникам из нажатий, ошибки не платят, 512 верных → 25 монет, до монеты 8', () => {
    // Ловит: ошибки или источник (разминка, атака, доп. время, тренер), по ошибке выпавший из подсчёта монет, и потерю остатка.
    // 40 + 40 разминки, 2 тайма по 4 × 50, доп. время 32: 80 + 400 + 32 = 512.
    const len: Lens = { warm: [40, 40], attack: 50, extra: 32 };
    const r = drive(
      through(begin(cfgOf(len)), (p) => (p === 'half1' ? g : p === 'half2' ? c : p === 'extra' ? 1 : 0)),
      (s) => s.phase === 'result',
      (p) => (p === 'half1' ? g : p === 'half2' ? c : p === 'extra' ? 1 : 0),
    );
    const blocks = r.fx.filter((e): e is Extract<Effect, { kind: 'block' }> => e.kind === 'block');
    const by = (src: string) => blocks.filter((b) => b.source === src).reduce((n, b) => n + b.correct, 0);
    expect([by('warmup'), by('attack'), by('extra')]).toEqual([80, 400, 32]);
    expect(r.ok).toEqual({ warmup: 80, half1: 4 * 50, half2: 4 * 50, extra: 32 });
    expect(blocks.reduce((n, b) => n + b.errors, 0)).toBeGreaterThan(0);
    let w = emptyWallet;
    for (const b of blocks) {
      const e = earn(w.carry, b.correct, rules.coinPer);
      w = { coins: w.coins + e.coins, carry: e.carry };
    }
    expect(w).toEqual({ coins: 25, carry: 12 });
    expect(untilCoin(w.carry, rules.coinPer)).toBe(8);
  });

  it('голден К8 с тренером: верные тренера входят в общий счёт, монеты = всего / ставку с переносом', () => {
    // Ловит: минуту тренера, не платящую монет, и остаток, обнулённый между блоками.
    const lenC: Lens = { warm: [40, 40], attack: 50, extra: 32 };
    const lose2 = (p: string) => (p === 'half1' || p === 'half2' ? c : p === 'extra' ? c : 0);
    let r = through(begin(cfgOf(lenC), 1), lose2);
    r = drive(r, (s) => s.phase !== 'extra' && s.phase !== 'coach' ? true : s.phase === 'coach', lose2);
    r = drive(r, (s) => s.phase === 'coach' || s.phase === 'result', lose2);
    expect(r.s.phase).toBe('coach');
    for (let i = 0; i < 100 && r.s.phase === 'coach'; i++) {
      const t = r.s.typing!;
      clock += 30000;
      r = act(r, press(t.text[t.pos]!));
      r.ok.coach = (r.ok.coach ?? 0) + 1;
      r = drive(r, (s) => s.phase !== 'coach' || s.typing?.pos === 0 || s.typing === null);
    }
    expect(r.s.phase).toBe('result');
    const blocks = r.fx.filter((e): e is Extract<Effect, { kind: 'block' }> => e.kind === 'block');
    const total = blocks.reduce((n, b) => n + b.correct, 0);
    expect(blocks.filter((b) => b.source === 'coach').reduce((n, b) => n + b.correct, 0)).toBe(r.ok.coach);
    expect(total).toBe(Object.values(r.ok).reduce((a, b) => a + b, 0));
    let w = emptyWallet;
    for (const b of blocks) {
      const e = earn(w.carry, b.correct, rules.coinPer);
      w = { coins: w.coins + e.coins, carry: e.carry };
    }
    expect(w).toEqual({ coins: Math.floor(total / rules.coinPer), carry: total % rules.coinPer });
  });

  it('сумма ошибок клавиш, ошибок и нажатий по всем блокам = напечатанному тестом', () => {
    // Ловит: потерю ошибок или нажатий на стыке блоков (атака, тайм, доп. время), двойной счёт в соседнем блоке.
    const e = (p: string, a: number) => (p === 'half1' ? (a % 2) + 1 : p === 'half2' ? c : p === 'extra' ? 1 : 0);
    const r = drive(through(begin(cfgOf(small)), e), (s) => s.phase === 'result', e);
    const blocks = r.fx.filter((x): x is Extract<Effect, { kind: 'block' }> => x.kind === 'block');
    const sum = (f: (b: Extract<Effect, { kind: 'block' }>) => number) => blocks.reduce((n, b) => n + f(b), 0);
    expect(r.bad.n).toBeGreaterThan(0);
    expect(sum((b) => Object.values(b.keyErrors).reduce((n, v) => n + v, 0))).toBe(r.bad.n);
    expect(sum((b) => b.errors)).toBe(r.bad.n);
    expect(sum((b) => b.presses.length)).toBe(Object.values(r.ok).reduce((n, v) => n + v, 0) + r.bad.n);
    expect(sum((b) => b.presses.filter((x) => !x.ok).length)).toBe(r.bad.n);
  });
});

describe('пенальти по зерну тайма и повторный вход (design §14, §1.1)', () => {
  it('задача пенальти берётся функцией на каждый 2-й тайм по его зерну; переигровка — другая', () => {
    // Ловит: одну задачу на весь матч (переигровка бьёт то же), вызов функции в 1-м тайме, игнор зерна.
    const seeds: number[] = [];
    const cfg = cfgOf(small, { kickTask: (seed) => (seeds.push(seed), `task-${seed}`) });
    // 1-й тайм: A−1 : 1; 2-й: гол с пенальти-атакой и A−1 пропущенных → ничья A : A, доп. время проиграно.
    const e = (p: string, a: number) => (p === 'half1' ? (a === 0 ? c : 0) : p === 'half2' ? (a === 0 ? 0 : c) : p === 'extra' ? c : 0);
    let r = toBreak(begin(cfg), e);
    expect(seeds).toEqual([]);
    r = act(r, { type: 'toSecondHalf', now: 5, seed: 8 });
    expect(seeds).toEqual([8]);
    r = drive(r, (s) => s.phase === 'kick', e);
    r = act(r, { type: 'kickAnswer', result: 'missed' });
    r = drive(r, (s) => s.phase === 'result', e);
    expect(finishOf(r)[0]!.result.offer?.options).toEqual(['replay2']);
    r = act(r, { type: 'choose', offer: 'replay2', seed: 99, now: 9 });
    expect(seeds).toEqual([8, 99]);
    r = drive(r, (s) => s.phase === 'kick');
    expect(kinds(r, 'kick')[0]).toMatchObject({ taskId: 'task-8' });
    expect(r.s.kick?.taskId).toBe('task-99');
  });

  it('повторный вход с reason replay берёт новое зерно и новые тексты; begin помечен resumed', () => {
    // Ловит: тот же сид (те же тексты) после провала, потерянный признак повторного входа, break — зерно прежнее.
    const lost2 = (p: string) => (p === 'half2' || p === 'extra' ? c : 0);
    const r = drive(through(begin(cfgOf(small)), lost2), (s) => s.phase === 'result', lost2);
    const pending = finishOf(r)[0]!.pending!;
    const e = entryFor(pending, lesson.id);
    // F5 на итоге поражения до «Переиграть тайм» — «Продолжить 2-й тайм (a:b)», как после его нажатия (017-Т9в).
    expect(e.kind).toBe('continue2');
    const seeds: number[] = [];
    const texts: MatchTexts = { ...textsOf(small), half: (seed) => (seeds.push(seed), lesson.attacks.map(() => word(6))) };
    const back = initMatch(cfgOf(small, { texts }), { seed: 50, fails: 1, entry: e });
    expect(back).toMatchObject({ seed: 50, replay: true, resumed: true });
    expect(matchView(back)).toMatchObject({ replay: true, banner: 'continue2' });
    const go = next(back, { type: 'toSecondHalf', now: 3 });
    expect(seeds).toEqual([50]);
    expect(go.effects[0]).toMatchObject({ kind: 'begin', resumed: true, replay: true, seed: 50 });
    expect(pending.seed).not.toBe(50);
  });
});

describe('задержки экрана (017-Р27)', () => {
  it('защитная пауза: закрыта до срока, открыта ровно в срок и после', () => {
    // Ловит: Enter/Пробел, принятые сразу после последнего знака, и пропуск границы (срок включается на границе).
    const ms = screenDelay.breakMs;
    expect(guardOpen(1000, 1000, ms)).toBe(false);
    expect(guardOpen(1000, 1000 + ms - 1, ms)).toBe(false);
    expect(guardOpen(1000, 1000 + ms, ms)).toBe(true);
    expect(screenDelay).toMatchObject({ shotMs: 1400 });
    expect(screenDelay.resultMs).toBeGreaterThan(0);
  });

  it('поле с ударом держится только перед итогом сразу после печатной атаки', () => {
    // Ловит: задержку там, где ребёнок уже видел итог (после пенальти, минуты тренера, открытый итог) и её отсутствие после атаки.
    expect(holdsResult('half2', 'result')).toBe(true);
    expect(holdsResult('extra', 'result')).toBe(true);
    expect(holdsResult('kick', 'result')).toBe(false);
    expect(holdsResult('coach', 'result')).toBe(false);
    expect(holdsResult(undefined, 'result')).toBe(false);
    expect(holdsResult('half2', 'extra')).toBe(false);
  });
});

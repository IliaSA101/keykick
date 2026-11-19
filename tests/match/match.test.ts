/**
 * Матч — чистый редьюсер (060-Т9б, К27–К28): исходы атаки на границах порогов, фазы, ничья → доп. время,
 * итог и переигровка, пауза; переигровка по семени и записи нажатий бит в бит (059 С-24, С-25).
 * Игрок в тестах — `playAttack`: набирает текущую атаку с заданным числом ошибок и возвращает записанные события.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, dictionary, keymap } from '../course/yard';
import { createRandom, randomInt } from '../../src/engine/random';
import { idleMatch, replay, replayWithEffects, snapshotRules, starsOf, step } from '../../src/engine/match';
import type { Effect, KeyEvent, MatchEvent, MatchRules, MatchState, Outcome, PenaltyAnswer, RunningMatch, StartEvent } from '../../src/engine/match';
import { expectedHit } from '../../src/engine/typing/typing';
import type { CourseLesson } from '../../src/engine/plan/lesson';
import { planLesson } from '../../src/engine/plan';

const friendly = courseLessons.find((l) => l.friendly)!;
const serious = courseLessons.find((l) => !l.friendly)!;
const N = serious.attacks.length;

const startOf = (lesson: CourseLesson, rules: Partial<MatchRules> = {}, seed = 7): StartEvent => ({ type: 'start', seed, rules, lesson, dict: dictionary, keymap });
const running = (s: MatchState): RunningMatch => {
  if (s.phase === 'idle') throw new Error('матч не начат');
  return s;
};

/** Стенд: состояние, время и записанные события; события гонят `feed`, игрок — `play`. */
class Bench {
  state: MatchState = idleMatch;
  events: MatchEvent[] = [];
  effects: Effect[] = [];
  t = 1000;
  constructor(readonly start: StartEvent) {
    this.state = this.feed(start, false);
  }
  feed(event: MatchEvent, record = true): MatchState {
    const out = step(this.state, event);
    this.state = out.state;
    this.effects.push(...out.effects);
    if (record) this.events.push(event);
    return out.state;
  }
  /** Атака, на которой стоим, — набрана с `errors` ошибками (после первого верного знака: первая ошибка тайма прощается). */
  play(errors: number, gap = 150): void {
    // Пенальти (К1, ТЗ-2.7) этот стенд пропускает «Не бить»: счёт печатью проверяют остальные тесты.
    this.skipPenalty();
    const s0 = running(this.state);
    const at = s0.at;
    let left = errors;
    let typedOk = false;
    for (;;) {
      const s = running(this.state);
      if (s.typing === null || s.at !== at || s.phase === 'result') return;
      const miss = left > 0 && typedOk;
      const hit = expectedHit(keymap, s.typing);
      const ev: KeyEvent = miss
        ? { type: 'key', code: '', key: '§', t: this.t }
        : { type: 'key', code: hit?.key.code ?? '', key: s.typing.text[s.typing.pos] ?? '', t: this.t };
      this.t += gap;
      if (miss) left -= 1;
      else typedOk = true;
      this.feed(ev);
    }
  }
  /** Ответ стенда на пенальти: по умолчанию «Не бить». */
  penaltyAnswer: PenaltyAnswer = 'skip';
  /** Пенальти, если предложено, — ответ стенда. */
  skipPenalty(): void {
    if (running(this.state).phase === 'penalty') this.feed({ type: 'penalty', t: this.t, answer: this.penaltyAnswer });
  }
  /** Перерыв — до конца (Enter «Второй тайм» через `breakMs`, 065-Р4). */
  endBreak(): void {
    const s = running(this.state);
    this.t = (s.breakAt ?? this.t) + s.rules.breakMs;
    this.feed({ type: 'half2', t: this.t });
  }
  /** Весь матч: ошибки атаки — от `errorsOf(фаза, номер)`; перерыв проходит сам. */
  playAll(errorsOf: (phase: string, index: number) => number): void {
    for (;;) {
      this.skipPenalty();
      const s = running(this.state);
      if (s.phase === 'result') return;
      if (s.phase === 'break') this.endBreak();
      else this.play(errorsOf(s.plan[s.at]!.phase, s.plan[s.at]!.index));
    }
  }
}

/** Бенч, дошедший до первой атаки тайма 1 (разминка пройдена чисто). */
function atHalf1(rules: Partial<MatchRules> = {}, lesson = serious): Bench {
  const b = new Bench(startOf(lesson, rules));
  while (running(b.state).phase === 'warmup') b.play(0);
  return b;
}

/** Исход первой атаки тайма 1 при `errors` ошибках и правилах `rules`. */
function outcomeFor(errors: number, rules: Partial<MatchRules> = {}): Outcome | null {
  const b = atHalf1(rules);
  b.play(errors);
  return running(b.state).log.find((l) => l.phase === 'half1')?.outcome ?? null;
}

describe('К27: исход атаки по ошибкам', () => {
  it('К27: правило по умолчанию (ТЗ-2.23): 0 — гол, 1 и 2 — сейв, 3 и больше — гол соперника', () => {
    // Ловит: сдвиг границ (≤ вместо <, 2 вместо 3), перепутанные исходы, потерю правила по умолчанию.
    expect([0, 1, 2, 3, 4, 7].map((e) => outcomeFor(e))).toEqual(['goal', 'save', 'save', 'concede', 'concede', 'concede']);
  });

  it('К27: порог берётся из правил, а не константа: goalMax 1 и concedeMin 4 — границы сдвигаются', () => {
    // Ловит: пороги 0 и 3, зашитые в код (ТЗ-2.23, ТЗ-10.12: родитель меняет пороги).
    expect([0, 1, 2, 3, 4].map((e) => outcomeFor(e, { goalMax: 1, concedeMin: 4 }))).toEqual(['goal', 'goal', 'save', 'save', 'concede']);
    expect([0, 1, 2].map((e) => outcomeFor(e, { goalMax: 0, concedeMin: 2 }))).toEqual(['goal', 'save', 'concede']);
  });

  it('К27: правила снимаются на start: правка объекта правил посреди матча матч не меняет (059 С-25)', () => {
    // Ловит: ссылку на живой объект настроек вместо снимка.
    const rules: MatchRules = { goalMax: 0, concedeMin: 3, breakMs: 5000 };
    const b = new Bench(startOf(serious, rules));
    while (running(b.state).phase === 'warmup') b.play(0);
    rules.concedeMin = 1;
    rules.goalMax = 5;
    b.play(1);
    expect(running(b.state).log.at(-1)?.outcome).toBe('save');
    expect(running(b.state).rules).toEqual({ goalMax: 0, concedeMin: 3, breakMs: 5000 });
  });

  it('К27: порог гола соперника всегда выше порога гола; дробное и отрицательное — к целому', () => {
    // Ловит: настройку, при которой «≤ g» и «≥ c» пересекаются (сейва между ними нет) или падает в минус.
    expect(snapshotRules({ goalMax: 2, concedeMin: 1 })).toMatchObject({ goalMax: 2, concedeMin: 3 });
    expect(snapshotRules({ goalMax: -1, concedeMin: 2.9, breakMs: -5 })).toEqual({ goalMax: 0, concedeMin: 2, breakMs: 0 });
    expect(snapshotRules({})).toEqual({ goalMax: 0, concedeMin: 3, breakMs: 5000 });
    expect(outcomeFor(2, { goalMax: 2, concedeMin: 1 })).toBe('goal');
  });

  it('К27: ошибки считаются по всей атаке (все её строки), а не по последней строке', () => {
    // Ловит: счёт ошибок только последней строки многострочной атаки.
    const lesson = courseLessons.find((l) => planLesson(l, dictionary, keymap, 7).some((x) => x.phase === 'half1' && x.rows.length > 1))!;
    const b = atHalf1({}, lesson);
    while (running(b.state).plan[running(b.state).at]!.rows.length < 2) b.play(0);
    const at = running(b.state).at;
    b.play(2);
    expect(running(b.state).log.at(-1)).toMatchObject({ phase: 'half1', index: running(b.state).plan[at]!.index, errors: 2, outcome: 'save' });
  });

  it('К27: разминка без счёта: её ошибки в счёт не идут, исхода нет, но попадают в статистику', () => {
    // Ловит: гол или гол соперника за удар разминки (ТЗ-2.3); потерю ошибок разминки в подстройке.
    const b = new Bench(startOf(serious));
    b.play(5);
    const s = running(b.state);
    expect(s.score).toEqual({ me: 0, opp: 0 });
    expect(s.log[0]).toMatchObject({ phase: 'warmup', index: 0, errors: 5, outcome: null });
    expect(s.stats.errors).toBe(5);
  });

  it('ТЗ-2.11: разминка без счёта — её ошибки не идут ни в счёт, ни в точность итога, ни в звёзды', () => {
    // Ловит: ошибки разминки в `play` итога (точность, звёзды) — возврат после паузы начинается с разминки (ТЗ-2.3, 2.11).
    const run = (warmErrors: number): RunningMatch => {
      const b = new Bench(startOf(serious));
      b.playAll((phase) => (phase === 'warmup' ? warmErrors : 0));
      return running(b.state);
    };
    const clean = run(0);
    const sloppy = run(4);
    expect(sloppy.stats.errors).toBeGreaterThan(clean.stats.errors); // в статистику (подстройку) ошибки разминки идут
    expect(sloppy.result?.score).toEqual(clean.result?.score);
    expect(sloppy.result?.play.errors).toBe(clean.result?.play.errors);
    expect(starsOf(sloppy.result!, {})).toBe(starsOf(clean.result!, {}));
  });

  it('К27: фазы по порядку, N атак в таймах; чистый матч — победа без доп. времени', () => {
    // Ловит: пропущенную или лишнюю фазу, число атак не из контента, доп. время при победе.
    const b = new Bench(startOf(serious));
    const seen: string[] = [];
    while (running(b.state).phase !== 'result') {
      const phase = running(b.state).phase;
      if (seen.at(-1) !== phase) seen.push(phase);
      if (phase === 'break') b.endBreak();
      else b.play(0);
    }
    // Пенальти — одно, после первой чистой атаки 2-го тайма (К1, ТЗ-2.7): тайм прерывается один раз.
    expect(seen).toEqual(['warmup', 'half1', 'break', 'half2', 'penalty', 'half2']);
    const r = running(b.state);
    expect(r.result).toMatchObject({ verdict: 'win', replay: null, score: { me: 2 * N, opp: 0 }, half1: { me: N, opp: 0 }, half2: { me: N, opp: 0 } });
    expect(r.log.filter((l) => l.phase === 'half1')).toHaveLength(N);
    expect(r.log.filter((l) => l.phase === 'half2')).toHaveLength(N);
    expect(r.log.some((l) => l.phase === 'extra')).toBe(false);
  });

  it('К27: перерыв кончается по half2 не раньше breakMs; нажатия в перерыве мимо', () => {
    // Ловит: перерыв без таймера, перерыв, который съедает нажатия или не кончается; сдвиг начала 2-го тайма.
    const b = atHalf1({ breakMs: 3000 });
    for (let i = 0; i < N; i++) b.play(0);
    let s = running(b.state);
    expect(s.phase).toBe('break');
    expect(s.half1).toEqual({ me: N, opp: 0 });
    const at = s.breakAt!;
    b.feed({ type: 'key', code: 'KeyA', key: 'а', t: at + 100 });
    b.feed({ type: 'half2', t: at + 2999 });
    expect(running(b.state).phase).toBe('break');
    b.feed({ type: 'tick', t: at + 9000 });
    expect(running(b.state).phase).toBe('break');
    b.feed({ type: 'half2', t: at + 3000 });
    s = running(b.state);
    expect(s.phase).toBe('half2');
    expect(s.plan[s.at]).toMatchObject({ phase: 'half2', index: 0 });
    expect(s.typing?.pos).toBe(0);
  });

  it('К27: ничья после 2-го тайма — доп. время: одна атака; гол — победа', () => {
    // Ловит: матч, кончающийся вничью без доп. атаки (ТЗ-2.5); доп. атаку, которая не меняет итог.
    const b = new Bench(startOf(serious));
    while (running(b.state).phase === 'warmup') b.play(0);
    b.playAll((phase) => (phase === 'extra' ? 0 : 1)); // везде сейв: 0:0
    const r = running(b.state);
    expect(r.log.filter((l) => l.phase === 'extra')).toHaveLength(1);
    expect(r.half1).toEqual({ me: 0, opp: 0 });
    expect(r.result).toMatchObject({ verdict: 'win', score: { me: 1, opp: 0 }, extra: { me: 1, opp: 0 }, replay: null });
  });

  it('К27: флаг extra: false (матч группы Кубка) — ничья кончается без доп. времени, по умолчанию доп. время есть', () => {
    // Ловит: доп. время в группе (ТЗ-8.5, 068-Р3); флаг, который ломает обычный матч.
    const group = new Bench({ ...startOf(serious), extra: false });
    group.playAll(() => 1);
    const g = running(group.state);
    expect(g.log.filter((l) => l.phase === 'extra')).toHaveLength(0);
    expect(g.result).toMatchObject({ verdict: 'draw', extra: { me: 0, opp: 0 } });
    const normal = new Bench(startOf(serious));
    normal.playAll(() => 1);
    expect(running(normal.state).log.filter((l) => l.phase === 'extra')).toHaveLength(1);
  });

  it('К27: доп. время без гола — переигровка: сейв — ничья, гол соперника — поражение; 1-й тайм не проигран → переигрывается 2-й', () => {
    // Ловит: победу или зачёт без гола в доп. время; «оба тайма» вместо «2-й» при не проигранном 1-м (ТЗ-2.8).
    const draw = new Bench(startOf(serious));
    draw.playAll(() => 1);
    expect(running(draw.state).result).toMatchObject({ verdict: 'draw', replay: 'half2', counted: false, extra: { me: 0, opp: 0 } });
    const loss = new Bench(startOf(serious));
    loss.playAll((phase) => (phase === 'extra' ? 3 : 1));
    expect(running(loss.state).result).toMatchObject({ verdict: 'loss', replay: 'half2', score: { me: 0, opp: 1 } });
  });

  it('К27: поражение при проигранном 1-м тайме — переигровка обоих; 1-й вничью или выигран — только 2-й', () => {
    // Ловит: путаницу в правиле «какой тайм переигрывать» (ТЗ-2.8), потерю счёта 1-го тайма.
    const lostFirst = new Bench(startOf(serious));
    lostFirst.playAll((phase) => (phase === 'half1' ? 3 : 1));
    expect(running(lostFirst.state).result).toMatchObject({ verdict: 'loss', replay: 'both', half1: { me: 0, opp: N } });
    const wonFirst = new Bench(startOf(serious));
    wonFirst.playAll((phase) => (phase === 'half1' ? 0 : phase === 'half2' ? 3 : 1));
    expect(running(wonFirst.state).result).toMatchObject({ verdict: 'draw', replay: 'half2', half1: { me: N, opp: 0 }, half2: { me: 0, opp: N } });
  });

  it('К27: товарищеский засчитывается и при поражении, обычный урок — только победой (ТЗ-2.4)', () => {
    // Ловит: незасчитанный товарищеский матч; засчитанное поражение.
    const lose = (lesson: CourseLesson): RunningMatch => {
      const b = new Bench(startOf(lesson));
      b.playAll((phase) => (phase === 'warmup' ? 0 : 3));
      return running(b.state);
    };
    expect(lose(friendly).result).toMatchObject({ verdict: 'loss', counted: true });
    expect(lose(serious).result).toMatchObject({ verdict: 'loss', counted: false });
  });

  it('К27: эффекты: гол и гол соперника, сейв — звук без гола, факты атак, подсказка раскладки', () => {
    // Ловит: молчащие эффекты (награды и звук Э1 слушают их), гол за сейв, потерю подсказки тренера.
    const b = atHalf1();
    b.effects = [];
    b.play(0);
    b.play(1);
    b.play(3);
    const goals = b.effects.filter((e) => e.kind === 'goal');
    expect(goals).toEqual([
      { kind: 'goal', side: 'me', phase: 'half1', index: 0 },
      { kind: 'goal', side: 'opp', phase: 'half1', index: 2 },
    ]);
    const sounds = b.effects.filter((e) => e.kind === 'sound' && e.sound !== 'key' && e.sound !== 'miss');
    expect(sounds).toEqual([
      { kind: 'sound', sound: 'goal' },
      { kind: 'sound', sound: 'save' },
      { kind: 'sound', sound: 'concede' },
    ]);
    expect(b.effects.filter((e) => e.kind === 'fact' && e.fact.fact === 'attack').map((e) => e.kind === 'fact' && e.fact.fact === 'attack' && e.fact.outcome)).toEqual(['goal', 'save', 'concede']);
    b.effects = [];
    b.feed({ type: 'key', code: 'Numpad1', key: '1', t: b.t });
    expect(b.effects).toEqual([{ kind: 'hint', hint: 'numpad' }]);
  });

  it('К27: итог — факт «match» и свисток; после итога события молчат, start начинает заново', () => {
    // Ловит: итог без факта для наград; события после итога, меняющие результат.
    const b = new Bench(startOf(serious));
    b.playAll(() => 0);
    expect(b.effects.at(-1)).toEqual({ kind: 'fact', fact: { fact: 'match', verdict: 'win', replay: null } });
    const done = b.state;
    expect(step(done, { type: 'key', code: 'KeyA', key: 'а', t: 1 }).state).toBe(done);
    expect(step(done, { type: 'tick', t: 1 }).state).toBe(done);
    expect(step(idleMatch, { type: 'pause' }).state).toBe(idleMatch);
    expect(running(step(done, startOf(serious)).state).phase).toBe('warmup');
  });
});

describe('К28: переигровка матча по семени и нажатиям', () => {
  /** Игра с шумом: ошибки по семени, пауза посреди атаки, перерыв, доп. время. */
  function noisyMatch(seed: number, withPause: boolean): Bench {
    const rnd = createRandom(seed + 1);
    const b = new Bench(startOf(serious, {}, seed));
    let paused = !withPause;
    while (running(b.state).phase !== 'result') {
      const s = running(b.state);
      if (s.phase === 'break') b.endBreak();
      else {
        const errors = [0, 0, 1, 3][randomInt(rnd, 4)]!;
        if (!paused && s.phase === 'half1') {
          // Пауза посреди атаки: несколько знаков, пауза, нажатия мимо, долгий простой, дальше.
          paused = true;
          for (let i = 0; i < 3; i++) {
            const hit = expectedHit(keymap, running(b.state).typing!);
            b.feed({ type: 'key', code: hit?.key.code ?? '', key: running(b.state).typing!.text[running(b.state).typing!.pos] ?? '', t: b.t });
            b.t += 150;
          }
          b.feed({ type: 'pause' });
          b.feed({ type: 'key', code: 'KeyA', key: 'а', t: b.t + 10 });
          b.feed({ type: 'tick', t: b.t + 20 });
          b.t += 60_000;
          b.feed({ type: 'resume' });
        }
        b.play(errors);
      }
    }
    return b;
  }

  it('К28: replay(start, события) = финальное состояние живой игры бит в бит; эффекты те же', () => {
    // Ловит: недетерминизм редьюсера (часы, случайность, порядок обхода), разницу между живой игрой и записью.
    for (const withPause of [false, true]) {
      const b = noisyMatch(11, withPause);
      const again = replayWithEffects(b.start, b.events);
      expect(again.state).toEqual(b.state);
      expect(again.effects).toEqual(b.effects);
      expect(replay(b.start, b.events)).toEqual(b.state);
    }
  });

  it('К28: запись переживает JSON (журнал на диске): тот же результат и журнал атак', () => {
    // Ловит: события с неподдающимися записи полями (функции, Date, Map), на которых журнал сына не переиграть.
    const b = noisyMatch(5, true);
    const events = JSON.parse(JSON.stringify(b.events)) as MatchEvent[];
    // Карта клавиатуры и словарь — содержимое сборки, в журнал не пишутся: в записи только семя, правила и урок.
    const start = { ...(JSON.parse(JSON.stringify({ ...b.start, keymap: null, dict: null })) as StartEvent), keymap, dict: dictionary };
    const s = replay(start, events);
    expect(running(s).result).toEqual(running(b.state).result);
    expect(running(s).log).toEqual(running(b.state).log);
    expect(running(s).plan).toEqual(running(b.state).plan);
  });

  it('К28: итог зависит от семени и нажатий: другое семя — другой план, другая запись — другой счёт', () => {
    // Ловит: игнор семени (одинаковый план при любом) и игнор нажатий (счёт не зависит от ошибок).
    const a = noisyMatch(11, true);
    const other = running(replay({ ...a.start, seed: 12 }, []));
    expect(other.plan.map((x) => x.rows)).not.toEqual(running(a.state).plan.map((x) => x.rows));
    const clean = new Bench(startOf(serious, {}, 11));
    clean.playAll(() => 0);
    expect(running(clean.state).result?.score).not.toEqual(running(a.state).result?.score);
  });

  it('К28: пауза посреди атаки не меняет счёт и не даёт промежутка в темп: интервалы те же, что без паузы, кроме одного', () => {
    // Ловит: паузу, попавшую в промежутки между нажатиями (темп, ровность, секундомер тайма).
    const plain = new Bench(startOf(serious, {}, 3));
    plain.playAll(() => 0);
    const paused = new Bench(startOf(serious, {}, 3));
    const type = (): void => {
      const typing = running(paused.state).typing!;
      paused.feed({ type: 'key', code: expectedHit(keymap, typing)!.key.code, key: typing.text[typing.pos]!, t: paused.t });
      paused.t += 150;
    };
    for (let i = 0; i < 4; i++) type();
    paused.feed({ type: 'pause' });
    paused.t += 60_000;
    paused.feed({ type: 'resume' });
    paused.playAll(() => 0);
    const want = [...running(plain.state).stats.intervals];
    want.splice(3, 1); // промежуток через паузу (между 4-м и 5-м знаком) не засчитан
    expect(running(paused.state).stats.intervals).toEqual(want);
    expect(running(paused.state).result?.score).toEqual(running(plain.state).result?.score);
  });

  it('К28: на паузе нажатия и tick мимо; перерыв при паузе не тикает, а после resume досиживает остаток', () => {
    // Ловит: ввод на паузе (счёт ползёт за кадром), перерыв, который кончается во время паузы.
    const b = atHalf1({ breakMs: 4000 });
    b.feed({ type: 'pause' });
    const before = b.state;
    b.feed({ type: 'key', code: 'KeyA', key: 'а', t: b.t });
    expect(b.state).toBe(before);
    b.feed({ type: 'resume' });
    for (let i = 0; i < N; i++) b.play(0);
    const at = running(b.state).breakAt!;
    b.feed({ type: 'tick', t: at + 1000 });
    b.feed({ type: 'pause' });
    b.feed({ type: 'tick', t: at + 90_000 });
    expect(running(b.state).phase).toBe('break');
    b.feed({ type: 'resume' });
    b.feed({ type: 'half2', t: at + 91_000 }); // пауза (90 с) вычтена: от начала перерыва прошла 1 с, а не 91
    expect(running(b.state).phase).toBe('break');
    b.feed({ type: 'half2', t: at + 90_000 + 3999 });
    expect(running(b.state).phase).toBe('break');
    b.feed({ type: 'half2', t: at + 90_000 + 4000 });
    expect(running(b.state).phase).toBe('half2');
  });
});

/** Матч, где в 1-м тайме все атаки — сейвы, а во 2-м: первая чистая, вторая — гол соперника, остальные сейвы: печать 1:1. */
function playOneAll(answer: PenaltyAnswer): Bench {
  const b = new Bench(startOf(serious));
  b.penaltyAnswer = answer;
  b.playAll((phase, index) => (phase === 'half2' ? (index === 0 ? 0 : index === 1 ? 3 : 1) : phase === 'half1' ? 1 : 0));
  return b;
}

describe('К1: пенальти (ТЗ-2.7, 2.6)', () => {
  it('К1: предлагается один раз — после первой чистой атаки 2-го тайма; в 1-м тайме и после нечистых — нет', () => {
    // Ловит: пенальти в 1-м тайме, до чистой атаки, повторное предложение (М2).
    const b = atHalf1();
    b.play(0);
    expect(running(b.state).phase).not.toBe('penalty');
    for (let i = 1; i < N; i++) b.play(1);
    b.endBreak();
    b.play(1);
    expect(b.effects.filter((e) => e.kind === 'penalty')).toHaveLength(0);
    b.play(0);
    expect(running(b.state).phase).toBe('penalty');
    expect(b.effects.filter((e) => e.kind === 'penalty')).toHaveLength(1);
    b.feed({ type: 'penalty', t: b.t, answer: 'skip' });
    b.play(0);
    expect(b.effects.filter((e) => e.kind === 'penalty')).toHaveLength(1);
  });

  it('К1: ответ вне фазы пенальти не действует; печать под пенальти молчит (М1, М2)', () => {
    const b = atHalf1();
    const before = b.state;
    expect(step(before, { type: 'penalty', t: 5, answer: 'hit' }).state).toBe(before);
    expect(step(before, { type: 'half2', t: 1e9 }).state).toBe(before);
    for (let i = 0; i < N; i++) b.play(1);
    b.endBreak();
    b.play(0);
    const at = b.state;
    expect(running(at).phase).toBe('penalty');
    expect(step(at, { type: 'key', code: 'KeyA', key: 'а', t: b.t }).state).toBe(at);
  });

  it('К1: «hit» — гол в общий счёт, не в печать; «miss» и «skip» — без гола; монеты матч не считает (0)', () => {
    // Ловит: гол пенальти в счёт печати (звёзды), гол за «Не бить», потерю гола.
    const hit = running(playOneAll('hit').state).result!;
    expect(hit.penalty).toEqual({ offered: true, scored: true });
    expect(hit.total.me).toBe(hit.score.me + 1);
    expect(hit.score).toEqual({ me: 1, opp: 1 });
    expect(hit.verdict).toBe('win');
    for (const a of ['miss', 'skip'] as const) {
      const r = running(playOneAll(a).state).result!;
      expect(r.penalty).toEqual({ offered: true, scored: false });
      expect(r.total).toEqual(r.score);
    }
  });

  it('К1: 1:1 печатью + пенальти = 2:1 — пройден (победа), звёзд 0; без гола — доп. время', () => {
    // Ловит: звезду за победу с пенальти (М4, ТЗ-2.6).
    const r = running(playOneAll('hit').state).result!;
    expect(r.total).toEqual({ me: 2, opp: 1 });
    expect(r.counted).toBe(true);
    expect(starsOf(r)).toBe(0);
    expect(running(playOneAll('skip').state).log.some((l) => l.phase === 'extra')).toBe(true);
  });

  it('К1: replay с событиями пенальти и half2 даёт то же состояние (журнал матча)', () => {
    const b = playOneAll('hit');
    expect(replay(b.start, b.events)).toEqual(b.state);
  });
});

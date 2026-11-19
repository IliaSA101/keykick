/**
 * Экран матча без браузера (065 Т9): окна поверх (М1, М5), запись только после свистка (М3), повтор свистка, эффекты → звук.
 * Ход матча — настоящий редьюсер движка; игрок набирает атаки верно.
 */
import { describe, expect, it } from 'vitest';
import { courseLessons, dictionary } from '../course/yard';
import { albumDef } from '../../src/engine/album/section';
import { dayDef } from '../../src/engine/day/section';
import { formDef } from '../../src/engine/form/section';
import { stadiumDef } from '../../src/engine/home/section';
import { ruCourseDef } from '../../src/engine/course/section';
import { walletDef } from '../../src/engine/rewards/section';
import { schoolDef } from '../../src/engine/school/section';
import { emptyStory, type Story } from '../../src/engine/story/section';
import { addAcc, playedMatch } from '../../src/engine/day/section';
import { coachDef } from '../../src/engine/coach/section';
import type { MatchEvent, MatchSave, RunningMatch } from '../../src/engine/match';
import { expectedHit } from '../../src/engine/typing/typing';
import { keymap } from '../../src/engine/typing/layouts';
import { attacksText, viewOf } from '../../src/screens/match/view';
import { shownOf } from '../../src/app/match/effects';
import { finishRun, type FinishDeps } from '../../src/app/match/finish';
import { putFinished, takeFinished } from '../../src/app/match/handoff';
import { buildStart, comebackLesson, feed, hold, keyEventOf, release, startRun, sync, ui, type Run } from '../../src/app/match/run';
import { openPenalty, skipPenalty, submitPenalty, typeInto } from '../../src/app/match/penaltyFlow';
import { tasks } from '../../src/app/school/tasks';
import { correctInput } from '../../src/engine/school/answers';

const lesson = courseLessons.find((l) => !l.friendly)!;
const fresh = (): Run => startRun(buildStart(lesson, 7, dictionary)).run;
const empty = (): MatchSave => ({ course: ruCourseDef.empty(), wallet: walletDef.empty(), day: dayDef.empty(), school: schoolDef.empty(), form: formDef.empty(), coach: coachDef.empty(), stadium: stadiumDef.empty(), album: albumDef.empty() });
const typing = (r: Run): RunningMatch => {
  if (r.state.phase === 'idle') throw new Error('матч не начат');
  return r.state;
};

/** Верная печать до свистка: перерыв — «Второй тайм», пенальти — «Не бить». */
function playToWhistle(r0: Run): Run {
  let r = r0;
  let t = 1000;
  for (let i = 0; i < 5000 && r.state.phase !== 'result'; i++) {
    const s = typing(r);
    t += 150;
    if (s.phase === 'break') r = feed(r, { type: 'half2', t: t + 6000 }).run;
    else if (s.phase === 'penalty') r = feed(r, { type: 'penalty', t, answer: 'skip' }).run;
    else if (s.typing) r = feed(r, { type: 'key', code: expectedHit(keymap, s.typing)?.key.code ?? '', key: s.typing.text[s.typing.pos] ?? '', t }).run;
  }
  return r;
}

describe('К-Т9: окна поверх матча', () => {
  it('К-Т9 М1: пока открыта пауза, печать не идёт и запись событий не растёт', () => {
    // Ловит: нажатия, прошедшие сквозь окно паузы, справки или выхода.
    const r0 = sync(fresh(), ui(fresh(), 'pause'), 1000);
    const s = typing(r0);
    expect(s.paused).toBe(true);
    const hit = expectedHit(keymap, s.typing!)!;
    const r1 = feed(r0, { type: 'key', code: hit.key.code, key: s.typing!.text[0] ?? '', t: 1100 }).run;
    expect(r1.events.length).toBe(0);
    expect(typing(r1).typing).toEqual(s.typing);
  });

  it('К-Т9 М5: окно одно — справка поверх паузы заменяет её, Esc возвращает в паузу, второй Esc — в матч', () => {
    // Ловит: два окна сразу, Esc из справки, закрывающий всё разом, холостое «пауза» поверх паузы.
    const a = ui(fresh(), 'pause');
    expect(a.overlay).toBe('pause');
    expect(ui(a, 'pause')).toBe(a);
    const b = ui(a, 'help');
    expect(b.overlay).toBe('help');
    expect(ui(b, 'quit').overlay).toBe('quit');
    const back = ui(b, 'esc');
    expect(back.overlay).toBe('pause');
    expect(ui(back, 'esc').overlay).toBe('none');
    expect(ui(fresh(), 'esc').overlay).toBe('pause');
  });

  it('К-Т9: окно закрылось — матч продолжается, запись событий пауз не содержит', () => {
    // Ловит: пауза, оставшаяся в движке после закрытия окна.
    const open = sync(fresh(), ui(fresh(), 'pause'), 1000);
    const shut = sync(open, ui(open, 'esc'), 2000);
    expect(typing(shut).paused).toBe(false);
    expect(shut.events).toEqual([]);
  });
});

describe('К-Т9: свисток → сохранение и журнал (М3, повтор)', () => {
  const deps = (): { d: FinishDeps; saves: Record<string, unknown>[]; puts: string[] } => {
    let cur = empty();
    const saves: Record<string, unknown>[] = [];
    const puts: string[] = [];
    return {
      saves,
      puts,
      d: {
        read: () => cur,
        save: (patch) => {
          saves.push(patch);
          cur = { course: patch['course:ru'] as MatchSave['course'], wallet: patch.wallet as MatchSave['wallet'], day: patch.day as MatchSave['day'], school: patch.school as MatchSave['school'], form: patch.form as MatchSave['form'], coach: patch.coach as MatchSave['coach'], stadium: patch.stadium as MatchSave['stadium'], album: patch.album as MatchSave['album'] };
          return { ok: true };
        },
        journal: { put: (id) => (puts.push(id), Promise.resolve()) },
      },
    };
  };
  const ctx = (matchId: string) => ({ now: 1_000_000, day: '2026-11-18', lessonId: lesson.id, matchId });

  it('К-Т9 М3: до свистка ничего не пишется — ни сохранение, ни журнал', () => {
    // Ловит: запись брошенного матча (F5 посреди игры, «Выйти»).
    const x = deps();
    expect(finishRun(fresh(), ctx('m1'), x.d)).toEqual({ kind: 'none' });
    expect(x.saves).toEqual([]);
    expect(x.puts).toEqual([]);
  });

  it('К-Т9: свисток пишет один раз; повтор того же matchId (двойной Enter, F5 на итоге) — без второй награды', () => {
    // Ловит: двойную награду и двойную запись журнала при повторе свистка.
    const x = deps();
    const r = playToWhistle(fresh());
    const first = finishRun(r, ctx('m1'), x.d);
    expect(first.kind).toBe('done');
    const again = finishRun(r, ctx('m1'), x.d);
    expect(again).toEqual({ kind: 'repeat' });
    expect(x.saves.length).toBe(1);
    expect(x.puts).toEqual(['m1']);
  });
});

describe('К5 (067 Т24): раздел coach из свистка', () => {
  it('К5: окна букв — из нажатий матча без разминки; повтор того же matchId окна не растит', () => {
    // Ловит: разминка попадает в «трудные клавиши» (там много промахов новичка) и двойной Enter удваивает окно.
    let cur = empty();
    const d: FinishDeps = {
      read: () => cur,
      save: (patch) => ((cur = { ...cur, ...(patch as Partial<MatchSave>), course: patch['course:ru'] as MatchSave['course'] }), { ok: true }),
      journal: { put: () => Promise.resolve() },
    };
    const run = playToWhistle(fresh());
    const result = typing(run).result!;
    const c = { now: 1_000_000, day: '2026-11-18', lessonId: lesson.id, matchId: 'm-k5' };
    expect(finishRun(run, c, d).kind).toBe('done');
    const total = (): number => Object.values(cur.coach.keys).reduce((n, w) => n + w.length, 0);
    const letters = result.presses.filter((p) => /^\p{Ll}$/u.test(p.ch)).length;
    expect(total()).toBeLessThanOrEqual(letters);
    expect(total()).toBeGreaterThan(0);
    expect(result.presses.length).toBeLessThan(result.stats.correct + result.stats.errors);
    const once = total();
    expect(finishRun(run, c, d)).toEqual({ kind: 'repeat' });
    expect(total()).toBe(once);
  });
});

describe('К4 (067 Т17): свисток передаёт скорость в журнал', () => {
  it('К4: finishRun кладёт в журнал ту же скорость, что показывает итог', () => {
    // Ловит: `cpm` не доезжает до журнала — ставка учебных игр считается из пустого списка скоростей.
    const puts: { id: string; cpm: number | undefined }[] = [];
    const d: FinishDeps = {
      read: () => empty(),
      save: () => ({ ok: true }),
      journal: { put: (id, rec) => (puts.push({ id, cpm: rec.cpm }), Promise.resolve()) },
    };
    const done = finishRun(playToWhistle(fresh()), { now: 1_000_000, day: '2026-11-18', lessonId: lesson.id, matchId: 'm-p1-1' }, d);
    if (done.kind !== 'done') throw new Error('матч не записан');
    expect(done.view.cpm).toBeGreaterThan(0);
    expect(puts).toEqual([{ id: 'm-p1-1', cpm: done.view.cpm }]);
  });
});

describe('К-Т9: клавиши и эффекты', () => {
  it('К-Т9: Esc, Enter и Tab — не печать; Ctrl с буквой помечен мод-клавишей', () => {
    // Ловит: Enter или Esc, ушедшие в строку как ошибка.
    expect(keyEventOf({ code: 'Escape', key: 'Escape' }, 1)).toBeNull();
    expect(keyEventOf({ code: 'Enter', key: 'Enter' }, 1)).toBeNull();
    expect(keyEventOf({ code: 'Tab', key: 'Tab' }, 1)).toBeNull();
    const e = keyEventOf({ code: 'KeyA', key: 'ф', ctrlKey: true }, 5) as MatchEvent & { type: 'key' };
    expect(e).toMatchObject({ type: 'key', t: 5, mod: true });
  });

  it('К-Т9: гол — возглас и подпрыгивает наш счёт; «Без звука» гасит файлы, но не возглас', () => {
    // Ловит: звук при выключенном звуке; счёт соперника вместо нашего.
    const fx = [{ kind: 'sound', sound: 'goal' } as const, { kind: 'goal', side: 'me', phase: 'half1', index: 0 } as const];
    expect(shownOf(fx)).toMatchObject({ shout: 'goal', bump: 'us', sounds: ['goal.mp3'] });
    expect(shownOf(fx, { mute: true })).toMatchObject({ shout: 'goal', sounds: [] });
    expect(shownOf([{ kind: 'goal', side: 'opp', phase: 'half1', index: 1 }]).bump).toBe('rival');
    expect(shownOf([{ kind: 'penalty' }]).penalty).toBe(true);
  });
});

/** Верная печать до конца разминки; дальше — первая атака 1-го тайма. */
function afterWarmup(): { r: Run; t: number } {
  let r = fresh();
  let t = 1000;
  while (typing(r).phase === 'warmup') {
    const s = typing(r);
    t += 150;
    r = feed(r, { type: 'key', code: expectedHit(keymap, s.typing!)!.key.code, key: s.typing!.text[s.typing!.pos] ?? '', t }).run;
  }
  return { r, t };
}

describe('К-Т9б: что показывает экран', () => {
  it('К-Т9б Э1.02: разминка — «Разминка · без счёта», счёт 0 : 0, цель — клавиша первого знака', () => {
    // Ловит: счёт и подпись атаки в разминке; пропавшую цель в начале строки.
    const s = typing(fresh());
    const v = viewOf(s);
    expect(v).toMatchObject({ phase: 'Разминка', detail: 'без счёта', score: { me: 0, opp: 0 } });
    expect(v.target?.code).toBe(expectedHit(keymap, s.typing!)!.key.code);
    expect(v.balls).toEqual([false, false, false]);
  });

  it('К-Т9б Э1.03: в 1-м тайме «Атака N из M» и «Строка N из M» идут по плану, шарики гаснут по ошибкам', () => {
    // Ловит: номер атаки не с единицы; запас ошибок, не уменьшающийся после промаха.
    const { r, t } = afterWarmup();
    const s = typing(r);
    const v = viewOf(s);
    const of = s.plan.filter((a) => a.phase === 'half1').length;
    expect(v.phase).toBe('1-й тайм');
    expect(v.detail).toBe(`Атака 1 из ${of}`);
    expect(v.line).toEqual({ n: 1, of: s.plan[s.at]!.rows.length });
    const wrong = typing(feed(r, { type: 'key', code: 'KeyZ', key: 'я', t: t + 150 }).run);
    expect(viewOf(wrong).balls.filter(Boolean).length).toBe(wrong.typing!.lineErrors + wrong.attackErrors);
  });

  it('К-Т9б Э1.05: цель — пробел: палец — большой нужной руки', () => {
    // Ловит: «Бей пальцем» без пальца на пробеле.
    let { r, t } = afterWarmup();
    for (let i = 0; i < 500 && viewOf(typing(r)).target?.code !== 'Space'; i++) {
      const s = typing(r);
      t += 150;
      r = feed(r, { type: 'key', code: expectedHit(keymap, s.typing!)!.key.code, key: s.typing!.text[s.typing!.pos] ?? '', t }).run;
    }
    const v = viewOf(typing(r));
    expect(v.target?.code).toBe('Space');
    expect(v.target?.finger).toMatch(/большой$/);
  });
});

describe("К-Т9в: обмен итогом с экраном Т10", () => {
  it("К-Т9в: итог забирается один раз, повторный показ пуст", () => {
    // Ловит: итог, остающийся в обмене после показа (второй показ той же награды после возврата назад).
    putFinished({ kind: "repeat" });
    expect(takeFinished()).toEqual({ kind: "repeat" });
    expect(takeFinished()).toEqual({ kind: "none" });
  });
});

describe('К-Т9г: склонение «атака» во вступлении', () => {
  it('К-Т9г: 1 атака, 2–4 атаки, 5+ атак, 11–14 и 21 — по правилам русского', () => {
    expect(attacksText(1)).toBe('1 атака');
    expect([2, 3, 4].map(attacksText)).toEqual(['2 атаки', '3 атаки', '4 атаки']);
    expect([5, 11, 12, 14, 20].map(attacksText)).toEqual(['5 атак', '11 атак', '12 атак', '14 атак', '20 атак']);
    expect(attacksText(21)).toBe('21 атака');
  });
});

describe('К1: лист задачи пенальти — ход ответа', () => {
  const task = tasks.find((t) => t.id === 't-choice-table')!;
  const right = correctInput(task.answer);

  it('К1: верный ответ — hit, неверный — miss; «Не бить» — skip без штрафа', () => {
    // Ловит: перепутанные исходы (верное засчитано промахом) и «Не бить», который считается ошибкой.
    const wrong = typeInto(openPenalty(task), { kind: 'choice', value: right.kind === 'choice' && right.value === 0 ? 1 : 0 });
    expect(submitPenalty(typeInto(openPenalty(task), right)).sent).toBe('hit');
    expect(submitPenalty(wrong).sent).toBe('miss');
    expect(skipPenalty(openPenalty(task)).sent).toBe('skip');
  });

  it('К1: двойной Enter и двойной клик не шлют второй ответ; после «Не бить» «Ответить» холостое', () => {
    // Ловит: два события `penalty` подряд — второе съело бы следующую атаку 2-го тайма.
    const first = submitPenalty(typeInto(openPenalty(task), right));
    expect(first.sent).toBe('hit');
    expect(submitPenalty(first.flow).sent).toBeNull();
    expect(skipPenalty(first.flow).sent).toBeNull();
    const skipped = skipPenalty(openPenalty(task));
    expect(submitPenalty(skipped.flow).sent).toBeNull();
    expect(typeInto(first.flow, { kind: 'choice', value: 3 })).toBe(first.flow);
  });

  it('К1: пустой ответ попытку не тратит — лист остаётся открытым с подсказкой', () => {
    // Ловит: пустой Enter, засчитанный как промах.
    const out = submitPenalty(openPenalty(task));
    expect(out.sent).toBeNull();
    expect(out.flow.stage).toBe('ask');
    expect(out.flow.hint).toBe('empty');
    expect(typeInto(out.flow, right).hint).toBeNull();
  });

  it('К1: расстановка «по порядку» повторяется для одной задачи и никогда не готовый ответ', () => {
    const order = tasks.find((t) => t.answer.kind === 'order')!;
    const a = openPenalty(order).input;
    expect(openPenalty(order).input).toEqual(a);
    expect(submitPenalty(openPenalty(order)).sent).not.toBe('hit');
  });

  it('К1: вердикт держит матч на паузе без записи в журнал, «играем дальше» — возвращает ход (М2, К-В)', () => {
    // Ловит: время вердикта в темпе печати и лишние события в журнале повтора.
    const r0 = fresh();
    const held = hold(r0);
    expect(typing(held).paused).toBe(true);
    expect(held.events).toBe(r0.events);
    expect(hold(held)).toBe(held);
    expect(typing(release(held)).paused).toBe(false);
    expect(release(r0)).toBe(r0);
  });
});

describe('ТЗ-2.11: урок после паузы ≥ 5 дней', () => {
  // Ловит: плашка «урок не строже пройденного», а живой матч берёт урок как есть (Т10г, 065-Р137).
  it('ТЗ-2.11 длины и пороги — не выше предыдущего урока, буквы — свои; у первого урока — как есть', () => {
    const prevOf = (l: (typeof courseLessons)[number]) => courseLessons.find((p) => p.n === l.n - 1);
    // пара, где следующий урок строже: длиннее атаки/строки или пороги ниже — иначе смягчать нечего
    const next = courseLessons.find((l) => {
      const p = prevOf(l);
      return p !== undefined && (JSON.stringify(l.attacks) !== JSON.stringify(p.attacks) || JSON.stringify(l.rows) !== JSON.stringify(p.rows) || l.g < p.g || l.c < p.c);
    })!;
    const prev = prevOf(next)!;
    const soft = comebackLesson(courseLessons, next);
    expect(soft.attacks).toEqual(prev.attacks);
    expect(soft.rows).toEqual(prev.rows);
    expect(soft.newKeys).toBe(next.newKeys);
    expect(soft.g).toBeGreaterThanOrEqual(prev.g);
    const first = courseLessons.find((l) => l.n === 1)!;
    expect(comebackLesson(courseLessons, first)).toBe(first);
  });
});


describe('068-Т8 доправка: свисток и ритм дня', () => {
  const D = '2026-11-18';
  /** Сеанс игрока: разделы и `story` живут между свистками. */
  const session = () => {
    let cur = empty();
    let story: Story = emptyStory();
    const saves: Record<string, unknown>[] = [];
    const d: FinishDeps = {
      read: () => cur,
      readStory: () => story,
      save: (patch) => {
        saves.push(patch);
        cur = { ...cur, ...(patch as Partial<MatchSave>), course: patch['course:ru'] as MatchSave['course'] };
        if (patch.story !== undefined) story = patch.story as Story;
        return { ok: true };
      },
      journal: { put: () => Promise.resolve() },
    };
    return { d, saves, story: () => story, set: (x: Partial<MatchSave>) => void (cur = { ...cur, ...x }) };
  };
  const c = (matchId: string, stage?: number) => ({ now: 1_000_000, day: D, lessonId: lesson.id, matchId, ...(stage === undefined ? {} : { stage }) });

  it('К-ревью 4 (С5): свисток пишет отметку строки в story, второй матч в тот же день строки не даёт', () => {
    // Ловит: отметка показанной строки не пишется со свистком (мутант «убрать запись story») — совет звучит на каждом матче.
    const s = session();
    const first = finishRun(playToWhistle(fresh()), c('m-r1', 1), s.d);
    if (first.kind !== 'done' || first.rhythm === undefined) throw new Error('нужен ритм');
    expect(first.rhythm.line).toBe('advice');
    expect(s.saves[0]?.story).toBeDefined();
    expect((s.saves[0]?.story as Story).adviceDay).toBe(1);
    expect(s.story().adviceDay).toBe(1);
    const second = finishRun(playToWhistle(fresh()), c('m-r2', 1), s.d);
    if (second.kind !== 'done') throw new Error('матч не записан');
    expect(second.rhythm?.line).toBeNull();
    expect(s.saves[1]?.story).toBeUndefined();
  });

  it('К-ревью 3 068-Р64: «Застрял» (помощь) — строку не считаем и не помечаем', () => {
    // Ловит: совет дня «сгорает» на карточке «Застрял», где строки нет.
    const s = session();
    s.set({ course: { ...ruCourseDef.empty(), lessons: { [lesson.id]: { stars: 0, best: 0, tries: 9, fails: 9, back: false } } } });
    const whistled = playToWhistle(fresh());
    const lost = { ...whistled, state: { ...typing(whistled), result: { ...typing(whistled).result!, counted: false } } } as Run;
    const done = finishRun(lost, c('m-r3', 1), s.d);
    if (done.kind !== 'done') throw new Error('матч не записан');
    expect(done.view.help).toBe('coach');
    expect(done.rhythm?.line).toBeNull();
    expect(s.saves[0]?.story).toBeUndefined();
    expect(s.story().adviceDay).toBe(0);
    // не-«Застрял» в тот же день строку получил бы
    const ok = finishRun(playToWhistle(fresh()), c('m-r5', 1), s.d);
    expect(ok.kind === 'done' && ok.rhythm?.line).toBe('advice');
  });

  it('К-ревью 7 068-Р18: матч без урока (без ступени, как Кубок) рвёт серию урока', () => {
    // Ловит: серия переживает матч Кубка — «устали» склеивает два матча урока через Кубок.
    const s = session();
    s.set({ day: addAcc(dayDef.empty(), D, lesson.id, 1, 700) });
    const done = finishRun(playToWhistle(fresh()), c('m-r4'), s.d);
    expect(done.kind).toBe('done');
    expect((s.saves[0]?.day as MatchSave['day']).series).toBeNull();
  });

  it('К-ревью 3 068-Р70: 3-й матч дня пришёлся на «Застрял» — долг итога дня уходит в раздел day записи; следующий матч его снимает', () => {
    // Ловит: `rhythm.day` не доходит до записи — итог дня теряется, хотя ребёнок его не видел.
    const s = session();
    s.set({ course: { ...ruCourseDef.empty(), lessons: { [lesson.id]: { stars: 0, best: 0, tries: 9, fails: 9, back: false } } }, day: playedMatch(playedMatch(dayDef.empty(), D, 1), D, 2) });
    const whistled = playToWhistle(fresh());
    const lost = { ...whistled, state: { ...typing(whistled), result: { ...typing(whistled).result!, counted: false } } } as Run;
    const stuck = finishRun(lost, c('m-r6', 1), s.d);
    expect(stuck.kind === 'done' && stuck.rhythm?.summary).toBe(true);
    expect((s.saves[0]?.day as MatchSave['day']).summaryMissed).toBe(D);
    const next = finishRun(playToWhistle(fresh()), c('m-r7', 1), s.d);
    expect(next.kind === 'done' && next.rhythm?.summary).toBe(true);
    expect((s.saves[1]?.day as MatchSave['day']).summaryMissed).toBeNull();
  });
  it('068-Р78 return: пауза ≥ 5 дней до свистка — rhythm.returned (журнал дня → «Капитан вернулся»); матч на следующий день — нет', () => {
    // Ловит: `returned` не доходит из свистка (мутант «убрать isComeback») — событие 1 итога дня не наступает никогда.
    const DAYMS = 24 * 60 * 60 * 1000;
    const s = session();
    s.set({ day: { ...dayDef.empty(), last: 1_000 } });
    const back = finishRun(playToWhistle(fresh()), { ...c('m-r8', 1), now: 1_000 + 5 * DAYMS }, s.d);
    expect(back.kind === 'done' && back.rhythm?.returned).toBe(true);
    s.set({ day: { ...dayDef.empty(), last: 1_000 } });
    const near = finishRun(playToWhistle(fresh()), { ...c('m-r9', 1), now: 1_000 + 5 * DAYMS - 1 }, s.d);
    expect(near.kind === 'done' && near.rhythm?.returned).toBe(false);
  });
});

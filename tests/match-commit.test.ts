/**
 * Матч v2 (спека 017-Т5б, design §10): итог матча пишется в разделы сохранения 018 и в журнал.
 * Подготовка — две вкладки на одном хранилище (`twoTabs`); поток ведёт настоящий матч прыжком `jumpWith`,
 * запись идёт в сохранение рядом с памятью. У каждого теста — «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { courseLessons } from '../src/app/course/load';
import { drive, jumpWith } from '../src/app/match/jump';
import { matchRules } from '../src/app/match/load';
import { memoryMatchStore } from '../src/app/match/store';
import { tasks } from '../src/app/tasks';
import { entryFor } from '../src/engine/match/resume';
import type { Help } from '../src/engine/match/verdict';
import { credit } from '../src/engine/wallet/wallet';
import { beginOf, captured, finishOf, lesson, lying, saveOf, tee, type Fx, type Got } from './matchCommitFixtures';
import { twoTabs } from './saveFixtures';
import { createSaveMatchStore } from '../src/app/match/saveStore';

describe('commit: матч v2 → разделы (К17)', () => {
  // Ловит: перерыв, который не доходит до сохранения (F5 теряет 1-й тайм), и переходник half2 с потерей счёта.
  it('F5 на перерыве: 1-й тайм цел через half2, после старта 2-го тайма — «Продолжить»', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const { store } = jumpWith('break', lesson, false, (m) => tee(m, save));
    const pending = store.read().pending!;
    expect(lying(t, 'match')?.half2).toMatchObject({ lessonId: lesson.id, started: 0, reason: 'break' });
    // «Перезагрузка»: новое хранилище матча читает из сохранения.
    const after = saveOf(t).read().pending;
    expect(after).toEqual(pending);
    expect(entryFor(after, lesson.id).kind).toBe('break');
    save.half2Started();
    expect(lying(t, 'match')?.half2).toMatchObject({ started: 1_800_000_000_000 });
    expect(entryFor(saveOf(t).read().pending, lesson.id).kind).toBe('continue2');
  });

  // Ловит: блок, не доходящий до сохранения (монеты, верные по лиге, ошибки, окна), и журнал не одной пачкой.
  it('конец блока: монеты кассой, верные по лиге, окна; журнал — одной пачкой после записи', () => {
    const t = twoTabs();
    const got: Got = [];
    const save = saveOf(t, got);
    const { store } = jumpWith('break', lesson, false, (m) => tee(m, save));
    const mem = store.read();
    expect(mem.wallet.coins).toBeGreaterThan(0);
    expect(lying(t, 'wallet')).toMatchObject({ coins: mem.wallet.coins, pressRest: mem.wallet.carry });
    expect(lying(t, 'match')?.leagueHits).toEqual({ [lesson.league]: mem.fans[lesson.league] });
    expect(save.read().wallet).toEqual(mem.wallet);
    // Каждый блок — своя пачка: match (и coin, если вышла монета); `match` — одна запись на матч, id общий.
    expect(got.length).toBeGreaterThan(2);
    const matches = got.flatMap((g) => g.recs).filter((r) => r.kind === 'match');
    expect(new Set(matches.map((r) => r.id)).size).toBe(1);
    expect(matches.at(-1)?.data).toMatchObject({ lesson: lesson.id, league: lesson.league, n: lesson.n, attempt: 1, outcome: 'open' });
    const coins = got.flatMap((g) => g.recs).filter((r) => r.kind === 'coin');
    expect(coins.every((r) => (r.data as { ref?: string }).ref === matches[0]?.id)).toBe(true);
    expect(got.every((g) => g.recs.some((r) => r.kind === 'match'))).toBe(true);
  });

  // Ловит: итог, не закрывающий журнал и не пишущий урок, звёзды и played.
  it('итог победы: урок пройден, звёзды, played, журнал win', () => {
    const t = twoTabs();
    const got: Got = [];
    const save = saveOf(t, got);
    const { store } = jumpWith('win', lesson, false, (m) => tee(m, save));
    const course = lying(t, 'course') as { passed: string[]; lessons: Record<string, { stars: number }> };
    expect(course.passed).toContain(lesson.id);
    expect(course.lessons[lesson.id]?.stars).toBe(store.read().lessons[lesson.id]?.best);
    const played = lying(t, 'match')?.played as Record<string, unknown[]>;
    expect(played[lesson.league]).toHaveLength(1);
    expect(lying(t, 'match')?.lastFinishedAt).toBeGreaterThan(1e9);
    expect(lying(t, 'match')?.half2).toBeNull();
    const last = got.flatMap((g) => g.recs).filter((r) => r.kind === 'match').at(-1);
    expect(last?.data).toMatchObject({ outcome: 'win' });
    expect((last?.data as { signs: number }).signs).toBeGreaterThan(0);
  });

  // Ловит: запись «целым значением» — вторая вкладка зачислила между блоками, и её монеты затёрты.
  it('вторая вкладка между записями: в лежащем оба изменения', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const { begin, blocks } = captured();
    save.begin(begin);
    save.block(blocks[0]!);
    const first = (lying(t, 'wallet') as { coins: number; earned: number }).earned;
    t.b.updatePlayer((tx) => credit(tx, 25, 'prize'));
    save.block(blocks[1]!);
    const w = lying(t, 'wallet') as { coins: number; earned: number };
    expect(w.earned).toBeGreaterThanOrEqual(first + 25);
    expect(w.coins).toBe(w.earned);
  });

  // Ловит: запись в текущего игрока после смены: монеты и прогресс чужому ребёнку.
  it('смена игрока посреди матча — запись в закреплённого', () => {
    const t = twoTabs();
    t.a.store.create('p2');
    const save = saveOf(t);
    const { begin, blocks } = captured();
    save.begin(begin);
    t.cur.value = 'p2';
    for (const b of blocks) save.block(b);
    expect(lying(t, 'match', 'p1')?.leagueHits).toEqual({ [lesson.league]: blocks.reduce((n, b) => n + b.correct, 0) });
    expect(lying(t, 'wallet', 'p1')?.coins).toBeGreaterThan(0);
    expect(lying(t, 'match', 'p2')?.leagueHits).toEqual({});
    expect(lying(t, 'wallet', 'p2')?.coins).toBe(0);
  });

  // Ловит: матч, падающий на сохранении «только для чтения» (новее программы), или запись поверх него.
  it('readOnly: ничего не пишется, матч не падает', () => {
    const t = twoTabs();
    const newer = { ...(JSON.parse(t.data.get(t.key) ?? '') as object), format: 999 };
    t.data.set(t.key, JSON.stringify(newer));
    t.a.store.load('p1');
    expect(t.a.canWrite()).toBe(false);
    const text = t.data.get(t.key);
    const save = saveOf(t);
    const { begin, blocks, pending } = captured();
    expect(() => {
      save.begin(begin);
      for (const b of blocks) save.block(b);
      save.toBreak(pending);
      save.half2Started();
    }).not.toThrow();
    expect(t.data.get(t.key)).toBe(text);
  });

  // Ловит: итог, обнуляющий контекст — блоки минуты тренера после итога пропадают, журнал закрытого матча снова «open».
  it('минута тренера после итога: монеты, лига, клавиши, форма — как в памяти; журнал остаётся закрытым', () => {
    const t = twoTabs();
    const got: Got = [];
    const save = saveOf(t, got);
    const { flow, store } = jumpWith('coach', lesson, false, (m) => tee(m, save));
    expect(flow.state().phase).toBe('coach');
    drive(flow, (s) => s.phase === 'coach' && (s.coach?.n ?? 0) >= 1);
    const mem = store.read();
    expect(mem.fans[lesson.league]).toBeGreaterThan(0);
    expect(lying(t, 'wallet')).toMatchObject({ coins: mem.wallet.coins, pressRest: mem.wallet.carry });
    expect(lying(t, 'match')?.leagueHits).toEqual({ [lesson.league]: mem.fans[lesson.league] });
    expect(lying(t, 'match')?.keyErrors).toEqual(mem.keyErrors);
    expect(save.read().fans).toEqual(mem.fans);
    const form = save.read().form;
    expect(Object.keys(mem.form).length).toBeGreaterThan(0);
    for (const [f, w] of Object.entries(mem.form)) expect(form[f as keyof typeof form]).toEqual(w);
    const matches = got.flatMap((g) => g.recs).filter((r) => r.kind === 'match');
    expect(matches.at(-1)?.data).toMatchObject({ outcome: 'loss' });
  });

  // Ловит: «Знаток» +2 при одной задаче, забитой в двух вкладках; и запись «разобрано» не доходящую до школы.
  it('пенальти: задача, забитая в обеих вкладках, даёт «Знаток» +1', () => {
    const t = twoTabs();
    const other = createSaveMatchStore({ layer: t.b, player: () => t.cur.value, rules: matchRules });
    const a = saveOf(t);
    const kick = (taskId: string): Fx<'kick'> => ({ kind: 'kick', taskId, result: 'scored', expert: 1, at: 1 });
    const id = tasks[0]!.id;
    a.kick(kick(id));
    other.kick(kick(id));
    expect(lying(t, 'school')?.expert).toBe(1);
    a.kick(kick(tasks[1]!.id));
    expect(lying(t, 'school')?.expert).toBe(2);
  });

  // Ловит: точность округлением (969,7 → 970) — рекорд расходится с порогом ★★★, который 969 не берёт.
  it('точность в тысячных: 320 верных / 10 ошибок → acc 969 и ★★', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const l = courseLessons[0]!;
    save.begin(beginOf(l.id));
    const fin = finishOf(l.id, { correct: 320, errors: 10 });
    expect(fin.result.verdict.stars).toBe(2);
    save.finish(fin);
    const rec = (lying(t, 'course') as { lessons: Record<string, { acc: number; stars: number }> }).lessons[l.id];
    expect(rec).toMatchObject({ acc: 969, stars: 2 });
  });

  // Ловит: смягчение, которое ставит или снимает чужой урок (повторный проход старого урока сбрасывал бы его).
  it('смягчение: ставит проход текущего урока, снимает только чистый проход смягчённого', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const [n0, n1, n2] = [courseLessons[0]!.id, courseLessons[1]!.id, courseLessons[2]!.id];
    const play = (id: string, help: Help): void => (save.begin(beginOf(id)), save.finish(finishOf(id, { help })));
    const soften = (): unknown => lying(t, 'match')?.soften;
    play(n0, 'reserve');
    expect(soften()).toEqual({ lessonId: n1, from: n0 });
    play(n0, 'none'); // старый урок чисто — смягчение N+1 цело
    expect(soften()).toEqual({ lessonId: n1, from: n0 });
    play(n0, 'coach'); // и с помощью — не переставляет
    expect(soften()).toEqual({ lessonId: n1, from: n0 });
    play(n2, 'reserve'); // чужой урок с помощью — смягчение N+1 не уводит на N3
    expect(soften()).toEqual({ lessonId: n1, from: n0 });
    play(n1, 'none');
    expect(soften()).toBeNull();
    const n3 = courseLessons[3]!.id;
    play(n3, 'reserve'); // первый проход с помощью — ставит (повтор n1 с помощью уже не ставит, см. ниже)
    expect(soften()).toEqual({ lessonId: courseLessons[4]!.id, from: n3 });
  });

  // Ловит: смягчение, которое ставит и повтор уже пройденного урока (017-Р36): пройденный чисто n0 не должен смягчать n1.
  it('повтор пройденного с помощью не ставит смягчение — в сохранении и в памяти', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const mem = memoryMatchStore(matchRules);
    const n0 = courseLessons[0]!.id;
    for (const help of ['none', 'reserve'] as const) {
      for (const s of [save, mem]) {
        s.begin(beginOf(n0));
        s.finish(finishOf(n0, { help }));
      }
    }
    expect(lying(t, 'match')?.soften).toBeNull();
    expect(mem.read().softenFrom).toBeNull();
  });

  // Ловит: последний урок курса, после прохода которого память ставит смягчение «от последнего», а сохранение — нет (017-Р36).
  it('последний урок курса: память не ставит смягчение (как сохранение)', () => {
    const last = courseLessons[courseLessons.length - 1]!.id;
    const mem = memoryMatchStore(matchRules);
    mem.begin(beginOf(last));
    mem.finish(finishOf(last, { help: 'reserve' }));
    expect(mem.read().softenFrom).toBeNull();
    const t = twoTabs();
    const save = saveOf(t);
    save.begin(beginOf(last));
    save.finish(finishOf(last, { help: 'reserve' }));
    expect(lying(t, 'match')?.soften).toBeNull();
  });

  // Ловит: проход с помощью, который затирает `back`/`help` чисто пройденного урока (017-Р36); чистый проход после помощи — по-прежнему переписывает.
  it('проход с помощью чисто пройденного урока не переписывает back и help', () => {
    const t = twoTabs();
    const save = saveOf(t);
    const [n0, n1] = [courseLessons[0]!.id, courseLessons[1]!.id];
    const rec = (id: string): unknown => (lying(t, 'course') as { lessons: Record<string, { help: string; back: boolean }> }).lessons[id];
    save.begin(beginOf(n0));
    save.finish(finishOf(n0));
    save.begin(beginOf(n0));
    save.finish(finishOf(n0, { help: 'coach' }));
    expect(rec(n0)).toMatchObject({ help: 'none', back: false });
    save.begin(beginOf(n1));
    save.finish(finishOf(n1, { help: 'reserve' }));
    expect(rec(n1)).toMatchObject({ help: 'reserve', back: true });
    save.begin(beginOf(n1));
    save.finish(finishOf(n1));
    expect(rec(n1)).toMatchObject({ help: 'none', back: false });
  });
});

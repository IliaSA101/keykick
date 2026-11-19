/**
 * Вход в учебную игру из перерыва — доправка по ревью (067 Т17, К4): ставка только по матчам этого игрока, запасной источник скоростей,
 * запись итога (Р112), «Ещё раз» на золоте. Другая подготовка, чем в `learn.test.ts` (он у предела размера). У теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { breakCtx, breakJournal, commitDeps, enterBreak, type EntryFacts } from '../../src/app/learn/entry';
import { breakLead, breakPlan, nextAfter, NO_RIGHTS, rightRows, rightsGot, rightsStep, type RightsFlow } from '../../src/app/break/cards';
import { rightsCard } from '../../src/engine/learn/steps';
import { gameName, stakeOf } from '../../src/app/learn/view';
import { ownEntries } from '../../src/engine/journal';
import { learnDef, type Learn } from '../../src/engine/learn/section';
import type { Status } from '../../src/app/save/session';
import { bestInput, missInput, playUntil } from '../../src/app/learn/frame';
import { beginLearn, commitLearn, inputLearn, isFormsPlay, openLearn, type LearnFlow } from '../../src/app/learn/run';
import { progressOf, formAsk, keyAction, missOf, type KeyPress } from '../../src/app/learn/view';
import { FORMS_GAMES, startForms, type FormsState } from '../../src/engine/learn/forms';
import { walletDef } from '../../src/engine/rewards/section';
import { fingerName, formsMissText } from '../../src/app/learn/formsMiss';
import { ru } from '../../src/i18n/ru';
import { schoolDef } from '../../src/engine/school/section';
import { stadiumDef } from '../../src/engine/home/section';
import type { LearnSave } from '../../src/engine/learn/finish';

const entryOf = (matchId: string, at: number, cpm: number) => ({ matchId, seed: 1, events: [], at, cpm });
const facts = (o: Partial<EntryFacts> = {}): EntryFacts => ({ lesson: 3, keys: 'фываолдж', entries: [], now: 1000, day: '2026-11-19', ...o });
const sections = (learn: Learn = learnDef.empty(), lessons: Record<string, { best: number }> = {}): Record<string, { data: unknown }> => ({
  learn: { data: learn },
  'course:ru': { data: { current: 'ru.yard.ao', lessons, archive: {}, leaguesDone: {} } },
});

describe('К4 (067 Т17, доправка): ставка и вход перерыва', () => {
  it('К4: два игрока на одном устройстве — у каждого своя ставка по его матчам', () => {
    // Ловит: журнал один на устройство, и скорости всех игроков идут в ставку каждого (быстрый брат поднимает ставку медленному).
    const journal = [entryOf('m-ann-1', 1, 30), entryOf('m-ann-2', 2, 30), entryOf('m-bob-3', 3, 90), entryOf('m-bob-4', 4, 90)];
    const stakeFor = (pid: string): number => enterBreak(sections(), true, facts({ lesson: 1, entries: ownEntries(journal, pid) }), 5)!.stake;
    expect(stakeFor('ann')).toBe(1);
    expect(stakeFor('bob')).toBe(3);
    expect(stakeFor('kim')).toBe(2); // матчей нет — первые две монеты
    expect(enterBreak(sections(), true, facts({ lesson: 1, entries: journal }), 5)!.stake).not.toBe(stakeFor('ann'));
  });

  it('К4: журнал для ставки берётся из общего журнала устройства по игроку сеанса, без ручного фильтра; сеанс не `ok` — пусто', () => {
    // Ловит: композабл читает журнал целиком — ставка Ани считается по скоростям Бори (мутант «без ownEntries»).
    const shared = [entryOf('m-ann-1', 1, 30), entryOf('m-bob-2', 2, 90), entryOf('m-ann-3', 3, 30)];
    const stakeOf2 = (player: { kind: string; pid?: string }): number => enterBreak(sections(), true, facts({ lesson: 1, entries: breakJournal(shared, player) }), 5)!.stake;
    expect(breakJournal(shared, { kind: 'ok', pid: 'ann' }).map((e) => e.matchId)).toEqual(['m-ann-1', 'm-ann-3']);
    expect(stakeOf2({ kind: 'ok', pid: 'ann' })).toBe(1);
    expect(stakeOf2({ kind: 'ok', pid: 'bob' })).toBe(3);
    expect(breakJournal(shared, { kind: 'busy' })).toEqual([]);
    expect(breakJournal(shared, { kind: 'ok' })).toEqual([]);
  });

  it('К4: запасной источник скоростей — пустой журнал, раздел курса с лучшими результатами уроков', () => {
    // Ловит: матчи записаны до Т17 (в журнале нет cpm) — ставка вечно «первые две монеты», хотя ребёнок давно печатает; нулевой результат урока тянет медиану вниз.
    const ctx = breakCtx(sections(learnDef.empty(), { a: { best: 44 }, b: { best: 0 }, c: { best: 52 } }), facts());
    expect(ctx.speeds).toEqual([44, 52]);
    expect(breakCtx(sections(), facts()).speeds).toEqual([]);
    expect(breakCtx(sections(learnDef.empty(), { a: { best: 44 } }), facts({ entries: [entryOf('m-ann-1', 1, 70)] })).speeds).toEqual([70]);
  });

  it('К4: Р112 — отказ записи ложится в статус: `save` не `ok` → `fail` = статус; `invalid` (статус `ok` с причинами) → `quota`; удача — тишина', () => {
    // Ловит: отказ записи итога теряется (ребёнок думает, что монеты начислены) или `invalid` приходит пустой причиной.
    const seen: Status[] = [];
    const run = (res: { ok: boolean; status?: Status }): boolean => commitDeps(() => undefined, () => res as never, (s) => seen.push(s)).save({}).ok;
    expect(run({ ok: false, status: 'busy' })).toBe(false);
    expect(run({ ok: false, status: 'quota' })).toBe(false);
    expect(run({ ok: false, status: 'ok' })).toBe(false);
    expect(run({ ok: true })).toBe(true);
    expect(seen).toEqual(['busy', 'quota', 'quota']);
    expect(commitDeps(() => undefined, () => ({ ok: true }), () => undefined).read().learn).toEqual(learnDef.empty());
  });

  it('К4: игра, названная вне очереди, не открывается (золото уходит из очереди); «Ещё раз» открывает её со свежими «до игры» и ставкой 0', () => {
    // Ловит: «Ещё игра» открывает игру, которой нет в очереди (мутант М23); «Ещё раз» после золота показывает прежние «лучшая» и «+2».
    const gold: Learn = { ...learnDef.empty(), games: { arrows: { step: 3, plays: 4, best: 20000, last: '2026-11-18' } } };
    const f = facts({ entries: [entryOf('m-ann-1', 1, 90)] });
    expect(enterBreak(sections(gold), true, f, 5, 'arrows')).toBeNull();
    const again = enterBreak(sections(gold), true, f, 5, 'arrows', true)!;
    expect(again.flow.game).toBe('arrows');
    expect(again.before).toEqual({ step: 3, best: 20000 });
    expect(again.stake).toBe(0);
    expect(stakeOf({ speeds: [90] }, gold, 'arrows')).toBe(0);
    expect(stakeOf({ speeds: [90] }, learnDef.empty(), 'arrows')).toBe(3);
    expect(enterBreak(sections(gold), false, f, 5, 'arrows', true)).toBeNull(); // сеанс не `ok` — и «ещё раз» нет
    expect(enterBreak(sections(gold), true, f, 5, 'ghost', true)).toBeNull();
  });

  it('К4: имя игры по id — одно на окно, перерыв и экран матча; неизвестный id — пусто', () => {
    // Ловит: три копии поиска имени расходятся (одна отдаёт undefined вместо пустой строки).
    expect(gameName('arrows')).not.toBe('');
    expect(gameName('ghost')).toBe('');
  });
});

describe('К4 (067 Т18): игры 5–8 в окне — шаг и итог через движок', () => {
  const ctx = { now: 1000, day: '2026-11-19', lesson: 30, tour: 20, speeds: [60, 60, 60], learned: ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'] };
  const start = (game: string, seed = 5): LearnFlow => beginLearn(openLearn(game, 'break', ctx, seed)!, 1000);
  const round = (f: LearnFlow): number => (f.play !== null && isFormsPlay(f.play) ? f.play.s.round : -1);
  const box = (learn: Learn = learnDef.empty()): { readonly save: LearnSave; deps: Parameters<typeof commitLearn>[1] } => {
    const b: { save: LearnSave } = { save: { learn, wallet: walletDef.empty(), school: schoolDef.empty(), stadium: stadiumDef.empty() } };
    return { get save() { return b.save; }, deps: { read: () => b.save, save: (p) => ((b.save = { ...b.save, learn: p.learn as Learn, wallet: p.wallet as LearnSave['wallet'] }), { ok: true }) } };
  };

  it('К4: верный ответ закрывает раунд; неверный «Ответить» — один промах, раунд не закрыт, тот же ввод — не второй (Р34)', () => {
    // Ловит: неверный ответ закрывает раунд (игра проходится наугад) или тот же ввод два раза считается за два промаха.
    for (const game of FORMS_GAMES) {
      let f = start(game);
      expect(f.step, game).toBe('play');
      expect(progressOf(f.play!), game).toMatchObject({ at: 0 });
      const wrong = [missInput(f)!];
      let after = f;
      for (let i = 0; i < 4 && after.play!.s.misses === 0; i++) after = inputLearn(after, missInput(after)!, 2000);
      expect(after.play!.s.misses, game).toBe(1);
      expect(round(after), game).toBe(0);
      expect(missOf(f.play!, after.play!, wrong[0]!), game).not.toBeNull();
      const next = missInput(after);
      expect(next, `${game}: после промаха есть другой неверный ввод`).not.toBeNull();
      // Повторный «Ответить» тем же вводом счёта не меняет; другой неверный ввод — не больше второго промаха (точное «тот же ввод» — в тестах движка forms).
      expect(inputLearn(after, next!, 2100).play!.s.misses, game).toBeLessThanOrEqual(2);
      f = playUntil(after, 3000, (x) => round(x) >= 1);
      expect(round(f), game).toBeGreaterThanOrEqual(1);
      expect(progressOf(f.play!).at, `${game}: после закрытого раунда прогресс — 1`).toBe(1);
      expect(formAsk(f.play && isFormsPlay(f.play) ? f.play.s.tasks[0]! : (null as never)), game).not.toBe('');
    }
  });

  it('К4: итог игр 5–8 — ступень и монеты по ставке; повторный commit не пишет второй раз', () => {
    // Ловит: игра 5–8 доиграна, а монеты и ступень не легли в сохранение (или легли дважды).
    for (const game of FORMS_GAMES) {
      const b = box();
      const done = commitLearn(playUntil(start(game), 4000), b.deps);
      expect(done.step, game).toBe('end');
      expect(done.view!.step, game).toBeGreaterThanOrEqual(1);
      expect(done.view!.coins, game).toBeGreaterThan(0);
      expect(b.save.learn.games[game]!.step, game).toBe(done.view!.step);
      expect(commitLearn(done, b.deps), game).toBe(done);
    }
  });

  it('К4: на «золоте» игры 5–8 монет 0 (У-З1), рекорд пишется; ввод после конца игнорируется', () => {
    // Ловит: монеты за игру, уже взятую на золото; ввод на итоге меняет счёт.
    for (const game of FORMS_GAMES) {
      const learn = learnDef.empty();
      learn.games[game] = { step: 3, plays: 2, best: 600000, last: '2026-11-18' };
      const b = box(learn);
      const done = commitLearn(playUntil(start(game), 1000 + 20000), b.deps);
      expect(done.view!.coins, game).toBe(0);
      expect(b.save.wallet.coins, game).toBe(0);
      expect(done.view!.stepAll, game).toBe(3);
      expect(inputLearn(done, bestInput(start(game))!, 9000), game).toBe(done);
    }
  });
});

describe('067 Т18 шаг 1б: конкретный промах игр 5–8 (Р142)', () => {
  it('К13 Р142: «Заявка» называет игрока, верную и выбранную позицию', async () => {
    const { formsMissText } = await import('../../src/app/learn/formsMiss');
    const { startForms } = await import('../../src/engine/learn/forms');
    const s = startForms('roster', [], 5)!;
    const a = s.tasks[0]!.answer;
    if (a.kind !== 'select') throw new Error('строка заявки — список');
    const poss = a.row[1] as string[];
    const wrong = (a.correct[0]! + 1) % poss.length;
    const text = formsMissText({ ...s, input: { kind: 'select', value: [wrong, a.correct[1]!] } }, { type: 'submit' });
    expect(text).toBe(`${a.row[0] as string} — ${poss[a.correct[0]!]!}, не ${poss[wrong]!}`);
  });
});

describe('067 Т18 шаг 1в: подсказка раунда и формы «Отбора» (Р159, Р153)', () => {
  it('К13 Р159: у каждого раунда каждой игры 5–8 своя подсказка под заголовком окна, не общая', async () => {
    // Ловит: одна общая строка «Отметь верные варианты…» на все раунды (кадры Э8.14, 17, 22, 26 показывают строку раунда).
    const { startForms } = await import('../../src/engine/learn/forms');
    const { formHint } = await import('../../src/app/learn/view');
    const all = new Map<string, string>();
    for (const game of FORMS_GAMES) {
      for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const t of startForms(game, ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'], seed)!.tasks) {
        const h = formHint(t);
        expect(h, `${game} ${t.text}`).not.toBe('');
        expect(h, `${game} ${t.text}`).not.toMatch(/\{/);
        all.set(t.text, h);
      }
    }
    expect(new Set(all.values()).size).toBeGreaterThan(5);
  });

  it('К13 Р153: каждая форма из задач «Отбора» рисуется — цвета из kits.json совпадают с записью того же id (не только формы Двора)', async () => {
    // Ловит: пустую белую карточку — форма вне порядка паков Двора (kitOf её не знал); цвета не из той записи.
    const { kitColors } = await import('../../src/engine/album/kit');
    const forms = (await import('../../src/content/learn-forms.json')).default;
    const kits = (await import('../../src/content/kits.json')).default as Array<{ id: string; body: string; sleeves: string; trim: string }>;
    for (const k of forms.kits) {
      const c = kitColors(k.id);
      const row = kits.find((x) => x.id === k.id)!;
      expect(c, k.id).toMatchObject({ body: row.body, sleeves: row.sleeves, trim: row.trim });
    }
    expect(kitColors('нет-такой')).toBeNull();
  });
});

describe('067 Т18 шаг 1: каждая ветка formsMissText (Р142)', () => {
  const T = ru.learn.formsMiss;
  const sub = (tpl: string, v: Record<string, string>): string => Object.entries(v).reduce((r, [k, x]) => r.replace(`{${k}}`, x), tpl);
  /** Первая задача заданного вида среди игр и зёрен; состояние — с подставленным вводом. */
  const find = (kind: string): FormsState => {
    for (const game of FORMS_GAMES) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const s = startForms(game, ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'], seed)!;
      const i = s.tasks.findIndex((t) => t.answer.kind === kind);
      if (i >= 0) return { ...s, round: i };
    }
    throw new Error(`нет задачи вида ${kind}`);
  };
  const submit = { type: 'submit' } as const;

  it('К13 Р142: extra, lack — лишняя и недостающая отметка; pick — не тот вариант', () => {
    // Ловит: подмену ветки (лишняя отметка названа недостающей), пустой или чужой вариант в строке.
    const m = find('multi');
    const a = m.tasks[m.round]!.answer;
    if (a.kind !== 'multi') throw new Error();
    const extra = a.options.findIndex((_, i) => !a.correct.includes(i));
    expect(formsMissText({ ...m, input: { kind: 'multi', value: [...a.correct, extra] } }, submit)).toBe(sub(T.extra, { what: a.options[extra]! }));
    expect(formsMissText({ ...m, input: { kind: 'multi', value: a.correct.slice(1) } }, submit)).toBe(sub(T.lack, { what: a.options[a.correct[0]!]! }));
    const c = find('choice');
    const ca = c.tasks[c.round]!.answer;
    if (ca.kind !== 'choice') throw new Error();
    expect(formsMissText({ ...c, input: { kind: 'choice', value: 0 } }, submit)).toBe(sub(T.pick, { what: ca.options[0]! }));
  });

  it('К13 Р142: num — верна позиция, не тот номер; field и slot — какое поле или окошко не то', () => {
    // Ловит: при верной позиции и неверном номере строка про позицию (или пустая); поле и окошко не названы.
    const r = find('select');
    const a = r.tasks[r.round]!.answer;
    if (a.kind !== 'select') throw new Error();
    const nums = a.row[2] as string[];
    const wrong = (a.correct[1]! + 1) % nums.length;
    expect(formsMissText({ ...r, input: { kind: 'select', value: [a.correct[0]!, wrong] } }, submit)).toBe(sub(T.num, { name: a.row[0] as string, right: nums[a.correct[1]!]!, wrong: nums[wrong]! }));
    const b = find('fields');
    const fa = b.tasks[b.round]!.answer;
    if (fa.kind !== 'fields') throw new Error();
    expect(formsMissText({ ...b, input: { kind: 'fields', value: fa.fields.map((f, i) => String(i === 0 ? f.value + 1 : f.value)) } }, submit)).toBe(sub(T.field, { label: fa.fields[0]!.label }));
    const e = find('expr');
    const ea = e.tasks[e.round]!.answer;
    if (ea.kind !== 'expr') throw new Error();
    expect(formsMissText({ ...e, input: { kind: 'expr', value: ea.values.map((v, i) => String(i === 0 ? v + 1 : v)) } }, submit)).toBe(sub(T.slot, { n: '1' }));
  });

  it('К13 Р142: line — «Пары»: неверная линия называет левое имя, верный и выбранный правый', () => {
    // Ловит: линия без имён (общая строка) или с пальцем вместо слова.
    const m = find('match');
    const a = m.tasks[m.round]!.answer;
    if (a.kind !== 'match') throw new Error();
    const wrong = (a.pairs[0]! + 1) % a.right.length;
    const left = m.tasks[m.round]!.refs === 'finger' ? fingerName(a.left[0]!) : a.left[0]!;
    expect(formsMissText(m, { type: 'link', left: 0, right: wrong })).toBe(sub(T.line, { left, right: a.right[a.pairs[0]!]!, wrong: a.right[wrong]! }));
  });
});

describe('К4 (067 Т18, доправка): клавиши окна — keyAction', () => {
  const k = (key: string, o: Partial<KeyPress> = {}): KeyPress => ({ key, repeat: false, shift: false, plainButton: false, ...o });

  it('К4: Esc и Enter при открытом списке окна — окно не трогает событие; без списка — как раньше', () => {
    // Ловит: Esc закрывает всё окно при открытом списке «Заявки» (меню должно закрыться само); Enter при списке «отвечает».
    expect(keyAction('play', 'roster', k('Escape'), true)).toBeNull();
    expect(keyAction('play', 'roster', k('Enter'), true)).toBeNull();
    expect(keyAction('play', 'roster', k('Escape'), false)).toEqual({ do: 'close' });
    expect(keyAction('play', 'roster', k('Enter'), false)).toEqual({ do: 'feed', input: { game: 'roster', action: { type: 'submit' } } });
    expect(keyAction('start', 'arrows', k('Enter'), false)).toEqual({ do: 'primary' });
    expect(keyAction('start', 'arrows', k('Enter', { plainButton: true }), false)).toBeNull();
    expect(keyAction('play', 'tab', k('Tab', { shift: true }), false)).toEqual({ do: 'feed', input: { game: 'tab', input: 'shiftTab' } });
    expect(keyAction('play', 'arrows', k('ArrowUp'), false)).toEqual({ do: 'feed', input: { game: 'arrows', dir: 'up' } });
    expect(keyAction('end', 'arrows', k('ArrowUp'), false)).toBeNull();
  });
});

describe('К8 (067 Т18, шаг 2а): карточки перерыва и «Права»', () => {
  const gold = (best: number) => ({ step: 3, plays: 5, best, last: '2026-11-18' });
  const plan = (learn: Learn, lesson: number, ok = true) => breakPlan(learn, breakCtx(sections(learn), facts({ lesson, keys: 'фываолджэ' })), ok);

  it('К8: урок 9, ничего не играно — первой «новая» «Отбор в состав» с «к «Школе»», слова «обычные две»', () => {
    // Ловит: карточка без метки «новое» и без ссылки на «Школу»; не тот вид слов над карточками.
    const played = (best: number) => ({ step: 1, plays: 3, best, last: '2026-11-18' });
    const p = plan({ games: { arrows: played(40000), mouse: played(40000), tab: played(40000), keyboard: played(50000) }, recent: [], rest: 0 }, 9);
    expect(p.lead).toBe('play');
    expect(p.cards[0]).toMatchObject({ id: 'squad', kind: 'game', isNew: true, school: ru.learn.schoolLink.replace('{kind}', ru.school.kinds.multi!) });
    expect(p.cards[0]!.stake).toBeGreaterThan(0);
    expect(p.cards.every((c) => c.kind === 'game')).toBe(true);
  });

  it('К8: одна не на золоте — вторая «побей рекорд» с рекордом и 0 монет; все на золоте — две разные «побей рекорд» вместо игр (Р201)', () => {
    // Ловит: золотая игра с монетами; неверные слова над карточками (У-З4).
    const ids = ['arrows', 'mouse', 'tab', 'keyboard', 'squad', 'board', 'roster', 'pairs'];
    const allGold = Object.fromEntries(ids.map((id, i) => [id, gold(27000 + i * 1000)]));
    const one = plan({ games: { ...allGold, roster: { step: 2, plays: 9, best: 49000, last: '2026-11-18' } }, recent: [], rest: 0 }, 27);
    expect(one.lead).toBe('oneGold');
    expect(one.cards.map((c) => c.kind)).toEqual(['game', 'record']);
    expect(one.cards[1]).toMatchObject({ stake: 0, step: 3 });
    expect(one.cards[1]!.best).not.toBeNull();
    const all = plan({ games: allGold, recent: [], rest: 0 }, 33);
    expect(all.lead).toBe('allGold');
    expect(all.cards).toHaveLength(2); // 067-Р201: макет Э4.19 — две золотые игры по очереди
    expect(all.cards[0]!.id).not.toBe(all.cards[1]!.id);
    expect(all.cards.every((c) => c.kind === 'record' && c.stake === 0)).toBe(true);
  });

  it('К8: вход по карточке «побей рекорд» открывает окно (ставка 0); игра, которой нет ни в очереди, ни среди карточек, — нет', () => {
    // Ловит: золотой в очереди нет, и `enterBreak` пускал только очередь — «побей рекорд» не открывал ничего (Э4.18, Э4.19).
    const ids = ['arrows', 'mouse', 'tab', 'keyboard', 'squad', 'board', 'roster', 'pairs'];
    const allGold: Learn = { games: Object.fromEntries(ids.map((id, i) => [id, gold(27000 + i * 1000)])), recent: [], rest: 0 };
    const f = facts({ lesson: 33, keys: 'фываолджэ', entries: [entryOf('m-ann-1', 1, 90)] });
    const cards = plan(allGold, 33).cards;
    expect(cards.every((c) => c.kind === 'record')).toBe(true);
    for (const c of cards) {
      const e = enterBreak(sections(allGold), true, f, 5, c.id);
      expect(e, c.id).not.toBeNull();
      expect(e!.flow.game).toBe(c.id);
      expect(e!.stake).toBe(0);
    }
    const hidden = ids.find((id) => !cards.some((c) => c.id === id))!;
    expect(enterBreak(sections(allGold), true, f, 5, hidden)).toBeNull();
    expect(enterBreak(sections(allGold), false, f, 5, cards[0]!.id)).toBeNull();
  });

  it('К8: сеанс не `ok` или нет открытых игр — карточек нет (сразу «Второй тайм»); слова — `null`', () => {
    // Ловит: карточки с монетами там, где записать их некуда.
    expect(plan(learnDef.empty(), 9, false)).toEqual({ cards: [], lead: null });
    expect(breakLead([])).toBeNull();
  });

  it('К8: «Ещё игра» после игры — первая карточка, кроме сыгранной; других нет — кнопки нет', () => {
    // Ловит: «Ещё игра» с той же игрой, которую только что сыграли.
    expect(nextAfter([{ id: 'tab' }, { id: 'mouse' }], 'tab')).toBe('mouse');
    expect(nextAfter([{ id: 'tab' }], 'tab')).toBeNull();
  });

  it('К8: «Права» — тренажёры 5–8 без ступени замкнуты туром «Школы», игры 1–4 — «ещё нет ступени», новая отмечена, получено 2 из 8', () => {
    // Ловит: тур на замке у игры без тура; потерянная метка «новое»; неверный счёт «N из 8».
    const learn: Learn = { games: { arrows: { step: 2, plays: 3, best: 30000, last: '2026-11-18' }, mouse: { step: 2, plays: 1, best: 36000, last: '2026-11-19' } }, recent: ['mouse'], rest: 0 };
    const card = rightsCard(learn, true, 'break')!;
    const rows = rightRows(card, 'mouse');
    expect(rightsGot(card)).toEqual({ n: 2, of: 8 });
    expect(rows.filter((r) => r.fresh).map((r) => r.id)).toEqual(['mouse']);
    expect(rows.find((r) => r.id === 'tab')!.tour).toBeNull();
    expect(rows.find((r) => r.id === 'squad')).toMatchObject({ step: 0, tour: 5 });
    expect(rows.find((r) => r.id === 'pairs')!.tour).toBe(17);
  });

  it('К8: Р190 — «Второй тайм» после «Прав» не идёт сразу, а ждёт закрытия «Прав»; без прав — идёт сразу', () => {
    // Ловит: матч стартует поверх карточки «Права» (или никогда не стартует после неё); «Права» никогда не показываются.
    const learn: Learn = { games: { arrows: { step: 2, plays: 3, best: 30000, last: '2026-11-18' }, mouse: { step: 2, plays: 1, best: 36000, last: '2026-11-19' } }, recent: ['mouse'], rest: 0 };
    const card = rightsCard(learn, true, 'break')!;
    const played = rightsStep(NO_RIGHTS, { do: 'played', game: 'mouse', rights: card });
    expect(played.state.rights).toEqual({ card, fresh: 'mouse' }); // показать «Права»
    expect(played.go).toBe(false);
    const second = rightsStep(played.state, { do: 'second' });
    expect(second.go).toBe(false); // «Второй тайм» не идёт под «Правами»
    expect(second.state).toMatchObject({ held: true });
    const closed = rightsStep(second.state, { do: 'closeRights' });
    expect(closed.go).toBe(true); // …а идёт после их закрытия
    expect(closed.state).toEqual(NO_RIGHTS);
    expect(rightsStep(NO_RIGHTS, { do: 'second' }).go).toBe(true); // прав нет — сразу
    expect(rightsStep(played.state, { do: 'closeRights' }).go).toBe(false); // закрыли «Права» до «Второго тайма» — матч не стартует сам
  });

  it('К8: «Ещё игра»/«Ещё раз» без нового умения не затирает непоказанные «Права»; новое умение их заменяет', () => {
    // Ловит: вторая игра без нового умения стирает «Права» первой — ребёнок их не увидит.
    const learn: Learn = { games: { arrows: { step: 2, plays: 3, best: 30000, last: '2026-11-18' }, mouse: { step: 2, plays: 1, best: 36000, last: '2026-11-19' } }, recent: ['mouse'], rest: 0 };
    const card = rightsCard(learn, true, 'break')!;
    const first: RightsFlow = rightsStep(NO_RIGHTS, { do: 'played', game: 'mouse', rights: card }).state;
    const again = rightsStep(first, { do: 'played', game: 'arrows', rights: null }).state;
    expect(again.rights).toEqual({ card, fresh: 'mouse' });
    const newer = rightsStep(again, { do: 'played', game: 'tab', rights: card }).state;
    expect(newer.rights!.fresh).toBe('tab');
  });
});

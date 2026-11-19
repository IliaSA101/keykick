/**
 * Правила восьми учебных игр (067 Т5, К4; 057 «Игры»; ТЗ-7.1–7.7): верный ввод, промах, конец, итог в `finishLearn`.
 * Отдельный файл: другая подготовка (состояния игр), общая с `learn.test.ts` — только запуск и сохранение.
 * У каждого теста строка «Ловит:».
 */
import { describe, expect, it } from 'vitest';
import { learnDef } from '../../src/engine/learn/section';
import { startLearn, type LearnRun } from '../../src/engine/learn/steps';
import { finishLearn, type LearnSave } from '../../src/engine/learn/finish';
import { baseList, breakCards, queue, type LearnCtx } from '../../src/engine/learn/queue';
import { settle } from '../../src/engine/learn/games/common';
import { moveArrows, startArrows, type ArrowsState, type Dir } from '../../src/engine/learn/games/arrows';
import { inputMouse, startMouse, type MouseState } from '../../src/engine/learn/games/mouse';
import { inputTab, startTab, type TabState } from '../../src/engine/learn/games/tab';
import { placeLetter, startPuzzle, type PuzzleState } from '../../src/engine/learn/games/puzzle';
import { actForms, startForms, formsBuildable, FORMS_GAMES, type FormsGame, type FormsState, type FormsTask } from '../../src/engine/learn/forms';
import { correctInput, type MatchAnswer, type TaskAnswer } from '../../src/engine/school/answers';
import { findChar } from '../../src/engine/typing/keymap';
import { keymap } from '../../src/engine/typing/layouts';
import { ru } from '../../src/i18n/ru';
import tasksJson from '../../src/content/tasks.json';
import kitsJson from '../../src/content/kits.json';
import content from '../../src/content/learn-forms.json';
import learnCfg from '../../src/content/learn.json';
import { walletDef } from '../../src/engine/rewards/section';
import { schoolDef } from '../../src/engine/school/section';
import { stadiumDef } from '../../src/engine/home/section';

const ctx: LearnCtx = { now: 1000, day: '2026-11-19', lesson: 30, tour: 20, speeds: [60, 60, 60], learned: ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'] };
const saveOf = (): LearnSave => ({ learn: learnDef.empty(), wallet: walletDef.empty(), school: schoolDef.empty(), stadium: stadiumDef.empty() });
const DIRS: Dir[] = ['left', 'up', 'right', 'down'];
const key = (x: number, y: number): string => `${x},${y}`;

/** Верное прохождение «Стрелок»: шаг в клетку, ближайшую к воротам. */
function solveArrows(start: ArrowsState): ArrowsState {
  let s = start;
  for (let guard = 0; guard < 500 && !s.done; guard++) {
    const here = s.dist[key(s.ball.x, s.ball.y)]!;
    const step = (d: Dir): number => {
      const dx = d === 'left' ? -1 : d === 'right' ? 1 : 0;
      const dy = d === 'up' ? -1 : d === 'down' ? 1 : 0;
      return s.dist[key(s.ball.x + dx, s.ball.y + dy)] ?? Infinity;
    };
    s = moveArrows(s, DIRS.find((d) => step(d) < here)!);
  }
  return s;
}

/** Итог игры → сохранение: запуск, промахи и время берутся из состояния, как их возьмёт экран. */
function finishWith(game: string, state: { misses: number; done: boolean }, ms: number): { run: LearnRun; save: LearnSave; stepAll: number | undefined } {
  const run = settle(startLearn(game, ctx, 7), state, ctx.now + ms);
  const out = finishLearn(saveOf(), run, ctx);
  return { run, save: out.save, stepAll: out.view?.stepAll };
}

describe('К4: «Пас стрелками» (игра 1)', () => {
  it('К4: кратчайший путь по трём полям — без промахов, конец, золото в finishLearn', () => {
    // Ловит: поле без пути к воротам; конец не после третьего поля; промах за верный шаг; итог не доходит до finishLearn.
    const s = solveArrows(startArrows(5));
    expect(s.done).toBe(true);
    expect(s.field).toBe(2);
    expect(s.misses).toBe(0);
    expect(finishWith('arrows', s, 30_000).stepAll).toBe(3);
  });

  it('К4: упор в край и в защитника — промах, мяч стоит', () => {
    // Ловит: упор не считается промахом; упор сдвигает мяч.
    const s0 = startArrows(5);
    const wall = moveArrows(s0, 'left');
    expect(wall.misses).toBe(1);
    expect(wall.ball).toEqual(s0.ball);
  });

  it('К4: шаг сверх кратчайшего (клетка дальше от ворот) — промах, но мяч идёт', () => {
    // Ловит: шаг не к воротам не считается промахом; такой шаг не двигает мяч (игра встала, 057-Р4).
    const s0 = startArrows(5);
    const here = s0.dist[key(s0.ball.x, s0.ball.y)]!;
    const worse = DIRS.filter((d) => {
      const n = { x: s0.ball.x + (d === 'left' ? -1 : d === 'right' ? 1 : 0), y: s0.ball.y + (d === 'up' ? -1 : d === 'down' ? 1 : 0) };
      return (s0.dist[key(n.x, n.y)] ?? -1) > here;
    });
    expect(worse.length).toBeGreaterThan(0);
    const moved = moveArrows(s0, worse[0]!);
    expect(moved.misses).toBe(1);
    expect(moved.ball).not.toEqual(s0.ball);
    expect(moved.steps).toBe(1);
  });

  it('К4: ворота на ряду мяча; цель — три клетки столбца 7 вокруг этого ряда, расстояния от всех трёх (057-Р22)', () => {
    // Ловит: ворота на случайном ряду, а не на ряду мяча; зона из одной клетки; расстояние считается от одной клетки зоны.
    for (let seed = 1; seed <= 20; seed++) {
      const s = startArrows(seed);
      expect(s.goal.y).toBe(s.ball.y);
      expect(s.zone).toHaveLength(3);
      expect(s.zone.every((p) => p.x === 7)).toBe(true);
      expect(s.zone.map((p) => p.y)).toContain(s.goal.y);
      expect(s.zone.map((p) => p.y).sort()).toEqual([s.zone[0]!.y, s.zone[0]!.y + 1, s.zone[0]!.y + 2]);
      for (const p of s.zone) {
        expect(s.dist[key(p.x, p.y)]).toBe(0);
        expect(s.defenders.some((d) => d.x === p.x && d.y === p.y)).toBe(false);
        const before = s.dist[key(p.x - 1, p.y)];
        expect(before === undefined || before === 1).toBe(true);
      }
    }
  });

  it('К4: два промаха — серебро не дают: ступень по правилу ТЗ-7.5', () => {
    // Ловит: число промахов не доходит до ступени (1 промах — серебро, 2 — бронза).
    const done = solveArrows(startArrows(5));
    expect(finishWith('arrows', { ...done, misses: 1 }, 99_000).stepAll).toBe(2);
    expect(finishWith('arrows', { ...done, misses: 2 }, 99_000).stepAll).toBe(1);
  });
});

describe('К4: «Точный пас мышью» (игра 2)', () => {
  const solve = (s: MouseState): MouseState => {
    let cur = s;
    while (!cur.done) {
      const step = cur.steps[cur.at]!;
      cur = inputMouse(cur, { type: step.kind === 'click' ? 'click' : 'drop', at: step.target });
    }
    return cur;
  };

  it('К4: пять щелчков и три переноса в цель — конец без промахов, итог золотой', () => {
    // Ловит: число шагов не 5+3; попадание в центр считается промахом; итог не доходит до finishLearn.
    const s0 = startMouse(3, 0.5);
    expect(s0.steps.map((x) => x.kind).join()).toBe('click,click,click,click,click,carry,carry,carry');
    const s = solve(s0);
    expect(s.misses).toBe(0);
    expect(finishWith('mouse', s, 20_000).stepAll).toBe(3);
  });

  it('К4: щелчок мимо и сброс дальше радиуса — промахи; ввод не того рода — не промах', () => {
    // Ловит: мимо не считается; «drop» во время щелчков считается промахом или шагом.
    const s0 = startMouse(3, 0.5);
    const t = s0.steps[0]!.target;
    const far = { x: (t.x + 50) % 100, y: t.y };
    expect(inputMouse(s0, { type: 'click', at: far }).misses).toBe(1);
    expect(inputMouse(s0, { type: 'drop', at: t })).toBe(s0);
    const carry = { ...s0, at: 5 };
    const t5 = s0.steps[5]!.target;
    expect(inputMouse(carry, { type: 'drop', at: { x: (t5.x + 50) % 100, y: t5.y } }).misses).toBe(1);
    expect(inputMouse(carry, { type: 'click', at: t5 })).toBe(carry);
  });

  it('К4: мяч переноса — дальше двух радиусов от партнёра (на любом зерне)', () => {
    // Ловит: мяч стоит у самого партнёра — перенос без движения.
    for (let seed = 1; seed <= 40; seed++) {
      const s = startMouse(seed, 0.5);
      for (const step of s.steps.filter((x) => x.kind === 'carry')) {
        expect(Math.hypot(step.ball!.x - step.target.x, (step.ball!.y - step.target.y) * 0.5)).toBeGreaterThan(16);
      }
    }
  });

  it('К4: радиус — доля ширины: на неквадратной арене сдвиг по высоте на тот же процент ближе', () => {
    // Ловит: радиус в процентах считается одинаково по обеим сторонам (на широкой арене круг превращается в эллипс).
    const s0 = startMouse(3, 0.5);
    const t = s0.steps[0]!.target;
    const dy = { x: t.x, y: t.y + 10 };
    const dx = { x: t.x + 10, y: t.y };
    expect(inputMouse(s0, { type: 'click', at: dy }).misses).toBe(0);
    expect(inputMouse(s0, { type: 'click', at: dx }).misses).toBe(1);
  });
});

describe('К4: «Tab по защитникам» (игра 3)', () => {
  /** Верный путь: кратчайшим направлением, затем Enter. */
  const solve = (s: TabState): TabState => {
    let cur = s;
    for (let guard = 0; guard < 200 && !cur.done; guard++) {
      const n = cur.numbers.length;
      const ahead = (cur.target - cur.focus + n) % n;
      cur = inputTab(cur, ahead === 0 ? 'enter' : ahead <= n - ahead ? 'tab' : 'shiftTab');
    }
    return cur;
  };

  it('К4: пять пасов по кратчайшему пути — без промахов; цель никогда не под фокусом на старте паса', () => {
    // Ловит: цель совпадает с фокусом (пас без движения); конец не после пятого паса; итог не доходит до finishLearn.
    const s0 = startTab(11);
    expect(s0.target).not.toBe(s0.focus);
    expect(new Set(s0.numbers).size).toBe(s0.numbers.length);
    const s = solve(s0);
    expect(s.passes).toBe(5);
    expect(s.misses).toBe(0);
    expect(finishWith('tab', s, 25_000).stepAll).toBe(3);
  });

  /** Состояние с нужным расстоянием цели вперёд по кругу: ищем зерно явно. */
  const withAhead = (pick: (ahead: number, n: number) => boolean): TabState => {
    for (let seed = 1; seed < 200; seed++) {
      const s = startTab(seed);
      const n = s.numbers.length;
      if (pick((s.target - s.focus + n) % n, n)) return s;
    }
    throw new Error('no seed');
  };

  it('К4: Enter на чужом и щелчок мышью — промахи', () => {
    // Ловит: Enter на чужом проходит; щелчок не считается.
    const s0 = startTab(11);
    expect(inputTab(s0, 'enter').misses).toBe(1);
    expect(inputTab(s0, 'click').misses).toBe(1);
  });

  it('К4: Tab или Shift+Tab в длинную сторону — промах; в короткую — нет', () => {
    // Ловит: шаг не в ту сторону не считается; верный шаг считается промахом.
    const s = withAhead((ahead, n) => ahead !== n - ahead);
    const n = s.numbers.length;
    const ahead = (s.target - s.focus + n) % n;
    const [short, long] = ahead < n - ahead ? (['tab', 'shiftTab'] as const) : (['shiftTab', 'tab'] as const);
    expect(inputTab(s, long).misses).toBe(1);
    expect(inputTab(s, short).misses).toBe(0);
  });

  it('К4: фокус на цели — проскок: и Tab, и Shift+Tab — промах', () => {
    // Ловит: Tab с цели (ahead = back = 0) считается верным шагом.
    const s0 = startTab(11);
    const onTarget = { ...s0, focus: s0.target };
    expect(inputTab(onTarget, 'tab').misses).toBe(1);
    expect(inputTab(onTarget, 'shiftTab').misses).toBe(1);
  });

  it('К4: числа игроков — разные, из 2…numberMax, по зерну', () => {
    // Ловит: повтор номера в круге; номер вне диапазона.
    const s = startTab(5);
    expect(startTab(5).numbers).toEqual(s.numbers);
    expect(s.numbers.every((x) => x >= 2 && x <= 30)).toBe(true);
  });
});

describe('К4: «Собери клавиатуру» (игра 4)', () => {
  const learned = ['а', 'о', 'л', 'д', 'ж'];

  it('К4: У-З2 — в лотке только выученные буквы, без повторов; пустой набор — null', () => {
    // Ловит: в лоток попала невыученная буква; повтор буквы; исключение вместо null при пустом наборе.
    const s = startPuzzle([...learned, 'а'], 4)!;
    expect([...s.tray].sort()).toEqual([...learned].sort());
    expect(startPuzzle(['ф', 'ы', 'в'], 9)!.tray.every((c) => ['ф', 'ы', 'в'].includes(c))).toBe(true);
    expect(startPuzzle([], 1)).toBeNull();
  });

  it('К4: выучено 15 букв — лоток 10, все из выученных, без повторов', () => {
    // Ловит: лоток длиннее десяти; в лоток попала невыученная буква.
    const many = [...'абвгдежзиклмноп'];
    const tray = startPuzzle(many, 8)!.tray;
    expect(tray).toHaveLength(10);
    expect(new Set(tray).size).toBe(10);
    expect(tray.every((c) => many.includes(c))).toBe(true);
  });

  it('К4: каждая буква в своё гнездо — конец без промахов; в чужое — промах', () => {
    // Ловит: буква в чужое гнездо проходит; конец раньше последней буквы; итог не доходит до finishLearn.
    let s: PuzzleState = startPuzzle(learned, 4)!;
    const other = s.tray[1]!;
    const wrong = placeLetter(s, s.tray[0]!, other);
    expect(wrong.misses).toBe(1);
    expect(wrong.placed).toEqual([]);
    for (const c of s.tray) {
      expect(s.done).toBe(false);
      s = placeLetter(s, c, c);
    }
    expect(s.done).toBe(true);
    expect(s.misses).toBe(0);
    expect(placeLetter(s, 'я', 'я')).toBe(s);
    expect(finishWith('keyboard', s, 40_000).stepAll).toBe(3);
  });
});

describe('К4: игры 5–8 — футбольное содержание, виды «Школы»', () => {
  /** Выучены все восемь пальцев домашнего ряда: у «Пар» хватает пальцев с буквами. */
  const learned = ['ф', 'ы', 'в', 'а', 'о', 'л', 'д', 'ж'];
  const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);
  const start = (game: FormsGame, seed = 21): FormsState => startForms(game, learned, seed)!;
  const solveRound = (s: FormsState): FormsState => {
    const answer = s.tasks[s.round]!.answer;
    if (answer.kind === 'match') return answer.pairs.reduce((cur, right, left) => actForms(cur, { type: 'link', left, right }), s);
    return actForms(actForms(s, { type: 'set', input: correctInput(answer) }), { type: 'submit' });
  };
  const solve = (s: FormsState): FormsState => {
    let cur = s;
    while (!cur.done) cur = solveRound(cur);
    return cur;
  };
  const allTasks = (game: FormsGame): FormsTask[] => SEEDS.flatMap((seed) => start(game, seed).tasks.slice());
  const as = <K extends TaskAnswer['kind']>(t: FormsTask, kind: K): Extract<TaskAnswer, { kind: K }> => {
    expect(t.answer.kind).toBe(kind);
    return t.answer as Extract<TaskAnswer, { kind: K }>;
  };
  const player = (name: string): (typeof content.players)[number] => content.players.find((p) => p.name === name)!;
  const posOf = (name: string): string => content.positions.find((x) => x.id === player(name).pos)!.name;
  /** Задачи игры с условием `text` — случай выбирается явно, а не `if` внутри проверки. */
  const withText = (game: FormsGame, text: string): FormsTask[] => allTasks(game).filter((t) => t.text === text);

  it('К4: раунды — виды из learn.json, задачи свои (не из банка Школы); верные ответы — конец, итог в finishLearn', () => {
    // Ловит: игра берёт задачи банка Школы; вид раунда не по learn.json; конец не после последнего раунда.
    const bank = new Set((tasksJson as { id: string }[]).map((t) => t.id));
    for (const game of FORMS_GAMES) {
      const s0 = start(game);
      expect(s0.tasks.map((t) => t.answer.kind)).toEqual(learnCfg.play.forms[game]);
      expect(s0.tasks.every((t) => t.no === 0 && t.id.startsWith('forms:') && !bank.has(t.id))).toBe(true);
      const s = solve(s0);
      expect(s.done).toBe(true);
      expect(s.misses).toBe(0);
      expect(finishWith(game, s, 30_000).stepAll).toBe(3);
    }
    expect(learnCfg.play.forms.roster).toHaveLength(5);
  });

  it('К4: условие — ключ ru.learn.forms, подстановки задачи закрывают все {x} фразы и не лишние', () => {
    // Ловит: ключ условия без текста; {x} без значения (на экране «{num}»); лишняя подстановка.
    const keys = ru.learn.forms as Record<string, string>;
    const tasks = FORMS_GAMES.flatMap(allTasks);
    expect(new Set(tasks.map((t) => t.text))).toEqual(new Set(Object.keys(keys)));
    for (const t of tasks) {
      const used = [...keys[t.text]!.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(Object.keys(t.args).sort(), t.text).toEqual(used);
    }
  });

  it('К4: «Отбор» — верные варианты следуют из фактов контента: номер, позиция, порог, расцветка формы', () => {
    // Ловит: верным назван не тот игрок или не та форма; порог даёт «все» или «никого».
    for (const t of withText('squad', 'squadNumber')) {
      const a = as(t, 'choice');
      expect(player(a.options[a.correct]!).num).toBe(Number(t.args.num));
      expect(a.options.filter((o) => player(o).num === Number(t.args.num))).toHaveLength(1);
    }
    for (const t of withText('squad', 'squadPos')) {
      const a = as(t, 'multi');
      const pos = content.positions.find((p) => p.acc === t.args.pos)!.id;
      expect(a.options.flatMap((o, i) => (player(o).pos === pos ? [i] : []))).toEqual(a.correct);
    }
    for (const t of withText('squad', 'squadOver')) {
      const a = as(t, 'multi');
      expect(a.options.flatMap((o, i) => (player(o).num > Number(t.args.num) ? [i] : []))).toEqual(a.correct);
      expect(a.correct.length).toBeGreaterThan(0);
      expect(a.correct.length).toBeLessThan(a.options.length);
    }
    for (const t of withText('squad', 'squadKit')) {
      const a = as(t, 'pictures');
      expect(t.refs).toBe('kit');
      const looks = a.pictures.map((id) => content.kits.find((k) => k.id === id)!.look);
      expect(looks.flatMap((l, i) => (l === t.args.look ? [i] : []))).toEqual(a.correct);
      expect(new Set(a.pictures).size).toBe(a.pictures.length);
      expect(a.pictures).not.toContain('club'); // форма клуба — расцветка ребёнка, вечной «зелёной с белым» не показываем
    }
    expect(content.kits.map((k) => k.id)).not.toContain('club');
    expect(content.kits.filter((k) => k.look === 'зелёная с белым').length).toBeGreaterThanOrEqual(2);
    expect(new Set(allTasks('squad').map((t) => t.text))).toEqual(new Set(['squadNumber', 'squadPos', 'squadOver', 'squadKit']));
  });

  it('К4: «Табло» — числа ответа совпадают с условием; доля несократима; исправление — на единицу меньше', () => {
    // Ловит: в поле «верно» не то число, что в условии; сократимая дробь с двумя записями; исправление не той команды.
    const nums = (t: FormsTask): number[] => [Number(t.args.us), Number(t.args.them)];
    for (const t of withText('board', 'boardScore')) expect(as(t, 'fields').fields.map((f) => f.value)).toEqual(nums(t));
    for (const t of withText('board', 'boardLine')) expect(as(t, 'expr').values).toEqual([Number(t.args.min), ...nums(t)]);
    for (const t of withText('board', 'boardShare')) {
      const a = as(t, 'fraction');
      expect([a.num, a.den]).toEqual([Number(t.args.num), Number(t.args.den)]);
      expect(a.num).toBeLessThan(a.den);
      expect([2, 3, 5, 7].filter((d) => a.num % d === 0 && a.den % d === 0)).toEqual([]);
    }
    for (const t of withText('board', 'boardFixUs')) expect(as(t, 'fields').fields.map((f) => f.value)).toEqual([nums(t)[0]! - 1, nums(t)[1]]);
    for (const t of withText('board', 'boardFixThem')) expect(as(t, 'fields').fields.map((f) => f.value)).toEqual([nums(t)[0], nums(t)[1]! - 1]);
    expect(withText('board', 'boardFixUs').length).toBeGreaterThan(0);
    expect(withText('board', 'boardFixThem').length).toBeGreaterThan(0);
  });

  it('К4: «Заявка» — пять строк, пять разных игроков; позиция и номер в списках верные', () => {
    // Ловит: игрок повторяется в заявке; верный пункт списка — не позиция и не номер игрока; номера в списке повторяются.
    for (const seed of SEEDS) {
      const s = start('roster', seed);
      expect(s.tasks).toHaveLength(5);
      expect(new Set(s.tasks.map((t) => t.args.name)).size).toBe(5);
      for (const t of s.tasks) {
        const a = as(t, 'select');
        const [name, positions, nums] = a.row as [string, string[], string[]];
        expect(positions[a.correct[0]!]).toBe(posOf(name));
        expect(nums[a.correct[1]!]).toBe(String(player(name).num));
        expect(new Set(nums).size).toBe(nums.length);
      }
    }
  });

  it('К4: «Пары» — раунд 1 только выученные буквы своих пальцев; раунд 2 — игрок и его позиция', () => {
    // Ловит: в паре невыученная буква (запрет З2); буква не на своём пальце; игрок с чужой позицией.
    const few = ['а', 'о', 'л', 'д', 'ж', 'в'];
    for (const seed of SEEDS) {
      const [r1, r2] = startForms('pairs', few, seed)!.tasks.map((t) => t.answer as MatchAnswer);
      expect(r1!.left.length).toBeGreaterThanOrEqual(4);
      expect(r1!.left.length).toBeLessThanOrEqual(5);
      r1!.left.forEach((finger, i) => {
        const letter = r1!.right[r1!.pairs[i]!]!.toLowerCase();
        expect(few).toContain(letter);
        expect(findChar(keymap, 'jcuken-win', letter)!.key.finger).toBe(finger);
      });
      r2!.left.forEach((name, i) => expect(r2!.right[r2!.pairs[i]!]).toBe(posOf(name)));
    }
    expect(start('pairs').tasks[0]!.refs).toBe('finger');
  });

  it('К4: одно зерно — одни задачи; разные зёрна — разные', () => {
    // Ловит: случайность не от зерна (Math.random); игра всегда одна и та же.
    for (const game of FORMS_GAMES) {
      expect(start(game, 5).tasks).toEqual(start(game, 5).tasks);
      expect(new Set(SEEDS.map((seed) => JSON.stringify(start(game, seed).tasks.map((t) => t.answer)))).size).toBeGreaterThan(1);
    }
  });

  it('К4: ТАБУ — в формах «Отбора» нет синего с жёлтым или золотым', () => {
    // Ловит: в игру попала форма, где жёлтое или золотое касается синего (ТАБУ, В1).
    const hue = (hex: string): number => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
      const d = Math.max(r, g, b) - Math.min(r, g, b);
      if (d < 0.15) return -1; // почти серый (чёрный, белый) — без оттенка
      const h = Math.max(r, g, b) === r ? ((g - b) / d) % 6 : Math.max(r, g, b) === g ? (b - r) / d + 2 : (r - g) / d + 4;
      return (h * 60 + 360) % 360;
    };
    const hues = (k: Record<string, string>): number[] => ['body', 'alt', 'sleeves', 'trim'].map((f) => k[f]).filter((c) => c?.startsWith('#')).map((c) => hue(c!));
    const kits = (kitsJson as Record<string, string>[]).filter((k) => content.kits.some((c) => c.id === k.id));
    expect(kits).toHaveLength(content.kits.length); // все формы «Отбора» есть в kits.json
    for (const k of kits) {
      const h = hues(k);
      expect(h.some((x) => x >= 38 && x <= 65) && h.some((x) => x >= 200 && x <= 260), k.id).toBe(false);
    }
  });

  it('К4: неверное «Ответить» — промах и раунд остаётся; тот же ввод второй раз («двойной щелчок») — не второй промах', () => {
    // Ловит: неверный ответ закрывает раунд; двойной щелчок даёт два промаха; пустой «Ответить» считается промахом; другой неверный ввод не считается.
    const s0 = start('squad');
    expect(actForms(s0, { type: 'submit' }).misses).toBe(0);
    const a = as(s0.tasks[0]!, 'choice');
    const bad = (a.correct + 1) % a.options.length;
    const worse = (a.correct + 2) % a.options.length;
    const answer = (s: FormsState, value: number): FormsState => actForms(actForms(s, { type: 'set', input: { kind: 'choice', value } }), { type: 'submit' });
    const s1 = answer(s0, bad);
    expect(s1.misses).toBe(1);
    expect(s1.round).toBe(0);
    expect(actForms(s1, { type: 'submit' }).misses).toBe(1);
    expect(answer(s1, worse).misses).toBe(2);
    expect(answer(answer(s1, worse), bad).misses).toBe(3);
  });

  it('К4: «Пары» — неверная линия промах, верная остаётся; раунд закрывается на последней', () => {
    // Ловит: неверная линия остаётся в вводе; верная не считается; раунд не закрывается после всех пар.
    const s0 = start('pairs');
    const a = as(s0.tasks[0]!, 'match');
    const wrongRight = (a.pairs[0]! + 1) % a.right.length;
    const miss = actForms(s0, { type: 'link', left: 0, right: wrongRight });
    expect(miss.misses).toBe(1);
    expect(miss.input).toEqual(s0.input);
    const s2 = solveRound(s0);
    expect(s2.round).toBe(1);
    expect(s2.misses).toBe(0);
  });

  it('К4: «Пары» — двойной щелчок по неверной линии один промах; другая неверная линия — ещё один; повтор по связанной строке ничего не меняет', () => {
    // Ловит: два щелчка по одной неверной линии = два промаха; повтор по связанной строке сбивает раунд.
    const s0 = start('pairs');
    const a = as(s0.tasks[0]!, 'match');
    const wrong = (a.pairs[0]! + 1) % a.right.length;
    const other = (a.pairs[0]! + 2) % a.right.length;
    const link = (s: FormsState, left: number, right: number): FormsState => actForms(s, { type: 'link', left, right });
    const once = link(s0, 0, wrong);
    expect(link(once, 0, wrong).misses).toBe(1);
    expect(link(link(once, 0, wrong), 0, other).misses).toBe(2);
    expect(link(link(once, 0, other), 0, wrong).misses).toBe(3);
    const good = link(s0, 0, a.pairs[0]!);
    expect(good.input).toEqual({ kind: 'match', value: [a.pairs[0], ...a.pairs.slice(1).map(() => null)] });
    expect(link(good, 0, a.pairs[0]!)).toBe(good);
    expect(link(good, 0, wrong)).toBe(good);
  });

  it('К4: варианты с игроками — refs player, и каждый факт условия (номер, позиция) есть у игрока-варианта в контенте', () => {
    // Ловит: экран получил имена игроков как «text» и не покажет фигуру, № и позицию; в условии номер или позиция, которых у игрока-варианта нет.
    const named = [...withText('squad', 'squadNumber'), ...withText('squad', 'squadPos'), ...withText('squad', 'squadOver'), ...withText('pairs', 'pairsPos')];
    expect(named.length).toBeGreaterThan(0);
    for (const t of named) {
      expect(t.refs, t.text).toBe('player');
      const a = t.answer as Extract<TaskAnswer, { kind: 'choice' | 'multi' | 'match' }>;
      const names = a.kind === 'match' ? a.left : a.options;
      for (const n of names) expect(content.players.map((p) => p.name), n).toContain(n);
    }
    for (const t of withText('squad', 'squadNumber')) expect(player(as(t, 'choice').options[as(t, 'choice').correct]!).num).toBe(Number(t.args.num));
    for (const t of withText('squad', 'squadPos')) for (const i of as(t, 'multi').correct) expect(content.positions.find((p) => p.id === player(as(t, 'multi').options[i]!).pos)!.acc).toBe(t.args.pos);
    expect(withText('squad', 'squadKit').every((t) => t.refs === 'kit')).toBe(true);
  });

  it('К4: «Отбор» — тот же неверный ввод после «set» тем же значением — один промах', () => {
    // Ловит: set сбрасывает запись «промах уже был», и «Ответить» с тем же неверным вводом считается заново.
    const s0 = start('squad');
    const a = as(s0.tasks[0]!, 'choice');
    const bad = { kind: 'choice' as const, value: (a.correct + 1) % a.options.length };
    const round = (s: FormsState): FormsState => actForms(actForms(s, { type: 'set', input: bad }), { type: 'submit' });
    expect(round(round(s0)).misses).toBe(1);
  });

  it('К4: «Табло», «исправить цифру» — поля заполнены неверным счётом; «Ответить» без правки — не промах; верная правка закрывает', () => {
    // Ловит: раунд 4 начинается с пустых полей (нечего исправлять); двойной Enter на конце раунда 3 даёт промах в раунде 4; начальный счёт совпал с верным.
    for (const seed of SEEDS) {
      const s = start('board', seed);
      const fix = s.tasks[3]!;
      expect(fix.start).toEqual({ kind: 'fields', value: [fix.args.us, fix.args.them] });
      expect(fix.start).not.toEqual(correctInput(fix.answer));
      const at4 = solveRound({ ...s, round: 2 });
      expect(at4.round).toBe(3);
      expect(at4.input).toEqual(fix.start);
      const again = actForms(at4, { type: 'submit' });
      expect(again.misses).toBe(0);
      expect(again.round).toBe(3);
      const done = actForms(actForms(again, { type: 'set', input: correctInput(fix.answer) }), { type: 'submit' });
      expect(done.done).toBe(true);
      expect(done.misses).toBe(0);
    }
    expect(start('board').tasks.slice(0, 3).every((t) => t.start === null)).toBe(true);
  });

  it('К4: «Пары» — двойной щелчок по замыкающей линии раунда не даёт промах в следующем раунде', () => {
    // Ловит: повтор последней верной линии в раунде 2 считается неверной линией и даёт промах.
    const link = (s: FormsState, left: number, right: number): FormsState => actForms(s, { type: 'link', left, right });
    let checked = 0;
    for (const seed of SEEDS) {
      const s0 = start('pairs', seed);
      const a1 = as(s0.tasks[0]!, 'match');
      const a2 = as(s0.tasks[1]!, 'match');
      const closing = a1.pairs.length - 1;
      const closed = a1.pairs.reduce((cur, right, left) => (left === closing ? cur : link(cur, left, right)), s0);
      const done = link(closed, closing, a1.pairs[closing]!);
      expect(done.round).toBe(1);
      // нужны зёрна, где та же линия в раунде 2 неверна (иначе она просто верная и промаха нет и так)
      checked += Number(a2.pairs[closing] !== a1.pairs[closing]);
      expect(link(done, closing, a1.pairs[closing]!).misses).toBe(0);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('К4: игру нечем собрать — null, а не исключение; очередь её не предлагает', () => {
    // Ловит: «Пары» с тремя выученными пальцами падают исключением на старте; очередь предлагает игру, которая не стартует; пустой набор букв ломает остальные.
    const poor = ['а', 'о', 'л'];
    expect(formsBuildable('pairs', poor)).toBe(false);
    expect(startForms('pairs', poor, 1)).toBeNull();
    expect(startForms('pairs', [], 1)).toBeNull();
    expect(startForms('squad', [], 1)).not.toBeNull();
    const learn = learnDef.empty();
    expect(queue(learn, { ...ctx, learned: poor })).not.toContain('pairs');
    expect(queue(learn, { ...ctx, learned })).toContain('pairs');
    expect(queue(learn, ctx)).toContain('pairs');
    expect(baseList(learn, { ...ctx, learned: poor }).find((b) => b.id === 'pairs')!.open).toBe(false);
    expect(baseList(learn, ctx).find((b) => b.id === 'pairs')!.open).toBe(true);
    const gold = { ...learn, games: { ...learn.games, pairs: { step: 3, plays: 3, best: 9, last: '2026-11-01' } } };
    expect(breakCards(gold, { ...ctx, learned: poor }).some((c) => c.kind === 'record' && c.id === 'pairs')).toBe(false);
  });
});

describe('К4: итог игры (общий)', () => {
  it('К4: не доделана — запуск без времени, ничего не засчитано; доделана — время от старта', () => {
    // Ловит: недоигранная игра засчитывается; время считается не от старта.
    const run = startLearn('arrows', ctx, 1);
    expect(settle(run, { misses: 2, done: false }, 9_000).ms).toBeNull();
    expect(finishLearn(saveOf(), settle(run, { misses: 0, done: false }, 9_000), ctx).view).toBeNull();
    expect(settle(run, { misses: 2, done: true }, ctx.now + 9_000)).toMatchObject({ ms: 9_000, misses: 2 });
  });

  it('К4: законченный запуск повтором не перезаписывается — ни время, ни промахи', () => {
    // Ловит: второй вызов settle сдвигает время на более позднее.
    const run = startLearn('arrows', ctx, 1);
    const first = settle(run, { misses: 1, done: true }, ctx.now + 9_000);
    expect(settle(first, { misses: 3, done: true }, ctx.now + 20_000)).toEqual(first);
  });
});

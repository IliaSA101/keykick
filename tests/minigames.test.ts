/**
 * Мини-игры перерыва: задания по зерну, проверка ходов и нажатий. Без проигрыша — но и без
 * обхода правила: заглавная принимается только с Shift другой руки, мяч не проходит сквозь защитника.
 */
import { describe, expect, it } from 'vitest';
import { keymap } from '../src/app/keymap';
import { capitals } from '../src/app/minigames';
import {
  ARROW_ROUNDS,
  BALL_SPOT,
  CAPITAL_WORDS,
  DROP_RADIUS,
  MOUSE_CLICKS,
  MOUSE_DRAGS,
  TAB_PLAYERS,
  TAB_ROUNDS,
  arrowDir,
  atGoal,
  bumpInto,
  capitalLine,
  capitalShift,
  capitalStep,
  droppedOn,
  isMinigame,
  makeArrowField,
  makeMouseGame,
  makeTabGame,
  minigameAt,
  minigames,
  moveBall,
  parseCapitals,
  shortestPath,
  tabSteps,
  tabWrap,
  type ArrowField,
} from '../src/engine/minigames';
import { isDone, startLine, type KeyPress } from '../src/engine/typing';
import {
  PUZZLE_TIME_MAX,
  isPuzzleKey,
  isPuzzleTime,
  isSolved,
  keyUnder,
  makePuzzle,
  placeTile,
  puzzleKey,
  puzzleOutcome,
  puzzleRows,
  puzzleSeconds,
  trayOf,
  type Puzzle,
} from '../src/engine/keyboardPuzzle';
import { layoutKeys } from '../src/engine/keyboardLayout';

const press = (key: string, code = 'KeyA'): KeyPress => ({ code, key, repeat: false, mod: false, caps: false, time: 0 });

describe('выбор мини-игры', () => {
  it('по очереди — все пять, потом сначала; «Собери клавиатуру» — последней; мусор — первая', () => {
    expect([0, 1, 2, 3, 4, 5].map(minigameAt)).toEqual([...minigames, minigames[0]]);
    expect(new Set(minigames).size).toBe(5);
    expect(minigames).toEqual(['arrows', 'mouse', 'tab', 'capitals', 'puzzle']);
    expect(minigameAt(9)).toBe('puzzle');
    for (const bad of [-1, Number.NaN, 1.5, Infinity]) expect(minigameAt(bad)).toBe('arrows');
    expect([isMinigame('tab'), isMinigame('chess'), isMinigame(3)]).toEqual([true, false, false]);
  });
});

describe('«Заглавная»', () => {
  it('слова из content проходят разбор; ошибка в данных падает', () => {
    expect(capitals.length).toBeGreaterThanOrEqual(CAPITAL_WORDS);
    const bad: unknown[] = [null, { capitals: 'Москва' }, { capitals: ['москва', 'Тула', 'Омск', 'Уфа'] }];
    bad.push({ capitals: ['Мos', 'Тула', 'Омск', 'Уфа'] }, { capitals: ['Тула', 'Тула', 'Омск', 'Уфа'] });
    bad.push({ capitals: ['Ту ла', 'Тула', 'Омск', 'Уфа'] }, { capitals: ['ТУла', 'Пенза', 'Омск', 'Уфа'] });
    for (const raw of bad) expect(() => parseCapitals(raw, keymap)).toThrow();
  });

  it('Shift — другой рукой: М (левая рука) — правый Shift, Л (правая) — левый; строчной Shift не нужен', () => {
    expect([capitalShift(keymap, 'М'), capitalShift(keymap, 'Л'), capitalShift(keymap, 'м')]).toEqual([
      'ShiftRight',
      'ShiftLeft',
      null,
    ]);
  });

  it('строка: 4 слова, одно зерно — та же; есть заглавные под обе руки; знакомые буквы — раньше', () => {
    for (let seed = 0; seed < 30; seed++) {
      const line = capitalLine(capitals, keymap, 'фываолдж', seed);
      const words = line.split(' ');
      expect(words).toHaveLength(CAPITAL_WORDS);
      expect(new Set(words).size).toBe(CAPITAL_WORDS);
      const sides = new Set(words.map((w) => capitalShift(keymap, w[0] ?? '')));
      expect(sides).toEqual(new Set(['ShiftLeft', 'ShiftRight']));
      expect(line).toBe(capitalLine(capitals, keymap, 'фываолдж', seed));
    }
    // На среднем ряду в строку попадают слова только из букв ряда («Алла», «Лада», «Влад»…).
    const known = 'фываолдж';
    const easy = capitals.filter((w) => [...w.toLowerCase()].every((ch) => known.includes(ch)));
    expect(easy.length).toBeGreaterThanOrEqual(CAPITAL_WORDS);
    for (let seed = 0; seed < 10; seed++) {
      for (const w of capitalLine(capitals, keymap, known, seed).split(' ')) expect(easy).toContain(w);
    }
  });

  it('заглавная — только с Shift другой руки: иначе курсор стоит и ошибки в счёте нет', () => {
    const start = startLine('Лада', 'ru');
    const wrong = capitalStep(keymap, start, press('Л', 'KeyK'), ['ShiftRight']);
    expect([wrong.wrongShift, wrong.state.pos, wrong.state.stats.errors]).toEqual([true, 0, 0]);
    const none = capitalStep(keymap, start, press('Л', 'KeyK'), []);
    expect(none.wrongShift).toBe(true);
    const right = capitalStep(keymap, start, press('Л', 'KeyK'), ['ShiftLeft']);
    expect([right.wrongShift, right.state.pos]).toEqual([false, 1]);
    // Строчные — обычная печать: Shift не нужен, неверная буква — ошибка, как в тайме.
    let state = right.state;
    for (const ch of 'ада') state = capitalStep(keymap, state, press(ch), []).state;
    expect(isDone(state)).toBe(true);
    const typo = capitalStep(keymap, right.state, press('о', 'KeyJ'), []);
    expect([typo.wrongShift, typo.state.stats.errors]).toEqual([false, 1]);
  });
});

describe('«Пас стрелками»', () => {
  const open: ArrowField = {
    width: 4,
    height: 3,
    start: { x: 0, y: 1 },
    goal: { x: 3, y: 1 },
    defenders: [{ x: 1, y: 1 }],
  };

  it('стрелки по code; мяч не уходит за поле и не проходит сквозь защитника', () => {
    expect(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW'].map(arrowDir)).toEqual([
      'up',
      'down',
      'left',
      'right',
      null,
    ]);
    expect(moveBall(open, open.start, 'right')).toEqual(open.start);
    expect(moveBall(open, open.start, 'left')).toEqual(open.start);
    expect(moveBall(open, { x: 0, y: 0 }, 'up')).toEqual({ x: 0, y: 0 });
    expect(moveBall(open, open.start, 'up')).toEqual({ x: 0, y: 0 });
    expect(shortestPath(open)).toBe(5);
    expect(atGoal(open, { x: 3, y: 1 })).toBe(true);
    expect(shortestPath({ ...open, defenders: [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }] })).toBe(-1);
  });

  it('упёрся — понятно во что: защитник (подсказка «обойди») или край; свободный шаг — null', () => {
    expect(bumpInto(open, open.start, 'right')).toBe('defender');
    expect(bumpInto(open, open.start, 'left')).toBe('edge');
    expect(bumpInto(open, { x: 0, y: 0 }, 'up')).toBe('edge');
    expect(bumpInto(open, { x: 3, y: 2 }, 'down')).toBe('edge');
    expect(bumpInto(open, { x: 3, y: 2 }, 'right')).toBe('edge');
    expect(bumpInto(open, open.start, 'up')).toBeNull();
  });

  it('поле по зерну: путь к воротам есть всегда, одно зерно — то же поле, защитников сколько просили', () => {
    for (let seed = 0; seed < 200; seed++) {
      for (const n of ARROW_ROUNDS) {
        const field = makeArrowField(seed, n);
        expect(shortestPath(field)).toBeGreaterThan(0);
        expect(field.defenders.length).toBeLessThanOrEqual(n);
        expect(field.start.x).toBe(0);
        expect(field.goal.x).toBe(field.width - 1);
      }
    }
    expect(makeArrowField(5, 7)).toEqual(makeArrowField(5, 7));
    expect(makeArrowField(5, 7).defenders).toHaveLength(7);
  });
});

describe('«Точный пас мышью»', () => {
  it('партнёры внутри поля, не налезают друг на друга и на мяч; одно зерно — та же игра', () => {
    for (let seed = 0; seed < 100; seed++) {
      const game = makeMouseGame(seed);
      expect([game.clicks.length, game.drags.length]).toEqual([MOUSE_CLICKS, MOUSE_DRAGS]);
      for (const list of [game.clicks, game.drags]) {
        for (const [i, a] of list.entries()) {
          expect(a.x).toBeGreaterThanOrEqual(10);
          expect(a.x).toBeLessThanOrEqual(90);
          expect(a.y).toBeGreaterThanOrEqual(10);
          expect(a.y).toBeLessThanOrEqual(90);
          expect(droppedOn(a, BALL_SPOT)).toBe(false);
          for (const b of list.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(DROP_RADIUS);
        }
      }
    }
    expect(makeMouseGame(3)).toEqual(makeMouseGame(3));
  });

  it('мяч засчитан рядом с партнёром, мимо — нет', () => {
    const target = { x: 50, y: 50 };
    expect(droppedOn(target, { x: 50 + DROP_RADIUS, y: 50 })).toBe(true);
    expect(droppedOn(target, { x: 50 + DROP_RADIUS + 1, y: 50 })).toBe(false);
  });
});

describe('«Tab по защитникам»', () => {
  it('разные номера; пас не соседу, по кругу и каждый раз новому, два и больше — назад (Shift+Tab); одно зерно — та же игра', () => {
    for (let seed = 0; seed < 100; seed++) {
      const game = makeTabGame(seed);
      expect(new Set(game.numbers).size).toBe(TAB_PLAYERS);
      for (const n of game.numbers) expect(n >= 2 && n <= 99).toBe(true);
      expect(game.targets).toHaveLength(TAB_ROUNDS);
      let at = 0;
      let back = 0;
      for (const t of game.targets) {
        expect(t >= 0 && t < TAB_PLAYERS).toBe(true);
        // Фокус ходит по кругу: и через край до цели не меньше двух нажатий.
        expect(Math.abs(t - at)).toBeGreaterThanOrEqual(2);
        const steps = tabSteps(at, t);
        expect(Math.min(steps.ahead, steps.back)).toBeGreaterThanOrEqual(2);
        if (steps.back < steps.ahead) back++;
        at = t;
      }
      expect(back).toBeGreaterThanOrEqual(2);
      // Пас каждый раз новому: не гоняем мяч между двумя игроками (замечание владельца 04.11).
      expect(new Set([0, ...game.targets]).size).toBe(TAB_ROUNDS + 1);
    }
    expect(makeTabGame(8)).toEqual(makeTabGame(8));
  });

  it('фокус по кругу: Tab с последнего — на первого, Shift+Tab с первого — на последнего, в середине — сам браузер', () => {
    expect(tabWrap(5, 6, false)).toBe(0);
    expect(tabWrap(0, 6, true)).toBe(5);
    expect([tabWrap(0, 6, false), tabWrap(5, 6, true), tabWrap(2, 6, false), tabWrap(2, 6, true)]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect([tabWrap(-1, 6, false), tabWrap(6, 6, true), tabWrap(0, 0, true)]).toEqual([null, null, null]);
    expect(tabSteps(0, 5)).toEqual({ ahead: 5, back: 1 });
    expect(tabSteps(4, 1)).toEqual({ ahead: 3, back: 3 });
  });
});

describe('«Собери клавиатуру»', () => {
  const lettersOf = (rowIndex: number) =>
    (keymap.rows[rowIndex] ?? []).map((k) => k.chars?.ru[0] ?? '').filter((ch) => /^\p{L}$/u.test(ch));
  const home = puzzleRows(keymap).find((r) => r.row === 'home');
  const solve = (p: Puzzle) => p.tiles.reduce((acc, t) => placeTile(acc, t.code, t.code).puzzle, p);

  it('ряды — только с буквами: верхний, основной, нижний; цифры и пробел не собираем', () => {
    expect(puzzleRows(keymap).map((r) => r.row)).toEqual(['top', 'home', 'bottom']);
    expect(home?.keys.some((k) => k.bump)).toBe(true);
  });

  it('фишки — знакомые буквы ряда, остальные стоят; урок 1 — две фишки', () => {
    const p = makePuzzle(keymap, 'ао', 1);
    expect(p.row).toBe('home');
    expect(p.tiles.map((t) => t.char).sort()).toEqual(['а', 'о']);
    expect(p.tiles.map((t) => keymap.byCode.get(t.code)?.chars?.ru[0])).toEqual(p.tiles.map((t) => t.char));
    expect(p.placed).toEqual([]);
    const all = makePuzzle(keymap, 'фываолджпрэ', 2);
    expect(all.tiles.map((t) => t.char).sort()).toEqual(lettersOf(all.rowIndex).sort());
  });

  it('ряд — где больше знакомых букв; при равенстве — основной; знакомых нет — основной целиком', () => {
    expect(makePuzzle(keymap, 'йцукен' + 'ао', 1).row).toBe('top');
    expect(makePuzzle(keymap, 'йцук' + 'фыва', 1).row).toBe('home');
    expect(makePuzzle(keymap, 'йцу' + 'ячс', 1).row).toBe('top');
    expect(makePuzzle(keymap, 'ячсми' + 'ао', 1).row).toBe('bottom');
    // Регистр букв урока не важен; знаки и цифры урока — не фишки.
    expect(makePuzzle(keymap, 'АО., 1', 1).tiles.map((t) => t.char).sort()).toEqual(['а', 'о']);
    const empty = makePuzzle(keymap, '', 1);
    expect(empty.row).toBe('home');
    expect(empty.tiles).toHaveLength(lettersOf(empty.rowIndex).length);
  });

  it('перемешаны по зерну: одно зерно — тот же лоток, порядок ряда — никогда', () => {
    const known = 'фываолджпрэ';
    const rowOrder = (p: Puzzle) => (keymap.rows[p.rowIndex] ?? []).map((k) => k.code).filter((c) => p.tiles.some((t) => t.code === c));
    const orders = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      for (const k of [known, 'ао', 'аовл']) {
        const p = makePuzzle(keymap, k, seed);
        expect(p.tiles.map((t) => t.code)).not.toEqual(rowOrder(p));
        expect(makePuzzle(keymap, k, seed)).toEqual(p);
      }
      orders.add(makePuzzle(keymap, known, seed).tiles.map((t) => t.char).join(''));
    }
    expect(orders.size).toBeGreaterThan(200);
  });

  it('ключ рекорда — ряд и буквы фишек; один и тот же при любом зерне; мусор — не ключ', () => {
    expect(puzzleKey(keymap, 'аовл')).toBe('home:ваол');
    expect(makePuzzle(keymap, 'аовл', 7).key).toBe('home:ваол');
    expect(makePuzzle(keymap, 'аовлыд', 7).key).not.toBe('home:ваол');
    expect([isPuzzleKey('home:ваол'), isPuzzleKey('top:й'), isPuzzleKey('home'), isPuzzleKey('side:ао')]).toEqual([
      true,
      true,
      false,
      false,
    ]);
    expect([isPuzzleKey('home:АО'), isPuzzleKey('home:a1'), isPuzzleKey(3), isPuzzleKey(`home:${'а'.repeat(21)}`)]).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('своя клавиша принимает, чужая — нет; повтор ничего не меняет; «готово» — когда лоток пуст', () => {
    const start = makePuzzle(keymap, 'аовл', 3);
    const [first, second] = start.tiles;
    if (!first || !second) throw new Error('need two tiles');
    const wrong = placeTile(start, first.code, second.code);
    expect(wrong).toEqual({ puzzle: start, result: 'wrong' });
    expect(placeTile(start, first.code, 'KeyQ').result).toBe('wrong');
    const ok = placeTile(start, first.code, first.code);
    expect(ok.result).toBe('placed');
    expect(ok.puzzle.placed).toEqual([first.code]);
    expect(start.placed).toEqual([]);
    // Двойной щелчок: та же фишка второй раз — тот же объект, без второго «встала».
    const again = placeTile(ok.puzzle, first.code, first.code);
    expect(again.result).toBe('again');
    expect(again.puzzle).toBe(ok.puzzle);
    expect(placeTile(ok.puzzle, 'KeyZ', 'KeyZ')).toEqual({ puzzle: ok.puzzle, result: 'again' });
    expect(trayOf(ok.puzzle).map((t) => t.code)).toEqual(start.tiles.slice(1).map((t) => t.code));
    expect(isSolved(ok.puzzle)).toBe(false);
    const done = solve(start);
    expect(isSolved(done)).toBe(true);
    expect(trayOf(done)).toEqual([]);
    expect(done.placed).toHaveLength(start.tiles.length);
  });

  it('бросок: внутри клавиши — она, у края — ближайшая в запасе, далеко — мимо', () => {
    const geo = layoutKeys(keymap);
    const box = geo.keys.find((b) => b.key.code === 'KeyF');
    if (!box) throw new Error('KeyF');
    const mid = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    expect(keyUnder(geo.keys, mid.x, mid.y)?.key.code).toBe('KeyF');
    expect(keyUnder(geo.keys, mid.x, box.y + box.h + 0.05)?.key.code).toBe('KeyF');
    expect(keyUnder(geo.keys, mid.x, -1)).toBeNull();
    expect(keyUnder(geo.keys, geo.width + 1, mid.y)).toBeNull();
    // В зазоре между F и G — та, к которой ближе.
    const g = geo.keys.find((b) => b.key.code === 'KeyG');
    if (!g) throw new Error('KeyG');
    expect(keyUnder(geo.keys, box.x + box.w + 0.01, mid.y)?.key.code).toBe('KeyF');
    expect(keyUnder(geo.keys, g.x - 0.01, mid.y)?.key.code).toBe('KeyG');
  });

  it('время: секунды целые и не меньше одной; мусор — не рекорд', () => {
    expect([puzzleSeconds(400), puzzleSeconds(38_400), puzzleSeconds(38_600)]).toEqual([1, 38, 39]);
    expect([isPuzzleTime(1), isPuzzleTime(PUZZLE_TIME_MAX), isPuzzleTime(PUZZLE_TIME_MAX + 1)]).toEqual([true, true, false]);
    for (const bad of [0, -5, Number.NaN, Infinity, '30000', null]) expect(isPuzzleTime(bad)).toBe(false);
  });

  it('итог: целые секунды совпали с рекордом — десятые и «почти», иначе целые', () => {
    expect(puzzleOutcome(38_400, undefined)).toEqual({ verdict: 'first', seconds: 38, best: null, tenths: false });
    expect(puzzleOutcome(PUZZLE_TIME_MAX + 1, 30_000).verdict).toBe('none');
    // Не побит, целые разные — как раньше: «52 с. Рекорд — 41 с».
    expect(puzzleOutcome(52_000, 41_000)).toEqual({ verdict: 'old', seconds: 52, best: 41, tenths: false });
    // «38 с. Рекорд — 38 с» — ничья после округления: показываем десятые.
    expect(puzzleOutcome(38_400, 38_300)).toEqual({ verdict: 'near', seconds: 38.4, best: 38.3, tenths: true });
    expect(puzzleOutcome(38_300, 38_300).verdict).toBe('near');
    // Побит на доли секунды — новый рекорд, время с десятыми, прежний не нужен.
    expect(puzzleOutcome(38_300, 38_400)).toEqual({ verdict: 'new', seconds: 38.3, best: null, tenths: true });
    expect(puzzleOutcome(30_000, 41_000)).toEqual({ verdict: 'new', seconds: 30, best: null, tenths: false });
    // Тот же порог, что у записи рекорда (applyPuzzleRecord): доли миллисекунды не считаются.
    expect(puzzleOutcome(38_299.8, 38_300).verdict).toBe('near');
  });
});

/**
 * К3 (067 Т3): четыре новых вида ответа (выпадающие списки, соединялка, выбор картинок, поля в выражении),
 * банк задач и генераторы чисел. Старые виды — в tests/tasks/tasks.test.ts.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tasks } from '../../src/app/school/tasks';
import { answerText, checkAnswer, correctInput, emptyInput } from '../../src/engine/school/answers';
import { createRandom } from '../../src/engine/random';
import { generateTask, genTemplates } from '../../src/engine/school/gen';
import { PENALTY_KINDS, parseTasks, pickPenaltyTask } from '../../src/engine/school/tasks';
import { answerKinds } from '../../src/engine/school/answers';
import { FIELD_OF, FINGER_COLORS, columnWidth, digitIndex, isComponentField, linkMatch, matchPick, menuStep, pairColor, pendingFor, svgSrc, toggleIndex, unlinkMatch } from '../../src/components/paper/paper';

describe('К3: четыре новых вида ответа', () => {
  const sel = { kind: 'select', row: ['6', ['+', '×'], '4', '=', ['10', '24']], correct: [1, 1] } as const;
  const match = { kind: 'match', left: ['a', 'b', 'c'], right: ['x', 'y', 'z'], pairs: [2, 0, 1] } as const;
  const pics = { kind: 'pictures', pictures: ['<svg></svg>', '<svg></svg>', '<svg></svg>'], correct: [0, 2] } as const;
  const expr = { kind: 'expr', parts: [null, '×', '(', null, '+ 2', ')', '=', null], values: [4, 4, 24] } as const;

  it('К3: банк — не меньше 60 проверенных задач, у каждого нового вида не меньше 5, уровни 1–3', () => {
    // Ловит: банк недобран до порога ТЗ-6.12 (067-Р21) или новый вид остался без задач.
    expect(tasks.filter((t) => t.verified).length).toBeGreaterThanOrEqual(60);
    for (const kind of ['select', 'match', 'pictures', 'expr'] as const) {
      const own = tasks.filter((t) => t.verified && t.answer.kind === kind);
      expect(own.length, kind).toBeGreaterThanOrEqual(5);
      expect(own.every((t) => [1, 2, 3].includes(t.level))).toBe(true);
    }
  });

  it('К3: список — верный проходит, неверный — wrong, пусто и неполно не списывают', () => {
    // Ловит: проверка списков сравнивает не позиционно или принимает неполный выбор. Краснел на откате: да.
    expect(checkAnswer(sel, { kind: 'select', value: [1, 1] })).toBe('correct');
    expect(checkAnswer(sel, { kind: 'select', value: [0, 1] })).toBe('wrong');
    expect(checkAnswer(sel, { kind: 'select', value: [null, null] })).toBe('empty');
    expect(checkAnswer(sel, { kind: 'select', value: [1, null] })).toBe('incomplete');
    expect(answerText(sel, [])).toBe('6 × 4 = 24');
  });

  it('К3: соединялка — пары; две левые на одной правой — format, попытка цела', () => {
    // Ловит: двойная связь засчитывается как ответ (списывает попытку). Краснел на откате: да.
    expect(checkAnswer(match, { kind: 'match', value: [2, 0, 1] })).toBe('correct');
    expect(checkAnswer(match, { kind: 'match', value: [0, 2, 1] })).toBe('wrong');
    expect(checkAnswer(match, { kind: 'match', value: [2, 2, 1] })).toBe('format');
    expect(checkAnswer(match, { kind: 'match', value: [2, null, null] })).toBe('incomplete');
    expect(checkAnswer(match, { kind: 'match', value: [null, null, null] })).toBe('empty');
    expect(answerText(match, [])).toBe('a — z; b — x; c — y');
  });

  it('К3: картинки — точное множество, лишняя галочка — wrong, ни одной — empty', () => {
    // Ловит: достаточно отметить одну верную картинку. Краснел на откате: да.
    expect(checkAnswer(pics, { kind: 'pictures', value: [2, 0] })).toBe('correct');
    expect(checkAnswer(pics, { kind: 'pictures', value: [0] })).toBe('wrong');
    expect(checkAnswer(pics, { kind: 'pictures', value: [0, 1, 2] })).toBe('wrong');
    expect(checkAnswer(pics, { kind: 'pictures', value: [] })).toBe('empty');
  });

  it('К3: выражение — неверный формат не списывает попытку (ТЗ-6.13)', () => {
    // Ловит: «4,5» или «две» в окошке выражения считается неверным ответом. Краснел на откате: да.
    expect(checkAnswer(expr, { kind: 'expr', value: ['4', '4', '24'] })).toBe('correct');
    expect(checkAnswer(expr, { kind: 'expr', value: ['4', '3', '20'] })).toBe('wrong');
    expect(checkAnswer(expr, { kind: 'expr', value: ['4', '4,5', '24'] })).toBe('format');
    expect(checkAnswer(expr, { kind: 'expr', value: ['4', '', ''] })).toBe('incomplete');
    expect(checkAnswer(expr, { kind: 'expr', value: ['', '', ''] })).toBe('empty');
    expect(answerText(expr, [])).toBe('4 × ( 4 + 2 ) = 24');
  });

  it('К3: пустой ввод под вид и ввод не того вида', () => {
    // Ловит: пустой ввод нового вида не того размера или не проходит свою проверку на «empty».
    for (const a of [sel, match, pics, expr]) {
      expect(checkAnswer(a, emptyInput(a, createRandom(1)))).toBe('empty');
    }
    expect(() => checkAnswer(sel, { kind: 'match', value: [] })).toThrow();
  });

  it('К3: разбор ловит ошибки в новых видах и небезопасный рисунок', () => {
    // Ловит: в контент проходит рисунок со скриптом, сломанный ответ списка или несовпавшие поля выражения.
    const base = { id: 'x', no: 1, text: 't', solution: 's', verified: true, level: 1 };
    const bad = (answer: unknown): unknown => () => parseTasks([{ ...base, answer }]);
    expect(bad({ kind: 'select', row: ['a', ['x', 'y']], correct: [2] })).toThrow();
    expect(bad({ kind: 'match', left: ['a', 'b'], right: ['c', 'd'], pairs: [0, 0] })).toThrow();
    expect(bad({ kind: 'pictures', pictures: ['<svg><script></script></svg>', '<svg></svg>'], correct: [0] })).toThrow();
    expect(bad({ kind: 'expr', parts: [null, '+', null], values: [1] })).toThrow();
  });

  it('К3: генераторы — по семени одна задача, ответ перерешан независимо', () => {
    // Ловит: генератор тянет случайность изнутри или ответ расходится с формулой.
    for (const template of genTemplates) {
      for (let seed = 1; seed <= 40; seed++) {
        const g = generateTask(template, seed);
        expect(generateTask(template, seed)).toEqual(g);
        expect(checkAnswer(g.answer, correctInput(g.answer))).toBe('correct');
        const [a = 0, b = 0] = g.nums;
        if (template === 'round-robin') expect(g.answer).toEqual({ kind: 'integer', value: (a * (a - 1)) / 2 });
        if (template === 'points') expect(g.answer).toEqual({ kind: 'integer', value: 3 * a + b });
        if (template === 'field-area') expect(g.answer).toMatchObject({ kind: 'expr', values: [a, a, a * (a + b)] });
      }
    }
  });

  it('К3: пенальти берёт только виды, которые умеет поле ответа', () => {
    // Ловит: в пенальти попадает список, соединялка, картинки или выражение — у AnswerField для них нет ветки (ревью 067 Т3, п.4).
    for (let seed = 1; seed <= 300; seed++) {
      for (const lessonNo of [1, 13, 30]) {
        expect(PENALTY_KINDS).toContain(pickPenaltyTask(tasks, seed, lessonNo).answer.kind);
      }
    }
    // 067 Т15: поле ответа теперь умеет и новые виды — они в списке (Э1.21: «соединялка, как в МЭШ»)
    for (const k of ['select', 'match', 'pictures', 'expr'] as const) expect(PENALTY_KINDS).toContain(k);
  });

  it('К3: у каждого вида из пенальти есть ветка в поле ответа — лист пенальти рисует его', () => {
    // Ловит: вид попал в PENALTY_KINDS, а в AnswerField.vue для него нет ветки (пустой лист) или вид выпал из таблицы FIELD_OF.
    const src = readFileSync('src/components/paper/AnswerField.vue', 'utf8');
    for (const k of answerKinds) expect(FIELD_OF[k], k).toBeDefined();
    // раздача — по таблице FIELD_OF: у каждого собственного поля ветка «начало тега: v-if/v-else-if="field === '…'"», у компонентных — запись в FIELD_COMPONENT
    for (const k of PENALTY_KINDS) {
      const f = FIELD_OF[k];
      if (isComponentField(f)) expect(src, `компонент ${f}`).toMatch(new RegExp(`FIELD_COMPONENT[^\\n]*\\b${f}: \\w+Field`));
      else expect(src, `ветка ${f}`).toMatch(new RegExp(`\\n\\s+v-(else-)?if="field === '${f}'`));
    }
    for (const c of ['PictureField', 'SelectField', 'MatchField', 'ExprField']) expect(src.includes(c), c).toBe(true);
  });

  it('К3: цвет пары — верная зелёная, неверная красная после ответа; до ответа — цвет пальца; выбор не живёт на закрытом листе', () => {
    // Ловит: верная пара красная (кадр Э3.36, 025-Р20) или выбор `pending` остался после ответа/смены задачи.
    expect(pairColor(1, true, false)).toBe('var(--paper-correct)');
    expect(pairColor(1, true, true)).toBe('var(--paper-wrong)');
    expect(pairColor(1, false, true)).toBe(FINGER_COLORS[1]);
    expect(pendingFor({ l: 1, r: null }, true)).toEqual({ l: null, r: null });
    expect(pendingFor({ l: 1, r: null }, false)).toEqual({ l: 1, r: null });
    expect(columnWidth(['шестиугольник', 'a'], 120, 300)).toBeGreaterThan(columnWidth(['a'], 120, 300));
    expect(columnWidth(['x'.repeat(80)], 120, 300)).toBe(300);
  });

  it('К3: меню списка — стрелки ходят и упираются в края, Enter выбирает, Esc закрывает и не уходит наверх, Enter на закрытом — наверх', () => {
    // Ловит: Esc в открытом меню уходит в паузу матча (Э3.34, 067-Р55); Enter на закрытом списке съеден (ответить не работает).
    const closed = { open: false, hl: 0 };
    expect(menuStep(closed, 'Enter', 3)).toMatchObject({ handled: false, pick: null });
    expect(menuStep(closed, 'ArrowDown', 3).state).toEqual({ open: true, hl: 0 });
    const open = { open: true, hl: 1 };
    expect(menuStep(open, 'ArrowDown', 3).state.hl).toBe(2);
    expect(menuStep({ open: true, hl: 2 }, 'ArrowDown', 3).state.hl).toBe(2);
    expect(menuStep({ open: true, hl: 0 }, 'ArrowUp', 3).state.hl).toBe(0);
    expect(menuStep(open, 'Enter', 3)).toMatchObject({ pick: 1, handled: true, state: { open: false } });
    expect(menuStep(open, 'Escape', 3)).toMatchObject({ pick: null, handled: true, state: { open: false } });
    expect(menuStep(open, 'Tab', 3)).toMatchObject({ handled: false, state: { open: false } });
  });

  it('К3: ответ «рисунки» в пенальти — буквы, в Школе (digits) — цифры', () => {
    // Ловит: пенальти с картинками показывает цифры вместо А, Б, В (кадр Э1.18, 067-Р7).
    expect(answerText(pics, ['А', 'Б', 'В'])).toBe('А, В');
    expect(answerText(pics, [])).toBe('1, 3');
  });

  it('К3: рисунок идёт в <img src> как данные, а не в разметку страницы; в полях нет v-html', () => {
    // Ловит: SVG из контента вставлен через v-html (ревью 067 Т3, безопасность) или адрес данных не закодирован.
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    expect(svgSrc(svg).startsWith('data:image/svg+xml,')).toBe(true);
    expect(svgSrc(svg)).not.toContain('<');
    expect(decodeURIComponent(svgSrc(svg).slice('data:image/svg+xml,'.length))).toBe(svg);
    for (const f of ['PictureField', 'MatchField', 'SelectField', 'ExprField', 'AnswerField', 'NumberStrip']) {
      expect(readFileSync(`src/components/paper/${f}.vue`, 'utf8')).not.toContain('v-html');
    }
  });

  it('К3: соединялка — связь переносится, две левые на одной правой не бывает; клик первым по правой тоже соединяет', () => {
    // Ловит: две левые строки на одной правой (проверка вернёт format), потерянная связь при переносе, клик по правой без пары.
    expect(linkMatch([null, null, null], 0, 2)).toEqual([2, null, null]);
    expect(linkMatch([2, null, null], 1, 2)).toEqual([null, 2, null]);
    expect(linkMatch([2, 1, null], 0, 1)).toEqual([1, null, null]);
    expect(unlinkMatch([2, 0, 1], 1)).toEqual([2, null, 1]);
    const a = matchPick([null, null], { l: null, r: null }, 'r', 1);
    expect(a.pending).toEqual({ l: null, r: 1 });
    expect(matchPick(a.links, a.pending, 'l', 0)).toEqual({ links: [1, null], pending: { l: null, r: null } });
    // повторный клик снимает выбор, клик по той же стороне переносит
    expect(matchPick([null], { l: 0, r: null }, 'l', 0).pending).toEqual({ l: null, r: null });
    expect(matchPick([null, null], { l: 0, r: null }, 'l', 1).pending).toEqual({ l: 1, r: null });
    // собранное кликами проходит проверку движка
    let links: (number | null)[] = [null, null, null];
    let pending = { l: null as number | null, r: null as number | null };
    for (const [l, r] of [[0, 2], [1, 0], [2, 1]] as const) {
      ({ links, pending } = matchPick(links, pending, 'l', l));
      ({ links, pending } = matchPick(links, pending, 'r', r));
    }
    const want = { kind: 'match', left: ['a', 'b', 'c'], right: ['x', 'y', 'z'], pairs: [2, 0, 1] } as const;
    expect(checkAnswer(want, { kind: 'match', value: links })).toBe('correct');
  });

  it('К3: цифры 1–6 — номер варианта; чужие клавиши, модификаторы и лишние номера — ничего; галочка включается и снимается', () => {
    // Ловит: цифра сверх числа вариантов, Ctrl+1 как выбор, «0» и «7» как варианты, дубль номера в галочках.
    expect(digitIndex({ key: '1' }, 4)).toBe(0);
    expect(digitIndex({ key: '4' }, 4)).toBe(3);
    expect(digitIndex({ key: '5' }, 4)).toBeNull();
    expect(digitIndex({ key: '0' }, 6)).toBeNull();
    expect(digitIndex({ key: '7' }, 9)).toBeNull();
    expect(digitIndex({ key: 'a' }, 4)).toBeNull();
    expect(digitIndex({ key: '1', ctrlKey: true }, 4)).toBeNull();
    expect(toggleIndex([0, 2], 1)).toEqual([0, 1, 2]);
    expect(toggleIndex([0, 1, 2], 1)).toEqual([0, 2]);
  });

  it('К2 Р106: figure и hint в задаче необязательны; figure проходит тот же белый список; без них задача как прежде', () => {
    // Ловит: схема отвергает задачу без figure/hint, пропускает figure со скриптом или теряет поля при разборе.
    const base = { id: 'x', no: 1, text: 't', solution: 's', verified: true, level: 1, answer: 5 };
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="3" fill="#fff"/></svg>';
    expect(parseTasks([base])[0]).not.toHaveProperty('figure');
    expect(parseTasks([base])[0]).not.toHaveProperty('hint');
    expect(parseTasks([{ ...base, figure: svg, hint: 'считай клетки' }])[0]).toMatchObject({ figure: svg, hint: 'считай клетки' });
    expect(() => parseTasks([{ ...base, figure: '<svg onload="a()"></svg>' }])).toThrow();
    expect(() => parseTasks([{ ...base, hint: 5 }])).toThrow();
  });

  it('К3: рисунок — белый список тегов и атрибутов; обработчики, ссылки, стили, <use>, <!DOCTYPE — отказ', () => {
    // Ловит: в контент проходит SVG с onload=, ONCLICK=, xlink:href, <use>, style=, fill="url(...)" или <!DOCTYPE (ревью 067 Т3, п.6).
    const ns = 'xmlns="http://www.w3.org/2000/svg"';
    const base = { id: 'x', no: 1, text: 't', solution: 's', verified: true, level: 1 };
    const parse = (svg: string): unknown =>
      parseTasks([{ ...base, answer: { kind: 'pictures', pictures: [svg, '<svg></svg>'], correct: [0] } }]);
    expect(() => parse(`<svg ${ns} viewBox="0 0 10 10"><rect x="1" y="1" width="3" height="3" fill="#fff" stroke="#000"/></svg>`)).not.toThrow();
    const bads = [
      `<svg ${ns} onload="a()"></svg>`,
      `<svg ${ns}><rect ONCLICK="a()"/></svg>`,
      `<svg ${ns}><rect xlink:href="x"/></svg>`,
      `<svg ${ns}><use x="1"/></svg>`,
      `<svg ${ns}><rect style="fill:red"/></svg>`,
      `<svg ${ns}><rect fill="url(#a)"/></svg>`,
      `<svg ${ns}><!DOCTYPE x></svg>`,
      `<svg xmlns="http://evil.example/"></svg>`,
      `<svg ${ns}>текст</svg>`,
    ];
    for (const b of bads) expect(() => parse(b), b).toThrow();
  });

  it('К3: рисунки контента — с xmlns (их вставит <img src="data:image/svg+xml,…">)', () => {
    // Ловит: рисунок без пространства имён не отрисуется как отдельное изображение.
    const svgs = tasks.flatMap((t) => (t.answer.kind === 'pictures' ? t.answer.pictures : []));
    expect(svgs.length).toBeGreaterThan(0);
    for (const v of svgs) expect(v.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('К3: списки-равенства в банке — ровно одна верная расстановка', () => {
    // Ловит: второй верный ответ у задачи «расставь знаки / выбери числа» (задачи 57 и 60 до доправки).
    const calc = (src: string): number => {
      const toks = src.replace(/−/g, '-').replace(/[×·]/g, '*').replace(/[÷:]/g, '/').match(/\d+|[-+*/]/g) ?? [];
      const nums: number[] = [Number(toks[0])];
      const ops: string[] = [];
      for (let i = 1; i < toks.length; i += 2) {
        const op = toks[i] as string;
        const n = Number(toks[i + 1]);
        const last = nums.length - 1;
        if (op === '*') nums[last] = (nums[last] as number) * n;
        else if (op === '/') nums[last] = (nums[last] as number) / n;
        else {
          ops.push(op);
          nums.push(n);
        }
      }
      return ops.reduce((acc, op, i) => (op === '+' ? acc + (nums[i + 1] as number) : acc - (nums[i + 1] as number)), nums[0] as number);
    };
    let checked = 0;
    for (const t of tasks) {
      if (t.answer.kind !== 'select' || !t.answer.row.includes('=')) continue;
      const row = t.answer.row;
      const lists = row.filter((p): p is readonly string[] => typeof p !== 'string');
      const sizes = lists.map((l) => l.length);
      let good = 0;
      const total = sizes.reduce((a, b) => a * b, 1);
      for (let n = 0; n < total; n++) {
        let rest = n;
        const pick = sizes.map((sz) => {
          const v = rest % sz;
          rest = Math.floor(rest / sz);
          return v;
        });
        let k = 0;
        const parts = row.map((p) => (typeof p === 'string' ? p : (p[pick[k++] as number] as string)));
        const eq = parts.indexOf('=');
        if (calc(parts.slice(0, eq).join(' ')) === calc(parts.slice(eq + 1).join(' '))) good++;
      }
      expect(good, `задача ${t.no}`).toBe(1);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('К3: генератор field-area — числа в parts сходятся с выражением', () => {
    // Ловит: шаблон «+ k» в parts расходится с k из nums, и текст выражения врёт про ответ.
    for (let seed = 1; seed <= 40; seed++) {
      const g = generateTask('field-area', seed);
      if (g.answer.kind !== 'expr') throw new Error('expr expected');
      const k = Number(/\+ (\d+)/.exec(g.answer.parts.join(' '))?.[1]);
      const [w = 0, kk = 0] = g.nums;
      expect(k).toBe(kk);
      const [a = 0, b = 0, s = 0] = g.answer.values;
      expect(a * (b + k)).toBe(s);
      expect(answerText(g.answer, [])).toBe(`${a} × ( ${b} + ${k} ) = ${s}`);
      expect(w).toBe(a);
    }
  });

  it('К3: answerText для картинок — буквы верных', () => {
    // Ловит: «Правильный ответ» для pictures показывает номера или пусто вместо букв «А, В».
    expect(answerText(pics, ['А', 'Б', 'В'])).toBe('А, В');
  });
});
